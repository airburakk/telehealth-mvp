"""Kapak sığma kapısı (2026-11-26) — kapak metni, kapaktaki KONUMUNUN kutusuna sığıyor mu?

Neden: kapıların karakter sınırı (coverDeck ≤ 125) tek; kapaktaki kutular konuma göre çok farklı. 26.11 sahte Salı
provası: 3. konumun açıklama kutusu (300×78, 20→19 pt) ≈109 karakterde doluyor, kapı 119'u geçirdi → çizici
"Text does not fit" ile düştü (karusel o gün tek karta dönerdi). Arşivdeki 42 taslağın 21'i bu konuma sığmazdı.
Ayrıca kapak, başlığın açıklama satırına inmesini DENETLEMEZ (3. konumda 3 satırlık başlık açıklamanın üstüne biner).

Nasıl: raster-post/newspaper_cover.py `box()` + `wrap()` kuralı, gerçek yazı tipinden üretilmiş karakter genişlikleriyle
(kapak-olculeri.json · kapak_olcu_uret.py) yeniden oynanır. Kerning dahil (çizicinin
textlength'i ile birebir) + satır başına 1 px temkin payı: "sığar" dediği metin kapakta sığar — test_kapak_sigma.py
gerçek çiziciyle doğrular.
KONUMLAR newspaper_cover.cover() ile BİREBİR; orası değişirse burası ve TS eşi (kapak-sigma.ts) birlikte değişir.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

OLCU = json.loads((Path(__file__).resolve().parent / 'kapak-olculeri.json').read_text(encoding='utf-8'))
SATIR_ARALIGI = 1.12
# Gerçek çizici konumları 1/64 px'e yuvarlar; tablo toplamı en çok ≈0,3 px sapar → satır başına 1 px temkin payı.
TEMKIN_PX = 1.0
# Başlığın son satırı açıklama kutusunun üstünü en çok bu kadar aşabilir: onaylı tasarımda manşetin 2 satırlık başlığı
# (42 pt) 8 px aşıyor ve mürekkep çakışmıyor; 3. konumda 3 satırlık başlık 15 px aşıyor ve açıklamanın üstüne biniyor.
BINDIRME_PAYI = 10

# (başlık: y, genişlik, yükseklik, boyut, en küçük) · (açıklama: aynı) — cover() çağrılarıyla birebir.
KONUMLAR = [
    ((309, 618, 147, 42, 40), (397, 618, 62, 21, 20)),
    ((312, 300, 220, 30, 28), (422, 300, 104, 22, 20)),
    ((647, 300, 140, 30, 28), (728, 300, 78, 20, 19)),
    ((939, 296, 190, 30, 28), (1054, 296, 100, 21, 19)),
    ((939, 296, 190, 30, 28), (1054, 296, 100, 21, 19)),
    ((939, 296, 190, 30, 28), (1054, 296, 100, 21, 19)),
]


def _genislik(s: str, tur: str, sz: int) -> float:
    """PIL textlength ile aynı: karakterler + bitişik çiftlerin kerning'i (1000 pt birimi → sz)."""
    t = OLCU[tur]
    g, k = t['genislik'], t['kerning']
    yedek = max(g.values())   # tabloda olmayan karakter = en geniş karakter (temkinli)
    birim = sum(g.get(c, yedek) for c in s) + sum(k.get(s[i:i + 2], 0) for i in range(len(s) - 1))
    return birim * sz / OLCU['olcek']


def _kir(metin: str, tur: str, sz: int, w: int) -> list[str] | None:
    """newspaper_cover.wrap ile aynı açgözlü kırma; tek sözcük sütuna sığmazsa None (çizici orada hata verir)."""
    sigmaz = lambda s: _genislik(s, tur, sz) + TEMKIN_PX > w  # noqa: E731
    out, cur = [], ''
    for word in metin.split():
        if sigmaz(word):
            return None
        test = (cur + ' ' + word).strip()
        if sigmaz(test):
            out.append(cur)
            cur = word
        else:
            cur = test
    if cur:
        out.append(cur)
    return out


def yerlesim(metin: str, kutu: tuple, bold: bool) -> tuple[int, int] | None:
    """newspaper_cover.box: büyükten küçüğe ilk sığan boyut → (boyut, satır); sığmazsa None."""
    _, w, h, boyut, en_kucuk = kutu
    for sz in range(boyut, en_kucuk - 1, -1):
        satirlar = _kir(metin, 'bold' if bold else 'roman', sz, w)
        if satirlar is None:
            return None
        if len(satirlar) * math.ceil(sz * SATIR_ARALIGI) <= h:
            return sz, len(satirlar)
    return None


def _baslik_tamam(metin: str, konum: int) -> bool:
    bk, ak = KONUMLAR[konum - 1]
    r = yerlesim(metin, bk, True)
    return r is not None and bk[0] + r[1] * math.ceil(r[0] * SATIR_ARALIGI) <= ak[0] + BINDIRME_PAYI


def _aciklama_tamam(metin: str, konum: int) -> bool:
    return yerlesim(metin, KONUMLAR[konum - 1][1], False) is not None


def _en_cok_kelime(metin: str, tamam) -> int:
    kelimeler = metin.split()
    k = len(kelimeler)
    while k > 0 and not tamam(' '.join(kelimeler[:k])):
        k -= 1
    return k


def kapak_sigma(e: dict, konum: int) -> tuple[bool, str]:
    """(geçti, ayrıntı). Ayrıntı modele ret geri bildirimi olarak gider: kaç kelimeye inmesi gerektiğini söyler."""
    sorun = []
    for alan, tamam, ne in (('coverTitle', _baslik_tamam, 'kapakta açıklamanın üstüne biniyor'),
                            ('coverDeck', _aciklama_tamam, 'kapaktaki kutuya sığmıyor')):
        metin = e[alan]
        if tamam(metin, konum):
            continue
        w = len(metin.split())
        k = _en_cok_kelime(metin, lambda s: tamam(s, konum))
        sorun.append(f'{alan} {konum}. konumda {ne} ({w} kelime); bu konumda en çok {k} kelime → en az {w - k} kelime çıkar')
    return not sorun, '; '.join(sorun)
