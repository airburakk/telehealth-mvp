// MASTER paneli — sistemdeki tüm bürünülebilir kimlikleri listeler:
//  • User (giriş hesabı olan herkes: hasta, doktor, koordinatör, ...),
//  • Doctor profili (giriş hesabı OLMAYAN dummy/seed doktorlar → bürünürken gölge hesap açılır),
//  • PartnerDoctor profili (giriş hesabı olmayan partner doktorlar → aynı gölge-hesap mantığı).
// Kapı: isMaster (env MASTER_ACCOUNT_ENABLED + e-posta allowlist + bürünme oturumunda değil). Aksi
// halde notFound() → özelliğin varlığı sızdırılmaz. Bürünme sonrası kimlik hedef kimliğe döner.
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isMaster } from "@/lib/master";
import { db } from "@/lib/db";
import { MasterPanel, type Entry } from "./MasterPanel";

export const metadata = { title: "Master", robots: { index: false, follow: false } };

export default async function MasterPage() {
  const user = await getCurrentUser();
  if (!isMaster(user)) notFound();

  // Kullanıcı hesap meta'sı (User.name = hesap adı, PHI değil; Case.patientName şifreli ve burada YOK).
  const [users, doctors, partners] = await Promise.all([
    db.user.findMany({
      select: { id: true, email: true, name: true, role: true, doctorId: true, partnerId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    db.doctor.findMany({
      select: { id: true, name: true, title: true, branch: true, city: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    db.partnerDoctor.findMany({
      select: { id: true, name: true, title: true, country: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
  ]);

  // Bir profile bağlı User zaten varsa o profili "giriş hesabı yok" olarak TEKRAR listeleme
  // (bürünme yine o gerçek User'a gider; çift satır olmasın).
  const linkedDoctorIds = new Set(users.map((u) => u.doctorId).filter(Boolean) as string[]);
  const linkedPartnerIds = new Set(users.map((u) => u.partnerId).filter(Boolean) as string[]);

  const entries: Entry[] = [
    ...users.map((u) => ({
      key: `u:${u.id}`,
      target: { userId: u.id },
      name: u.name,
      subtitle: u.email,
      role: u.role,
      hasLogin: true,
      isSelf: u.id === user!.id,
      createdAt: u.createdAt.toISOString(),
    })),
    ...doctors
      .filter((d) => !linkedDoctorIds.has(d.id))
      .map((d) => ({
        key: `d:${d.id}`,
        target: { doctorId: d.id },
        name: `${d.title} ${d.name}`.trim(),
        subtitle: [d.branch, d.city].filter(Boolean).join(" · "),
        role: "DOCTOR",
        hasLogin: false,
        isSelf: false,
        createdAt: d.createdAt.toISOString(),
      })),
    ...partners
      .filter((p) => !linkedPartnerIds.has(p.id))
      .map((p) => ({
        key: `p:${p.id}`,
        target: { partnerId: p.id },
        name: `${p.title} ${p.name}`.trim(),
        subtitle: p.country ? `Partner · ${p.country}` : "Partner Doktor",
        role: "PARTNER",
        hasLogin: false,
        isSelf: false,
        createdAt: p.createdAt.toISOString(),
      })),
  ];

  return <MasterPanel entries={entries} masterEmail={user!.email} />;
}
