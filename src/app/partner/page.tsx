import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { requestsByPartner, type PartnerRequestView } from "@/lib/consultation-requests";
import { ShieldOff, Plus, Globe, Languages, Stethoscope, FileText, Clock, CheckCircle2 } from "lucide-react";

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
      {answered ? (
        <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="text-xs font-semibold text-emerald-700">Uzman görüşü{r.answeredByDoctorName ? ` · ${r.answeredByDoctorName}` : ""}</div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.answerText}</p>
        </div>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700"><Clock size={12} /> Uzman görüşü bekleniyor</p>
      )}
    </div>
  );
}
