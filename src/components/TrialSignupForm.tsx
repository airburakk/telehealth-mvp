"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, MailCheck, Send, Stethoscope, GraduationCap } from "lucide-react";
import { AuraMark } from "@/components/AuraLogo";
import { SocialAuthButtons } from "@/components/social-auth";
import { CitySelect } from "@/components/CitySelect";
import { oauthBannerMessage } from "@/lib/oauth-banner";
import { isKnownUniversityEmail } from "@/lib/universities";

// DENEME doktor kaydı formu (üç katman Faz A3, kullanıcı kararı 2026-09-05) — PAROLASIZ.
// Dört alan: ad soyad · e-posta · branş · şehir (ad soyad şart: e-Devlet belge doğrulaması belgedeki
// adı Doctor.name ile karşılaştırır; boş/yer tutucu ad her denemeyi insan incelemesine düşürürdü).
// Gönderim → POST /api/auth/signup-trial → giriş bağlantısı e-postaya gider; Google/Apple ile giriş
// aynı hesabı açar (OAuth callback'leri /doktor/profil-tamamla kompakt moduna iner).
//
// h1 "Doktor Kaydı" ve Google CTA KORUNUR (scripts/synthetic-checks.mjs /doctorium/kayit beklentisi).
// DoctorSignupForm ile aynı görsel dil (aynı kabukta yaşar); üyelik anlatısı (§2b kanonik metin) formda
// değil sayfadaki "Üyelik nasıl işler?" panelinde — tek kaynak lib/doctorium-trial-copy.
export function TrialSignupForm({ googleEnabled, appleEnabled, branches }: { googleEnabled: boolean; appleEnabled: boolean; branches: string[] }) {
  const sp = useSearchParams();
  const oauthMsg = oauthBannerMessage(sp.get("oauth"), sp.get("provider"), "giriş");
  const linkInvalid = sp.get("link") === "invalid";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [dormant, setDormant] = useState(false);

  // Yumuşak ipucu (kapı DEĞİL — 👤 karar): üniversite uzantılı adres öğrenci yolunu hatırlatır.
  const looksStudent = email.includes("@") && isKnownUniversityEmail(email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, branch, city }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data.channelDormant) { setDormant(true); return; }
      if (res.status === 429) throw new Error("Çok fazla deneme yapıldı. Lütfen birkaç dakika sonra tekrar deneyin.");
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");
      if (data.home) { window.location.assign(data.home); return; } // dev kısayolu: oturum kuruldu
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-[var(--c-accent)]"><MailCheck size={28} /></span>
          <h1 className="mt-4 font-serif text-lg font-bold text-[var(--c-ink)]">Giriş bağlantısı gönderildi</h1>
          <p className="mt-2 text-sm text-[var(--c-ink-2)]">
            <span className="font-medium text-[var(--c-ink)]">{email}</span> adresine bir giriş bağlantısı gönderdik.
            Bağlantı 20 dakika geçerlidir ve yalnız bir kez kullanılabilir. Bu adresle kayıtlı bir hesap zaten
            varsa e-postada ne yapmanız gerektiği yazar.
          </p>
          <p className="mt-3 text-xs text-[var(--c-ink-3)]">E-posta gelmezse spam klasörünü kontrol edin; yeni bağlantıyı iki dakika sonra isteyebilirsiniz.</p>
          <Link href="/doctorium/giris" className="mt-5 inline-flex items-center justify-center rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">
            Doctorium girişine dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-[var(--c-hairline)]"><AuraMark size={26} tone="emerald" /></span>
        <h1 className="mt-3 flex items-center gap-1.5 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]"><Stethoscope size={20} className="text-[var(--c-accent)]" /> Doktor Kaydı</h1>
        <p className="text-sm text-[var(--c-ink-2)]">Doctorium&apos;unuzu oluşturun — parola yok, giriş bağlantısı e-postanıza gelir.</p>
      </div>

      <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
        {oauthMsg && <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-400/25">{oauthMsg}</div>}
        {linkInvalid && (
          <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-400/25">
            Bağlantı geçersiz ya da süresi dolmuş. Aşağıdan yeni bir giriş bağlantısı isteyin.
          </div>
        )}
        {dormant && (
          <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-400/25">
            E-posta kanalı şu anda kapalı; giriş bağlantısı gönderilemiyor.{" "}
            <Link href="/doctorium/kayit?klasik=1" className="font-semibold underline">Parola ile kayıt olun</Link>.
          </div>
        )}

        {/* Sosyal giriş — intent=doctor: yeni Google/Apple hesabı doktor (deneme) olarak açılır */}
        <SocialAuthButtons googleEnabled={googleEnabled} appleEnabled={appleEnabled} intent="doctor" />

        <div className="my-4 flex items-center gap-3 text-xs text-[var(--c-ink-3)]">
          <span className="h-px flex-1 bg-[var(--c-ink)]/10" /> veya e-posta ile <span className="h-px flex-1 bg-[var(--c-ink)]/10" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Labeled label="Ad soyad">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayşe Yılmaz" className={INPUT} required minLength={2} autoComplete="name" />
          </Labeled>
          <Labeled label="E-posta">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ayse@klinik.com" className={INPUT} required autoComplete="email" />
            {looksStudent && (
              <span className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
                <GraduationCap size={13} className="mt-px shrink-0" />
                <span>Bu bir üniversite e-postası gibi görünüyor. Tıp öğrencisiyseniz{" "}
                  <Link href="/doctorium/ogrenci" className="font-semibold text-[var(--c-accent)] hover:underline">Öğrenci kaydını</Link> kullanın.</span>
              </span>
            )}
          </Labeled>
          <Labeled label="Branş">
            <select value={branch} onChange={(e) => setBranch(e.target.value)} className={INPUT} required>
              <option value="" disabled>Seçin…</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Labeled>
          <Labeled label="Şehir">
            <CitySelect value={city} onChange={setCity} className={INPUT} />
          </Labeled>

          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-700 ring-1 ring-red-400/25">{error}</div>}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Giriş bağlantısı gönder
          </button>
        </form>

        <p className="mt-3 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
          Bağlantıya tıkladığınız anda Doctorium&apos;unuz açılır. Üyeliğinizin kalıcı olması için 30 gün içinde
          e-Devlet barkodlu Mezun Belgenizle kimliğinizi doğrulamanız yeterlidir.
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-[var(--c-ink-2)]">
        Parolanız var mı? <Link href="/doctorium/giris" className="font-semibold text-[var(--c-accent)] hover:underline">Giriş yapın</Link>
      </p>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink-2)]">{label}</span>
      {children}
    </label>
  );
}
