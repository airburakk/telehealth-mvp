import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  ArrowRight, BarChart2, CalendarDays, LayoutDashboard, Megaphone,
  FolderHeart, Share2, UserRound, Users, HeartPulse, Scale, Globe,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Yönetim dizini (v6.71) — header'daki tek "Yönetim" öğesi buraya gelir; paneller kartlardan
// dağılır (kullanıcı kararı: bant şişmesin, yeni admin aracı buraya kart olarak eklenir).
// /master BİLİNÇLİ listelenmez (env-dormant üç katmanlı kapı — keşfedilebilirlik artırılmaz).
export const metadata = { title: "Yönetim" };

// v6.73 bant sadeleştirmesi: ADMIN üst bandından çıkan denetim kısayolları buraya indi
// (kullanıcı kararı — bant büyümez, dizin büyür). Rotaların erişim kuralları DEĞİŞMEDİ;
// bunlar yalnız kısayoldur (admin, hasta/rol yüzeylerini bu görünümlerden denetler).
const OVERSIGHT = [
  { href: "/vakalarim", label: "Bakım Yolculuğum", icon: FolderHeart, note: "hasta yüzü" },
  { href: "/paylasimlarim", label: "Paylaşımlarım", icon: Share2, note: "hasta yüzü" },
  { href: "/triyaj", label: "Triyaj", icon: UserRound, note: "hasta yüzü" },
  { href: "/hekimler", label: "Doktorlar", icon: Users, note: "kamu dizini" },
  { href: "/doktor/takip", label: "Post-Op", icon: HeartPulse, note: "personel" },
  { href: "/etik-kurul", label: "Etik Kurul", icon: Scale, note: "kurul" },
  { href: "/partner", label: "Partner", icon: Globe, note: "iş ortağı" },
];

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

      <h2 className="aura-mono mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-ink-3)]">
        Denetim görünümleri
      </h2>
      <p className="mt-1 text-xs text-[var(--c-ink-2)]">
        Hasta ve rol yüzeylerini denetlemek için kısayollar — üst banttan buraya taşındı.
      </p>
      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {OVERSIGHT.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              className="flex items-center gap-2.5 rounded-xl border border-[var(--c-hairline)] px-3 py-2 text-sm text-[var(--c-ink-2)] transition hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]"
            >
              <o.icon size={15} className="shrink-0 text-[var(--c-ink-3)]" />
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              <span className="aura-mono shrink-0 text-[10px] text-[var(--c-ink-3)]">{o.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
