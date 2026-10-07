"use client";

import { useEffect, useState } from "react";
import { academicHref, ACADEMIC_MAX_PAGE } from "@/lib/academic-search";

export function AcademicSearch({ query, page, onlyNew, count, hasNext, error }: {
  query: string; page: number; onlyNew: boolean; count: number; hasNext: boolean; error: string | null;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);
  // Native GET navigation provides shareable URLs, browser cancellation of stale
  // navigations and a no-JS fallback. No query telemetry or client result cache.
  return <section aria-label="Akademik arama" className="mt-4 rounded-2xl border border-[var(--c-hairline)] p-4">
    <form action="/doktor/doctorium" method="get" onSubmit={e => {
      if (pending) { e.preventDefault(); return; }
      setPending(true);
    }}>
      <input type="hidden" name="m" value="akademik" />
      {onlyNew && <input type="hidden" name="n" value="1" />}
      <label htmlFor="academic-query" className="block font-semibold">Akademik arşivde ara</label>
      <p id="academic-hint" className="mt-1 text-sm">Seçili branşlarda başlık, kaynak ve Türkçe/özgün özette ifadeyi arar. En az 3, en fazla 120 karakter.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input key={query} id="academic-query" name="q" type="search" defaultValue={query} maxLength={120} minLength={3}
          aria-describedby="academic-hint" className="min-h-11 min-w-0 flex-1 basis-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] p-2 text-[var(--c-ink)] sm:basis-0" />
        <button disabled={pending} className="min-h-11 rounded-lg border border-[var(--c-hairline)] px-4 py-2 disabled:opacity-60">{pending ? "Aranıyor…" : "Ara"}</button>
        <a href={academicHref("", 1, onlyNew)} className="min-h-11 rounded-lg border border-[var(--c-hairline)] px-3 py-2">Aramayı temizle</a>
      </div>
    </form>
    {pending && <p role="status" className="mt-2">Aranıyor…</p>}
    {error ? <p role="alert" className="mt-3">{error} <a href={academicHref(query, page, onlyNew)} className="underline">Yeniden dene</a></p>
      : <p role="status" className="mt-3 text-sm">Sayfa {page}: {count} kayıt.{count === 0 && " Sonuç bulunamadı. İfadeyi değiştirin veya aramayı temizleyin."}</p>}
    {!error && <nav aria-label="Akademik sayfalama" className="mt-3 flex flex-wrap gap-4">
      {page > 1 && <a rel="prev" href={academicHref(query, page - 1, onlyNew)} className="underline">Önceki sayfa</a>}
      {hasNext && page < ACADEMIC_MAX_PAGE && <a rel="next" href={academicHref(query, page + 1, onlyNew)} className="underline">Sonraki sayfa</a>}
      {hasNext && page === ACADEMIC_MAX_PAGE && <p>İlk 4.000 kayıt sınırına ulaştınız. Daha eski kayıtlar için aramayı daraltın.</p>}
    </nav>}
  </section>;
}
