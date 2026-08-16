"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, UserPlus, MailCheck, ShieldCheck } from "lucide-react";
import { AuraMark } from "@/components/AuraLogo";
import {
  type StaffField,
  type StaffRoleConfig,
  STAFF_APPLICATION_CONSENT_TEXT,
} from "@/lib/staff-application-config";

// Tek alan çizimi — başvuru formu (StaffSignupForm) ve /kayit/durum düzeltme formu paylaşır.
export function StaffFieldInput({
  field: f,
  value,
  onChange,
}: {
  field: StaffField;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  return (
    <Labeled label={f.required ? f.label : `${f.label} (isteğe bağlı)`}>
      {f.type === "select" ? (
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
          required={f.required}
        >
          <option value="" disabled>Seçin…</option>
          {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : f.type === "multiselect" ? (
        <div className="flex flex-wrap gap-1.5">
          {f.options?.map((o) => {
            const cur = Array.isArray(value) ? value : [];
            const on = cur.includes(o);
            return (
              <button
                type="button"
                key={o}
                onClick={() => onChange(on ? cur.filter((x) => x !== o) : [...cur, o])}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-surface)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/40"}`}
              >
                {o}
              </button>
            );
          })}
        </div>
      ) : (
        <input
          type={f.type === "tel" ? "tel" : "text"}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder}
          maxLength={f.maxLen}
          className={INPUT}
          required={f.required}
        />
      )}
      {f.hint && <span className="mt-1 block text-[11px] text-[var(--c-ink-3)]">{f.hint}</span>}
    </Labeled>
  );
}

// Kurumsal üyelik başvuru formu (2026-08-12) — PARTNER / AGENCY / HEALTH_PRO ortak motor.
// Alanları rol-config'ten çizer (DoctorSignupForm dili); submit → POST /api/auth/signup-staff.
// KVKK başvuru onay kutusu ZORUNLU (metin ⚖️ TASLAK — staff-application-config).
// Başarıda hesap yetkisiz açılır → /onam (GENEL personel onamı) → /kayit/durum (insan onayı bekler).
export function StaffSignupForm({ config }: { config: StaffRoleConfig }) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [kvkk, setKvkk] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifySent, setVerifySent] = useState(false);

  function setField(key: string, value: string | string[]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) { setError("Parolalar eşleşmiyor."); return; }
    if (!kvkk) { setError("Başvuru için KVKK aydınlatma metnini onaylamanız gerekir."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup-staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: config.role, email, password, answers, kvkkConsent: kvkk }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Başvuru gönderilemedi.");
      if (data.needsVerification) { setVerifySent(true); return; }
      window.location.assign(data.home || "/kayit/durum"); // tam sayfa: çerez proxy'e taze taşınır
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başvuru gönderilemedi.");
      setLoading(false);
    }
  }

  if (verifySent) {
    return (
      <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-8 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><MailCheck size={28} /></span>
        <h1 className="mt-4 font-serif text-lg font-bold text-[var(--c-ink)]">Doğrulama bağlantısı gönderildi</h1>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">
          <span className="font-medium text-[var(--c-ink)]">{email}</span> adresine bir doğrulama
          e-postası gönderdik. Bağlantıya tıkladıktan sonra kurumsal girişten oturum açıp başvuru
          durumunuzu takip edebilirsiniz.
        </p>
        <Link href="/kurumsal-giris" className="mt-5 inline-flex items-center justify-center rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]">
          Kurumsal girişe dön
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-[var(--c-hairline)]"><AuraMark size={26} /></span>
        <h1 className="mt-3 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]">{config.title}</h1>
        <p className="mt-1 text-sm text-[var(--c-ink-2)]">{config.sub}</p>
      </div>

      <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
        <form onSubmit={submit} className="space-y-3">
          {config.fields.map((f) => (
            <StaffFieldInput key={f.key} field={f} value={answers[f.key]} onChange={(v) => setField(f.key, v)} />
          ))}

          <Labeled label="E-posta">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@kurum.com" className={INPUT} required />
          </Labeled>

          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Parola">
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="en az 8 karakter" className={INPUT} required minLength={8} />
            </Labeled>
            <Labeled label="Parola (tekrar)">
              <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className={INPUT} required minLength={8} />
            </Labeled>
          </div>

          {/* KVKK başvuru onayı — metin ⚖️ TASLAK; details ile tam metin okunabilir */}
          <div className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-3">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={kvkk}
                onChange={(e) => setKvkk(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--c-accent)]"
                required
              />
              <span className="text-xs leading-relaxed text-[var(--c-ink-2)]">
                Başvuru formunda verdiğim bilgilerin üyelik değerlendirmesi amacıyla işlenmesine
                ilişkin <strong className="text-[var(--c-ink)]">KVKK aydınlatma metnini</strong> okudum,
                onaylıyorum.
              </span>
            </label>
            <details className="mt-2">
              <summary className="cursor-pointer text-[11px] font-medium text-[var(--c-accent)]">Aydınlatma metnini görüntüle</summary>
              <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-[var(--c-ink-3)]">{STAFF_APPLICATION_CONSENT_TEXT}</pre>
            </details>
          </div>

          {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}

          <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Başvuruyu gönder
          </button>
        </form>

        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
          <ShieldCheck size={13} className="mt-0.5 shrink-0" />
          <span>
            Başvurunuz platform yönetimi tarafından incelenir; gerekli belgeleri girişten sonra
            başvuru durumu sayfasından yükleyebilirsiniz. Hesabınız onaylanana kadar rol paneline
            erişim kapalıdır.
          </span>
        </p>
      </div>

      <p className="mt-4 text-center text-sm text-[var(--c-ink-2)]">
        Zaten hesabınız var mı? <Link href="/kurumsal-giris" className="font-semibold text-[var(--c-accent)] hover:underline">Giriş yapın</Link>
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
