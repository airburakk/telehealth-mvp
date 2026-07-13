"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { severityMeta, postopChecklist, type Severity } from "@/lib/postop";
import { useT } from "@/components/useT";
import { Thermometer, Activity, Pill, Camera, Loader2, Send, AlertTriangle, CheckCircle2, X, ListChecks } from "lucide-react";

// İyileşme fotoğrafını tarayıcıda küçültüp JPEG data-URL'e çevirir (S3 yok; AI vision'a + DB'ye uygun, hafif boyut).
// max kenar 720px · q0.75 ≈ 60-120KB. Başarısızlıkta akışı bozma (fotoğraf atlanır).
async function downscaleImage(file: File, max = 720, quality = 0.75): Promise<string> {
  const src = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("read"));
    fr.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("decode"));
    im.src = src;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const cx = canvas.getContext("2d");
  if (!cx) return src;
  cx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

// Çevrilen statik metinler (TR kanonik). lang prop RecoveryView'dan gelir → dil seçici tek kaynak.
const UI = [
  "Bugünkü kontrol", "Durumunuzu paylaşın; ekibiniz uzaktan izliyor.",
  "Ağrı düzeyi", "Ateş (°C)", "İlaçlarımı aldım", "günlük kontrol",
  "Belirti / not", "Örn. Yara bölgesinde hafif kızarıklık var…",
  "Fotoğraf eklendi", "Gönderince AI görsel ön-değerlendirme yapar.",
  "Fotoğraf hazırlanıyor…", "İyileşme fotoğrafı ekle (opsiyonel)", "İyileşme fotoğrafı",
  "Kontrolü gönder",
  "İyileşme normal", "İzleme alındı", "Acil: ekip bilgilendirildi",
  "Doktorunuz ve vaka koordinatörünüze acil bildirim gönderildi. Lütfen telefonunuzu açık tutun.",
];

export function CheckInForm({ caseId, branch, lang = "Türkçe" }: { caseId: string; branch: string; lang?: string }) {
  const router = useRouter();
  const items = useMemo(() => postopChecklist(branch), [branch]);
  const [pain, setPain] = useState(2);
  const [feverC, setFeverC] = useState(36.6);
  const [meds, setMeds] = useState(true);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string>("");
  const [preparing, setPreparing] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ severity: Severity; reasons: string[] } | null>(null);

  // Çeviri listesi: statik UI + branş + checklist (label + seçenek değerleri) + (geldiğinde) AI gerekçeleri.
  const texts = useMemo(
    () => [...UI, branch, ...items.flatMap((it) => [it.label, ...it.options.map((o) => o.v)]), ...(result?.reasons ?? [])],
    [branch, items, result],
  );
  const { t } = useT(lang, texts);

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // aynı dosya tekrar seçilebilsin
    if (!f) return;
    setPreparing(true);
    try {
      setPhoto(await downscaleImage(f));
    } catch {
      // küçültme başarısız → fotoğrafı atla; check-in fotoğrafsız devam eder
    } finally {
      setPreparing(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/checkin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pain, feverC, meds, note, photo, checklist }),
      });
      const data = await res.json();
      setResult({ severity: data.severity, reasons: data.reasons });
      setNote(""); setPhoto(""); setChecklist({});
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const m = result ? severityMeta(result.severity) : null;

  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
      <h2 className="font-bold text-[var(--c-ink)]">{t("Bugünkü kontrol")}</h2>
      <p className="text-sm text-[var(--c-ink-2)]">{t("Durumunuzu paylaşın; ekibiniz uzaktan izliyor.")}</p>

      {/* Ağrı */}
      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--c-ink)]"><Activity size={15} /> {t("Ağrı düzeyi")}</span>
          <span className="font-semibold text-[var(--c-ink)]">{pain}/10</span>
        </div>
        <input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="mt-2 w-full accent-[var(--c-accent)]" />
      </div>

      {/* Ateş */}
      <div className="mt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--c-ink)]"><Thermometer size={15} /> {t("Ateş (°C)")}</span>
        <input
          type="number" step="0.1" min={34} max={43} value={feverC}
          onChange={(e) => setFeverC(Number(e.target.value))}
          className="mt-1.5 w-full rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm outline-none focus:border-[var(--c-accent)]"
        />
      </div>

      {/* İlaç */}
      <button onClick={() => setMeds((v) => !v)} className="mt-4 flex w-full items-center justify-between rounded-lg border border-[var(--c-hairline)] px-3 py-2.5 text-start hover:border-[var(--c-hairline)]">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--c-ink)]"><Pill size={16} className="text-[var(--c-ink-2)]" /> {t("İlaçlarımı aldım")}</span>
        <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${meds ? "bg-emerald-500" : "bg-[var(--c-ink)]/20"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--c-panel)] shadow transition-all ${meds ? "start-[22px]" : "start-0.5"}`} />
        </span>
      </button>

      {/* Branşa özel günlük kontrol */}
      {items.length > 0 && (
        <div className="mt-4 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">
            <ListChecks size={14} /> {t(branch)} · {t("günlük kontrol")}
          </div>
          <div className="mt-2.5 space-y-2.5">
            {items.map((it) => (
              <div key={it.id}>
                <div className="text-sm text-[var(--c-ink)]">{t(it.label)}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {it.options.map((o) => {
                    const active = checklist[it.id] === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setChecklist((p) => ({ ...p, [it.id]: active ? "" : o.v }))}
                        className={`rounded-full border px-2.5 py-1 text-xs transition ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-white/65 hover:border-[var(--c-accent)]/40"}`}
                      >
                        {t(o.v)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not */}
      <div className="mt-4">
        <span className="text-sm font-medium text-[var(--c-ink)]">{t("Belirti / not")}</span>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={3}
          placeholder={t("Örn. Yara bölgesinde hafif kızarıklık var…")}
          className="mt-1.5 w-full resize-none rounded-lg border border-[var(--c-hairline)] p-2.5 text-sm outline-none focus:border-[var(--c-accent)]"
        />
      </div>

      {/* Foto — küçültülüp AI görsel ön-değerlendirmesine gönderilir */}
      {photo ? (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] p-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt={t("İyileşme fotoğrafı")} className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-white/10" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-[var(--c-ink)]">{t("Fotoğraf eklendi")}</div>
            <div className="text-xs text-[var(--c-ink-3)]">{t("Gönderince AI görsel ön-değerlendirme yapar.")}</div>
          </div>
          <button type="button" onClick={() => setPhoto("")} className="rounded-md p-1.5 text-[var(--c-ink-3)] hover:bg-[var(--c-ink)]/15 hover:text-[var(--c-ink-2)]">
            <X size={16} />
          </button>
        </div>
      ) : (
        <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2.5 text-sm text-[var(--c-ink-2)] hover:border-teal-400">
          {preparing ? <Loader2 size={16} className="animate-spin text-[var(--c-ink-3)]" /> : <Camera size={16} className="text-[var(--c-ink-3)]" />}
          {preparing ? t("Fotoğraf hazırlanıyor…") : t("İyileşme fotoğrafı ekle (opsiyonel)")}
          <input type="file" accept="image/*" className="hidden" disabled={preparing} onChange={onPickPhoto} />
        </label>
      )}

      <button onClick={submit} disabled={submitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {t("Kontrolü gönder")}
      </button>

      {/* Sonuç */}
      {result && m && (
        <div className={`mt-4 rounded-2xl p-4 ring-1 ${m.badge}`}>
          <div className="flex items-center gap-2 font-semibold">
            {result.severity === "RED" ? <AlertTriangle size={18} /> : result.severity === "WATCH" ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
            {result.severity === "NONE" ? t("İyileşme normal") : result.severity === "WATCH" ? t("İzleme alındı") : t("Acil: ekip bilgilendirildi")}
          </div>
          <ul className="mt-1.5 list-disc ps-5 text-sm">
            {result.reasons.map((r, i) => <li key={i}>{t(r)}</li>)}
          </ul>
          {result.severity === "RED" && (
            <p className="mt-2 text-sm font-medium">{t("Doktorunuz ve vaka koordinatörünüze acil bildirim gönderildi. Lütfen telefonunuzu açık tutun.")}</p>
          )}
        </div>
      )}
    </div>
  );
}
