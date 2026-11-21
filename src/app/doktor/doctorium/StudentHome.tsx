import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { currentDoctoriumAudience } from "@/lib/doctorium-audience";
import { CAL_KIND_LABEL, doctorCalendarMonth } from "@/lib/calendar";
import { formatIsoDayTr } from "@/lib/iso-day";
import { STUDENT_HOME_LINKS, studentAgendaMonths, studentAgendaHref, upcomingStudentAgenda } from "@/lib/student-home";

/** Student-only read surface; the shared calendar retains ownership and approval filters. */
export async function StudentHome() {
  const audience = await currentDoctoriumAudience();
  if (audience?.audience !== "STUDENT" || !audience.doctorId) return null;
  const doctorId = audience.doctorId;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const dates = await Promise.all(studentAgendaMonths(now).map(({ year, month }) =>
    doctorCalendarMonth(doctorId, year, month, { includeTus: true, includeEdu: true })
  )).then(rows => upcomingStudentAgenda(rows.flat(), today)).catch(() => null);

  return <section aria-labelledby="student-home-heading" className="mb-8 border-y border-[var(--c-hairline)] py-6">
    <h2 id="student-home-heading" className="aura-display text-xl font-medium">Öğrenci masan</h2>
    <nav aria-label="Öğrenci kısayolları" className="mt-3 grid gap-x-6 sm:grid-cols-2">
      {STUDENT_HOME_LINKS.map(link => <Link key={link.href} href={link.href} className="group flex min-h-11 items-start justify-between gap-3 border-b border-[var(--c-hairline)] py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]">
        <span><span className="font-semibold group-hover:underline">{link.title}</span><span className="mt-1 block text-sm text-[var(--c-ink-2)]">{link.description}</span></span>
        <ArrowUpRight size={18} className="mt-1 shrink-0 text-[var(--c-accent)]" aria-hidden="true" />
      </Link>)}
    </nav>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Takviminde sırada ne var?</h3>
      <Link href="/doktor/doctorium/takvim" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Takvimi aç</Link>
    </div>
    <p className="text-sm text-[var(--c-ink-2)]">Bu ay ve gelecek ay: TUS tarihleri, onaylı fırsatların son başvuruları ve kendi takvimin. Son koşulları ilgili kurumun duyurusundan kontrol et.</p>
    {dates === null ? <p role="status" className="mt-4 text-sm">Yaklaşan tarihler şu anda yüklenemiyor. Takvimini daha sonra tekrar kontrol et.</p>
      : dates.length === 0 ? <p className="mt-4 text-sm text-[var(--c-ink-2)]">Bu dönem için kayıtlı yaklaşan tarih yok. Takip ettiğin etkinlikler ve takvimine eklediğin notlar burada da görünür.</p>
      : <ul className="mt-3 divide-y divide-[var(--c-hairline)]">{dates.map(item => <li key={item.key}>
        <Link href={studentAgendaHref(item, today)} className="block min-h-11 py-3 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-accent)]">
          <span className="block text-xs text-[var(--c-ink-2)]">{CAL_KIND_LABEL[item.kind]} · {item.start < today ? `Devam ediyor, son gün ${formatIsoDayTr(item.end)}` : formatIsoDayTr(item.start)}</span>
          <span className="mt-1 block text-sm font-medium">{item.title}</span>
        </Link>
      </li>)}</ul>}
  </section>;
}
