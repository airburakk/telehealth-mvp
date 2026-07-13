import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decryptField } from "@/lib/crypto"; // triyaj semptom/gerekçe at-rest şifreli (E2EE Faz 1 inc.2) → çöz
import { maskCaseId, REQUEST_TYPES, VERDICTS, ACTIONS, ESCROW_STATUS } from "@/lib/ethics";
import { formatUSD } from "@/lib/pricing";
import { urgencyStyle, formatDateTime } from "@/lib/constants";
import { DecisionForm } from "@/components/DecisionForm";
import { ArrowLeft, Scale, FileText, Sparkles, Lock, Gavel, ShieldCheck, EyeOff } from "lucide-react";

export const dynamic = "force-dynamic";

const ETHICS_ROLES = ["ETHICS", "ADMIN"];

export default async function ComplaintDetail({ params }: { params: Promise<{ id: string }> }) {
  // Derinlemesine savunma (2026-07-12): proxy TOKEN roluyle korur; bu detay şikayet + ÇÖZÜLMÜŞ triyaj
  // semptom/gerekçesini (decryptField) gösterdiğinden getCurrentUser (DB-rol otoriter) kapısı ŞART.
  // Yetkisiz → notFound (varlık sızdırmaz; detay-sayfa deseni doktor/vaka/[id] ile aynı).
  const user = await getCurrentUser();
  if (!user || !ETHICS_ROLES.includes(user.role)) notFound();

  const { id } = await params;
  const c = await db.complaint.findUnique({ where: { id }, include: { case: true } });
  if (!c) notFound();
  const booking = c.bookingId ? await db.booking.findUnique({ where: { id: c.bookingId } }) : null;

  const u = urgencyStyle(c.case.urgency);
  const resolved = c.status === "RESOLVED";
  const esc = booking ? ESCROW_STATUS[booking.escrowStatus] ?? ESCROW_STATUS.HELD : null;

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/etik-kurul" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-accent-strong)]">
        <ArrowLeft size={16} /> Kurul başvuruları
      </Link>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><Scale size={22} /></span>
          <div>
            <h1 className="font-mono text-xl font-bold text-[var(--c-ink)]">{maskCaseId(c.caseId)}</h1>
            <p className="text-sm text-[var(--c-ink-2)]">{REQUEST_TYPES[c.requestType]} · {formatDateTime(c.createdAt)}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--c-ink)]/10 px-3 py-1 text-xs font-medium text-[var(--c-ink-2)]">
          <EyeOff size={13} /> Kimlik gizli
        </span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Sol: başvuru + anonim vaka */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]"><FileText size={15} /> Başvuru</div>
            <h2 className="mt-2 font-bold text-[var(--c-ink)]">{c.subject}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--c-ink)]">{c.description}</p>
            {c.evidence && <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--c-ink)]/10 px-2.5 py-1 text-xs text-[var(--c-ink-2)]"><FileText size={13} /> {c.evidence}</div>}
          </div>

          <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]"><ShieldCheck size={15} /> Anonim Vaka Verisi</div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-lg bg-[var(--c-surface)] px-2.5 py-1 text-sm font-semibold text-[var(--c-ink)] ring-1 ring-white/10">{c.case.branch}</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${u.badge}`}>
                <span className={`h-2 w-2 rounded-full ${u.dot}`} /> Aciliyet {c.case.urgency}/5
              </span>
            </div>
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">Şikayet (triyaj)</div>
              <p className="mt-1 text-sm text-[var(--c-ink)]">{decryptField(c.case.symptoms)}</p>
            </div>
            <div className="mt-3 rounded-lg bg-[var(--c-accent)]/10 p-3 ring-1 ring-[var(--c-accent)]/20">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-accent)]"><Sparkles size={13} /> AI gerekçe</div>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{decryptField(c.case.reasoning)}</p>
            </div>
          </div>

          {/* Karar (resolved) */}
          {resolved && (
            <div className="rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-6">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300"><Gavel size={15} /> Kurul Kararı</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {c.verdict && <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${VERDICTS[c.verdict].color}`}>{VERDICTS[c.verdict].label}</span>}
                {c.action && <span className="rounded-lg bg-[var(--c-panel)] px-2.5 py-1 text-xs font-medium text-[var(--c-ink)] ring-1 ring-white/10">{ACTIONS[c.action]}</span>}
                {c.refundAmount ? <span className="rounded-lg bg-[var(--c-accent)]/15 px-2.5 py-1 text-xs font-semibold text-[var(--c-accent)]">İade: {formatUSD(c.refundAmount)}</span> : null}
              </div>
              {c.rationale && <p className="mt-3 text-sm leading-relaxed text-[var(--c-ink)]">{c.rationale}</p>}
              <div className="mt-3 text-xs text-[var(--c-ink-2)]">İmza: <strong className="text-[var(--c-ink)]">{c.decidedBy}</strong> · {c.decidedAt ? formatDateTime(c.decidedAt) : ""}</div>
            </div>
          )}
        </div>

        {/* Sağ: Escrow + karar formu */}
        <aside className="space-y-4">
          {booking && esc && (
            <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-2)]"><Lock size={15} /> İlgili Rezervasyon</div>
              <div className="mt-2 text-2xl font-bold text-[var(--c-ink)]">{formatUSD(booking.total)}</div>
              <div className="mt-1 text-xs text-[var(--c-ink-2)]">{booking.tier} paket</div>
              <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${esc.color}`}>
                <span className={`h-2 w-2 rounded-full ${esc.dot}`} /> {esc.label}
              </div>
            </div>
          )}

          {resolved ? (
            <div className="rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5 text-sm text-[var(--c-ink-2)] shadow-sm">
              Bu başvuru karara bağlandı. Yaptırım Escrow üzerinde uygulandı.
            </div>
          ) : (
            <DecisionForm complaintId={c.id} bookingTotal={booking?.total ?? null} />
          )}
        </aside>
      </div>
    </div>
  );
}
