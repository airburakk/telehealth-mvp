"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, MailCheck, KeyRound, ArrowLeft } from "lucide-react";

// "Şifremi unuttum" akışının iki formu (v6.194).
//
// ⚠️ MARKA-NÖTR (bilinçli): bu iki yüzey hem AURA hem Doctorium deploy'unda aynı rotadan
// servis edilir. Logo/wordmark KOYULMAZ — giriş ekranlarının logosuz olması zaten yerleşik
// karar (v6.138) ve marka bloğu koymak Doctorium'da AURA izi bırakırdı. Görsel dil kapı
// formuyla (gate-email-form) birebir: aynı token'lar, aynı input sınıfı.
//
// Rotalar chrome-routes.ts CHROME_FREE_ROUTES'ta → Header/SiteFooter girmez, panel tam ekrandır.

const INPUT =
  "w-full rounded-[13px] border border-[var(--aura-hairline)] bg-[var(--aura-surface)] px-4 py-3 text-[15px] text-[var(--aura-ink)] outline-none placeholder:text-[var(--aura-micro)] focus:border-[var(--aura-accent)]/60";
const BTN =
  "inline-flex w-full items-center justify-center gap-2 rounded-[13px] bg-[var(--aura-accent)] px-4 py-3 text-[15px] font-semibold text-[var(--aura-bg)] transition-opacity hover:opacity-90 disabled:opacity-60";
const LABEL = "aura-mono mb-1.5 block text-[11px] uppercase tracking-widest text-[var(--aura-micro)]";

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="aura-page flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px] rounded-[22px] border border-[var(--aura-hairline)] bg-[var(--aura-panel)] px-7 py-9 md:px-9">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--aura-ink)]">{title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--aura-grey)]">{sub}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-7 text-center text-[13px]">
          <Link href="/giris" className="inline-flex items-center gap-1.5 text-[var(--aura-grey)] hover:text-[var(--aura-ink)]">
            <ArrowLeft size={14} aria-hidden /> Giriş ekranına dön
          </Link>
        </p>
      </div>
    </div>
  );
}

const NOTICE = {
  ok: "rounded-[13px] bg-emerald-500/10 px-4 py-3 text-[13px] leading-relaxed text-emerald-300 ring-1 ring-emerald-400/25",
  warn: "rounded-[13px] bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-300 ring-1 ring-amber-400/25",
  err: "rounded-[13px] bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-300 ring-1 ring-red-400/25",
};

/** Adım 1 — sıfırlama bağlantısı iste. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "sent" | "dormant">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("loading");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      // 503 + channelDormant: e-posta kanalı kapalı. Bu SİSTEM durumudur, hesaba özgü değil —
      // söylemek hesap keşfine yaramaz, susmak ise kullanıcıyı sessiz bir çıkmaza sokardı.
      if (data?.channelDormant) { setState("dormant"); return; }
      if (res.status === 429) { setError("Çok fazla deneme. Lütfen bir süre sonra tekrar deneyin."); setState("idle"); return; }
      // Diğer her durumda AYNI ekran: hesap var mı yok mu bilgisi verilmez.
      setState("sent");
    } catch {
      setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
      setState("idle");
    }
  }

  if (state === "dormant") {
    return (
      <Panel title="Parolamı unuttum" sub="Sıfırlama bağlantısı e-posta ile gönderilir.">
        <div className={NOTICE.warn}>
          <strong className="font-semibold">E-posta kanalı henüz etkin değil.</strong> Bu yüzden şu an
          size sıfırlama bağlantısı gönderemiyoruz. Hesabınıza erişemiyorsanız lütfen yöneticinizle
          iletişime geçin — kanal açıldığında bu sayfa olağan şekilde çalışacak.
        </div>
      </Panel>
    );
  }

  if (state === "sent") {
    return (
      <Panel title="Bağlantı gönderildi" sub="Gelen kutunuzu kontrol edin.">
        <div className={NOTICE.ok}>
          <MailCheck size={15} className="mb-1 inline" aria-hidden />{" "}
          <strong className="font-semibold">Bu adres kayıtlıysa</strong> parola sıfırlama bağlantısı
          gönderildi. Bağlantı <strong>1 saat</strong> geçerlidir ve yalnız bir kez kullanılabilir.
          <br />
          <span className="mt-2 block text-[var(--aura-grey)]">
            E-posta gelmediyse istenmeyen (spam) klasörünü kontrol edin.
          </span>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Parolamı unuttum"
      sub="Hesabınızın e-posta adresini girin; parolanızı yeniden belirlemeniz için bir bağlantı gönderelim."
    >
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={LABEL}>E-posta</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ad@ornek.com"
            className={INPUT}
          />
        </label>
        {error && <div className={NOTICE.err}>{error}</div>}
        <button type="submit" disabled={state === "loading"} className={BTN}>
          {state === "loading" ? <Loader2 size={16} className="animate-spin" /> : <MailCheck size={16} />}
          Sıfırlama bağlantısı gönder
        </button>
      </form>
    </Panel>
  );
}

/** Adım 2 — e-postadaki bağlantıdan gelen yeni parola formu. uid/token SUNUCUDAN prop olarak
 *  gelir (useSearchParams + Suspense tuzağına girilmez — bkz. [[nextjs-layout-usesearchparams-suspense]]). */
export function ResetPasswordForm({ uid, token }: { uid: string; token: string }) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  const linkMissing = !uid || !token;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) { setError("Parolalar eşleşmiyor."); return; }
    setState("loading");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || "Parola belirlenemedi."); setState("idle"); return; }
      setState("done");
    } catch {
      setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
      setState("idle");
    }
  }

  if (linkMissing) {
    return (
      <Panel title="Bağlantı geçersiz" sub="Parola sıfırlama bağlantısı eksik ya da bozuk.">
        <div className={NOTICE.warn}>
          Bağlantı eksik görünüyor. E-postadaki bağlantıyı tam olarak kopyaladığınızdan emin olun ya da{" "}
          <Link href="/sifremi-unuttum" className="underline">yeniden sıfırlama isteyin</Link>.
        </div>
      </Panel>
    );
  }

  if (state === "done") {
    return (
      <Panel title="Parolanız güncellendi" sub="Yeni parolanızla giriş yapabilirsiniz.">
        <div className={NOTICE.ok}>
          Parolanız değiştirildi ve <strong>açık olan tüm oturumlar kapatıldı</strong> — bu, hesabınıza
          başka bir cihazdan erişilmişse o erişimi de sonlandırır.
        </div>
        <div className="mt-5">
          <Link href="/giris" className={BTN}>Giriş yap</Link>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Yeni parola belirleyin" sub="Bağlantı yalnız bir kez kullanılabilir.">
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className={LABEL}>Yeni parola</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="en az 8 karakter"
            className={INPUT}
          />
        </label>
        <label className="block">
          <span className={LABEL}>Yeni parola (tekrar)</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="••••••••"
            className={INPUT}
          />
        </label>
        {error && <div className={NOTICE.err}>{error}</div>}
        <button type="submit" disabled={state === "loading"} className={BTN}>
          {state === "loading" ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
          Parolamı belirle
        </button>
      </form>
    </Panel>
  );
}
