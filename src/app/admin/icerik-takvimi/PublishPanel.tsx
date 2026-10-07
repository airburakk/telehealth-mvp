"use client";

import { useState } from "react";
import { AlertTriangle, CheckCheck, Copy, Download, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { AuraPanel } from "@/components/ui/AuraPanel";
import type { PlanItemView } from "@/lib/social-calendar/plan";
import { CHANNEL_LABEL, PUBLISH_CHANNELS, buildCaptionText, slideFileName, zipFileName, type PublishChannel } from "@/lib/social-calendar/publication";
import type { SeriesDef } from "@/lib/social-calendar/series";
import { base64ToBytes, createZip } from "@/lib/zip-store";
import { BTN_PRIMARY, BTN_SECOND, INPUT, api, fmt, type ApiResult, type Flash } from "./client-shared";

// İçerik takvimi "Yayın" paneli (v6.332, 2026-10-06; Faz 2-A). Otomatik yayın hattı (n8n) henüz yok → onaylı içerik ELLE paylaşılır:
//   • "PNG'leri indir (ZIP)": KAYITLI (onaylı) içerik kart servisinde çizilir (payload GÖNDERİLMEZ → onay mührüyle aynı içerik), tarayıcıda
//     bağımsız ZIP'e (lib/zip-store) paketlenir: 01-kapak.png … + altyazi.txt. • "Altyazıyı + etiketleri kopyala": panoya.
//   • "Elle yayınlandı olarak işaretle": kanal(lar) + isteğe bağlı gönderi bağlantısı → PUBLISHED (TERMİNAL: içerik kilitlenir, geri alınamaz).
// FAILED (yalnız otomasyon üretir) → hata notu + "Yeniden dene". Yazmalar SlotEditor.run'dan geçer (sürüm/çakışma/hata bayrağı orada yönetilir).
interface Props {
  item: PlanItemView;
  series: SeriesDef;
  /** Ekranda kaydedilmemiş düzenleme var (indirme/kopyalama KAYITLI içeriği alır). */
  dirty: boolean;
  /** SlotEditor'da başka bir işlem sürüyor. */
  busy: string;
  run: (label: string, body: Record<string, unknown>, onOk: (r: ApiResult) => void) => Promise<void>;
  adopt: (it: PlanItemView) => void;
  notify: (f: Flash) => void;
}

const STATUS_META = { APPROVED: "otomatik hat yok — elle paylaşım", FAILED: "yayın hatası", PUBLISHED: "yayınlandı" } as const;

/** Bağlantı yalnız https:// ise bağlanır (sunucu zaten doğrular; bileşen İKİNCİ kilit — javascript:/data: asla href olmaz). */
const safeHref = (u?: string): string | undefined => (u && /^https:\/\//i.test(u) ? u : undefined);

export function PublishPanel({ item, series, dirty, busy, run, adopt, notify }: Props) {
  const [work, setWork] = useState<"" | "zip">("");
  const [marking, setMarking] = useState(false);
  /** Seçili kanal → bağlantı metni (anahtar varsa kanal seçili). */
  const [sel, setSel] = useState<Partial<Record<PublishChannel, string>>>({});

  if (item.status !== "APPROVED" && item.status !== "FAILED" && item.status !== "PUBLISHED") return null;
  const status = item.status;
  const sealBroken = status === "APPROVED" && !item.approvedIntact;
  const canHelp = !!item.payload && !sealBroken;
  const disabled = busy !== "" || work !== "";

  async function downloadZip() {
    if (!item.payload) return;
    setWork("zip");
    notify(null);
    // payload GÖNDERİLMEZ → sunucu KAYITLI (onaylı) içeriği çizer; ekrandaki kaydedilmemiş düzenleme pakete girmez
    const r = await api({ action: "preview", id: item.id });
    if (!r.ok || !r.slides || r.slides.length === 0) {
      setWork("");
      notify({ kind: "err", text: r.error ?? "Slaytlar çizilemedi." });
      return;
    }
    try {
      const name = zipFileName(series.key, item.slotDay);
      const bytes = createZip([
        ...r.slides.map((s) => ({ name: slideFileName(s.index, s.role), data: base64ToBytes(s.png) })),
        { name: "altyazi.txt", data: new TextEncoder().encode(buildCaptionText(item.payload)) },
      ]);
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      notify({ kind: "ok", text: `${r.slides.length} PNG + altyazı indirildi (${name}).` });
    } catch {
      notify({ kind: "err", text: "İndirme paketi hazırlanamadı." });
    } finally {
      setWork("");
    }
  }

  async function copyCaption() {
    if (!item.payload) return;
    const text = buildCaptionText(item.payload);
    if (!text) {
      notify({ kind: "err", text: "Altyazı boş — önce altyazıyı yazıp kaydedin." });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify({ kind: "ok", text: "Altyazı ve etiketler panoya kopyalandı." });
    } catch {
      notify({ kind: "err", text: "Panoya kopyalanamadı — “Altyazı ve künye” bölümündeki metni elle kopyalayın." });
    }
  }

  function toggle(c: PublishChannel, on: boolean) {
    setSel((s) => {
      const next = { ...s };
      if (on) next[c] = next[c] ?? "";
      else delete next[c];
      return next;
    });
  }

  function markPublished() {
    const channels = PUBLISH_CHANNELS.filter((c) => sel[c] !== undefined).map((c) => {
      const url = (sel[c] ?? "").trim();
      return url ? { channel: c, url } : { channel: c };
    });
    if (channels.length === 0) {
      notify({ kind: "err", text: "En az bir kanal seçin." });
      return;
    }
    const labels = channels.map((c) => CHANNEL_LABEL[c.channel]).join(", ");
    if (!window.confirm(`İçerik ${labels} için yayınlandı olarak işaretlenecek ve KİLİTLENECEK: değiştirilemez, geri alınamaz. Devam edilsin mi?`)) return;
    void run("publish", { action: "publish", channels }, (r) => {
      if (r.item) adopt(r.item);
      setMarking(false);
      notify({ kind: "ok", text: "Yayınlandı olarak işaretlendi — içerik kilitlendi." });
    });
  }

  const retry = () =>
    run("retry", { action: "retry" }, (r) => {
      if (r.item) adopt(r.item);
      notify({ kind: "ok", text: "Yayın yeniden denemeye alındı — içerik yine onaylı." });
    });

  const pub = item.publication;
  return (
    <AuraPanel title="Yayın" meta={STATUS_META[status]}>
      {sealBroken && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--c-danger)]">
          <AlertTriangle size={14} /> İçerik onay mührüyle eşleşmiyor — indirme ve işaretleme kapalı. Yeniden onaylayın.
        </p>
      )}

      {status === "APPROVED" && !sealBroken && (
        <p className="text-sm text-[var(--c-ink-2)]">
          Otomatik yayın hattı henüz kurulu değil: onaylı içeriği <strong>elle paylaşın</strong> — PNG’leri indirin, altyazıyı kopyalayın, paylaştıktan sonra aşağıdan işaretleyin. Yayınlandı olarak işaretlenen içerik kilitlenir.
        </p>
      )}

      {status === "FAILED" && (
        <div className="flex items-start gap-1.5 text-sm text-[var(--c-danger)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p>Yayın denemesi başarısız.</p>
            {pub?.error && <p className="aura-mono mt-0.5 break-words text-xs">{pub.error}</p>}
            <p className="mt-1 text-[var(--c-ink-2)]">İçerik onaylı kaldı; elle paylaşabilir ya da yeniden deneyebilirsiniz.</p>
          </div>
        </div>
      )}

      {status === "PUBLISHED" && (
        <div className="text-sm text-[var(--c-ink)]">
          <p>
            <span className="font-semibold">{pub?.manual === false ? "Otomatik yayınlandı" : "Elle yayınlandı"}</span>
            {pub?.by ? ` — ${pub.by}` : ""}
            {item.publishedAt ? ` · ${fmt(item.publishedAt)}` : ""}
            {" "}· içerik kilitli.
          </p>
          {pub && pub.channels.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {pub.channels.map((c) => (
                <li key={c.channel} className="rounded-full border border-[var(--c-hairline)] px-3 py-1 text-xs text-[var(--c-ink-2)]">
                  {safeHref(c.url) ? (
                    <a href={safeHref(c.url)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[var(--c-accent)] hover:underline">
                      {CHANNEL_LABEL[c.channel]} <ExternalLink size={11} />
                    </a>
                  ) : (
                    CHANNEL_LABEL[c.channel]
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {canHelp && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={downloadZip} disabled={disabled} className={BTN_SECOND}>
            {work === "zip" ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} PNG’leri indir (ZIP)
          </button>
          <button type="button" onClick={copyCaption} disabled={disabled} className={BTN_SECOND}>
            <Copy size={13} /> Altyazıyı + etiketleri kopyala
          </button>
        </div>
      )}
      {work === "zip" && <p className="mt-2 text-xs text-[var(--c-ink-3)]">Slaytlar çiziliyor ve paketleniyor — birkaç saniye sürer…</p>}
      {canHelp && dirty && <p className="mt-2 text-xs text-[var(--c-ink-3)]">İndirilen ve kopyalanan içerik KAYITLI hâldir; ekrandaki kaydedilmemiş değişiklik dâhil değildir.</p>}

      {status === "APPROVED" && !sealBroken && (
        <div className="mt-4 border-t border-[var(--c-hairline)] pt-4">
          {!marking ? (
            <button type="button" onClick={() => setMarking(true)} disabled={disabled} className={BTN_SECOND}>
              <CheckCheck size={13} /> Elle yayınlandı olarak işaretle…
            </button>
          ) : (
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-[var(--c-ink)]">Hangi kanallara paylaştınız?</legend>
              <ul className="space-y-2">
                {PUBLISH_CHANNELS.map((c) => {
                  const on = sel[c] !== undefined;
                  return (
                    <li key={c} className="grid gap-2 sm:grid-cols-[10rem_1fr] sm:items-center">
                      <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--c-ink)]">
                        <input type="checkbox" checked={on} onChange={(e) => toggle(c, e.target.checked)} className="h-4 w-4 accent-[var(--c-accent)]" />
                        {CHANNEL_LABEL[c]}
                      </label>
                      {on && (
                        <input
                          type="url"
                          inputMode="url"
                          aria-label={`${CHANNEL_LABEL[c]} gönderi bağlantısı (isteğe bağlı)`}
                          value={sel[c] ?? ""}
                          onChange={(e) => setSel((s) => ({ ...s, [c]: e.target.value }))}
                          maxLength={300}
                          placeholder="https://… (isteğe bağlı gönderi bağlantısı)"
                          className={INPUT}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-[var(--c-ink-3)]">Bu işlem geri alınamaz: yayınlandı olarak işaretlenen içerik değiştirilemez. Bağlantı yalnız https:// ile başlayabilir.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={markPublished} disabled={disabled} className={BTN_PRIMARY}>
                  {busy === "publish" ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />} Yayınlandı olarak kaydet
                </button>
                <button type="button" onClick={() => setMarking(false)} disabled={disabled} className={BTN_SECOND}>
                  Vazgeç
                </button>
              </div>
            </fieldset>
          )}
        </div>
      )}

      {status === "FAILED" && (
        <div className="mt-4 border-t border-[var(--c-hairline)] pt-4">
          <button type="button" onClick={retry} disabled={disabled} className={BTN_PRIMARY}>
            {busy === "retry" ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />} Yeniden dene
          </button>
        </div>
      )}
    </AuraPanel>
  );
}
