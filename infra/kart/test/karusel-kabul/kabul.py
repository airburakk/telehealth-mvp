"""Karusel v3 kabul ölçütü (plan adım 3) — konteyner İÇİNDE koşar (CI: .github/workflows/kart-karusel.yml).

14 Kasım girdisiyle 8 kart çizilir ve kullanıcının onayladığı orijinallerle (onayli/*.webp; sohbet eki, kayıplı) karşılaştırılır:
  - kapanış kartı (08): ana kopya piksel hash'i BİREBİR — bunu çizici kendisi zorlar (tutmazsa çıkış 3);
  - 8/8 PNG 1080×1350;
  - 01–07: fark yalnız sıkıştırma gürültüsü olmalı → ortalama fark ve "belirgin farklı piksel" oranı eşik altında.
Fark haritaları <çıktı>/fark/ altına yazılır (CI yapıtı olarak yüklenir — insan gözüyle bakılabilsin).
Yalnız Pillow kullanır (imajda numpy yok).

Kullanım: python3 kabul.py <render.py> <fikstür_klasörü> <çıktı_klasörü>
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, features

ORT_ESIK = 2.5       # 0–255 ölçeğinde kanal-maksimum farkının ortalaması (Windows/RAQM'sız çizim: 3,7–7,8 ölçüldü)
BELIRGIN = 40        # bu değerin üstündeki fark "belirgin" sayılır
BELIRGIN_ESIK = 1.0  # belirgin farklı piksel oranı, % (Windows/RAQM'sız çizim: %2,0–4,3 ölçüldü)


def fark(a: Image.Image, b: Image.Image):
    d = ImageChops.difference(a.convert('RGB'), b.convert('RGB'))
    r, g, bl = d.split()
    m = ImageChops.lighter(ImageChops.lighter(r, g), bl)
    hist = m.histogram()
    n = sum(hist)
    ort = sum(i * c for i, c in enumerate(hist)) / n
    belirgin = sum(hist[BELIRGIN + 1:]) / n * 100
    return ort, belirgin, m


def main():
    render, fikstur, cikti = (Path(p) for p in sys.argv[1:4])
    print('RAQM:', features.check('raqm'))
    kart = cikti / 'kartlar'
    r = subprocess.run([sys.executable, str(render), str(fikstur / 'girdi'), str(kart)], capture_output=True, text=True)
    print(r.stdout.strip())
    if r.returncode != 0:
        print(r.stderr[-2000:], file=sys.stderr)
        sys.exit(f'çizici çıkış kodu {r.returncode}')
    (cikti / 'fark').mkdir(parents=True, exist_ok=True)
    rapor, kaldi = [], []
    for n in range(1, 9):
        ad = f'{n:02d}'
        cizilen = Image.open(kart / f'{ad}.png')
        if cizilen.size != (1080, 1350):
            kaldi.append(f'{ad}: boyut {cizilen.size}')
        ort, belirgin, harita = fark(cizilen, Image.open(fikstur / 'onayli' / f'{ad}.webp'))
        harita.point(lambda v: min(255, v * 4)).save(cikti / 'fark' / f'{ad}-fark.png')
        gecti = ort <= ORT_ESIK and belirgin <= BELIRGIN_ESIK
        rapor.append({'kart': ad, 'ortalamaFark': round(ort, 3), 'belirginPikselYuzde': round(belirgin, 3), 'gecti': gecti})
        print(f'{ad}  ortalama {ort:6.3f}  belirgin %{belirgin:6.3f}  {"GEÇTİ" if gecti else "KALDI"}')
        if not gecti:
            kaldi.append(f'{ad}: ortalama {ort:.3f} / belirgin %{belirgin:.3f}')
    qa = json.loads((kart / 'QA.json').read_text(encoding='utf-8'))
    (cikti / 'kabul.json').write_text(json.dumps({'raqm': features.check('raqm'), 'esik': {'ortalama': ORT_ESIK, 'belirginYuzde': BELIRGIN_ESIK},
                                                  'kapanis': qa['closing'], 'kartlar': rapor, 'kaldi': kaldi}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('kapanış:', qa['closing'])
    if kaldi:
        sys.exit('KABUL KALDI: ' + ' · '.join(kaldi))
    print('KABUL GEÇTİ')


if __name__ == '__main__':
    main()
