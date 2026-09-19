import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CaseQueue, type CaseRow, type CaseQueueServerFilters } from "@/components/CaseQueue";
import { CASE_STATUS } from "@/lib/constants";
import { deniedRoleHome } from "@/lib/roles";
import { hasClinicalAccess } from "@/lib/doctor-activation";
import { CASE_LIST_SELECT, caseLaneOf, doctorQueueScope, queueOrderBy, scopedWhere, staffQueueScope, type QueueSort } from "@/lib/case-access";
import { EmptyState } from "@/components/ui/EmptyState";
import { DutyConsole } from "@/components/DutyConsole";
import { DashboardPanel } from "@/components/DashboardPanel";
import { dutyFeed, type DutyRequest } from "@/lib/clinical-duty";
import { panelVisibility } from "@/lib/doctor-home";
import { waitingCount } from "@/lib/free-care";
import { openCountForDoctor, openRowsForDoctor } from "@/lib/consultation-requests";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { BRANCHES } from "@/lib/triage";
import { decryptField } from "@/lib/crypto";
import { Stethoscope, ArrowRight, Activity, HeartHandshake, Inbox, Plane } from "lucide-react";

export const dynamic = "force-dynamic";

// Paneli açabilen roller — proxy'deki DOCTOR_ROLES ile aynı üçlü; burada AÇIK allowlist (kontrol raporu 2026-09-17
// K01: eskiden "doktor profili yoksa personel" varsayımıyla kimliksiz/iptal edilmiş oturum bile TÜM kuyruğu sorguluyordu).
const PANEL_ROLES: readonly string[] = ["DOCTOR", "COORDINATOR", "ADMIN"];
const CASE_PAGE_SIZE = 50; // kuyruk sayfa boyutu — İKİ dalda (K09: doktor dalı eskiden take:100 + sayfasız, sayılar kesik kümeden)

// Durum noktası renkleri — hasta kartı (MyCasesList STAGE_INK) ile aynı tema-duyarlı token'lar.
const CASE_STATUS_DOT: Record<string, string> = {
  DOCS_PENDING: "var(--c-warning)",
  NEW: "var(--c-info)",
  IN_REVIEW: "var(--c-warning)",
  IN_CONSULT: "var(--c-indigo)",
  DONE: "var(--c-success)",
};
// İkinci Görüş durum noktası — doktor aksiyonu bekleyenler uyarı tonunda.
function soStatusDot(s: string): string {
  if (s === "ASSIGNED" || s === "AWAITING_ADDITIONAL_TESTS") return "var(--c-warning)";
  if (s === "OPINION_DELIVERED" || s === "VIDEO_COMPLETED") return "var(--c-success)";
  if (s.startsWith("VIDEO_")) return "var(--c-indigo)";
  return "var(--c-info)";
}

export default async function DoctorPanel({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; branch?: string; status?: string; urgent?: string; sort?: string; from?: string }>;
}) {
  // ── Kapı (K01): kimliksiz VEYA iptal edilmiş oturum → giriş; HİÇBİR sorgu koşmadan. proxy imzayı geçirir ama
  // getCurrentUser sessionVersion uyuşmazlığında (tüm oturumları kapat / parola değişimi) null döner; sayfa bunu
  // reddetmediğinde personel dalına düşüp TÜM kuyruğu (çözülmüş hasta adıyla) sorguluyordu.
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=%2Fdoktor");
  if (!PANEL_ROLES.includes(user.role)) redirect(deniedRoleHome(user.role));
  const sp = await searchParams;

  // ── DOCTOR: bağlı profil + onboarding/aktivasyon/onay kapıları — hepsi SORGUSUZ ekran ya da yönlendirme.
  // Personel dalı ARTIK yalnız COORDINATOR/ADMIN içindir; "profil yok" durumu oraya DÜŞMEZ.
  const me = user.role === "DOCTOR" ? await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } }) : null;
  const doctor = me?.doctorId ? await db.doctor.findUnique({ where: { id: me.doctorId } }) : null;
  if (user.role === "DOCTOR") {
    if (!doctor) {
      return (
        <GateScreen
          title="Doktor profiliniz henüz bağlı değil"
          sub="Klinik panel, doktor profili tamamlanıp doğrulanmadan vaka göstermez. Başlangıç sayfasından profilinizi oluşturun."
        />
      );
    }
    // M5 onboarding + aktivasyon kapısı: doktor henüz onboard olmadıysa VEYA zorunlu mesleki belgeyi
    // (v6.105'ten beri yalnız diploma) tamamlamadıysa (activatedAt yok — hasClinicalAccess) kapıya yönlendir.
    // (baslangic sayfası ikisi de tamamsa /doktor'a geri yönlendirir → sonsuz döngü yok.)
    // ?from=doctorium (2026-08-16): Doctorium'daki Aşama-1 doktoru AURA toggle'ıyla geldi —
    // baslangic'a aura-gecis bağlamı taşınır, sayfa "AURA'ya geçiş için Aşama 2" uyarı ekranını basar.
    if (!doctor.onboardedAt || !hasClinicalAccess(doctor)) {
      redirect(`/doktor/baslangic${sp.from === "doctorium" ? "?from=aura-gecis" : ""}`);
    }
    // Admin onayı (verified) yoksa kuyruk HİÇ sorgulanmaz — ownership nesne kapısıyla aynı şart (sayfa eskiden bakmıyordu).
    if (!doctor.verified) {
      return (
        <GateScreen
          title="Hesabınız onay bekliyor"
          sub="Belgeleriniz incelendikten sonra klinik panel ve vaka kuyruğu açılır. Bu sırada Doctorium'u kullanmaya devam edebilirsiniz."
        />
      );
    }
  }

  // Pencere görünürlüğü (doktor yoksa = personel: duty[tümü] + SO[gözetim]).
  const vis = doctor
    ? panelVisibility(doctor)
    : { duty: true as const, so: true, freeCare: false, consult: false, tourism: true as const };

  // ── Panel 1: vaka kuyruğu — TEK kod yolu (K02/K09): kapsam lib/case-access'ten (doktor = atanan + KENDİ branşı
  // havuz [NEW/IN_REVIEW], silme-kilitliler hariç; personel = tüm kuyruk). Sayılar, branş/durum/acil filtresi,
  // sıralama ve sayfalama iki dalda da SUNUCUDA — "Toplam" gerçek toplamdır, görünür ilk 100 değil.
  const scope = doctor
    ? doctorQueueScope({ doctorId: doctor.id, branch: doctor.branch, verified: doctor.verified })
    : staffQueueScope();
  const [total, waiting, urgent, branchRows] = await Promise.all([
    db.case.count({ where: scope }),
    db.case.count({ where: scopedWhere(scope, { status: "NEW" }) }),
    db.case.count({ where: scopedWhere(scope, { urgent: true }) }),
    // Branş dropdown seçenekleri: kapsamın tam listesi (yalnız görünen sayfanın branşları değil).
    db.case.findMany({ where: scope, select: { branch: true }, distinct: ["branch"], orderBy: { branch: "asc" } }),
  ]);
  const branchOptions = branchRows.map((b) => b.branch);
  // Geçerli değer kontrolü: branş mevcut listeden, durum CASE_STATUS anahtarlarından; aksi = filtresiz.
  const branchFilter = sp.branch && branchOptions.includes(sp.branch) ? sp.branch : undefined;
  const statusFilter = sp.status && sp.status in CASE_STATUS ? sp.status : undefined;
  const urgentFilter = sp.urgent === "1"; // "Acil (4-5)" stat tıklaması (2026-08-04) — urgency>=4
  const sort: QueueSort = sp.sort === "newest" ? "newest" : "urgency";
  const listWhere = scopedWhere(scope, { branch: branchFilter, status: statusFilter, urgent: urgentFilter });
  // Liste + sayfalama toplamı filtreli; üst istatistikler taban (filtresiz genel bakış) kalır.
  const caseTotal = branchFilter || statusFilter || urgentFilter ? await db.case.count({ where: listWhere }) : total;
  const caseTotalPages = Math.max(1, Math.ceil(caseTotal / CASE_PAGE_SIZE));
  // İstenen sayfayı geçerli aralığa sıkıştır (0/negatif/NaN/aşırı-büyük güvenli).
  const casePage = Math.min(Math.max(1, parseInt(sp.page ?? "1", 10) || 1), caseTotalPages);
  const queueStats = { total, waiting, urgent }; // üst istatistikler tam kümeden (rows yalnız görünür dilim)
  const queueServerFilters: CaseQueueServerFilters = {
    branch: branchFilter ?? "all", status: statusFilter ?? "all", urgent: urgentFilter, sort, branches: branchOptions,
  };
  const caseFilterQs =
    (branchFilter ? `&branch=${encodeURIComponent(branchFilter)}` : "") +
    (statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : "") +
    (urgentFilter ? "&urgent=1" : "") +
    (sort === "newest" ? "&sort=newest" : "");
  const cases = await db.case.findMany({
    where: listWhere,
    select: CASE_LIST_SELECT,
    orderBy: queueOrderBy(sort),
    skip: (casePage - 1) * CASE_PAGE_SIZE,
    take: CASE_PAGE_SIZE,
  });
  const caseRows: CaseRow[] = cases.map((c) => {
    const st = CASE_STATUS[c.status] ?? CASE_STATUS.NEW;
    return {
      id: c.id,
      lane: caseLaneOf(c), // öncelik hasta tarafıyla (vakalarim) aynı
      href: `/doktor/vaka/${c.id}`,
      patientName: decryptField(c.patientName), // kimlik at-rest şifreli → çöz (E2EE inc.2c)
      country: c.country,
      branch: c.branch,
      urgency: c.urgency,
      status: c.status,
      statusLabel: st.label,
      statusDot: CASE_STATUS_DOT[c.status] ?? "var(--c-ink-3)",
      createdAt: c.createdAt.toISOString(),
      doctorName: c.doctor ? `${c.doctor.title} ${c.doctor.name}` : null,
      hasFiles: !!c.attachments,
    };
  });

  // ── Birleşik liste (2026-07-31, kullanıcı kararı): doktor dalında İkinci Görüş + Konsültasyon
  // satırları da kuyruğa katılır (5'li kulvar filtresi). Kendi panelleri ayrıca durur. ──
  let soQueueRows: CaseRow[] = [];
  if (doctor && vis.so) {
    // Doktor SO sayfasındaki "mine" kümesinin hafif kopyası + güvenli taraf deletionLockedAt:null
    // (silme kilidi konan dosya listeye hiç düşmez). Şifreli alan taşınmaz.
    const soCases = await db.secondOpinionCase.findMany({
      where: { assignedDoctorId: doctor.id, status: { notIn: ["CLOSED", "CANCELLED"] }, deletionLockedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, branch: true, status: true, createdAt: true, patientId: true, country: true, _count: { select: { documents: true } } },
    });
    const soUsers = soCases.length
      ? await db.user.findMany({ where: { id: { in: [...new Set(soCases.map((c) => c.patientId))] } }, select: { id: true, name: true } })
      : [];
    const soNameById = new Map(soUsers.map((u) => [u.id, u.name]));
    soQueueRows = soCases.map((c) => ({
      id: c.id,
      lane: "so",
      href: `/doktor/ikinci-gorus/${c.id}`,
      // Claim-ÖNCESİ kimlik yok (de-id kararı 2026-07-02) — OFFERED satırda ad açılmaz
      patientName: c.status === "OFFERED" ? "Anonim hasta" : soNameById.get(c.patientId) ?? "Hasta",
      country: c.country,
      branch: BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch,
      urgency: null, // SO dosyasında aciliyet kavramı yok
      status: c.status,
      statusLabel: SO_STATUS_LABELS[c.status as SoStatus] ?? c.status,
      statusDot: soStatusDot(c.status),
      createdAt: c.createdAt.toISOString(),
      doctorName: null,
      hasFiles: c._count.documents > 0,
    }));
  }
  let consultQueueRows: CaseRow[] = [];
  if (doctor && vis.consult) {
    const consultRows = await openRowsForDoctor(doctor.branch, doctor.id);
    consultQueueRows = consultRows.map((r) => ({
      id: r.id,
      lane: "consult",
      href: "/doktor/konsultasyon", // havuz tek sayfada yanıtlanır (talep-bazlı alt rota yok)
      patientName: "Anonim talep", // havuz kimliksizdir (deidentify + scrub)
      country: null,
      branch: r.branch ?? "Genel",
      urgency: r.urgency,
      status: r.status,
      statusLabel: "Açık talep",
      statusDot: "var(--c-info)",
      createdAt: r.createdAt.toISOString(),
      doctorName: null,
      hasFiles: r.docCount > 0,
    }));
  }
  // Aciliyet önde (SO'nun aciliyetsiz satırları en alta), eş aciliyette en yeni önde — CaseQueue
  // içindeki sıralama seçicisinin "Aciliyet" varsayılanıyla aynı kural.
  const rows: CaseRow[] = [...caseRows, ...soQueueRows, ...consultQueueRows].sort((a, b) =>
    sort === "newest"
      ? b.createdAt.localeCompare(a.createdAt)
      : (b.urgency ?? -1) - (a.urgency ?? -1) || b.createdAt.localeCompare(a.createdAt),
  );

  // Nöbet konsolu beslemesi (yalnız doktor)
  let duty: { state: string; onCall: boolean; sentinel: boolean; branch: string } | null = null;
  let dutyRequests: DutyRequest[] = [];
  if (doctor) {
    const feed = await dutyFeed(doctor.id);
    if (feed) {
      duty = { state: feed.state, onCall: feed.onCall, sentinel: feed.sentinel, branch: feed.branch };
      dutyRequests = feed.requests;
    }
  }

  // ── Panel 2: İkinci Görüş sayısı ──
  let soCount = 0;
  if (vis.so) {
    soCount = doctor
      ? await db.secondOpinionCase.count({ where: { assignedDoctorId: doctor.id, status: "ASSIGNED" } })
      : await db.secondOpinionCase.count({ where: { status: "ASSIGNED" } });
  }

  // ── Panel 3: Ücretsiz Sağlık Hizmeti bekleyen sayısı ──
  const pbWaiting = vis.freeCare ? await waitingCount() : 0;

  // ── Panel 4: açık konsültasyon talebi sayısı (genel havuz + kendi branşı; kendi açtıkları sayılmaz — v6.33) ──
  const consultOpen = vis.consult && doctor ? await openCountForDoctor(doctor.branch, doctor.id) : 0;

  // ── Sağlık Turizmi havuzu (branş bazlı, yeni talepler) ──
  const tourismPool = vis.tourism && doctor
    ? await db.case.count({ where: { branch: doctor.branch, tourismPlan: { not: null }, status: "NEW" } })
    : 0;

  const queueTitle = doctor ? "Eşleşen Vakalar" : "Vaka Kuyruğu (tüm)";
  const queueSub = doctor
    ? "Branşınızdaki açık vakalar + size atanmış görüşmeler"
    : "Aciliyet sırasına göre triyajdan geçmiş tüm vakalar";

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6">
        <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Doktor Ana Sayfası</h1>
        <p className="mt-1 text-sm text-[var(--c-ink-2)]">Birimleriniz tercihinize göre düzenlendi.</p>
      </div>

      {/* ── Eşleşen Vakalar (2026-07-31 sıra kararı; Bildirim Tercihi kartı 2026-08-14'te
          /doktor/profil sayfasına taşındı — Profil Tercihleri'nin üstündeki bölüm) ── */}
      <DashboardPanel
        icon={<Activity size={18} />}
        title={queueTitle}
        subtitle={queueSub}
      >
        {/* Sunucu filtreleri + sayfalama artık İKİ dalda (K09); doktor dalında liste varsayılan KAPALI
            (2026-07-31 kararı) ve 5'li kulvar çipleri korunur — CaseQueue `startCollapsed`/`laneFilter`.
            Sayfalama gezintisi bileşenin içinde (liste açıkken çizilir). */}
        <CaseQueue
          rows={rows}
          stats={queueStats}
          serverFilters={queueServerFilters}
          startCollapsed={!!doctor}
          laneFilter={!!doctor}
          pagination={{ page: casePage, totalPages: caseTotalPages, total: caseTotal, qs: caseFilterQs }}
        />
      </DashboardPanel>

      {/* ── Uzaktan Sağlık (DutyConsole kendi başlığını taşır; 2026-07-31: Eşleşen Vakalar'ın altına indi) ── */}
      {duty && (
        <div className="mt-5">
          <DutyConsole initial={duty} initialRequests={dutyRequests} />
        </div>
      )}

      {/* ── Kulvar panelleri — TAM GENİŞLİK, alt alta (2026-07-31: sm:grid-cols-2 kaldırıldı,
          Uzaktan Sağlık ile aynı genişlikte) ── */}
      <div className="mt-5 grid gap-5">
        {vis.so && (
          <DashboardPanel
            icon={<Stethoscope size={18} />}
            title="İkinci Görüş"
            subtitle="Atanan vakalar — dosya inceleme + yazılı görüş"
            accent="var(--lane-so)"
            badge={soCount > 0 ? <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">{soCount} bekliyor</span> : undefined}
          >
            <Link href="/doktor/ikinci-gorus" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--c-accent-stronger)] hover:underline">
              İkinci Görüş panelini aç <ArrowRight size={15} />
            </Link>
          </DashboardPanel>
        )}

        {vis.tourism && (
          <DashboardPanel
            icon={<Plane size={18} />}
            title="Sağlık Turizmi"
            subtitle={doctor?.branch ? `${doctor.branch} branşı yurtdışı hasta talepleri` : "Yurtdışı hasta talepleri"}
            accent="var(--lane-tourism)"
            badge={tourismPool > 0 ? <span className="rounded-full bg-[var(--c-accent)]/15 px-2.5 py-1 text-xs font-bold text-[var(--c-accent-stronger)]">{tourismPool} yeni talep</span> : undefined}
          >
            <Link href="/doktor/saglik-turizmi" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--c-accent-stronger)] hover:underline">
              Sağlık Turizmi panelini aç <ArrowRight size={15} />
            </Link>
          </DashboardPanel>
        )}

        {vis.freeCare && (
          <DashboardPanel
            icon={<HeartHandshake size={18} />}
            title="Ücretsiz Sağlık Hizmeti"
            subtitle="Ücretsiz gönüllü konsültasyon"
            accent="var(--lane-free)"
            badge={pbWaiting > 0 ? <span className="rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-bold text-rose-300">{pbWaiting} bekleyen hasta</span> : undefined}
          >
            <Link href="/doktor/ucretsiz-saglik" className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-300 hover:underline">
              Ücretsiz Sağlık Hizmeti panelini aç <ArrowRight size={15} />
            </Link>
          </DashboardPanel>
        )}

        {vis.consult && (
          <DashboardPanel
            icon={<Inbox size={18} />}
            title="Konsültasyon Talepleri"
            subtitle="Partner doktorlardan anonim hasta dosyaları"
            accent="var(--lane-consult)"
            badge={consultOpen > 0 ? <span className="rounded-full bg-indigo-500/15 px-2.5 py-1 text-xs font-bold text-indigo-300">{consultOpen} açık talep</span> : undefined}
          >
            <Link href="/doktor/konsultasyon" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6d75e0] hover:underline">
              Konsültasyon panelini aç <ArrowRight size={15} />
            </Link>
          </DashboardPanel>
        )}
      </div>

    </div>
  );
}

// Sorgusuz kapı ekranı (K01): doktor profili yok / admin onayı bekliyor — kuyruk HİÇ sorgulanmaz, personel dalına düşülmez.
function GateScreen({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <EmptyState
        title={title}
        sub={sub}
        action={
          <Link
            href="/doktor/baslangic"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] px-4 py-2 text-sm font-medium text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
          >
            Başlangıç sayfası <ArrowRight size={15} />
          </Link>
        }
      />
    </div>
  );
}
