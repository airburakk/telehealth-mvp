"use client";

import { useEffect, useRef, useState } from "react";
import { ArticleCard } from "./ArticleCard";
import type { FeedItem } from "@/lib/doctorium";

/**
 * Sonsuz kaydırma (2026-08-21, kullanıcı bildirimi: "sayfada belli sayıda içerik var, neden
 * scroll down yapmaya devam etmiyor"). page.tsx sunucuda ilk partiyi (Akışım = 40, tek branş
 * odağı = 30 kayıt) basar; bu bileşen listenin SONUNA eklenir ve devamını /api/doctorium/feed'den
 * çeker — görünüşte tek akış, altta iki aşama.
 *
 * `initialCursor` = server'ın ilk partiden çıkardığı "buradan devam et" işareti; page.tsx bunu
 * hesaplayamadıysa (ilk parti zaten tükendiyse) bileşen HİÇ render edilmez — burada null kontrolü
 * tekrar edilmez, çağıran karar verir.
 *
 * Kart görünümü sunucu tarafındaki `<ArticleCard>` ile BİREBİR aynı — o yüzden bu dosya değil,
 * "@/lib/doctorium-labels" client-güvenli etiket ayrımı ArticleCard.tsx'te yaşıyor (bkz. o
 * dosyadaki üst yorum). Yüklenen kartlar hep "min" ağırlıkta — ağırlık ritmi yalnız ilk partide
 * (lead/mid) anlamlı, kaydırınca gelenler zaten listenin "iş gören" gövdesidir.
 */

type FeedItemJSON = Omit<FeedItem, "publishedAt"> & { publishedAt: string; saved: boolean | null };

export function FeedLoadMore({ focus, initialCursor }: { focus: string | null; initialCursor: string }) {
  const [items, setItems] = useState<FeedItemJSON[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinelRef = useRef<HTMLLIElement>(null);
  // En güncel cursor/loading'e effect'in yeniden bağlanmasına gerek kalmadan erişmek için —
  // IntersectionObserver'ı her state değişiminde kur-söküp-kurma yerine tek sefer kurulur.
  const stateRef = useRef({ cursor, loading });
  stateRef.current = { cursor, loading };
  // ⚠️ setLoading(true) ile stateRef.current.loading'in true'ya dönmesi arasında bir React
  // render'ı var — React 19 Strict Mode dev'de efekti bilinçli iki kere kurup söktüğü için bu
  // arayı YAKALADI (canlı testte "duplicate key" olarak görüldü, 2026-08-21): sentinel'in ilk
  // gözlem anında observer'ın gecikmeli bildirimi, henüz commit edilmemiş `loading` durumunu
  // görüp aynı sayfayı İKİNCİ kez istedi. `inFlight` React state'inden BAĞIMSIZ, senkron bir
  // kilit — render döngüsünü hiç beklemez.
  const inFlight = useRef(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && stateRef.current.cursor && !inFlight.current) load();
      },
      { rootMargin: "600px" }, // ekrana gelmeden ÖNCE tetikle — kullanıcı boşluk görmesin
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    const c = stateRef.current.cursor;
    if (!c || inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setFailed(false);
    try {
      const qs = new URLSearchParams({ cursor: c });
      if (focus) qs.set("focus", focus);
      const res = await fetch(`/api/doctorium/feed?${qs.toString()}`);
      if (!res.ok) throw new Error(String(res.status));
      const data: { items: FeedItemJSON[]; nextCursor: string | null } = await res.json();
      // İkinci savunma hattı: aynı id'nin (bir önceki partiyle) tekrar gelmesi hâlinde sessizce
      // ele — sunucudaki cursor mantığı doğru olsa da React key çakışmasının kullanıcıya hiç
      // görünmemesi tercih edilir (bkz. inFlight yorumu — DEV'de Strict Mode dışında da olabilir).
      setItems((prev) => {
        const seen = new Set(prev.map((it) => it.id));
        return [...prev, ...data.items.filter((it) => !seen.has(it.id))];
      });
      setCursor(data.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }

  return (
    <>
      {items.map(({ saved, publishedAt, ...rest }) => (
        <ArticleCard key={rest.id} item={{ ...rest, publishedAt: new Date(publishedAt) }} saved={saved} weight="min" />
      ))}
      {cursor && (
        <li ref={sentinelRef} className="flex justify-center py-6">
          {loading && (
            <span className="aura-mono text-[11px] font-semibold tracking-[0.12em] text-[var(--c-ink-3)]">
              YÜKLENİYOR…
            </span>
          )}
          {failed && (
            <button
              type="button"
              onClick={load}
              className="aura-mono text-[11px] font-semibold tracking-[0.12em] text-rose-300 hover:underline"
            >
              YÜKLENEMEDİ · TEKRAR DENE
            </button>
          )}
        </li>
      )}
    </>
  );
}
