import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, ExternalLink, PlugZap } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  changePct, COMPOSITION_LABEL, relativeShort, summarizeMembers,
  type CompositionKey, type DailyBucket, type DashboardMember, type WaitingKind,
} from "@/lib/admin-dashboard";
import { KPI_METRICS, READINESS_LABEL, SOCIAL_METRIC_LABEL, SOCIAL_PLATFORMS } from "@/lib/admin-social";
import { summarizeSocialMetrics } from "@/lib/social-metrics";
import { todayIsoTr } from "@/lib/iso-day";

export const dynamic = "force-dynamic";
// Sekme başlığı app/admin/layout.tsx şablonundan ("%s · Doctorium"); footer da orada çizilir — burada çizme.
export const metadata = { title: "Pano" };

// Yönetim panosu (👤 2026-10-17; tasarım vault output/dashboard-prototip/doctorium-pano-v2.html — 👤 "v2 düzeni uygun"):
// üstte Doctorium üye analitiği (yeni üyeler + doğrulama durumu), altta beş sosyal medya hesabı, TEK EKRANDA.
// Üye tanımı ve join /admin/uyeler ile AYNIDIR (o sayfanın üç tasarım notu); hesap SAF lib/admin-dashboard.ts'te.
// Sosyal ölçüler SocialMetricDaily'den (n8n → POST /api/social-metrics; son 7 TR günü); satırı gelmeyen platform "—" +
// bağlantı aşamasını çizer, sahte sayı göstermez (lib/admin-social.ts başlığı). İstemci JS'i yok: grafik sunucuda SVG.

// Seri renkleri (dataviz doğrulanmış sıra: mavi · turuncu; gece/gündüz ayrı basamak). Durum renkleri semantik token'dan.
const SERIES_CSS = `
.pano { --s-doc:#3987e5; --s-stu:#d95926; --s-trial:#199e70; --s-lock:#8a6d3b; --s-none:#4b5563; --s-out:#374151; }
.theme-light .pano { --s-doc:#2a78d6; --s-stu:#eb6834; --s-trial:#1baf7a; --s-lock:#b08a4a; --s-none:#9ca3af; --s-out:#d1d5db; }
`;

const COMPOSITION_COLOR: Record<CompositionKey, string> = {
  VERIFIED: "var(--s-doc)", STUDENT: "var(--s-stu)", TRIAL: "var(--s-trial)",
  LOCKED: "var(--s-lock)", UNVERIFIED: "var(--s-none)", OPTED_OUT: "var(--s-out)",
};

// Durum hapı tonu — renk yalnız değil, simge + metinle birlikte.
const COMPOSITION_TONE: Record<CompositionKey, { tone: Tone; icon: string }> = {
  VERIFIED: { tone: "ok", icon: "✓" }, STUDENT: { tone: "ok", icon: "✓" }, TRIAL: { tone: "warn", icon: "◷" },
  LOCKED: { tone: "bad", icon: "✕" }, UNVERIFIED: { tone: "warn", icon: "◷" }, OPTED_OUT: { tone: "muted", icon: "–" },
};
const WAITING_TONE: Record<WaitingKind, Tone> = { trial: "warn", locked: "bad", "student-email": "warn" };

type Tone = "ok" | "warn" | "bad" | "muted";
const TONE_CLASS: Record<Tone, string> = {
  ok: "text-[var(--c-success)] border-[color-mix(in_srgb,var(--c-success)_40%,transparent)]",
  warn: "text-[var(--c-warning)] border-[color-mix(in_srgb,var(--c-warning)_40%,transparent)]",
  bad: "text-[var(--c-danger)] border-[color-mix(in_srgb,var(--c-danger)_40%,transparent)]",
  muted: "text-[var(--c-ink-3)] border-[var(--c-hairline)]",
};

const fmt = (n: number) => n.toLocaleString("tr-TR");
/** "2026-10-17" → "17.10" */
const shortDay = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

// Saat React Compiler purity kuralı yüzünden bileşen gövdesinin DIŞINDA alınır (uyeler/page.tsx timeWindows notu).
function requestNow() {
  return new Date();
}

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  const now = requestNow();

  // deletedAt: null — silinmiş hesap üye sayılmaz. Doctor↔User arasında relation YOK → iki sorgu + Map (uyeler notu 1).
  const doctorUsers = await db.user.findMany({
    where: { role: "DOCTOR", deletedAt: null, doctorId: { not: null } },
    select: { id: true, doctorId: true, createdAt: true, name: true },
  });
  const ids = doctorUsers.map((u) => u.doctorId).filter((id): id is string => !!id);
  const profiles = ids.length
    ? await db.doctor.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, studentTrack: true, verified: true, activatedAt: true, branch: true, city: true, studentUniversity: true,
          // TierStamps'in dördü ZORUNLU (lib/doctorium-tiers) — biri unutulursa derleme patlar, kapı sessizce yanılmaz.
          diplomaVerifiedAt: true, studentVerifiedAt: true, doctoriumOptOutAt: true, trialEndsAt: true,
        },
      })
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const members: DashboardMember[] = doctorUsers.flatMap((u) => {
    const p = u.doctorId ? byId.get(u.doctorId) : undefined;
    return p ? [{ userId: u.id, name: u.name, createdAt: u.createdAt, p }] : [];
  });

  const s = summarizeMembers(members, now);

  // Sosyal ölçüler (v6.351): n8n'in /api/social-metrics ile ittiği günlük satırlar; son 7 TR günü özetlenir.
  // Gün kolonu metin ("YYYY-MM-DD") → sözlük sırası takvim sırasıdır, `gte` doğrudan çalışır.
  const todayTr = todayIsoTr(now);
  const socialRows = await db.socialMetricDaily.findMany({
    where: { day: { gte: todayIsoTr(new Date(now.getTime() - 8 * 86_400_000)) } },
    select: {
      platform: true, day: true, followers: true, reach: true, views: true, likes: true, comments: true,
      saves: true, shares: true, profileClicks: true, posts: true,
    },
  });
  const social = summarizeSocialMetrics(socialRows, todayTr);
  const anyConnected = Object.values(social).some((x) => x.connected);
  const stamp = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" }).format(now);

  return (
    <div className="pano doctorium-scope mx-auto max-w-[1400px] px-5 pb-6 pt-3">
      <style>{SERIES_CSS}</style>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> Yönetim
        </Link>
        <h1 className="text-lg font-bold tracking-tight text-[var(--c-ink)]">Pano</h1>
        <span className="flex-1" />
        <span className="rounded-full border border-[var(--c-hairline)] px-2.5 py-0.5 font-mono text-[11px] text-[var(--c-ink-2)]">
          Canlı veri · {stamp}
        </span>
      </div>

      {/* ═══ 01 · ÜYELER ═══ */}
      <Band n="01" title="Üyeler" sub="Doctorium üye tabanı — yalnız hesabı olan profiller; silinmiş hesaplar sayılmaz">
        <Link href="/admin/uyeler" className="text-[11px] font-medium uppercase tracking-wider text-[var(--c-accent)] hover:underline">
          Üye analitiği →
        </Link>
      </Band>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr_1fr_1.1fr]">
        <Panel className="sm:col-span-2 xl:col-span-1">
          <div className="grid items-end gap-x-5 gap-y-3 sm:grid-cols-[auto_1fr]">
            <div>
              <Label>Toplam üye</Label>
              <div className="mt-1.5 text-[40px] font-extrabold leading-none tracking-tight tabular-nums text-[var(--c-ink)]">{fmt(s.total)}</div>
              <div className="mt-1.5 text-[11.5px] text-[var(--c-ink-3)]">Kayıt yolu: {fmt(s.doctors)} doktor · {fmt(s.students)} öğrenci</div>
            </div>
            <div>
              {/* Bileşim KAYIT YOLU değil bugünkü erişim katmanıdır (lib/doctorium-tiers) — doktor yolundan kayıtlı biri
                  öğrenci damgası taşıyabilir (DEV'de ölçüldü), iki sayı bu yüzden bilinçli olarak ayrı etiketlenir. */}
              <div className="mb-1.5 text-[10.5px] text-[var(--c-ink-3)]">Bugünkü erişim katmanı</div>
              {s.total > 0 && (
                <div className="mb-2 flex h-2 gap-0.5 overflow-hidden rounded" role="img" aria-label="Üye bileşimi">
                  {s.composition.map((c) => (
                    <span key={c.key} style={{ width: `${(c.value / s.total) * 100}%`, background: COMPOSITION_COLOR[c.key] }} title={`${COMPOSITION_LABEL[c.key]}: ${fmt(c.value)}`} />
                  ))}
                </div>
              )}
              <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-[var(--c-ink-2)]">
                {s.composition.map((c) => (
                  <li key={c.key} className="inline-flex items-center gap-1.5">
                    <Swatch color={COMPOSITION_COLOR[c.key]} />
                    {COMPOSITION_LABEL[c.key]} <b className="font-semibold tabular-nums text-[var(--c-ink)]">{fmt(c.value)}</b>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>

        {s.windows.map((w) => {
          const d = changePct(w.total, w.previous);
          return (
            <Panel key={w.label}>
              <Label>{w.label}</Label>
              <div className="mb-1.5 mt-2 text-[26px] font-bold leading-none tracking-tight tabular-nums text-[var(--c-ink)]">+{fmt(w.total)}</div>
              <div className="mb-1.5 text-[11.5px] font-semibold">
                {d === null ? (
                  <span className="font-normal text-[var(--c-ink-3)]">önceki dönem: {fmt(w.previous)}</span>
                ) : (
                  <span className={d >= 0 ? "text-[var(--c-success)]" : "text-[var(--c-danger)]"}>
                    {d >= 0 ? "▲" : "▼"} %{Math.abs(d)} <span className="font-normal text-[var(--c-ink-3)]">önceki: {fmt(w.previous)}</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-x-2.5 text-[10.5px] text-[var(--c-ink-3)]">
                <span className="inline-flex items-center gap-1"><Swatch color="var(--s-doc)" small /> Doktor {w.doctors}</span>
                <span className="inline-flex items-center gap-1"><Swatch color="var(--s-stu)" small /> Öğrenci {w.students}</span>
              </div>
            </Panel>
          );
        })}

        <Panel>
          <Label>Doğrulama bekleyen</Label>
          <div className="mb-1.5 mt-2 text-[26px] font-bold leading-none tracking-tight tabular-nums text-[var(--c-warning)]">
            {fmt(s.waiting.trial + s.waiting.studentEmail + s.waiting.locked)}
          </div>
          <div className="flex flex-col gap-0.5 text-[11px] text-[var(--c-ink-3)]">
            <span>{fmt(s.waiting.trial)} deneme süresinde</span>
            <span>{fmt(s.waiting.studentEmail)} öğrenci e-postası bekliyor</span>
            <span>{fmt(s.waiting.locked)} deneme doldu (kilitli)</span>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
        <Panel className="flex flex-col lg:col-span-2 xl:col-span-1">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[12.5px] font-semibold text-[var(--c-ink)]">
              Günlük yeni üye <span className="font-normal text-[var(--c-ink-3)]">· son 30 gün</span>
            </h2>
            <div className="flex gap-3 text-[11.5px] text-[var(--c-ink-2)]">
              <span className="inline-flex items-center gap-1.5"><Swatch color="var(--s-doc)" /> Doktor</span>
              <span className="inline-flex items-center gap-1.5"><Swatch color="var(--s-stu)" /> Öğrenci</span>
            </div>
          </div>
          <DailyChart data={s.daily} />
        </Panel>

        <Panel>
          <h2 className="text-[12.5px] font-semibold text-[var(--c-ink)]">Doğrulama durumu</h2>
          <p className="mb-2.5 text-[11.5px] text-[var(--c-ink-3)]">Bağımsız eksenler — her biri kendi tabanına oranlanır, huni değildir</p>
          <ul className="flex flex-col gap-2">
            {s.axes.map((a) => {
              const pct = a.base ? Math.round((a.value / a.base) * 100) : 0;
              return (
                <li key={a.label} title={a.note}>
                  <div className="flex justify-between gap-3 text-[11.5px]">
                    <span className="text-[var(--c-ink-2)]">{a.label}</span>
                    <span className="font-semibold tabular-nums text-[var(--c-ink)]">
                      {fmt(a.value)}<span className="font-normal text-[var(--c-ink-3)]"> / {fmt(a.base)} · %{pct}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--c-surface-2)]">
                    <span className="block h-full rounded bg-[var(--c-accent-fill)]" style={{ width: `${pct}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3 border-t border-[var(--c-hairline)] pt-2">
            <Label>En acil bekleyenler</Label>
            {s.waiting.rows.length === 0 ? (
              <p className="py-2 text-[11.5px] text-[var(--c-ink-3)]">Bekleyen üye yok.</p>
            ) : (
              <ul>
                {s.waiting.rows.map((r) => (
                  <li key={r.userId} className="flex items-center gap-2 border-b border-dashed border-[var(--c-hairline)] py-1.5 text-[11.5px] last:border-b-0">
                    <span className="min-w-0 flex-1 truncate text-[var(--c-ink)]">{r.name}</span>
                    <Pill tone={WAITING_TONE[r.kind]}>{r.detail}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[12.5px] font-semibold text-[var(--c-ink)]">Son katılanlar</h2>
            <Link href="/admin/uyeler" className="text-[10.5px] font-medium uppercase tracking-wider text-[var(--c-accent)] hover:underline">Tümü →</Link>
          </div>
          {s.recent.length === 0 ? (
            <p className="py-3 text-[11.5px] text-[var(--c-ink-3)]">Henüz üye yok.</p>
          ) : (
            <ul className="mt-1">
              {s.recent.map((r) => {
                const t = COMPOSITION_TONE[r.composition];
                return (
                  <li key={r.userId} className="flex items-center gap-2 border-b border-dashed border-[var(--c-hairline)] py-1.5 text-[11.5px] last:border-b-0">
                    <Swatch color={r.student ? "var(--s-stu)" : "var(--s-doc)"} small label={r.student ? "Öğrenci" : "Doktor"} />
                    <span className="min-w-0 flex-1 truncate">
                      <b className="font-semibold text-[var(--c-ink)]">{r.name}</b>
                      {r.where && <span className="text-[var(--c-ink-3)]"> {r.where}</span>}
                    </span>
                    <Pill tone={t.tone}>{t.icon} {COMPOSITION_LABEL[r.composition]}</Pill>
                    <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--c-ink-3)]">{relativeShort(r.createdAt, now)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* ═══ 02 · SOSYAL MEDYA ═══ */}
      {/* Uzun açıklama başlıkta durur (title) — tek ekran hedefi için bant tek satır kalır. */}
      <Band n="02" title="Sosyal medya" sub="Beş hesap · erişim, beğeni ve kaydetme">
        {anyConnected ? (
          <span
            className="rounded-full border border-[var(--c-hairline)] px-2.5 py-0.5 text-[11px] text-[var(--c-ink-2)]"
            title="Değerler son 7 Türkiye günü toplamıdır; takipçi = dönemdeki son bilinen sayı ve dönem içi fark. Veriyi n8n günlük olarak /api/social-metrics ucuna iter; '—' = platform bu ölçüyü göndermedi."
          >
            Son 7 gün · n8n aktarımı
          </span>
        ) : (
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[color-mix(in_srgb,var(--c-warning)_45%,transparent)] px-2.5 py-0.5 text-[11px] text-[var(--c-warning)]"
          title="Platform ölçüleri henüz bu panoya aktarılmıyor: yayın jetonları otomasyon sunucusunda (n8n) duruyor ve uygulama hiçbir platform API'sine bağlı değil. Sayılar uydurulmaz — her kart ölçünün hangi kaynaktan geleceğini ve bağlantının hangi aşamada olduğunu gösterir. Yayınların gönderildiğinin kanıtı sabah yayın kontrolü raporundadır."
        >
          <PlugZap size={12} /> Ölçüler henüz bağlı değil — sayı uydurulmaz
        </span>
        )}
      </Band>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {SOCIAL_PLATFORMS.map((p) => (
          <Panel key={p.key} className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface-2)] text-xs font-extrabold text-[var(--c-ink)]">
                {p.mark}
              </span>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold leading-tight text-[var(--c-ink)]">{p.name}</div>
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-[var(--c-ink-3)] hover:text-[var(--c-ink)]">
                    {p.handle} <ExternalLink size={10} />
                  </a>
                ) : (
                  <span className="text-[10.5px] text-[var(--c-ink-3)]">Doctorium</span>
                )}
              </div>
              <span className="ml-auto">
                {social[p.key].lastDay ? (
                  <Pill tone="ok">✓ Son veri {shortDay(social[p.key].lastDay!)}</Pill>
                ) : (
                  <Pill tone={p.readiness === "n8n" ? "ok" : p.readiness === "token" ? "muted" : "warn"}>{READINESS_LABEL[p.readiness]}</Pill>
                )}
              </span>
            </div>

            <dl className="grid grid-cols-3 gap-x-2 gap-y-2">
              {p.metrics.map((m) => {
                const sum = social[p.key];
                const v = m === "followers" ? sum.followers : sum.totals[m];
                const delta = m === "followers" ? sum.followersDelta : null;
                return (
                  <div key={m} className="flex flex-col">
                    {v === null ? (
                      <dd className="text-sm font-semibold text-[var(--c-ink-3)]" aria-label="veri yok">—</dd>
                    ) : (
                      <dd className="text-sm font-semibold tabular-nums text-[var(--c-ink)]">
                        {fmt(v)}
                        {delta !== null && delta !== 0 && (
                          <span className={`ml-1 text-[10px] font-medium ${delta > 0 ? "text-[var(--c-success)]" : "text-[var(--c-danger)]"}`}>
                            {delta > 0 ? "+" : "−"}{fmt(Math.abs(delta))}
                          </span>
                        )}
                      </dd>
                    )}
                    <dt className={`text-[9.5px] uppercase tracking-wider ${KPI_METRICS.has(m) ? "text-[var(--c-accent)]" : "text-[var(--c-ink-3)]"}`}>
                      {SOCIAL_METRIC_LABEL[m]}
                    </dt>
                  </div>
                );
              })}
            </dl>

            <p className="truncate text-[10.5px] text-[var(--c-ink-3)]" title={`${p.source} — ${p.readinessNote}`}>
              <span className="text-[var(--c-ink-2)]">{p.source}</span> — {p.readinessNote}
            </p>

            <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[var(--c-hairline)] pt-2">
              <Label>Plan</Label>
              {p.schedule.map((x) => (
                <Pill key={x.time} tone="muted"><Clock size={10} /> {x.time} {x.what}</Pill>
              ))}
            </div>
          </Panel>
        ))}
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[var(--c-ink-3)]">
        <span className="text-[var(--c-accent)]">●</span> Vurgulu ölçüler 13.10 kararındaki asıl başarı ölçüleridir (kaydetme · profil tıklaması · yorum) — takipçi sayısı değil.
      </p>
    </div>
  );
}

// ── Parçalar ────────────────────────────────────────────────────────────────────────────────

function Band({ n, title, sub, children }: { n: string; title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2.5 mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="rounded-md bg-[color-mix(in_srgb,var(--c-accent)_14%,transparent)] px-1.5 py-px font-mono text-[11px] text-[var(--c-accent)]">{n}</span>
      <h2 className="text-[15px] font-bold tracking-tight text-[var(--c-ink)]">{title}</h2>
      {sub && <p className="hidden text-xs text-[var(--c-ink-3)] sm:block">{sub}</p>}
      <span className="hidden h-px flex-1 bg-[var(--c-hairline)] sm:block" />
      {children}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3.5 ${className}`}>{children}</section>;
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--c-ink-3)]">{children}</div>;
}

function Swatch({ color, small, label }: { color: string; small?: boolean; label?: string }) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`inline-block shrink-0 rounded-sm ${small ? "h-1.5 w-1.5" : "h-2 w-2"}`}
      style={{ background: color }}
    />
  );
}

function Pill({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-px text-[10.5px] ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

// Yığılı sütun grafiği — sunucuda SVG. Alt dilim doktor, üst dilim öğrenci; 2px yüzey boşluğu; üstte 3px yuvarlak uç.
// İpucu: her gün sütununun tamamını kaplayan şeffaf dikdörtgende yerel <title> (istemci JS'i yok).
function DailyChart({ data }: { data: DailyBucket[] }) {
  const W = 720, H = 210, L = 28, B = 20, T = 8;
  const iw = W - L - 2, ih = H - B - T;
  const peak = Math.max(1, ...data.map((d) => d.doctors + d.students));
  const step = peak <= 5 ? 1 : Math.ceil(peak / 5);
  const max = step * Math.ceil(peak / step);
  const ticks = Array.from({ length: max / step + 1 }, (_, i) => i * step);
  const bw = iw / data.length;
  const barW = Math.max(3, bw - 3);
  const y = (v: number) => T + ih - (v / max) * ih;
  const dayLabel = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
  const longLabel = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" });

  const capped = (x: number, top: number, h: number, fill: string, key: string) => {
    if (h <= 0) return null;
    const r = Math.min(3, h / 2);
    return <path key={key} d={`M${x},${top + h} v${-(h - r)} q0,-${r} ${r},-${r} h${barW - 2 * r} q${r},0 ${r},${r} v${h - r} z`} fill={fill} />;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Son 30 günde günlük yeni üye sayısı, doktor ve öğrenci">
      <g fontSize="10" fontFamily="var(--font-mono), monospace" fill="var(--c-ink-3)">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W} y1={y(v)} y2={y(v)} stroke="var(--c-hairline)" />
            <text x={L - 6} y={y(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}
        {data.map((d, i) =>
          i % 6 === 5 || i === data.length - 1 ? (
            <text key={d.day} x={L + i * bw + 1.5 + barW / 2} y={H - 5} textAnchor="middle">{dayLabel(d.day)}</text>
          ) : null,
        )}
      </g>
      {data.map((d, i) => {
        const x = L + i * bw + 1.5;
        const docTop = y(d.doctors);
        const docH = T + ih - docTop;
        const stuTop = y(d.doctors + d.students);
        const stuH = docTop - stuTop - (d.doctors ? 2 : 0);
        return (
          <g key={d.day}>
            {d.students
              ? <>
                  {d.doctors > 0 && <rect x={x} y={docTop} width={barW} height={docH} fill="var(--s-doc)" />}
                  {capped(x, stuTop, stuH, "var(--s-stu)", "s")}
                </>
              : capped(x, docTop, docH, "var(--s-doc)", "d")}
            <rect x={L + i * bw} y={T} width={bw} height={ih} fill="transparent">
              <title>{`${longLabel(d.day)}\nDoktor: ${d.doctors}\nÖğrenci: ${d.students}\nToplam: ${d.doctors + d.students}`}</title>
            </rect>
          </g>
        );
      })}
    </svg>
  );
}
