#!/usr/bin/env python3
# PWA/tarayıcı ikon üretici — marka amblemi (AuraMark) TEK KAYNAKTAN.
#
# Çalıştırma:  python scripts/gen-icons.py
# Çıktı:       public/icon-192.png · public/icon-512.png · public/apple-touch-icon.png
#              src/app/favicon.ico (16→256 çok boyutlu)
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
# Bağımlılık: Pillow + Chrome (SVG rasterize). Ek paket kurulumu gerekmez.

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
APP = ROOT / "src" / "app"

# Zemin = uygulamanın gece zemini (layout.tsx viewport.themeColor + manifest theme_color ile aynı).
BG = (13, 14, 16, 255)  # #0d0e10
# Sembol ölçeği — maskable güvenli alan merkezdeki %80 dairedir; %64 her koşulda içinde kalır
# (kullanıcı kararı 2026-08-19: A varyantı). Büyütürsen Android dairesel maskede yay uçları kesilir.
SCALE = 0.64

# AuraLogo.tsx TONES.brand — marka turkuazı.
LIGHT, MID, MAIN = "#8AE6EC", "#4FD6E2", "#28C8D8"

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="236 156 728 728">
  <defs>
    <radialGradient id="core" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="{LIGHT}"/><stop offset="100%" stop-color="{MAIN}"/>
    </radialGradient>
    <filter id="soft" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g transform="translate(160 80) scale(7.3333333333)">
    <circle cx="60" cy="60" r="22" fill="{MAIN}" fill-opacity=".16"/>
  </g>
  <g transform="translate(160 80) scale(7.3333333333)" stroke-width="6.5" stroke-linecap="round" fill="none">
    <g opacity=".34" filter="url(#soft)">
      <path d="M60 24 A36 36 0 0 1 91 42" stroke="{MAIN}"/>
      <path d="M91 78 A36 36 0 0 1 60 96" stroke="{MID}"/>
      <path d="M29 78 A36 36 0 0 1 29 42" stroke="{LIGHT}"/>
    </g>
    <path d="M60 24 A36 36 0 0 1 91 42" stroke="{MAIN}"/>
    <path d="M91 78 A36 36 0 0 1 60 96" stroke="{MID}"/>
    <path d="M29 78 A36 36 0 0 1 29 42" stroke="{LIGHT}"/>
  </g>
  <circle cx="600" cy="520" r="73.333333" fill="url(#core)" filter="url(#soft)"/>
</svg>"""

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


def render_mark(tmp: Path) -> Image.Image:
    """Amblemi şeffaf zeminli 1024px PNG olarak rasterize eder."""
    svg_path = tmp / "aura-mark.svg"
    png_path = tmp / "aura-mark.png"
    svg_path.write_text(SVG, encoding="utf-8")
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
    # Kullanıcının gerçek logo dosyası (public/assets/aura-symbol.png) 497/512 = 0.971 verir.
    box = mark.getbbox()
    ratio = (box[2] - box[0]) / (box[3] - box[1])
    if not 0.95 <= ratio <= 0.99:
        sys.exit(f"Amblem oranı beklenmedik ({ratio:.4f}) — SVG geometrisi bozulmuş olabilir.")
    return mark


def compose(mark: Image.Image, size: int) -> Image.Image:
    base = Image.new("RGBA", (size, size), BG)
    side = int(size * SCALE)
    base.alpha_composite(mark.resize((side, side), Image.LANCZOS), ((size - side) // 2,) * 2)
    return base


def main() -> None:
    with tempfile.TemporaryDirectory() as td:
        mark = render_mark(Path(td))
        for size, target in [
            (512, PUBLIC / "icon-512.png"),
            (192, PUBLIC / "icon-192.png"),
            (180, PUBLIC / "apple-touch-icon.png"),
        ]:
            compose(mark, size).save(target)
            print("yazıldı:", target.relative_to(ROOT))
        favicon = APP / "favicon.ico"
        compose(mark, 256).save(
            favicon, sizes=[(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
        )
        print("yazıldı:", favicon.relative_to(ROOT))


if __name__ == "__main__":
    main()
