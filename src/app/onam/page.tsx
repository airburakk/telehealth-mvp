import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { hasCurrentConsent } from "@/lib/consent";
import { roleHome } from "@/lib/session";
import { ConsentGate } from "./ConsentGate";

export const dynamic = "force-dynamic";

// KVKK açık onam kapısı — giriş sonrası bir kez. Onam varsa hedefe geç (bir daha gösterme).
export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/onam");

  const { next } = await searchParams;
  const dest = next && next.startsWith("/") && next !== "/onam" ? next : roleHome(user.role);

  if (await hasCurrentConsent(user.id)) redirect(dest);

  return <ConsentGate isPatient={user.role === "PATIENT"} dest={dest} />;
}
