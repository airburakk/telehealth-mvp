import Link from "next/link";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import { formatIsoDayTr } from "@/lib/iso-day";
import { studentClubEventsEnabled, upcomingStudentClubEvents } from "@/lib/student-club-store";

export async function StudentClubEvents({ limit }: { limit?: number } = {}) {
  if (!studentClubEventsEnabled()) return null;
  const audience = await currentDoctoriumAudience();
  if (audience?.audience !== "STUDENT") return null;
  const rows = await upcomingStudentClubEvents().catch(() => null);
  return <section aria-labelledby="student-club-heading" className="mb-8 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-5 sm:p-6">
    <p className="aura-mono text-xs text-[var(--c-ink-2)]">DOCTORIUM STUDENT</p>
    <h2 id="student-club-heading" className="aura-display mt-2 text-2xl font-medium">Kampüsten etkinlikler</h2>
    <p className="mt-2 text-sm text-[var(--c-ink-2)]">Tıp öğrenci kulüplerinin resmî üniversite duyuruları. İlk kaynak: Eskişehir Osmangazi Üniversitesi. Katılım koşulları ve son değişiklikler için düzenleyicinin sayfasını kontrol et.</p>
    {rows === null ? <p role="status" className="mt-4 text-sm">Etkinlikler şu anda yüklenemiyor. Lütfen daha sonra tekrar dene.</p>
      : rows.length === 0 ? <p className="mt-4 text-sm text-[var(--c-ink-2)]">Şu anda güncel kaynağı doğrulanmış yaklaşan kulüp etkinliği yok. Yeni duyurular kontrol edildikçe burada görünecek.</p>
      : <ul className="mt-5 grid gap-4 sm:grid-cols-2">{(limit == null ? rows : rows.slice(0, Math.max(0, limit))).map(event => <li key={event.id} className="rounded-xl border border-[var(--c-hairline)] p-4">
        <p className="text-sm font-medium">{formatIsoDayTr(event.startDay)} · {event.city}</p>
        <h3 className="mt-2 text-lg font-semibold">{event.title}</h3>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">{event.organizer}</p>
        <p className="mt-1 text-sm">{event.venue}</p>
        <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm underline underline-offset-4">Resmî duyuruyu aç<span className="sr-only"> (yeni sekme)</span></a>
        <p className="mt-2 text-xs text-[var(--c-ink-2)]">Son kaynak kontrolü: {event.checkedAt.toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" })} TSİ</p>
      </li>)}</ul>}
    {limit != null && <Link href="/doktor/doctorium?m=etkinlik" className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4">Tüm etkinlikleri aç</Link>}
  </section>;
}
