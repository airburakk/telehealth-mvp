import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAccessLog } from "@/lib/audit";
import { AccessLogView } from "./AccessLogView";

export const dynamic = "force-dynamic";

// Erişim Kaydım — hasta-yüzü şeffaflık sayfası: "verime kim, ne zaman, neye erişti".
// Değiştirilemez (append-only hash-zinciri) + (test) RFC 3161 zaman damgalı denetim kaydı (lib/audit).
// Sunum + çeviri (i18n 8+ dil + RTL) AccessLogView (client) içinde; burada yalnız auth + veri çekme.
export default async function AccessLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/erisim-kaydi");
  const entries = await getAccessLog(user.id, user.id);
  return <AccessLogView entries={entries} />;
}
