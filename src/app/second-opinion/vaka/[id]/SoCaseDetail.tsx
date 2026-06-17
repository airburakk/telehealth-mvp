"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { secondOpinionDocSpecs, SO_DOC_TYPE_LABELS, type SoDocType } from "@/data/second-opinion-docs";
import { SO_STATUS_LABELS, SO_FEE_USD, type SoStatus } from "@/lib/second-opinion";
import {
  Check, AlertTriangle, CreditCard, Loader2, Link2, Upload, FileText,
  CircleCheck, Clock, FlaskConical, ArrowLeft,
} from "lucide-react";

type DocMeta = { id: string; type: string; deliveryMethod: string; externalRef: string | null; label: string | null };
type SoData = {
  id: string; status: string; branch: string; branchLabel: string; diagnosisSummary: string;
  createdAt: string; documents: DocMeta[];
  payment: { status: string; amount: number; currency: string } | null;
  requests: { id: string; type: string; description: string; status: string }[];
  hasOpinion: boolean;
  appointment: { scheduledAt: string; status: string } | null;
};

const ADDABLE = ["DRAFT", "AWAITING_DOCUMENTS", "AWAITING_ADDITIONAL_TESTS"];
const REQ_BADGE: Record<string, { label: string; cls: string }> = {
  REQUIRED: { label: "Zorunlu", cls: "bg-red-50 text-red-700 ring-red-200" },
  CONDITIONAL: { label: "Varsa", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  OPTIONAL: { label: "Opsiyonel", cls: "bg-slate-100 text-slate-500 ring-slate-200" },
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Dosya okunamadı."));
    r.readAsDataURL(file);
  });
}

export function SoCaseDetail({ data }: { data: SoData }) {
  const router = useRouter();
  const status = data.status as SoStatus;
  const canEdit = ADDABLE.includes(status);
  const isDraft = status === "DRAFT";

  const specs = useMemo(() => secondOpinionDocSpecs(data.branch), [data.branch]);
  const [docs, setDocs] = useState<DocMeta[]>(data.documents);
  const providedTypes = useMemo(() => new Set(docs.map((d) => d.type)), [docs]);
  const missingRequired = specs.filter((s) => s.requirement === "REQUIRED" && !providedTypes.has(s.type));

  // belge ekleme formu
  const [addType, setAddType] = useState<SoDocType>("EPICRISIS");
  const [method, setMethod] = useState<"FILE_UPLOAD" | "EXTERNAL_LINK">("FILE_UPLOAD");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState("");

  // ödeme
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [paid, setPaid] = useState(data.payment?.status === "PAID");

  function pickType(t: SoDocType) {
    setAddType(t);
    setMethod(specs.find((s) => s.type === t)?.defaultDelivery ?? "FILE_UPLOAD");
    setAddErr("");
  }

  async function addDoc() {
    setAddErr("");
    const payload: Record<string, unknown> = { type: addType, deliveryMethod: method, label: label.trim() || undefined };
    if (method === "EXTERNAL_LINK") {
      if (!/^https?:\/\/.+/i.test(url.trim())) return setAddErr("Geçerli bir bağlantı (http/https) girin.");
      payload.externalRef = url.trim();
    } else {
      if (!file) return setAddErr("Bir dosya seçin.");
      if (file.size > 8 * 1024 * 1024) return setAddErr("Dosya 8 MB'tan büyük — lütfen bağlantı olarak ekleyin.");
      payload.fileRef = await fileToDataUrl(file);
    }
    setAdding(true);
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Belge eklenemedi.");
      setDocs((p) => [...p, { id: d.id, type: d.type, deliveryMethod: d.deliveryMethod, externalRef: d.externalRef, label: d.label }]);
      setUrl(""); setLabel(""); setFile(null);
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : "Hata.");
    } finally {
      setAdding(false);
    }
  }

  async function pay() {
    setPayErr(""); setPaying(true);
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/pay`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Ödeme alınamadı.");
      setPaid(true);
      router.refresh();
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : "Hata.");
      setPaying(false);
    }
  }

  // talep karşılama (hasta — AWAITING_DOCUMENTS / AWAITING_ADDITIONAL_TESTS)
  const canFulfill = status === "AWAITING_DOCUMENTS" || status === "AWAITING_ADDITIONAL_TESTS";
  const [fulfilling, setFulfilling] = useState(false);
  const [fulfillErr, setFulfillErr] = useState("");
  async function fulfill() {
    setFulfillErr("");
    setFulfilling(true);
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/fulfill`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Gönderilemedi.");
      router.refresh();
    } catch (e) {
      setFulfillErr(e instanceof Error ? e.message : "Hata.");
      setFulfilling(false);
    }
  }

  const pendingReqs = data.requests.filter((r) => r.status === "PENDING");

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/second-opinion/vakalarim" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> İkinci görüş vakalarım
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#101010]">{data.branchLabel} · İkinci Görüş</h1>
        <span className="rounded-full bg-[#14C3D0]/10 px-3 py-1 text-[12px] font-semibold text-[#0E8A95]">{SO_STATUS_LABELS[status]}</span>
      </div>

      {/* Tanı özeti */}
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tanı / durum özeti</div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{data.diagnosisSummary}</p>
      </div>

      {/* Durum-bağlamlı bilgilendirme */}
      <StatusBanner status={status} appointment={data.appointment} hasOpinion={data.hasOpinion} />

      {/* Bekleyen talepler (Talep A/B) */}
      {pendingReqs.map((r) => (
        <div key={r.id} className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          {r.type === "ADDITIONAL_EXAMINATION" ? <FlaskConical size={18} className="mt-0.5 shrink-0 text-amber-600" /> : <FileText size={18} className="mt-0.5 shrink-0 text-amber-600" />}
          <div>
            <div className="text-sm font-semibold text-amber-800">
              {r.type === "ADDITIONAL_EXAMINATION" ? "Ek tetkik talebi" : "Eksik belge talebi"}
            </div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-amber-700">{r.description}</p>
          </div>
        </div>
      ))}

      {/* Belge kontrol listesi (branş şablonu) */}
      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-700">Belgeler</div>
        <ul className="mt-3 space-y-2.5">
          {specs.map((s) => {
            const items = docs.filter((d) => d.type === s.type);
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
                      <li key={d.id} className="flex items-center gap-1.5 text-[12.5px] text-slate-500">
                        {d.deliveryMethod === "EXTERNAL_LINK" ? <Link2 size={12} /> : <FileText size={12} />}
                        {d.externalRef ? (
                          <a href={d.externalRef} target="_blank" rel="noopener noreferrer" className="text-[#0E8A95] underline">
                            {d.label || "Bağlantı"}
                          </a>
                        ) : (
                          <span>{d.label || "Yüklenen dosya"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>

        {/* Belge ekleme (yalnız uygun durumlarda) */}
        {canEdit && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4">
            <div className="text-sm font-semibold text-slate-700">Belge ekle</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-slate-500">Belge tipi</label>
                <select
                  value={addType}
                  onChange={(e) => pickType(e.target.value as SoDocType)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm focus:border-[#14C3D0] focus:outline-none"
                >
                  {(Object.keys(SO_DOC_TYPE_LABELS) as SoDocType[]).map((t) => (
                    <option key={t} value={t}>{SO_DOC_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">İletim</label>
                <div className="mt-1 flex rounded-lg border border-slate-300 p-0.5 text-sm">
                  <button
                    onClick={() => setMethod("FILE_UPLOAD")}
                    className={`flex-1 rounded-md px-2 py-1.5 font-medium ${method === "FILE_UPLOAD" ? "bg-[#14C3D0] text-[#101010]" : "text-slate-500"}`}
                  >
                    <Upload size={13} className="mr-1 inline" /> Dosya
                  </button>
                  <button
                    onClick={() => setMethod("EXTERNAL_LINK")}
                    className={`flex-1 rounded-md px-2 py-1.5 font-medium ${method === "EXTERNAL_LINK" ? "bg-[#14C3D0] text-[#101010]" : "text-slate-500"}`}
                  >
                    <Link2 size={13} className="mr-1 inline" /> Bağlantı
                  </button>
                </div>
              </div>
            </div>

            {method === "FILE_UPLOAD" ? (
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
              />
            ) : (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://… (DICOM / bulut bağlantısı)"
                className="mt-3 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-[#14C3D0] focus:outline-none"
              />
            )}
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Açıklama / dosya adı (opsiyonel)"
              className="mt-2 block w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-[#14C3D0] focus:outline-none"
            />
            {addErr && <p className="mt-2 text-sm text-red-600">{addErr}</p>}
            <button
              onClick={addDoc}
              disabled={adding}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
            >
              {adding ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Ekle
            </button>
            {addType === "IMAGING" && (
              <p className="mt-2 text-[12px] text-slate-400">
                DICOM görüntüleme dosyaları büyüktür; bunları bulut/link olarak eklemeniz önerilir.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Talep karşılama (eksik belge / ek tetkik gönderimi) */}
      {canFulfill && (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50/60 p-5">
          <p className="text-sm text-amber-800">
            Talep edilen belge/tetkikleri yukarıdaki <strong>Belge ekle</strong> bölümünden ekledikten sonra gönderin.
          </p>
          {fulfillErr && <p className="mt-2 text-sm text-red-600">{fulfillErr}</p>}
          <button
            onClick={fulfill}
            disabled={fulfilling}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {fulfilling ? <Loader2 size={16} className="animate-spin" /> : "Belgeleri gönder ve incelemeye sun"}
          </button>
        </div>
      )}

      {/* Ödeme (yalnız DRAFT) */}
      {isDraft && !paid && (
        <div className="mt-4 rounded-3xl border border-[#14C3D0]/30 bg-[#14C3D0]/[0.05] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#0E8A95]">
            <CreditCard size={17} /> Ödeme ve gönderim
          </div>
          {missingRequired.length > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-700">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>Eksik zorunlu belge: {missingRequired.map((s) => s.label).join(", ")}. Yine de devam edebilirsiniz; koordinatör eksikleri talep edebilir.</span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-slate-600">Yazılı rapor + video görüşme</span>
            <span className="text-lg font-bold text-[#101010]">{SO_FEE_USD} USD</span>
          </div>
          {payErr && <p className="mt-2 text-sm text-red-600">{payErr}</p>}
          <button
            onClick={pay}
            disabled={paying}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14C3D0] px-6 py-3 text-[15px] font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:opacity-50"
          >
            {paying ? <Loader2 size={17} className="animate-spin" /> : <>Öde ve gönder ({SO_FEE_USD} USD)</>}
          </button>
          <p className="mt-2 text-center text-[11px] text-slate-400">Ödeme simülasyondur — gerçek kart işlemi yapılmaz.</p>
        </div>
      )}

      {paid && status !== "DRAFT" && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CircleCheck size={18} /> Ödemeniz alındı. Belgeleriniz incelemeye gönderildi.
        </div>
      )}
    </div>
  );
}

function StatusBanner({
  status,
  appointment,
  hasOpinion,
}: {
  status: SoStatus;
  appointment: { scheduledAt: string; status: string } | null;
  hasOpinion: boolean;
}) {
  const msg: Partial<Record<SoStatus, string>> = {
    DRAFT: "Belgelerinizi yükleyin, ardından ödemeyi tamamlayarak vakanızı incelemeye gönderin.",
    AWAITING_PAYMENT: "Ödemeniz bekleniyor.",
    PENDING_REVIEW: "Belgeleriniz koordinatör tarafından inceleniyor. Eksik varsa size bildirilecek.",
    AWAITING_DOCUMENTS: "Eksik belge talep edildi — aşağıdaki bölümden yükleyebilirsiniz.",
    READY_FOR_ASSIGNMENT: "Belgeleriniz tamam. Uygun uzman hekime atama yapılıyor.",
    ASSIGNED: "Uzman hekim dosyanızı inceliyor. Yazılı görüşünüz hazırlanıyor.",
    AWAITING_ADDITIONAL_TESTS: "Hekim ek tetkik talep etti — aşağıdaki bölümden yükleyebilirsiniz.",
    OPINION_DELIVERED: "Yazılı ikinci görüşünüz hazır. Video görüşme randevunuz planlanacaktır.",
    VIDEO_SCHEDULED: "Video görüşme randevunuz oluşturuldu.",
    VIDEO_COMPLETED: "Görüşmeniz tamamlandı.",
    CLOSED: "Bu ikinci görüş süreci kapanmıştır.",
    CANCELLED: "Bu başvuru iptal edilmiştir.",
  };
  const text = msg[status];
  if (!text) return null;
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <Clock size={16} className="mt-0.5 shrink-0 text-[#0E8A95]" />
      <div>
        <p>{text}</p>
        {status === "VIDEO_SCHEDULED" && appointment && (
          <p className="mt-1 font-semibold text-slate-800">
            {new Date(appointment.scheduledAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
          </p>
        )}
        {status === "OPINION_DELIVERED" && hasOpinion && (
          <p className="mt-1 text-[12px] text-slate-400">Yazılı görüş görüntüleme yakında bu sayfada olacak.</p>
        )}
      </div>
    </div>
  );
}
