"use client";

import { useState } from "react";
import { Loader2, Stethoscope, ArrowRight } from "lucide-react";
import { AuraMark } from "@/components/PortamedLogo";

// OAuth profil-tamamlama formu (v6.87) — DoctorSignupForm'un kimlik alanlarıyla BİREBİR
// (ad/ünvan/branş/şehir/telefon/diller; e-posta+parola YOK — OAuth hallettti). Ünvan listesi
// client kopyadır (lib/doctor-signup.ts db'li → bundle'a giremez; sunucu doğrulaması oradan).
const TITLES = ["Prof. Dr.", "Doç. Dr.", "Op. Dr.", "Uzm. Dr."];

export function CompleteProfileForm({
  initialName,
  initialTitle,
  initialLangs,
  branches,
  languages,
  nextHref,
}: {
  initialName: string;
  initialTitle: string;
  initialLangs: string[];
  branches: string[];
  languages: string[];
  nextHref: string;
}) {
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(TITLES.includes(initialTitle) ? initialTitle : "Uzm. Dr.");
  const [branch, setBranch] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [langs, setLangs] = useState<string[]>(initialLangs.length ? initialLangs : ["Türkçe"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function toggleLang(l: string) {
    setLangs((prev) => (prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/complete-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, title, branch, city, phone, languages: langs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kaydedilemedi.");
      // Tam sayfa yönlendirme: onboarding kapısı sunucu-render (taze doctor kaydıyla düşsün).
      window.location.assign(nextHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi.");
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-[var(--c-hairline)]"><AuraMark size={26} /></span>
        <h1 className="mt-3 flex items-center gap-1.5 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]">
          <Stethoscope size={20} className="text-[var(--c-accent)]" /> Profilinizi tamamlayın
        </h1>
        <p className="text-sm text-[var(--c-ink-2)]">
          Google/Apple hesabınızdan yalnız ad ve e-posta alınır — branş ve şehir bilgileriniz vaka
          eşleştirmesi ve Doctorium akışınız için gereklidir.
        </p>
      </div>

      <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
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
            <span className="mt-1 block text-[11px] text-[var(--c-ink-3)]">WhatsApp/SMS bildirim kanalını seçerseniz bildirimler bu numaraya gönderilir.</span>
          </Labeled>

          <Labeled label="Hizmet dilleri">
            <div className="flex flex-wrap gap-1.5">
              {languages.map((l) => (
                <button type="button" key={l} onClick={() => toggleLang(l)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${langs.includes(l) ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-surface)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40"}`}>
                  {l}
                </button>
              ))}
            </div>
          </Labeled>

          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} Kaydet ve devam et
          </button>
        </form>
      </div>
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
