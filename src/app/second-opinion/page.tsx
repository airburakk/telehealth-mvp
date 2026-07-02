import { getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/session";
import { SecondOpinionContent } from "./SecondOpinionContent";

export const metadata = { title: "Second Opinion · İkinci Görüş — AURA" };
export const dynamic = "force-dynamic"; // kullanıcı rolüne göre CTA (getCurrentUser çerez okur)

export default async function SecondOpinionPage() {
  const user = await getCurrentUser();
  // Başvuru akışı hasta-only (+ADMIN). Anonim ziyaretçi de başvurabilir (giriş sonrası) → CTA göster.
  // Klinik personel (doktor/koordinatör/etik/partner) başvurmaz → CTA yerine kendi paneline yönlendir.
  const canApply = !user || user.role === "PATIENT" || user.role === "ADMIN";
  const staffHref = !canApply && user ? roleHome(user.role) : null;
  return <SecondOpinionContent canApply={canApply} staffHref={staffHref} />;
}
