import type { CalendarItem } from "./calendar";

/** Existing destinations: no second copy of saved items, TUS, opportunities or personal dates. */
export const STUDENT_HOME_LINKS = [
  { title: "TUS", href: "/doktor/doctorium/tus", description: "Sınav takvimi, kılavuzlar ve resmî veriler" },
  { title: "Burs ve staj", href: "/doktor/doctorium?m=kariyer&tur=hepsi", description: "Burs, staj ve değişim programları" },
  { title: "Kaydettiklerim", href: "/doktor/doctorium/kaydettiklerim", description: "Sonra dönmek için ayırdığın içerikler" },
  { title: "Yaklaşan tarihler", href: "/doktor/doctorium/takvim", description: "Başvurular, takip ettiğin etkinlikler ve kendi takvimin" },
] as const;

/** Use the shared calendar's UTC date convention, including the December rollover. */
export function studentAgendaMonths(now: Date): { year: number; month: number }[] {
  return [0, 1].map(offset => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
  });
}

/** Multi-day events can occur in both month queries. Keep one, including ongoing events. */
export function upcomingStudentAgenda(items: CalendarItem[], today: string, limit = 5): CalendarItem[] {
  const unique = new Map(items.filter(item => item.end >= today).map(item => [item.key, item]));
  const visibleDay = (item: CalendarItem) => item.start < today ? today : item.start;
  return [...unique.values()]
    .sort((a, b) => visibleDay(a).localeCompare(visibleDay(b)) || a.end.localeCompare(b.end) || a.key.localeCompare(b.key))
    .slice(0, Math.max(0, limit));
}

/** Always land on the exact day, even for an ongoing event that started last month. */
export function studentAgendaHref(item: CalendarItem, today: string): string {
  const day = item.start < today ? today : item.start;
  return `/doktor/doctorium/takvim?ay=${day.slice(0, 7)}&gun=${day}`;
}
