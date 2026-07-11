import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatUSD } from "@/lib/pricing";
import { formatDateTime } from "@/lib/constants";
import { branchKeyFromLabel, branchLabel, getBranchProcedures, getByCodes } from "@/lib/procedures";
import ProcedureSelector from "@/components/ProcedureSelector";
import { DoctorPreferences } from "@/components/DoctorPreferences";
import { AcademicEditor } from "@/components/AcademicEditor";
import { decryptField } from "@/lib/crypto";
import { Star, BadgeCheck, Wallet, CalendarClock, TrendingUp, ExternalLink, Award, Users, Target } from "lucide-react";
import { getDoctorScorecard, type MetricKey } from "@/lib/match-score";

export const dynamic = "force-dynamic";

const CONSULT_FEE = 150;
const COMMISSION = 0.2;

export default async function DoctorDashboard() {
  const session = await getCurrentUser();
  const u = session ? await db.user.findUnique({ where: { id: session.id } }) : null;
  const doctor = u?.doctorId
    ? await db.doctor.findUnique({
        where: { id: u.doctorId },
        include: { reviews: true, consultations: { include: { case: true }, orderBy: { startedAt: "desc" } } },
      })
    : null;

  if (!doctor) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <h1 className="text-xl font-bold text-[#F4F5F3]">Doktor profili bağlı değil</h1>
        <p className="mt-2 text-sm text-white/50">Bu hesap bir doktor profiline bağlı değil (ör. koordinatör). Vaka kuyruğuna gidin.</p>
        <Link href="/doktor" className="mt-5 inline-flex rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">Doktor Paneli</Link>
      </div>
    );
  }

  const scorecard = await getDoctorScorecard(doctor.id); // CRM eşleştirme kalite kartı (şeffaflık)
  const net = CONSULT_FEE * (1 - COMMISSION);
  const ended = doctor.consultations.filter((c) => c.status === "ENDED");
  const earnings = ended.map((c) => ({ id: c.id, patient: decryptField(c.case.patientName), date: c.endedAt ?? c.startedAt, net }));
  const totalNet = earnings.reduce((a, b) => a + b.net, 0);

  // M5 — Yaptığım İşlemler & Fiyatlandırma (branşa göre tarife + taban/tavan fiyat)
  const branchKey = branchKeyFromLabel(doctor.branch);
  const branchItems = branchKey ? getBranchProcedures(branchKey) : [];
  let initialSel: Record<string, number> = {};
  try {
    initialSel = doctor.procedures ? (JSON.parse(doctor.procedures) as Record<string, number>) : {};
  } catch {
    initialSel = {};
  }
  const branchCodes = new Set(branchItems.map((p) => p.code));
  const extraItems = getByCodes(Object.keys(initialSel).filter((c) => !branchCodes.has(c)));

  // M6 Akademik & Eğitim — kalıcı alanlar (boşsa public profil deterministik üretim fallback eder)
  let certs: string[] = [];
  try { if (doctor.certifications) { const p = JSON.parse(doctor.certifications); if (Array.isArray(p)) certs = p as string[]; } } catch { /* bozuk JSON */ }
  let pubs: { title: string; venue: string; year: number }[] = [];
  try { if (doctor.publications) { const p = JSON.parse(doctor.publications); if (Array.isArray(p)) pubs = p; } } catch { /* bozuk JSON */ }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      {/* Hero */}
      <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-3xl text-2xl font-bold text-white" style={{ background: doctor.color }}>{doctor.name.slice(0, 1)}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-bold text-[#F4F5F3]">{doctor.title} {doctor.name}</h1>
                {doctor.verified && <BadgeCheck size={16} className="text-[#28C8D8]" />}
              </div>
              <div className="text-sm font-medium text-[#1FA9B8]">{doctor.branch} · {doctor.city}</div>
              {/* rating null = veri yok → kendi panelinde dürüst boş-durum "—" (gizleme değil) */}
              <div className="mt-1 inline-flex items-center gap-1 text-sm text-amber-300"><Star size={14} className="fill-amber-400 text-amber-400" /> {doctor.rating != null ? doctor.rating.toFixed(1) : "—"} <span className="text-white/40">({doctor.reviews.length} yorum)</span></div>
            </div>
          </div>
          {doctor.verified ? (
            <Link href={`/hekim/${doctor.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm font-medium text-white/65 hover:bg-[#1E1F22]">
              <ExternalLink size={15} /> Herkese açık profil
            </Link>
          ) : (
            // v4.19: public profil verified-kapılı (notFound) — 404'e götüren link yerine durum notu
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 py-2 text-sm text-white/40" title="Admin onayı sonrası herkese açık profiliniz yayınlanır">
              <ExternalLink size={15} /> Profil onay sonrası yayınlanır
            </span>
          )}
        </div>
      </div>

      {/* İtibar dashboard — null = veri yok → "—" (kendi panelinde gizlemek yerine dürüst boş-durum) */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<Star size={16} />} value={doctor.rating != null ? doctor.rating.toFixed(1) : "—"} label="Memnuniyet" />
        <Metric icon={<TrendingUp size={16} />} value={doctor.successRate != null ? `%${doctor.successRate}` : "—"} label="Başarı oranı" />
        <Metric icon={<Users size={16} />} value={`${ended.length}`} label="Tamamlanan görüşme" />
        <Metric icon={<Award size={16} />} value={doctor.experienceYears != null ? `${doctor.experienceYears} yıl` : "—"} label="Deneyim" />
      </div>

      {/* Eşleştirme Kalite Kartı — CRM 9-metrik skoru (Nöbetçi/İcapçı/SO önceliği); doktora şeffaf */}
      {scorecard && (
        <div className="mt-5 rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50">
              <Target size={15} /> Eşleştirme Kalite Skoru
            </div>
            <div className="text-2xl font-bold text-[#1FA9B8]">%{Math.round(scorecard.score * 100)}</div>
          </div>
          <p className="mt-1 text-xs text-white/50">
            Nöbetçi, İcapçı ve İkinci Görüş eşleştirmesinde önceliğiniz bu metriklerle belirlenir. Veri biriktikçe etkisi artar; verisi olmayan metrikler skoru etkilemez.
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {scorecard.metrics.map((mt) => (
              <div key={mt.key} className="rounded-2xl border border-white/10 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-white/75">{METRIC_LABEL[mt.key]}</span>
                  <span className={mt.active ? "font-semibold text-[#F4F5F3]" : "text-white/40"}>{mt.raw}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${mt.active ? "bg-[#28C8D8]" : "bg-white/20"}`} style={{ width: `${Math.round(mt.value01 * 100)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-white/40">
                  <span>ağırlık %{Math.round(mt.weight * 100)}</span>
                  {!mt.active && <span className="text-amber-500">veri bekleniyor</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* M5 — Yaptığım İşlemler & Fiyatlandırma */}
      {branchKey && (
        <div className="mt-5">
          <ProcedureSelector
            branchKey={branchKey}
            branchLabel={branchLabel(branchKey)}
            branchItems={branchItems}
            initial={initialSel}
            extraItems={extraItems}
          />
        </div>
      )}

      {/* M5 — Profil Tercihleri: hizmet dili / pazar (ülke) / aylık kapasite limiti */}
      <div className="mt-5">
        <DoctorPreferences
          languages={doctor.languages.split(",").map((s) => s.trim()).filter(Boolean)}
          markets={doctor.markets ? doctor.markets.split(",").map((s) => s.trim()).filter(Boolean) : []}
          capacity={doctor.capacity}
          freeCareOptIn={doctor.freeCareOptIn}
          consultOptIn={doctor.consultOptIn}
        />
      </div>

      {/* M6 — Akademik & Eğitim (kalıcı; public profil bunları gösterir, boşsa otomatik üretir) */}
      <div className="mt-5">
        <AcademicEditor
          licenseNo={doctor.licenseNo}
          eduSchool={doctor.eduSchool}
          eduYear={doctor.eduYear}
          specBoard={doctor.specBoard}
          specYear={doctor.specYear}
          certifications={certs}
          publications={pubs}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Hakediş */}
        <div className="rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50"><Wallet size={15} /> Hakediş</div>
            <div className="text-right">
              <div className="text-xs text-white/40">Toplam net (komisyon sonrası)</div>
              <div className="text-xl font-bold text-emerald-300">{formatUSD(totalNet)}</div>
            </div>
          </div>
          {earnings.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">Henüz tamamlanmış görüşme yok.</p>
          ) : (
            <ul className="mt-4 divide-y divide-white/10">
              {earnings.map((e) => (
                <li key={e.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-white/75">Konsültasyon · {e.patient}</div>
                    <div className="text-xs text-white/40">{formatDateTime(e.date)} · brüt {formatUSD(CONSULT_FEE)} · %{COMMISSION * 100} komisyon</div>
                  </div>
                  <span className="font-semibold text-[#F4F5F3]">{formatUSD(e.net)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-white/40">Tedavi paketi payları ay sonu mutabakatında eklenir (demo).</p>
        </div>

        {/* Kapasite + müsaitlik */}
        <aside className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50"><CalendarClock size={15} /> Aylık Kapasite</div>
            <div className="mt-3">
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold text-[#F4F5F3]">{ended.length}<span className="text-base font-normal text-white/40">/{doctor.capacity}</span></span>
                <span className="text-xs text-white/50">işlem</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                {/* capacity<=0 → bölme sıfıra düşmesin (operasyon sayfasındaki Math.max(1,…) deseni; NaN/Infinity engellenir) */}
                <div className="h-full rounded-full bg-[#28C8D8]" style={{ width: `${Math.min(100, Math.round((ended.length / Math.max(1, doctor.capacity)) * 100))}%` }} />
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/50"><CalendarClock size={15} /> Müsaitlik (demo)</div>
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[11px]">
              {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz", "—"].slice(0, 7).map((g, i) => (
                <div key={g} className={`rounded-md py-2 ${i < 5 ? "bg-emerald-500/10 text-emerald-300" : "bg-[#1E1F22] text-white/40"}`}>{g}<div className="font-semibold">{i < 5 ? "09-17" : "—"}</div></div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-[#28C8D8]/25 bg-teal-50/60 p-5 text-sm text-white/65">
            <div className="font-semibold text-[#28C8D8]">Operasyonel yük sıfır</div>
            <p className="mt-1 text-xs">Organizasyon, çeviri ve lojistik platformda. Siz yalnız tıbbi görüşe odaklanın.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

const METRIC_LABEL: Record<MetricKey, string> = {
  rating: "Memnuniyet",
  successRate: "Başarı oranı",
  freeCare: "Ücretsiz hizmet katkısı",
  volume: "Tamamlanan vaka",
  reviewVolume: "Yorum sayısı",
  icapReturn: "İcap dönüş oranı",
  responsiveness: "Yanıt süresi",
  reliability: "Güvenilirlik (iptal)",
  recency: "Güncellik",
};

function Metric({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#161719] p-4">
      <div className="flex items-center gap-1.5 text-white/40">{icon}</div>
      <div className="mt-1 text-xl font-bold text-[#F4F5F3]">{value}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}
