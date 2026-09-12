import { AuraLegalPage, auraLegalGenerateMetadata, type LegalSearchParams } from "@/components/aura/aura-legal/legal-page";

// /cerez — Çerez ve Yerel Depolama Politikası (kod Paket A, v6.268 · 2026-09-13; kaynak vault belge A05, Sürüm 1.0 NİHAİ).
// Gerçek çerez seti: `session` (7 gün, HttpOnly) + `theme`; localStorage air_lang · air_so_lang · air_preconsult_* · air_share_*.
export const generateMetadata = auraLegalGenerateMetadata("cerez");
export default function Page({ searchParams }: { searchParams: LegalSearchParams }) {
  return <AuraLegalPage slug="cerez" searchParams={searchParams} />;
}
