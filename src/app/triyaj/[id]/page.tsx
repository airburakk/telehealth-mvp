import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { decryptCaseFields } from "@/lib/crypto";
import { canAccessCase } from "@/lib/ownership";
import { getTranslations, translateClinical } from "@/lib/i18n";
import { countryFlag, countryName, urgencyStyle, langDir, formatDateTime } from "@/lib/constants";
import { CheckCircle2, FileText, Stethoscope, ArrowRight, Sparkles, Package, HeartPulse } from "lucide-react";
import { ProcessTracker, type TrackerItem } from "@/components/ProcessTracker";
import { talkTrackerPhases, TALK_TRACKER_TEXTS } from "@/lib/talk-tracker";
import { ConsultGate, type GateAppt } from "@/components/ConsultGate";
import { gateAvailability } from "@/lib/clinical-duty";

const PHASE_ICON = {
  case: <FileText size={14} />,
  consult: <Stethoscope size={14} />,
  treatment: <Package size={14} />,
  followup: <HeartPulse size={14} />,
} as const;

// Sonuç sayfası hasta-yüzlü: vaka dili Türkçe değilse statik etiketler + branş + aciliyet
// sunucu tarafında çevrilir (Translation cache; ilk hasta sonrası maliyetsiz).
const STATIC_LABELS = [
  "Vakanız oluşturuldu ve doktor kuyruğuna eklendi",
  "Uzman doktor, hazırlanan vaka özetinizi inceleyip sizinle video görüşmesi planlayacak.",
  "Vaka No", "Aciliyet", "Hasta", "Ülke / Dil", "Yönlendirilen Branş", "Süre",
  "Şikayet", "Triyaj Gerekçesi", "Belgeler", "Doktor panelinde gör", "Yeni triyaj",
  "Acil / Hayati", "Yüksek", "Orta", "Düşük", "Rutin / Elektif",
];

export default async function TriyajResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = decryptCaseFields(await db.case.findUnique({
    where: { id },
    include: {
      bookings: { select: { status: true } },
      recovery: { select: { id: true } },
      consultations: { select: { id: true } },
    },
  })); // reasoning/symptoms at-rest şifreli → hastaya gösterim/çeviri için çöz
  if (!c) notFound();
  if (!(await canAccessCase(c))) notFound(); // hasta yalnız kendi vaka sonucunu görür

  // 3-seçenek kapısı (§3.2): vaka gate aşamasındaysa (görüşme başlamadı) ve branşta çevrimiçi Branş Doktoru
  // yoksa hastaya 3 seçenek sun. İcapçı randevu akışı sürüyorsa onun durumunu göster (kapı bileşeni içinde).
  const resolved = ["IN_CONSULT", "DONE"].includes(c.status) || c.consultations.length > 0;
  let gate: { hasSentinel: boolean; hasIcapci: boolean; appointment: GateAppt | null } | null = null;
  if (!resolved) {
    const appt = await db.consultAppointment.findUnique({ where: { caseId: id } });
    const avail = await gateAvailability(c.branch);
    if (appt && appt.status !== "CANCELLED") {
      gate = {
        hasSentinel: avail.hasSentinel,
        hasIcapci: avail.hasIcapci,
        appointment: { status: appt.status, proposedAtLabel: appt.proposedAt ? formatDateTime(appt.proposedAt) : null },
      };
    } else if (!avail.hasOnlineBranch) {
      gate = { hasSentinel: avail.hasSentinel, hasIcapci: avail.hasIcapci, appointment: null };
    }
  }

  const u = urgencyStyle(c.urgency);
  const files = c.attachments ? c.attachments.split(",").filter(Boolean) : [];

  // Klinik gerekçe (c.reasoning — at-rest şifreli PHI): önbelleklenmez + ad AI'dan gizlenir (P0 #2).
  // Statik etiketler + branş + tracker metinleri PHI değil → cache'lenir.
  const [uiMap, clinMap] = await Promise.all([
    getTranslations(c.language, [...STATIC_LABELS, c.branch, ...TALK_TRACKER_TEXTS]),
    translateClinical(c.language, [c.reasoning], c.patientName),
  ]);
  const tmap = { ...uiMap, ...clinMap };
  const t = (s: string) => tmap[s] ?? s;

  // Süreç takibi: ulaşılan en ileri booking durumu (CONFIRMED > DRAFT) + post-op varlığı
  const bookingStatus = c.bookings.some((b) => b.status === "CONFIRMED")
    ? "CONFIRMED"
    : c.bookings.some((b) => b.status === "DRAFT")
      ? "DRAFT"
      : (c.bookings[0]?.status ?? null);
  const trackerItems: TrackerItem[] = talkTrackerPhases({
    status: c.status,
    bookingStatus,
    hasRecovery: !!c.recovery,
  }).map((p) => ({ label: t(p.label), subStatus: t(p.sub), state: p.state, icon: PHASE_ICON[p.key] }));

  return (
    <div dir={langDir(c.language)} className="mx-auto max-w-2xl px-5 py-10">
      {gate ? (
        // Kapı: branşta çevrimiçi doktor yok → 3 seçenek (veya süren randevu akışı)
        <ConsultGate caseId={c.id} lang={c.language} hasSentinel={gate.hasSentinel} hasIcapci={gate.hasIcapci} appointment={gate.appointment} />
      ) : (
        <>
          <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" />
            <div>
              <h1 className="font-bold text-emerald-200">{t("Vakanız oluşturuldu ve doktor kuyruğuna eklendi")}</h1>
              <p className="mt-0.5 text-sm text-emerald-200/90">
                {t("Uzman doktor, hazırlanan vaka özetinizi inceleyip sizinle video görüşmesi planlayacak.")}
              </p>
            </div>
          </div>

          {/* Süreç takip göstergesi (fazlara gruplu) */}
          <div className="mt-6">
            <ProcessTracker items={trackerItems} dir={langDir(c.language)} />
          </div>
        </>
      )}

      <div className="mt-6 rounded-3xl border border-white/10 bg-[#161719] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">{t("Vaka No")}</div>
            <div className="font-mono text-sm text-white/75">{c.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
            <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {t("Aciliyet")} {c.urgency}/5 · {t(u.label)}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <Info k={t("Hasta")} v={c.patientName} />
          <Info k={t("Ülke / Dil")} v={`${countryFlag(c.country)} ${countryName(c.country)} · ${c.language}`} />
          <Info k={t("Yönlendirilen Branş")} v={t(c.branch)} accent />
          <Info k={t("Süre")} v={c.durationText || "—"} />
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-white/40">{t("Şikayet")}</div>
          <p className="mt-1 text-sm text-white/75">{c.symptoms}</p>
        </div>

        <div className="mt-4 rounded-2xl border border-[#28C8D8]/25 bg-[#28C8D8]/10 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#28C8D8]">
            <Sparkles size={14} /> {t("Triyaj Gerekçesi")}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/65">{t(c.reasoning)}</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-white/40">{t("Belgeler")}</div>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/65">
                  <FileText size={14} className="text-[#28C8D8]" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {!gate && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/doktor" className="inline-flex items-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            <Stethoscope size={16} /> {t("Doktor panelinde gör")}
          </Link>
          <Link href="/triyaj" className="inline-flex items-center gap-2 rounded-lg bg-[#161719] px-4 py-2.5 text-sm font-semibold text-white/75 ring-1 ring-white/15 hover:bg-[#1E1F22]">
            {t("Yeni triyaj")} <ArrowRight size={16} />
          </Link>
        </div>
      )}
    </div>
  );
}

function Info({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-white/40">{k}</div>
      <div className={`mt-0.5 ${accent ? "font-semibold text-[#F4F5F3]" : "text-[#F4F5F3]"}`}>{v}</div>
    </div>
  );
}
