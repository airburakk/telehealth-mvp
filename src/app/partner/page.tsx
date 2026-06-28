import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestsByPartner, type PartnerRequestView } from "@/lib/consultation-requests";
import { newsForBranch, NEWS_KIND_LABEL, type NewsItem } from "@/lib/medical-news";
import { getTranslations } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/constants";
import { PartnerNewsLang } from "./PartnerNewsLang";
import { ShieldOff, Plus, Globe, Languages, Stethoscope, FileText, Clock, CheckCircle2, FlaskConical, Scan, Pill, Download, Newspaper } from "lucide-react";

export const dynamic = "force-dynamic";

// M5 Faz 3 — Partner Doktor Paneli. Kayıtlı hekim ekranlarından TAMAMEN farklı:
// uzaktan sağlık hizmeti YOK · hasta veritabanı erişimi YOK · yalnız anonim konsültasyon talebi açılır.
export default async function PartnerHome() {
  const session = await getCurrentUser();
  if (!session) redirect("/giris?next=/partner");
  const u = await db.user.findUnique({ where: { id: session.id }, select: { partnerId: true } });
  const partner = u?.partnerId ? await db.partnerDoctor.findUnique({ where: { id: u.partnerId } }) : null;
  if (!partner) redirect("/");

  const reqs = await requestsByPartner(partner.id);
  const open = reqs.filter((r) => r.status === "OPEN");
  const answered = reqs.filter((r) => r.status === "ANSWERED");

  // Haber akışı — Doktor Ana Sayfası'nın 5. penceresi, partner doktorun KENDİ diline çevrilmiş.
  const partnerLang = partner.language || "İngilizce";
  const news = newsForBranch(partner.branch);
  const NEWS_UI = ["Haberler", "Genel tıp gündemi", "Haber", "Makale", "İlaç Geliştirme"];
  const tx = await getTranslations(partnerLang, [
    ...NEWS_UI,
    ...news.flatMap((n) => [n.title, n.summary, n.source]),
  ]);
  const tr = (s: string) => tx[s.trim()] ?? s;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* Hero — partner kimliği */}
      <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-600">Partner Doktor Paneli</div>
        <h1 className="mt-1 text-2xl font-bold text-[#101010]">{partner.title} {partner.name}</h1>
        <p className="text-sm text-slate-500">{partner.institution ? `${partner.institution} · ` : ""}{partner.country}{partner.branch ? ` · ${partner.branch}` : ""}</p>
      </div>

      {/* Sınır bilgisi — bu alanın ne YAPMADIĞI açıkça belirtilir */}
      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800">
        <ShieldOff size={16} className="mt-0.5 shrink-0" />
        <span>Bu alan platformun <strong>hasta veritabanına erişmez</strong> ve uzaktan sağlık hizmeti sunmaz. Yönlendirdiğiniz hasta için yalnızca <strong>anonimleştirilmiş</strong> bir konsültasyon talebi açabilir, kayıtlı uzman hekimlerden görüş alabilirsiniz.</span>
      </div>

      {/* CTA — Konsültasyon Talebi Oluştur */}
      <Link href="/partner/talep" className="mt-5 flex items-center gap-3 rounded-3xl border border-[#818cf8]/40 bg-[#818cf8]/[0.08] p-5 transition hover:bg-[#818cf8]/[0.14]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#818cf8] text-white"><Plus size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#101010]">Konsültasyon Talebi Oluştur</div>
          <p className="text-xs text-slate-500">Hasta bilgisi anonimleştirilerek havuza aktarılır; branşla sınırlandırabilirsiniz.</p>
        </div>
      </Link>

      {/* Açık talepler */}
      <h2 className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-700"><Clock size={16} /> Bekleyen taleplerim ({open.length})</h2>
      {open.length === 0 ? (
        <p className="mt-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Bekleyen talebiniz yok.</p>
      ) : (
        <div className="mt-2 space-y-3">{open.map((r) => <ReqCard key={r.id} r={r} />)}</div>
      )}

      {/* Yanıtlananlar */}
      {answered.length > 0 && (
        <>
          <h2 className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-700"><CheckCircle2 size={16} className="text-emerald-600" /> Görüş alınanlar ({answered.length})</h2>
          <div className="mt-2 space-y-3">{answered.map((r) => <ReqCard key={r.id} r={r} answered />)}</div>
        </>
      )}

      {/* Haberler — partner doktorun kendi dilinde (Doktor Ana Sayfası 5. pencere karşılığı) */}
      <section className="mt-7 rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#34d399] text-[#101010]"><Newspaper size={18} /></span>
            <div>
              <h2 className="text-sm font-semibold text-[#101010]">{tr("Haberler")}</h2>
              <p className="text-xs text-slate-500">{tr("Genel tıp gündemi")}{partner.branch ? ` + ${partner.branch}` : ""}</p>
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

function ReqCard({ r, answered }: { r: PartnerRequestView; answered?: boolean }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
          <Stethoscope size={12} /> {r.branch ?? "Genel havuz"}
        </span>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><Globe size={12} /> {r.region}</span>
          <span className="inline-flex items-center gap-1"><Languages size={12} /> {r.language}</span>
          {r.icd10Code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{r.icd10Code}</span>}
        </div>
      </div>
      <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-500"><FileText size={13} /> Gönderilen anonim özet:</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.clinicalSummary}</p>
      {r.documents.length > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400"><FileText size={12} /> {r.documents.length} belge eklendi ({r.documents.map((d) => d.docType || "belge").join(", ")})</p>
      )}
      {answered ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold text-emerald-700">Uzman görüşü{r.answeredByDoctorName ? ` · ${r.answeredByDoctorName}` : ""} <span className="font-normal text-emerald-600/70">({r.language})</span></div>
            <Link href={`/fhir/ConsultationRequest/${r.id}`} target="_blank" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"><Download size={12} /> FHIR</Link>
          </div>
          {/* Görüş hasta dilinde (answerTr); yoksa (hasta dili Türkçe) özgün metin */}
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.answerTr || r.answerText}</p>
          <Recommendations r={r} />
        </div>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"><Clock size={12} /> Uzman görüşü bekleniyor</p>
      )}
    </div>
  );
}

// Hekimin verdiği yapılandırılmış öneriler (lab/görüntüleme/ilaç, kodlu) — partner görünümü.
function Recommendations({ r }: { r: PartnerRequestView }) {
  if (!r.recommendedLabs.length && !r.recommendedImaging.length && !r.medications.length) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-3">
      {r.recommendedLabs.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-white/70 p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><FlaskConical size={12} /> Lab</div>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">{r.recommendedLabs.map((l, i) => <li key={i}>{l.name}</li>)}</ul>
        </div>
      )}
      {r.recommendedImaging.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-white/70 p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Scan size={12} /> Görüntüleme</div>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">{r.recommendedImaging.map((l, i) => <li key={i}>{l.name}</li>)}</ul>
        </div>
      )}
      {r.medications.length > 0 && (
        <div className="rounded-xl border border-emerald-200 bg-white/70 p-2">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500"><Pill size={12} /> İlaç</div>
          <ul className="mt-1 space-y-0.5 text-xs text-slate-600">{r.medications.map((m, i) => <li key={i}>{m.name}{m.dose ? ` · ${m.dose}` : ""}{m.freq ? ` · ${m.freq}` : ""}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

// Haber kartı — partner doktorun diline çevrilmiş (başlık/özet/kaynak/tür). tr = çeviri haritası.
function NewsCard({ item, tr }: { item: NewsItem; tr: (s: string) => string }) {
  const kindColor: Record<string, string> = {
    haber: "bg-sky-100 text-sky-700",
    makale: "bg-violet-100 text-violet-700",
    ilac: "bg-emerald-100 text-emerald-700",
  };
  return (
    <li className="rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindColor[item.kind]}`}>{tr(NEWS_KIND_LABEL[item.kind])}</span>
        <span className="text-[11px] text-slate-400">{tr(item.source)}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-slate-800">{tr(item.title)}</div>
      <p className="mt-1 text-xs text-slate-500">{tr(item.summary)}</p>
    </li>
  );
}
