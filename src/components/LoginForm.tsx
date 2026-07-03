"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, LogIn, type LucideIcon } from "lucide-react";
import { AuraMark } from "@/components/PortamedLogo";

// Genel e-posta/şifre giriş formu — hasta (/giris) ve kurumsal (/kurumsal-giris) ekranları
// tarafından farklı başlık/demo/sosyal bloklarla kullanılır. `next` param davranışı korunur:
// başarılı girişte next > data.home > "/" önceliğiyle TAM SAYFA yönlendirme (çerez proxy'e taze taşınır).
export interface QuickAccount {
  email: string;
  label: string;
  icon: LucideIcon;
}

export function LoginForm({
  title = "AURA'ya giriş",
  subtitle = "Rolünüzle devam edin",
  quick = [],
  social,
  footer,
}: {
  title?: string;
  subtitle?: string;
  quick?: QuickAccount[];
  social?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const sp = useSearchParams();
  const next = sp.get("next");
  const oauthMsg =
    sp.get("oauth") === "unavailable" ? "Google ile giriş henüz yapılandırılmadı (yakında)."
    : sp.get("oauth") === "error" ? "Google ile giriş tamamlanamadı, lütfen tekrar deneyin."
    : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(em?: string, pw?: string) {
    const e = em ?? email;
    const p = pw ?? password;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Giriş başarısız.");
      // Tam sayfa yönlendirme: çerezin proxy'e taze taşınmasını ve auth durumunun
      // doğru yansımasını garantiler (router.push'taki önbellek/zamanlama sorununu önler).
      window.location.assign(next || data.home || "/");
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[#101010] shadow"><AuraMark size={26} /></span>
        <h1 className="mt-3 text-xl font-bold text-[#101010]">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {oauthMsg && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">{oauthMsg}</div>}

        {social && (
          <>
            {social}
            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> veya e-posta ile <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

        <form onSubmit={(e) => { e.preventDefault(); login(); }} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@air.test" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#14C3D0]" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Parola</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#14C3D0]" />
          </label>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Giriş yap
          </button>
        </form>

        {quick.length > 0 && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" /> Hızlı demo girişi <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className={`grid gap-2 ${quick.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {quick.map((q) => {
                const Icon = q.icon;
                return (
                  <button key={q.email} onClick={() => login(q.email, "1234")} disabled={loading} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-[#14C3D0]/40 hover:bg-slate-50 disabled:opacity-60">
                    <Icon size={15} /> {q.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[11px] text-slate-400">Demo parolası: <span className="font-mono">1234</span></p>
          </>
        )}
      </div>

      {footer}
    </div>
  );
}
