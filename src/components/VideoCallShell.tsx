import type { ReactNode } from "react";
import { AuraMark, AuraWordmark } from "@/components/AuraLogo";
import { CALL_LANES, type CallLane } from "@/lib/constants";

/**
 * VideoCallShell — 5 kulvarın TÜM video görüşme ekranları için ortak IMMERSIVE düzen iskeleti.
 *
 * Kulvar → bileşen haritası (tek iskelet, üç çağıran):
 *   Uzaktan Sağlık · Sağlık Turizmi · Ücretsiz Sağlık Hizmeti → ConsultationRoom
 *   İkinci Görüş                                              → SoVideoRoom
 *   Konsültasyon Talebi                                       → ConsultVideoRoom
 *
 * ── v6.134 (2026-08-21) KARMA YENİDEN TASARIM (kullanıcı kararı: "B'nin bölgeleri + A'nın videosu")
 *
 * 1) MARKA KROMU GERİ GELDİ. Bu rotalarda global Header `lib/immersive-routes` ile gizleniyor →
 *    marka, dil ve durum bilgisini taşıyan tek yüzey kalkıyordu ("ekranın AURA ile ilgisi yok").
 *    Artık iskeletin KENDİ üst rayı var: AuraMark + AuraWordmark + kulvar etiketi + durum künyesi.
 *    🔴 `AuraLogo` KULLANILMAZ: wordmark'ını tema class'ıyla seçiyor (globals.css `.theme-dark
 *    .logo-word-light`) → DAİMA-koyu bu yüzeyde gündüz temalı kullanıcıda lacivert wordmark
 *    siyaha düşer, sessizce görünmez olur. `AuraWordmark` maske tabanlıdır, rengi açıkça alır.
 *    Braille KONMAZ (krom/nav yüzeyi — EmptyState ve Header emsali).
 *
 * 2) YÜZEY GECE-KİLİTLİ. Kök `theme-dark` ilan eder. Öncesinde iskelet `bg-black` sabitken
 *    içindeki kartlar `var(--c-panel)` okuyordu → gündüz temasında (--c-panel #FCFDFC) siyah
 *    zemin üstünde bembeyaz kartlar çıkıyordu. `aura-call` işareti gündüz temasındaki pastel
 *    remap'lerine (globals.css) karşı-kural gerekirse tutamak olsun diye duruyor.
 *
 * 3) PANEL ÜÇ BÖLGE (B yönü): `identity` (üst, scroll ETMEZ) · `panel` (orta, tek scroll alanı) ·
 *    `actions` (alt sabit ray, scroll ETMEZ). Hastanın "Doktora sorularım"ı ve doktorun kaydet/
 *    SOAP/DICOM aksiyonları böylece her an tek tık — uzun scroll'un dibinde kaybolmaz.
 *
 * 4) VİDEO KENARDAN KENARA (A yönü): immersive korunur, panel yatayda buzlu cam olarak videonun
 *    ÜSTÜNE biner. (B'nin mat çerçeveli "monitör" metaforu bilinçli olarak alınmadı.)
 *
 * 5) PANEL GENİŞLİĞİ HER ROLDE AYNI (~400px). Doktor için 520px'e genişletme DENENDİ ve kullanıcı
 *    kararıyla GERİ ALINDI (2026-08-21): video alanından çalıyordu. Doktordaki "transkript ile notu
 *    aynı anda göremiyorum" sorunu genişlikle değil SIRAYLA çözülür — görüşme sonunda SOAP'a
 *    basılınca transkript küçülür, not alanı onun yerini alır (ConsultationRoom `writeUp`).
 *
 * Saf sunum bileşeni (hook yok) — video/panel state'i çağıran client bileşende yaşar.
 * `identity`/`actions`/`lane` OPSİYONELDİR: eski üç-prop sözleşmesiyle çağıran bileşenler
 * (SoVideoRoom, ConsultVideoRoom) kırılmadan çalışmaya devam eder.
 */
export function VideoCallShell({
  dir,
  lang,
  lane,
  statusBar,
  video,
  identity,
  panel,
  actions,
  panelLabel,
}: {
  dir?: "ltr" | "rtl";
  /** BCP-47 dil kodu (ör. "ar", "fa-IR") — :lang() font bağları için ŞART (v6.9 tuzağı; denetim #27). */
  lang?: string;
  /** Kulvar kimliği — 3px şerit + mono etiket olarak çizilir. Renk --lane-* token'ından. */
  lane?: CallLane;
  /** Üst rayın SAĞ ucundaki durum künyesi (bağlantı/rol). Marka solda, künye sağda. */
  statusBar?: ReactNode;
  /** Full-fill video alanı — remote video + self-view + kontroller + boş/hata overlay'leri. */
  video: ReactNode;
  /** ÜST sabit bölge: kiminle görüşülüyor. Scroll etmez. */
  identity?: ReactNode;
  /** ORTA bölge — tek scroll alanı. */
  panel: ReactNode;
  /** ALT sabit aksiyon rayı. Scroll etmez. */
  actions?: ReactNode;
  /** Panel başında görünen erişilebilirlik etiketi (aside aria-label). */
  panelLabel?: string;
}) {
  const L = lane ? CALL_LANES[lane] : null;

  return (
    <div
      dir={dir}
      lang={lang}
      // theme-dark: yüzey gece-kilitli (bkz. başlık §2) · aura-call: gündüz remap'lerine tutamak
      className="theme-dark aura-call fixed inset-0 z-30 flex flex-col overflow-hidden bg-[var(--c-bg-deep)]"
      style={{ height: "100dvh" }}
    >
      {/* ── MARKA RAYI ── AURA kilidi + kulvar + durum künyesi.
          🪤 Ray KÖKTE yaşar, video kolonunun İÇİNDE değil: yatayda panel (z-20) videonun sağ
          yarısına biniyor → ray video kolonunda kalsaydı sağ ucundaki DURUM KÜNYESİ panelin
          ARKASINA düşer ve hiç görünmezdi (v6.134 ilk denemede bu oldu). Kökte z-30 ile ray her
          iki katmanın üstünde; panelin `landscape:pt-14` üst payı tam bu ray için ayrılmıştır.
          pointer-events-none: rayda etkileşimli öğe YOK, altındaki videoya/panele tıklamayı
          engellememeli. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-b from-black/75 via-black/50 to-transparent px-3 pb-4 pt-2.5 sm:px-4">
          <span className="flex shrink-0 items-center gap-2">
            <AuraMark size={20} />
            {/* Maske tabanlı wordmark — rengi AÇIKÇA verilir (tema class'ına bağlı DEĞİL) */}
            <AuraWordmark color="#F4F5F3" height="0.62rem" />
            {L && (
              // 🪤 Kulvar adı DAR ekranda da görünür kalır (yalnız `sm:` üstünde göstermek,
              // mobilde kimliği 3px ŞERİDİN RENGİNE indirgiyordu — renk tek başına bilgi
              // taşıyamaz: renk körlüğü + kulvar tonlarının bir kısmı birbirine yakın).
              // Yer sıkışınca kısalan taraf durum künyesi olur (aşağıda `sm:` ile), kimlik değil.
              <span
                className="aura-mono ms-1 max-w-[42vw] truncate text-[10px] uppercase tracking-[0.18em] sm:max-w-none"
                style={{ color: L.accent }}
              >
                {L.name}
              </span>
            )}
          </span>
          {statusBar && <span className="min-w-0 flex-1">{statusBar}</span>}
        </div>
        {/* Kulvar şeridi — 3px, tam genişlik. Kulvar rengi YALNIZ burada ve yukarıdaki mono
            etikette görünür; hiçbir yüzeyi boyamaz (renk disiplini v6.22). */}
        {L && <div className="h-[3px] w-full" style={{ backgroundColor: L.accent }} />}
      </div>

      {/* Video kolonu — portrait: üst (kalan alan) · landscape: TAM EKRAN (panel arkasında,
          buzlu cam için) */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col landscape:absolute landscape:inset-0">
        <div className="relative min-h-0 flex-1">{video}</div>
      </div>

      {/* Panel — portrait: alt (ekranın ≤%46'sı) · landscape: sağda SİYAH BUZLU CAM overlay
          (video'nun üstüne biner). Üç bölge: identity (sabit) · panel (scroll) · actions (sabit).
          🪤 Scroll YALNIZ orta bölgede: aside'a overflow-y-auto verilirse üst/alt bölgeler de
          kayar ve "her an erişilebilir aksiyon rayı" vaadi düşer. */}
      <aside
        aria-label={panelLabel}
        className={`flex shrink-0 flex-col overflow-hidden border-[var(--c-hairline)]
                   border-t portrait:max-h-[46dvh] portrait:bg-[var(--c-bg-deep)]
                   landscape:absolute landscape:inset-y-0 landscape:end-0 landscape:z-20
                   landscape:border-s landscape:border-t-0 landscape:border-white/10
                   landscape:bg-black/60 landscape:backdrop-blur-2xl landscape:shadow-2xl
                   landscape:w-[min(400px,44vw)]`}
      >
        {/* ÜST — kimlik şeridi (kiminle görüşülüyor). Yatayda marka rayının altına düşsün diye
            üst padding'i büyük: cam panel videonun üstüne biniyor, ray onun ÜSTÜNDE duruyor. */}
        {identity && (
          <div className="shrink-0 border-b border-[var(--c-hairline)] px-3 py-3 landscape:border-white/10 landscape:pt-14">
            {identity}
          </div>
        )}

        {/* ORTA — tek scroll alanı */}
        <div className={`flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 ${identity ? "" : "landscape:pt-14"}`}>
          {panel}
        </div>

        {/* ALT — sabit aksiyon rayı */}
        {actions && (
          <div className="shrink-0 border-t border-[var(--c-hairline)] bg-black/25 px-3 py-2.5 landscape:border-white/10">
            {actions}
          </div>
        )}
      </aside>
    </div>
  );
}
