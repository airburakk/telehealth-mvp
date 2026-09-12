import { AuraLegalPage, auraLegalGenerateMetadata, type LegalSearchParams } from "@/components/aura/aura-legal/legal-page";

// /aydinlatma — KVKK Aydınlatma Metni ve Açık Rıza (hasta) (kod Paket A, v6.268 · 2026-09-13; kaynak vault belge A01,
// Sürüm 1.0 NİHAİ). Kod Paket B'de bu metin GENERAL_KVKK v4 onam kapsamının kanonik metni olur (gösterilen = hash'lenen).
// TR kanonik, `?lang=en` İngilizce ikinci kanonik.
export const generateMetadata = auraLegalGenerateMetadata("aydinlatma");
export default function Page({ searchParams }: { searchParams: LegalSearchParams }) {
  return <AuraLegalPage slug="aydinlatma" searchParams={searchParams} />;
}
