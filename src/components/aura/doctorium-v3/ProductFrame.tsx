import type { ReactNode } from "react";
import { AuraMark } from "@/components/AuraLogo";

// ÜRÜN ÇERÇEVESİ (2026-08-23, DOCV2-003): landing'de "sahte dashboard" yerine ürünün GERÇEK
// bileşenleri (ArticleCard · CongressList · LegalSearchBox …) bu çerçevenin içinde render edilir.
//
// Token kararı: çerçeve --dl-* (landing paleti) DEĞİL, --c-* (uygulama tema sistemi) ile boyanır —
// içindeki ürün bileşenleri zaten --c-* konuşur (ArticleCard/CoverArt tema-duyarlı, [.theme-light_&]
// varyantlı). Böylece ziyaretçi ürünü KENDİ temasında (cookie yoksa gece varsayılan) görür ve
// bileşenlerin kontrast/tema sözleşmesine dokunulmaz. Landing bölümü koyu/açık olabilir; çerçeve
// "ürün ekranı" olarak ondan bağımsız durur — gerçek uygulama penceresi gibi.
// Kutu minimal: saç çizgi kenarlık + hafif yükselti; glow/parallax YOK (DESIGN.md Doz 1).
export function ProductFrame({
  title, meta, children, className = "",
}: { title: ReactNode; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div
      // .dl-product-frame: globals.css mobil metadata punto kademesi (pre-freeze polish 7)
      className={`dl-product-frame min-w-0 overflow-hidden rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-bg)] text-[var(--c-ink)] shadow-[0_1px_0_rgba(0,0,0,.04)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--c-hairline)] bg-[var(--c-chrome)] px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <AuraMark size={16} tone="emerald" className="shrink-0" />
          <span className="aura-mono truncate text-[11px] font-semibold tracking-[0.12em] text-[var(--c-ink-2)]">{title}</span>
        </div>
        {meta && <span className="aura-mono max-w-[55%] truncate text-[11px] text-[var(--c-ink-3)]">{meta}</span>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}
