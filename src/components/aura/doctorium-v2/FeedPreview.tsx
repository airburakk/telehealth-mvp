import type { FeedItem } from "@/lib/doctorium";
import { ArticleCard, type CardWeight } from "@/app/doktor/doctorium/ArticleCard";
import { whyShown } from "@/lib/doctorium-landing/why";
import { landingBranchLabel } from "@/lib/doctorium-landing/taxonomy";
import { LANDING_ROUTES } from "@/lib/doctorium-landing/routes";

// Gerçek ArticleCard listesi — landing varyantı (çift-yönlü güvenli: sunucu ve istemci).
// · saved={null} → Kaydet düğmesi çizilmez (anonim; koşullu-href ilkesi).
// · hrefFor → giriş kapısı (proxy hasta kapısına atmasın — routes.ts notu).
// · why → kartın altına kuraldan türetilmiş "Neden görüyorum?" satırı (registry feed.why: partial).
// 🪤 <ul> grid-cols-[minmax(0,1fr)]: grid item min-width:auto → truncate'li kart mobili taşırır.
export function FeedPreview({
  items, branch, weight = "min", why = true, max,
}: { items: FeedItem[]; branch: string; weight?: CardWeight; why?: boolean; max?: number }) {
  const list = max ? items.slice(0, max) : items;
  if (!list.length) {
    return <p className="py-6 text-center text-sm text-[var(--c-ink-2)]">Bu seçimde bugün için kart yok.</p>;
  }
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)]">
      {list.map((item) => (
        <li key={item.id} className="min-w-0">
          <ul className="grid grid-cols-[minmax(0,1fr)]">
            <ArticleCard item={item} saved={null} weight={weight} hrefFor={() => LANDING_ROUTES.login} />
          </ul>
          {why && (
            /* Metadata seviyesi (QA DESK-08/mobil P1: "kalsın ama daha küçük ve muted") — soluklaştırma
               BOYUT + ink-3 ile (6.1:1); opacity-75 denendi → 3.91:1 axe ihlali, kaldırıldı. */
            <p className="aura-mono -mt-2 pb-3 text-[10px] tracking-[0.03em] text-[var(--c-ink-3)]">
              Neden görüyorum? {whyShown(item, [branch], landingBranchLabel).line}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
