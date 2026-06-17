import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SoApplyForm } from "./SoApplyForm";

export const dynamic = "force-dynamic";

// Second Opinion Ön Değerlendirme (§12.1) — başvurunun ilk adımı. Mevcut genel /triyaj'dan AYRI.
// İçerik (başlık + süre metni + form) çok dilli client bileşeninde (SoApplyForm + useT).
export default async function SecondOpinionApplyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/second-opinion/basvur");
  if (!["PATIENT", "ADMIN"].includes(user.role)) redirect("/");
  return <SoApplyForm />;
}
