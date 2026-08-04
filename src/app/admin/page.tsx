import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ArrowRight, BarChart2, CalendarDays, LayoutDashboard, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

// Yönetim dizini (v6.71) — header'daki tek "Yönetim" öğesi buraya gelir; paneller kartlardan
// dağılır (kullanıcı kararı: bant şişmesin, yeni admin aracı buraya kart olarak eklenir).
// /master BİLİNÇLİ listelenmez (env-dormant üç katmanlı kapı — keşfedilebilirlik artırılmaz).
export const metadata = { title: "Yönetim" };

const PANELS = [
  {
    href: "/admin/kampanya",
    label: "Sponsorlu Kampanyalar",
    desc: "Doctorium akışındaki sponsorlu kartlar — oluştur, hedefle, durum yönet (ilaç-dışı).",
    icon: Megaphone,
    tone: "#f59e0b",
  },
  {
    href: "/admin/anket",
    label: "Anketler",
    desc: "Topluluk ve sponsorlu anketler — soru/şık kur, yayınla, toplu sonuçları izle.",
    icon: BarChart2,
    tone: "#38bdf8",
  },
  {
    href: "/admin/kongre",
    label: "Kongre Takvimi",
    desc: "Küratörlü kongre kayıtları — hekim takviminde görünen etkinlikleri yönet.",
    icon: CalendarDays,
    tone: "#34d399",
  },
];

export default async function AdminIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor");

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="aura-display flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <LayoutDashboard size={22} className="text-[var(--c-ink-2)]" /> Yönetim
      </h1>
      <p className="mt-1 text-sm text-[var(--c-ink-2)]">Platform küratör panelleri — yalnız yönetici hesabı.</p>

      <ul className="mt-6 grid gap-3">
        {PANELS.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-4 transition hover:border-[var(--c-ink-3)]"
            >
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--c-surface-2)]"
                style={{ boxShadow: `inset 3px 0 0 ${p.tone}` }}
              >
                <p.icon size={20} style={{ color: p.tone }} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--c-ink)]">{p.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--c-ink-2)]">{p.desc}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-[var(--c-ink-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--c-ink)]" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
