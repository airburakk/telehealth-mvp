import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PortamedLanding, type LandingDoctor } from "@/components/PortamedLanding";

export const dynamic = "force-dynamic";

// PortaMed landing (design_handoff_portamed_landing spesifikasyonu).
// Eski tasarım: design-backup/anasayfa-klasik-v2.6.tsx.bak + git tag design-klasik-v2.6
export default async function Home() {
  const user = await getCurrentUser();
  // "Meet the specialists" — gerçek hekimlerden 3'ü (yorum sayısı yüksek olan markalı branşlar önde)
  const docs = await db.doctor.findMany({
    where: { branch: { in: ["Saç Ekimi", "Diş Tedavisi", "Tüp Bebek (IVF)"] } },
    take: 3,
    orderBy: { name: "asc" },
  });
  const fallback = await db.doctor.findMany({ take: 3, orderBy: { name: "asc" } });
  const list = (docs.length >= 3 ? docs : fallback).slice(0, 3);
  const doctors: LandingDoctor[] = list.map((d) => ({ name: d.name, title: d.title, branch: d.branch, color: d.color }));

  return <PortamedLanding doctors={doctors} loggedIn={!!user} />;
}
