"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, UserPlus, Stethoscope } from "lucide-react";
import { AuraMark } from "@/components/PortamedLogo";

const TITLES = ["Prof. Dr.", "Doç. Dr.", "Op. Dr.", "Uzm. Dr."];

// Marka ikonları (lucide'de yok) — inline SVG.
function GoogleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5Z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7Z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44Z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C39.9 41 44 36 44 24c0-1.2-.1-2.4-.4-3.5Z" />
    </svg>
  );
}
function AppleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.7c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.2.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1 2.8-2.1c.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-1-2.5-3.8ZM14.1 5.5c.6-.8 1.1-1.9.9-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.8 1.1.1 2.2-.5 2.9-1.2Z" />
    </svg>
  );
}

// M5 — Doktor kayıt formu. E-posta kaydı tam çalışır; Google env varsa aktif (yoksa "Yakında");
// Apple parked ("Yakında" — Apple Developer hesabı gerekir). Başarılı kayıt → /onam → /doktor onboarding.
export function DoctorSignupForm({ googleEnabled, branches, languages }: { googleEnabled: boolean; branches: string[]; languages: string[] }) {
  const sp = useSearchParams();
  const oauthMsg =
    sp.get("oauth") === "unavailable" ? "Google ile giriş henüz yapılandırılmadı (yakında)."
    : sp.get("oauth") === "error" ? "Google ile giriş tamamlanamadı, lütfen tekrar deneyin."
    : "";

  const [name, setName] = useState("");
  const [title, setTitle] = useState("Uzm. Dr.");
  const [branch, setBranch] = useState("");
  const [city, setCity] = useState("");
  const [langs, setLangs] = useState<string[]>(["Türkçe"]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleLang(l: string) {
    setLangs((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) { setError("Parolalar eşleşmiyor."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, branch, city, languages: langs, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");
      // Tam sayfa yönlendirme: çerez proxy'e taze taşınır (onam + onboarding kapısına düşer).
      window.location.assign(data.home || "/doktor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[#101010] shadow"><AuraMark size={26} /></span>
        <h1 className="mt-3 flex items-center gap-1.5 text-xl font-bold text-[#101010]"><Stethoscope size={20} className="text-[#0EA5B2]" /> Hekim Kaydı</h1>
        <p className="text-sm text-slate-500">AURA ağına katılın — birkaç adımda profilinizi oluşturun</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {oauthMsg && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">{oauthMsg}</div>}

        {/* Sosyal kayıt/giriş */}
        <div className="grid grid-cols-1 gap-2">
          {googleEnabled ? (
            <a href="/api/auth/google/start" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <GoogleIcon /> Google ile devam et
            </a>
          ) : (
            <button type="button" disabled title="Yakında — yapılandırma gerektirir" className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400">
              <span className="opacity-40"><GoogleIcon /></span> Google ile devam et <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase">Yakında</span>
            </button>
          )}
          <button type="button" disabled title="Yakında — Apple Developer hesabı gerektirir" className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400">
            <AppleIcon /> Apple ile devam et <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase">Yakında</span>
          </button>
        </div>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> veya e-posta ile <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <Labeled label="Ad soyad">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Ayşe Yılmaz" className={INPUT} required />
          </Labeled>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Ünvan">
              <select value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT}>
                {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Labeled>
            <Labeled label="Branş">
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className={INPUT} required>
                <option value="" disabled>Seçin…</option>
                {branches.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </Labeled>
          </div>

          <Labeled label="Şehir">
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="İstanbul" className={INPUT} required />
          </Labeled>

          <Labeled label="Hizmet dilleri">
            <div className="flex flex-wrap gap-1.5">
              {languages.map((l) => (
                <button type="button" key={l} onClick={() => toggleLang(l)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${langs.includes(l) ? "border-[#14C3D0] bg-[#14C3D0] text-[#101010]" : "border-slate-300 bg-white text-slate-600 hover:border-[#14C3D0]/40"}`}>
                  {l}
                </button>
              ))}
            </div>
          </Labeled>

          <Labeled label="E-posta">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ayse@klinik.com" className={INPUT} required />
          </Labeled>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Parola">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="en az 8 karakter" className={INPUT} required minLength={8} />
            </Labeled>
            <Labeled label="Parola (tekrar)">
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className={INPUT} required minLength={8} />
            </Labeled>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Hesap oluştur
          </button>
        </form>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Kayıt sonrası diploma/tescil no, uzmanlık belgesi, yaptığınız işlemler ve ücretleri ile
          <strong> tıp diploması + MMSS poliçenizi</strong> yüklemeniz istenir. Hesabınız doğrulama
          onayına kadar hekim dizininde görünmez.
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Zaten hesabınız var mı? <Link href="/giris" className="font-semibold text-[#0EA5B2] hover:underline">Giriş yapın</Link>
      </p>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#14C3D0]";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
