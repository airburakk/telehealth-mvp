"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { AuraButton } from "@/components/ui/AuraButton";

// Şifre paneli (v6.184) — İKİ MOD, tek bileşen:
//   · hasPassword=true  → "değiştir": mevcut parola sorulur.
//   · hasPassword=false → "belirle": hesap Google/Apple ile açılmış, kullanıcının bildiği bir
//     parola yok (gölge hash) → mevcut parola SORULMAZ. Sağlayıcı girişi çalışmaya devam eder.
//
// Uç nokta ayrımı sunucuda da yapar (User.passwordSetAt) — buradaki mod yalnız DOĞRU FORMU çizmek
// içindir, yetki kapısı değildir.

const MIN = 8;

export function PasswordPanel({ hasPassword, provider }: { hasPassword: boolean; provider: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mismatch = again.length > 0 && next !== again;
  const ready = next.length >= MIN && next === again && (!hasPassword || current.length > 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current: hasPassword ? current : undefined, next }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d?.error ?? "İşlem başarısız. Lütfen tekrar deneyin.");
        return;
      }
      setDone(true);
      setCurrent("");
      setNext("");
      setAgain("");
    } catch {
      setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-sm text-[var(--c-ink)] " +
    "placeholder:text-[var(--c-ink-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]";
  const label = "mb-1.5 block text-[13px] text-[var(--c-ink-2)]";

  return (
    <AuraPanel title="Şifre" className="mt-5">
      {!hasPassword && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
          <p className="text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">
            <strong className="font-semibold text-[var(--c-ink)]">
              {provider} ile giriş yapıyorsunuz.
            </strong>{" "}
            Bu üyelikte bir parola tanımlı değil. Parola belirlerseniz {provider}&rsquo;a ek olarak
            e-posta ve parolanızla da giriş yapabilirsiniz; mevcut girişiniz çalışmaya devam eder.
          </p>
        </div>
      )}

      {done ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/8 px-4 py-3.5">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[var(--c-accent)]" />
          <p className="text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">
            {hasPassword ? "Parolanız değiştirildi." : "Parolanız belirlendi."} Diğer cihazlardaki
            oturumlarınız kapatıldı; bu cihazda oturumunuz açık kaldı.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="max-w-md">
          {hasPassword && (
            <div className="mb-4">
              <label className={label} htmlFor="pw-current">Mevcut şifreniz</label>
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                className={field}
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>
          )}
          <div className="mb-4">
            <label className={label} htmlFor="pw-next">Yeni şifreniz</label>
            <input
              id="pw-next"
              type="password"
              autoComplete="new-password"
              placeholder={`En az ${MIN} karakter`}
              className={field}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div className="mb-4">
            <label className={label} htmlFor="pw-again">Yeni şifreniz (tekrar)</label>
            <input
              id="pw-again"
              type="password"
              autoComplete="new-password"
              className={field}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              aria-invalid={mismatch}
            />
            {mismatch && (
              <p className="mt-1.5 text-[12.5px] text-[var(--c-danger)]">İki parola aynı değil.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="mb-4 text-[13px] text-[var(--c-danger)]">{error}</p>
          )}

          <AuraButton type="submit" disabled={!ready || busy}>
            <KeyRound size={16} />
            {busy ? "Kaydediliyor…" : hasPassword ? "Şifreyi değiştir" : "Parola belirle"}
          </AuraButton>

          <p className="mt-3.5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--c-ink-3)]">
            <span className="text-[var(--c-ink-2)]">Güvenlik:</span> Parolanız değiştiğinde tüm
            cihazlardaki oturumlarınız kapanır; bu cihazda oturumunuz kendiliğinden yenilenir,
            yeniden giriş yapmanız gerekmez. E-posta adresinize bilgilendirme gönderilir.
          </p>
        </form>
      )}
    </AuraPanel>
  );
}
