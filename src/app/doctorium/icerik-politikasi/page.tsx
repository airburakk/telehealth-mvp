import { LegalPage, legalMetadata } from "@/components/aura/doctorium-legal/legal-page";

// /doctorium/icerik-politikasi — İçerik Kaynak ve Telif Politikası + bildir-kaldır kanalı
// (v6.210; kaynak vault belge 04 §A, 👤 nihai; iç uygulama kuralları §B yayımlanmaz).
export const metadata = legalMetadata("icerik-politikasi");
export default function Page() {
  return <LegalPage slug="icerik-politikasi" />;
}
