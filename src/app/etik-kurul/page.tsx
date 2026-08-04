import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Scale, ArrowRight, ShieldCheck } from "lucide-react";
import { EthicsList, type ComplaintListRow } from "./EthicsList";

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

  // 2026-08-04: liste + stat'lar client bileşene çıktı (EthicsList) — sayılar tıklanır filtre oldu
  // (post-op RecoveryList deseni). PENDING üstte; satır DTO'su yalnız kartın kullandığı alanları taşır.
  const rows: ComplaintListRow[] = [...pendingRows, ...resolvedRows].map((c) => ({
    id: c.id,
    caseId: c.caseId,
    status: c.status,
    subject: c.subject,
    requestType: c.requestType,
    createdAt: c.createdAt.toISOString(),
    branch: c.case.branch,
  }));
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

      <EthicsList rows={rows} total={total} pending={pending} resolved={resolved} />
    </div>
  );
}
