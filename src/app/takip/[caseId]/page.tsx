import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { recoveryProtocol, severityMeta, type Severity } from "@/lib/postop";
import { CheckInForm } from "@/components/CheckInForm";
import { formatDateTime } from "@/lib/constants";
import { ArrowLeft, HeartPulse, CalendarCheck, Pill, Video, Thermometer, Activity, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RecoveryPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) notFound();
  if (!(await canAccessCase(c))) notFound(); // hasta yalnız kendi vakasını görür

  const recovery = await db.recovery.upsert({
    where: { caseId: c.id },
    update: {},
    create: { caseId: c.id, branch: c.branch },
    include: { checkIns: { orderBy: { createdAt: "desc" } } },
  });

  const day = Math.max(1, Math.floor((Date.now() - new Date(recovery.startedAt).getTime()) / 86400000) + 1);
  const protocol = recoveryProtocol(c.branch);

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href={`/doktor/vaka/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A7D77]">
        <ArrowLeft size={16} /> Vaka detayı
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#0E9E97] text-white"><HeartPulse size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#0A3F39]">Post-Op Takip</h1>
          <p className="text-sm text-slate-500">{c.patientName} · {c.branch} · Tedavi sonrası <strong className="text-slate-700">{day}. gün</strong></p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Sol: kontrol + geçmiş */}
        <div className="space-y-5">
          <CheckInForm caseId={c.id} branch={c.branch} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-800">Kontrol geçmişi</h2>
            {recovery.checkIns.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">Henüz kontrol girilmedi.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {recovery.checkIns.map((ci) => {
                  const m = severityMeta(ci.severity as Severity);
                  return (
                    <li key={ci.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                      <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-700">{formatDateTime(ci.createdAt)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${m.badge}`}>{m.label}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><Activity size={12} /> Ağrı {ci.pain}/10</span>
                          <span className="inline-flex items-center gap-1"><Thermometer size={12} /> {ci.feverC.toFixed(1)}°C</span>
                          <span className="inline-flex items-center gap-1"><Pill size={12} /> {ci.meds ? "İlaç ✓" : "İlaç ✗"}</span>
                          {ci.photo && !ci.photo.startsWith("data:") && <span>📷 {ci.photo}</span>}
                        </div>
                        {ci.note && <p className="mt-1 text-sm text-slate-600">{ci.note}</p>}
                        {ci.photo?.startsWith("data:") && (
                          <a href={ci.photo} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block" title="Büyütmek için aç">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={ci.photo} alt="İyileşme fotoğrafı" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200 transition hover:ring-[#0E9E97]" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Sağ: protokol + hatırlatıcı */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><CalendarCheck size={15} /> İyileşme Takvimi</div>
            <ol className="mt-3 space-y-0">
              {protocol.map((mst, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-teal-100 text-[11px] font-bold text-teal-700">{i + 1}</span>
                    {i < protocol.length - 1 && <span className="my-1 h-5 w-0.5 bg-slate-200" />}
                  </div>
                  <div className="pb-1.5">
                    <div className="text-sm font-medium text-slate-800">{mst.title} <span className="text-xs font-normal text-teal-600">· {mst.day}</span></div>
                    <div className="text-xs text-slate-400">{mst.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700"><Video size={15} /> Tele-Kontrol</div>
            <p className="mt-1.5 text-sm text-slate-600">Kritik dönüm noktalarında doktorunuzla kısa görüşme planlanır.</p>
            <button className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Randevu iste
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Pill size={15} /> İlaç Hatırlatıcı</div>
            <p className="mt-1.5 text-sm text-slate-600">Günlük ilaç bildirimleri açık (demo).</p>
          </div>

          <Link href="/paylasimlarim" className="block rounded-2xl border border-[#0E9E97]/20 bg-[#0E9E97]/[0.03] p-5 transition-colors hover:bg-[#0E9E97]/[0.06]">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#0A3F39]"><ShieldCheck size={15} /> Güvenli Paylaşım</div>
            <p className="mt-1.5 text-sm text-slate-600">Bu kayıtları kendi ülkenizdeki doktorunuzla süreli ve iptal edilebilir bir bağlantıyla paylaşın.</p>
            <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[#0A3F39]">Paylaşım Kontrol Merkezi →</span>
          </Link>
        </aside>
      </div>
    </div>
  );
}
