import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { PackageBuilder, type PackageInitial } from "@/components/PackageBuilder";
import { TIER_PRESETS, type RecommendedTreatment } from "@/lib/pricing";
import { getTryPerUsd } from "@/lib/fxrate";
import { decryptField } from "@/lib/crypto";
import { ArrowLeft, Luggage } from "lucide-react";

export const dynamic = "force-dynamic";

// Sağlık Turizmi Faz 2 — Case.tourismPlan (hasta tercihleri JSON) → PackageInitial ön-dolum.
// TIER_PRESETS'ten otel/hastane/tercüman/sigorta türetilir (hasta önizlemesiyle birebir); doktor düzenler.
// 2026-07-12: hasta-yüzü artık tier/gece sormuyor — plan'da ikisi de yoksa ön-dolum İDDİASI yapılmaz
// (sahte "hasta tercihi" rationale'i doktora gitmesin; veri dürüstlüğü).
function tourismInitial(raw: string | null): PackageInitial | undefined {
  if (!raw) return undefined;
  let p: { tier?: string; nights?: number } | undefined;
  try { p = JSON.parse(raw) as { tier?: string; nights?: number }; } catch { return undefined; }
  const tier = (["Ekonomik", "Standart", "Premium"] as const).find((t) => t === p?.tier);
  if (!tier && !p?.nights) return undefined;
  const preset = tier ? TIER_PRESETS[tier] : undefined;
  return {
    tier,
    nights: p?.nights ? Math.min(30, Math.max(1, Number(p.nights) || 7)) : undefined,
    hotelStars: preset?.hotelStars,
    hospitalType: preset?.hospitalType,
    translator: preset?.translator,
    insuranceLevel: preset?.insuranceLevel,
    rationaleTitle: "🧳 Hastanın sağlık turizmi tercihlerinden ön-dolduruldu",
    aiRationale: "Hasta /saglik-turizmi'de bu paket seviyesini ve süresini seçti (tahminî). Tüm değerleri düzenleyebilirsiniz; kesin fiyat platform motorunda hesaplanır.",
  };
}

export default async function PackagePage({
  params, searchParams,
}: { params: Promise<{ caseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { caseId } = await params;
  const sp = await searchParams;
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) notFound();

  // Sahiplik kapısı (BOLA fix 2026-07-03 — /doktor/vaka/[id] A-bulgusunun eşleniği): hasta kendi vakası +
  // atanan/eşleşen-branş doktor + operasyon personeli. proxy /paket'i yalnız giriş+onam'a kapıyor (rol/sahiplik
  // DEĞİL) → sayfa kendi savunmasını yapar. PHI (decryptField'li hasta adı/MMSS) çözülmeden reddet → notFound.
  if (!(await canAccessCase({ userId: c.userId, doctorId: c.doctorId, branch: c.branch, deletionLockedAt: c.deletionLockedAt }))) notFound();

  // Doktorun M2'de tavsiye ettiği tedaviler (varsa) — paket fiyatı bunlardan (doktorun ₺ fiyatı → $)
  let treatments: RecommendedTreatment[] = [];
  try { treatments = c.recommendedProcedures ? (JSON.parse(c.recommendedProcedures) as RecommendedTreatment[]) : []; } catch { treatments = []; }

  // Güncel USD/₺ kuru (TCMB; cache + fallback) — tedavi ₺ fiyatları $'a bu kurla çevrilir
  const fx = await getTryPerUsd();

  // Vakanın doktorunun mevcut MMSS teminat limiti → Katman 3 (malpraktis ek prim) gösterimi (₺ ise USD'ye normalize)
  let doctorMmssLimitUsd: number | undefined;
  let doctorName: string | undefined;
  if (c.doctorId) {
    const doc = await db.doctor.findUnique({ where: { id: c.doctorId }, select: { mmssCoverageLimit: true, mmssCoverageCurrency: true, title: true, name: true } });
    if (doc?.mmssCoverageLimit && doc.mmssCoverageLimit > 0) {
      doctorMmssLimitUsd = doc.mmssCoverageCurrency === "USD" ? doc.mmssCoverageLimit : Math.round(doc.mmssCoverageLimit / fx.rate);
      doctorName = `${doc.title} ${doc.name}`;
    }
  }

  // Sağlık Turizmi Agent'ı teklifi URL ile gelir (ai=1) — doktor her değeri düzenleyebilir
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const initial: PackageInitial | undefined = s("ai") === "1" ? {
    tier: (["Ekonomik", "Standart", "Premium"] as const).find((t) => t === s("tier")),
    hotelStars: s("hotel") === "5" ? 5 : s("hotel") === "4" ? 4 : undefined,
    hospitalType: s("htype") === "Üniversite" ? "Üniversite" : s("htype") === "Özel" ? "Özel" : undefined,
    nights: s("nights") ? Math.min(21, Math.max(1, Number(s("nights")) || 5)) : undefined,
    translator: s("tr") === "1",
    insuranceExtended: s("ie") === "1",
    insuranceMalpractice: s("im") === "1",
    aiRationale: s("why") || "SOAP'taki tedavi planına göre hazırlandı.",
  } : tourismInitial(c.tourismPlan); // ai=1 yoksa: hastanın Sağlık Turizmi tercihleri (Faz 2) ön-doldurur

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href={`/doktor/vaka/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> Vaka detayı
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Luggage size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Sağlık Turizmi Paketi</h1>
          <p className="text-sm text-[var(--c-ink-2)]">{decryptField(c.patientName)} · {c.branch} tedavisi için uçtan uca paket oluşturun.</p>
        </div>
      </div>

      <div className="mt-7">
        <PackageBuilder caseId={c.id} patientName={decryptField(c.patientName)} branch={c.branch} country={c.country} initial={initial} treatments={treatments} rate={fx.rate} fxSource={fx.source} fxAt={fx.at} doctorMmssLimitUsd={doctorMmssLimitUsd} doctorName={doctorName} />
      </div>
    </div>
  );
}
