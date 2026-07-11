"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { secondOpinionDocSpecs } from "@/data/second-opinion-docs";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import Link from "next/link";
import { Check, FileText, Link2, ExternalLink, FlaskConical, Loader2, ClipboardList, NotebookPen, Video, CheckCircle2, CalendarClock, RefreshCw, Clock } from "lucide-react";

type Doc = { id: string; type: string; deliveryMethod: string; externalRef: string | null; label: string | null };
type Req = { id: string; type: string; description: string; status: string };
type Data = {
  id: string; status: string; branch: string; branchLabel: string; diagnosisSummary: string; patientName: string;
  documents: Doc[]; requests: Req[];
  opinion: { content: string; structured: string | null; submittedAt: string } | null;
  appointment: { id: string; scheduledAt: string; status: string } | null;
};

const SECTIONS = [
  { key: "findings", label: "İncelenen belgeler ve bulgular", ph: "Yüklenen belgeler, görüntüleme ve laboratuvar bulgularının özeti…" },
  { key: "assessment", label: "Değerlendirme", ph: "Mevcut tanı ve önerilen tedavinin değerlendirmesi…" },
  { key: "opinion", label: "İkinci görüş / kanaat", ph: "Bağımsız ikinci görüşünüz…" },
  { key: "recommendations", label: "Öneriler", ph: "Hastaya öneriler, ek adımlar…" },
] as const;

export function SoOpinionPanel({ data }: { data: Data }) {
  const router = useRouter();
  const status = data.status as SoStatus;
  const specs = useMemo(() => secondOpinionDocSpecs(data.branch), [data.branch]);

  const [fields, setFields] = useState<Record<string, string>>({ findings: "", assessment: "", opinion: "", recommendations: "" });
  const [testDesc, setTestDesc] = useState("");
  const [offerAt, setOfferAt] = useState("");
  const [busy, setBusy] = useState<"" | "opinion" | "test" | "complete" | "offer">("");
  const [err, setErr] = useState("");

  async function completeVideo() {
    setErr(""); setBusy("complete");
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/complete-video`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Tamamlanamadı.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata."); setBusy(""); }
  }

  // Faz 4 (İcapçı deseni): raporu yazan hoca video randevu zamanı TEKLİF eder → hasta onaylar/değişiklik ister.
  async function offerVideo() {
    if (!offerAt) return setErr("Tarih/saat seçin.");
    setErr(""); setBusy("offer");
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/offer-video`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(offerAt).toISOString() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Teklif gönderilemedi.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata."); setBusy(""); }
  }

  const changeRequested = data.appointment?.status === "CHANGE_REQUESTED";

  const pendingReqs = data.requests.filter((r) => r.status === "PENDING");
  const canWork = status === "ASSIGNED";

  function buildContent(): string {
    return SECTIONS.filter((s) => fields[s.key].trim())
      .map((s) => `${s.label.toLocaleUpperCase("tr-TR")}\n${fields[s.key].trim()}`)
      .join("\n\n");
  }

  async function submitOpinion() {
    const content = buildContent();
    if (fields.opinion.trim().length < 20) return setErr("Lütfen 'İkinci görüş / kanaat' bölümünü doldurun (en az 20 karakter).");
    setErr(""); setBusy("opinion");
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/opinion`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, structured: fields }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Görüş kaydedilemedi.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata."); setBusy(""); }
  }

  async function requestTest() {
    if (testDesc.trim().length < 5) return setErr("Lütfen istenen tetkiki açıklayın.");
    setErr(""); setBusy("test");
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/request`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ADDITIONAL_EXAMINATION", description: testDesc }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Talep açılamadı.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata."); setBusy(""); }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#F4F5F3]">{data.patientName}</h1>
        <span className="rounded-full bg-[#28C8D8]/10 px-3 py-1 text-[12px] font-semibold text-[#17919E]">{SO_STATUS_LABELS[status] ?? status}</span>
      </div>
      <p className="mt-1 text-sm text-[#1FA9B8]">{data.branchLabel} · İkinci Görüş</p>

      <div className="mt-4 rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/40">Tanı / durum özeti</div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{data.diagnosisSummary}</p>
      </div>

      {/* Belgeler */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
        <div className="text-sm font-semibold text-white/75">Hasta belgeleri</div>
        <ul className="mt-3 space-y-2.5">
          {specs.map((s) => {
            const items = data.documents.filter((d) => d.type === s.type);
            const has = items.length > 0;
            return (
              <li key={s.type} className="rounded-2xl border border-white/10 bg-[#1E1F22]/60 p-3">
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${has ? "bg-emerald-500/15 text-emerald-300" : "bg-white/15 text-white/40"}`}>
                    {has ? <Check size={14} /> : <span className="text-[11px]">—</span>}
                  </span>
                  <span className="text-sm font-medium text-white/75">{s.label}</span>
                </div>
                {items.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-8">
                    {items.map((d) => (
                      <li key={d.id}>
                        <a href={`/api/second-opinion/cases/${data.id}/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] text-[#17919E] underline">
                          {d.deliveryMethod === "EXTERNAL_LINK" ? <Link2 size={12} /> : <FileText size={12} />}
                          {d.label || (d.deliveryMethod === "EXTERNAL_LINK" ? "Bağlantı" : "Dosya")}
                          <ExternalLink size={11} />
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {pendingReqs.map((r) => (
        <div key={r.id} className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
          <ClipboardList size={18} className="mt-0.5 shrink-0 text-amber-300" />
          <div>
            <div className="text-sm font-semibold text-amber-200">Hastadan {r.type === "ADDITIONAL_EXAMINATION" ? "ek tetkik" : "belge"} bekleniyor</div>
            <p className="mt-0.5 text-[13px] text-amber-300">{r.description}</p>
          </div>
        </div>
      ))}

      {err && <p className="mt-4 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}

      {/* Teslim edilmiş görüş (read-only) */}
      {data.opinion && (
        <div className="mt-4 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><NotebookPen size={16} /> Sunulan yazılı görüş</div>
            <span className="text-xs text-emerald-300">{new Date(data.opinion.submittedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/75">{data.opinion.content}</pre>
        </div>
      )}

      {/* Faz 4 — video randevu teklifi (raporu yazan hoca; İcapçı deseni) */}
      {status === "OPINION_DELIVERED" && (
        <div className="mt-4 rounded-3xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.05] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]"><CalendarClock size={17} /> Video randevu teklif et</div>
          {changeRequested ? (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-amber-300">
              <RefreshCw size={15} className="mt-0.5 shrink-0" />
              <span>Hasta önerdiğiniz zamanı uygun bulmadı — lütfen farklı bir zaman önerin.</span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-white/50">Yazılı görüş sunuldu; raporun tesliminden itibaren 15 gün içinde bir görüşme zamanı önerin. Hasta onaylayınca randevu kesinleşir.</p>
          )}
          <input type="datetime-local" value={offerAt} onChange={(e) => setOfferAt(e.target.value)} className="mt-3 w-full rounded-xl border border-white/15 px-3 py-2.5 text-sm focus:border-[#28C8D8] focus:outline-none" />
          <button onClick={offerVideo} disabled={busy !== ""} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#28C8D8] px-6 py-3 text-[15px] font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50">
            {busy === "offer" ? <Loader2 size={17} className="animate-spin" /> : <>Randevu zamanını hastaya öner</>}
          </button>
        </div>
      )}

      {/* Teklif gönderildi — hasta onayı bekleniyor */}
      {status === "VIDEO_OFFERED" && data.appointment && (
        <div className="mt-4 rounded-3xl border border-amber-400/25 bg-amber-500/10 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-200"><Clock size={17} /> Randevu teklifiniz hastaya iletildi</div>
          <p className="mt-1.5 text-lg font-bold text-[#F4F5F3]">{new Date(data.appointment.scheduledAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}</p>
          <p className="mt-1 text-xs text-amber-300">Hasta bu zamanı onayladığında randevu kesinleşir; farklı bir zaman isterse yeniden öneri yapabilirsiniz.</p>
        </div>
      )}

      {/* Video randevusu */}
      {status === "VIDEO_SCHEDULED" && data.appointment && (
        <div className="mt-4 rounded-3xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]"><Video size={17} /> Video görüşme randevusu</div>
          <p className="mt-1.5 text-lg font-bold text-[#F4F5F3]">{new Date(data.appointment.scheduledAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={`/second-opinion/gorusme/${data.appointment.id}?role=doctor`} className="inline-flex items-center gap-2 rounded-xl bg-[#28C8D8] px-5 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
              <Video size={16} /> Görüşmeye katıl
            </Link>
            <button onClick={completeVideo} disabled={busy !== ""} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50">
              {busy === "complete" ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Görüşmeyi tamamla
            </button>
          </div>
        </div>
      )}

      {/* Talep B + görüş formu (yalnız ASSIGNED) */}
      {canWork && (
        <>
          <div className="mt-4 rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
            <div className="text-sm font-semibold text-white/75">Ek tetkik iste (Talep B)</div>
            <textarea
              value={testDesc}
              onChange={(e) => setTestDesc(e.target.value)}
              rows={2}
              placeholder="Örn. Güncel tümör belirteçleri (CA 15-3) ve toraks BT gerekli."
              className="mt-2 w-full resize-y rounded-xl border border-white/15 px-3 py-2 text-sm focus:border-[#28C8D8] focus:outline-none"
            />
            <button
              onClick={requestTest}
              disabled={busy !== ""}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"
            >
              {busy === "test" ? <Loader2 size={15} className="animate-spin" /> : <FlaskConical size={15} />} Hastadan ek tetkik iste
            </button>
          </div>

          <div className="mt-4 rounded-3xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.05] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]"><NotebookPen size={17} /> Yazılı ikinci görüş</div>
            {SECTIONS.map((s) => (
              <div key={s.key} className="mt-3">
                <label className="text-xs font-semibold text-white/65">{s.label}{s.key === "opinion" && <span className="text-red-500"> *</span>}</label>
                <textarea
                  value={fields[s.key]}
                  onChange={(e) => setFields((f) => ({ ...f, [s.key]: e.target.value }))}
                  rows={s.key === "opinion" ? 4 : 3}
                  placeholder={s.ph}
                  className="mt-1 w-full resize-y rounded-xl border border-white/15 bg-[#161719] px-3 py-2 text-sm focus:border-[#28C8D8] focus:outline-none"
                />
              </div>
            ))}
            <button
              onClick={submitOpinion}
              disabled={busy !== ""}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#28C8D8] px-6 py-3 text-[15px] font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50"
            >
              {busy === "opinion" ? <Loader2 size={17} className="animate-spin" /> : <>Görüşü hastaya sun</>}
            </button>
            <p className="mt-2 text-center text-[11px] text-white/40">Sunulduktan sonra hasta görüntüleyebilir; ardından video randevusu planlanır. (E-imza ileride.)</p>
          </div>
        </>
      )}
    </div>
  );
}
