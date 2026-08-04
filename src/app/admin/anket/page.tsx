import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRANCH_OPTIONS } from "@/lib/doctorium";
import { SURVEY_KIND_LABEL } from "@/lib/survey";
import { SurveyAdmin } from "./SurveyAdminForm";
import { ArrowLeft, BarChart2, Info } from "lucide-react";

export const dynamic = "force-dynamic";

// Doctorium anket küratör paneli (v6.69 Faz 2) — /admin/kampanya deseni.
// Honorarium'lu (ücretli) anket ACTIVE edilemez (API kilidi) — ödeme/vergi kurgusu 👤 bekliyor.
export default async function SurveyAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  const rows = await db.survey.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, kind: true, sponsor: true, question: true, honorarium: true,
      startsAt: true, endsAt: true, status: true, targetBranches: true,
      _count: { select: { responses: true } },
    },
  });
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/doctorium" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Doctorium
      </Link>

      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <BarChart2 size={22} className="text-sky-300" /> Anket yönetimi
      </h1>

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={15} className="mt-px shrink-0" />
        <span>
          Anketler hekimlerin Akışım sekmesinde tek soruluk kart olarak görünür; sonuçlar herkese
          yalnız <strong className="text-[var(--c-ink)]">toplu dağılım</strong> olarak gösterilir.
          <strong className="text-[var(--c-ink)]"> Ücretli (honorarium&#39;lu) anket yayına alınamaz</strong> —
          ödeme/vergi kurgusu netleşene dek kilitli; ücretsiz sponsorlu yoklama yayınlanabilir.
        </span>
      </p>

      <SurveyAdmin
        branchOptions={BRANCH_OPTIONS}
        kindLabel={SURVEY_KIND_LABEL}
        rows={rows.map((r) => ({
          id: r.id, kind: r.kind, sponsor: r.sponsor, question: r.question,
          honorarium: r.honorarium, status: r.status, responses: r._count.responses,
          startsAt: iso(r.startsAt), endsAt: iso(r.endsAt),
          targeted: (r.targetBranches ?? "[]") !== "[]",
        }))}
      />
    </div>
  );
}
