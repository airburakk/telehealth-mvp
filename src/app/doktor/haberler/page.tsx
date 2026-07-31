import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { newsForBranch, NEWS_KIND_LABEL, type NewsItem } from "@/lib/medical-news";
import { ArrowLeft, Newspaper } from "lucide-react";

export const dynamic = "force-dynamic";

// Haberler — ayrı sayfa (2026-07-31, kullanıcı kararı: ana sayfa panelinden üst banda taşındı).
// İçerik lib/medical-news stub'ı: genel tıp gündemi + (doktorsa) branşa özel kartlar.
export default async function DoctorNewsPage() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  // Branşa özel kartlar için bağlı doktor profili (personelde yok → yalnız genel gündem).
  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true } })
    : null;
  const news = newsForBranch(doctor?.branch);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Ana Sayfa
      </Link>

      <div className="mt-3">
        <h1 className="aura-display flex items-center gap-2.5 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
          <Newspaper size={26} className="text-emerald-300" /> Haberler
        </h1>
        <p className="mt-1 text-sm text-[var(--c-ink-2)]">
          {doctor?.branch ? `Genel tıp gündemi + ${doctor.branch}` : "Genel tıp gündemi"}
        </p>
      </div>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {news.map((n) => <NewsCard key={n.id} item={n} />)}
      </ul>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const kindColor: Record<string, string> = {
    haber: "bg-sky-500/15 text-sky-300",
    makale: "bg-violet-500/15 text-violet-300",
    ilac: "bg-emerald-500/15 text-emerald-300",
  };
  return (
    <li className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${kindColor[item.kind]}`}>{NEWS_KIND_LABEL[item.kind]}</span>
        <span className="text-[11px] text-[var(--c-ink-3)]">{item.source}</span>
      </div>
      <div className="mt-1.5 text-sm font-semibold text-[var(--c-ink)]">{item.title}</div>
      <p className="mt-1 text-xs text-[var(--c-ink-2)]">{item.summary}</p>
    </li>
  );
}
