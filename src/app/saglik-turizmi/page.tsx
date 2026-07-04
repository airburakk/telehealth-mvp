import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getTryPerUsd } from "@/lib/fxrate";
import { SaglikTurizmiPlanner } from "./SaglikTurizmiPlanner";

export const dynamic = "force-dynamic";

// Sağlık Turizmi — hasta-yüzü planlama (Faz 1): tercih toplama + ENDİKATİF paket önizlemesi.
// Bağlayıcı fiyat/rezervasyon YOK — klinik-önce ilkesi (doktor onayı sonrası mevcut teklif/escrow zinciri).
// Hukuki zemin: wiki/kavramlar/saglik-turizmi-yetki-belgesi-mevzuat.md · tasarım: output/saglik-turizmi-hasta-akisi-tasarim.md
export default async function SaglikTurizmiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/saglik-turizmi"); // proxy login+onam kapılar; savunma-derinliği
  const fx = await getTryPerUsd(); // canlı TCMB kuru — önizlemede ₺ tedavi kalemi yok ama motor imzası ister
  return <SaglikTurizmiPlanner rate={fx.rate} />;
}
