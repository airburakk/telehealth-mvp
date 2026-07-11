"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, UserPlus, Stethoscope, MailCheck } from "lucide-react";
import { AuraMark } from "@/components/PortamedLogo";
import { SocialAuthButtons } from "@/components/social-auth";

const TITLES = ["Prof. Dr.", "Doç. Dr.", "Op. Dr.", "Uzm. Dr."];

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
  const [phone, setPhone] = useState(""); // FAZ 5 — WhatsApp/SMS bildirim kanalı hedefi (opsiyonel)
  const [langs, setLangs] = useState<string[]>(["Türkçe"]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifySent, setVerifySent] = useState(false); // v5.6: e-posta doğrulama etkinse kayıt oturum açmaz

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
        body: JSON.stringify({ name, title, branch, city, phone, languages: langs, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");
      if (data.needsVerification) { setVerifySent(true); return; } // doğrulama ekranı (oturum yok)
      // Tam sayfa yönlendirme: çerez proxy'e taze taşınır (onam + onboarding kapısına düşer).
      window.location.assign(data.home || "/doktor");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
      setLoading(false);
    }
  }

  if (verifySent) {
    return (
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><MailCheck size={28} /></span>
          <h1 className="mt-4 text-lg font-bold text-[#101010]">Doğrulama bağlantısı gönderildi</h1>
          <p className="mt-2 text-sm text-slate-500">
            <span className="font-medium text-slate-700">{email}</span> adresine bir doğrulama
            e-postası gönderdik. Bağlantıya tıkladıktan sonra kurumsal girişten oturum açıp
            onboarding adımlarını tamamlayabilirsiniz.
          </p>
          <p className="mt-3 text-xs text-slate-400">E-posta birkaç dakika içinde gelmezse spam klasörünü kontrol edin.</p>
          <Link href="/kurumsal-giris" className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2]">
            Kurumsal girişe dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[#101010] shadow"><AuraMark size={26} /></span>
        <h1 className="mt-3 flex items-center gap-1.5 text-xl font-bold text-[#101010]"><Stethoscope size={20} className="text-[#0EA5B2]" /> Doktor Kaydı</h1>
        <p className="text-sm text-slate-500">AURA ağına katılın — birkaç adımda profilinizi oluşturun</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {oauthMsg && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">{oauthMsg}</div>}

        {/* Sosyal kayıt/giriş — intent=doctor: yeni Google hesabı doktor olarak açılır */}
        <SocialAuthButtons googleEnabled={googleEnabled} intent="doctor" />

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

          <Labeled label="Cep telefonu (isteğe bağlı)">
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+90 5xx xxx xx xx" className={INPUT} />
            <span className="mt-1 block text-[11px] text-slate-400">WhatsApp/SMS bildirim kanalını seçerseniz bildirimler bu numaraya gönderilir.</span>
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
          Kayıt sonrası diploma/tescil no, uzmanlık belgesi ve yaptığınız işlemler ile
          <strong> tıp diploması + MMSS poliçenizi</strong> yüklemeniz istenir (işlem ücretleri tedavi
          kararında belirlenir). Hesabınız doğrulama onayına kadar doktor dizininde görünmez.
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
