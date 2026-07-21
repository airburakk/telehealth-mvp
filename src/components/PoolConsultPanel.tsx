"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Loader2, Send, X, FileText, Check } from "lucide-react";

// v6.33 Faz 3 — "Havuzdan görüş iste" paneli (doktor vaka kokpiti; metinler kullanıcı onaylı 2026-07-21).
// Açılınca GET /consult-pool ile anonim özet taslağı + belge listesi gelir; doktor özeti düzenler,
// belgeleri seçer (DICOM seçiliyse partner formundaki onaylı burned-in beyanı aynı metinle zorunlu).
const DICOM_CONFIRM_TEXT =
  "Yüklediğim DICOM görüntülerinin üzerinde (piksellerde) hastayı tanımlayan yazı bulunmadığını kontrol ettim. Dosya etiketlerindeki kimlik bilgileri sistem tarafından otomatik temizlenir; görüntünün içine işlenmiş yazılar temizlenmez.";

interface PoolDoc { id: string; label: string; mime: string }

export function PoolConsultPanel({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [docs, setDocs] = useState<PoolDoc[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dicomConfirm, setDicomConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const hasDicomSelected = docs.some((d) => selected.has(d.id) && d.mime === "application/dicom");

  async function openPanel() {
    setOpen(true); setLoading(true); setErr("");
    try {
      const r = await fetch(`/api/cases/${caseId}/consult-pool`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Yüklenemedi.");
      setSummary(d.summary || "");
      setDocs(Array.isArray(d.documents) ? d.documents : []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Yüklenemedi.");
    }
    setLoading(false);
  }

  async function submit() {
    setSending(true); setErr("");
    try {
      const r = await fetch(`/api/cases/${caseId}/consult-pool`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary, docIds: [...selected], dicomConfirm }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Gönderilemedi.");
      setDone(true);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gönderilemedi.");
    }
    setSending(false);
  }

  if (!open) {
    return (
      <button type="button" onClick={openPanel} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-400/30 bg-indigo-500/10 px-4 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/15">
        <Users size={15} /> Havuzdan görüş iste
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-400/25 bg-indigo-500/[0.06] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink)]"><Users size={15} className="text-indigo-300" /> Konsültasyon Havuzundan Görüş İste</div>
        {!done && <button type="button" onClick={() => setOpen(false)} className="text-[var(--c-ink-3)] hover:text-[var(--c-ink)]"><X size={15} /></button>}
      </div>
      {done ? (
        <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-300">✓ Talep havuza açıldı. Gelen görüş bu vakanın sayfasında görünecek.</p>
      ) : loading ? (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--c-ink-2)]"><Loader2 size={15} className="animate-spin" /> Anonim özet hazırlanıyor…</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-xs leading-relaxed text-[var(--c-ink-3)]">
            Vaka kimlikten arındırılarak kayıtlı uzman havuzuna açılır: ad, kimlik no ve iletişim bilgileri otomatik maskelenir; DICOM görüntülerinin kimlik etiketleri temizlenir. Göndermeden önce anonim özeti kontrol edip düzenleyebilirsiniz.
          </p>
          <div>
            <label className="text-xs font-semibold text-[var(--c-ink-2)]">Anonim klinik özet (düzenlenebilir)</label>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={7} className="mt-1 w-full resize-y rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] p-2.5 text-sm text-[var(--c-ink)] outline-none focus:border-indigo-400" />
          </div>
          {docs.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[var(--c-ink-2)]">Eklenecek belgeler</div>
              <ul className="mt-1.5 space-y-1.5">
                {docs.map((d) => (
                  <li key={d.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm">
                      <input type="checkbox" checked={selected.has(d.id)} onChange={(e) => setSelected((p) => { const n = new Set(p); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; })} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-[var(--c-ink)]"><FileText size={13} className="shrink-0 text-[var(--c-ink-3)]" /> <span className="truncate">{d.label}</span>{d.mime === "application/dicom" && <span className="shrink-0 rounded bg-[var(--c-ink)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--c-ink-2)]">DICOM</span>}</span>
                        {d.mime === "application/dicom" && <span className="mt-0.5 block text-[11px] text-[var(--c-ink-3)]">Kimlik etiketleri temizlenerek gönderilir.</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {hasDicomSelected && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
              <input type="checkbox" checked={dicomConfirm} onChange={(e) => setDicomConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-400" />
              {DICOM_CONFIRM_TEXT}
            </label>
          )}
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={sending || summary.trim().length < 10 || (hasDicomSelected && !dicomConfirm)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Havuza gönder
          </button>
        </div>
      )}
    </div>
  );
}

// Vaka sayfası "Havuz Görüşü" kartı — server'dan gelen taleplerin durum/görüş gösterimi (salt-okur).
export function CasePoolAnswers({ items }: { items: { id: string; status: string; answerText: string | null; answeredAt: string | null; createdAt: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
      <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]"><Users size={14} /> Havuz Görüşü</div>
      <ul className="mt-3 space-y-2.5">
        {items.map((r) => (
          <li key={r.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]/60 p-3">
            {r.status === "ANSWERED" && r.answerText ? (
              <>
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><Check size={13} /> Uzman görüşü{r.answeredAt ? ` · ${new Date(r.answeredAt).toLocaleDateString("tr-TR")}` : ""}</div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-[var(--c-ink)]">{r.answerText}</p>
              </>
            ) : (
              <div className="text-xs text-[var(--c-ink-2)]">Uzman görüşü bekleniyor <span className="text-[var(--c-ink-3)]">· {new Date(r.createdAt).toLocaleDateString("tr-TR")}</span></div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
