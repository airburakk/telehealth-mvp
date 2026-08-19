#!/usr/bin/env python3
# Marka ikonu üretici — AuraMark TEK KAYNAKTAN, iki katman.
#
# Çalıştırma:  python scripts/gen-icons.py
# Çıktı:
#   PWA (koyu kare zemin, marka gradyanı — ana ekran/push/çevrimdışı):
#     public/icon-192.png · public/icon-512.png · public/apple-touch-icon.png
#   Favicon (marka renginde DOLU DAİRE + TAM SİYAH amblem — sekme, rotaya göre renk):
#     public/favicon.ico          → TURKUAZ (AURA yüzeyleri, varsayılan)
#     public/icon-doctorium.ico   → ZÜMRÜT  (Doctorium yüzeyleri)
#
# ── Neden bu script var ──
# 2026-06-17'de ikonlar o günkü amblemden (camgöbeği üçgen "A") üretildi. Amblem 2026-07-14'te
# AuraMark'a (çekirdek + 3 yay) geçti ama ikonlar YENİLENMEDİ: React ağacının dışında oldukları
# için ne derleyici ne test onları görür. Sonuç: çevrimdışı sayfası, push bildirimi ikonu, ana
# ekrana ekleme ve tarayıcı sekmesi ~2 ay boyunca eski amblemi gösterdi (2026-08-19'da bulundu).
# Ayrıca İKİ rakip jeneratör vardı (gen-icons.mjs eski üçgeni, extract-logo.py doğru amblemi
# üretiyordu) — hangisinin çıktısının diskte olduğu belirsizdi. İkisi de kaldırıldı, tek kaynak bu.
#
# 🪤 AMBLEM DEĞİŞİRSE: aşağıdaki SVG geometrisi src/components/AuraLogo.tsx `AuraSymbol`
# bileşeninden kopyadır (statik hâli: nabız halkaları YOK, yörünge dönüşü 0°). Amblemi
# değiştirirsen İKİSİNİ BİRLİKTE güncelle ve bu script'i yeniden çalıştır — yoksa aynı
# sürüklenme tekrar eder.
#
# 🪤 FAVICON ROTAYA GÖRE DEĞİŞİR — ama DOSYA KONVANSİYONUYLA DEĞİL:
# `src/app/doctorium/icon.ico` denendi (2026-08-19) → dosya rota olarak servis edildi (HTTP 200)
# ama Next `<link rel="icon">` BASMADI; kök `src/app/favicon.ico` konvansiyonu onu bastırıyor.
# Bu yüzden ikonlar `public/` altında durur ve `metadata.icons` ile AÇIKÇA bağlanır:
#   src/app/layout.tsx                 → /favicon.ico          (varsayılan)
#   src/app/doctorium/layout.tsx       → /icon-doctorium.ico   (override)
#   src/app/doktor/doctorium/layout.tsx→ /icon-doctorium.ico   (override)
# `src/app/favicon.ico` BİLİNÇLİ YOK — olsaydı konvansiyon yine metadata'yı ezerdi.
# Yeni bir Doctorium kökü açarsan oraya da aynı metadata'lı layout'u koy.
#
# Bağımlılık: Pillow + Chrome (SVG rasterize). Ek paket kurulumu gerekmez.

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
APP = ROOT / "src" / "app"

# ── PWA katmanı: koyu kare ──
# Zemin = uygulamanın gece zemini (layout.tsx viewport.themeColor + manifest theme_color ile aynı).
PWA_BG = (13, 14, 16, 255)  # #0d0e10
# Sembol ölçeği — maskable güvenli alan merkezdeki %80 dairedir; %64 her koşulda içinde kalır
# (kullanıcı kararı 2026-08-19: A varyantı). Büyütürsen Android dairesel maskede yay uçları kesilir.
PWA_SCALE = 0.64

# ── Favicon katmanı: marka renginde DOLU daire + tam siyah amblem ──
# Kullanıcı kararı 2026-08-19: AURA'da TURKUAZ daire, Doctorium'da ZÜMRÜT daire —
# her marka kendi tonunu taşır (ara turdaki takas denendi ve geri alındı).
# PWA ikonları bilinçli olarak koyu kare KALDI (ana ekranda daha iyi durur, maskable kurgusu
# bozulmaz) ve marka gradyanını korur — bu katmanla karıştırma.
# Daire kareye TAM oturur (kenar payı yok), amblem daire içinde %62.
FAVICON_SCALE = 0.62
SS = 4  # supersampling — daire kenarı 16px'e inince pürüzsüz kalsın

# Ton paletleri (light, mid, dark) — AuraLogo.tsx TONES ile aynı aile.
TONES = {
    # PWA: logonun kendi parlak gradyanı (koyu zeminde okunur).
    "brand": ("#8AE6EC", "#4FD6E2", "#28C8D8"),
    "emerald": ("#8beecb", "#5fe3b0", "#34d399"),
}

# Favicon amblemi TAM SİYAH (dolu marka renginde daire üzerinde) — kullanıcı kararı 2026-08-19.
# 🪤 ÜÇ KURGU DENENDİ VE BIRAKILDI, geri dönme:
#   1. beyaz daire + renkli amblem  → "silik kaldı" (açık-zemin tonlarında da, 3-4 kademe
#      koyulaştırılmış tonlarda da)
#   2. dolu daire + beyaz amblem     → renk okunuyordu ama amblem yeterince oturmadı
#   3. dolu daire + beyaz amblem + ince siyah kontur → "olmadı"
# Şimdiki: DOLU DAİRE + TAM OPAK SİYAH AMBLEM. Kontur YOK (siyah üstüne siyah anlamsız),
# opaklık hiyerarşisi YOK (istenen "full siyah"). Ayrı şablon: SVG_TPL renk alır, bu almaz.
BLACK_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="236 156 728 728">
  <g transform="translate(160 80) scale(7.3333333333)">
    <circle cx="60" cy="60" r="22" fill="#000000" fill-opacity=".12"/>
  </g>
  <g transform="translate(160 80) scale(7.3333333333)" stroke="#000000" stroke-width="6.5" stroke-linecap="round" fill="none">
    <path d="M60 24 A36 36 0 0 1 91 42"/>
    <path d="M91 78 A36 36 0 0 1 60 96"/>
    <path d="M29 78 A36 36 0 0 1 29 42"/>
  </g>
  <circle cx="600" cy="520" r="73.333333" fill="#000000"/>
</svg>"""

# Dolu daire renkleri = MARKA TONU (kullanıcı kararı 2026-08-19: F varyantı).
# 🪤 Önce "beyaz daire + renkli amblem" kurgusu denendi; açık-zemin tonlarında da, 3-4 kademe
# koyulaştırılmış tonlarda da kullanıcı "silik" buldu. Dolu dairede renk 16px'te anında okunur.
BRAND_CIRCLE = (40, 200, 216)    # #28C8D8 turkuaz — AURA yüzeyleri
EMERALD_CIRCLE = (52, 211, 153)  # #34d399 zümrüt  — Doctorium yüzeyleri

SVG_TPL = """<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="236 156 728 728">
  <defs>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{L}"/><stop offset="100%" stop-color="{M}"/>
    </radialGradient>
    <filter id="soft" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g transform="translate(160 80) scale(7.3333333333)">
    <circle cx="60" cy="60" r="22" fill="{M}" fill-opacity="{HALO}"/>
  </g>
  <g transform="translate(160 80) scale(7.3333333333)" stroke-width="6.5" stroke-linecap="round" fill="none">
    {GLOW}
    <path d="M60 24 A36 36 0 0 1 91 42" stroke="{M}"/>
    <path d="M91 78 A36 36 0 0 1 60 96" stroke="{D}"/>
    <path d="M29 78 A36 36 0 0 1 29 42" stroke="{L}"/>
  </g>
  <circle cx="600" cy="520" r="73.333333" fill="url(#core)" filter="url(#soft)"/>
</svg>"""

# Işıma katmanı yalnız KOYU zeminde anlamlı; beyaz daire içinde kirli bir hâle bırakır.
GLOW_LAYER = """<g opacity=".34" filter="url(#soft)">
      <path d="M60 24 A36 36 0 0 1 91 42" stroke="{M}"/>
      <path d="M91 78 A36 36 0 0 1 60 96" stroke="{D}"/>
      <path d="M29 78 A36 36 0 0 1 29 42" stroke="{L}"/>
    </g>"""

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
]


def find_chrome() -> str:
    for name in ("chrome", "google-chrome", "chromium"):
        found = shutil.which(name)
        if found:
            return found
    for path in CHROME_CANDIDATES:
        if Path(path).exists():
            return path
    sys.exit("Chrome bulunamadı — SVG rasterize için gerekli.")


def render_mark(tmp: Path, tone: str, glow: bool) -> Image.Image:
    """Amblemi şeffaf zeminli 1024px PNG olarak rasterize eder. tone="black" → favicon amblemi."""
    if tone == "black":
        svg = BLACK_SVG
    else:
        light, mid, dark = TONES[tone]
        svg = SVG_TPL.format(
            L=light, M=mid, D=dark,
            HALO=".16" if glow else ".14",
            GLOW=GLOW_LAYER.format(L=light, M=mid, D=dark) if glow else "",
        )
    svg_path, png_path = tmp / f"{tone}.svg", tmp / f"{tone}.png"
    svg_path.write_text(svg, encoding="utf-8")
    subprocess.run(
        [
            find_chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars",
            "--default-background-color=00000000", "--window-size=1024,1024",
            f"--screenshot={png_path}", str(svg_path),
        ],
        check=True, capture_output=True,
    )
    mark = Image.open(png_path).convert("RGBA")
    # Kare kontrolü: amblemin kendi oranı (bbox genişlik/yükseklik) beklenen değerde mi?
    # ⚠️ Beklenti IŞIMAYA GÖRE DEĞİŞİR — ışıma katmanı bbox'ı genişletir:
    #   glow=True  → 0.970 (kullanıcının gerçek logo dosyası aura-symbol.png 497/512 = 0.971)
    #   glow=False → 0.936 (blur kuyruğu yok, kutu daralır)
    # Tek eşik kullanılırsa ışımasız favicon'lar yanlış alarm verir (2026-08-19'da ölçüldü).
    lo, hi = (0.95, 0.99) if glow else (0.92, 0.96)
    box = mark.getbbox()
    ratio = (box[2] - box[0]) / (box[3] - box[1])
    if not lo <= ratio <= hi:
        sys.exit(f"Amblem oranı beklenmedik ({ratio:.4f}, ton={tone}, glow={glow}) — SVG geometrisi bozulmuş olabilir.")
    return mark


def pwa_icon(mark: Image.Image, size: int) -> Image.Image:
    """Koyu kare zemin + amblem."""
    base = Image.new("RGBA", (size, size), PWA_BG)
    side = int(size * PWA_SCALE)
    base.alpha_composite(mark.resize((side, side), Image.LANCZOS), ((size - side) // 2,) * 2)
    return base


def favicon_icon(mark: Image.Image, size: int, daire: tuple[int, int, int]) -> Image.Image:
    """Marka renginde DOLU daire (kareye tam oturur) + TAM SİYAH amblem.

    Supersampling (SS) ile daire kenarı 16px'e inince pürüzsüz kalır.
    🪤 Ters kurgu denendi ve BIRAKILDI (kullanıcı, 2026-08-19): beyaz daire + renkli amblem
    16px'te silik kalıyordu; koyulaştırmak da yetmedi. Dolu dairede renk anında okunuyor.
    """
    big = size * SS
    base = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(base).ellipse([0, 0, big - 1, big - 1], fill=daire + (255,))
    side = int(big * FAVICON_SCALE)
    base.alpha_composite(mark.resize((side, side), Image.LANCZOS), ((big - side) // 2,) * 2)
    return base.resize((size, size), Image.LANCZOS)


ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)

        # ── PWA ikonları: koyu kare, marka gradyanı + ışıma ──
        mark_pwa = render_mark(tmp, "brand", glow=True)
        for size, target in [
            (512, PUBLIC / "icon-512.png"),
            (192, PUBLIC / "icon-192.png"),
            (180, PUBLIC / "apple-touch-icon.png"),
        ]:
            pwa_icon(mark_pwa, size).save(target)
            print("yazıldı:", target.relative_to(ROOT))

        # ── Favicon'lar: MARKA RENGİNDE DOLU DAİRE + TAM SİYAH amblem ──
        # Renk eşlemesi HER MARKANIN KENDİ TONU (kullanıcı kararı 2026-08-19, nihai):
        #   AURA yüzeyleri      → TURKUAZ  (#28C8D8, AuraLogo TONES.brand)
        #   Doctorium yüzeyleri → ZÜMRÜT   (#34d399, AuraLogo TONES.emerald)
        # 🪤 Ara turda takas denendi (AURA zümrüt / Doctorium turkuaz) ve GERİ ALINDI —
        # Doctorium'un marka kimliği zümrüttür ([[doctorium-tanitim-marka]]), ters eşleme
        # portalda yanlış marka sinyali veriyordu. Bu eşlemeyi tersine çevirme.
        mark_black = render_mark(tmp, "black", glow=False)
        for daire, targets in [
            (BRAND_CIRCLE, [PUBLIC / "favicon.ico"]),
            (EMERALD_CIRCLE, [PUBLIC / "icon-doctorium.ico"]),
        ]:
            icon = favicon_icon(mark_black, 256, daire)
            for target in targets:
                target.parent.mkdir(parents=True, exist_ok=True)
                icon.save(target, sizes=ICO_SIZES)
                print("yazıldı:", target.relative_to(ROOT))


if __name__ == "__main__":
    main()
