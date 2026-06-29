import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CaseQueue, type CaseRow } from "@/components/CaseQueue";
import { DutyConsole } from "@/components/DutyConsole";
import { DashboardPanel } from "@/components/DashboardPanel";
import { dutyFeed, type DutyRequest } from "@/lib/clinical-duty";
import { panelVisibility } from "@/lib/doctor-home";
import { waitingCount } from "@/lib/pro-bono";
import { openCountForDoctor } from "@/lib/consultation-requests";
import { newsForBranch, NEWS_KIND_LABEL, type NewsItem } from "@/lib/medical-news";
import { decryptField } from "@/lib/crypto";
import { Stethoscope, ArrowRight, Activity, HeartHandshake, Inbox, Newspaper } from "lucide-react";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = ["NEW", "IN_REVIEW"]; // henüz doktora atanmamış (kapı/triyaj) vakalar

export default async function DoctorPanel() {
  const user = await getCurrentUser();
  const isStaffOnly = !!user && user.role !== "DOCTOR"; // koordinatör/etik/admin → doktor profili yok, tüm kuyruk

  // Bağlı doktor profili
  const me = user ? await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } }) : null;
  const doctor = me?.doctorId ? await db.doctor.findUnique({ where: { id: me.doctorId } }) : null;

  // M5 onboarding + aktivasyon kapısı: doktor henüz onboard olmadıysa VEYA zorunlu mesleki belgeleri
  // (diploma + MMSS) tamamlamadıysa (activatedAt yok) kapıya yönlendir. (baslangic sayfası ikisi de
  // tamamsa /doktor'a geri yönlendirir → sonsuz döngü yok.)
  if (user?.role === "DOCTOR" && doctor && (!doctor.onboardedAt || !doctor.activatedAt)) {
    redirect("/doktor/baslangic");
  }

  // Pencere görünürlüğü (doktor yoksa = personel: duty[tümü] + SO[gözetim] + haberler).
  const vis = doctor
    ? panelVisibility(doctor)
    : { duty: true as const, so: true, proBono: false, consult: false, news: true as const };

  // ── Panel 1: Klinik Nöbet — yalnız bu doktorla eşleşen vakalar (personelde tümü) ──
  const caseWhere = doctor
    ? { OR: [{ doctorId: doctor.id }, { status: { in: OPEN_STATUSES }, branch: doctor.branch }] }
    : {}; // personel: filtresiz tüm kuyruk
  const cases = await db.case.findMany({
    where: caseWhere,
    include: { doctor: true },
    orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
  });
  const rows: CaseRow[] = cases.map((c) => ({
    id: c.id,
    patientName: decryptField(c.patientName), // kimlik at-rest şifreli → çöz (E2EE inc.2c)
    country: c.country,
    language: c.language,
    branch: c.branch,
    urgency: c.urgency,
    status: c.status,
    createdAt: c.createdAt.toISOString(),
    doctorName: c.doctor ? `${c.doctor.title} ${c.doctor.name}` : null,
    hasFiles: !!c.attachments,
  }));

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

  // ── Panel 3: Pro Bono bekleyen sayısı ──
  const pbWaiting = vis.proBono ? await waitingCount() : 0;

  // ── Panel 4: açık konsültasyon talebi sayısı (genel havuz + kendi branşı) ──
  const consultOpen = vis.consult && doctor ? await openCountForDoctor(doctor.branch) : 0;

  // ── Panel 5: Haberler ──
  const news = newsForBranch(doctor?.branch);

  const queueTitle = doctor ? "Eşleşen Vakalar" : "Vaka Kuyruğu (tüm)";
  const queueSub = doctor
    ? "Branşınızdaki açık vakalar + size atanmış görüşmeler"
    : "Aciliyet sırasına göre triyajdan geçmiş tüm vakalar";

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#101010]">Doktor Ana Sayfası</h1>
        <p className="mt-1 text-sm text-slate-500">Birimleriniz tercihinize göre düzenlendi.</p>
      </div>

      {/* ── Panel 1: Klinik Nöbet (DutyConsole kendi başlığını taşır) + eşleşen vakalar ── */}
      {duty && (
        <div className="mb-5">
          <DutyConsole initial={duty} initialRequests={dutyRequests} />
        </div>
      )}
      <DashboardPanel
        icon={<Activity size={18} />}
        title={queueTitle}
        subtitle={queueSub}
      >
        <CaseQueue rows={rows} />
      </DashboardPanel>

      {/* ── Panel 2-4: koşullu birimler ── */}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        {vis.so && (
          <DashboardPanel
            icon={<Stethoscope size={18} />}
            title="İkinci Görüş"
            subtitle="Atanan vakalar — dosya inceleme + yazılı görüş"
            badge={soCount > 0 ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">{soCount} bekliyor</span> : undefined}
          >
            <Link href="/doktor/ikinci-gorus" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0E8A95] hover:underline">
              İkinci Görüş panelini aç <ArrowRight size={15} />
            </Link>
          </DashboardPanel>
        )}

        {vis.proBono && (
          <DashboardPanel
            icon={<HeartHandshake size={18} />}
            title="Pro Bono"
            subtitle="Ücretsiz gönüllü konsültasyon"
            accent="#fb7185"
            badge={pbWaiting > 0 ? <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">{pbWaiting} bekleyen hasta</span> : undefined}
          >
            <Link href="/doktor/pro-bono" className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-600 hover:underline">
              Pro Bono konsolunu aç <ArrowRight size={15} />
            </Link>
          </DashboardPanel>
        )}

        {vis.consult && (
          <DashboardPanel
            icon={<Inbox size={18} />}
            title="Konsültasyon Talepleri"
            subtitle="Partner doktorlardan anonim hasta dosyaları"
            accent="#818cf8"
            badge={consultOpen > 0 ? <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700">{consultOpen} açık talep</span> : undefined}
          >
            <Link href="/doktor/konsultasyon" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6d75e0] hover:underline">
              Konsültasyon kutusunu aç <ArrowRight size={15} />
            </Link>
          </DashboardPanel>
        )}
      </div>

      {/* ── Panel 5: Haberler ── */}
      <div className="mt-5">
        <DashboardPanel
          icon={<Newspaper size={18} />}
          title="Haberler"
          subtitle={doctor?.branch ? `Genel tıp gündemi + ${doctor.branch}` : "Genel tıp gündemi"}
          accent="#34d399"
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            {news.map((n) => <NewsCard key={n.id} item={n} />)}
          </ul>
        </DashboardPanel>
      </div>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const kindColor: Record<string, string> = {
    haber: "bg-sky-100 text-sky-700",
    makale: "bg-violet-100 text-violet-700",
    ilac: "bg-emerald-100 text-emerald-700",
  };
  return (
    <li className="rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindColor[item.kind]}`}>{NEWS_KIND_LABEL[item.kind]}</span>
        <span className="text-[11px] text-slate-400">{item.source}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">{item.title}</div>
      <p className="mt-1 text-xs text-slate-500">{item.summary}</p>
    </li>
  );
}
