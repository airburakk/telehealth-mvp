"use client";

import { useEffect, useState } from "react";
import { HUKUK_KEYWORDS } from "@/lib/hukuk-keywords";
import { ictihatHref, ICTIHAT_MAX_PAGE } from "@/lib/ictihat-search";

export function IctihatSearch({ query, page, keyword, onlyNew, count, hasNext, error }: {
  query: string; page: number; keyword: string | null; onlyNew: boolean; count: number; hasNext: boolean; error: string | null;
}) {
  const [pending, setPending] = useState(false);
  useEffect(() => { const reset = () => setPending(false); window.addEventListener("pageshow", reset); return () => window.removeEventListener("pageshow", reset); }, []);
  return <section aria-label="İçtihat arama" className="mt-4 rounded-2xl border border-[var(--c-hairline)] p-4">
    <form action="/doktor/doctorium" method="get" onSubmit={e => { if (pending) { e.preventDefault(); return; } setPending(true); }}>
      <input type="hidden" name="m" value="mevzuat" /><input type="hidden" name="h" value="ictihat" />
      {keyword && <input type="hidden" name="k" value={keyword} />}{onlyNew && <input type="hidden" name="n" value="1" />}
      <label htmlFor="ictihat-query" className="block font-semibold">İçtihat arşivinde ara</label>
      <p id="ictihat-hint" className="mt-1 text-sm">Uygulamadaki kararların başlığında ve kayıtlı metninde arar; tüm Yargıtay arşivi değildir. 2–80 karakterlik ifade, daire veya esas/karar numarasıyla daraltın.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input key={query} id="ictihat-query" name="q" type="search" minLength={2} maxLength={80} defaultValue={query} aria-describedby="ictihat-hint"
          className="min-h-11 min-w-0 flex-1 basis-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] p-2 text-[var(--c-ink)] sm:basis-0" />
        <button disabled={pending} className="min-h-11 rounded-lg border border-[var(--c-hairline)] px-4 py-2 disabled:opacity-60">{pending ? "Aranıyor…" : "Ara"}</button>
        <a href={ictihatHref("", 1, keyword, onlyNew)} className="min-h-11 rounded-lg border border-[var(--c-hairline)] px-3 py-2">Aramayı temizle</a>
      </div>
    </form>
    <p className="mt-3 text-sm">Her sayfada en fazla 40 karar; en fazla 100 sayfa (4.000 eşleşme) gezilebilir. Toplam sonuç sayısı hesaplanmaz. Daha fazlası için ifadeyi veya konuyu daraltın.</p>
    <details className="mt-3" open={!!keyword}><summary className="cursor-pointer font-semibold">Konu ile daralt</summary>
      <div className="mt-2 flex flex-wrap gap-2">{HUKUK_KEYWORDS.map(kw => <a key={kw.key}
        href={ictihatHref(query, 1, keyword === kw.key ? null : kw.key, onlyNew)} aria-current={keyword === kw.key ? "true" : undefined}
        className="rounded-lg border border-[var(--c-hairline)] px-3 py-2 text-sm">{keyword === kw.key ? "✓ " : ""}{kw.label}</a>)}</div>
      <p className="mt-2 text-sm">Konu etiketleri kayıtlı metinde geçen sözlük ifadelerine dayanır; arama ifadesiyle birlikte uygulanır. AI sınıflandırması veya hukuki değerlendirme değildir.</p>
    </details>
    {pending && <p role="status" className="mt-2">Aranıyor…</p>}
    {error ? <p role="alert" className="mt-3">{error} <a href={ictihatHref(query, page, keyword, onlyNew)} className="underline">Yeniden dene</a></p>
      : <p role="status" className="mt-3">Sayfa {page}: {count} karar.{hasNext ? " Daha fazla eşleşme var." : " Bu görünümün son sayfası."}{count === 0 && " Sonuç bulunamadı; ifadeyi değiştirin veya filtreleri kaldırın."}</p>}
    {!error && <nav aria-label="İçtihat sayfalama" className="mt-3 flex flex-wrap gap-4">
      {page > 1 && <a rel="prev" href={ictihatHref(query, page - 1, keyword, onlyNew)} className="underline">Önceki sayfa</a>}
      {hasNext && page < ICTIHAT_MAX_PAGE && <a rel="next" href={ictihatHref(query, page + 1, keyword, onlyNew)} className="underline">Sonraki sayfa</a>}
      {hasNext && page === ICTIHAT_MAX_PAGE && <p>4.000 eşleşme sınırına ulaştınız. İfade veya konu ile daraltın.</p>}
    </nav>}
  </section>;
}
