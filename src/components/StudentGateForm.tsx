"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, MailCheck, UserPlus, Loader2 } from "lucide-react";
import { AuraMark } from "@/components/AuraLogo";

// v6.95 — Tıp öğrencisi kaydı (/ogrenci): doktor kaydından AYRI huni (kullanıcı kararı
// 2026-08-14). Kayıt /api/auth/signup-student'a gider (ünvan/telefon/dil yok). OAuth butonu
// BİLİNÇLİ YOK: sosyal kayıt intent=doctor açar (studentTrack'siz) — öğrenci hunisi e-posta kaydı.
// 2026-08-17 (kullanıcı kararı): sayfa SALT KAYIT oldu — Giriş/Hesap oluştur sekmeleri ve
// gömülü giriş formu kaldırıldı. Öğrenci hesabı DOCTOR rollüdür, girişi ortak /kurumsal-giris
// kapısından yapar (aşağıdaki metin linki); ayrı bir öğrenci giriş yüzeyi ARTIK YOK.

export function StudentGateForm({ branches }: { branches: string[] }) {
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-[var(--c-hairline)]"><AuraMark size={26} /></span>
        <h1 className="mt-3 flex items-center gap-1.5 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]">
          <GraduationCap size={20} className="text-[var(--c-accent)]" /> Tıp Öğrencisi Kaydı
        </h1>
        <p className="text-sm text-[var(--c-ink-2)]">Doctorium&apos;un bilgi akışına öğrenciyken katılın</p>
      </div>

      <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
        <StudentSignup branches={branches} />
      </div>

      <p className="mt-4 text-center text-sm text-[var(--c-ink-2)]">
        Zaten hesabınız var mı? <Link href="/kurumsal-giris" className="font-semibold text-[var(--c-accent)] hover:underline">Giriş yapın</Link>
      </p>
      <p className="mt-1.5 text-center text-sm text-[var(--c-ink-2)]">
        Doktor musunuz? <Link href="/kayit" className="font-semibold text-[var(--c-accent)] hover:underline">Doktor kaydına gidin</Link>
      </p>
    </div>
  );
}

function StudentSignup({ branches }: { branches: string[] }) {
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifySent, setVerifySent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) { setError("Parolalar eşleşmiyor."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, branch, city, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");
      if (data.needsVerification) { setVerifySent(true); return; }
      window.location.assign(data.home || "/doktor/baslangic");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
      setLoading(false);
    }
  }

  if (verifySent) {
    return (
      <div className="py-2 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><MailCheck size={28} /></span>
        <h2 className="mt-4 font-serif text-lg font-bold text-[var(--c-ink)]">Doğrulama bağlantısı gönderildi</h2>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">
          <span className="font-medium text-[var(--c-ink)]">{email}</span> adresine bir doğrulama
          e-postası gönderdik. Bağlantıya tıkladıktan sonra bu sayfadan giriş yapabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Labeled label="Ad soyad">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayşe Yılmaz" className={INPUT} required />
      </Labeled>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="İlgilendiğiniz branş">
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className={INPUT} required>
            <option value="" disabled>Seçin…</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Labeled>
        <Labeled label="Üniversite şehri">
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="İstanbul" className={INPUT} required />
        </Labeled>
      </div>

      <Labeled label="E-posta">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@universite.edu.tr" className={INPUT} required />
        <span className="mt-1 block text-[11px] text-[var(--c-ink-3)]">
          Üniversite e-postanızla (.edu.tr) kaydolursanız profilinizde üniversite rozeti görünür — zorunlu değildir.
        </span>
      </Labeled>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Parola">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="en az 8 karakter" className={INPUT} required minLength={8} />
        </Labeled>
        <Labeled label="Parola (tekrar)">
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className={INPUT} required minLength={8} />
        </Labeled>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}

      <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Hesap oluştur
      </button>

      <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Kayıt sonrası e-Devlet&apos;ten aldığınız <strong>öğrenci belgesini</strong> yüklemeniz istenir;
        Doctorium erişiminiz belge yüklenince açılır. Diploma, MMSS poliçesi gibi doktor belgeleri
        öğrenci üyelikte İSTENMEZ.
      </p>
    </form>
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
