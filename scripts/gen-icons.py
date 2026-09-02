#!/usr/bin/env python3
# Marka ikonu üretici — KÜRE tek kaynaktan (v6.137, 2026-08-23; eski "çekirdek + 3 yay" SÜPERSEDE).
#
# Çalıştırma:  python scripts/gen-icons.py
# Kaynak:      public/brand/aura-sphere-still.png   (marka seti v2 resmî statik küre, 512px, şeffaf)
# Çıktı:
#   public/brand/doctorium-sphere-still.png   → zümrüt statik küre (reduced-motion + Doctorium ikonları)
#   Favicon (A · KOYU DİSK + küre — kullanıcı onayı 2026-08-23; rotaya göre renk):
#     public/favicon.ico          → TURKUAZ (AURA yüzeyleri, varsayılan)
#     public/icon-doctorium.ico   → ZÜMRÜT  (Doctorium yüzeyleri)
#   PWA / iOS (B · koyu YUVARLATILMIŞ KARE + küre):
#     public/apple-touch-icon.png (180) · public/icon-192.png · public/icon-512.png
#     Doctorium (Faz E, 2026-09-03): public/apple-touch-icon-doctorium.png (180) · icon-doctorium-192.png · icon-doctorium-512.png
#
# ── Neden bu script var ──
# İkonlar React ağacının DIŞINDA: ne derleyici ne test onları görür. 2026-08-19'da ~2 ay eski
# amblemle kalmış bulundular. Tek jeneratör = tek gerçek; amblem değişince BURASI koşar.
#
# 🪤 AMBLEM DEĞİŞİRSE: kaynak PNG'yi değiştir, scripti koş, üç layout + manifest + sw.js'teki
# `?v=` cache-kırıcıyı ARTIR (sw VERSION dahil) — yoksa tarayıcı eski ikonu tutar (2026-08-19 dersi).
#
# 🪤 FAVICON ROTAYA GÖRE DEĞİŞİR — ama DOSYA KONVANSİYONUYLA DEĞİL:
# `src/app/doctorium/icon.ico` denendi → servis edildi ama <link rel="icon"> BASILMADI (kök
# favicon.ico konvansiyonu bastırıyor). İkonlar `public/` altında, `metadata.icons` ile bağlanır:
#   src/app/layout.tsx                 → /favicon.ico          (varsayılan)
#   src/app/doctorium/layout.tsx       → /icon-doctorium.ico   (override)
#   src/app/doktor/doctorium/layout.tsx→ /icon-doctorium.ico   (override)
# `src/app/favicon.ico` BİLİNÇLİ YOK.
#
# ── Küçük boyut kuralı (ölçüldü 2026-08-23) ──
# Paketin kendi favicon-64'ü (şeffaf tel küre) açık sekme çubuğunda görünmüyor, 16px'te teller
# kayboluyordu. Çözüm: KOYU DİSK (#0d0e10) zemin + ≤64px'te kontrast/alfa güçlendirme →
# 16px'te bile "küre" okunur, açık/koyu çubukta tutarlı. Üç alternatif (şeffaf+halka, düz
# renkli disk, animasyon karesi) denendi ve elendi — geri dönme.
#
# Zümrüt: turkuaz küreye yalnız HUE kaydırması (S/V/alfa sabit); hedef sitedeki "ium" #34d399
# (hue 158,1°). Delta kaynağın ÖLÇÜLEN hue'sundan hesaplanır (token'dan değil — küre hue'su
# #28C8D8'den 2-3° farklı). Bağımlılık: Pillow + numpy.

import colorsys
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
BRAND = PUBLIC / "brand"
SRC = BRAND / "aura-sphere-still.png"

DARK = (13, 14, 16)  # #0d0e10 — uygulamanın gece zemini (manifest theme_color ile aynı)
EMERALD_HEX = "#34d399"  # AuraLogo TONES.emerald.main
# 256 bilinçli YOK: fotoğrafik küre ICO içinde PNG olarak saklanır; 256 katmanı dosyayı
# 124KB'a şişiriyordu (sekme ≤64 kullanır; 128 pinned-site/Windows için yeter) → ~45KB.
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128)]
# Küre/zemin oranları: disk %94, kare %88; PWA kare %80 (maskable güvenli alan = merkez %80 daire).
DISC_SCALE, SQUARE_SCALE, PWA_SCALE = 0.94, 0.88, 0.80
SS = 4  # supersampling — daire/kare kenarı 16px'e inince pürüzsüz kalsın


def measured_hue(im: Image.Image) -> float:
    """Doygun + parlak opak piksellerin dairesel ortalama hue'su (derece)."""
    x = np.array(im).astype(np.float32) / 255
    rgb, a = x[..., :3], x[..., 3]
    mx, mn = rgb.max(-1), rgb.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    m = (a > 0.5) & (sat > 0.35) & (mx > 0.4)
    hs = np.array([colorsys.rgb_to_hsv(*p)[0] * 360 for p in rgb[m][::40]])
    return float(np.degrees(np.arctan2(np.sin(np.radians(hs)).mean(), np.cos(np.radians(hs)).mean()))) % 360


def hue_shift(im: Image.Image, delta_deg: float) -> Image.Image:
    """Vektörize HSV hue kaydırması; S, V ve alfa birebir korunur."""
    x = np.array(im).astype(np.float32) / 255
    rgb = x[..., :3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    df = mx - mn
    nz = df > 1e-6
    rc = np.where(nz, (mx - r) / np.maximum(df, 1e-6), 0)
    gc = np.where(nz, (mx - g) / np.maximum(df, 1e-6), 0)
    bc = np.where(nz, (mx - b) / np.maximum(df, 1e-6), 0)
    h = np.where(mx == r, bc - gc, np.where(mx == g, 2 + rc - bc, 4 + gc - rc))
    h = np.where(nz, (h / 6.0) % 1.0, 0)
    s = np.where(mx > 0, df / np.maximum(mx, 1e-6), 0)
    v = mx
    h = (h + delta_deg / 360.0) % 1.0
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    out = np.zeros_like(rgb)
    for k, (rr, gg, bb) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        sel = i == k
        out[sel, 0], out[sel, 1], out[sel, 2] = rr[sel], gg[sel], bb[sel]
    x[..., :3] = out
    return Image.fromarray((x * 255 + 0.5).astype(np.uint8), "RGBA")


def sphere(src: Image.Image, size: int) -> Image.Image:
    """Küreyi hedef boyuta indirir; ≤64px'te kontrast/alfa güçlendirir (16px okunurluğu)."""
    im = src.resize((size, size), Image.LANCZOS)
    if size <= 64:
        r, g, b, a = im.split()
        rgb = ImageEnhance.Brightness(ImageEnhance.Contrast(Image.merge("RGB", (r, g, b))).enhance(1.4)).enhance(1.12)
        a = ImageEnhance.Brightness(a).enhance(1.35)
        im = Image.merge("RGBA", (*rgb.split(), a))
    return im


def on_disc(src: Image.Image, size: int) -> Image.Image:
    big = size * SS
    base = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(base).ellipse([0, 0, big - 1, big - 1], fill=DARK + (255,))
    base = base.resize((size, size), Image.LANCZOS)
    s = sphere(src, int(round(size * DISC_SCALE)))
    base.alpha_composite(s, ((size - s.size[0]) // 2,) * 2)
    return base


def on_square(src: Image.Image, size: int, scale: float) -> Image.Image:
    big = size * SS
    base = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(base).rounded_rectangle([0, 0, big - 1, big - 1], radius=int(big * 0.24), fill=DARK + (255,))
    base = base.resize((size, size), Image.LANCZOS)
    s = sphere(src, int(round(size * scale)))
    base.alpha_composite(s, ((size - s.size[0]) // 2,) * 2)
    return base


def main() -> None:
    if not SRC.exists():
        sys.exit(f"Kaynak yok: {SRC}")
    turq = Image.open(SRC).convert("RGBA")
    # bbox'a kırp (512 kanvasta kenar payı var) → kare
    a = np.array(turq)[..., 3]
    ys, xs = np.where(a > 16)
    turq = turq.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    side = max(turq.size)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(turq, ((side - turq.size[0]) // 2, (side - turq.size[1]) // 2))
    turq = sq

    target = colorsys.rgb_to_hsv(*[int(EMERALD_HEX[i : i + 2], 16) / 255 for i in (1, 3, 5)])[0] * 360
    delta = target - measured_hue(turq)
    em = hue_shift(turq, delta)
    print(f"zümrüt hue kaydırması: {delta:+.1f}° → ölçülen {measured_hue(em):.1f}° (hedef {target:.1f}°)")
    em_still = BRAND / "doctorium-sphere-still.png"
    em.resize((512, 512), Image.LANCZOS).save(em_still)
    print("yazıldı:", em_still.relative_to(ROOT))

    # Favicon'lar (A · koyu disk)
    for src, name in ((turq, "favicon.ico"), (em, "icon-doctorium.ico")):
        imgs = {s: on_disc(src, s) for s, _ in ICO_SIZES}
        largest = ICO_SIZES[-1][0]
        imgs[largest].save(PUBLIC / name, sizes=ICO_SIZES, append_images=[imgs[s] for s, _ in ICO_SIZES[:-1]])
        print("yazıldı:", (PUBLIC / name).relative_to(ROOT))

    # iOS / PWA (B · yuvarlatılmış kare) — AURA turkuazı (manifest tek marka)
    on_square(turq, 180, SQUARE_SCALE).save(PUBLIC / "apple-touch-icon.png")
    on_square(turq, 192, PWA_SCALE).save(PUBLIC / "icon-192.png")
    on_square(turq, 512, PWA_SCALE).save(PUBLIC / "icon-512.png")
    for n in ("apple-touch-icon.png", "icon-192.png", "icon-512.png"):
        print("yazıldı:", (PUBLIC / n).relative_to(ROOT))
    # Doctorium PWA/iOS ikonları (Faz E, 2026-09-03): aynı B kalıbı (koyu yuvarlatılmış kare + küre),
    # ZÜMRÜT küre. doctorium.tr manifest'i ve push bildirimi bunları kullanır (app/manifest.ts, sw.js);
    # eskiden AURA turkuazı paylaşılıyordu (marka sızıntısı — teknik ayrışma planı Faz E).
    on_square(em, 180, SQUARE_SCALE).save(PUBLIC / "apple-touch-icon-doctorium.png")
    on_square(em, 192, PWA_SCALE).save(PUBLIC / "icon-doctorium-192.png")
    on_square(em, 512, PWA_SCALE).save(PUBLIC / "icon-doctorium-512.png")
    for n in ("apple-touch-icon-doctorium.png", "icon-doctorium-192.png", "icon-doctorium-512.png"):
        print("yazıldı:", (PUBLIC / n).relative_to(ROOT))


if __name__ == "__main__":
    main()
