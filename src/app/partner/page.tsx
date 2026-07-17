import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestsByPartner, type PartnerRequestView } from "@/lib/consultation-requests";
import { newsForBranch, NEWS_KIND_LABEL, type NewsItem } from "@/lib/medical-news";
import { getTranslations } from "@/lib/i18n";
import { LANGUAGES, langDir } from "@/lib/constants";
import { PartnerNewsLang } from "./PartnerNewsLang";
import { ConsultationChat } from "@/components/ConsultationChat";
import { VideoControls } from "@/components/VideoControls";
import { PresencePinger } from "@/components/PresencePinger";
import { ShieldOff, Plus, Globe, Languages, Stethoscope, FileText, Clock, CheckCircle2, FlaskConical, Scan, Pill, Download, Newspaper, MessageCircle } from "lucide-react";

export const dynamic = "force-dynamic";

type Tr = (s: string) => string;

// Partner arayüzünün tüm sabit metinleri (kanonik TR) — partner doktorun diline çevrilir.
const UI = {
  panel: "Partner Doktor Paneli",
  boundary: "Bu alan platformun hasta veritabanına erişmez ve uzaktan sağlık hizmeti sunmaz. Yönlendirdiğiniz hasta için yalnızca anonimleştirilmiş bir konsültasyon talebi açabilir, kayıtlı uzman doktorlardan görüş alabilirsiniz.",
  createCta: "Konsültasyon Talebi Oluştur",
  createSub: "Hasta bilgisi anonimleştirilerek havuza aktarılır; branşla sınırlandırabilirsiniz.",
  pending: "Bekleyen taleplerim",
  discussing: "Görüşme sürüyor",
  inDiscussion: "Uzman doktor görüşmede",
  answered: "Görüş alınanlar",
  noPending: "Bekleyen talebiniz yok.",
  generalPool: "Genel havuz",
  sentSummary: "Gönderilen anonim özet:",
  docsAdded: "belge eklendi",
  expertOpinion: "Uzman görüşü",
  awaitingOpinion: "Uzman görüşü bekleniyor",
  lab: "Lab",
  imaging: "Görüntüleme",
  drug: "İlaç",
  news: "Haberler",
  newsSub: "Genel tıp gündemi",
};

// M5 — Partner Doktor Paneli (tüm arayüz partner doktorun dilinde + RTL).
export default async function PartnerHome() {
  const session = await getCurrentUser();
  if (!session) redirect("/giris?next=/partner");
  const u = await db.user.findUnique({ where: { id: session.id }, select: { partnerId: true } });
  const partner = u?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: u.partnerId } }) : null;
  if (!partner) redirect("/");

  const reqs = await requestsByPartner(partner.id);
  const open = reqs.filter((r) => r.status === "OPEN");
  const discussing = reqs.filter((r) => r.status === "IN_DISCUSSION");
  const answered = reqs.filter((r) => r.status === "ANSWERED");

  const partnerLang = partner.language || "İngilizce";
  const dir = langDir(partnerLang);
  const news = newsForBranch(partner.branch);

  // Tüm arayüz + haber metinlerini tek çağrıda çevir (cache; ilk çağrıda Claude).
  const tx = await getTranslations(partnerLang, [
    ...Object.values(UI),
    ...news.flatMap((n) => [n.title, n.summary, n.source, NEWS_KIND_LABEL[n.kind]]),
  ]);
  const tr: Tr = (s) => tx[s.trim()] ?? s;

  return (
    <div dir={dir} className="mx-auto max-w-3xl px-5 py-8">
      <PresencePinger />
      {/* Hero — partner kimliği (ad/kurum/branş = kanonik veri, çevrilmez) */}
      <div className="rounded-3xl border border-sky-400/25 bg-sky-500/10 p-6">
        <div className="flex items-center gap-1.5 aura-mono text-[11px] uppercase tracking-[0.2em] text-sky-300">{tr(UI.panel)}</div>
        <h1 className="aura-display mt-1 text-3xl font-medium tracking-tight text-[var(--c-ink)]">{partner.title} {partner.name}</h1>
        <p className="text-sm text-[var(--c-ink-2)]">{partner.institution ? `${partner.institution} · ` : ""}{partner.country}{partner.branch ? ` · ${partner.branch}` : ""}</p>
      </div>

      {/* Sınır bilgisi */}
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs text-amber-200">
        <ShieldOff size={16} className="mt-0.5 shrink-0" />
        <span>{tr(UI.boundary)}</span>
      </div>

      {/* CTA */}
      <Link href="/partner/talep" className="mt-5 flex items-center gap-3 rounded-3xl border border-[var(--c-indigo)]/40 bg-[var(--c-indigo)]/[0.08] p-5 transition hover:bg-[var(--c-indigo)]/[0.14]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-indigo)] text-[var(--c-ink)]"><Plus size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[var(--c-ink)]">{tr(UI.createCta)}</div>
          <p className="text-xs text-[var(--c-ink-2)]">{tr(UI.createSub)}</p>
        </div>
      </Link>

      {/* Açık talepler */}
      <h2 className="aura-display mt-7 flex items-center gap-2 text-base font-medium tracking-tight text-[var(--c-ink)]"><Clock size={16} /> {tr(UI.pending)} ({open.length})</h2>
      {open.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-6 text-center text-sm text-[var(--c-ink-2)]">{tr(UI.noPending)}</p>
      ) : (
        <div className="mt-2 space-y-3">{open.map((r) => <ReqCard key={r.id} r={r} tr={tr} lang={partnerLang} />)}</div>
      )}

      {/* Görüşme sürüyor (doktor sahiplendi, henüz nihai görüş yok) */}
      {discussing.length > 0 && (
        <>
          <h2 className="aura-display mt-7 flex items-center gap-2 text-base font-medium tracking-tight text-[var(--c-ink)]"><MessageCircle size={16} className="text-sky-300" /> {tr(UI.discussing)} ({discussing.length})</h2>
          <div className="mt-2 space-y-3">{discussing.map((r) => <ReqCard key={r.id} r={r} tr={tr} lang={partnerLang} />)}</div>
        </>
      )}

      {/* Yanıtlananlar */}
      {answered.length > 0 && (
        <>
          <h2 className="aura-display mt-7 flex items-center gap-2 text-base font-medium tracking-tight text-[var(--c-ink)]"><CheckCircle2 size={16} className="text-emerald-300" /> {tr(UI.answered)} ({answered.length})</h2>
          <div className="mt-2 space-y-3">{answered.map((r) => <ReqCard key={r.id} r={r} tr={tr} lang={partnerLang} />)}</div>
        </>
      )}

      {/* Haberler — partner doktorun kendi dilinde */}
      <section className="mt-7 rounded-3xl border border-emerald-400/25 bg-[var(--c-panel)] p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#34d399] text-[var(--c-ink)]"><Newspaper size={18} /></span>
            <div>
              <h2 className="aura-display text-base font-medium tracking-tight text-[var(--c-ink)]">{tr(UI.news)}</h2>
              <p className="text-xs text-[var(--c-ink-2)]">{tr(UI.newsSub)}{partner.branch ? ` + ${partner.branch}` : ""}</p>
            </div>
          </div>
          <PartnerNewsLang current={partnerLang} languages={LANGUAGES} />
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {news.map((n) => <NewsCard key={n.id} item={n} tr={tr} />)}
        </ul>
      </section>
    </div>
  );
}

function ReqCard({ r, tr, lang }: { r: PartnerRequestView; tr: Tr; lang: string }) {
  return (
    <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-semibold text-indigo-300">
          <Stethoscope size={12} /> {r.branch ?? tr(UI.generalPool)}
        </span>
        <div className="flex items-center gap-3 text-xs text-[var(--c-ink-3)]">
          <span className="inline-flex items-center gap-1"><Globe size={12} /> {r.region}</span>
          <span className="inline-flex items-center gap-1"><Languages size={12} /> {r.language}</span>
          {r.icd10Code && <span className="rounded bg-[var(--c-ink)]/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--c-ink-2)]">{r.icd10Code}</span>}
        </div>
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--c-ink-2)]"><FileText size={13} /> {tr(UI.sentSummary)}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--c-ink)]">{r.clinicalSummary}</p>
      {r.documents.length > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-[var(--c-ink-3)]"><FileText size={12} /> {r.documents.length} {tr(UI.docsAdded)} ({r.documents.map((d) => d.docType || "belge").join(", ")})</p>
      )}
      {r.status === "ANSWERED" ? (
        <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-emerald-300">{tr(UI.expertOpinion)}{r.answeredByDoctorName ? ` · ${r.answeredByDoctorName}` : ""} <span className="font-normal text-emerald-300/80">({r.language})</span></div>
            <Link href={`/fhir/ConsultationRequest/${r.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-indigo-300 hover:underline"><Download size={12} /> FHIR</Link>
          </div>
          {/* Görüş hasta dilinde (answerTr); yoksa özgün metin */}
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--c-ink)]">{r.answerTr || r.answerText}</p>
          <Recommendations r={r} tr={tr} />
        </div>
      ) : r.status === "IN_DISCUSSION" ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-medium text-sky-300"><MessageCircle size={12} /> {tr(UI.inDiscussion)}{r.answeredByDoctorName ? ` · ${r.answeredByDoctorName}` : ""}</p>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300"><Clock size={12} /> {tr(UI.awaitingOpinion)}</p>
      )}

      {/* Görüntülü görüşme + yazılı görüşme — doktor sahiplendikten sonra (IN_DISCUSSION/ANSWERED) */}
      {r.status !== "OPEN" && (
        <div className="mt-3 space-y-3">
          <VideoControls requestId={r.id} role="partner" lang={lang} />
          <ConsultationChat requestId={r.id} lang={lang} canSend />
        </div>
      )}
    </div>
  );
}

// Doktorun verdiği yapılandırılmış öneriler — etiketler çevrilir, klinik adlar/kodlar kanonik kalır.
function Recommendations({ r, tr }: { r: PartnerRequestView; tr: Tr }) {
  if (!r.recommendedLabs.length && !r.recommendedImaging.length && !r.medications.length) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {r.recommendedLabs.length > 0 && (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-ink-2)]"><FlaskConical size={12} /> {tr(UI.lab)}</div>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--c-ink-2)]">{r.recommendedLabs.map((l, i) => <li key={i}>{l.name}</li>)}</ul>
        </div>
      )}
      {r.recommendedImaging.length > 0 && (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-ink-2)]"><Scan size={12} /> {tr(UI.imaging)}</div>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--c-ink-2)]">{r.recommendedImaging.map((l, i) => <li key={i}>{l.name}</li>)}</ul>
        </div>
      )}
      {r.medications.length > 0 && (
        <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-ink-2)]"><Pill size={12} /> {tr(UI.drug)}</div>
          <ul className="mt-1 space-y-0.5 text-xs text-[var(--c-ink-2)]">{r.medications.map((m, i) => <li key={i}>{m.name}{m.dose ? ` · ${m.dose}` : ""}{m.freq ? ` · ${m.freq}` : ""}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// Haber kartı — partner doktorun diline çevrilmiş (başlık/özet/kaynak/tür).
function NewsCard({ item, tr }: { item: NewsItem; tr: Tr }) {
  const kindColor: Record<string, string> = {
    haber: "bg-sky-500/15 text-sky-300",
    makale: "bg-violet-500/15 text-violet-300",
    ilac: "bg-emerald-500/15 text-emerald-300",
  };
  return (
    <li className="rounded-2xl border border-[var(--c-hairline)] p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindColor[item.kind]}`}>{tr(NEWS_KIND_LABEL[item.kind])}</span>
        <span className="text-[11px] text-[var(--c-ink-3)]">{tr(item.source)}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-[var(--c-ink)]">{tr(item.title)}</div>
      <p className="mt-1 text-xs text-[var(--c-ink-2)]">{tr(item.summary)}</p>
    </li>
  );
}
