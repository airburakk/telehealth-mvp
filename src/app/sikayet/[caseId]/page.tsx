import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/ownership";
import { ComplaintForm } from "@/components/ComplaintForm";
import { BOARD } from "@/lib/ethics";
import { decryptField } from "@/lib/crypto";
import { ArrowLeft, Scale, ShieldCheck, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ComplaintPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const c = await db.case.findUnique({ where: { id: caseId } });
  if (!c) notFound();
  if (!(await canAccessCase(c))) notFound(); // hasta yalnız kendi vakası için başvurabilir

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href={`/doktor/vaka/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0EA5B2]">
        <ArrowLeft size={16} /> Vaka detayı
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><Scale size={22} /></span>
        <div>
          <h1 className="text-2xl font-bold text-[#101010]">Tahkim & Etik Denetim</h1>
          <p className="text-sm text-slate-500">{decryptField(c.patientName)} · {c.branch} · bağımsız kurul güvencesi</p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-[1fr_260px]">
        <ComplaintForm caseId={c.id} />

        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Bağımsız Kurul</div>
            <ul className="mt-3 space-y-3">
              {BOARD.map((m) => (
                <li key={m.name} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[#14C3D0] text-xs font-bold text-[#101010]">{m.name.split(" ").slice(-1)[0].slice(0, 1)}</span>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{m.name}</div>
                    <div className="text-xs text-slate-500">{m.role}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-teal-200 bg-teal-50/60 p-5 text-sm text-slate-600">
            <div className="flex items-center gap-1.5 font-semibold text-teal-800"><Lock size={15} /> Escrow güvencesi</div>
            <p className="mt-1.5">Karar verilene dek ödemeniz emanette tutulur.</p>
            <div className="mt-3 flex items-center gap-1.5 font-semibold text-teal-800"><ShieldCheck size={15} /> Anonim inceleme</div>
            <p className="mt-1.5">Kurul kimliğinizi değil, yalnızca tıbbi ve operasyonel veriyi görür.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
