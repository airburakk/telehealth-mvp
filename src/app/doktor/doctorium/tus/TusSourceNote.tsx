import React from "react";

type SourcePeriod = { year: number; term: number; sourcePdf: string; fetchedAt: string };

/** Source date is the local data import date, not the publication date. */
export function TusSourceNote({ period }: { period: SourcePeriod }) {
  return <aside aria-label={`${period.year} TUS ${period.term}. dönem veri kapsamı ve kaynak`} className="mt-3 text-xs leading-relaxed text-[var(--c-ink-2)]">
    <p>{period.year}-TUS {period.term}. dönem ilk yerleştirme; GENEL kontenjan. Yabancı uyruklu kontenjan ve ek yerleştirme bu toplamlara dahil değildir.</p>
    <p><a className="underline" href={period.sourcePdf} target="_blank" rel="noopener noreferrer">{period.year}-TUS {period.term}. dönem ÖSYM kaynak tablosu (PDF, yeni sekme)</a>{" "}— Veri aktarım tarihi: <time dateTime={period.fetchedAt}>{period.fetchedAt}</time>; ÖSYM yayın tarihi değildir.</p>
    {period.year === 2026 && period.term === 1 && <p>ÖSYM tablosunun 61. sayfasındaki açıklamaya göre mesleki bilgi sınav puanı ve tercih sırası aynı olan adaylar birlikte yerleştirilebilir. Bu nedenle bazı programlarda yerleşen sayısı kontenjanı aşar; yerleşen ve boş kalan toplamı kontenjana eşit olmak zorunda değildir. Örnek: 43. sayfadaki Gazi Üniversitesi Göz Hastalıkları (104100234): 1 kontenjan, 2 yerleşen, 0 boş.</p>}
    <p>Geçmiş dönem verisidir; güncel başvuru takvimi veya gelecek dönem puan tahmini değildir.</p>
  </aside>;
}
