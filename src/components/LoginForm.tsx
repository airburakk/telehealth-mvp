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
  // E-posta doğrulama bağlantısından dönüş banner'ı (v5.6): /api/auth/verify-email ?verify= ile yönlendirir.
  const verifyMsg =
    sp.get("verify") === "ok" ? "E-posta adresiniz doğrulandı — şimdi giriş yapabilirsiniz."
    : sp.get("verify") === "already" ? "E-posta adresiniz zaten doğrulanmış. Giriş yapabilirsiniz."
    : sp.get("verify") === "invalid" ? "Doğrulama bağlantısı geçersiz veya süresi dolmuş. Girişte e-postanızı yazıp bağlantıyı yeniden isteyebilirsiniz."
    : "";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false); // 403 EMAIL_UNVERIFIED → yeniden-gönder sunulur
  const [resendMsg, setResendMsg] = useState("");

  async function login(em?: string, pw?: string) {
    const e = em ?? email;
    const p = pw ?? password;
    setError("");
    setNeedsVerify(false);
    setResendMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "EMAIL_UNVERIFIED") setNeedsVerify(true);
        throw new Error(data.error || "Giriş başarısız.");
      }
      // Tam sayfa yönlendirme: çerezin proxy'e taze taşınmasını ve auth durumunun
      // doğru yansımasını garantiler (router.push'taki önbellek/zamanlama sorununu önler).
      window.location.assign(next || data.home || "/");
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Giriş başarısız.");
      setLoading(false);
    }
  }

  async function resendVerification() {
    setResendMsg("");
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setResendMsg(data.message || "Doğrulama bağlantısı istendi — gelen kutunuzu kontrol edin.");
    } catch {
      setResendMsg("İstek gönderilemedi, lütfen tekrar deneyin.");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-white/10"><AuraMark size={26} /></span>
        <h1 className="mt-3 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]">{title}</h1>
        <p className="text-sm text-[var(--c-ink-2)]">{subtitle}</p>
      </div>

      <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
        {oauthMsg && <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300 ring-1 ring-amber-400/25">{oauthMsg}</div>}
        {verifyMsg && (
          <div className={`mb-3 rounded-lg px-3 py-2 text-sm ring-1 ${sp.get("verify") === "invalid" ? "bg-amber-500/10 text-amber-300 ring-amber-400/25" : "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25"}`}>
            {verifyMsg}
          </div>
        )}

        {social && (
          <>
            {social}
            <div className="my-4 flex items-center gap-3 text-xs text-[var(--c-ink-3)]">
              <span className="h-px flex-1 bg-[var(--c-ink)]/10" /> veya e-posta ile <span className="h-px flex-1 bg-[var(--c-ink)]/10" />
            </div>
          </>
        )}

        <form onSubmit={(e) => { e.preventDefault(); login(); }} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink-2)]">E-posta</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@air.test" className="w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink-2)]">Parola</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••" className="w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]" />
          </label>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}
          {needsVerify && (
            <div className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300 ring-1 ring-amber-400/25">
              {resendMsg ? (
                resendMsg
              ) : (
                <button type="button" onClick={resendVerification} className="font-semibold text-[var(--c-accent)] underline-offset-2 hover:underline">
                  Doğrulama e-postasını yeniden gönder
                </button>
              )}
            </div>
          )}
          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />} Giriş yap
          </button>
        </form>

        {quick.length > 0 && (
          <>
            <div className="my-4 flex items-center gap-3 text-xs text-[var(--c-ink-3)]">
              <span className="h-px flex-1 bg-[var(--c-ink)]/10" /> Hızlı demo girişi <span className="h-px flex-1 bg-[var(--c-ink)]/10" />
            </div>

            <div className={`grid gap-2 ${quick.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {quick.map((q) => {
                const Icon = q.icon;
                return (
                  <button key={q.email} onClick={() => login(q.email, "1234")} disabled={loading} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm font-medium text-[var(--c-ink)] hover:border-[var(--c-accent)]/40 hover:text-[var(--c-ink)] disabled:opacity-60">
                    <Icon size={15} /> {q.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-center text-[11px] text-[var(--c-ink-3)]">Demo parolası: <span className="font-mono">1234</span></p>
          </>
        )}
      </div>

      {footer}
    </div>
  );
}
