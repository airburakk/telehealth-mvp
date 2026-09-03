import { LegalPage, legalMetadata } from "@/components/aura/doctorium-legal/legal-page";

// /doctorium/cerez — Çerez Politikası (v6.210; kaynak vault belge 03, 👤 nihai). Rıza penceresi
// bilinçli YOK: yalnız zorunlu `session` + işlevsel `theme` çerezi (kod ölçümü 03.09.2026).
export const metadata = legalMetadata("cerez");
export default function Page() {
  return <LegalPage slug="cerez" />;
}
