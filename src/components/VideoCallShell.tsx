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
  lang,
  statusBar,
  video,
  panel,
  panelLabel,
}: {
  dir?: "ltr" | "rtl";
  /** BCP-47 dil kodu (ör. "ar", "fa-IR") — :lang() font bağları için ŞART (v6.9 tuzağı; denetim #27). */
  lang?: string;
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
      lang={lang}
      className="fixed inset-0 z-30 flex flex-col overflow-hidden bg-black"
      style={{ height: "100dvh" }}
    >
      {/* Video kolonu — portrait: üst (kalan alan) · landscape: TAM EKRAN (panel arkasında,
          buzlu cam için) */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col landscape:absolute landscape:inset-0">
        {statusBar && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 to-transparent p-3">
            {statusBar}
          </div>
        )}
        <div className="relative min-h-0 flex-1">{video}</div>
      </div>

      {/* Panel — portrait: alt (ekranın ≤%46'sı, koyu zemin) · landscape: sağ üstte SİYAH BUZLU CAM
          overlay (video'nun üstüne biner → arkasındaki görüntü backdrop-blur ile bulanıklaşır, elit
          cam görünümü). İçerik kartları kendi zeminlerini taşır → cam üstünde okunur. */}
      <aside
        aria-label={panelLabel}
        className="flex shrink-0 flex-col gap-3 overflow-y-auto border-[var(--c-hairline)] p-3
                   border-t portrait:max-h-[46dvh] portrait:bg-[var(--c-bg-deep)]
                   landscape:absolute landscape:right-0 landscape:top-0 landscape:z-20 landscape:h-full
                   landscape:w-[min(400px,44vw)] landscape:border-l landscape:border-t-0 landscape:border-white/10
                   landscape:bg-black/60 landscape:backdrop-blur-2xl landscape:shadow-2xl"
      >
        {panel}
      </aside>
    </div>
  );
}
