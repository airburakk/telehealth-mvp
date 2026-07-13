import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { decryptCaseFields } from "@/lib/crypto";
import { canCaseBeAccessedBy } from "@/lib/ownership";
import { getCurrentUser } from "@/lib/auth";
import { getTranslations, translateClinical } from "@/lib/i18n";
import { countryFlag, countryName, urgencyStyle, langDir, formatDateTime } from "@/lib/constants";
import { type LineItem } from "@/lib/pricing";
import { parseJourney } from "@/lib/journey";
import { CheckCircle2, FileText, Stethoscope, Sparkles, Package, HeartPulse, Video, ArrowLeft } from "lucide-react";
import { ProcessTracker, type TrackerItem } from "@/components/ProcessTracker";
import { talkTrackerPhases, TALK_TRACKER_TEXTS } from "@/lib/talk-tracker";
import { ConsultGate, type GateAppt } from "@/components/ConsultGate";
import { gateAvailability } from "@/lib/clinical-duty";
import { OfferView } from "@/components/OfferView";
import { ReservationView } from "@/components/ReservationView";
import { BranchBanner } from "@/components/BranchBanner";
import { BRANCHES } from "@/lib/triage";

const PHASE_ICON = {
  case: <FileText size={14} />,
  consult: <Stethoscope size={14} />,
  treatment: <Package size={14} />,
  followup: <HeartPulse size={14} />,
} as const;

// Tek hasta vaka merkezi (basitleştirme Faz 6, 2026-07-12) — /triyaj/[id] sonuç sayfasının halefi:
// süreç tracker'ı + 3-seçenek kapısı + vaka bilgisi + AKTİF GÖRÜŞME CTA'sı + teklif (OfferView
// gömülü, #teklif) + rezervasyon (ReservationView gömülü, #rezervasyon) + post-op bandı TEK sayfada.
// Eski hasta rotaları buraya redirect: /triyaj/[id] · /teklif/[bookingId] · /rezervasyon/[bookingId]
// (bildirim linkleri kırılmaz). BOLA: canAccessCase kapısı DECRYPT ÖNCESİ ([[server-page-bola-ownership]]).
// Sonuç sayfası hasta-yüzlü: vaka dili Türkçe değilse statik etiketler sunucuda çevrilir.
const STATIC_LABELS = [
  "Vakalarım",
  "Vakanız oluşturuldu ve doktor kuyruğuna eklendi",
  "Uzman doktor, hazırlanan vaka özetinizi inceleyip sizinle video görüşmesi planlayacak.",
  "Vaka No", "Aciliyet", "Hasta", "Ülke / Dil", "Yönlendirilen Branş", "Süre", "Vakanız",
  "Şikayet", "Triyaj Gerekçesi", "Belgeler",
  "Acil / Hayati", "Yüksek", "Orta", "Düşük", "Rutin / Elektif",
  "Aktif görüşmeniz var", "Doktorunuzla görüşme odası açık — katılabilirsiniz.", "Görüşmeye katıl",
  "Post-Op takibiniz aktif", "İyileşme kontrolleri ve raporlar takip ekranındadır.", "Takip ekranını aç",
];

export default async function CaseHubPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const raw = await db.case.findUnique({
    where: { id: caseId },
    include: {
      bookings: { orderBy: { createdAt: "desc" } },
      recovery: { select: { id: true } },
      consultations: { select: { id: true, status: true }, orderBy: { startedAt: "desc" } },
    },
  });
  if (!raw) notFound();
  const viewer = await getCurrentUser();
  if (!(await canCaseBeAccessedBy(viewer, raw))) notFound(); // BOLA kapısı decrypt ÖNCESİ
  const c = decryptCaseFields(raw);

  // Aciliyet + Triyaj Gerekçesi klinik-yorum → yalnız klinik personele (doktor/koordinatör/etik/admin)
  // görünür; hasta bu hasta-merkezi sayfada görmez (2026-07-13, kullanıcı isteği). Doktor bu bilgiyi
  // kendi kokpitinde de görür (/doktor/vaka/[id]) — buradaki gizleme yalnız hasta-yüzünü sadeleştirir.
  const isClinician = viewer?.role !== "PATIENT";

  // 3-seçenek kapısı (§3.2): görüşme başlamadıysa ve branşta çevrimiçi doktor yoksa
  const resolved = ["IN_CONSULT", "DONE"].includes(c.status) || c.consultations.length > 0;
  let gate: { hasSentinel: boolean; hasIcapci: boolean; appointment: GateAppt | null } | null = null;
  if (!resolved) {
    const appt = await db.consultAppointment.findUnique({ where: { caseId } });
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
  const activeConsult = c.consultations.find((x) => x.status === "ACTIVE") ?? null;

  // En ileri booking: CONFIRMED > DRAFT > diğer (vakalarim ile aynı öncelik)
  const booking =
    c.bookings.find((b) => b.status === "CONFIRMED") ??
    c.bookings.find((b) => b.status === "DRAFT") ??
    c.bookings[0] ??
    null;
  const reg = booking && c.hospitalRegistryId
    ? await db.registryHospital.findUnique({ where: { id: c.hospitalRegistryId }, select: { authorizationNumber: true } })
    : null;

  // Klinik gerekçe (at-rest şifreli PHI): önbelleklenmez + ad AI'dan gizlenir (P0 #2);
  // statik etiketler + branş + tracker metinleri PHI değil → cache'lenir.
  const branchLabel = BRANCHES.find((b) => b.key === c.branch)?.label ?? c.branch;
  const [uiMap, clinMap] = await Promise.all([
    getTranslations(c.language, [...STATIC_LABELS, c.branch, branchLabel, ...TALK_TRACKER_TEXTS]),
    translateClinical(c.language, [c.reasoning], c.patientName),
  ]);
  const tmap = { ...uiMap, ...clinMap };
  const t = (s: string) => tmap[s] ?? s;

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

  const dir = langDir(c.language);
  const patientName = c.patientName; // decryptCaseFields zaten çözdü

  return (
    <div dir={dir} className="mx-auto max-w-3xl px-5 py-10">
      <div className="flex items-center justify-between gap-3">
        <Link href="/vakalarim" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
          <ArrowLeft size={16} className="rtl:rotate-180" /> {t("Vakalarım")}
        </Link>
        {isClinician && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
            <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {t("Aciliyet")} {c.urgency}/5 · {t(u.label)}
          </span>
        )}
      </div>

      {/* Branş görsel kimliği bandı — vaka merkezi üstünde (renk-türevi CSS banner + SVG amblem) */}
      <div className="mt-4">
        <BranchBanner branchKey={c.branch} branchLabel={t(branchLabel)} eyebrow={t("Vakanız")} />
      </div>

      {gate ? (
        // Kapı: branşta çevrimiçi doktor yok → 3 seçenek (veya süren randevu akışı)
        <div className="mt-4">
          <ConsultGate caseId={c.id} lang={c.language} hasSentinel={gate.hasSentinel} hasIcapci={gate.hasIcapci} appointment={gate.appointment} />
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5 flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" />
          <div>
            <h1 className="font-bold text-emerald-200">{t("Vakanız oluşturuldu ve doktor kuyruğuna eklendi")}</h1>
            <p className="mt-0.5 text-sm text-emerald-200/80">
              {t("Uzman doktor, hazırlanan vaka özetinizi inceleyip sizinle video görüşmesi planlayacak.")}
            </p>
          </div>
        </div>
      )}

      {/* Süreç takip göstergesi (fazlara gruplu) */}
      <div className="mt-5">
        <ProcessTracker items={trackerItems} dir={dir} />
      </div>

      {/* Aktif görüşme CTA — oda açıksa hasta tek tıkla katılır */}
      {activeConsult && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/[0.08] p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Video size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--c-ink)]">{t("Aktif görüşmeniz var")}</div>
            <p className="text-xs text-[var(--c-ink-2)]">{t("Doktorunuzla görüşme odası açık — katılabilirsiniz.")}</p>
          </div>
          <Link href={`/gorusme/${activeConsult.id}`} className="inline-flex items-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">
            <Video size={16} /> {t("Görüşmeye katıl")}
          </Link>
        </div>
      )}

      {/* Vaka bilgi kartı */}
      <div className="mt-5 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">{t("Vaka No")}</div>
            <div className="font-mono text-sm text-[var(--c-ink)]">{c.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <div className="text-right text-xs text-[var(--c-ink-3)]">{formatDateTime(c.createdAt)}</div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <Info k={t("Hasta")} v={patientName} />
          <Info k={t("Ülke / Dil")} v={`${countryFlag(c.country)} ${countryName(c.country)} · ${c.language}`} />
          <Info k={t("Yönlendirilen Branş")} v={t(c.branch)} accent />
          <Info k={t("Süre")} v={c.durationText || "—"} />
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">{t("Şikayet")}</div>
          <p className="mt-1 text-sm text-[var(--c-ink)]">{c.symptoms}</p>
        </div>

        {isClinician && (
          <div className="mt-4 rounded-2xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--c-accent)]">
              <Sparkles size={14} /> {t("Triyaj Gerekçesi")}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink-2)]">{t(c.reasoning)}</p>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">{t("Belgeler")}</div>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-ink)]/10 px-2.5 py-1 text-xs text-[var(--c-ink-2)]">
                  <FileText size={14} className="text-[var(--c-accent)]" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Post-op bandı — takip kendi ekranında (check-in/rapor etkileşimleri orada) */}
      {c.recovery && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white"><HeartPulse size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-emerald-200">{t("Post-Op takibiniz aktif")}</div>
            <p className="text-xs text-emerald-200/80">{t("İyileşme kontrolleri ve raporlar takip ekranındadır.")}</p>
          </div>
          <Link href={`/takip/${c.id}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            <HeartPulse size={16} /> {t("Takip ekranını aç")}
          </Link>
        </div>
      )}

      {/* Teklif — DRAFT/CANCELLED booking (OfferView gömülü; onay/red aksiyonları içinde) */}
      {booking && booking.status !== "CONFIRMED" && (
        <section id="teklif" className="mt-8 scroll-mt-6">
          <OfferView
            embedded
            hospitalName={c.hospitalName}
            hospitalAuthNo={reg?.authorizationNumber || null}
            bookingId={booking.id}
            rezNo={booking.id.slice(0, 8).toUpperCase()}
            tier={booking.tier}
            hospitalType={booking.hospitalType}
            hotelStars={booking.hotelStars}
            nights={booking.nights}
            translator={booking.translator}
            insuranceLevel={booking.insuranceLevel}
            insuranceDetail={booking.insuranceDetail}
            items={JSON.parse(booking.breakdown) as LineItem[]}
            total={booking.total}
            patientName={patientName}
            country={c.country}
            branch={booking.branch}
            escrowStatus={booking.escrowStatus}
            declined={booking.status === "CANCELLED"}
            createdLabel={new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: "Europe/Istanbul" }).format(booking.createdAt)}
          />
        </section>
      )}

      {/* Rezervasyon — CONFIRMED booking (ReservationView gömülü) */}
      {booking && booking.status === "CONFIRMED" && (
        <section id="rezervasyon" className="mt-8 scroll-mt-6">
          <ReservationView
            embedded
            hospitalName={c.hospitalName}
            hospitalAuthNo={reg?.authorizationNumber || null}
            bookingId={booking.id}
            rezNo={booking.id.slice(0, 8).toUpperCase()}
            tier={booking.tier}
            hospitalType={booking.hospitalType}
            hotelStars={booking.hotelStars}
            nights={booking.nights}
            translator={booking.translator}
            insuranceLevel={booking.insuranceLevel}
            insuranceDetail={booking.insuranceDetail}
            items={JSON.parse(booking.breakdown) as LineItem[]}
            split={JSON.parse(booking.split) as LineItem[]}
            total={booking.total}
            patientName={patientName}
            branch={booking.branch}
            escrowStatus={booking.escrowStatus}
            stages={parseJourney(booking.journeyData)}
            caseId={c.id}
          />
        </section>
      )}
    </div>
  );
}

function Info({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">{k}</div>
      <div className={`mt-0.5 ${accent ? "font-semibold text-[var(--c-ink)]" : "text-[var(--c-ink)]"}`}>{v}</div>
    </div>
  );
}
