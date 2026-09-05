import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { approvedTusGuides, findApprovedTusGuide, TUS_GUIDE_DISCLAIMER } from "@/lib/tus-guides";
import { formatIsoDayTr } from "@/lib/iso-day";
import { DoctoriumShell } from "../../../DoctoriumSidebar";
import { PageHeader } from "@/components/ui/PageHeader";
import { TUS_HREF } from "../../../CareerEduSections";
import { TUS_REHBER_HREF } from "../../../TusGuideResourcePanels";

export const dynamic = "force-dynamic";

/**
 * TUS REHBERİ (K3, 2026-09-05) — ÖSYM kılavuzunun bir bölümünün RESMÎ ÖZETİ (👤 karar: "yalnız resmî kılavuz özetleri").
 * Veri lib/tus-guides (saf; approvedAt dolu rehberler) — onaysız/bilinmeyen slug 404. Her bölüm kılavuz madde numarasını taşır;
 * sayfa altında "bağlayıcı olan kılavuz metnidir" dipnotu. Yorum/strateji YOK. Rafta Kariyer aktif (TUS sayfası gibi derin bağlantı).
 */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const g = findApprovedTusGuide(slug);
  return { title: g ? `${g.title} · TUS` : "TUS" };
}

export default async function TusGuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const { slug } = await params;
  const g = findApprovedTusGuide(slug);
  if (!g) notFound();
  const others = approvedTusGuides().filter((x) => x.slug !== g.slug);

  return (
    <DoctoriumShell active="kariyer">
      <div className="mx-auto max-w-3xl px-5 py-8">
        <Link href={TUS_HREF} className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> TUS
        </Link>

        <PageHeader className="mt-5" eyebrow="KARİYER · TUS · REHBER" title={g.title} sub={g.summary} />

        <p className="aura-mono mt-3 text-[11px] uppercase tracking-wider text-[var(--c-ink-3)]">
          Kaynak:{" "}
          <a href={g.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 normal-case tracking-normal text-[var(--c-ink-2)] hover:text-[var(--c-accent)]">
            {g.sourceLabel} <ExternalLink size={11} aria-hidden />
          </a>{" "}
          · doğrulama {formatIsoDayTr(g.verifiedAt)}
        </p>

        <div className="mt-6 space-y-4">
          {g.sections.map((s) => (
            <section key={s.heading} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h2 className="text-[16px] font-semibold tracking-tight text-[var(--c-ink)]">{s.heading}</h2>
                <span className="aura-mono text-[10.5px] uppercase tracking-wider text-[var(--c-ink-3)]">kılavuz madde {s.ref}</span>
              </div>
              {s.paragraphs.map((p, i) => (
                <p key={i} className="mt-2 max-w-[72ch] text-[14px] leading-relaxed text-[var(--c-ink-2)]">{p}</p>
              ))}
              {s.items && (
                <ul className="mt-2 max-w-[72ch] list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[var(--c-ink-2)]">
                  {s.items.map((it, i) => <li key={i}>{it}</li>)}
                </ul>
              )}
            </section>
          ))}
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-[var(--c-ink-3)]">{TUS_GUIDE_DISCLAIMER}</p>

        {others.length > 0 && (
          <nav className="mt-8" aria-label="Diğer rehberler">
            <h2 className="aura-mono text-[11px] font-bold tracking-[0.16em] text-[var(--c-ink-3)]">DİĞER REHBERLER</h2>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {others.map((o) => (
                <li key={o.slug}>
                  <Link href={TUS_REHBER_HREF(o.slug)} className="text-[13.5px] font-semibold text-[var(--c-ink)] hover:text-[var(--c-accent)]">{o.title}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </DoctoriumShell>
  );
}
