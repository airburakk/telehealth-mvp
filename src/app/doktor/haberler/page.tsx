import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fetchBranchNews, NEWS_KIND_LABEL, type NewsItem } from "@/lib/medical-news";
import { branchColor, hasBranchVisual } from "@/lib/branch-visuals";
import { BranchAvatar } from "@/components/BranchAvatar";
import { LANG_BCP47 } from "@/lib/constants";
import { ArrowLeft, Newspaper, ExternalLink, FlaskConical, Info } from "lucide-react";

// Sayfa kullanıcıya özel (oturum + branş) → dinamik. Ama PubMed fetch'leri Data Cache'te
// (per-fetch revalidate: 1 sa) durmalı: force-dynamic tek başına fetch'i no-store'a düşürür,
// bu yüzden fetchCache AÇIKÇA geri açılır — yoksa her sayfa açılışı NCBI'ya gider (~10 sn).
export const dynamic = "force-dynamic";
export const fetchCache = "default-cache";

// Haberler — ayrı sayfa (2026-07-31'de ana sayfa panelinden çıktı; v6.47'de canlı PubMed beslemesi).
// Branş yayınları ÖNDE, ardından genel tıp gündemi. Makale kartlarında gerçek DOI/PubMed bağlantısı.
export default async function DoctorNewsPage() {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({ where: { id: me.doctorId }, select: { branch: true } })
    : null;
  const branch = doctor?.branch ?? null;
  const { items, live, branchCovered } = await fetchBranchNews(branch);

  const mine = items.filter((n) => n.branch);
  const general = items.filter((n) => !n.branch);

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
          {live
            ? branch && branchCovered
              ? `${branch} yayınları önce, ardından genel tıp gündemi · kaynak PubMed`
              : "Genel tıp gündemi · kaynak PubMed"
            : "Örnek içerik — canlı yayın akışına şu anda ulaşılamadı"}
        </p>
      </div>

      {/* Besleme erişilemediğinde dürüst uyarı: kartlar ÖRNEK, bağlantı verilmez. */}
      {!live && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200">
          <Info size={15} className="mt-px shrink-0" />
          Aşağıdaki kartlar tanıtım amaçlı örnek içeriktir; gerçek yayın değildir ve kaynak bağlantısı taşımaz.
          Canlı akış (PubMed) yeniden erişilebilir olduğunda otomatik olarak gerçek yayınlar listelenir.
        </p>
      )}

      {live && branch && !branchCovered && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
          <Info size={15} className="mt-px shrink-0" />
          {branch} için tanımlı literatür sorgusu yok — şimdilik genel tıp gündemi gösteriliyor.
        </p>
      )}

      {mine.length > 0 && (
        <section className="mt-7">
          <h2 className="aura-mono text-[11px] uppercase tracking-[0.14em] text-[var(--c-ink-3)]">Branşınızdan</h2>
          <ul className="mt-3 grid gap-3">
            {mine.map((n) => <NewsCard key={n.id} item={n} />)}
          </ul>
        </section>
      )}

      <section className="mt-7">
        <h2 className="aura-mono text-[11px] uppercase tracking-[0.14em] text-[var(--c-ink-3)]">
          {mine.length > 0 ? "Genel tıp gündemi" : "Gündem"}
        </h2>
        <ul className="mt-3 grid gap-3">
          {general.map((n) => <NewsCard key={n.id} item={n} />)}
        </ul>
      </section>
    </div>
  );
}

const KIND_STYLE: Record<string, string> = {
  haber: "bg-sky-500/15 text-sky-300",
  makale: "bg-violet-500/15 text-violet-300",
  ilac: "bg-emerald-500/15 text-emerald-300",
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(LANG_BCP47["Türkçe"] ?? "tr-TR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Okuma süresi: özet uzunluğundan kaba tahmin (~200 kelime/dk); özet yoksa gösterilmez.
function readMinutes(summary: string): number | null {
  const words = summary.trim().split(/\s+/).filter(Boolean).length;
  return words > 40 ? Math.max(1, Math.round(words / 200)) : null;
}

// Kapak: koddan üretilir (dış görsel CSP'de yasak — img-src 'self' data:). Nötr koyu yüzey +
// branş sembolü + 3px kulvar şeridi → kit renk disiplini korunur (branş rengi yüzeyi BOYAMAZ).
// AI üretimi gerçek kapak görselleri eklenirse buraya <Image> olarak binebilir (alan hazır).
function NewsCover({ item }: { item: NewsItem }) {
  const accent = item.branch ? branchColor(item.branch) : "#34d399";
  return (
    <div
      aria-hidden
      className="relative hidden w-[124px] shrink-0 items-center justify-center overflow-hidden bg-[var(--c-surface-2)] sm:flex"
      style={{ borderRight: `3px solid ${accent}` }}
    >
      <span className="absolute inset-0 opacity-[0.07]" style={{ background: accent }} />
      {/* BranchAvatar görseli tanımsız branşta null döner → sembolsüz kapak kalmasın diye nöbet ikonu. */}
      {item.branch && hasBranchVisual(item.branch) ? (
        <BranchAvatar branchKey={item.branch} size={44} />
      ) : (
        <FlaskConical size={28} style={{ color: accent }} strokeWidth={1.8} />
      )}
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const mins = readMinutes(item.summary);
  const date = formatDate(item.date);
  return (
    <li className="overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]">
      <div className="flex">
        <NewsCover item={item} />
        <div className="min-w-0 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.branch && (
              <span
                className="aura-mono rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ color: branchColor(item.branch), background: `${branchColor(item.branch)}1f` }}
              >
                {item.branch}
              </span>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${KIND_STYLE[item.kind]}`}>
              {NEWS_KIND_LABEL[item.kind]}
            </span>
            <span className="text-[11px] text-[var(--c-ink-3)]">
              {item.source}
              {date && ` · ${date}`}
              {mins && ` · ${mins} dk`}
            </span>
          </div>

          <h3 className="mt-1.5 text-sm font-semibold leading-snug text-[var(--c-ink)]">{item.title}</h3>
          {item.titleOriginal && (
            <p className="mt-0.5 text-[11px] italic text-[var(--c-ink-3)]">{item.titleOriginal}</p>
          )}
          {item.summary && <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-ink-2)]">{item.summary}</p>}
          {item.authors && <p className="mt-1.5 text-[11px] text-[var(--c-ink-3)]">{item.authors}</p>}

          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-2 inline-flex max-w-full items-center gap-1.5 text-[11px] text-[var(--c-accent-stronger)] hover:underline"
            >
              <ExternalLink size={13} className="shrink-0" />
              <span className="aura-mono truncate">{item.doi ? `doi.org/${item.doi}` : item.url.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
