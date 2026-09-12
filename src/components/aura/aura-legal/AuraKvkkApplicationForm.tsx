"use client";

import { useState } from "react";
import type { AuraLegalLang } from "@/lib/aura-legal/routes";

// AURA KVKK m.11 başvuru formu (kod Paket A, v6.268 · 2026-09-13; A07 madde A.2/A.3) — /kvkk-basvuru gövdesinin altına,
// yalnız oturumlu üyeye render edilir (sayfa server-side kapısı: hasta VE personel rolleri — A07 A.2). Doctorium
// KvkkApplicationForm'un AURA vitrin token'lı (.aura-light) ve iki dilli eşleniği; uç `/api/kvkk-basvuru` (aynı işleyici,
// ortak kütük). Başarı sonrası router.refresh() YOK — kullanıcı kendi başvurusunu bu sayfada görmez (kütük admin görünümünde).
const REQUEST_TYPES: { value: string; label: Record<AuraLegalLang, string> }[] = [
  { value: "BILGI_ERISIM", label: { tr: "Bilgi / erişim talebi", en: "Information / access request" } },
  { value: "DUZELTME", label: { tr: "Düzeltme talebi", en: "Rectification request" } },
  { value: "SILME", label: { tr: "Silme talebi", en: "Erasure request" } },
  { value: "ITIRAZ", label: { tr: "İtiraz (otomatik işlemeye)", en: "Objection (automated processing)" } },
  { value: "DIGER", label: { tr: "Diğer", en: "Other" } },
];

const UI: Record<AuraLegalLang, Record<"title" | "hint" | "type" | "message" | "placeholder" | "send" | "sending" | "fail" | "done", string>> = {
  tr: {
    title: "Platform içi başvuru formu",
    hint: "Kimliğiniz oturumunuzla doğrulanmıştır; ayrıca kimlik bilgisi girmenize gerek yoktur.",
    type: "Talep konusu",
    message: "Açıklama",
    placeholder: "Talebinizi açıkça belirtin.",
    send: "Başvuruyu gönder",
    sending: "Gönderiliyor…",
    fail: "Başvuru gönderilemedi.",
    done: "Başvurunuz alındı. En geç 30 gün içinde, sistemde kayıtlı e-posta adresinizden bilgilendirileceksiniz.",
  },
  en: {
    title: "In-platform request form",
    hint: "Your identity is verified by your session; you do not need to enter identity details.",
    type: "Subject of the request",
    message: "Description",
    placeholder: "State your request clearly.",
    send: "Submit request",
    sending: "Sending…",
    fail: "The request could not be sent.",
    done: "Your request has been received. You will be informed at your registered e-mail address within 30 days at the latest.",
  },
};

const FIELD =
  "mt-1 w-full rounded-lg border border-[var(--aura-hairline)] bg-[var(--aura-bg)] px-3 py-2 text-sm text-[var(--aura-ink)] outline-none focus:border-[var(--aura-accent)]";

export function AuraKvkkApplicationForm({ lang }: { lang: AuraLegalLang }) {
  const ui = UI[lang];
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
      const res = await fetch("/api/kvkk-basvuru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ui.fail);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : ui.fail);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <section className="mt-8 rounded-xl border border-[var(--aura-accent)] bg-[var(--aura-panel)] px-5 py-4 text-sm text-[var(--aura-ink)]">
        {ui.done}
      </section>
    );
  }

  return (
    <section className="mt-10 border-t border-[var(--aura-hairline)] pt-8">
      <h2 className="aura-display text-lg font-bold text-[var(--aura-ink)]">{ui.title}</h2>
      <p className="mt-2 text-[13px] text-[var(--aura-grey)]">{ui.hint}</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="kvkk-request-type" className="block text-xs font-medium text-[var(--aura-ink)]">
            {ui.type}
          </label>
          <select id="kvkk-request-type" value={requestType} onChange={(e) => setRequestType(e.target.value)} disabled={busy} className={FIELD}>
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label[lang]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="kvkk-message" className="block text-xs font-medium text-[var(--aura-ink)]">
            {ui.message}
          </label>
          <textarea
            id="kvkk-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={busy}
            rows={4}
            placeholder={ui.placeholder}
            className={`${FIELD} placeholder:text-[var(--aura-micro)]`}
          />
        </div>
        {error && <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-700 ring-1 ring-red-400/25">{error}</div>}
        <button
          type="submit"
          disabled={busy || message.trim().length < 10}
          className="rounded-full bg-[var(--aura-accent-stronger)] px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[var(--aura-ink)] disabled:opacity-60"
        >
          {busy ? ui.sending : ui.send}
        </button>
      </form>
    </section>
  );
}
