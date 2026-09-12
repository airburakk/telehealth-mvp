import { AuraLegalPage, auraLegalGenerateMetadata, type LegalSearchParams } from "@/components/aura/aura-legal/legal-page";

// /tele-saglik — Tele-sağlık Hizmeti Bilgilendirmesi (kod Paket A, v6.268 · 2026-09-13; kaynak vault belge A03, Sürüm 1.0
// NİHAİ). ⚠️ YAYIN ŞARTI (Kılavuz madde 2): klinik hizmet sağlayıcı kimliği + USHAŞ yetki belgesi alanları dolmadan
// yayımlanmaz → lib/aura-legal/routes `published:false` → fabrika 404 + noindex; footer/sitemap/sentetik kontrol dışı.
// Açmak: bayrak true + `_yayin-kesiti.py` ROUTE haritasına "/tele-saglik" (Belge A03 atıfları bağlansın) + sentetik kontrol satırı.
export const generateMetadata = auraLegalGenerateMetadata("tele-saglik");
export default function Page({ searchParams }: { searchParams: LegalSearchParams }) {
  return <AuraLegalPage slug="tele-saglik" searchParams={searchParams} />;
}
