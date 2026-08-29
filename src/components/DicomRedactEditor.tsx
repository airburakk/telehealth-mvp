"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Eraser, ShieldCheck, AlertTriangle, ChevronLeft, ChevronRight, Undo2 } from "lucide-react";
import { AuraButton } from "@/components/ui/AuraButton";

// Burned-in PHI redaksiyon editörü (v6.37) — havuza gidecek DICOM kopyasındaki, görüntünün İÇİNE
// işlenmiş hasta bilgilerini kapatmak için. Görüntü ÇÖZME ve MASKELEME sunucudadır; bu bileşen
// yalnız (a) sunucudan gelen PNG önizlemeyi gösterir, (b) kullanıcının çizdiği kutuları toplar.
// Kutular normalize (0..1) koordinattır → önizleme küçültme oranından bağımsız.
//
// ⚠️ Otomatik kutular (autoRects) BURADA SİLİNEMEZ: sunucu onları kayıt anında zaten uygular;
// istemcide silinebilir göstermek yanıltıcı olurdu.
// ⚠️ Önizleme PHI içerir → ekran görüntüsü/log/analytics'e verilmez, DOM'da kalıcı saklanmaz.

export interface RedactRect { x: number; y: number; w: number; h: number }

interface PreviewData {
  png: string;
  width: number;
  height: number;
  frames: number;
  modality: string;
  autoRects: RedactRect[];
  notes: string[];
  declaredBurnedIn: boolean;
  highRisk: boolean;
}

export type RedactSource = { dataUrl: string } | { caseId: string; docId: string };

export function DicomRedactEditor({
  open,
  onClose,
  source,
  label,
  rects,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  source: RedactSource | null;
  label: string;
  rects: RedactRect[];
  onChange: (next: RedactRect[]) => void;
}) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [frame, setFrame] = useState(0);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (fr: number) => {
      if (!source) return;
      setLoading(true);
      setErr("");
      try {
        const r = await fetch("/api/dicom/redact-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...source, frame: fr }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Önizleme alınamadı.");
        setData(d as PreviewData);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Önizleme alınamadı.");
        setData(null);
      }
      setLoading(false);
    },
    [source],
  );

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- durum geçişinde bir kez; `open` koşulu yeniden tetiklenmeyi keser.
      setFrame(0);
      load(0);
    } else {
      setData(null);
      setErr("");
    }
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // ── Kutu çizimi (fare + dokunma; pointer events) ──
  function relPoint(e: React.PointerEvent): { x: number; y: number } | null {
    const el = boxRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return {
      x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    const p = relPoint(e);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = relPoint(e);
    if (!p) return;
    setDrag({ ...drag, x1: p.x, y1: p.y });
  }
  function onPointerUp() {
    if (!drag) return;
    const x = Math.min(drag.x0, drag.x1);
    const y = Math.min(drag.y0, drag.y1);
    const w = Math.abs(drag.x1 - drag.x0);
    const h = Math.abs(drag.y1 - drag.y0);
    setDrag(null);
    if (w < 0.01 || h < 0.01) return; // kaza tıklaması — kutu sayılmaz
    onChange([...rects, { x, y, w, h }]);
  }

  if (!open) return null;
  const live = drag
    ? {
        x: Math.min(drag.x0, drag.x1),
        y: Math.min(drag.y0, drag.y1),
        w: Math.abs(drag.x1 - drag.x0),
        h: Math.abs(drag.y1 - drag.y0),
      }
    : null;

  const body = (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Görüntü üzerindeki yazıları gizleme">
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--c-hairline)] px-5 py-3.5">
          <div className="min-w-0">
            <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-3)]">Görüntü üzerindeki yazılar</div>
            <div className="truncate text-sm font-semibold text-[var(--c-ink)]">{label}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" className="shrink-0 rounded-lg p-1.5 text-[var(--c-ink-3)] hover:bg-[var(--c-surface)] hover:text-[var(--c-ink)]">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs leading-relaxed text-[var(--c-ink-2)]">
            Görüntünün içine yazılmış hasta adı, tarih veya numara görüyorsanız üzerine <strong className="font-semibold text-[var(--c-ink)]">fareyle sürükleyerek</strong> kutu
            çizin. Çizdiğiniz alanlar gönderim sırasında kalıcı olarak karartılır — <strong className="font-semibold text-[var(--c-ink)]">tüm kareler</strong> için geçerlidir.
            Vakadaki asıl dosyanız değişmez.
          </p>

          {loading && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--c-ink-2)]">
              <Loader2 size={15} className="animate-spin" /> Görüntü hazırlanıyor…
            </p>
          )}
          {err && !loading && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-xs text-[var(--c-ink-2)]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-400" />
              <span>{err} Dosyayı yine de gönderebilirsiniz; bu durumda görüntünün içindeki yazıları kendiniz kontrol etmiş olmanız gerekir.</span>
            </div>
          )}

          {data && !loading && (
            <>
              <div
                ref={boxRef}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => setDrag(null)}
                className="relative mx-auto mt-4 w-fit max-w-full cursor-crosshair touch-none select-none overflow-hidden rounded-xl border border-[var(--c-hairline)] bg-black"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URL önizleme (PHI; optimize edilmez, ağa çıkmaz) */}
                <img src={data.png} alt="" draggable={false} className="block max-h-[52vh] w-auto max-w-full" />
                {data.autoRects.map((r, i) => (
                  <div
                    key={`a${i}`}
                    className="pointer-events-none absolute bg-black"
                    style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                  >
                    <span className="absolute inset-0 border border-emerald-400/50" />
                  </div>
                ))}
                {rects.map((r, i) => (
                  <div
                    key={`u${i}`}
                    className="absolute bg-black"
                    style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
                  >
                    <span className="absolute inset-0 border border-[var(--c-accent)]/70" />
                    <button
                      type="button"
                      aria-label={`${i + 1}. kutuyu kaldır`}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onChange(rects.filter((_, j) => j !== i))}
                      className="absolute -right-1 -top-1 rounded-full bg-[var(--c-accent)] p-0.5 text-[var(--c-bg)] shadow"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
                {live && (
                  <div
                    className="pointer-events-none absolute border-2 border-dashed border-[var(--c-accent)] bg-black/60"
                    style={{ left: `${live.x * 100}%`, top: `${live.y * 100}%`, width: `${live.w * 100}%`, height: `${live.h * 100}%` }}
                  />
                )}
              </div>

              {data.frames > 1 && (
                <div className="mt-3 flex items-center justify-center gap-3 text-xs text-[var(--c-ink-2)]">
                  <button
                    type="button"
                    disabled={frame === 0}
                    onClick={() => { const f = frame - 1; setFrame(f); load(f); }}
                    className="rounded-lg border border-[var(--c-hairline)] p-1.5 disabled:opacity-40"
                    aria-label="Önceki kesit"
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="aura-mono">Kesit {frame + 1} / {data.frames}</span>
                  <button
                    type="button"
                    disabled={frame >= data.frames - 1}
                    onClick={() => { const f = frame + 1; setFrame(f); load(f); }}
                    className="rounded-lg border border-[var(--c-hairline)] p-1.5 disabled:opacity-40"
                    aria-label="Sonraki kesit"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {(data.notes.length > 0 || data.highRisk) && (
                <ul className="mt-3 space-y-1.5">
                  {data.autoRects.length > 0 && (
                    <li className="flex items-start gap-2 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-[11px] leading-relaxed text-[var(--c-ink-2)]">
                      <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
                      <span>Yeşil çerçeveli alanlar sistem tarafından otomatik kapatılır (kaldırılamaz).</span>
                    </li>
                  )}
                  {data.notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-2 px-1 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--c-ink-3)]" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--c-hairline)] px-5 py-3">
          <div className="flex items-center gap-2">
            <AuraButton variant="ghost" size="sm" onClick={() => onChange(rects.slice(0, -1))} disabled={!rects.length}>
              <Undo2 size={13} /> Geri al
            </AuraButton>
            <AuraButton variant="ghost" size="sm" onClick={() => onChange([])} disabled={!rects.length}>
              <Eraser size={13} /> Tümünü temizle
            </AuraButton>
          </div>
          <div className="flex items-center gap-3">
            <span className="aura-mono text-[11px] text-[var(--c-ink-3)]">{rects.length} kutu</span>
            <AuraButton size="sm" onClick={onClose}>Tamam</AuraButton>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(body, document.body) : null;
}
