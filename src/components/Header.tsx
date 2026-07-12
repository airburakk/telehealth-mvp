"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";
import { PortamedLogo } from "@/components/PortamedLogo";
import { useT } from "@/components/useT";
import { langDir } from "@/lib/constants";
import { navItemsFor } from "@/lib/nav";
import { LogOut, LogIn, ShieldOff } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
};

export function Header({ user, lang = "Türkçe", journey = null }: { user: { name: string; role: string } | null; lang?: string; journey?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  // Nav öğeleri rol + hasta yolculuğuna göre (lib/nav.ts — SO hastasında Paylaşımlarım gizli,
  // Vakalarım SO listesine işaret eder).
  const items = navItemsFor(user?.role, journey);
  // Çevrilecek metinler: görünür nav etiketleri + rol + Çıkış/Giriş.
  // lang="Türkçe" → useT no-op (kimlik). Partner gibi dil-tercihli kullanıcıda /api/i18n cache'i.
  const texts = useMemo(
    () => ["Çıkış", "Giriş yap", "Tüm cihazlardan çıkış", "Tüm cihazlardaki oturumlarınız kapatılacak. Devam edilsin mi?", "İşlem başarısız — oturumlar kapatılamadı. Lütfen tekrar deneyin.", ...items.map((i) => i.label), ...(user ? [ROLE_LABELS[user.role] ?? user.role] : [])],
    [items, user]
  );
  const { t } = useT(lang, texts);
  const dir = langDir(lang);

  // Ana sayfa PortaMed landing'i kendi nav/footer'ını taşır — global krom gizlenir
  if (pathname === "/") return null;

  const activeHref = items
    .filter((n) => pathname === n.href || pathname.startsWith(n.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/giris");
    router.refresh();
  }

  // JWT iptali: sessionVersion artar → bu hesabın TÜM cihazlardaki token'ları geçersizleşir.
  // Güvenlik eylemi sessizce başarısız olmasın: yanıt kontrol edilir, hatada yönlendirme YAPILMAZ.
  async function logoutAll() {
    if (!window.confirm(t("Tüm cihazlardaki oturumlarınız kapatılacak. Devam edilsin mi?"))) return;
    const res = await fetch("/api/auth/logout-all", { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      window.alert(t("İşlem başarısız — oturumlar kapatılamadı. Lütfen tekrar deneyin."));
      return;
    }
    router.push("/giris");
    router.refresh();
  }

  return (
    <header dir={dir} className="sticky top-0 z-30 border-b border-white/10 bg-[#0D0E10]/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between gap-4">
        {/* Marka altyazısı ("Sağlık Turizmi & Teletıp") kullanıcı isteğiyle kaldırıldı (2026-07-12) — yalnız logo */}
        <Link href="/" className="flex items-end">
          <PortamedLogo size={23} ink="#FFFFFF" />
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
                    active ? "bg-[#28C8D8] text-[#0D0E10]" : "text-white/70 hover:bg-white/10 hover:text-[#28C8D8]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{t(label)}</span>
                </Link>
              );
            })}
          </nav>

          {user ? (
            <div className="ml-1 flex items-center gap-2 border-l border-white/10 ps-2">
              <NotificationBell lang={lang} patientLangFallback={user.role === "PATIENT"} />
              <div className="hidden text-end sm:block">
                <div className="text-sm font-medium leading-tight text-white/90">{user.name}</div>
                <div className="text-[11px] leading-tight text-white/45">{t(ROLE_LABELS[user.role] ?? user.role)}</div>
              </div>
              <button onClick={logoutAll} title={t("Tüm cihazlardan çıkış")} className="grid h-9 w-9 place-items-center rounded-lg text-white/35 hover:bg-white/10 hover:text-red-400">
                <ShieldOff size={16} />
              </button>
              <button onClick={logout} title={t("Çıkış")} className="grid h-9 w-9 place-items-center rounded-lg text-white/55 hover:bg-white/10 hover:text-red-400">
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link href="/giris" className="ms-1 inline-flex items-center gap-1.5 rounded-lg bg-[#28C8D8] px-3.5 py-2 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
              <LogIn size={16} /> {t("Giriş yap")}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
