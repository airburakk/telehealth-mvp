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
import { AuraPanel } from "@/components/ui/AuraPanel";
import { AuraButtonLink } from "@/components/ui/AuraButton";
import { InfoField, SectionLabel } from "@/components/ui/InfoField";
import { talkTrackerPhases, TALK_TRACKER_TEXTS } from "@/lib/talk-tracker";
import { ConsultGate, type GateAppt } from "@/components/ConsultGate";
import { TourismInbox } from "@/components/TourismInbox";
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
  "Bakım Yolculuğum",
  "Başvurunuz oluşturuldu ve doktor kuyruğuna eklendi",
  "Uzman doktor, hazırlanan başvuru özetinizi inceleyip sizinle video görüşmesi planlayacak.",
  "Başvuru No", "Başvuru Özeti", "Aciliyet", "Hasta", "Ülke / Dil", "Yönlendirilen Branş", "Süre", "Başvurunuz",
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

  // 3-seçenek kapısı (§3.2): görüşme başlamadıysa ve branşta çevrimiçi doktor yoksa.
  // Sağlık turizmi (tourismPlan != null) FARKLI (2026-07-14): 3-seçenek/nöbetçi kapısı YOK →
  // branş havuzu doktorlarının mesaj/teklifleri (TourismOutreach) beklenir. Bir teklif kabul
  // edilip randevu onaylanınca her iki akışta da aynı "görüşmeye katıl" CTA'sı gösterilir.
  const isTourism = !!c.tourismPlan;
  const resolved = ["IN_CONSULT", "DONE"].includes(c.status) || c.consultations.length > 0;
  let gate: { hasSentinel: boolean; hasIcapci: boolean; appointment: GateAppt | null } | null = null;
  let tourismInbox: { id: string; doctorName: string; message: string; proposedAtLabel: string | null; status: string }[] | null = null;
  if (!resolved) {
    const appt = await db.consultAppointment.findUnique({ where: { caseId } });
    if (appt && appt.status !== "CANCELLED") {
      const avail = isTourism ? { hasSentinel: false, hasIcapci: false } : await gateAvailability(c.branch);
      gate = {
        hasSentinel: avail.hasSentinel,
        hasIcapci: avail.hasIcapci,
        appointment: { status: appt.status, proposedAtLabel: appt.proposedAt ? formatDateTime(appt.proposedAt) : null },
      };
    } else if (isTourism) {
      const rawOut = await db.tourismOutreach.findMany({ where: { caseId }, orderBy: { createdAt: "desc" }, take: 50 });
      const docIds = [...new Set(rawOut.map((o) => o.doctorId))];
      const docs = docIds.length ? await db.doctor.findMany({ where: { id: { in: docIds } }, select: { id: true, name: true, title: true } }) : [];
      const docMap = new Map(docs.map((d) => [d.id, d]));
      tourismInbox = rawOut.map((o) => {
        const d = docMap.get(o.doctorId);
        return {
          id: o.id,
          doctorName: `${d?.title ?? ""} ${d?.name ?? "Doktor"}`.trim(),
          message: o.message,
          proposedAtLabel: o.proposedAt ? formatDateTime(o.proposedAt) : null,
          status: o.status,
        };
      });
    } else {
      const avail = await gateAvailability(c.branch);
      if (!avail.hasOnlineBranch) gate = { hasSentinel: avail.hasSentinel, hasIcapci: avail.hasIcapci, appointment: null };
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
        <Link href="/vakalarim" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] transition-colors duration-200 hover:text-[var(--c-accent)]">
          <ArrowLeft size={16} className="rtl:rotate-180" /> {t("Bakım Yolculuğum")}
        </Link>
        {isClinician && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
            <span className={`h-2 w-2 rounded-full ${u.dot}`} /> {t("Aciliyet")} {c.urgency}/5 · {t(u.label)}
          </span>
        )}
      </div>

      {/* Branş görsel kimliği bandı — vaka merkezi üstünde (renk-türevi CSS banner + SVG amblem) */}
      <div className="mt-5">
        <BranchBanner branchKey={c.branch} branchLabel={t(branchLabel)} eyebrow={t("Başvurunuz")} />
      </div>

      {gate ? (
        // Kapı: branşta çevrimiçi doktor yok → 3 seçenek (veya süren randevu akışı)
        <div className="mt-4">
          <ConsultGate caseId={c.id} lang={c.language} hasSentinel={gate.hasSentinel} hasIcapci={gate.hasIcapci} appointment={gate.appointment} />
        </div>
      ) : tourismInbox ? (
        // Sağlık turizmi: branş havuzu doktorlarının mesaj/teklifleri (3-seçenek yok)
        <div className="mt-4">
          <TourismInbox caseId={c.id} branchLabel={t(branchLabel)} country={c.country} outreaches={tourismInbox} />
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5 flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" />
          <div>
            <h1 className="font-semibold text-emerald-200">{t("Başvurunuz oluşturuldu ve doktor kuyruğuna eklendi")}</h1>
            <p className="mt-0.5 text-sm text-emerald-200/80">
              {t("Uzman doktor, hazırlanan başvuru özetinizi inceleyip sizinle video görüşmesi planlayacak.")}
            </p>
          </div>
        </div>
      )}

      {/* Süreç takip göstergesi (fazlara gruplu) */}
      <div className="mt-6">
        <ProcessTracker items={trackerItems} dir={dir} />
      </div>

      {/* Aktif görüşme CTA — oda açıksa hasta tek tıkla katılır */}
      {activeConsult && (
        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-3xl border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/[0.08] p-6">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Video size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="aura-display text-lg font-medium text-[var(--c-ink)]">{t("Aktif görüşmeniz var")}</div>
            <p className="mt-0.5 text-sm text-[var(--c-ink-2)]">{t("Doktorunuzla görüşme odası açık — katılabilirsiniz.")}</p>
          </div>
          <AuraButtonLink href={`/gorusme/${activeConsult.id}`}>
            <Video size={16} /> {t("Görüşmeye katıl")}
          </AuraButtonLink>
        </div>
      )}

      {/* Vaka bilgi kartı — Aura kiti (Doz 1): display başlık + mono meta + InfoField ızgarası */}
      <AuraPanel
        className="mt-6"
        title={t("Başvuru Özeti")}
        meta={`${c.id.slice(0, 8).toUpperCase()} · ${formatDateTime(c.createdAt)}`}
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
          <InfoField k={t("Hasta")} v={patientName} />
          <InfoField k={t("Ülke / Dil")} v={`${countryFlag(c.country)} ${countryName(c.country)} · ${c.language}`} />
          <InfoField k={t("Yönlendirilen Branş")} v={t(c.branch)} accent />
          <InfoField k={t("Süre")} v={c.durationText || "—"} />
        </div>

        <div className="mt-6">
          <SectionLabel>{t("Şikayet")}</SectionLabel>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--c-ink)]">{c.symptoms}</p>
        </div>

        {isClinician && (
          <div className="mt-6 rounded-2xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 p-4">
            <div className="aura-mono flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[var(--c-accent)]">
              <Sparkles size={14} /> {t("Triyaj Gerekçesi")}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink-2)]">{t(c.reasoning)}</p>
          </div>
        )}

        {files.length > 0 && (
          <div className="mt-6">
            <SectionLabel>{t("Belgeler")}</SectionLabel>
            <ul className="mt-2 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-1.5 text-xs text-[var(--c-ink-2)]">
                  <FileText size={14} className="text-[var(--c-accent)]" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </AuraPanel>

      {/* Post-op bandı — takip kendi ekranında (check-in/rapor etkileşimleri orada) */}
      {c.recovery && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-white"><HeartPulse size={20} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-emerald-200">{t("Post-Op takibiniz aktif")}</div>
            <p className="text-xs text-emerald-200/80">{t("İyileşme kontrolleri ve raporlar takip ekranındadır.")}</p>
          </div>
          <Link href={`/takip/${c.id}`} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
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
