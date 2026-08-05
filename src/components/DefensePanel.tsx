"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Loader2, Send, Clock3, CheckCircle2, EyeOff } from "lucide-react";

// Etik kurul — karşı taraftan savunma/bilgi talebi paneli (v6.79).
// ANONİMLİK: kurul karşı tarafın KİMLİĞİNİ görmez — yalnız hastanın bildirdiği tip etiketi
// ("Doktor" vb.) + yanıt metni. Yanıtlar sunucudan repliedByUserId OLMADAN gelir.
// Talep açılınca karar formu kilitlenir (yanıt VEYA 3 gün — DecisionForm + PATCH API).

export interface DefenseRequestView {
  id: string;
  body: string; // kurulun talebi (sunucuda çözülmüş)
  reply: string | null; // karşı tarafın yanıtı (sunucuda çözülmüş; kimliksiz)
  createdAtText: string;
  repliedAtText: string | null;
  deadlineText: string; // talep + 3 gün (bilgi amaçlı)
}

export function DefensePanel({ complaintId, respondentLabel, resolved, requests }: {
  complaintId: string;
  respondentLabel: string; // RESPONDENT_TYPES etiketi — kimlik DEĞİL
  resolved: boolean;
  requests: DefenseRequestView[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setError("");
    if (note.trim().length < 10) { setError("Talep metni en az 10 karakter olmalıdır."); return; }
    setSending(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/defense-request`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Hata");
      setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Talep gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">
          <MessageSquareText size={15} /> Savunma / Bilgi Talebi
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--c-ink)]/10 px-3 py-1 text-xs font-medium text-[var(--c-ink-2)]">
          <EyeOff size={13} /> Karşı taraf: {respondentLabel}
        </span>
      </div>

      {requests.length === 0 && (
        <p className="mt-3 text-sm text-[var(--c-ink-3)]">Bu başvuruda henüz savunma/bilgi talebi açılmadı.</p>
      )}

      {requests.map((r) => (
        <div key={r.id} className="mt-3 rounded-2xl border border-[var(--c-hairline)] p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {r.reply ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 font-semibold text-emerald-300 ring-1 ring-emerald-400/25">
                <CheckCircle2 size={12} /> Yanıtlandı{r.repliedAtText ? ` · ${r.repliedAtText}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 font-semibold text-amber-200 ring-1 ring-amber-400/25">
                <Clock3 size={12} /> Yanıt bekleniyor · son: {r.deadlineText}
              </span>
            )}
            <span className="text-[var(--c-ink-3)]">Talep: {r.createdAtText}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--c-ink-2)]">{r.body}</p>
          {r.reply && (
            <div className="mt-3 rounded-lg bg-[var(--c-surface)] p-3 ring-1 ring-white/10">
              <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Karşı taraf yanıtı — {respondentLabel} (kimlik gösterilmez)</div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[var(--c-ink)]">{r.reply}</p>
            </div>
          )}
        </div>
      ))}

      {!resolved && (
        <div className="mt-4">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Kurulun karşı taraftan talebi… (ör. tedavi planındaki gecikmenin gerekçesini ve belgelerini iletiniz)"
            className="w-full resize-none rounded-lg border border-[var(--c-hairline)] p-2.5 text-sm outline-none focus:border-[var(--c-accent)]"
          />
          {error && <div className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}
          <button
            onClick={send}
            disabled={sending}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--c-accent)]/40 bg-[var(--c-accent)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--c-accent)] hover:bg-[var(--c-accent)]/20 disabled:opacity-60"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Savunma/bilgi talep et
          </button>
          <p className="mt-1.5 text-[11px] text-[var(--c-ink-3)]">Talep açıldığında karar formu kilitlenir; yanıt gelince ya da 3 gün dolunca açılır.</p>
        </div>
      )}
    </div>
  );
}
