import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { countryFlag, countryName, formatDateTime } from "@/lib/constants";
import { formatTRY } from "@/lib/procedures";
import { PackageBuilder } from "@/components/PackageBuilder";
import type { RecommendedTreatment } from "@/lib/pricing";
import { getTryPerUsd } from "@/lib/fxrate";
import { recordAccess } from "@/lib/audit";
import { ArrowLeft, Luggage, Languages, Phone, MessageSquare, CalendarRange, Building2, Stethoscope, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const CONTACT_LABELS: Record<string, string> = {
  APP: "Uygulama üzerinden mesaj",
  SMS: "Telefon üzerinden mesaj (SMS)",
  EMAIL: "E-posta",
};

// S3 — Acente tedavi dosyası (FAZ 4, 2026-07-10). VERİ MİNİMİZASYONU KRİTİK:
// SELECT yalnız kimlik/iletişim + doktorun tedavi kararı alanlarını çeker; semptom, triyaj gerekçesi,
// belge, görüntüleme, lab, epikriz KOLONLARI SORGUYA GİRMEZ (decrypt bile edilmez → sızma imkânsız).
// Acente buradan mevcut teklif borusuyla (mode=offer) hastaya paket teklifi gönderir; onay hastada.
export default async function AgencyFilePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const user = await getCurrentUser();
  if (!user || !["AGENCY", "ADMIN"].includes(user.role)) notFound();

  const c = await db.case.findUnique({
    where: { id: caseId },
    select: {
      id: true, userId: true, patientName: true, country: true, language: true, branch: true,
      patientPhone: true, contactPreference: true,
      recommendedProcedures: true, treatmentDaysMin: true, treatmentDaysMax: true,
      hospitalRegistryId: true, hospitalName: true, agencySentAt: true,
      doctor: { select: { title: true, name: true, branch: true, mmssCoverageLimit: true, mmssCoverageCurrency: true } },
      bookings: { orderBy: { createdAt: "desc" }, take: 3, select: { id: true, status: true, total: true, currency: true, createdAt: true } },
    },
  });
  // Yalnız acenteye İLETİLMİŞ dosya (agencySentAt) — iletilmemiş vaka acente için YOK hükmünde (BOLA).
  if (!c || !c.agencySentAt) notFound();

  const patientName = decryptField(c.patientName) ?? "—";
  const patientPhone = decryptField(c.patientPhone);

  // Hastanenin sağlık turizmi yetki belge no'su (HealthTürkiye detay zenginleştirmesi) —
  // acente için kilit güven sinyali; yalnız pozitif rozet basılır ("" = dizinde kayıt yok).
  const registryHospital = c.hospitalRegistryId
    ? await db.registryHospital.findUnique({ where: { id: c.hospitalRegistryId }, select: { authorizationNumber: true } })
    : null;
  const hospitalAuthNo = registryHospital?.authorizationNumber || null;

  // Erişim denetim izi — hasta "verime kim erişti"de görür (acente erişimi de şeffaf).
  await recordAccess({
    actor: user, action: "AGENCY_FILE_VIEW", resourceType: "CASE", resourceId: c.id,
    subjectUserId: c.userId, detail: "Acente tedavi dosyası görüntüledi (kısıtlı alanlar)",
  });

  let treatments: RecommendedTreatment[] = [];
  try { treatments = c.recommendedProcedures ? (JSON.parse(c.recommendedProcedures) as RecommendedTreatment[]) : []; } catch { treatments = []; }
  const totalTRY = treatments.reduce((a, t) => a + (t.priceTRY || 0), 0);

  const fx = await getTryPerUsd();
  let doctorMmssLimitUsd: number | undefined;
  if (c.doctor?.mmssCoverageLimit && c.doctor.mmssCoverageLimit > 0) {
    doctorMmssLimitUsd = c.doctor.mmssCoverageCurrency === "USD" ? c.doctor.mmssCoverageLimit : Math.round(c.doctor.mmssCoverageLimit / fx.rate);
  }

  // Gece sayısı ön-değeri: doktorun öngördüğü sürenin üst sınırı (yoksa PackageBuilder varsayılanı)
  const initialNights = c.treatmentDaysMax != null ? Math.min(30, Math.max(1, c.treatmentDaysMax)) : undefined;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/acente" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> Tedavi dosyaları
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Luggage size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Tedavi Dosyası</h1>
          <p className="text-sm text-[var(--c-ink-2)]">Doktorun tedavi kararına göre paket teklifi hazırlayıp hastaya gönderin.</p>
        </div>
      </div>

      {/* Kısıtlı dosya kartı — yalnız kimlik/iletişim + doktor kararı */}
      <div className="mt-5 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="aura-display text-lg font-medium tracking-tight text-[var(--c-ink)]">{patientName}</h2>
              <span className="text-sm text-[var(--c-ink-3)]">{countryFlag(c.country)} {countryName(c.country)}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--c-ink-2)]">
              <span className="inline-flex items-center gap-1"><Languages size={14} /> {c.language}</span>
              {patientPhone && <span className="inline-flex items-center gap-1"><Phone size={14} /> {patientPhone}</span>}
              {c.contactPreference && (
                <span className="inline-flex items-center gap-1"><MessageSquare size={14} /> {CONTACT_LABELS[c.contactPreference] ?? c.contactPreference}</span>
              )}
            </div>
          </div>
          <div className="text-right text-xs text-[var(--c-ink-3)]">
            iletildi: {formatDateTime(c.agencySentAt)}
            {c.doctor && (
              <div className="mt-1 inline-flex items-center gap-1 text-[var(--c-ink-2)]">
                <Stethoscope size={13} className="text-[var(--c-accent-strong)]" /> {c.doctor.title} {c.doctor.name} · <span className="font-medium text-[var(--c-accent-strong)]">{c.branch}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3.5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">Doktorun seçtiği işlemler</div>
            {treatments.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--c-ink-3)]">İşlem seçilmemiş.</p>
            ) : (
              <ul className="mt-1.5 space-y-1 text-sm text-[var(--c-ink)]">
                {treatments.map((t) => (
                  <li key={t.code} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">{t.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{formatTRY(t.priceTRY)}</span>
                  </li>
                ))}
                <li className="flex items-baseline justify-between gap-2 border-t border-[var(--c-hairline)] pt-1 text-[13px] font-bold">
                  <span>Toplam</span><span className="tabular-nums">{formatTRY(totalTRY)}</span>
                </li>
              </ul>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]"><CalendarRange size={12} /> Öngörülen süre</div>
            <p className="mt-1 text-xl font-bold text-[var(--c-ink)]">
              {c.treatmentDaysMin != null && c.treatmentDaysMax != null ? `${c.treatmentDaysMin} – ${c.treatmentDaysMax} gün` : "Belirtilmedi"}
            </p>
            <p className="text-[11px] text-[var(--c-ink-3)]">Konaklama gecesi ön-değeri bu süreden alınır.</p>
          </div>
          <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3.5">
            <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]"><Building2 size={12} /> Hastane</div>
            <p className="mt-1 text-sm font-semibold text-[var(--c-ink)]">{c.hospitalName ?? "Doktor belirtmedi"}</p>
            {c.hospitalRegistryId && <p className="text-[11px] text-[var(--c-ink-3)]">HealthTürkiye #{c.hospitalRegistryId}</p>}
            {hospitalAuthNo && (
              <p className="mt-1.5">
                <span title="Sağlık turizmi yetki belgesi (HealthTürkiye dizini)" className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                  <ShieldCheck size={12} /> Yetki belgesi: {hospitalAuthNo}
                </span>
              </p>
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
          Bu dosyada tıbbi belge, görüntüleme, test sonucu ve şikâyet metni BULUNMAZ (veri minimizasyonu) —
          yalnız teklif hazırlamak için gereken bilgiler paylaşılır. Erişiminiz hastanın denetim kaydına işlenir.
        </p>
      </div>

      {/* Teklif hazırlama — mevcut paket motoru, acente modu (yalnız hastaya teklif; doğrudan Escrow yok) */}
      <div className="mt-6">
        <PackageBuilder
          caseId={c.id}
          patientName={patientName}
          branch={c.branch}
          country={c.country}
          initial={initialNights ? {
            nights: initialNights,
            rationaleTitle: "🧳 Doktorun tedavi kararından ön-dolduruldu",
            aiRationale: `Tedavi kalemleri ve fiyatları doktorun kararından gelir; konaklama süresi öngörülen tedavi süresine (${c.treatmentDaysMin ?? "?"}–${c.treatmentDaysMax ?? "?"} gün) göre ön-ayarlandı. Tüm değerleri düzenleyebilirsiniz.`,
          } : undefined}
          treatments={treatments}
          rate={fx.rate}
          fxSource={fx.source}
          fxAt={fx.at}
          doctorMmssLimitUsd={doctorMmssLimitUsd}
          doctorName={c.doctor ? `${c.doctor.title} ${c.doctor.name}` : undefined}
          offerOnly
        />
      </div>
    </div>
  );
}
