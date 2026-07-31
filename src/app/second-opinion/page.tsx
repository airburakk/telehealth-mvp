import { getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/session";
import { SecondOpinionContent } from "./SecondOpinionContent";

// Sekme başlığı Türkçeleştirildi (2026-07-31 kullanıcı kararı). Sayfa içeriği EN/TR seçiciyle
// değişir ama metadata statiktir → tek dil seçmek gerekiyor; ürünün kanonik dili Türkçe.
// ⚠️ Marka son ekini BURAYA YAZMA: kök layout `template: "%s · AURA"` uyguluyor (layout.tsx:40) →
// "… — AURA" yazmak "AURA · AURA" tekrarına yol açar.
export const metadata = { title: "İkinci Görüş" };
export const dynamic = "force-dynamic"; // kullanıcı rolüne göre CTA (getCurrentUser çerez okur)

export default async function SecondOpinionPage() {
  const user = await getCurrentUser();
  // Başvuru akışı hasta-only (+ADMIN). Anonim ziyaretçi de başvurabilir (giriş sonrası) → CTA göster.
  // Klinik personel (doktor/koordinatör/etik/partner) başvurmaz → CTA yerine kendi paneline yönlendir.
  const canApply = !user || user.role === "PATIENT" || user.role === "ADMIN";
  const staffHref = !canApply && user ? roleHome(user.role) : null;
  return <SecondOpinionContent canApply={canApply} staffHref={staffHref} />;
}
