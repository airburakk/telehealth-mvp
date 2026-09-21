import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AI_FEATURE_LABEL, AI_PRICES_ASOF, estimateUsd, listAiUsage, type AiFeature, type AiUsageRow } from "@/lib/ai-usage";
import { ArrowLeft, Coins } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Kullanımı" };

// AI kullanım sayacı raporu (v6.298, 2026-09-21 — kontrol raporu K6): AiUsageDaily satırlarını özellik × model ve gün bazında
// toplar; tahminî USD dipnotlu (fiyat listesi tarihi AI_PRICES_ASOF; Console faturası esastır). /admin/landing-analitik deseni:
// sunucu bileşeni, ADMIN-only, doğrudan agregat. /admin ağacı Doctorium kromundadır → yalnız --c-* token'ları, AURA bağlantısı YOK.

const DAYS = 30;
const fmt = new Intl.NumberFormat("tr-TR");
const usd = (v: number | null) => (v === null ? "—" : `$${v.toFixed(2)}`);

type Agg = { feature: string; model: string; calls: number; errors: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };

function aggregate(rows: AiUsageRow[]): Agg[] {
  const m = new Map<string, Agg>();
  for (const r of rows) {
    const k = `${r.feature}|${r.model}`;
    const a = m.get(k) ?? { feature: r.feature, model: r.model, calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    a.calls += r.calls; a.errors += r.errors; a.inputTokens += r.inputTokens; a.outputTokens += r.outputTokens;
    a.cacheReadTokens += r.cacheReadTokens; a.cacheWriteTokens += r.cacheWriteTokens;
    m.set(k, a);
  }
  return [...m.values()].sort((x, y) => (estimateUsd(y) ?? 0) - (estimateUsd(x) ?? 0) || y.calls - x.calls);
}

function byDay(rows: AiUsageRow[]): { day: string; calls: number; usd: number }[] {
  const m = new Map<string, { day: string; calls: number; usd: number }>();
  for (const r of rows) {
    const d = m.get(r.day) ?? { day: r.day, calls: 0, usd: 0 };
    d.calls += r.calls; d.usd += estimateUsd(r) ?? 0;
    m.set(r.day, d);
  }
  return [...m.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export default async function AiUsagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  const rows = await listAiUsage(DAYS);
  const agg = aggregate(rows);
  const days = byDay(rows);
  const totalUsd = agg.reduce((s, a) => s + (estimateUsd(a) ?? 0), 0);
  const totalCalls = agg.reduce((s, a) => s + a.calls, 0);
  const label = (f: string) => AI_FEATURE_LABEL[f as AiFeature] ?? f;

  return (
    <div className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
        <ArrowLeft size={15} /> Yönetim
      </Link>
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold text-[var(--c-ink)]">
        <Coins size={22} className="text-[var(--c-ink-2)]" /> AI Kullanımı
      </h1>
      <p className="mt-2 text-sm text-[var(--c-ink-2)]">
        Son {DAYS} gün (UTC), özellik × model. İçerik tutulmaz; yalnız çağrı ve token sayıları. Tahminî USD fiyat listesi {AI_PRICES_ASOF}
        tarihlidir — <strong>Console faturası esastır</strong>. Gemini canlı tercüman dakika bazlı ücretlendirilir; burada yalnız oturum adedi.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Toplam çağrı" value={fmt.format(totalCalls)} />
        <Stat label="Tahminî maliyet" value={usd(totalUsd)} />
        <Stat label="Özellik × model" value={String(agg.length)} />
      </div>

      <h2 className="mt-8 text-lg font-semibold text-[var(--c-ink)]">Özelliğe göre</h2>
      {agg.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--c-ink-3)]">Henüz kayıt yok — ilk AI çağrısıyla dolmaya başlar.</p>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--c-hairline)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--c-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--c-ink-3)]">
              <tr>
                <th className="px-3 py-2">Özellik</th><th className="px-3 py-2">Model</th><th className="px-3 py-2 text-right">Çağrı</th>
                <th className="px-3 py-2 text-right">Hata</th><th className="px-3 py-2 text-right">Giriş</th><th className="px-3 py-2 text-right">Çıkış</th>
                <th className="px-3 py-2 text-right">Önbellek okuma</th><th className="px-3 py-2 text-right">Tahmini $</th>
              </tr>
            </thead>
            <tbody>
              {agg.map((a) => (
                <tr key={`${a.feature}|${a.model}`} className="border-t border-[var(--c-hairline)]">
                  <td className="px-3 py-2 text-[var(--c-ink)]">{label(a.feature)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--c-ink-2)]">{a.model}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt.format(a.calls)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{a.errors ? <span className="text-[var(--c-danger)]">{fmt.format(a.errors)}</span> : "0"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt.format(a.inputTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt.format(a.outputTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt.format(a.cacheReadTokens)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(estimateUsd(a))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mt-8 text-lg font-semibold text-[var(--c-ink)]">Güne göre</h2>
      {days.length === 0 ? null : (
        <div className="mt-2 overflow-x-auto rounded-lg border border-[var(--c-hairline)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--c-surface-2)] text-left text-xs uppercase tracking-wide text-[var(--c-ink-3)]">
              <tr><th className="px-3 py-2">Gün (UTC)</th><th className="px-3 py-2 text-right">Çağrı</th><th className="px-3 py-2 text-right">Tahmini $</th></tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className="border-t border-[var(--c-hairline)]">
                  <td className="px-3 py-2 font-mono text-xs text-[var(--c-ink-2)]">{d.day}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt.format(d.calls)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{usd(d.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-[var(--c-ink-3)]">{label}</div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--c-ink)]">{value}</div>
    </div>
  );
}
