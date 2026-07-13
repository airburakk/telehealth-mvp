import type { ReactNode } from "react";

/**
 * VideoCallShell — 4 kulvar + konsültasyondaki TÜM video görüşme ekranları için
 * ortak IMMERSIVE düzen iskeleti (2026-07-13, kullanıcı isteği).
 *
 * Davranış:
 *  • Immersive tam-ekran: `fixed inset-0`, 100dvh; global Header/SiteFooter
 *    `lib/immersive-routes` ile gizlenir → video+panel viewport'un tamamını doldurur.
 *  • Yön (orientation) duyarlı yerleşim:
 *      – DİKEY (portrait): video ÜSTTE (esner) · panel ALTTA (`max-h-[46dvh]`, scroll)
 *      – YATAY (landscape / masaüstü): video SOLDA (esner) · panel SAĞDA (sabit genişlik, scroll)
 *    Masaüstü daima landscape kabul edilir → panel sağda.
 *
 * Rol farkı ÇAĞIRANDA kurulur (panel içeriği bileşene özgü):
 *  • Hasta   → video full + `panel` = görüşme notları (transkript + doktora sorular)
 *  • Doktor  → video full + `panel` = ÜstBlok(script/transkript + hasta bilgileri) + AltBlok(tanı & tedavi)
 *
 * Saf sunum bileşeni (hook yok) — video/panel state'i çağıran client bileşende yaşar.
 */
export function VideoCallShell({
  dir,
  statusBar,
  video,
  panel,
  panelLabel,
}: {
  dir?: "ltr" | "rtl";
  /** Video üstünde ince, yarı-saydam durum şeridi (bağlantı durumu / rol). Opsiyonel. */
  statusBar?: ReactNode;
  /** Full-fill video alanı — remote video + self-view + kontroller + boş/hata overlay'leri. */
  video: ReactNode;
  /** Rol-bazlı panel içeriği (scroll'lu). */
  panel: ReactNode;
  /** Panel başında görünen erişilebilirlik etiketi (aside aria-label). */
  panelLabel?: string;
}) {
  return (
    <div
      dir={dir}
      className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--c-bg)] landscape:flex-row"
      style={{ height: "100dvh" }}
    >
      {/* Video kolonu — kalan alanı doldurur (portrait: üst · landscape: sol) */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {statusBar && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 to-transparent p-3">
            {statusBar}
          </div>
        )}
        <div className="relative min-h-0 flex-1">{video}</div>
      </div>

      {/* Panel — portrait: alt (ekranın ≤%46'sı, koyu zemin) · landscape: sağ (sabit genişlik,
          AURA logo yeşili zemin — #02cfdb, logonun gerçek dominant rengi; SABİT, her iki temada
          aynı parlak logo tonu) · her ikisinde scroll. İçerik kartları kendi koyu/açık zeminlerini
          taşır, çıplak panel metinleri landscape'te koyu-turkuaza döner → logo zemininde okunur. */}
      <aside
        aria-label={panelLabel}
        className="flex shrink-0 flex-col gap-3 overflow-y-auto border-[var(--c-hairline)] p-3
                   border-t portrait:max-h-[46dvh] portrait:bg-[var(--c-bg-deep)]
                   landscape:h-full landscape:w-[min(390px,42vw)] landscape:border-l landscape:border-t-0 landscape:bg-[#02cfdb]"
      >
        {panel}
      </aside>
    </div>
  );
}
