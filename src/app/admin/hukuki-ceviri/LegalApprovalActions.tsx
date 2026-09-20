"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Sparkles, Undo2 } from "lucide-react";
import type { LegalQueueState } from "@/lib/legal-approval";

// Hukuki çeviri onay eylemleri (7-C, v6.286 · 2026-09-20) — admin/kvkk-basvurulari KvkkDecisionForm fetch+state deseni; üç
// eylem tek uca (/api/admin/hukuki-ceviri POST action=approve|revoke|generate). Onay, adminin GÖRDÜĞÜ metnin hash'iyle gider
// (sunucu önbellekten yeniden kurar; değiştiyse 409 → yeniden yükleyip inceler). Üretim ~30–60 sn sürebilir; düğmeler kilitli.
type Action = "approve" | "revoke" | "generate";

export function LegalApprovalActions({ slug, code, textHash, state }: { slug: string; code: string; textHash: string | null; state: LegalQueueState }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<Action | "">("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const canApprove = !!textHash && state !== "reviewed";
  const canRevoke = state === "reviewed";
  const canGenerate = state === "missing" || state === "incomplete";

  async function run(action: Action) {
    setError("");
    setInfo("");
    setBusy(action);
    try {
      const res = await fetch("/api/admin/hukuki-ceviri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, lang: code, action, textHash, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      if (action === "generate") {
        setInfo(data.complete ? `Çeviri üretildi: ${data.translated}/${data.units} birim.` : `Üretildi: ${data.translated}/${data.units} birim — eksikler için tekrar çalıştırın.`);
      }
      if (action === "approve") setNote("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy("");
    }
  }

  const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="space-y-2">
      {!canRevoke && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={busy !== ""}
          rows={2}
          maxLength={2000}
          placeholder="İnceleme notu (isteğe bağlı; kuyrukta görünür, hastaya gösterilmez)"
          className="w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-xs text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)]"
        />
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {canGenerate && (
          <button type="button" onClick={() => run("generate")} disabled={busy !== ""} className={`${btn} border border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]`}>
            {busy === "generate" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {state === "incomplete" ? "Eksik birimleri üret" : "Çeviriyi üret"}
          </button>
        )}
        {canRevoke && (
          <button type="button" onClick={() => run("revoke")} disabled={busy !== ""} className={`${btn} border border-[var(--c-danger)]/50 text-[var(--c-danger)] hover:bg-[var(--c-danger)]/10`}>
            {busy === "revoke" ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Onayı kaldır
          </button>
        )}
        <button type="button" onClick={() => run("approve")} disabled={busy !== "" || !canApprove} className={`${btn} bg-[var(--c-accent)] text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]`}>
          {busy === "approve" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {state === "reviewed" ? "Onaylı" : "Onayla"}
        </button>
      </div>
      {busy === "generate" && <p className="text-xs text-[var(--c-ink-3)]">Çeviri üretiliyor — belge başına yaklaşık bir dakika sürer, sayfadan ayrılmayın.</p>}
      {info && <div className="rounded-lg bg-[var(--c-accent)]/10 px-3 py-1.5 text-xs text-[var(--c-ink)] ring-1 ring-[var(--c-accent)]/25">{info}</div>}
      {error && <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-300 ring-1 ring-red-400/25">{error}</div>}
    </div>
  );
}
