import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { openRequestsForDoctor, answeredByDoctor, PAYMENT_PER_ANSWER, type ConsultReqView } from "@/lib/consultation-requests";
import { formatUSD } from "@/lib/pricing";
import { ConsultAnswerForm } from "./ConsultAnswerForm";
import { Inbox, ShieldCheck, ArrowLeft, Globe, Languages, Stethoscope, Wallet } from "lucide-react";

export const dynamic = "force-dynamic";

// M5 Faz 2 — Konsültasyon Talepleri gelen kutusu (anonim hasta dosyaları).
export default async function ConsultationInboxPage() {
  const session = await getCurrentUser();
  const u = session ? await db.user.findUnique({ where: { id: session.id }, select: { doctorId: true } }) : null;
  const doctor = u?.doctorId ? await db.doctor.findUnique({ where: { id: u.doctorId } }) : null;

  if (!doctor) redirect("/doktor");
  if (!doctor.consultOptIn) redirect("/doktor"); // panel görünürlüğüyle tutarlı

  const [open, answered] = await Promise.all([
    openRequestsForDoctor(doctor.branch),
    answeredByDoctor(doctor.id),
  ]);
  const totalEarned = answered.reduce((a, r) => a + (r.paymentSim ?? 0), 0);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft size={15} /> Ana Sayfa
      </Link>

      <div className="mt-3 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Konsültasyon Talepleri</h1>
          <p className="mt-1 text-sm text-slate-500">Partner doktorlardan gelen anonimleştirilmiş hasta dosyaları. Yanıt başına {formatUSD(PAYMENT_PER_ANSWER)} (simüle).</p>
        </div>
        <div className="shrink-0 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1.5 text-xs font-semibold text-emerald-700"><Wallet size={14} /> Hakediş</div>
          <div className="text-lg font-bold text-emerald-700">{formatUSD(totalEarned)}</div>
          <div className="text-[10px] text-emerald-600/70">{answered.length} yanıt</div>
        </div>
      </div>

      {/* Mahremiyet bilgi şeridi */}
      <div className="mt-5 flex items-start gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs text-indigo-800">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <span>Bu dosyalar otomatik <strong>anonimleştirme</strong> katmanından geçti — hasta adı, kimlik numarası ve görüntü ekleri kaldırıldı. Yalnız klinik içerik gösterilir.</span>
      </div>

      {/* Açık talepler */}
      <h2 className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-700"><Inbox size={16} /> Açık talepler ({open.length})</h2>
      {open.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Şu an açık konsültasyon talebi yok.</p>
      ) : (
        <div className="mt-3 space-y-4">
          {open.map((r) => <OpenCard key={r.id} r={r} />)}
        </div>
      )}

      {/* Yanıtladıklarım */}
      {answered.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold text-slate-700">Yanıtladıklarım ({answered.length})</h2>
          <div className="mt-3 space-y-3">
            {answered.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <BranchTag r={r} />
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">{formatUSD(r.paymentSim ?? 0)} · yanıtlandı</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs text-slate-500">{r.clinicalSummary}</p>
                <div className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><span className="text-xs font-semibold text-slate-400">Görüşünüz: </span>{r.answerText}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BranchTag({ r }: { r: ConsultReqView }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-600">
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
        <Stethoscope size={12} /> {r.branch ?? "Genel havuz"}
      </span>
      {r.urgency >= 4 && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">acil {r.urgency}/5</span>}
    </span>
  );
}

function OpenCard({ r }: { r: ConsultReqView }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BranchTag r={r} />
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1"><Globe size={12} /> {r.region}</span>
          <span className="inline-flex items-center gap-1"><Languages size={12} /> {r.language}</span>
          {r.icd10Code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">{r.icd10Code}</span>}
        </div>
      </div>
      {r.requestedByName && <p className="mt-2 text-xs text-slate-400">Talep eden: {r.requestedByName} (Partner)</p>}
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{r.clinicalSummary}</p>
      <div className="mt-4">
        <ConsultAnswerForm id={r.id} />
      </div>
    </div>
  );
}
