"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Loader2, Pencil, RotateCcw, X } from "lucide-react";
import { LEGAL_EDIT_MAX_CHARS, legalEditError, type LegalUnitPair } from "@/lib/legal-markdown-split";
import { resetLegalReviewState, setLegalEdit, setLegalReviewState, useLegalReviewState } from "./legal-review-store";

// Hukuki çeviri DÜZENLEME editörü (7-C, 2026-10-03 — 👤 karar: hukukçu paragrafı yerinde düzeltip onaylar). Okuma görünümü =
// sunucuda çizilmiş LegalMarkdown (children); düzenleme görünümü = birim (paragraf/madde/hücre) listesi: üstte Türkçe kaynak, altta
// düzenlenebilir çeviri. Yapı (başlık/liste/tablo) kilitlidir — yalnız metin değişir, tek satır. "Düzenlemelerle onayla" taslak
// birimleri uca gönderir (approve + edits, adminin gördüğü textHash ile; metin değiştiyse 409 → yeniden yükle). Taslak dış
// mağazada (legal-review-store) — üst paneldeki "Onayla" düzenleme sürerken kilitlenir, not oradan okunur.
type Props = {
  slug: string;
  code: string;
  textHash: string | null; // adminin gördüğü metnin hash'i (eksik/önbelleksiz → null → düzenleme kapalı)
  pairs: LegalUnitPair[] | null; // yapı uyuşmazsa null → düzenleme kapalı
  edited: boolean | null; // reviewed: dondurulmuş metin otomatik metinden farklı
  dir: "ltr" | "rtl";
  children: ReactNode;
};

const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function LegalTranslationEditor({ slug, code, textHash, pairs, edited, dir, children }: Props) {
  const router = useRouter();
  const rv = useLegalReviewState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pageKey = `${slug}/${code}`;

  // Sayfa (belge/dil) değişince taslak sıfırlanır; ayrılırken de temizlenir (dış mağaza, React state değil).
  useEffect(() => {
    resetLegalReviewState(pageKey);
    return () => resetLegalReviewState("");
  }, [pageKey]);

  const canEdit = !!textHash && !!pairs && pairs.length > 0;
  const active = rv.key === pageKey;
  const editing = active && rv.editing;
  const edits = active ? rv.edits : {};
  const changedKeys = new Set<string>();
  const errors: Record<string, string> = {};
  if (pairs) {
    for (const p of pairs) {
      const v = edits[p.key];
      if (v === undefined || v === p.text) continue;
      changedKeys.add(p.key);
      const e = legalEditError(v);
      if (e) errors[p.key] = e;
    }
  }
  const count = changedKeys.size;
  const hasError = Object.keys(errors).length > 0;

  async function approveWithEdits() {
    if (!textHash || count === 0 || hasError) return;
    setError("");
    setBusy(true);
    try {
      const payload: Record<string, string> = {};
      for (const k of changedKeys) payload[k] = edits[k];
      const res = await fetch("/api/admin/hukuki-ceviri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, lang: code, action: "approve", textHash, note: rv.note, edits: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "İşlem tamamlanamadı.");
      resetLegalReviewState(pageKey);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "İşlem tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-[var(--c-ink-3)]">
          {edited === true && (
            <span className="rounded-full border border-[var(--c-accent)]/40 px-2 py-0.5 font-medium text-[var(--c-accent)]">düzenlenmiş çeviri</span>
          )}
          {editing && <span>{count} birim düzenlendi</span>}
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => setLegalReviewState({ key: pageKey, editing: !editing })}
            disabled={busy}
            className={`${btn} border border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)] hover:text-[var(--c-accent)]`}
          >
            {editing ? <BookOpen size={13} /> : <Pencil size={13} />}
            {editing ? "Okuma görünümü" : "Düzenle"}
          </button>
        )}
      </div>

      {!editing && children}

      {editing && pairs && (
        <div className="space-y-3" lang={code} dir={dir}>
          {pairs.map((p, i) => {
            const value = edits[p.key] ?? p.text;
            const changed = changedKeys.has(p.key);
            const err = errors[p.key];
            const rows = Math.min(10, Math.max(2, Math.ceil(value.length / 90) + 1));
            return (
              <div key={`${i}-${p.key.slice(0, 24)}`} className={`rounded-xl border p-3 ${changed ? "border-[var(--c-accent)]/50 bg-[var(--c-accent)]/5" : "border-[var(--c-hairline)] bg-[var(--c-surface)]"}`}>
                <div className="mb-1.5 flex items-start justify-between gap-2" dir="ltr" lang="tr">
                  <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">
                    <span className="aura-mono mr-1.5 uppercase tracking-[0.15em]">{p.kind === "cell" ? "Tablo hücresi · Türkçe kaynak" : "Türkçe kaynak"}</span>
                    {p.key}
                  </p>
                  {changed && (
                    <button type="button" onClick={() => setLegalEdit(p.key, null)} disabled={busy} className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[var(--c-ink-2)] hover:text-[var(--c-accent)]">
                      <RotateCcw size={11} /> Geri al
                    </button>
                  )}
                </div>
                <textarea
                  value={value}
                  onChange={(e) => setLegalEdit(p.key, e.target.value)}
                  disabled={busy}
                  rows={rows}
                  maxLength={LEGAL_EDIT_MAX_CHARS + 200}
                  aria-label={p.kind === "cell" ? "Tablo hücresi çevirisi" : "Paragraf çevirisi"}
                  className="w-full resize-y rounded-lg border border-[var(--c-hairline)] bg-[var(--c-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--c-ink)] outline-none focus:border-[var(--c-accent)]"
                />
                <div className="mt-1 flex items-center justify-between gap-2 text-[11px]" dir="ltr">
                  <span className={err ? "font-medium text-[var(--c-danger)]" : "text-[var(--c-ink-3)]"}>{err ?? (changed ? "Düzenlendi" : "")}</span>
                  <span className="text-[var(--c-ink-3)]">{value.length}/{LEGAL_EDIT_MAX_CHARS}</span>
                </div>
              </div>
            );
          })}

          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/95 px-3 py-2 backdrop-blur" dir="ltr" lang="tr">
            <span className="text-xs text-[var(--c-ink-2)]">
              {count === 0 ? "Henüz düzenleme yok." : hasError ? "Hatalı birim var — onaydan önce düzeltin." : `${count} birim düzenlendi · onay bu metni dondurur.`}
            </span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setLegalReviewState({ edits: {} })} disabled={busy || count === 0} className={`${btn} border border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:border-[var(--c-danger)] hover:text-[var(--c-danger)]`}>
                <X size={13} /> Düzenlemeleri at
              </button>
              <button type="button" onClick={approveWithEdits} disabled={busy || count === 0 || hasError} className={`${btn} bg-[var(--c-accent)] text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]`}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Düzenlemelerle onayla
              </button>
            </div>
          </div>
          {error && <div className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-300 ring-1 ring-red-400/25" dir="ltr">{error}</div>}
        </div>
      )}
    </div>
  );
}
