import { LegalPage, legalMetadata } from "@/components/aura/doctorium-legal/legal-page";

// /doctorium/aydinlatma — KVKK Aydınlatma Metni (v6.210 · 2026-09-03; kaynak vault belge 01, 👤 nihai).
// 1b: bu metin DOCTORIUM_KVKK onam kapsamının kanonik metnidir (gösterilen = hash'lenen).
export const metadata = legalMetadata("aydinlatma");
export default function Page() {
  return <LegalPage slug="aydinlatma" />;
}
