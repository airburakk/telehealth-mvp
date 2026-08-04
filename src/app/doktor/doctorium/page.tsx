import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activeCampaignsFor, countImpressions, SPONSOR_CONSENT_TEXT, CATEGORY_LABEL as SPONSOR_CATEGORY_LABEL,
  type SponsorCard,
} from "@/lib/sponsor";
import {
  DOCTORIUM_MODULES, KIND_LABEL, RANGE_OPTIONS, DEFAULT_RANGE, rangeDays,
  SECTOR_CATEGORIES, categoryLabel,
  effectiveBranches, personalFeed, moduleFeed, singleBranchFeed, upcomingCongresses,
  localizeTitles, branchLabel, followedCongressIds, BRANCH_OPTIONS, parseBranchPrefs,
  slugForLabel, parseScope, type FeedItem, type ModuleKey,
} from "@/lib/doctorium";
import { branchColor, hasBranchVisual } from "@/lib/branch-visuals";
import { BranchAvatar } from "@/components/BranchAvatar";
import { DoctoriumFilters } from "./DoctoriumFilters";
import { FollowButton } from "./CongressControls";
import { ProspektusSearch } from "./ProspektusSearch";
import {
  ArrowLeft, ExternalLink, FlaskConical, Gavel, Info,
  Sparkles, MapPin, X, CalendarClock, Pill, Building2, Megaphone,
} from "lucide-react";
import { AuraMark } from "@/components/PortamedLogo";

export const dynamic = "force-dynamic";

// Sekme başlığı "Doctorium · AURA" — kök layout template'i (%s · AURA) ekler, ELLE " · AURA" YAZMA
// (v6.43 dersi: çift-AURA olur).
export const metadata = { title: "Doctorium" };

const MODULE_KEYS = new Set(DOCTORIUM_MODULES.map((m) => m.key));
const VALID_SLUGS = new Set(BRANCH_OPTIONS.map((b) => b.slug));

// Doctorium — doktor bilgi portalı. Modüller: Akışım (A) · Akademik (C) · Sektörel (B) · Kongre (E).
// Modül D (ilaç tanıtımı/e-mümessil) PARK: TİTCK tanıtım yönetmeliği hukuki görüş ister.
export default async function DoctoriumPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string; b?: string; c?: string; s?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({
        where: { id: me.doctorId },
        select: {
          id: true, branch: true, newsBranches: true, city: true,
          congressAlertDays: true,
          // v6.62: bildiri ve erken kayıt eşikleri AYRI (eski congressDeadlineAlertDays okunmuyor).
          congressAbstractAlertDays: true, congressEarlyBirdAlertDays: true,
          // v6.68: sponsorlu içerik kişiselleştirme rızası (city hedefleme için birlikte okunur).
          sponsorPersonalizationAt: true,
        },
      })
    : null;
  const branches = effectiveBranches(doctor?.newsBranches, doctor?.branch);

  const sp = await searchParams;
  const active: ModuleKey = sp.m && MODULE_KEYS.has(sp.m as ModuleKey) ? (sp.m as ModuleKey) : "akis";
  const range = RANGE_OPTIONS.some((r) => r.key === sp.d) ? (sp.d as string) : DEFAULT_RANGE;
  // Tek-branş odağı (akış çipine tıklama): yalnız doktorun AKIŞINDAKİ branşlar seçilebilir —
  // rastgele slug ile başka branşın akışı URL'den açılmasın (tutarlı kişiselleştirme).
  const focus = sp.b && VALID_SLUGS.has(sp.b) && branches.includes(sp.b) ? sp.b : null;

  const cat = sp.c && SECTOR_CATEGORIES.some((x) => x.key === sp.c) ? sp.c : null;

  let items: FeedItem[] = [];
  if (active === "akis") items = focus ? await singleBranchFeed(focus) : await personalFeed(branches, 40);
  else if (active === "akademik") items = await moduleFeed("akademik", branches);
  else if (active === "mevzuat") items = await moduleFeed("mevzuat", [], { days: rangeDays(range), category: cat });
  else if (active === "sektorel") items = await moduleFeed("sektorel", [], { days: rangeDays(range), category: cat });
  else if (active === "ilac") items = await moduleFeed("ilac", [], { days: rangeDays(range) });
  if (items.length) items = await localizeTitles(items);

  const scope = parseScope(sp.s);
  const congresses = active === "kongre" ? await upcomingCongresses(branches, { scope }) : [];
  const followed = active === "kongre" && doctor ? await followedCongressIds(doctor.id) : new Set<string>();

  // v6.68 Faz 1: sponsorlu kartlar YALNIZ Akışım'da (diğer sekmeler temiz kalır) ve boş akışa
  // basılmaz. Kişiselleştirilmiş seçim yalnız AÇIK RIZALI doktorda (sponsorPersonalizationAt);
  // rızasız doktor + personel hedefsiz (bağlamsal) kampanya görür. Sayaç agregat (kişisiz).
  const sponsorPersonalized = !!doctor?.sponsorPersonalizationAt;
  const sponsorCards: SponsorCard[] =
    active === "akis" && items.length > 0
      ? await activeCampaignsFor({ personalized: sponsorPersonalized, branches, city: doctor?.city ?? null })
      : [];
  if (sponsorCards.length) await countImpressions(sponsorCards.map((c) => c.id));

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Ana Sayfa
      </Link>

      <div className="mt-3">
        {/* L1 lockup (kullanıcı kararı 2026-08-01): zümrüt AURA sembolü + "ium" vurgusu.
            Mesafe (kullanıcı, 2. tur): gap-2.5 + sembolün doğal viewBox payı = ferah aralık —
            DARALTMA (bitişik -mr denemesi geri alındı). -ml yalnız sol hizayı korur. */}
        <h1 className="aura-display flex items-center gap-2.5 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
          <AuraMark size={36} tone="emerald" className="-ml-1.5" />
          <span>Doctor<span className="doctorium-ium">ium</span></span>
        </h1>
        {/* Sabit slogan (kullanıcı seçimi 2026-08-01) — sekmeye göre değişen desc satırı kalktı
            ("Branşınız + mevzuat…" kuru bulundu). desc alanı veri modelinde durur, burada basılmaz. */}
        <p className="mt-1 text-sm text-[var(--c-ink-2)]">Bilim, sizin ritminizde.</p>
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

      {/* TEK "Özelleştir" penceresi (v6.52): aralık · kategori · kongre alarmı · branş tercihleri.
          Önceden ayrı satırlardaydı ve dağınık duruyordu (kullanıcı bildirimi).
          Bölüm yoksa bileşen hiç çizilmez (ör. Akademik) — boş panel açılmasın. */}
      <DoctoriumFilters
        module={active}
        showRange={active === "mevzuat" || active === "sektorel" || active === "ilac"}
        showCategory={active === "mevzuat" || active === "sektorel"}
        showAlerts={active === "kongre" && !!doctor}
        showScope={active === "kongre"}
        scope={scope}
        rangeKey={range}
        rangeOptions={RANGE_OPTIONS}
        category={cat}
        categoryOptions={SECTOR_CATEGORIES}
        /* Branş tercihi akışa FİİLEN etki eden sekmelerde: Akışım + Akademik + **Kongre** (v6.62
           düzeltmesi — kongre listesi upcomingCongresses(branches) ile v6.48'den beri branşa göre
           süzülüyordu ama seçici burada çizilmediği için doktor GÖREMEDİĞİ bir filtreyle eksik
           liste görüyordu; eski yorum "kongre branşa göre süzülmez" diyerek koddan sapmıştı).
           Mevzuat/sektörel/ilaç gerçekten branşa göre süzülmez. */
        branchOptions={
          (active === "akis" || active === "akademik" || active === "kongre") && doctor ? BRANCH_OPTIONS : null
        }
        branchInitial={parseBranchPrefs(doctor?.newsBranches)}
        ownBranchSlug={slugForLabel(doctor?.branch)}
        alertStart={doctor?.congressAlertDays ?? null}
        alertAbstract={doctor?.congressAbstractAlertDays ?? null}
        alertEarlyBird={doctor?.congressEarlyBirdAlertDays ?? null}
        showSponsor={active === "akis" && !!doctor}
        sponsorInitial={sponsorPersonalized}
        sponsorText={SPONSOR_CONSENT_TEXT}
      />

      {active === "ilac" && <ProspektusSearch />}

      {active === "kongre" ? (
        <CongressList rows={congresses} followed={followed} canFollow={!!doctor} />
      ) : (
        <>
          {/* Akışım: branş çipleri — tıklanınca YALNIZ o branş listelenir */}
          {active === "akis" && branches.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-[var(--c-ink-3)]">Akışınız:</span>
              {branches.map((s) => {
                const on = focus === s;
                const c = branchColor(branchLabel(s));
                return (
                  <Link
                    key={s}
                    href={on ? "/doktor/doctorium" : `/doktor/doctorium?b=${s}`}
                    aria-current={on ? "true" : undefined}
                    className="aura-mono inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition"
                    style={
                      on
                        ? { color: c, background: `${c}2e`, boxShadow: `inset 0 0 0 1px ${c}` }
                        : { color: c, background: `${c}14` }
                    }
                  >
                    {branchLabel(s)}
                    {on && <X size={11} />}
                  </Link>
                );
              })}
              {focus && (
                <Link href="/doktor/doctorium" className="text-[11px] text-[var(--c-ink-3)] underline hover:text-[var(--c-ink)]">
                  tümünü göster
                </Link>
              )}
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState active={active} focus={focus} range={range} />
          ) : (
            <ul className="mt-5 grid gap-3">
              {/* Sponsorlu kart enjeksiyonu (v6.68): 1.si 2 organik karttan, 2.si 9 organikten
                  sonra; akış kısaysa listenin sonuna düşer (frekans tavanı MAX_FEED_CARDS=2). */}
              {items.map((it, i) => (
                <Fragment key={it.id}>
                  {i === 2 && sponsorCards[0] && <SponsorCardView c={sponsorCards[0]} />}
                  {i === 9 && sponsorCards[1] && <SponsorCardView c={sponsorCards[1]} />}
                  <ArticleCard item={it} />
                </Fragment>
              ))}
              {items.length <= 2 && sponsorCards[0] && <SponsorCardView c={sponsorCards[0]} />}
              {items.length <= 9 && sponsorCards[1] && <SponsorCardView c={sponsorCards[1]} />}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function EmptyState({ active, focus, range }: { active: ModuleKey; focus: string | null; range: string }) {
  const label = RANGE_OPTIONS.find((r) => r.key === range)?.label.toLocaleLowerCase("tr-TR") ?? "";
  const msg = focus
    ? `${branchLabel(focus)} için henüz yayın toplanmadı. Akış her gece güncellenir.`
    : active === "mevzuat"
      ? `Seçtiğiniz ${label} pencerede bu kategoride mevzuat kaydı yok. Resmî Gazete + OHSAD her gece taranır; daha geniş aralık veya "Tümü" kategorisini deneyin.`
      : active === "sektorel"
        ? `Seçtiğiniz ${label} pencerede bu kategoride sektörel haber yok. Daha geniş bir aralık deneyebilirsiniz.`
        : active === "ilac"
          ? `Seçtiğiniz ${label} pencerede ilaç/cihaz kaydı yok. Geri çekme ve klinik faz akışı her gece güncellenir.`
          : "Henüz içerik toplanmadı. Yayın akışı her gece güncellenir.";
  return (
    <p className="mt-6 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
      <Info size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
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
  const accent = item.module === "mevzuat" ? "#f59e0b"
    : item.module === "ilac" ? "#22d3ee"
    : item.module === "sektorel" ? "#a78bfa"
    : label ? branchColor(label) : "#34d399";
  return (
    <div
      aria-hidden
      className="relative hidden w-[112px] shrink-0 items-center justify-center overflow-hidden bg-[var(--c-surface-2)] sm:flex"
      style={{ borderRight: `3px solid ${accent}` }}
    >
      <span className="absolute inset-0 opacity-[0.07]" style={{ background: accent }} />
      {item.module === "mevzuat" ? (
        <Gavel size={26} style={{ color: accent }} strokeWidth={1.8} />
      ) : item.module === "ilac" ? (
        <Pill size={26} style={{ color: accent }} strokeWidth={1.8} />
      ) : item.module === "sektorel" ? (
        <Building2 size={26} style={{ color: accent }} strokeWidth={1.8} />
      ) : label && hasBranchVisual(label) ? (
        <BranchAvatar branchKey={label} size={42} />
      ) : (
        <FlaskConical size={26} style={{ color: accent }} strokeWidth={1.8} />
      )}
    </div>
  );
}

// Sponsorlu kart (v6.68 Faz 1): organik karttan NET görsel+metinsel ayrım — kesikli amber çerçeve
// + "Sponsorlu · <reklamveren>" mono rozet (iddia dürüstlüğü: doğal içerik görünümü verilmez;
// çerçeve sözleşme taslağı Belge 2 md.2a). Renk disiplini korunur: amber yalnız şerit/rozet, yüzey
// boyanmaz. Tıklama /api/sponsor/click üzerinden sayılır (agregat) → dış bağlantı rel="sponsored".
function SponsorCardView({ c }: { c: SponsorCard }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-dashed border-amber-400/40 bg-[var(--c-surface)]">
      <div className="flex">
        <div
          aria-hidden
          className="relative hidden w-[112px] shrink-0 items-center justify-center overflow-hidden bg-[var(--c-surface-2)] sm:flex"
          style={{ borderRight: "3px solid #f59e0b" }}
        >
          <span className="absolute inset-0 opacity-[0.07]" style={{ background: "#f59e0b" }} />
          <Megaphone size={26} style={{ color: "#f59e0b" }} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1 px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="aura-mono rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              Sponsorlu · {c.sponsor}
            </span>
            <span className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[10px] text-[var(--c-ink-2)]">
              {SPONSOR_CATEGORY_LABEL[c.category] ?? c.category}
            </span>
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--c-ink)]">{c.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{c.body}</p>
          {c.linkUrl && (
            <a
              href={`/api/sponsor/click?id=${c.id}`}
              target="_blank"
              rel="sponsored noopener"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:underline"
            >
              {c.linkLabel || "Ayrıntılar"} <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function ArticleCard({ item }: { item: FeedItem }) {
  return (
    <li className="overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)]">
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
            {categoryLabel(item.category) && (
              <span className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[10px] text-[var(--c-ink-2)]">
                {categoryLabel(item.category)}
              </span>
            )}
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
  scope: string; venue: string | null; warning: string | null; confidence: string;
}

function CongressList({ rows, followed, canFollow }: { rows: CongressRow[]; followed: Set<string>; canFollow: boolean }) {
  if (!rows.length) {
    return (
      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Seçtiğiniz branş ve kapsamda yaklaşan kongre yok. Kapsam filtresini
          <strong className="text-[var(--c-ink)]"> Tümü</strong> yapmayı ya da Özelleştir'den branş
          tercihlerinizi genişletmeyi deneyin.
        </span>
      </p>
    );
  }
  return (
    <ul className="mt-5 grid gap-3">
      {rows.map((c) => (
        <li key={c.id} className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--c-ink-3)]">
                <span className="aura-mono rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300">
                  {formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : ""}
                </span>
                {/* Kapsam rozeti: doktorun ilk baktığı ayrım (yurt içi mi, yurt dışı mı). */}
                <span className="aura-mono rounded-full border border-[var(--c-hairline)] px-2 py-0.5">
                  {c.scope === "uluslararasi" ? "🌍 Uluslararası" : "🇹🇷 Ulusal"}
                </span>
                {(c.city || c.country) && (
                  <span className="inline-flex items-center gap-1"><MapPin size={11} />{[c.city, c.country].filter(Boolean).join(", ")}</span>
                )}
              </div>
              <h3 className="mt-1.5 text-sm font-semibold text-[var(--c-ink)]">
                <Link href={`/doktor/doctorium/kongre/${c.id}`} className="hover:underline">{c.title}</Link>
              </h3>
              {c.organizer && <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">{c.organizer}</p>}
            </div>
            {canFollow && <FollowButton congressId={c.id} following={followed.has(c.id)} />}
          </div>

          {(c.abstractDeadline || c.earlyBirdDeadline) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--c-ink-2)]">
              {c.abstractDeadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={11} /> Bildiri son: <strong>{formatDate(c.abstractDeadline)}</strong>
                </span>
              )}
              {c.earlyBirdDeadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={11} /> Erken kayıt: <strong>{formatDate(c.earlyBirdDeadline)}</strong>
                </span>
              )}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href={`/doktor/doctorium/kongre/${c.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-accent-stronger)] hover:underline">
              Kongre kartı →
            </Link>
            {c.url && (
              <a href={c.url} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-[11px] text-[var(--c-ink-2)] hover:underline">
                <ExternalLink size={12} /> Resmî site
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
