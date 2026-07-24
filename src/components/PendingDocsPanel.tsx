"use client";

// Belge-tamamlama paneli (DOCS_PENDING, 2026-07-24, kullanıcı kararı) — vaka merkezinde,
// eksik zorunlu belgeyle oluşturulan başvurunun hasta-yüzü kartı. Hasta bekleyen kalemlerin
// HER BİRİNİ "yükledim" diye işaretler + EN AZ BİR dosya yükler → "başvuruyu ilet" aktifleşir →
// POST /api/cases/:id/pending-docs (belgeler kaydedilir, vaka NEW'e geçer, doktor bildirimi o anda).
// i18n: metinler SUNUCUDA çevrilir (tmap — ConsultGate/TourismInbox deseni; ilk boyama hasta dilinde).
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileText, ListChecks, Loader2, Send, Upload, X } from "lucide-react";
import { readDoc, type UploadDoc } from "@/lib/read-doc";

export function PendingDocsPanel({
  caseId, pendingDocs, tmap,
}: { caseId: string; pendingDocs: string[]; tmap: Record<string, string> }) {
  const router = useRouter();
  const t = (s: string) => tmap[s] ?? s;
  const [files, setFiles] = useState<UploadDoc[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const allConfirmed = useMemo(() => pendingDocs.every((d) => confirmed[d]), [pendingDocs, confirmed]);
  const hasContentFile = files.some((f) => f.dataUrl);
  const canSubmit = allConfirmed && hasContentFile && !busy;

  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    Promise.all(list.map(readDoc)).then((docs) => setFiles((prev) => [...prev, ...docs]));
  }

  async function submit() {
    if (!canSubmit) {
      setError(t("Lütfen tüm belgeleri işaretleyin ve en az bir dosya yükleyin."));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/cases/${caseId}/pending-docs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmed: pendingDocs.filter((d) => confirmed[d]),
          documents: files.filter((f) => f.dataUrl).map((f) => ({ label: f.name, mimeType: f.mime, content: f.dataUrl })),
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      router.refresh(); // server yeniden çizer → NEW banda/tracker'a döner
    } catch {
      setError(t("Belgeler gönderilemedi, lütfen tekrar deneyin."));
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5">
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" />
        <p className="text-sm font-semibold text-emerald-200">{t("Belgeleriniz alındı — başvurunuz doktor havuzuna iletildi.")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-200">
        <AlertTriangle size={16} className="shrink-0" /> {t("Belgeleriniz bekleniyor")}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-amber-200">
        {t("Başvurunuz oluşturuldu ancak henüz doktora iletilmedi. Aşağıdaki zorunlu belgeleri yükleyip işaretlediğinizde başvurunuz doktor havuzuna iletilir.")}
      </p>

      {/* Bekleyen kalemler — her biri "yükledim" işaretiyle kapanır */}
      <div className="mt-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-3.5">
        <div className="aura-mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">
          <ListChecks size={14} /> {t("Bu belgeyi yükledim")}
        </div>
        <ul className="mt-2.5 space-y-2">
          {pendingDocs.map((label) => (
            <li key={label}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!confirmed[label]}
                  onChange={(e) => setConfirmed((p) => ({ ...p, [label]: e.target.checked }))}
                  className="mt-0.5 accent-amber-600"
                />
                <span className="text-[var(--c-ink)]">{t(label)} <span className="font-semibold text-red-500">*</span></span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Dosya yükleme — triyaj adım-2 ile aynı kabul kümesi (readDoc: görüntü/PDF/DICOM) */}
      <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-6 py-8 text-center hover:border-teal-400 hover:bg-[var(--c-accent)]/10">
        <Upload size={24} className="text-[var(--c-ink-3)]" />
        <span className="text-sm font-medium text-[var(--c-ink-2)]">{t("Tıbbi belge yükleyin")}</span>
        <span className="text-xs text-[var(--c-ink-3)]">{t("PDF, JPG, DICOM · Tahlil, radyoloji, epikriz")}</span>
        <input type="file" multiple className="hidden" onChange={onFiles} accept=".pdf,.jpg,.jpeg,.png,.dcm" />
      </label>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3 py-2 text-sm">
              <span className="flex items-center gap-2 text-[var(--c-ink)]">
                <FileText size={16} className="text-[var(--c-accent)]" /> {f.name}
                {f.mime === "application/dicom" && f.dataUrl && <span className="text-[10px] text-[var(--c-ink-3)]">{t("(görüntüleyicide açılır)")}</span>}
              </span>
              <button onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-[var(--c-ink-3)] hover:text-red-500" disabled={busy}><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {error && <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 ring-1 ring-red-400/25">{error}</div>}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {t("Belgeleri gönder ve başvuruyu doktora ilet")}
      </button>
    </div>
  );
}
