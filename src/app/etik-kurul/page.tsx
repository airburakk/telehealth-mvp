import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { maskCaseId, REQUEST_TYPES, COMPLAINT_STATUS } from "@/lib/ethics";
import { formatDateTime } from "@/lib/constants";
import { Scale, ArrowRight, Inbox, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const ETHICS_ROLES = ["ETHICS", "ADMIN"];

export default async function EthicsBoard() {
  // Derinlemesine savunma (2026-07-12): proxy /etik-kurul'u TOKEN roluyle korur (DB'siz). Şikayet
  // kuyruğu + doktor doğrulama sayımları çekildiği için getCurrentUser (DB-rol otoriter) kapısı ŞART.
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/etik-kurul");
  if (!ETHICS_ROLES.includes(user.role)) redirect("/");

  // PENDING tümü (iş kuyruğu — kaçırılmamalı) + RESOLVED en güncel 50 (arşiv büyüse de liste sabit).
  // Sıralama DB'de (orderBy); in-memory sort kaldırıldı. Listede yalnız kartın kullandığı case.branch taşınır.
  const [pendingRows, resolvedRows, total, resolved, pendingDoctors] = await Promise.all([
    db.complaint.findMany({
      where: { status: "PENDING" },
      include: { case: { select: { branch: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.complaint.findMany({
      where: { status: "RESOLVED" },
      include: { case: { select: { branch: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.complaint.count(),
    db.complaint.count({ where: { status: "RESOLVED" } }),
    db.doctor.count({ where: { verified: false } }),
  ]);

  const rows = [...pendingRows, ...resolvedRows]; // PENDING üstte
  const pending = pendingRows.length;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Scale size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Tahkim & Etik Denetim Kurulu</h1>
          <p className="text-sm text-[var(--c-ink-2)]">Bağımsız ombudsmanlık — başvurular anonimleştirilmiş olarak incelenir.</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-lg bg-[var(--c-accent)]/10 px-3 py-2 text-xs text-[var(--c-accent)] ring-1 ring-[var(--c-accent)]/20">
        <ShieldCheck size={15} /> Veri maskeleme aktif: kurul hasta kimliğini değil, yalnızca vaka ve operasyon verisini görür.
      </div>

      <Link href="/admin/hekim-onay" className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-4 transition hover:border-[var(--c-accent)]/40 hover:shadow-sm">
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-300"><ShieldCheck size={18} /></span>
          <span>
            <span className="block text-sm font-semibold text-[var(--c-ink)]">Doktor Doğrulama Onayı</span>
            <span className="block text-xs text-[var(--c-ink-2)]">Kaydolan doktorları inceleyip doğrulayın</span>
          </span>
        </span>
        <span className="flex items-center gap-2">
          {pendingDoctors > 0 && <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-bold text-amber-300">{pendingDoctors} bekliyor</span>}
          <ArrowRight size={16} className="text-[var(--c-ink-3)]" />
        </span>
      </Link>

      <div className="mt-5 grid grid-cols-3 gap-3 sm:max-w-md">
        <Stat label="Toplam başvuru" value={total} />
        <Stat label="Beklemede" value={pending} tone="text-amber-300" />
        <Stat label="Karara bağlandı" value={resolved} tone="text-emerald-300" />
      </div>

      <div className="mt-6 space-y-2.5">
        {rows.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
            <Inbox className="mx-auto mb-2" /> Başvuru yok.
          </div>
        )}
        {rows.map((c) => {
          const st = COMPLAINT_STATUS[c.status] ?? COMPLAINT_STATUS.PENDING;
          return (
            <Link
              key={c.id}
              href={`/etik-kurul/${c.id}`}
              className={`group flex items-center gap-4 rounded-2xl border bg-[var(--c-panel)] p-4 transition hover:shadow-sm ${c.status === "PENDING" ? "border-amber-400/25" : "border-[var(--c-hairline)] hover:border-[var(--c-accent)]/30"}`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--c-ink)]/10 text-[var(--c-ink-2)]"><Scale size={20} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-semibold text-[var(--c-ink)]">{maskCaseId(c.caseId)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.color}`}>{st.label}</span>
                </div>
                <div className="mt-0.5 truncate text-sm text-[var(--c-ink-2)]">{c.subject}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[var(--c-ink-3)]">
                  <span className="font-medium text-[var(--c-accent-strong)]">{REQUEST_TYPES[c.requestType]}</span>
                  <span>· {c.case.branch}</span>
                  <span>· {formatDateTime(c.createdAt)}</span>
                </div>
              </div>
              <ArrowRight size={18} className="shrink-0 text-[var(--c-ink-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--c-accent-strong)]" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3.5">
      <div className={`text-2xl font-bold ${tone ?? "text-[var(--c-ink)]"}`}>{value}</div>
      <div className="text-xs text-[var(--c-ink-2)]">{label}</div>
    </div>
  );
}
