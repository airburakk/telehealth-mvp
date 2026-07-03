import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleHome, type Role } from "@/lib/session";
import { BaslaCards } from "./BaslaCards";

export const dynamic = "force-dynamic";

// "Nasıl İlerlemek İstersiniz?" — hasta her girişte buraya düşer (roleHome PATIENT → /basla).
// Seçim User.patientJourney'e yazılır (nav bileşimini belirler) ve ilgili akışa yönlendirilir.
export default async function BaslaPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/basla"); // proxy zaten kapsar; savunma katmanı
  if (user.role !== "PATIENT" && user.role !== "ADMIN") redirect(roleHome(user.role as Role));

  const u = await db.user.findUnique({ where: { id: user.id }, select: { patientJourney: true } });

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <BaslaCards name={user.name} journey={u?.patientJourney ?? null} />
    </div>
  );
}
