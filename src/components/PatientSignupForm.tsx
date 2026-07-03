"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, UserPlus, HeartPulse } from "lucide-react";
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
      // Tam sayfa yönlendirme: çerez proxy'e taze taşınır (onam kapısına düşer).
      window.location.assign(data.home || "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[#101010] shadow"><AuraMark size={26} /></span>
        <h1 className="mt-3 flex items-center gap-1.5 text-xl font-bold text-[#101010]"><HeartPulse size={20} className="text-[#0EA5B2]" /> Hasta Üyeliği</h1>
        <p className="text-sm text-slate-500">Birkaç adımda hesabınızı oluşturun</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {oauthMsg && <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 ring-1 ring-amber-200">{oauthMsg}</div>}

        <SocialAuthButtons googleEnabled={googleEnabled} intent="patient" />

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> veya e-posta ile <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Ad soyad</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayşe Yılmaz" className={INPUT} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">E-posta</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ayse@example.com" className={INPUT} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Parola</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="en az 8 karakter" className={INPUT} required minLength={8} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Parola (tekrar)</span>
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className={INPUT} required minLength={8} />
            </label>
          </div>

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{error}</div>}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14C3D0] px-4 py-2.5 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Üye ol
          </button>
        </form>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
          Üyelik sonrası kişisel verilerinizin işlenmesine ilişkin KVKK açık onam metni gösterilir;
          sağlık verileriniz uçtan uca erişim kontrolü ve şifreleme ile korunur.
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-slate-500">
        Zaten hesabınız var mı? <Link href="/giris" className="font-semibold text-[#0EA5B2] hover:underline">Giriş yapın</Link>
      </p>
    </div>
  );
}

const INPUT = "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#14C3D0]";
