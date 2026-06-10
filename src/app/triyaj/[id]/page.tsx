import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { countryFlag, countryName, urgencyStyle } from "@/lib/constants";
import { CheckCircle2, FileText, Stethoscope, ArrowRight, Sparkles } from "lucide-react";

export default async function TriyajResult({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.case.findUnique({ where: { id } });
  if (!c) notFound();
  if (!(await canAccessCase(c))) notFound(); // hasta yalnız kendi vaka sonucunu görür

  const u = urgencyStyle(c.urgency);
  const files = c.attachments ? c.attachments.split(",").filter(Boolean) : [];

  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" />
        <div>
          <h1 className="font-bold text-emerald-900">Vakanız oluşturuldu ve doktor kuyruğuna eklendi</h1>
          <p className="mt-0.5 text-sm text-emerald-800/80">
            Uzman hekim, hazırlanan vaka özetinizi inceleyip sizinle video görüşmesi planlayacak.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Vaka No</div>
            <div className="font-mono text-sm text-slate-700">{c.id.slice(0, 8).toUpperCase()}</div>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
            <span className={`h-2 w-2 rounded-full ${u.dot}`} /> Aciliyet {c.urgency}/5 · {u.label}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <Info k="Hasta" v={c.patientName} />
          <Info k="Ülke / Dil" v={`${countryFlag(c.country)} ${countryName(c.country)} · ${c.language}`} />
          <Info k="Yönlendirilen Branş" v={c.branch} accent />
          <Info k="Süre" v={c.durationText || "—"} />
        </div>

        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-slate-400">Şikayet</div>
          <p className="mt-1 text-sm text-slate-700">{c.symptoms}</p>
        </div>

        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-sky-700">
            <Sparkles size={14} /> Triyaj Gerekçesi
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{c.reasoning}</p>
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">Belgeler</div>
            <ul className="mt-1.5 flex flex-wrap gap-2">
              {files.map((f) => (
                <li key={f} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  <FileText size={14} className="text-sky-600" /> {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/doktor" className="inline-flex items-center gap-2 rounded-lg bg-[#0f2a4a] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#143a63]">
          <Stethoscope size={16} /> Doktor panelinde gör
        </Link>
        <Link href="/triyaj" className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">
          Yeni triyaj <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}

function Info({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-400">{k}</div>
      <div className={`mt-0.5 ${accent ? "font-semibold text-[#0f2a4a]" : "text-slate-800"}`}>{v}</div>
    </div>
  );
}
