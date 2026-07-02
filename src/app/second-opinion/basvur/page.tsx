import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { roleHome } from "@/lib/session";
import { SoApplyForm } from "./SoApplyForm";

export const dynamic = "force-dynamic";

// Second Opinion Ön Değerlendirme (§12.1) — başvurunun ilk adımı. Mevcut genel /triyaj'dan AYRI.
// İçerik (başlık + süre metni + form) çok dilli client bileşeninde (SoApplyForm + useT).
export default async function SecondOpinionApplyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/second-opinion/basvur");
  // Başvuru akışı hasta-only (+ADMIN): doktor/koordinatör vb. görüş VERİR, başvurmaz. Sessizce "/"'a
  // atmak yerine rolün ana sayfasına yönlendir (ör. doktor → /doktor) — anlamlı iniş (UX düzeltmesi).
  if (!["PATIENT", "ADMIN"].includes(user.role)) redirect(roleHome(user.role));
  return <SoApplyForm />;
}
