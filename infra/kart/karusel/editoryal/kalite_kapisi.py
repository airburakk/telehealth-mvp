"""Karusel [D] otomatik kalite kapısı + mühür (plan adım 5 — insan onayı YOK, 👤 15.11).

Kendisi model ÇAĞIRMAZ. Önceki üç aşamanın kayıtlarını okur, aralarındaki hash bağlarını doğrular ve tek karar verir:
  [A] QA-editoryal.json  — deterministik kapılar + ikinci model doğrulaması (uretici.py)
  [B] QA-gorsel.json     — görsel denetimi (gorsel.py)  · gorseller/{kapak,haber-1..6}.png
  [C] <kartlar>/QA.json  — v3 çizici (kart konteyneri /karusel/uret ya da render.py) · 01..08.png
Karar GEÇTİ için HEPSİ gerekir (plan §2 [D]); tek bir eksik ya da uyuşmazlık = KALDI (fail-closed → 07:50 tek kart).

Mühür = sha256( editorial.json baytları ‖ "\\n" ‖ 01..08 PNG sha256'ları (sıralı, "\\n" ile) ‖ "\\n" ‖ edisyon rawBodySha256 ).
Yayın adımı `muhur_dogrula()` ile dosyaları YENİDEN hash'ler; tutmazsa yayın YOK.

Kullanım: python -X utf8 kalite_kapisi.py <gün_klasörü> <kartlar_klasörü> <edition.json>  → <gün_klasörü>/QA.json
Çıkış kodu: 0 = GEÇTİ · 1 = KALDI (karar dosyası her durumda yazılır).
"""
from __future__ import annotations

import hashlib
import json
import struct
import sys
from pathlib import Path

GORSEL_ADLARI = ['kapak'] + [f'haber-{i}' for i in range(1, 7)]
KART_ADLARI = [f'{i:02d}.png' for i in range(1, 9)]
KART_BOYUT = (1080, 1350)
KAPANIS_TAMAM = "ana kopya piksel hash'i birebir tuttu"
SURUM = 'kalite-kapisi-v1'


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def png_boyut(b: bytes) -> tuple[int, int] | None:
    """PNG başlığından genişlik × yükseklik (Pillow'suz; IHDR ilk parça olmalı)."""
    if len(b) < 24 or b[:8] != b'\x89PNG\r\n\x1a\n' or b[12:16] != b'IHDR':
        return None
    return struct.unpack('>II', b[16:24])


def muhur_hesapla(editorial_bayt: bytes, kart_hashleri: list[str], edisyon_sha: str) -> str:
    return sha(editorial_bayt + b'\n' + '\n'.join(kart_hashleri).encode() + b'\n' + edisyon_sha.encode())


def _oku(p: Path):
    try:
        return json.loads(p.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def _kabul_edilen_gorsel(g: dict) -> tuple[bool, str | None, bool]:
    """(geçti mi, kabul edilen sha256, yedek mi). Üretim biçimi (gorsel.py) + MCP denemelerinin düz biçimi."""
    if 'sonuc' in g:
        if g.get('yedekGerekli'):
            y = g.get('yedek') or {}
            return bool(y.get('onayli') and y.get('sha256')), y.get('sha256'), True
        gecen = [d for d in g.get('denemeler', []) if d.get('gecti')]
        return g['sonuc'] == 'GECTI' and len(gecen) == 1, (gecen[0].get('sha256') if gecen else None), False
    return bool(g.get('gecti')), g.get('sha256'), False


def degerlendir(gun_dir: Path, kart_dir: Path, edition_path: Path) -> dict:
    sorunlar: list[str] = []
    k = lambda kosul, mesaj: kosul or sorunlar.append(mesaj)  # noqa: E731

    # --- edisyon (tek doğruluk kaynağı) ---
    ed = _oku(edition_path) or {}
    ed_sha = ed.get('rawBodySha256', '')
    k(isinstance(ed.get('rawBodyUtf8'), str) and sha(ed['rawBodyUtf8'].encode('utf-8')) == ed_sha, 'edisyon gövdesi hash\'iyle uyuşmuyor')
    k(not ed.get('testOnly'), 'edisyon testOnly işaretli')
    gun = ed.get('day')
    try:
        ed_urls = [i['url'] for i in json.loads(ed['rawBodyUtf8'])['items']]
    except (KeyError, TypeError, ValueError):
        ed_urls = []
    k(len(ed_urls) == 6, f'edisyonda 6 öğe yok ({len(ed_urls)})')

    # --- [A] editoryal ---
    ed_bayt = (gun_dir / 'editorial.json').read_bytes() if (gun_dir / 'editorial.json').is_file() else b''
    edit = _oku(gun_dir / 'editorial.json') or {}
    qa_a = _oku(gun_dir / 'QA-editoryal.json') or {}
    k(bool(ed_bayt), 'editorial.json yok')
    k(edit.get('day') == gun and qa_a.get('day') == gun, 'editoryal gün edisyonla uyuşmuyor')
    k(qa_a.get('gun') == 'GECTI', f"editoryal kapı: {qa_a.get('gun', 'kayıt yok')}")
    k(qa_a.get('editionRawSha256') == ed_sha and (edit.get('edition') or {}).get('rawBodySha256') == ed_sha,
      'editoryal başka bir edisyona bağlı')
    items, ogeler = edit.get('items') or [], qa_a.get('ogeler') or []
    k(len(items) == 6 and len(ogeler) == 6, f'editoryal 6/6 değil ({len(items)} metin, {len(ogeler)} kayıt)')
    k([i.get('sourceUrl') for i in items] == ed_urls, 'editoryal sıra/URL edisyonla uyuşmuyor')
    alanlar = ('coverTitle', 'coverDeck', 'detailTitle', 'detailSummary')
    for n, (it, og) in enumerate(zip(items, ogeler), 1):
        son = (og.get('denemeler') or [{}])[-1]
        k(og.get('sonuc') == 'GECTI' and son.get('sonuc') == 'GECTI', f'öğe {n}: editoryal kapıdan geçmedi')
        k(all(x.get('gecti') for x in son.get('kapilar', [])) and bool(son.get('kapilar')), f'öğe {n}: deterministik kapı kaydı eksik/kırık')
        etiketler = [d.get('etiket') for d in son.get('dogrulama', [])]
        k(bool(etiketler) and all(e == 'desteklenir' for e in etiketler), f'öğe {n}: ikinci model doğrulaması temiz değil')
        k({a: it.get(a) for a in alanlar} == {a: (og.get('taslak') or {}).get(a) for a in alanlar},
          f'öğe {n}: metin kapıdan SONRA değişmiş')

    # --- [B] görseller ---
    qa_b = _oku(gun_dir / 'QA-gorsel.json') or {}
    gkayit = {g.get('gorsel'): g for g in qa_b.get('gorseller', [])}
    k(sorted(gkayit) == sorted(GORSEL_ADLARI), f'görsel kaydı 7/7 değil ({len(gkayit)})')
    kabul_sha: dict[str, str | None] = {}
    yedekler = []
    for ad in GORSEL_ADLARI:
        g = gkayit.get(ad) or {}
        gecti, s, yedek = _kabul_edilen_gorsel(g)
        kabul_sha[ad] = s
        if yedek:
            yedekler.append(ad)
        k(gecti and bool(s), f'{ad}: görsel denetimden geçmedi')
        p = gun_dir / 'gorseller' / f'{ad}.png'
        k(p.is_file() and sha(p.read_bytes()) == s, f'{ad}: dosya denetlenen görsel değil')

    # --- [C] çizim ---
    qa_c = _oku(kart_dir / 'QA.json') or {}
    k(qa_c.get('day') == gun and qa_c.get('editionRawSha256') == ed_sha, 'çizim başka bir gün/edisyona ait')
    k(qa_c.get('editorialSha256') == sha(ed_bayt), 'çizim bu editorial.json ile yapılmamış')
    k(qa_c.get('closing') == KAPANIS_TAMAM, f"kapanış kilidi: {qa_c.get('closing', 'kayıt yok')}")
    kart_img = {c.get('card'): c.get('imageSha256') for c in qa_c.get('cards', [])}
    for n, ad in enumerate(GORSEL_ADLARI[1:], 2):
        k(kart_img.get(n) == kabul_sha.get(ad), f'kart {n:02d}: çizimdeki görsel denetlenen görsel değil')
    qa_dosya = {f.get('name'): f.get('sha256') for f in qa_c.get('files', [])}
    kart_hash = []
    for ad in KART_ADLARI:
        p = kart_dir / ad
        b = p.read_bytes() if p.is_file() else b''
        h = sha(b)
        kart_hash.append(h)
        k(bool(b) and qa_dosya.get(ad) == h, f'{ad}: yok ya da çizici kaydıyla uyuşmuyor')
        k(png_boyut(b) == KART_BOYUT, f'{ad}: {png_boyut(b)} ≠ 1080×1350')

    karar = 'GECTI' if not sorunlar else 'KALDI'
    return {
        'kind': 'karusel-kalite-kapisi', 'surum': SURUM, 'day': gun, 'karar': karar, 'sorunlar': sorunlar,
        'insanOnayi': False, 'yedekGorseller': yedekler,
        'baglar': {'editionRawSha256': ed_sha, 'editorialSha256': sha(ed_bayt), 'kartlar': dict(zip(KART_ADLARI, kart_hash)),
                   'gorseller': kabul_sha},
        'muhur': muhur_hesapla(ed_bayt, kart_hash, ed_sha) if karar == 'GECTI' else None,
        'maliyet': {'editoryalUsd': qa_a.get('tahminiUsd'), 'gorselUsd': qa_b.get('gorselUsd'), 'denetimUsd': qa_b.get('denetimUsd')},
    }


def muhur_dogrula(karar: dict, editorial_bayt: bytes, kart_baytlari: list[bytes]) -> bool:
    """Yayın adımı çağırır: karar GEÇTİ mi ve dosyalar mühürlendikleri gibi mi? Aksi = yayın YOK."""
    if karar.get('karar') != 'GECTI' or not karar.get('muhur') or len(kart_baytlari) != 8:
        return False
    return muhur_hesapla(editorial_bayt, [sha(b) for b in kart_baytlari], karar['baglar']['editionRawSha256']) == karar['muhur']


def main():
    gun_dir, kart_dir, edition = (Path(p) for p in sys.argv[1:4])
    r = degerlendir(gun_dir, kart_dir, edition)
    (gun_dir / 'QA.json').write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"KAPI {r['karar']} · {r['day']}" + ''.join(f'\n  - {s}' for s in r['sorunlar']))
    sys.exit(0 if r['karar'] == 'GECTI' else 1)


if __name__ == '__main__':
    main()
