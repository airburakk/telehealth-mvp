import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  DOCTORIUM_MODULES, KIND_LABEL, effectiveBranches, personalFeed, moduleFeed,
  upcomingCongresses, localizeTitles, branchLabel, type FeedItem, type ModuleKey,
} from "@/lib/doctorium";
import { branchColor, hasBranchVisual } from "@/lib/branch-visuals";
import { BranchAvatar } from "@/components/BranchAvatar";
import {
  ArrowLeft, BookOpen, ExternalLink, FlaskConical, Gavel, Info,
  SlidersHorizontal, Sparkles, MapPin,
} from "lucide-react";

export const dynamic = "force-dynamic";

const MODULE_KEYS = new Set(DOCTORIUM_MODULES.map((m) => m.key));

// Doctorium — hekim bilgi portalı (v6.48). Modüller: Akışım (A) · Akademik (C) · Sektörel (B) · Kongre (E).
// Modül D (ilaç tanıtımı/e-mümessil) PARK: TİTCK tanıtım yönetmeliği hukuki görüş ister.
export default async function DoctoriumPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true, newsBranches: true } })
    : null;
  const branches = effectiveBranches(doctor?.newsBranches, doctor?.branch);

  const sp = await searchParams;
  const active: ModuleKey = sp.m && MODULE_KEYS.has(sp.m as ModuleKey) ? (sp.m as ModuleKey) : "akis";

  let items: FeedItem[] = [];
  if (active === "akis") items = await personalFeed(branches);
  else if (active === "akademik") items = await moduleFeed("akademik", branches);
  else if (active === "sektorel") items = await moduleFeed("sektorel", []);
  if (items.length) items = await localizeTitles(items);

  const congresses = active === "kongre" ? await upcomingCongresses(branches) : [];
  const activeDef = DOCTORIUM_MODULES.find((m) => m.key === active)!;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Ana Sayfa
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="aura-display flex items-center gap-2.5 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            <BookOpen size={26} className="text-emerald-300" /> Doctorium
          </h1>
          <p className="mt-1 text-sm text-[var(--c-ink-2)]">{activeDef.desc}</p>
        </div>
        <Link
          href="/doktor/doctorium/tercihler"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--c-hairline)] px-3 py-2 text-xs font-semibold text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
        >
          <SlidersHorizontal size={14} /> Branş tercihleri
          {branches.length > 0 && <span className="aura-mono text-[10px] text-[var(--c-ink-3)]">{branches.length}</span>}
        </Link>
      </div>

      {/* Modül sekmeleri */}
      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Doctorium modülleri">
        {DOCTORIUM_MODULES.map((m) => (
          <Link
            key={m.key}
            href={`/doktor/doctorium?m=${m.key}`}
            aria-current={m.key === active ? "page" : undefined}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              m.key === active
                ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                : "border-[var(--c-hairline)] text-[var(--c-ink-2)] hover:bg-[var(--c-surface)]"
            }`}
          >
            {m.label}
          </Link>
        ))}
      </nav>

      {active === "kongre" ? (
        <CongressList rows={congresses} />
      ) : items.length === 0 ? (
        <EmptyState active={active} />
      ) : (
        <>
          {active === "akis" && branches.length > 0 && (
            <p className="mt-5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--c-ink-3)]">
              <span>Akışınız:</span>
              {branches.map((s) => (
                <span key={s} className="aura-mono rounded-full px-2 py-0.5" style={{ color: branchColor(branchLabel(s)), background: `${branchColor(branchLabel(s))}1f` }}>
                  {branchLabel(s)}
                </span>
              ))}
            </p>
          )}
          <ul className="mt-5 grid gap-3">
            {items.map((it) => <ArticleCard key={it.id} item={it} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function EmptyState({ active }: { active: ModuleKey }) {
  const msg =
    active === "sektorel"
      ? "Henüz sağlıkla ilgili mevzuat kaydı toplanmadı. Resmî Gazete günlük fihristi her gece taranır; sağlık konulu düzenleme yayımlandığı gün burada listelenir."
      : "Henüz içerik toplanmadı. Yayın akışı her gece güncellenir.";
  return (
    <p className="mt-6 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-center text-sm text-[var(--c-ink-2)]">
      <Info size={16} className="mt-0.5 shrink-0" />
      <span className="text-left">{msg}</span>
    </p>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

const KIND_STYLE: Record<string, string> = {
  makale: "bg-violet-500/15 text-violet-300",
  ilac: "bg-emerald-500/15 text-emerald-300",
  mevzuat: "bg-amber-500/15 text-amber-300",
  haber: "bg-sky-500/15 text-sky-300",
};

// Kapak koddan üretilir (dış görsel CSP'de yasak: img-src 'self' data:). Nötr yüzey + branş
// sembolü + 3px şerit → kit renk disiplini korunur (branş rengi yüzeyi boyamaz).
function Cover({ item }: { item: FeedItem }) {
  const first = item.branchSlugs[0];
  const label = first ? branchLabel(first) : null;
  const accent = item.module === "sektorel" ? "#f59e0b" : label ? branchColor(label) : "#34d399";
  return (
    <div
      aria-hidden
      className="relative hidden w-[112px] shrink-0 items-center justify-center overflow-hidden bg-[var(--c-surface-2)] sm:flex"
      style={{ borderRight: `3px solid ${accent}` }}
    >
      <span className="absolute inset-0 opacity-[0.07]" style={{ background: accent }} />
      {item.module === "sektorel" ? (
        <Gavel size={26} style={{ color: accent }} strokeWidth={1.8} />
      ) : label && hasBranchVisual(label) ? (
        <BranchAvatar branchKey={label} size={42} />
      ) : (
        <FlaskConical size={26} style={{ color: accent }} strokeWidth={1.8} />
      )}
    </div>
  );
}

function ArticleCard({ item }: { item: FeedItem }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] transition hover:border-[var(--c-hairline-strong,var(--c-hairline))]">
      <div className="flex">
        <Cover item={item} />
        <div className="min-w-0 flex-1 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.branchSlugs.slice(0, 2).map((s) => (
              <span key={s} className="aura-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: branchColor(branchLabel(s)), background: `${branchColor(branchLabel(s))}1f` }}>
                {branchLabel(s)}
              </span>
            ))}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${KIND_STYLE[item.kind] ?? KIND_STYLE.haber}`}>
              {KIND_LABEL[item.kind] ?? item.kind}
            </span>
            <span className="text-[11px] text-[var(--c-ink-3)]">
              {item.sourceName} · {formatDate(item.publishedAt)}
            </span>
          </div>

          <Link href={`/doktor/doctorium/${item.id}`} className="mt-1.5 block text-sm font-semibold leading-snug text-[var(--c-ink)] hover:underline">
            {item.title}
          </Link>
          {item.titleOriginal && <p className="mt-0.5 text-[11px] italic text-[var(--c-ink-3)]">{item.titleOriginal}</p>}
          {item.authors && <p className="mt-1 text-[11px] text-[var(--c-ink-3)]">{item.authors}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            {item.module === "akademik" && (
              <Link href={`/doktor/doctorium/${item.id}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:underline">
                <Sparkles size={12} /> {item.hasAiSummary ? "Klinik özet" : "2 dk klinik özet"}
              </Link>
            )}
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex max-w-full items-center gap-1 text-[11px] text-[var(--c-accent-stronger)] hover:underline">
                <ExternalLink size={12} className="shrink-0" />
                <span className="aura-mono truncate">{item.doi ? `doi.org/${item.doi}` : "kaynağı aç"}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

interface CongressRow {
  id: string; title: string; organizer: string | null; city: string | null; country: string;
  startDate: Date; endDate: Date | null; abstractDeadline: Date | null; earlyBirdDeadline: Date | null;
  url: string | null; branchSlugs: string;
}

function CongressList({ rows }: { rows: CongressRow[] }) {
  if (!rows.length) {
    return (
      <p className="mt-6 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Kongre takvimi henüz boş. Dernek ve kongre siteleri makine-okunur takvim yayımlamadığı için
          bu modül <strong className="text-[var(--c-ink)]">elle küratörlüdür</strong>; kayıtlar
          yönetici panelinden girilir (uydurma etkinlik listelenmez).
        </span>
      </p>
    );
  }
  return (
    <ul className="mt-5 grid gap-3">
      {rows.map((c) => (
        <li key={c.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--c-ink-3)]">
            <span className="aura-mono rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300">
              {formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : ""}
            </span>
            {(c.city || c.country) && (
              <span className="inline-flex items-center gap-1"><MapPin size={11} />{[c.city, c.country].filter(Boolean).join(", ")}</span>
            )}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold text-[var(--c-ink)]">{c.title}</h3>
          {c.organizer && <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">{c.organizer}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--c-ink-2)]">
            {c.abstractDeadline && <span>Bildiri son: <strong>{formatDate(c.abstractDeadline)}</strong></span>}
            {c.earlyBirdDeadline && <span>Erken kayıt: <strong>{formatDate(c.earlyBirdDeadline)}</strong></span>}
          </div>
          {c.url && (
            <a href={c.url} target="_blank" rel="noopener noreferrer nofollow"
              className="mt-2 inline-flex items-center gap-1 text-[11px] text-[var(--c-accent-stronger)] hover:underline">
              <ExternalLink size={12} /> Kongre sayfası
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
