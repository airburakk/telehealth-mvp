# Kullanıcının gerçek AURA logosundan sembolü ayıklar → şeffaf PNG + PWA ikonları.
# Kaynak: temiz logo (sembol + wordmark, beyaz zemin). Çıktı: public/aura-symbol.png + icon-*.png
from PIL import Image

SRC = r"C:\Users\A.Burak KARADERİ\Desktop\Logo Çalışmaları\0281f3ad-28bf-48a7-9f42-30010bd6466d.png"
OUT = r"C:\Users\A.Burak KARADERİ\Desktop\Air\telehealth-mvp\public"

im = Image.open(SRC).convert("RGBA")
w, h = im.size
# Üst kısım = yalnız sembol (alttaki AURA wordmark hariç)
sym = im.crop((0, 0, w, int(h * 0.60))).copy()
px = sym.load()
W, H = sym.size
for y in range(H):
    for x in range(W):
        r, g, b, _ = px[x, y]
        mn = min(r, g, b)                 # beyaz → yüksek, cyan/koyu → düşük
        a = int((250 - mn) * 1.6)         # beyazı şeffaf yap, kenarları yumuşat
        a = 0 if a < 0 else (255 if a > 255 else a)
        px[x, y] = (r, g, b, a)

bbox = sym.getbbox()
sym = sym.crop(bbox)
W, H = sym.size
m = max(W, H)
pad = int(m * 0.04)
side = m + 2 * pad
canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
canvas.paste(sym, ((side - W) // 2, (side - H) // 2), sym)
canvas.save(OUT + r"\aura-symbol.png")
print("symbol", canvas.size)

# Wordmark "AURA" = alt kısım (lacivert yazı). Beyazı şeffaf yap.
wm = im.crop((0, int(h * 0.62), w, h)).copy()
px = wm.load()
W, H = wm.size
for y in range(H):
    for x in range(W):
        r, g, b, _ = px[x, y]
        a = int((250 - min(r, g, b)) * 1.6)
        a = 0 if a < 0 else (255 if a > 255 else a)
        px[x, y] = (r, g, b, a)
wm = wm.crop(wm.getbbox())
wm.save(OUT + r"\aura-word-light.png")           # açık zemin: orijinal lacivert
# Koyu zemin için beyaza boya (renk değiştir, alfa korunur)
wd = wm.copy()
px = wd.load()
W, H = wd.size
for y in range(H):
    for x in range(W):
        a = px[x, y][3]
        px[x, y] = (255, 255, 255, a)
wd.save(OUT + r"\aura-word-dark.png")             # koyu zemin: beyaz
print("wordmark", wm.size)

def icon(size, scale=0.64, bg=(16, 16, 16, 255)):
    base = Image.new("RGBA", (size, size), bg)
    s = int(size * scale)
    base.alpha_composite(canvas.resize((s, s), Image.LANCZOS), ((size - s) // 2, (size - s) // 2))
    return base

for size, name in [(512, "icon-512.png"), (192, "icon-192.png"), (180, "apple-touch-icon.png")]:
    icon(size).save(OUT + "\\" + name)
    print("icon", name)
