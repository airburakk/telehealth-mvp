import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PackageBuilder, type PackageInitial } from "@/components/PackageBuilder";
import { type RecommendedTreatment } from "@/lib/pricing";
import { getTryPerUsd } from "@/lib/fxrate";
import { decryptField } from "@/lib/crypto";
import { ArrowLeft, Luggage } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PackagePage({
  params, searchParams,
}: { params: Promise<{ caseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { caseId } = await params;
  const sp = await searchParams;
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) notFound();

  // Doktorun M2'de tavsiye ettiği tedaviler (varsa) — paket fiyatı bunlardan (doktorun ₺ fiyatı → $)
  let treatments: RecommendedTreatment[] = [];
  try { treatments = c.recommendedProcedures ? (JSON.parse(c.recommendedProcedures) as RecommendedTreatment[]) : []; } catch { treatments = []; }

  // Güncel USD/₺ kuru (TCMB; cache + fallback) — tedavi ₺ fiyatları $'a bu kurla çevrilir
  const fx = await getTryPerUsd();

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
  } : undefined;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href={`/doktor/vaka/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5B2]">
        <ArrowLeft size={16} /> Vaka detayı
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Luggage size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Sağlık Turizmi Paketi</h1>
          <p className="text-sm text-slate-500">{decryptField(c.patientName)} · {c.branch} tedavisi için uçtan uca paket oluşturun.</p>
        </div>
      </div>

      <div className="mt-7">
        <PackageBuilder caseId={c.id} patientName={decryptField(c.patientName)} branch={c.branch} country={c.country} initial={initial} treatments={treatments} rate={fx.rate} fxSource={fx.source} fxAt={fx.at} />
      </div>
    </div>
  );
}
