"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { oauthBannerMessage } from "@/lib/oauth-banner";

// Kapı içi e-posta giriş formu (2026-08-06) — /giris/e-posta ve /kurumsal-giris/e-posta alt
// rotaları KALDIRILDI (kullanıcı kararı: "kapı yeterli; e-posta ile devam edince form hemen
// altında açılsın"). Bu bileşen eski LoginForm'un davranış sözleşmesini Aura kapı diline taşır:
//  · POST /api/auth/login → başarıda TAM SAYFA yönlendirme next > data.home > "/" (çerez
//    proxy'e taze taşınır; router.push önbellek/zamanlama sorunu — LoginForm'dan miras davranış).
//  · 403 EMAIL_UNVERIFIED → "doğrulama e-postasını yeniden gönder" sunulur.
//  · Demo hızlı girişi: e-posta alanına DEMO_UNLOCK_EMAIL yazılınca rol kısayolları görünür
//    (2026-07-31 görünürlük kararı — güvenlik sınırı DEĞİL, eski LoginForm notu aynen geçerli).
//  · OAuth (?oauth&provider) + e-posta doğrulama (?verify) banner'ları artık burada çizilir —
//    OAuth rotaları ve verify-email dönüşleri kapılara işaret eder.
// ⚠️ Dil: form iskeleti 9 dilde (copy.ts signin.*); sistem banner'ları ve API hata metinleri
// platform genelinde TÜRKÇE (bilinçli sınır — copy.ts signin bloğu notu).
const DEMO_UNLOCK_EMAIL = "airburakk@gmail.com"; // repo public; adres commit author'da zaten görünür

export interface GateQuickAccount {
  email: string;
  label: string;
}

export function GateEmailForm({
  texts,
  quick = [],
}: {
  texts: { emailLabel: string; passwordLabel: string; submit: string };
  quick?: GateQuickAccount[];
}) {
  const sp = useSearchParams();
  const next = sp.get("next");
  const oauthMsg = oauthBannerMessage(sp.get("oauth"), sp.get("provider"), "giriş");
  const verifyMsg =
    sp.get("verify") === "ok" ? "E-posta adresiniz doğrulandı — şimdi giriş yapabilirsiniz."
    : sp.get("verify") === "already" ? "E-posta adresiniz zaten doğrulanmış. Giriş yapabilirsiniz."
    : sp.get("verify") === "invalid" ? "Doğrulama bağlantısı geçersiz veya süresi dolmuş. E-postanızı yazıp bağlantıyı yeniden isteyebilirsiniz."
    : "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  // Form toggle ile açıldığında ilk alan odaklanır (klavye kullanıcısı akışı bozulmasın —
  // e2e erişilebilirlik turu "E-posta ile devam et" → Enter → yazmaya başla bekler).
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => emailRef.current?.focus(), []);

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

  const inputCls =
    "w-full rounded-[13px] border border-[var(--aura-hairline)] bg-[var(--aura-surface)] px-4 py-3 text-[15px] text-[var(--aura-ink)] outline-none placeholder:text-[var(--aura-micro)] focus:border-[var(--aura-accent)]/60";

  return (
    <div className="mt-3 space-y-3 text-left">
      {oauthMsg && (
        <div className="rounded-[13px] bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-300 ring-1 ring-amber-400/25">{oauthMsg}</div>
      )}
      {verifyMsg && (
        <div className={`rounded-[13px] px-4 py-2.5 text-[13px] ring-1 ${sp.get("verify") === "invalid" ? "bg-amber-500/10 text-amber-300 ring-amber-400/25" : "bg-emerald-500/10 text-emerald-300 ring-emerald-400/25"}`}>
          {verifyMsg}
        </div>
      )}

      <form onSubmit={(e) => { e.preventDefault(); login(); }} className="space-y-3">
        <label className="block">
          <span className="aura-mono mb-1.5 block text-[11px] uppercase tracking-widest text-[var(--aura-micro)]">{texts.emailLabel}</span>
          <input ref={emailRef} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="aura-mono mb-1.5 block text-[11px] uppercase tracking-widest text-[var(--aura-micro)]">{texts.passwordLabel}</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </label>
        {error && (
          <div className="rounded-[13px] bg-red-500/10 px-4 py-2.5 text-[13px] text-red-300 ring-1 ring-red-400/25">{error}</div>
        )}
        {needsVerify && (
          <div className="rounded-[13px] bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-300 ring-1 ring-amber-400/25">
            {resendMsg ? (
              resendMsg
            ) : (
              <button type="button" onClick={resendVerification} className="font-semibold text-[var(--aura-accent)] underline-offset-2 hover:underline">
                Doğrulama e-postasını yeniden gönder
              </button>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-[13px] bg-[var(--aura-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--aura-bg,#0D0E10)] transition-opacity duration-200 hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "…" : texts.submit}
        </button>
      </form>

      {quick.length > 0 && email.trim().toLowerCase() === DEMO_UNLOCK_EMAIL && (
        <div className="space-y-2">
          <div className={`grid gap-2 ${quick.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {quick.map((q) => (
              <button
                key={q.email}
                onClick={() => login(q.email, "1234")}
                disabled={loading}
                className="rounded-[13px] border border-[var(--aura-hairline)] bg-[var(--aura-surface)] px-3 py-2 text-[13px] font-medium text-[var(--aura-ink)] transition-colors duration-200 hover:border-[var(--aura-accent)]/50 disabled:opacity-60"
              >
                {q.label}
              </button>
            ))}
          </div>
          <p className="text-center text-[11px] text-[var(--aura-micro)]">
            Demo parolası: <span className="aura-mono">1234</span>
          </p>
        </div>
      )}
    </div>
  );
}
