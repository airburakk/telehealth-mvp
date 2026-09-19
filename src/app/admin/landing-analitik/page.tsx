import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { STUDENT_CLICK_PLACEMENTS, STUDENT_FUNNEL_SINCE, studentFunnel, type StudentFunnel } from "@/lib/doctorium-landing/student-funnel";
import { ArrowLeft, MousePointerClick, Info, Inbox, GraduationCap } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Landing Analitiği" };

const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", timeZone: "Europe/Istanbul" });
const sinceFmt = new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Istanbul" });

// Doctorium vitrini tıklama/görüntülenme raporu (2026-08-26, todo.md madde 5) — LandingEvent
// (lib/doctorium-landing/events.ts + api/landing-event/route.ts) v6.149'dan beri DB'de birikiyordu,
// okuma tarafı yoktu. /admin/registry-raporu deseni: sunucu bileşeni doğrudan agregat sorgular.
export default async function LandingAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  const [byName, byPlacement, dayGroups, funnelRows] = await Promise.all([
    db.landingEvent.groupBy({ by: ["name"], _sum: { count: true }, orderBy: { _sum: { count: "desc" } } }),
    db.landingEvent.groupBy({ by: ["name", "placement"], _sum: { count: true }, orderBy: { _sum: { count: "desc" } }, take: 60 }),
    db.landingEvent.groupBy({ by: ["day"] }),
    // Öğrenci hunisi (2026-09-19): yalnız ilgili satırlar — Öğrenciler bölümü · öğrenci düğmesi · ziyaret tabanı · hero.
    db.landingEvent.findMany({
      where: {
        day: { gte: STUDENT_FUNNEL_SINCE },
        OR: [{ placement: "ogrenci" }, { name: "student_click" }, { name: "landing_view" }, { name: "section_view", placement: "hero" }],
      },
      select: { name: true, placement: true, day: true, count: true },
    }),
  ]);
  const funnel = studentFunnel(funnelRows);

  const grandTotal = byName.reduce((s, r) => s + (r._sum.count ?? 0), 0);
  const maxByName = byName[0]?._sum.count ?? 0;
  const days = dayGroups.map((d) => d.day).sort((a, b) => a.getTime() - b.getTime());
  const placementCount = new Set(byPlacement.map((r) => r.placement)).size;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Yönetim
      </Link>

      <div className="mt-3 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]"><MousePointerClick size={22} /></span>
        <div>
          <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Landing Analitiği</h1>
          <p className="text-sm text-[var(--c-ink-2)]">Doctorium vitrininin tıklama ve görüntülenme sayaçları.</p>
        </div>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs text-[var(--c-ink-2)]">
        <Info size={14} className="mt-0.5 shrink-0" />
        First-party agregat: yalnız (olay, yerleşim, gün) başına sayaç birikir — kimlik, çerez, IP,
        UA ya da URL hiç kaydedilmez. Bu yüzden anonim ziyaretçiden onam istenmez (iddia kaydı,
        hukuk onayı 2026-08-23).
      </p>

      {grandTotal === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
          <Inbox className="mx-auto mb-2" /> Henüz veri yok — <code>/doctorium</code> ziyaret edilince <code>POST /api/landing-event</code> ile birikmeye başlar.
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <MiniStat label="Toplam olay" value={grandTotal} />
            <MiniStat label="Olay türü" value={byName.length} />
            <MiniStat label="Yerleşim" value={placementCount} />
          </div>
          {days.length > 0 && (
            <p className="mt-2 text-xs text-[var(--c-ink-3)]">
              {dayFmt.format(days[0])} – {dayFmt.format(days[days.length - 1])} arası, {days.length} gün.
            </p>
          )}

          <StudentFunnelPanel funnel={funnel} />

          <h2 className="aura-mono mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-ink-3)]">
            Olay türüne göre toplam
          </h2>
          <div className="mt-3 space-y-2">
            {byName.map((r) => {
              const total = r._sum.count ?? 0;
              const pct = maxByName > 0 ? Math.round((total / maxByName) * 100) : 0;
              return (
                <div key={r.name} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="aura-mono truncate text-[var(--c-ink)]">{r.name}</span>
                    <span className="shrink-0 font-semibold text-[var(--c-ink)]">{total.toLocaleString("tr-TR")}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                    <div className="h-full rounded-full bg-[var(--c-accent)]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <h2 className="aura-mono mt-8 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-ink-3)]">
            Olay × yerleşim dökümü
          </h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--c-hairline)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--c-surface)] text-[11px] uppercase tracking-wide text-[var(--c-ink-3)]">
                <tr>
                  <th className="px-3.5 py-2 font-medium">Olay</th>
                  <th className="px-3.5 py-2 font-medium">Yerleşim</th>
                  <th className="px-3.5 py-2 text-right font-medium">Toplam</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--c-hairline)]">
                {byPlacement.map((r) => (
                  <tr key={`${r.name}:${r.placement}`}>
                    <td className="aura-mono px-3.5 py-2 text-[var(--c-ink-2)]">{r.name}</td>
                    <td className="aura-mono px-3.5 py-2 text-[var(--c-ink-2)]">{r.placement}</td>
                    <td className="px-3.5 py-2 text-right font-medium text-[var(--c-ink)]">{(r._sum.count ?? 0).toLocaleString("tr-TR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Öğrenci hunisi (2026-09-19) — 09 Öğrenciler bölümü (v6.262) için gözlem paneli: bölümü görenler → öğrenci düğmesine
// tıklayanlar. Sayılar lib/doctorium-landing/student-funnel (saf, birim testli); örneklem eşiğinin altında oranlar yorumlanmaz.
function StudentFunnelPanel({ funnel }: { funnel: StudentFunnel }) {
  const pct = (r: number | null) => (r === null ? "—" : `%${Math.round(r * 100).toLocaleString("tr-TR")}`);
  const placements = STUDENT_CLICK_PLACEMENTS.map((k) => `${k} ${(funnel.clicksByPlacement[k] ?? 0).toLocaleString("tr-TR")}`).join(" · ");
  return (
    <section className="mt-8" aria-labelledby="ogrenci-hunisi">
      <h2 id="ogrenci-hunisi" className="aura-mono flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-ink-3)]">
        <GraduationCap size={13} /> Öğrenci hunisi
      </h2>
      <p className="mt-1 text-xs text-[var(--c-ink-3)]">
        Öğrenciler bölümü (v6.262), {sinceFmt.format(funnel.since)} tarihinden beri: bölümü görenler (section_view / ogrenci) ve öğrenci
        düğmesine tıklayanlar (student_click; yerleşimler ogrenci · final · identity).
        {funnel.smallSample && " Örneklem küçük; oranlar henüz yorumlanmaz."}
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Bölüm görüntülenme" value={funnel.sectionViews} />
        <MiniStat label="Öğrenci düğmesi tıklaması" value={funnel.clicks} />
        <MiniStat label="Tıklama / görüntülenme" value={pct(funnel.clickRate)} />
        <MiniStat label="Hero sonrası bölüme ulaşan" value={pct(funnel.reachShare)} />
      </div>
      <p className="mt-2 text-xs text-[var(--c-ink-2)]">
        Tıklama yerleşimi: {placements} · ziyaret tabanı (landing_view) {funnel.landingViews.toLocaleString("tr-TR")} · hero{" "}
        {funnel.heroViews.toLocaleString("tr-TR")}
      </p>
      {funnel.days.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-2xl border border-[var(--c-hairline)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--c-surface)] text-[11px] uppercase tracking-wide text-[var(--c-ink-3)]">
              <tr>
                <th className="px-3.5 py-2 font-medium">Gün</th>
                <th className="px-3.5 py-2 text-right font-medium">Ziyaret</th>
                <th className="px-3.5 py-2 text-right font-medium">Bölüm</th>
                <th className="px-3.5 py-2 text-right font-medium">Tıklama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--c-hairline)]">
              {funnel.days.map((d) => (
                <tr key={d.day}>
                  <td className="aura-mono px-3.5 py-2 text-[var(--c-ink-2)]">{dayFmt.format(new Date(`${d.day}T00:00:00Z`))}</td>
                  <td className="px-3.5 py-2 text-right text-[var(--c-ink-2)]">{d.landingViews.toLocaleString("tr-TR")}</td>
                  <td className="px-3.5 py-2 text-right font-medium text-[var(--c-ink)]">{d.sectionViews.toLocaleString("tr-TR")}</td>
                  <td className="px-3.5 py-2 text-right font-medium text-[var(--c-ink)]">{d.clicks.toLocaleString("tr-TR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3.5">
      <div className="text-2xl font-bold text-[var(--c-ink)]">{typeof value === "number" ? value.toLocaleString("tr-TR") : value}</div>
      <div className="text-xs text-[var(--c-ink-2)]">{label}</div>
    </div>
  );
}
