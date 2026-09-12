import { AuraLegalPage, auraLegalGenerateMetadata, type LegalSearchParams } from "@/components/aura/aura-legal/legal-page";

// /kosullar — Kullanım Koşulları ve Hizmet Sözleşmesi (hasta) (kod Paket A, v6.268 · 2026-09-13; kaynak vault belge A02,
// Sürüm 1.0 NİHAİ; Ek 1 cayma dormant — gerçek tahsilat başlayınca sürüm artar). Kod Paket B'de kayıtta AURA_TERMS kapsamı.
export const generateMetadata = auraLegalGenerateMetadata("kosullar");
export default function Page({ searchParams }: { searchParams: LegalSearchParams }) {
  return <AuraLegalPage slug="kosullar" searchParams={searchParams} />;
}
