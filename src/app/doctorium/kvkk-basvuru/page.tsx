import { LegalPage, legalMetadata } from "@/components/aura/doctorium-legal/legal-page";

// /doctorium/kvkk-basvuru — İlgili Kişi Başvuru Usul ve Esasları (v6.210; kaynak vault belge 06 §A,
// 👤 nihai). Platform içi başvuru FORMU + başvuru kütüğü Paket 2'dedir (Kılavuz §5); o güne dek metin
// başvuruyu kayıtlı e-posta adresinden bilgi@doctorium.tr'ye yönlendirir (dürüst ifade, yer tutucu yok).
export const metadata = legalMetadata("kvkk-basvuru");
export default function Page() {
  return <LegalPage slug="kvkk-basvuru" />;
}
