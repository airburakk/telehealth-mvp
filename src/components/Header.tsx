"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { Activity, Stethoscope, UserRound, HeartPulse, Scale, LogOut, LogIn, Users, BadgeCheck, Share2, BarChart3, FolderHeart } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
};

const NAV = [
  { href: "/vakalarim", label: "Vakalarım", icon: FolderHeart, roles: ["PATIENT", "ADMIN"] },
  { href: "/triyaj", label: "Triyaj", icon: UserRound, roles: ["PATIENT", "ADMIN"] },
  { href: "/hekimler", label: "Hekimler", icon: Users, roles: ["PATIENT", "ADMIN"] },
  { href: "/paylasimlarim", label: "Paylaşımlarım", icon: Share2, roles: ["PATIENT", "ADMIN"] },
  { href: "/operasyon", label: "Operasyon", icon: BarChart3, roles: ["COORDINATOR", "ADMIN"] },
  { href: "/doktor", label: "Doktor", icon: Stethoscope, roles: ["DOCTOR", "COORDINATOR", "ADMIN"] },
  { href: "/doktor/takip", label: "Post-Op", icon: HeartPulse, roles: ["DOCTOR", "COORDINATOR", "ADMIN"] },
  { href: "/doktor/profil", label: "Profilim", icon: BadgeCheck, roles: ["DOCTOR", "ADMIN"] },
  { href: "/etik-kurul", label: "Etik Kurul", icon: Scale, roles: ["ETHICS", "ADMIN"] },
];

export function Header({ user }: { user: { name: string; role: string } | null }) {
  const pathname = usePathname();
  const router = useRouter();

  // Ana sayfa PortaMed landing'i kendi nav/footer'ını taşır — global krom gizlenir
  if (pathname === "/") return null;

  const items = NAV.filter((n) => user && n.roles.includes(user.role));
  const activeHref = items
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/giris");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0f2a4a] text-white shadow-sm">
            <Activity size={20} strokeWidth={2.4} />
          </span>
          <span className="leading-tight">
            <span className="block font-bold text-[#0f2a4a] tracking-tight">AIR Telehealth</span>
            <span className="block text-[11px] text-slate-500 -mt-0.5">Sağlık Turizmi Platformu</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <nav className="flex items-center gap-1">
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-[#0f2a4a] text-white" : "text-slate-600 hover:bg-slate-100 hover:text-[#0f2a4a]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          {user ? (
            <div className="ml-1 flex items-center gap-2 border-l border-slate-200 pl-2">
              <NotificationBell />
              <div className="hidden text-right sm:block">
                <div className="text-sm font-medium leading-tight text-slate-700">{user.name}</div>
                <div className="text-[11px] leading-tight text-slate-400">{ROLE_LABELS[user.role] ?? user.role}</div>
              </div>
              <button onClick={logout} title="Çıkış" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-red-600">
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link href="/giris" className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-[#0f2a4a] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#143a63]">
              <LogIn size={16} /> Giriş yap
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
