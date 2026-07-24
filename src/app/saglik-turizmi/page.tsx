import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SaglikTurizmiPlanner } from "./SaglikTurizmiPlanner";

export const dynamic = "force-dynamic";

// Sağlık Turizmi — hasta-yüzü planlama (Faz 1): tercih toplama (fiyat önizlemesi 2026-07-12'de kalktı;
// kur bağımlılığı da onunla gitti). Bağlayıcı fiyat/rezervasyon YOK — klinik-önce ilkesi
// (doktor onayı sonrası teklif zinciri; kulvar ödemesiz — escrow katmanı 2026-07-23'te kaldırıldı).
// Hukuki zemin: wiki/kavramlar/saglik-turizmi-yetki-belgesi-mevzuat.md · tasarım: output/saglik-turizmi-hasta-akisi-tasarim.md
export default async function SaglikTurizmiPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/saglik-turizmi"); // proxy login+onam kapılar; savunma-derinliği
  return <SaglikTurizmiPlanner />;
}
