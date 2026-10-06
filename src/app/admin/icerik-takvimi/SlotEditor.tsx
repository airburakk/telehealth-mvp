"use client";

import { useState } from "react";
import { AlertTriangle, Check, CheckCircle2, Eye, Loader2, Plus, RefreshCw, RotateCcw, Save, SkipForward, Sparkles, Trash2, Undo2, X, XCircle } from "lucide-react";
import type { GateReport } from "@/lib/social-calendar/gates";
import { REJECT_LABEL, type KararCandidate, type RejectCode } from "@/lib/social-calendar/karar";
import { LIMITS, MIN_NOTE_BULLET_CHARS, MIN_NOTE_BULLETS, noteLines } from "@/lib/social-calendar/limits";
import type { PlanSource, Slide } from "@/lib/social-calendar/payload";
import type { PlanItemView } from "@/lib/social-calendar/plan";
import type { RenderedSlide } from "@/lib/social-calendar/render-client";
import { SLIDE_ROLE_LABEL, type SeriesDef } from "@/lib/social-calendar/series";
import { skeletonPayload } from "@/lib/social-calendar/skeleton";
import { STATUS_LABEL, isEditable } from "@/lib/social-calendar/status";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { PublishPanel } from "./PublishPanel";
import { BTN_DANGER, BTN_PRIMARY, BTN_SECOND, INPUT, api, fmt, type ApiResult, type Flash, type PickStats } from "./client-shared";

// İçerik takvimi yuva editörü (v6.328, 2026-10-06). Tek uç: /api/admin/icerik-takvimi (action alanı). Kaydet → kapı raporu güncellenir; Onayla yalnız
// KAYDEDİLMİŞ taslakta açılır (ekrandaki ile onaylanan aynı içerik olsun). Her yazma `version` taşır (iyimser eşzamanlılık): 409 → "Sayfayı yenile".
// İstemci YALNIZ saf modülleri içe aktarır (payload.ts → Node crypto zinciri tarayıcı paketine giremez; sınırlar limits.ts'te). Kapıların kendisi
// SUNUCUDA koşar (alıntı doğrulaması karar metnini ister) — burada yalnız son rapor gösterilir. Yalnız --c-* token'ları (/admin ağacı Doctorium kromu).
interface Draft {
  slides: Slide[];
  caption: string;
  hashtags: string;
  sources: PlanSource[];
  note: string;
  attest: boolean;
}

function draftFromItem(item: PlanItemView, series: SeriesDef): Draft {
  const p = item.payload ?? skeletonPayload(series);
  return { slides: p.slides, caption: p.caption, hashtags: p.hashtags.join(" "), sources: p.sources, note: item.editorNote, attest: item.attestIdentity };
}

/** API'ye giden yük: ekrandaki taslak (meta korunur — onay hash'ine girmez ama tema geçmişi için taşınır). */
function toPayload(d: Draft, item: PlanItemView) {
  return {
    v: 1,
    slides: d.slides,
    caption: d.caption,
    hashtags: d.hashtags.split(/[\s,]+/).filter(Boolean),
    sources: d.sources,
    ...(item.payload?.meta ? { meta: item.payload.meta } : {}),
  };
}

const rowsFor = (s: string, min = 3, max = 12) => Math.min(max, Math.max(min, Math.ceil(s.length / 70) + 1));

export function SlotEditor({ initial, series }: { initial: PlanItemView; series: SeriesDef }) {
  const [item, setItem] = useState(initial);
  const [draft, setDraft] = useState<Draft>(() => draftFromItem(initial, series));
  const [baseline, setBaseline] = useState(() => JSON.stringify(draftFromItem(initial, series)));
  const [report, setReport] = useState<GateReport | null>(initial.gateReport);
  const [busy, setBusy] = useState("");
  const [flash, setFlash] = useState<Flash>(null);
  const [conflict, setConflict] = useState(false);
  const [candidates, setCandidates] = useState<KararCandidate[]>(initial.candidates);
  const [stats, setStats] = useState<PickStats | null>(null);
  const [showCandidates, setShowCandidates] = useState(initial.sourceIds.length === 0);
  const [previews, setPreviews] = useState<RenderedSlide[] | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [zoom, setZoom] = useState<RenderedSlide | null>(null);

  const dirty = JSON.stringify(draft) !== baseline;
  const editable = isEditable(item.status);
  const hasSource = item.sourceIds.length > 0;
  const noteCount = noteLines(draft.note);
  const noteOk = noteCount.length >= MIN_NOTE_BULLETS && noteCount.every((l) => l.length >= MIN_NOTE_BULLET_CHARS);

  /** Sunucudan gelen yuvayı BENİMSE: durum + taslak + taban çizgisi + kapı raporu sıfırlanır. */
  function adopt(it: PlanItemView) {
    const d = draftFromItem(it, series);
    setItem(it);
    setCandidates(it.candidates);
    setDraft(d);
    setBaseline(JSON.stringify(d));
    setReport(it.gateReport);
    setConflict(false);
  }

  async function run(label: string, body: Record<string, unknown>, onOk: (r: ApiResult) => void) {
    setBusy(label);
    setFlash(null);
    const r = await api({ ...body, id: item.id, version: item.version });
    setBusy("");
    if (r.ok) {
      onOk(r);
      return;
    }
    if (r.status === 422 && r.report) setReport(r.report);
    setConflict(r.status === 409);
    setFlash({ kind: "err", text: r.error ?? "İşlem tamamlanamadı." });
  }

  const save = () =>
    run(
      "save",
      {
        action: "save",
        payload: toPayload(draft, item),
        ...(series.noteLabel ? { editorNote: draft.note } : {}),
        ...(series.attestIdentity ? { attestIdentity: draft.attest } : {}),
      },
      (r) => {
        const wasApproved = item.status === "APPROVED";
        if (r.item) adopt(r.item);
        setFlash({ kind: "ok", text: wasApproved && r.item?.status === "DRAFT" ? "Kaydedildi — içerik değiştiği için onay düştü; kapıları kontrol edip yeniden onaylayın." : "Taslak kaydedildi." });
      },
    );

  const approve = () =>
    run("approve", { action: "approve" }, (r) => {
      if (r.item) adopt(r.item);
      setFlash({ kind: "ok", text: "Onaylandı. Otomatik yayın hattı henüz yok — “Yayın” bölümünden PNG’leri indirip elle paylaşabilirsiniz." });
    });

  const unapprove = () =>
    run("unapprove", { action: "unapprove" }, (r) => {
      if (r.item) adopt(r.item);
      setFlash({ kind: "ok", text: "Onay kaldırıldı — taslak durumuna döndü." });
    });

  function skip() {
    if (!window.confirm(`Bu haftanın “${series.name}” yuvası atlanacak${item.status === "APPROVED" ? " (onay da düşer)" : ""}. Devam edilsin mi?`)) return;
    void run("skip", { action: "skip" }, (r) => {
      if (r.item) adopt(r.item);
      setFlash({ kind: "ok", text: "Yuva atlandı. Geri alabilirsiniz." });
    });
  }

  const restore = () =>
    run("restore", { action: "restore" }, (r) => {
      if (r.item) adopt(r.item);
      setFlash({ kind: "ok", text: "Yuva geri alındı." });
    });

  async function fetchCandidates() {
    setBusy("candidates");
    setFlash(null);
    const r = await api({ action: "candidates", id: item.id });
    setBusy("");
    if (r.ok && r.item) {
      // taslak DEĞİŞMEZ (kaydedilmemiş düzenleme kaybolmasın): yalnız adaylar + sürüm tazelenir
      setItem(r.item);
      setCandidates(r.item.candidates);
      setStats(r.stats ?? null);
      setShowCandidates(true);
      setConflict(false);
    } else setFlash({ kind: "err", text: r.error ?? "Adaylar getirilemedi." });
  }

  function pick(c: KararCandidate) {
    if (hasSource && !window.confirm("Karar değişirse mevcut taslak bu karardan yeniden üretilir (düzenlemeleriniz ve “Doktor için çıkarım” sıfırlanır). Devam edilsin mi?")) return;
    void run("pick", { action: "pick", articleId: c.id }, (r) => {
      if (r.item) adopt(r.item);
      setShowCandidates(false);
      setPreviews(null);
      setFlash({ kind: "ok", text: "Karar seçildi, taslak üretildi. Şimdi “Doktor için çıkarım”ı yazın." });
    });
  }

  async function preview() {
    setBusy("preview");
    setPreviewErr("");
    const r = await api({ action: "preview", id: item.id, payload: toPayload(draft, item), ...(series.noteLabel ? { editorNote: draft.note } : {}) });
    setBusy("");
    if (r.ok && r.slides) setPreviews(r.slides);
    else setPreviewErr(r.error ?? "Önizleme alınamadı.");
  }

  const setSlide = (i: number, patch: Partial<Slide>) =>
    setDraft((d) => ({ ...d, slides: d.slides.map((s, k) => (k === i ? { ...s, ...patch, auto: undefined } : s)) }));

  // Üreticinin çıkardığı alternatif gerekçe kesitleri (hepsi karardan BİREBİR, kimlik taramasından geçmiş): "Başka kesit" bir sonrakine geçer.
  const gerekceAlts = item.payload?.meta?.gerekceAlts ?? [];
  function cycleAlt(i: number) {
    const k = gerekceAlts.indexOf(draft.slides[i]?.body ?? "");
    const next = gerekceAlts[(k + 1) % gerekceAlts.length];
    if (next !== undefined) setSlide(i, { body: next });
  }
  const setSource = (i: number, patch: Partial<PlanSource>) => setDraft((d) => ({ ...d, sources: d.sources.map((s, k) => (k === i ? { ...s, ...patch } : s)) }));

  const failed = report?.gates.filter((g) => !g.ok) ?? [];

  return (
    <div className="mt-6 space-y-6 pb-24">
      {item.status === "APPROVED" && (
        <div className="rounded-2xl border border-[var(--c-success)]/40 bg-[var(--c-success)]/10 px-4 py-3 text-sm text-[var(--c-ink)]">
          <span className="font-semibold">Onaylı</span> — {item.approvedBy} · {item.approvedAt ? fmt(item.approvedAt) : ""}. İçeriği düzenlerseniz onay düşer.
          {!item.approvedIntact && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--c-danger)]">
              <AlertTriangle size={13} /> İçerik onay mührüyle eşleşmiyor — yayın hattı bu içeriği yayınlamaz. Yeniden onaylayın.
            </div>
          )}
        </div>
      )}
      {item.status === "SKIPPED" && <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3 text-sm text-[var(--c-ink-2)]">Bu yuva atlandı. Düzenlemek için geri alın.</div>}
      {item.status === "PUBLISHED" && <div className="rounded-2xl border border-[var(--c-success)]/40 bg-[var(--c-success)]/10 px-4 py-3 text-sm text-[var(--c-ink)]">Yayınlandı — içerik değiştirilemez.</div>}

      {flash && (
        <div role="status" className={`rounded-xl px-4 py-2.5 text-sm ring-1 ${flash.kind === "ok" ? "bg-[var(--c-accent)]/10 text-[var(--c-ink)] ring-[var(--c-accent)]/25" : "bg-red-500/10 text-red-300 ring-red-400/25"}`}>
          {flash.text}
          {conflict && (
            <button type="button" onClick={() => window.location.reload()} className="ml-3 font-semibold underline">
              Sayfayı yenile
            </button>
          )}
        </div>
      )}

      {/* ── Yayın (v6.332): onaylı içeriği elle paylaş · yayınlandı işaretle · hatada yeniden dene ───────────────── */}
      <PublishPanel item={item} series={series} dirty={dirty} busy={busy} run={run} adopt={adopt} notify={setFlash} />

      {/* ── Kaynak (yalnız üreticili rubrik) ─────────────────────────────────────────────── */}
      {series.generator && (
        <AuraPanel
          title="Kaynak karar"
          meta={hasSource ? "seçili" : "seçilmedi"}
          action={
            editable && (
              <div className="flex gap-2">
                {hasSource && (
                  <button type="button" onClick={() => setShowCandidates((v) => !v)} className={BTN_SECOND}>
                    {showCandidates ? "Adayları gizle" : "Başka karar seç"}
                  </button>
                )}
                <button type="button" onClick={fetchCandidates} disabled={busy !== ""} className={BTN_SECOND}>
                  {busy === "candidates" ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} Aday kararları getir
                </button>
              </div>
            )
          }
        >
          {hasSource && !showCandidates && (
            <p className="text-sm text-[var(--c-ink-2)]">
              {item.payload?.meta?.daire ? `Yargıtay ${item.payload.meta.daire} · E. ${item.payload.meta.esas}, K. ${item.payload.meta.karar} · ${item.payload.meta.tarih}` : "Karar seçildi."}
              {item.payload?.meta?.themeLabel && <span className="ml-2 rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[11px]">{item.payload.meta.themeLabel}</span>}
            </p>
          )}
          {showCandidates && (
            <>
              {stats && (
                <p className="mb-3 text-xs text-[var(--c-ink-3)]">
                  {stats.total} karar tarandı · {stats.eligible} uygun
                  {Object.keys(stats.rejected).length > 0 && ` · elenenler: ${Object.entries(stats.rejected).map(([k, n]) => `${REJECT_LABEL[k as RejectCode]} (${n})`).join(", ")}`}
                </p>
              )}
              {candidates.length === 0 ? (
                <p className="text-sm text-[var(--c-ink-2)]">Henüz aday yok. “Aday kararları getir” ile sistem, kullanılmamış kararlar arasından en uygun 3 kararı önerir.</p>
              ) : (
                <ul className="grid gap-3">
                  {candidates.map((c) => (
                    <li key={c.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="text-sm font-semibold text-[var(--c-ink)]">
                          {c.daire} · E. {c.esas}, K. {c.karar}
                        </div>
                        <div className="aura-mono text-xs text-[var(--c-ink-3)]">{c.tarih}</div>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded-full border border-[var(--c-accent)]/40 px-2 py-0.5 text-[var(--c-accent)]">{c.themeLabel}</span>
                        <span className="rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[var(--c-ink-2)]">{c.outcomeLabel}</span>
                        <span className="rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[var(--c-ink-3)]">puan {c.score}</span>
                        {item.sourceIds[0] === c.id && <span className="rounded-full border border-[var(--c-success)]/40 px-2 py-0.5 text-[var(--c-success)]">seçili</span>}
                      </div>
                      <blockquote className="mt-3 border-l-2 border-[var(--c-accent)]/60 pl-3 text-sm text-[var(--c-ink)]">{c.uyusmazlik}</blockquote>
                      <p className="mt-2 text-xs leading-relaxed text-[var(--c-ink-3)]">Gerekçe: {c.preview}…</p>
                      <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[11px] text-[var(--c-ink-3)]">
                        {c.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                      {editable && item.sourceIds[0] !== c.id && (
                        <button type="button" onClick={() => pick(c)} disabled={busy !== ""} className={`${BTN_PRIMARY} mt-3`}>
                          {busy === "pick" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Bu kararı seç
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </AuraPanel>
      )}

      {/* ── Doktor için çıkarım (insan kalemi) ─────────────────────────────────────────── */}
      {series.noteLabel && (hasSource || !series.generator) && (
        <AuraPanel title={series.noteLabel} meta={`${noteCount.length} madde · en az ${MIN_NOTE_BULLETS}, her biri ≥ ${MIN_NOTE_BULLET_CHARS} karakter`}>
          <label htmlFor="cikarim" className="mb-2 block text-xs text-[var(--c-ink-3)]">
            Bu karar bir doktor için ne anlama geliyor? Pratik, kısa maddeler yazın (satır başına bir madde; “1)” numaraları otomatik temizlenir).
          </label>
          <textarea
            id="cikarim"
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            disabled={!editable}
            rows={rowsFor(draft.note, 6, 14)}
            maxLength={LIMITS.note}
            placeholder={"1) …\n2) …\n3) …"}
            className={INPUT}
          />
          <div className={`mt-1.5 text-xs ${noteOk ? "text-[var(--c-success)]" : "text-[var(--c-ink-3)]"}`}>
            {noteOk ? "Yeterli." : "Henüz yeterli değil — kapı en az 3 anlamlı madde ister."} Bu metin görselde “{series.noteLabel}” slaytı olur.
          </div>
        </AuraPanel>
      )}

      {/* ── Slaytlar ───────────────────────────────────────────────────────────────────── */}
      {(hasSource || !series.generator) && (
        <AuraPanel title="Slaytlar" meta={`${draft.slides.length} slayt`}>
          <ol className="space-y-4">
            {draft.slides.map((s, i) => {
              if (series.noteLabel && s.role === "cikarim") return null;
              const required = series.requiredRoles.includes(s.role);
              return (
                <li key={`${i}-${s.role}`} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[var(--c-ink)]">
                      {i + 1}. {SLIDE_ROLE_LABEL[s.role]}
                      {s.quote && <span className="ml-2 rounded-full border border-[var(--c-accent)]/40 px-2 py-0.5 text-[10px] font-medium text-[var(--c-accent)]">alıntı</span>}
                      {s.auto && <span className="ml-2 rounded-full border border-[var(--c-hairline)] px-2 py-0.5 text-[10px] font-medium text-[var(--c-ink-3)]">otomatik taslak</span>}
                    </div>
                    {editable && !series.generator && !required && (
                      <button type="button" onClick={() => setDraft((d) => ({ ...d, slides: d.slides.filter((_, k) => k !== i) }))} className="inline-flex items-center gap-1 text-xs text-[var(--c-ink-3)] hover:text-[var(--c-danger)]">
                        <Trash2 size={12} /> Kaldır
                      </button>
                    )}
                  </div>
                  <input aria-label={`Slayt ${i + 1} başlığı`} value={s.title} onChange={(e) => setSlide(i, { title: e.target.value })} disabled={!editable} maxLength={LIMITS.title} placeholder="Başlık" className={INPUT} />
                  <textarea aria-label={`Slayt ${i + 1} metni`} value={s.body} onChange={(e) => setSlide(i, { body: e.target.value })} disabled={!editable} rows={rowsFor(s.body)} maxLength={LIMITS.body} placeholder="Metin" className={`${INPUT} mt-2`} />
                  {s.quote && <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">Alıntıdır: değiştirirseniz karar metninde BİREBİR bulunmalı (kapı doğrular). “[…]” atlanan metni gösterir.</p>}
                  {s.role === "gerekce" && s.quote && gerekceAlts.length > 1 && editable && (
                    <button type="button" onClick={() => cycleAlt(i)} className={`${BTN_SECOND} mt-2`}>
                      <RefreshCw size={13} /> Başka kesit
                      <span className="font-normal text-[var(--c-ink-3)]">({gerekceAlts.indexOf(s.body) >= 0 ? `${gerekceAlts.indexOf(s.body) + 1}/${gerekceAlts.length}` : `${gerekceAlts.length} öneri`})</span>
                    </button>
                  )}
                  {(s.role === "mahkeme" || (s.bullets && s.bullets.length > 0)) && (
                    <>
                      <textarea
                        aria-label={`Slayt ${i + 1} maddeleri`}
                        value={(s.bullets ?? []).join("\n")}
                        onChange={(e) => setSlide(i, { bullets: e.target.value.split("\n") })}
                        disabled={!editable}
                        rows={rowsFor((s.bullets ?? []).join("\n"), 3, 8)}
                        placeholder="Maddeler (satır başına bir madde)"
                        className={`${INPUT} mt-2`}
                      />
                      <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">Satır başına bir madde; “Etiket: değer” biçimindeki etiket görselde vurgulanır.</p>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          {editable && !series.generator && draft.slides.length < LIMITS.maxSlides && (
            <button
              type="button"
              onClick={() =>
                setDraft((d) => {
                  const at = Math.max(0, d.slides.length - 1); // kapanıştaki "kaynak" slaytından ÖNCE
                  const next = [...d.slides];
                  next.splice(at, 0, { role: "genel", title: "", body: "" });
                  return { ...d, slides: next };
                })
              }
              className={`${BTN_SECOND} mt-4`}
            >
              <Plus size={13} /> Slayt ekle
            </button>
          )}
        </AuraPanel>
      )}

      {/* ── Altyazı · etiketler · kaynak künyesi ───────────────────────────────────────── */}
      {(hasSource || !series.generator) && (
        <AuraPanel title="Altyazı ve künye" meta={`${draft.caption.length}/${LIMITS.caption}`}>
          <label htmlFor="altyazi" className="mb-1 block text-xs text-[var(--c-ink-3)]">Instagram altyazısı</label>
          <textarea id="altyazi" value={draft.caption} onChange={(e) => setDraft((d) => ({ ...d, caption: e.target.value }))} disabled={!editable} rows={rowsFor(draft.caption, 5, 14)} maxLength={LIMITS.caption} className={INPUT} />
          <label htmlFor="etiketler" className="mb-1 mt-4 block text-xs text-[var(--c-ink-3)]">Etiketler (en çok {LIMITS.hashtags}; boşlukla ayırın)</label>
          <input id="etiketler" value={draft.hashtags} onChange={(e) => setDraft((d) => ({ ...d, hashtags: e.target.value }))} disabled={!editable} className={INPUT} />
          <div className="mt-4 text-xs text-[var(--c-ink-3)]">Kaynak künyesi</div>
          <ul className="mt-1 space-y-2">
            {draft.sources.map((src, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input aria-label={`Kaynak ${i + 1} adı`} value={src.label} onChange={(e) => setSource(i, { label: e.target.value })} disabled={!editable} placeholder="Ad" maxLength={LIMITS.sourceLabel} className={INPUT} />
                <input aria-label={`Kaynak ${i + 1} bilgisi`} value={src.ref} onChange={(e) => setSource(i, { ref: e.target.value })} disabled={!editable} placeholder="Künye / bağlantı" maxLength={LIMITS.sourceRef} className={INPUT} />
                {editable && (
                  <button type="button" aria-label={`Kaynak ${i + 1}'i kaldır`} onClick={() => setDraft((d) => ({ ...d, sources: d.sources.filter((_, k) => k !== i) }))} className="text-[var(--c-ink-3)] hover:text-[var(--c-danger)]">
                    <X size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {editable && draft.sources.length < LIMITS.sources && (
            <button type="button" onClick={() => setDraft((d) => ({ ...d, sources: [...d.sources, { label: "", ref: "" }] }))} className={`${BTN_SECOND} mt-3`}>
              <Plus size={13} /> Kaynak ekle
            </button>
          )}
        </AuraPanel>
      )}

      {/* ── Kimlik onayı (hukuk günü) ─────────────────────────────────────────────────── */}
      {series.attestIdentity && hasSource && (
        <AuraPanel title="Kimlik kontrolü" meta="hukuk günü · zorunlu">
          <label className="flex cursor-pointer items-start gap-3 text-sm text-[var(--c-ink)]">
            <input type="checkbox" checked={draft.attest} onChange={(e) => setDraft((d) => ({ ...d, attest: e.target.checked }))} disabled={!editable} className="mt-1 h-4 w-4 accent-[var(--c-accent)]" />
            <span>
              Metni (alıntılar dahil) gözle kontrol ettim: <strong>taraf adı, kimlik veya iletişim bilgisi içermiyor.</strong>
              <span className="mt-1 block text-xs text-[var(--c-ink-3)]">Otomatik tarama bariz sızıntıları yakalar ama her ad/ayrıntıyı yakalayamaz — son güvence bu onaydır. Karar metinleri “...” ile anonimleştirilmiştir; yine de tek tük gerçek ad kaçabiliyor.</span>
            </span>
          </label>
        </AuraPanel>
      )}

      {/* ── Onay kapıları ─────────────────────────────────────────────────────────────── */}
      <AuraPanel title="Onay kapıları" meta={report ? `son denetim ${fmt(report.checkedAt)}` : "henüz denetlenmedi"}>
        {!report ? (
          <p className="text-sm text-[var(--c-ink-2)]">Taslağı kaydedince kapılar çalışır ve sonuç burada görünür.</p>
        ) : (
          <>
            {dirty && <p className="mb-3 text-xs text-[var(--c-warn,#d97706)]">Kaydedilmemiş değişiklik var — bu rapor son KAYITLI hâle aittir.</p>}
            <ul className="space-y-2">
              {report.gates.map((g) => (
                <li key={g.id} className="flex items-start gap-2.5 text-sm">
                  {g.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--c-success)]" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-[var(--c-danger)]" />}
                  <div>
                    <div className={g.ok ? "text-[var(--c-ink-2)]" : "font-medium text-[var(--c-ink)]"}>{g.label}</div>
                    {!g.ok && g.detail && <div className="text-xs leading-relaxed text-[var(--c-danger)]">{g.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
            {failed.length === 0 && !dirty && item.status === "DRAFT" && <p className="mt-3 text-xs text-[var(--c-success)]">Tüm kapılar geçildi — onaylayabilirsiniz.</p>}
          </>
        )}
      </AuraPanel>

      {/* ── PNG önizleme ──────────────────────────────────────────────────────────────── */}
      <AuraPanel
        title="Önizleme (yayınlanacak görsel)"
        meta="kart servisiyle çizilir"
        action={
          <button type="button" onClick={preview} disabled={busy !== "" || (!hasSource && series.generator)} className={BTN_SECOND}>
            {busy === "preview" ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Önizlemeyi çiz
          </button>
        }
      >
        {busy === "preview" && <p className="text-sm text-[var(--c-ink-2)]">Slaytlar çiziliyor — birkaç saniye sürer…</p>}
        {previewErr && <p className="text-sm text-[var(--c-danger)]">{previewErr}</p>}
        {!previews && !previewErr && busy !== "preview" && <p className="text-sm text-[var(--c-ink-3)]">Ekrandaki (kaydedilmemiş olsa bile) içerik, yayınlanacak PNG ile aynı şablondan çizilir. Onaylamadan önce gözle kontrol edin.</p>}
        {previews && (
          <>
            <ul className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {previews.map((p) => (
                <li key={p.index} className="shrink-0">
                  <button type="button" onClick={() => setZoom(p)} className="block overflow-hidden rounded-xl border border-[var(--c-hairline)] hover:border-[var(--c-accent)]" aria-label={`Slayt ${p.index + 1} önizlemesini büyüt`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- base64 PNG önizlemesi (yerel veri); next/image dönüştürmesi anlamsız */}
                    <img src={`data:image/png;base64,${p.png}`} alt={`Slayt ${p.index + 1}: ${SLIDE_ROLE_LABEL[p.role]}`} width={216} height={270} className="block h-[270px] w-[216px] object-cover" />
                  </button>
                  <div className="mt-1 text-center text-[11px] text-[var(--c-ink-3)]">
                    {p.index + 1} · {SLIDE_ROLE_LABEL[p.role]}
                    {p.tasma && <span className="ml-1 text-[var(--c-danger)]">· sığmadı</span>}
                  </div>
                </li>
              ))}
            </ul>
            {previews.some((p) => p.tasma) && <p className="mt-2 text-xs text-[var(--c-danger)]">“sığmadı” işaretli slaytta metin en küçük puntoda bile sığmıyor — kısaltın.</p>}
            {dirty && <p className="mt-2 text-xs text-[var(--c-ink-3)]">Önizleme ekrandaki güncel metne aittir; onaylamak için önce kaydedin.</p>}
          </>
        )}
      </AuraPanel>

      {zoom && (
        <div role="dialog" aria-modal="true" aria-label="Slayt önizlemesi" tabIndex={-1} ref={(el) => el?.focus()} onKeyDown={(e) => e.key === "Escape" && setZoom(null)} onClick={() => setZoom(null)} className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 outline-none">
          <button type="button" onClick={() => setZoom(null)} aria-label="Kapat" className="absolute right-4 top-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80">
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- base64 PNG önizlemesi (yerel veri) */}
          <img src={`data:image/png;base64,${zoom.png}`} alt={`Slayt ${zoom.index + 1}: ${SLIDE_ROLE_LABEL[zoom.role]}`} className="max-h-[92vh] max-w-full rounded-lg shadow-2xl" />
        </div>
      )}

      {/* ── Eylem çubuğu ──────────────────────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-10 -mx-5 border-t border-[var(--c-hairline)] bg-[var(--c-bg)]/95 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--c-ink-3)]">
            {STATUS_LABEL[item.status]}
            {dirty && <span className="ml-2 text-[var(--c-warn,#d97706)]">· kaydedilmemiş değişiklik</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {item.status === "SKIPPED" && (
              <button type="button" onClick={restore} disabled={busy !== ""} className={BTN_SECOND}>
                {busy === "restore" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Geri al
              </button>
            )}
            {(item.status === "PLANNED" || item.status === "DRAFT" || item.status === "APPROVED" || item.status === "FAILED") && (
              <button type="button" onClick={skip} disabled={busy !== ""} className={BTN_SECOND}>
                {busy === "skip" ? <Loader2 size={13} className="animate-spin" /> : <SkipForward size={13} />} Bu haftayı atla
              </button>
            )}
            {item.status === "APPROVED" && (
              <button type="button" onClick={unapprove} disabled={busy !== ""} className={BTN_DANGER}>
                {busy === "unapprove" ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Onayı kaldır
              </button>
            )}
            {editable && (
              <button type="button" onClick={save} disabled={busy !== "" || !dirty || (series.generator && !hasSource)} className={BTN_SECOND}>
                {busy === "save" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Taslağı kaydet
              </button>
            )}
            {item.status === "DRAFT" && (
              <button type="button" onClick={approve} disabled={busy !== "" || dirty} title={dirty ? "Önce taslağı kaydedin" : undefined} className={BTN_PRIMARY}>
                {busy === "approve" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Onayla
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
