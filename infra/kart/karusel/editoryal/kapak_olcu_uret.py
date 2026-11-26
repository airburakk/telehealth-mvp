"""Kapak sığma kapısının harf genişliği tablosunu GERÇEK kapak yazı tiplerinden üretir (2026-11-26).

Kapak (raster-post/newspaper_cover.py) başlığı NimbusRoman-Bold, açıklamayı NimbusRoman-Regular ile çizer. Editoryal metni
Vercel'de (TS) üretildiği için yazı tipi orada yok; kapı bu tablodaki karakter genişlikleriyle çizicinin satır kırmasını
yeniden oynatır (kapak_sigma.py · src/lib/karusel-editoryal/kapak-sigma.ts). Yazı tipi dosyası değişirse
test_kapak_sigma.py sha256 uyuşmazlığıyla düşer → bu betik kart imajında yeniden koşulur ve iki kopya güncellenir.

Kullanım (kart imajında): python3 -X utf8 kapak_olcu_uret.py <çıktı.json>
"""
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'raster-post'))
import newspaper_cover as nc  # noqa: E402

OLCEK = 1000   # yazı tipi birimi: genişlik/kerning 1000 pt'de ölçülür, kapı boyuta göre ölçekler (raqm doğrusal)
KARAKTERLER = (''.join(chr(c) for c in range(0x20, 0x7F)) + ''.join(chr(c) for c in range(0xA0, 0x100))
               + 'ĞğİıŞşŒœ‘’‚“”„–—…•·€₺′″×−≤≥±')


def dosya(bold: bool) -> Path:
    return nc.FONT / ('NimbusRoman-Bold.otf' if bold else 'NimbusRoman-Regular.otf')


def uret() -> dict:
    """Karakter genişlikleri + sıfır olmayan kerning çiftleri (biçim, PIL textlength ile birebir: dizgi genişliği =
    karakterlerin toplamı + bitişik çiftlerin kerning'i — 26.11 ölçümü, raqm açık)."""
    out = {}
    for tur in ('roman', 'bold'):
        f = nc.font(OLCEK, 'roman', tur == 'bold')
        g = {ch: round(f.getlength(ch), 3) for ch in KARAKTERLER}
        k = {}
        for a in KARAKTERLER:
            for b in KARAKTERLER:
                v = round(f.getlength(a + b) - f.getlength(a) - f.getlength(b), 3)
                if v:
                    k[a + b] = v
        out[tur] = {'genislik': g, 'kerning': k}
    return {
        'kaynak': 'infra/kart/karusel/editoryal/kapak_olcu_uret.py — newspaper_cover.font (NimbusRoman), 1000 pt birimi',
        'olcek': OLCEK,
        'yaziTipiSha256': {t: hashlib.sha256(dosya(t == 'bold').read_bytes()).hexdigest() for t in ('roman', 'bold')},
        **out,
    }


if __name__ == '__main__':
    Path(sys.argv[1]).write_text(json.dumps(uret(), ensure_ascii=False, sort_keys=True, separators=(',', ':')) + '\n', encoding='utf-8')
    print('yazıldı:', sys.argv[1])
