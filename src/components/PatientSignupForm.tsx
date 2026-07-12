"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, UserPlus, HeartPulse, MailCheck } from "lucide-react";
import { AuraMark } from "@/components/PortamedLogo";
import { SocialAuthButtons } from "@/components/social-auth";

// Hasta üyelik formu (/kayit/hasta) — Google (intent=patient, dormant) / Apple ("Yakında") /
// e-posta kaydı. Başarılı kayıt → /onam (KVKK) → hasta ana akışı.
export function PatientSignupForm({ googleEnabled }: { googleEnabled: boolean }) {
  const sp = useSearchParams();
  const oauthMsg =
    sp.get("oauth") === "unavailable" ? "Google ile kayıt henüz yapılandırılmadı (yakında)."
    : sp.get("oauth") === "error" ? "Google ile kayıt tamamlanamadı, lütfen tekrar deneyin."
    : "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifySent, setVerifySent] = useState(false); // v5.6: e-posta doğrulama etkinse kayıt oturum açmaz

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) { setError("Parolalar eşleşmiyor."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");
      if (data.needsVerification) { setVerifySent(true); return; } // doğrulama ekranı (oturum yok)
      // Tam sayfa yönlendirme: çerez proxy'e taze taşınır (onam kapısına düşer).
      window.location.assign(data.home || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
      setLoading(false);
    }
  }

  if (verifySent) {
    return (
      <div className="w-full max-w-sm">
        <div className="rounded-[22px] border border-white/10 bg-[#161719] p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><MailCheck size={28} /></span>
          <h1 className="mt-4 font-serif text-lg font-bold text-[#F4F5F3]">Doğrulama bağlantısı gönderildi</h1>
          <p className="mt-2 text-sm text-white/50">
            <span className="font-medium text-white/80">{email}</span> adresine bir doğrulama
            e-postası gönderdik. Bağlantıya tıkladıktan sonra giriş yapabilirsiniz.
          </p>
          <p className="mt-3 text-xs text-white/40">E-posta birkaç dakika içinde gelmezse spam klasörünü kontrol edin.</p>
          <Link href="/giris/e-posta" className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            Giriş ekranına dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[#161719] ring-1 ring-white/10"><AuraMark size={26} /></span>
        <h1 className="mt-3 flex items-center gap-1.5 font-serif text-xl font-bold tracking-tight text-[#F4F5F3]"><HeartPulse size={20} className="text-[#28C8D8]" /> Hasta Üyeliği</h1>
        <p className="text-sm text-white/50">Birkaç adımda hesabınızı oluşturun</p>
      </div>

      <div className="rounded-[22px] border border-white/10 bg-[#161719] p-6">
        {oauthMsg && <div className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-300 ring-1 ring-amber-400/25">{oauthMsg}</div>}

        <SocialAuthButtons googleEnabled={googleEnabled} intent="patient" />

        <div className="my-4 flex items-center gap-3 text-xs text-white/40">
          <span className="h-px flex-1 bg-white/10" /> veya e-posta ile <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/70">Ad soyad</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayşe Yılmaz" className={INPUT} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/70">E-posta</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ayse@example.com" className={INPUT} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">Parola</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="en az 8 karakter" className={INPUT} required minLength={8} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-white/70">Parola (tekrar)</span>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className={INPUT} required minLength={8} />
            </label>
          </div>

          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#28C8D8] px-4 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Üye ol
          </button>
        </form>

        <p className="mt-3 text-[11px] leading-relaxed text-white/40">
          Üyelik sonrası kişisel verilerinizin işlenmesine ilişkin KVKK açık onam metni gösterilir;
          sağlık verileriniz uçtan uca erişim kontrolü ve şifreleme ile korunur.
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-white/50">
        Zaten hesabınız var mı? <Link href="/giris/e-posta" className="font-semibold text-[#28C8D8] hover:underline">Giriş yapın</Link>
      </p>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-white/10 bg-[#1E1F22] px-3 py-2 text-sm text-[#F4F5F3] outline-none placeholder:text-white/25 focus:border-[#28C8D8]";
