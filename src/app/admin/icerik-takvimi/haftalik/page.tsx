import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { todayIsoTr } from "@/lib/iso-day";
import { isDayString, weekStart, addDays } from "@/lib/social-calendar/series";
import { getWeeklyPackage } from "@/lib/social-calendar/weekly-store";
import { parsePayload } from "@/lib/social-calendar/payload";
import { WeeklyActions, DeliveryReconcile } from "./WeeklyActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Haftalık içerik onayı" };
const format = (date: Date | string) => new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(date));
export default async function WeeklyReviewPage({ searchParams }: { searchParams: Promise<{ hafta?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/doctorium/giris?next=/admin/icerik-takvimi/haftalik");
  if (user.role !== "ADMIN") redirect("/");
  const { hafta } = await searchParams;
  const week = weekStart(hafta && isDayString(hafta) ? hafta : addDays(todayIsoTr(), 7));
  const p = await getWeeklyPackage(week);
  const rows = p ? await db.contentPlanItem.findMany({ where: { id: { in: p.manifest.entries.map(e => e.id) } }, select: { id: true, payload: true } }) : [];
  return <div className="mx-auto max-w-4xl px-5 py-10 text-[var(--c-ink)]">
    <Link href={`/admin/icerik-takvimi?hafta=${week}`} className="text-sm text-[var(--c-accent)]">İçerik takvimine dön</Link>
    <h1 className="aura-display mt-5 text-3xl">Haftalık içerik onayı</h1>
    <p className="mt-2 text-sm text-[var(--c-ink-2)]">{week} — {addDays(week, 6)} · Türkiye saati. Günlük Seçki kendi mevcut akışında devam eder.</p>
    <nav className="mt-4 flex gap-4 text-sm text-[var(--c-accent)]"><Link href={`?hafta=${addDays(week, -7)}`}>Önceki hafta</Link><Link href={`?hafta=${addDays(week, 7)}`}>Sonraki hafta</Link></nav>
    <p className="mt-5 rounded-xl border border-[var(--c-hairline)] p-4 text-sm">Haftalık n8n yayın bağlantısı henüz doğrulanıp etkinleştirilmedi. Buradaki onay tek başına sosyal paylaşım başlatmaz.</p>
    {!p ? <p className="mt-6">Bu hafta için son medya dosyalarıyla hazırlanmış paket henüz yok. Kaynaklı taslaklar, hesaplar ve videolar tamamlandığında paket burada incelemeye açılır.</p> : <>
      <div className="mt-6 text-sm"><strong>Paket: {p.status}</strong>{p.approvedBy && <p>Onaylayan: {p.approvedBy} · {p.approvedAt && format(p.approvedAt)}</p>}{p.revokedReason && <p>Geri çekilme nedeni: {p.revokedReason}</p>}</div>
      {p.manifest.entries.map(e => {
        const payload = parsePayload(rows.find(r => r.id === e.id)?.payload);
        return <section key={e.id} className="mt-5 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-5">
          <h2 className="text-xl">{payload?.slides[0]?.title || e.seriesKey}</h2><p className="mt-1 text-sm">{format(e.scheduledAt)}</p>
          <Link href={`/admin/icerik-takvimi/${e.id}`} className="text-sm text-[var(--c-accent)]">Kaynak ve editör incelemesi</Link>
          <div className="mt-3 space-y-3">{payload?.slides.map((s, i) => <div key={i}><h3 className="font-semibold">{s.title}</h3><p className="whitespace-pre-wrap text-sm">{s.body}</p>{s.bullets?.map((b, j) => <p key={j} className="text-sm">• {b}</p>)}</div>)}</div>
          <p className="mt-3 whitespace-pre-wrap text-sm">{payload?.caption}</p><p className="text-sm">{payload?.hashtags.join(" ")}</p>
          <ul className="mt-4 space-y-2 text-sm">{e.channels.map(c => <li key={c}><strong>{c}</strong> · {e.accounts?.[c]}<div className="flex flex-wrap gap-3">{e.assets.filter(a => a.channel === c).map(a => <a key={a.name} href={a.url} target="_blank" rel="noopener noreferrer" className="text-[var(--c-accent)] underline">{a.name}</a>)}</div></li>)}</ul>
        </section>;
      })}
      <WeeklyActions id={p.id} version={p.updatedAt.toISOString()} hash={p.manifestHash} status={p.status} />
      <h2 className="mt-8 text-xl">Kanal sonuçları</h2><ul className="mt-3 space-y-3">{p.deliveries.map(d => <li key={d.id} className="rounded-xl border border-[var(--c-hairline)] p-4 text-sm"><strong>{d.channel}</strong> · {d.accountId} · {format(d.scheduledAt)}<p>{d.effectiveState}{d.platformId && ` · Yayın kimliği: ${d.platformId}`}</p>{d.resultNote && <p>{d.resultNote}</p>}{["UNKNOWN", "FAILED"].includes(d.effectiveState) && <DeliveryReconcile id={d.id} version={d.updatedAt.toISOString()} />}<details className="mt-2 text-xs"><summary>İşlem geçmişi</summary>{d.events.map(event => <p key={event.id}>{format(event.createdAt)} · {event.state} · {event.note}</p>)}</details></li>)}</ul>
    </>}
  </div>;
}
