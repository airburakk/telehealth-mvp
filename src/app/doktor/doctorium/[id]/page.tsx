import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { articleById, ensureClinicalSummary, KIND_LABEL, branchLabel } from "@/lib/doctorium";
import { branchColor } from "@/lib/branch-visuals";
import { ArrowLeft, ExternalLink, Sparkles, AlertTriangle, FlaskConical, ListChecks, ShieldQuestion } from "lucide-react";

export const dynamic = "force-dynamic";

// Doctorium yayın detayı — 2 dakikalık Türkçe klinik özet burada TEMBEL üretilir (ilk açılışta bir kez,
// sonra DB'den). Okunmayan yayınlar için AI parası ödenmez.
export default async function DoctoriumArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const { id } = await params;
  const item = await articleById(id);
  if (!item) notFound();

  const summary = await ensureClinicalSummary(id);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/doktor/doctorium" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Doctorium
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1">
        {item.branchSlugs.map((s) => (
          <span key={s} className="aura-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ color: branchColor(branchLabel(s)), background: `${branchColor(branchLabel(s))}1f` }}>
            {branchLabel(s)}
          </span>
        ))}
        <span className="text-[11px] text-[var(--c-ink-3)]">
          {KIND_LABEL[item.kind] ?? item.kind} · {item.sourceName} ·{" "}
          {item.publishedAt.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
        </span>
      </div>

      <h1 className="aura-display mt-2 text-2xl font-medium leading-snug tracking-tight text-[var(--c-ink)]">{item.title}</h1>
      {item.titleOriginal && <p className="mt-1 text-sm italic text-[var(--c-ink-3)]">{item.titleOriginal}</p>}
      {item.authors && <p className="mt-2 text-xs text-[var(--c-ink-2)]">{item.authors}</p>}

      {/* AI klinik özet — varsa. Uyarı bandı KALDIRILAMAZ: bu bir karar destek aracı değildir. */}
      {summary && (
        <section className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <Sparkles size={16} /> 2 dakikalık klinik özet
          </h2>

          <div className="mt-3.5">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
              <ListChecks size={13} /> Ana çıkarımlar
            </h3>
            <ul className="mt-1.5 grid gap-1.5">
              {summary.takeaways.map((t, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-[var(--c-ink)]">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                <FlaskConical size={13} /> Çalışma tasarımı
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{summary.design}</p>
            </div>
            <div>
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
                <ShieldQuestion size={13} /> Kısıtlılıklar
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{summary.limits}</p>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 border-t border-emerald-400/20 pt-3 text-[11px] leading-relaxed text-amber-200/90">
            <AlertTriangle size={13} className="mt-px shrink-0" />
            Bu özet yapay zekâ ile üretilmiştir ve <strong>klinik karar aracı değildir</strong>. Hasta
            bakımına ilişkin her karardan önce yayının tam metnini kendiniz değerlendirin.
          </p>
        </section>
      )}

      {item.summary && (
        <section className="mt-6">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
            Özgün abstract
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--c-ink-2)]">{item.summary}</p>
        </section>
      )}

      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer nofollow"
          className="mt-7 inline-flex items-center gap-2 rounded-xl border border-[var(--c-hairline)] px-4 py-2.5 text-sm font-semibold text-[var(--c-accent-stronger)] hover:bg-[var(--c-surface)]">
          <ExternalLink size={15} />
          {item.doi ? "Yayının tam metnine git (DOI)" : "Kaynağa git"}
        </a>
      )}
    </div>
  );
}
