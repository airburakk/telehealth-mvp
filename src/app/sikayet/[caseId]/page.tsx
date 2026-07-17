import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
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
  const user = await getCurrentUser();
  const isStaff = !!user && ["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* Geri link rol-duyarlı: hasta /doktor/vaka'ya giremez → kendi başvuru merkezine döner (v6.20) */}
      <Link href={isStaff ? `/doktor/vaka/${c.id}` : `/vaka/${c.id}`} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> {isStaff ? "Vaka detayı" : "Başvuru detayı"}
      </Link>

      <div className="mt-4 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Scale size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Tahkim & Etik Denetim</h1>
          <p className="text-sm text-[var(--c-ink-2)]">{decryptField(c.patientName)} · {c.branch} · bağımsız kurul güvencesi</p>
        </div>
      </div>

      <div className="mt-7 grid gap-5 sm:grid-cols-[1fr_260px]">
        <ComplaintForm caseId={c.id} />

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
            <div className="aura-mono text-[11px] uppercase tracking-[0.2em] text-[var(--c-ink-2)]">Bağımsız Kurul</div>
            <ul className="mt-3 space-y-3">
              {BOARD.map((m) => (
                <li key={m.name} className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--c-accent)] text-xs font-bold text-[var(--c-bg)]">{m.name.split(" ").slice(-1)[0].slice(0, 1)}</span>
                  <div>
                    <div className="text-sm font-medium text-[var(--c-ink)]">{m.name}</div>
                    <div className="text-xs text-[var(--c-ink-2)]">{m.role}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl border border-[var(--c-accent)]/25 bg-[var(--c-accent)]/10 p-5 text-sm text-[var(--c-ink-2)]">
            <div className="flex items-center gap-1.5 font-semibold text-[var(--c-accent)]"><Lock size={15} /> Escrow güvencesi</div>
            <p className="mt-1.5">Karar verilene dek ödemeniz emanette tutulur.</p>
            <div className="mt-3 flex items-center gap-1.5 font-semibold text-[var(--c-accent)]"><ShieldCheck size={15} /> Anonim inceleme</div>
            <p className="mt-1.5">Kurul kimliğinizi değil, yalnızca tıbbi ve operasyonel veriyi görür.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
