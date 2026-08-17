import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { BRANCH_OPTIONS } from "@/lib/doctorium";
import { CATEGORY_LABEL } from "@/lib/sponsor";
import { SponsorAdmin } from "./SponsorForm";
import { ArrowLeft, Info, Megaphone } from "lucide-react";

export const dynamic = "force-dynamic";

// Doctorium sponsorlu kampanya küratör paneli (v6.68 Faz 1) — /admin/kongre deseni.
// YALNIZ İLAÇ-DIŞI reklamveren (kategori listesi lib/sponsor.ts; İLAÇ yok — Modül D parkı).
// Reklamveren sözleşmesi imzalanmadan kampanya AKTİF edilmemeli (⚖️ taslak: vault output
// doctorium-hukuki-taslaklar-2026-08-04.md Belge 2) — bilgi kutusunda hatırlatılır.
export default async function SponsorAdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  const rows = await db.sponsorCampaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true, sponsor: true, category: true, title: true, body: true,
      linkUrl: true, linkLabel: true, targetBranches: true, targetCities: true,
      startsAt: true, endsAt: true, status: true, impressions: true, clicks: true,
    },
  });
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/doctorium" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Doctorium
      </Link>

      <h1 className="aura-display mt-3 flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <Megaphone size={22} className="text-amber-300" /> Sponsorlu kampanya yönetimi
      </h1>

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={15} className="mt-px shrink-0" />
        <span>
          Kartlar doktorların Doctorium → Akışım sekmesinde <strong className="text-[var(--c-ink)]">&quot;Sponsorlu&quot;</strong> rozetiyle
          görünür. Yalnız <strong className="text-[var(--c-ink)]">ilaç-dışı</strong> reklamveren kabul edilir (ilaç tanıtımı = Modül D,
          hukuki görüş bekliyor). Kampanyayı AKTİF etmeden önce reklamveren çerçeve sözleşmesinin
          imzalı olduğundan emin olun. Branş/şehir hedefi yalnız açık rıza vermiş doktorlara uygulanır;
          hedefsiz kampanya herkese gösterilir.
        </span>
      </p>

      <SponsorAdmin
        branchOptions={BRANCH_OPTIONS}
        categoryLabel={CATEGORY_LABEL}
        rows={rows.map((r) => ({
          id: r.id, sponsor: r.sponsor, category: r.category, title: r.title,
          status: r.status, impressions: r.impressions, clicks: r.clicks,
          startsAt: iso(r.startsAt), endsAt: iso(r.endsAt),
          targeted: (r.targetBranches ?? "[]") !== "[]" || (r.targetCities ?? "[]") !== "[]",
        }))}
      />
    </div>
  );
}
