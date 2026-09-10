"use client";

import { useState } from "react";

// KVKK m.11 başvuru formu (06 madde A.2/A.3, Paket 2 — 2026-09-09) — LegalShell'in article'ının
// altına, yalnız oturumlu üyeye render edilir (kvkk-basvuru/page.tsx server-side kapısı). ReviewButtons
// (admin/personel-onay) fetch+state deseni; başarı sonrası router.refresh() YOK — kullanıcı kendi
// başvurusunu bu sayfada görmüyor (kütük admin görünümünde), yalnız "alındı" onayı yeterli.
const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: "BILGI_ERISIM", label: "Bilgi / erişim talebi" },
  { value: "DUZELTME", label: "Düzeltme talebi" },
  { value: "SILME", label: "Silme talebi" },
  { value: "ITIRAZ", label: "İtiraz (otomatik işlemeye)" },
  { value: "DIGER", label: "Diğer" },
];

export function KvkkApplicationForm() {
  const [requestType, setRequestType] = useState(REQUEST_TYPES[0].value);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/doctorium/kvkk-basvuru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Başvuru gönderilemedi.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Başvuru gönderilemedi.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="mt-8 rounded-xl border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/5 px-5 py-4 text-sm text-[var(--c-ink)]">
        Başvurunuz alındı. En geç 30 gün içinde, sistemde kayıtlı e-posta adresinizden bilgilendirileceksiniz.
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-[var(--c-hairline)] pt-8">
      <h2 className="text-lg font-semibold text-[var(--c-ink)]">Platform içi başvuru formu</h2>
      <p className="mt-2 text-[13px] text-[var(--c-ink-3)]">
        Kimliğiniz oturumunuzla doğrulanmıştır; ayrıca kimlik bilgisi girmenize gerek yoktur.
      </p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="kvkk-request-type" className="block text-xs font-medium text-[var(--c-ink-2)]">
            Talep konusu
          </label>
          <select
            id="kvkk-request-type"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value)}
            disabled={busy}
            className="mt-1 w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-bg)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]"
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kvkk-message" className="block text-xs font-medium text-[var(--c-ink-2)]">
            Açıklama
          </label>
          <textarea
            id="kvkk-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder="Talebinizi açıkça belirtin."
            className="mt-1 w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-bg)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]"
          />
        </div>
        {error && <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-600 ring-1 ring-red-400/25">{error}</div>}
        <button
          type="submit"
          disabled={busy || message.trim().length < 10}
          className="rounded-lg bg-[var(--c-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
        >
          {busy ? "Gönderiliyor…" : "Başvuruyu gönder"}
        </button>
      </form>
    </section>
  );
}
