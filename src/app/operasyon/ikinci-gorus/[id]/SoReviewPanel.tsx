"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { secondOpinionDocSpecs } from "@/data/second-opinion-docs";
import { SO_STATUS_LABELS, type SoStatus } from "@/lib/second-opinion";
import { Check, FileText, Link2, AlertTriangle, UserCheck, Loader2, ExternalLink, ClipboardList, Video, CheckCircle2 } from "lucide-react";

type Doc = { id: string; type: string; deliveryMethod: string; externalRef: string | null; label: string | null };
type Req = { id: string; type: string; description: string; status: string };
type Data = {
  id: string; status: string; branch: string; branchLabel: string; diagnosisSummary: string;
  patientName: string; createdAt: string; documents: Doc[]; requests: Req[];
  payment: { status: string; amount: number; currency: string } | null;
  appointment: { id: string; scheduledAt: string; status: string } | null;
  assignedDoctorName: string | null;
};
type Doctor = { id: string; name: string; title: string; branch: string };

const REQ_BADGE: Record<string, { label: string; cls: string }> = {
  REQUIRED: { label: "Zorunlu", cls: "bg-red-50 text-red-700 ring-red-200" },
  CONDITIONAL: { label: "Varsa", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  OPTIONAL: { label: "Opsiyonel", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

export function SoReviewPanel({ data, doctors }: { data: Data; doctors: Doctor[] }) {
  const router = useRouter();
  const status = data.status as SoStatus;
  const specs = useMemo(() => secondOpinionDocSpecs(data.branch), [data.branch]);
  const providedTypes = new Set(data.documents.map((d) => d.type));
  const missingRequired = specs.filter((s) => s.requirement === "REQUIRED" && !providedTypes.has(s.type));

  const [reqDesc, setReqDesc] = useState("");
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? "");
  const [busy, setBusy] = useState<"" | "request" | "assign">("");
  const [err, setErr] = useState("");

  const canReview = status === "PENDING_REVIEW";
  const canAssign = status === "PENDING_REVIEW" || status === "READY_FOR_ASSIGNMENT";
  const pendingReqs = data.requests.filter((r) => r.status === "PENDING");

  async function openRequest() {
    if (reqDesc.trim().length < 5) return setErr("Lütfen eksik belgeyi açıklayın.");
    setErr(""); setBusy("request");
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/request`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "MISSING_DOCUMENT", description: reqDesc }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Talep açılamadı.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata."); setBusy(""); }
  }

  async function assign() {
    if (!doctorId) return setErr("Bir doktor seçin.");
    setErr(""); setBusy("assign");
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/assign`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doctorId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Atama yapılamadı.");
      router.refresh();
    } catch (e) { setErr(e instanceof Error ? e.message : "Hata."); setBusy(""); }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#0D0E10]">{data.patientName}</h1>
        <span className="rounded-full bg-[#28C8D8]/10 px-3 py-1 text-[12px] font-semibold text-[#17919E]">{SO_STATUS_LABELS[status] ?? status}</span>
      </div>
      <p className="mt-1 text-sm text-[#1FA9B8]">{data.branchLabel} · İkinci Görüş</p>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tanı / durum özeti</div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.diagnosisSummary}</p>
        {data.payment?.status === "PAID" && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-medium text-emerald-700">
            <Check size={13} /> Ödeme alındı ({data.payment.amount} {data.payment.currency})
          </div>
        )}
      </div>

      {/* Belgeler + tamlık kontrolü */}
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Belgeler — mekanik tamlık</div>
        <p className="mt-0.5 text-xs text-slate-400">Tıbbi yeterlilik kararı sizindir; bu yalnız zorunlu tip kontrolüdür.</p>
        <ul className="mt-3 space-y-2.5">
          {specs.map((s) => {
            const items = data.documents.filter((d) => d.type === s.type);
            const has = items.length > 0;
            const badge = REQ_BADGE[s.requirement];
            return (
              <li key={s.type} className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${has ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-400"}`}>
                    {has ? <Check size={14} /> : <span className="text-[11px]">—</span>}
                  </span>
                  <span className="text-sm font-medium text-slate-700">{s.label}</span>
                  <span className={`ml-auto rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${badge.cls}`}>{badge.label}</span>
                </div>
                {items.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-8">
                    {items.map((d) => (
                      <li key={d.id}>
                        <a
                          href={`/api/second-opinion/cases/${data.id}/documents/${d.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[12.5px] text-[#17919E] underline"
                        >
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

      {/* Bekleyen talep (hasta yanıtı) */}
      {pendingReqs.map((r) => (
        <div key={r.id} className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <ClipboardList size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="text-sm font-semibold text-amber-800">Hasta yanıtı bekleniyor — {r.type === "ADDITIONAL_EXAMINATION" ? "ek tetkik" : "eksik belge"}</div>
            <p className="mt-0.5 text-[13px] text-amber-700">{r.description}</p>
          </div>
        </div>
      ))}

      {err && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {/* Talep A — eksik belge iste (yalnız inceleme aşamasında) */}
      {canReview && (
        <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">Eksik belge iste (Talep A)</div>
          <textarea
            value={reqDesc}
            onChange={(e) => setReqDesc(e.target.value)}
            rows={2}
            placeholder="Örn. Patoloji raporu eksik, lütfen biyopsi sonucunu yükleyin."
            className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-[#28C8D8] focus:outline-none"
          />
          <button
            onClick={openRequest}
            disabled={busy !== ""}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy === "request" ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Hastadan eksik belge iste
          </button>
        </div>
      )}

      {/* Doktor atama */}
      {canAssign && (
        <div className="mt-4 rounded-3xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.05] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]"><UserCheck size={17} /> Doktora ata</div>
          {missingRequired.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>Eksik zorunlu belge: {missingRequired.map((s) => s.label).join(", ")}. Yine de atayabilir veya önce eksik belge isteyebilirsiniz.</span>
            </div>
          )}
          <select
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-[#28C8D8] focus:outline-none"
          >
            {doctors.length === 0 && <option value="">Uygun doktor yok</option>}
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>{d.title} {d.name} — {d.branch}</option>
            ))}
          </select>
          <button
            onClick={assign}
            disabled={busy !== "" || !doctorId}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#28C8D8] px-6 py-3 text-[15px] font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50"
          >
            {busy === "assign" ? <Loader2 size={17} className="animate-spin" /> : <>Belgeler yeterli — doktora ata</>}
          </button>
        </div>
      )}

      {/* Atanmış / sonraki aşamalar */}
      {data.assignedDoctorName && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <UserCheck size={18} /> Atanan doktor: <strong>{data.assignedDoctorName}</strong>
        </div>
      )}

      {/* Video aşaması — doktor ↔ hasta arasında yürütülür (koordinatör Faz-4 randevudan çıktı) */}
      {(status === "OPINION_DELIVERED" || status === "VIDEO_OFFERED" || status === "VIDEO_SCHEDULED") && (
        <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          <Video size={16} className="mt-0.5 shrink-0 text-[#17919E]" />
          <span>Yazılı görüş sunuldu. Video randevusu uzman doktor ile hasta arasında planlanıp yürütülüyor.</span>
        </div>
      )}
      {(status === "VIDEO_COMPLETED" || status === "CLOSED") && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 size={18} /> Süreç tamamlandı ve kapandı.
        </div>
      )}

      {status === "AWAITING_DOCUMENTS" && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Eksik belge talebi açıldı; hasta belgeleri yükleyip gönderince vaka yeniden incelemeye düşecek.
        </div>
      )}
    </div>
  );
}
