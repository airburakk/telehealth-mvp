import { LegalPage, legalMetadata } from "@/components/aura/doctorium-legal/legal-page";

// /doctorium/kosullar — Üyelik Sözleşmesi ve Kullanım Koşulları (v6.210; kaynak vault belge 02, 👤 nihai).
// 1b: kayıt akışında DOCTORIUM_TERMS onayı bu metni hash'ler.
export const metadata = legalMetadata("kosullar");
export default function Page() {
  return <LegalPage slug="kosullar" />;
}
