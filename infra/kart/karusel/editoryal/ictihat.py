"""Karusel editoryal — İÇTİHAT ŞABLONU (2026-11-25 · 👤 "normal günlük seçkideki çözümü bul karusele uyarla").

TS eşi: src/lib/karusel-editoryal/ictihat.ts — BİREBİR; eşlik fikstürü tests/unit/karusel-ictihat-eslik.json
(eslik_uret.py yazar). Kuralı burada değiştiren TS'te de değiştirir.

Yargıtay kararının kalıcı bağlantısı yok (hukuk-ingest url: null) ve ham karar metni kamuya ÇIKMAZ. Sabah kartı kararı
yalnız künye + sözlükten türeyen "Konu: … Dayanak: …" satırıyla çizer; karusel AYNI yolu izler: içtihat öğesine model
METİN YAZMAZ, kaynak sayfa ÇEKİLMEZ, dört alan edisyondan DETERMİNİSTİK kurulur. Kalite kapısı ikinci model doğrulaması
yerine metni bu fonksiyonla yeniden üretip birebir karşılaştırır.
"""
from __future__ import annotations

import re

ICTIHAT_STREAM = 'ictihat'
ICTIHAT_NOTU = ('Karar metni kişisel veri içerebildiği için paylaşılmaz; tam metne Yargıtay karar arama sisteminden '
                'esas ve karar numarasıyla ulaşılabilir.')

_KAYNAK_ONEKI = 'Yargıtay — '
_KAPAK_SINIR, _DECK_MIN, _DECK_SINIR, _BASLIK_SINIR, _OZET_SINIR = 44, 30, 125, 72, 270
_KONU_RE = re.compile(r'^Konu: ([^.]+)\.')


def ictihat_mi(item: dict) -> bool:
    return item.get('stream') == ICTIHAT_STREAM


def _konu_satiri(item: dict) -> tuple[str, str]:
    satir = '' if item.get('summaryLongFallback') else (item.get('summaryLong') or '').strip()
    m = _KONU_RE.match(satir)
    return (m.group(1).strip() if m else ''), satir


def ictihat_taslagi(item: dict) -> dict:
    kaynak = item['sourceName']
    daire = kaynak[len(_KAYNAK_ONEKI):].strip() if kaynak.startswith(_KAYNAK_ONEKI) else ''
    kapak_daire = f'Yargıtay {daire} kararı'
    cover_title = kapak_daire if daire and len(kapak_daire) <= _KAPAK_SINIR else 'Yargıtay kararı'

    konu, satir = _konu_satiri(item)
    cover_deck = f'Konu: {konu}.' if konu else 'Künyesi haber kartında yer alan bir Yargıtay kararı.'
    if len(cover_deck) < _DECK_MIN:
        cover_deck += ' Künyesi haber kartında.'
    if len(cover_deck) > _DECK_SINIR:
        cover_deck = 'Künyesi haber kartında yer alan bir Yargıtay kararı.'

    detail_title = item['title'].strip()
    if len(detail_title) > _BASLIK_SINIR:
        detail_title = detail_title.replace(' Hukuk Dairesi', ' HD', 1).replace(' Ceza Dairesi', ' CD', 1)

    giris = satir or f'{cover_title}.'
    detail_summary = f'{giris} {ICTIHAT_NOTU}'
    if len(detail_summary) > _OZET_SINIR and konu:
        detail_summary = f'Konu: {konu}. {ICTIHAT_NOTU}'
    return {'coverTitle': cover_title, 'coverDeck': cover_deck, 'detailTitle': detail_title, 'detailSummary': detail_summary}
