"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { secondOpinionDocSpecs, SO_DOC_TYPE_LABELS, type SoDocType } from "@/data/second-opinion-docs";
import { SO_STATUS_LABELS, SO_FEE_USD, type SoStatus } from "@/lib/second-opinion";
import { useT } from "@/components/useT";
import { useClinicalT } from "@/components/useClinicalT";
import { useSoLang, SoLangSelect } from "@/components/SoLocale";
import {
  Check, AlertTriangle, CreditCard, Loader2, Link2, Upload, FileText,
  CircleCheck, Clock, FlaskConical, ArrowLeft, NotebookPen, Printer, Video, Stethoscope,
  CalendarClock, RefreshCw, Hand, Globe,
} from "lucide-react";
import { langDir, LANG_BCP47, countryName, countryFlag } from "@/lib/constants";
import { ProcessTracker, type TrackerItem } from "@/components/ProcessTracker";
import { soTrackerPhases, SO_TRACKER_TEXTS } from "@/lib/so-tracker";
import { DoctorArt } from "@/components/PortamedArt";

type DocMeta = { id: string; type: string; deliveryMethod: string; externalRef: string | null; label: string | null };
type SoData = {
  id: string; status: string; branch: string; branchLabel: string; diagnosisSummary: string;
  country: string | null; language: string | null;
  createdAt: string; documents: DocMeta[];
  payment: { status: string; amount: number; currency: string } | null;
  requests: { id: string; type: string; description: string; status: string }[];
  opinion: { content: string; submittedAt: string } | null;
  appointment: { id: string; scheduledAt: string; status: string } | null;
  readyAt: string | null;
  assignedDoctor: { name: string; title: string; branchLabel: string; avatarI: number; female: boolean; photo?: string | null; verified: boolean } | null;
};

const ADDABLE = ["DRAFT", "AWAITING_DOCUMENTS", "AWAITING_ADDITIONAL_TESTS"];
// Atanan doktor kimlik kartı yalnız doktor dosyayı ÜSTLENDİKTEN sonra (OFFERED'da henüz kesin değil).
const DOCTOR_SHOWN = ["ASSIGNED", "AWAITING_ADDITIONAL_TESTS", "OPINION_DELIVERED", "VIDEO_OFFERED", "VIDEO_SCHEDULED", "VIDEO_COMPLETED", "CLOSED"];
const REQ_BADGE: Record<string, { label: string; cls: string }> = {
  REQUIRED: { label: "Zorunlu", cls: "bg-red-500/10 text-red-300 ring-red-400/25" },
  CONDITIONAL: { label: "Varsa", cls: "bg-amber-500/10 text-amber-300 ring-amber-400/25" },
  OPTIONAL: { label: "Opsiyonel", cls: "bg-white/10 text-white/50 ring-white/10" },
};

// Durum-bağlamlı hasta mesajları (TR kanonik; useT ile çevrilir)
const STATUS_MSG: Partial<Record<SoStatus, string>> = {
  DRAFT: "Belgelerinizi yükleyin, ardından ödemeyi tamamlayarak vakanızı incelemeye gönderin.",
  AWAITING_PAYMENT: "Ödemeniz bekleniyor.",
  PENDING_REVIEW: "Dosyanız incelenmeye alındı. Eksik belge varsa size bildirilecek.",
  OFFERED: "Dosyanız uzman doktorunuze iletildi; doktorun onayı bekleniyor.",
  AWAITING_DOCUMENTS: "Eksik belge talep edildi — aşağıdaki bölümden yükleyebilirsiniz.",
  READY_FOR_ASSIGNMENT: "Belgeleriniz tamam. Uygun uzman doktora atama yapılıyor.",
  ASSIGNED: "Uzman doktor dosyanızı inceliyor. Yazılı görüşünüz hazırlanıyor.",
  AWAITING_ADDITIONAL_TESTS: "Doktor ek tetkik talep etti — aşağıdaki bölümden yükleyebilirsiniz.",
  OPINION_DELIVERED: "Yazılı ikinci görüşünüz hazır. Uzman doktorunuz birazdan bir video görüşme zamanı önerecek.",
  VIDEO_OFFERED: "Uzman doktorunuz bir görüşme zamanı önerdi — onaylayın ya da farklı bir zaman isteyin.",
  VIDEO_SCHEDULED: "Video görüşme randevunuz oluşturuldu.",
  VIDEO_COMPLETED: "Görüşmeniz tamamlandı.",
  CLOSED: "Bu ikinci görüş süreci kapanmıştır.",
  CANCELLED: "Bu başvuru iptal edilmiştir.",
};

// A2: hastadan işlem beklenen durumlar → tracker üstünde belirgin "sizden bekleniyor" amber banner
// (top hastadayken kaçırmasın; amber yalnız gerçekten işlem gerektiğinde). TR kanonik.
const ACTION_NEEDED: Partial<Record<SoStatus, { title: string; desc: string }>> = {
  DRAFT: { title: "Başvurunuzu tamamlayın", desc: "Belgelerinizi yükleyip ödemeyi tamamlayarak vakanızı incelemeye gönderin." },
  AWAITING_DOCUMENTS: { title: "Eksik belge yükleyin", desc: "Talep edilen belgeleri aşağıdaki bölümden yükleyip gönderin." },
  AWAITING_ADDITIONAL_TESTS: { title: "Ek tetkik yükleyin", desc: "Doktorunuzin istediği tetkikleri aşağıdaki bölümden yükleyip gönderin." },
  VIDEO_OFFERED: { title: "Randevu teklifini yanıtlayın", desc: "Önerilen video görüşme zamanını onaylayın ya da farklı bir zaman isteyin." },
};
// A4: belgeler "doğrulandı" sayılır — vaka inceleme/atama kapısını geçtiyse (öncesi: yalnız "alındı").
const VERIFIED_STATUSES = ["OFFERED", "ASSIGNED", "AWAITING_ADDITIONAL_TESTS", "OPINION_DELIVERED", "VIDEO_OFFERED", "VIDEO_SCHEDULED", "VIDEO_COMPLETED", "CLOSED"];

// Statik UI metinleri (TR kanonik)
const S = {
  back: "İkinci görüş vakalarım",
  soSuffix: "İkinci Görüş",
  diagTitle: "Tanı / durum özeti",
  opinionTitle: "Yazılı İkinci Görüşünüz",
  print: "Yazdır / PDF",
  videoTitle: "Video görüşme randevunuz",
  join: "Görüşmeye katıl",
  videoOfferTitle: "Video randevu teklifi",
  videoOfferDesc: "Uzman doktorunuz görüşme için aşağıdaki zamanı önerdi:",
  acceptVideo: "Bu zamanı onayla",
  requestChange: "Farklı bir zaman iste",
  errRespond: "İşlem tamamlanamadı.",
  yourDoctor: "Uzman doktorunuz",
  verifiedDoctor: "Doğrulanmış uzman doktor",
  actionNeeded: "Sizden bekleniyor",
  docReceived: "Alındı",
  docVerified: "Doğrulandı",
  reqAdd: "Ek tetkik talebi",
  reqDoc: "Eksik belge talebi",
  docsTitle: "Belgeler",
  linkLabel: "Bağlantı",
  uploadedFile: "Yüklenen dosya",
  addDoc: "Belge ekle",
  docType: "Belge tipi",
  delivery: "İletim",
  fileBtn: "Dosya",
  urlPh: "https://… (DICOM / bulut bağlantısı)",
  labelPh: "Açıklama / dosya adı (opsiyonel)",
  add: "Ekle",
  imagingNote: "DICOM görüntüleme dosyaları büyüktür; bunları bulut/link olarak eklemeniz önerilir.",
  fulfillNote: "Talep edilen belge/tetkikleri yukarıdaki Belge ekle bölümünden ekledikten sonra gönderin.",
  fulfillBtn: "Belgeleri gönder ve incelemeye sun",
  payTitle: "Ödeme ve gönderim",
  missingLabel: "Eksik zorunlu belge",
  missingNote: "Devam etmek için eksik belgeleri yükleyin ya da aşağıdaki kutuyu işaretleyin.",
  willProvide: "Eksik zorunlu belgeleri sonra temin edeceğim.",
  payLine: "Yazılı rapor + video görüşme",
  payBtn: `Öde ve gönder (${SO_FEE_USD} USD)`,
  paySim: "Ödeme simülasyondur — gerçek kart işlemi yapılmaz.",
  paid: "Ödemeniz alındı. Belgeleriniz incelemeye gönderildi.",
  errLink: "Geçerli bir bağlantı (http/https) girin.",
  errFile: "Bir dosya seçin.",
  errBig: "Dosya 8 MB'tan büyük — lütfen bağlantı olarak ekleyin.",
  errAdd: "Belge eklenemedi.",
  errGeneric: "Hata.",
  errPay: "Ödeme alınamadı.",
  errFulfill: "Gönderilemedi.",
} as const;

const PHASE_ICON = {
  payment: <CreditCard size={14} />,
  docs: <FileText size={14} />,
  doctor: <Stethoscope size={14} />,
  video: <Video size={14} />,
} as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("Dosya okunamadı."));
    r.readAsDataURL(file);
  });
}

// Somut "tahmini teslim" tarihi — alıcının dilinde gün+ay (örn. "26 Haziran"). Tarayıcı ICU; geçersiz
// dil kodu → tr-TR fallback. (Faz A1 — dijital bekleme odası süreç panosu.)
function fmtTrackerDate(iso: string, lang: string): string {
  const locale = LANG_BCP47[lang] ?? "tr-TR";
  try {
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long" });
  } catch {
    return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  }
}

export function SoCaseDetail({ data }: { data: SoData }) {
  const router = useRouter();
  const [lang, setLang] = useSoLang();
  const status = data.status as SoStatus;
  const canEdit = ADDABLE.includes(status);
  const isDraft = status === "DRAFT";

  const specs = useMemo(() => secondOpinionDocSpecs(data.branch), [data.branch]);
  const [docs, setDocs] = useState<DocMeta[]>(data.documents);
  const providedTypes = useMemo(() => new Set(docs.map((d) => d.type)), [docs]);
  const missingRequired = specs.filter((s) => s.requirement === "REQUIRED" && !providedTypes.has(s.type));
  const pendingReqs = data.requests.filter((r) => r.status === "PENDING");

  const texts = useMemo(
    () => [
      ...Object.values(S),
      ...Object.values(SO_STATUS_LABELS),
      ...Object.values(SO_DOC_TYPE_LABELS),
      ...Object.values(STATUS_MSG),
      ...Object.values(ACTION_NEEDED).flatMap((a) => [a.title, a.desc]),
      "Zorunlu", "Varsa", "Opsiyonel",
      data.branchLabel,
      ...specs.map((s) => s.label),
      ...SO_TRACKER_TEXTS,
      ...(data.assignedDoctor ? [data.assignedDoctor.title, data.assignedDoctor.branchLabel] : []),
      ...(data.country ? [countryName(data.country)] : []),
    ],
    [data.branchLabel, specs, data.assignedDoctor, data.country],
  );
  const { t } = useT(lang, texts);

  // KLİNİK serbest-metin (PHI: uzman görüşü + talep açıklamaları) cache'li useT yolundan AYRILDI —
  // önbelleksiz + ad maskeli klinik yola gider (P0 #2: düz-metin PHI Translation'a yazılmasın + maskesiz
  // AI'ya gitmesin). Sunucu tarafı paylasim/triyaj ile aynı translateClinical desenidir.
  const clinicalTexts = useMemo(
    () => [
      ...(data.opinion ? [data.opinion.content] : []),
      ...pendingReqs.map((r) => r.description),
    ],
    [data.opinion, pendingReqs],
  );
  const tc = useClinicalT(data.id, lang, clinicalTexts);

  const trackerItems: TrackerItem[] = soTrackerPhases(status, data.readyAt).map((p) => ({
    label: t(p.label),
    subStatus: p.dueDate ? `${t(p.sub)} · ${t("Tahmini teslim")}: ${fmtTrackerDate(p.dueDate, lang)}` : t(p.sub),
    state: p.state,
    icon: PHASE_ICON[p.key],
  }));

  const action = ACTION_NEEDED[status]; // A2: hastadan beklenen işlem (varsa tracker üstünde banner)
  const docsVerified = VERIFIED_STATUSES.includes(status); // A4: belgeler doğrulandı mı (inceleme kapısı geçildi mi)

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
  // Belge gate: eksik zorunlu belge varsa "temin edeceğim" işaretlenmeden ödeme/gönderim yapılamaz
  // (koordinatör tamlık kontrolü kaldırıldığı için hasta-yüzüne taşındı — Talk to Doctor deseni).
  const [willProvide, setWillProvide] = useState(false);
  const payBlocked = missingRequired.length > 0 && !willProvide;

  function pickType(tp: SoDocType) {
    setAddType(tp);
    setMethod(specs.find((s) => s.type === tp)?.defaultDelivery ?? "FILE_UPLOAD");
    setAddErr("");
  }

  async function addDoc() {
    setAddErr("");
    const payload: Record<string, unknown> = { type: addType, deliveryMethod: method, label: label.trim() || undefined };
    if (method === "EXTERNAL_LINK") {
      if (!/^https?:\/\/.+/i.test(url.trim())) return setAddErr(t(S.errLink));
      payload.externalRef = url.trim();
    } else {
      if (!file) return setAddErr(t(S.errFile));
      if (file.size > 8 * 1024 * 1024) return setAddErr(t(S.errBig));
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
      if (!res.ok) throw new Error(d.error || t(S.errAdd));
      setDocs((p) => [...p, { id: d.id, type: d.type, deliveryMethod: d.deliveryMethod, externalRef: d.externalRef, label: d.label }]);
      setUrl(""); setLabel(""); setFile(null);
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : t(S.errGeneric));
    } finally {
      setAdding(false);
    }
  }

  async function pay() {
    setPayErr(""); setPaying(true);
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/pay`, { method: "POST" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || t(S.errPay));
      setPaid(true);
      router.refresh();
    } catch (e) {
      setPayErr(e instanceof Error ? e.message : t(S.errGeneric));
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
      if (!res.ok) throw new Error(d.error || t(S.errFulfill));
      router.refresh();
    } catch (e) {
      setFulfillErr(e instanceof Error ? e.message : t(S.errGeneric));
      setFulfilling(false);
    }
  }

  // Video randevu teklifine yanıt (VIDEO_OFFERED) — onayla / farklı zaman iste (İcapçı deseni)
  const [responding, setResponding] = useState<"" | "accept" | "request_change">("");
  const [respondErr, setRespondErr] = useState("");
  async function respondVideo(action: "accept" | "request_change") {
    setRespondErr("");
    setResponding(action);
    try {
      const res = await fetch(`/api/second-opinion/cases/${data.id}/respond-video`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || t(S.errRespond));
      router.refresh();
    } catch (e) {
      setRespondErr(e instanceof Error ? e.message : t(S.errGeneric));
      setResponding("");
    }
  }

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-2xl px-5 py-8">
      <div className="flex items-center justify-between gap-3">
        <Link href="/second-opinion/vakalarim" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white/75">
          <ArrowLeft size={15} /> {t(S.back)}
        </Link>
        <SoLangSelect lang={lang} onChange={setLang} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-[#F4F5F3]">{t(data.branchLabel)} · {t(S.soSuffix)}</h1>
        <span className="rounded-full bg-[#28C8D8]/10 px-3 py-1 text-[12px] font-semibold text-[#17919E]">{t(SO_STATUS_LABELS[status])}</span>
      </div>

      {/* Hasta ülkesi + tercih dili (başvuruda alınır; eski vakalarda boş olabilir) */}
      {(data.country || data.language) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-white/50">
          {data.country && (
            <span className="inline-flex items-center gap-1.5">{countryFlag(data.country)} {t(countryName(data.country))}</span>
          )}
          {data.language && (
            <span className="inline-flex items-center gap-1.5"><Globe size={13} /> {data.language}</span>
          )}
        </div>
      )}

      {/* Süreç takip göstergesi (fazlara gruplu) */}
      <div className="mt-4">
        <ProcessTracker items={trackerItems} dir={langDir(lang)} />
      </div>

      {/* Sizden bekleniyor — top hastadayken belirgin (bekleme odası Faz A2) */}
      {action && (
        <div className="mt-4 flex items-start gap-3 rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-300"><Hand size={18} /></span>
          <div>
            <div className="text-sm font-semibold text-amber-200">{t(S.actionNeeded)} · {t(action.title)}</div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-amber-200">{t(action.desc)}</p>
          </div>
        </div>
      )}

      {/* Atanan uzman doktor kimlik kartı (en güçlü güven öğesi — bekleme odası Faz A3) */}
      {data.assignedDoctor && DOCTOR_SHOWN.includes(status) && (
        <div className="mt-4 flex items-center gap-4 rounded-3xl border border-[#28C8D8]/30 bg-[#161719] p-5 shadow-sm">
          <span className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10">
            <DoctorArt i={data.assignedDoctor.avatarI} female={data.assignedDoctor.female} photo={data.assignedDoctor.photo} />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#17919E]">{t(S.yourDoctor)}</div>
            <div className="mt-0.5 text-lg font-bold text-[#F4F5F3]">{t(data.assignedDoctor.title)} {data.assignedDoctor.name}</div>
            <div className="text-sm text-white/50">{t(data.assignedDoctor.branchLabel)}</div>
            {/* Rozet gerçek Doctor.verified değerine bağlı — koşulsuz "doğrulanmış" beyanı kaldırıldı (vitrin dürüstlüğü) */}
            {data.assignedDoctor.verified && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-300"><CircleCheck size={13} /> {t(S.verifiedDoctor)}</div>
            )}
          </div>
        </div>
      )}

      {/* Tanı özeti — hastanın kendi girdisi, çevrilmez */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/40">{t(S.diagTitle)}</div>
        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-white/75">{data.diagnosisSummary}</p>
      </div>

      {/* Durum-bağlamlı bilgilendirme */}
      <StatusBanner status={status} appointment={data.appointment} t={t} />

      {/* Sunulan yazılı görüş — içerik çevrilir */}
      {data.opinion && (
        <div className="mt-4 rounded-3xl border border-emerald-400/25 bg-emerald-50/50 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200"><NotebookPen size={16} /> {t(S.opinionTitle)}</div>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/30 px-2.5 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15">
              <Printer size={12} /> {t(S.print)}
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-white/75">{tc(data.opinion.content)}</pre>
          <div className="mt-2 text-xs text-emerald-300">{new Date(data.opinion.submittedAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</div>
        </div>
      )}

      {/* Video randevu teklifi — onayla / farklı zaman iste (İcapçı deseni) */}
      {status === "VIDEO_OFFERED" && data.appointment && (
        <div className="mt-4 rounded-3xl border border-amber-400/25 bg-amber-50/60 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-200"><CalendarClock size={17} /> {t(S.videoOfferTitle)}</div>
          <p className="mt-1.5 text-[13px] text-amber-300">{t(S.videoOfferDesc)}</p>
          <p className="mt-1 text-lg font-bold text-[#F4F5F3]">{new Date(data.appointment.scheduledAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}</p>
          {respondErr && <p className="mt-2 text-sm text-red-300">{respondErr}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => respondVideo("accept")} disabled={responding !== ""} className="inline-flex items-center gap-2 rounded-xl bg-[#28C8D8] px-5 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50">
              {responding === "accept" ? <Loader2 size={16} className="animate-spin" /> : <CircleCheck size={16} />} {t(S.acceptVideo)}
            </button>
            <button onClick={() => respondVideo("request_change")} disabled={responding !== ""} className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-[#161719] px-5 py-2.5 text-sm font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50">
              {responding === "request_change" ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} {t(S.requestChange)}
            </button>
          </div>
        </div>
      )}

      {/* Video randevusu — katıl */}
      {status === "VIDEO_SCHEDULED" && data.appointment && (
        <div className="mt-4 rounded-3xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.06] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]"><Video size={17} /> {t(S.videoTitle)}</div>
          <p className="mt-1.5 text-lg font-bold text-[#F4F5F3]">{new Date(data.appointment.scheduledAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}</p>
          <Link href={`/second-opinion/gorusme/${data.appointment.id}?role=patient`} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#28C8D8] px-5 py-2.5 text-sm font-semibold text-[#0D0E10] hover:bg-[#1FA9B8]">
            <Video size={16} /> {t(S.join)}
          </Link>
        </div>
      )}

      {/* Bekleyen talepler (Talep A/B) */}
      {pendingReqs.map((r) => (
        <div key={r.id} className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4">
          {r.type === "ADDITIONAL_EXAMINATION" ? <FlaskConical size={18} className="mt-0.5 shrink-0 text-amber-300" /> : <FileText size={18} className="mt-0.5 shrink-0 text-amber-300" />}
          <div>
            <div className="text-sm font-semibold text-amber-200">{r.type === "ADDITIONAL_EXAMINATION" ? t(S.reqAdd) : t(S.reqDoc)}</div>
            <p className="mt-0.5 text-[13px] leading-relaxed text-amber-300">{tc(r.description)}</p>
          </div>
        </div>
      ))}

      {/* Belge kontrol listesi (branş şablonu) */}
      <div className="mt-4 rounded-3xl border border-white/10 bg-[#161719] p-5 shadow-sm">
        <div className="text-sm font-semibold text-white/75">{t(S.docsTitle)}</div>
        <ul className="mt-3 space-y-2.5">
          {specs.map((s) => {
            const items = docs.filter((d) => d.type === s.type);
            const has = items.length > 0;
            const badge = REQ_BADGE[s.requirement];
            return (
              <li key={s.type} className="rounded-2xl border border-white/10 bg-[#1E1F22]/60 p-3">
                <div className="flex items-center gap-2">
                  <span className={`grid h-6 w-6 place-items-center rounded-full ${has ? (docsVerified ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300") : "bg-white/15 text-white/40"}`}>
                    {has ? <Check size={14} /> : <span className="text-[11px]">—</span>}
                  </span>
                  <span className="text-sm font-medium text-white/75">{t(s.label)}</span>
                  {has && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${docsVerified ? "bg-emerald-500/15 text-emerald-300" : "bg-sky-500/15 text-sky-300"}`}>
                      {docsVerified ? t(S.docVerified) : t(S.docReceived)}
                    </span>
                  )}
                  <span className={`ms-auto rounded-full px-2 py-0.5 text-[10.5px] font-semibold ring-1 ${badge.cls}`}>{t(badge.label)}</span>
                </div>
                {items.length > 0 && (
                  <ul className="mt-2 space-y-1 ps-8">
                    {items.map((d) => (
                      <li key={d.id} className="flex items-center gap-1.5 text-[12.5px] text-white/50">
                        {d.deliveryMethod === "EXTERNAL_LINK" ? <Link2 size={12} /> : <FileText size={12} />}
                        {d.externalRef ? (
                          <a href={d.externalRef} target="_blank" rel="noopener noreferrer" className="text-[#17919E] underline">
                            {d.label || t(S.linkLabel)}
                          </a>
                        ) : (
                          <span>{d.label || t(S.uploadedFile)}</span>
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
          <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-4">
            <div className="text-sm font-semibold text-white/75">{t(S.addDoc)}</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-white/50">{t(S.docType)}</label>
                <select
                  value={addType}
                  onChange={(e) => pickType(e.target.value as SoDocType)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-[#161719] px-2.5 py-2 text-sm focus:border-[#28C8D8] focus:outline-none"
                >
                  {(Object.keys(SO_DOC_TYPE_LABELS) as SoDocType[]).map((tp) => (
                    <option key={tp} value={tp}>{t(SO_DOC_TYPE_LABELS[tp])}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50">{t(S.delivery)}</label>
                <div className="mt-1 flex rounded-lg border border-white/15 p-0.5 text-sm">
                  <button
                    onClick={() => setMethod("FILE_UPLOAD")}
                    className={`flex-1 rounded-md px-2 py-1.5 font-medium ${method === "FILE_UPLOAD" ? "bg-[#28C8D8] text-[#0D0E10]" : "text-white/50"}`}
                  >
                    <Upload size={13} className="me-1 inline" /> {t(S.fileBtn)}
                  </button>
                  <button
                    onClick={() => setMethod("EXTERNAL_LINK")}
                    className={`flex-1 rounded-md px-2 py-1.5 font-medium ${method === "EXTERNAL_LINK" ? "bg-[#28C8D8] text-[#0D0E10]" : "text-white/50"}`}
                  >
                    <Link2 size={13} className="me-1 inline" /> {t(S.linkLabel)}
                  </button>
                </div>
              </div>
            </div>

            {method === "FILE_UPLOAD" ? (
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-3 block w-full text-sm text-white/65 file:me-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white/75"
              />
            ) : (
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t(S.urlPh)}
                className="mt-3 block w-full rounded-lg border border-white/15 px-2.5 py-2 text-sm focus:border-[#28C8D8] focus:outline-none"
              />
            )}
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t(S.labelPh)}
              className="mt-2 block w-full rounded-lg border border-white/15 px-2.5 py-2 text-sm focus:border-[#28C8D8] focus:outline-none"
            />
            {addErr && <p className="mt-2 text-sm text-red-300">{addErr}</p>}
            <button
              onClick={addDoc}
              disabled={adding}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#26272B] px-4 py-2 text-sm font-semibold text-white hover:bg-[#101113] disabled:opacity-50"
            >
              {adding ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} {t(S.add)}
            </button>
            {addType === "IMAGING" && <p className="mt-2 text-[12px] text-white/40">{t(S.imagingNote)}</p>}
          </div>
        )}
      </div>

      {/* Talep karşılama */}
      {canFulfill && (
        <div className="mt-4 rounded-3xl border border-amber-400/25 bg-amber-50/60 p-5">
          <p className="text-sm text-amber-200">{t(S.fulfillNote)}</p>
          {fulfillErr && <p className="mt-2 text-sm text-red-300">{fulfillErr}</p>}
          <button
            onClick={fulfill}
            disabled={fulfilling}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {fulfilling ? <Loader2 size={16} className="animate-spin" /> : t(S.fulfillBtn)}
          </button>
        </div>
      )}

      {/* Ödeme (yalnız DRAFT) */}
      {isDraft && !paid && (
        <div className="mt-4 rounded-3xl border border-[#28C8D8]/30 bg-[#28C8D8]/[0.05] p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#17919E]">
            <CreditCard size={17} /> {t(S.payTitle)}
          </div>
          {missingRequired.length > 0 && (
            <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[13px] text-amber-300">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                <span>{t(S.missingLabel)}: {missingRequired.map((s) => t(s.label)).join(", ")}. {t(S.missingNote)}</span>
              </div>
              <label className="mt-2 flex items-start gap-2 ps-[23px] font-medium text-amber-200">
                <input type="checkbox" checked={willProvide} onChange={(e) => setWillProvide(e.target.checked)} className="mt-0.5 accent-[#28C8D8]" />
                <span>{t(S.willProvide)}</span>
              </label>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-white/65">{t(S.payLine)}</span>
            <span className="text-lg font-bold text-[#F4F5F3]">{SO_FEE_USD} USD</span>
          </div>
          {payErr && <p className="mt-2 text-sm text-red-300">{payErr}</p>}
          <button
            onClick={pay}
            disabled={paying || payBlocked}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#28C8D8] px-6 py-3 text-[15px] font-semibold text-[#0D0E10] hover:bg-[#1FA9B8] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paying ? <Loader2 size={17} className="animate-spin" /> : t(S.payBtn)}
          </button>
          <p className="mt-2 text-center text-[11px] text-white/40">{t(S.paySim)}</p>
        </div>
      )}

      {paid && status !== "DRAFT" && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          <CircleCheck size={18} /> {t(S.paid)}
        </div>
      )}
    </div>
  );
}

function StatusBanner({
  status,
  appointment,
  t,
}: {
  status: SoStatus;
  appointment: { scheduledAt: string; status: string } | null;
  t: (s: string) => string;
}) {
  const text = STATUS_MSG[status];
  if (!text) return null;
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-white/10 bg-[#161719] p-4 text-sm text-white/65">
      <Clock size={16} className="mt-0.5 shrink-0 text-[#17919E]" />
      <div>
        <p>{t(text)}</p>
        {status === "VIDEO_SCHEDULED" && appointment && (
          <p className="mt-1 font-semibold text-[#F4F5F3]">
            {new Date(appointment.scheduledAt).toLocaleString("tr-TR", { dateStyle: "long", timeStyle: "short" })}
          </p>
        )}
      </div>
    </div>
  );
}
