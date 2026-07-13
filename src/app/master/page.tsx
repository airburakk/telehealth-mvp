// MASTER paneli — tüm kullanıcıları listeler; master herhangi birine bürünebilir (impersonation).
// Kapı: isMaster (env MASTER_ACCOUNT_ENABLED + e-posta allowlist + bürünme oturumunda değil). Aksi
// halde notFound() → özelliğin varlığı sızdırılmaz. Bürünme sonrası kimlik hedef kullanıcıya döner.
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isMaster } from "@/lib/master";
import { db } from "@/lib/db";
import { MasterPanel } from "./MasterPanel";

export const metadata = { title: "Master", robots: { index: false, follow: false } };

export default async function MasterPage() {
  const user = await getCurrentUser();
  if (!isMaster(user)) notFound();

  // Kullanıcı hesap meta'sı (User.name = hesap adı, PHI değil; Case.patientName şifreli ve burada YOK).
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  return (
    <MasterPanel
      masterId={user!.id}
      masterEmail={user!.email}
      users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))}
    />
  );
}
