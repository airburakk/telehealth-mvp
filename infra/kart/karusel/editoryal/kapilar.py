"""Deterministik kalite kapıları — model ne derse desin, bu kurallar geçmezse öğe DÜŞER.

Her kapı (ad, geçti, ayrıntı) döndürür. Kapılar yalnız editoryal metni ve o öğenin kaynak metnini görür.
Sınırlar 14 Kasım onaylı kartlarının ölçülerinden türetildi (tests: onaylı metin kapılardan geçmeli).
"""
from __future__ import annotations

import re
import unicodedata

from kapak_sigma import kapak_sigma

LIMITS = {'coverTitle': 44, 'coverDeck': 125, 'detailTitle': 72, 'detailSummary': 270}
MIN_LEN = {'coverTitle': 12, 'coverDeck': 30, 'detailTitle': 20, 'detailSummary': 90}

# Doctorium'un kendi iddiası olarak YASAK; kaynak metinde geçiyorsa haber cümlesinde serbest (👤 15.11 Karar 3).
# Anahtar = metinde aranan kök, değer = kaynakta aranan kökler (TR + EN).
SOURCE_EXEMPT = {
    'akredit': ('akredit', 'accredit'),
    'garanti': ('garanti', 'guarantee'),
    'kesin tedavi': ('kesin tedavi', 'cure'),
}
ALWAYS_BANNED = ('hekim', 'uçtan uca', 'mucize', 'devrim', 'çığır', 'müjde', 'umut ışığı', 'kanıtlandı')

# Klinik öncesi / kayıt bulgusu işaretleri → temkin cümlesi zorunlu.
PRECLINICAL = ('in vitro', 'hücre kültür', 'cell line', 'cells', 'hücre', 'mice', 'mouse', 'fare', 'rat ',
               'sıçan', 'drosophila', 'flies', 'sinek', 'zebrafish', 'docking', 'in silico', 'animal')
CAUTION = ('gösterilmedi', 'gösterilmiş değil', 'göstermez', 'kanıtlanmadı', 'henüz', 'araştırma duyurusu',
           'tedavi sonucu değil', 'klinik yarar', 'insanlarda')
TRIAL_STREAMS = ('İlaç & Cihaz',)


def _fold(s: str) -> str:
    s = s.replace('İ', 'i').replace('I', 'ı').lower()
    return unicodedata.normalize('NFC', s)


def _numbers(s: str) -> list[str]:
    # 19,66 · 44.66 · 33430 · 2026 · 034 (LITESPARK-034 gibi) — tam sayı/ondalık dizileri
    return re.findall(r'\d+(?:[.,]\d+)?', s)


def _num_forms(n: str) -> set[str]:
    return {n, n.replace(',', '.'), n.replace('.', ',')}


def check(e: dict, item: dict, src: str, konum: int | None = None) -> list[tuple[str, bool, str]]:
    out: list[tuple[str, bool, str]] = []
    text = ' '.join(e[k] for k in LIMITS)
    ft, fs = _fold(text), _fold(src)

    # 1) uzunluk
    bad = [f'{k}={len(e[k])}' for k in LIMITS if not (MIN_LEN[k] <= len(e[k]) <= LIMITS[k])]
    out.append(('uzunluk', not bad, ', '.join(bad)))

    # 2) sayı kapısı — metindeki her sayı kaynakta (aynı biçimde ya da nokta/virgül eşdeğeriyle) geçmeli
    src_nums = set(_numbers(src))
    # "11 bin" = kaynaktaki "11,000"/"11.000" (16.11 Ebola: doğru metin reddediliyordu). YALNIZ "bin" sözcüğüyle;
    # çıplak "11" hâlâ "11,000"ü karşılamaz. "milyon" bilinçli olarak dışarıda (sıkı kalır).
    text_num = re.sub(r'\b(\d{1,3})\s+bin(?:den|de|e|i|in|ler\w*)?\b', r'\1.000', text)
    missing = sorted({n for n in _numbers(text_num) if not (_num_forms(n) & src_nums)})
    out.append(('sayilar', not missing, 'kaynakta yok: ' + ', '.join(missing) if missing else ''))

    # 3) temkin kapısı
    # Terim SÖZCÜK BAŞINDA aranır (sonu açık: "farelerde", "hücrelerde" yakalanır). Düz alt dize araması
    # 16.11'de doktrin kaynakçasındaki "Fırat Üniversitesi"ni 'rat ' (sıçan) sanıp temkin cümlesi istemişti.
    preclinical = any(re.search(r'(?<!\w)' + re.escape(p.strip()) + (r'\b' if p.endswith(' ') else ''), fs) for p in PRECLINICAL)
    trial = item.get('streamLabel') in TRIAL_STREAMS
    need = preclinical or trial
    has = any(c in _fold(e['detailSummary']) for c in CAUTION)
    out.append(('temkin', (not need) or has,
                '' if (not need) or has else ('klinik öncesi' if preclinical else 'klinik araştırma kaydı') + ' bulgu; temkin cümlesi yok'))

    # 4) yasak sözcükler
    hits = [w for w in ALWAYS_BANNED if w in ft]
    hits += [w for w, src_keys in SOURCE_EXEMPT.items() if w in ft and not any(k in fs for k in src_keys)]
    out.append(('yasak_sozcuk', not hits, ', '.join(hits)))

    # 5) kaynak adı / URL metne sızmamalı (künye kartın altında ayrıca yazılır)
    leak = 'http' in ft or 'www.' in ft
    out.append(('baglanti_yok', not leak, 'metinde bağlantı var' if leak else ''))

    # 5b) model iç sesi yayına sızmamalı ("kaynakta … bilgi yok" gibi)
    meta = [w for w in ('kaynakta', 'kaynak metin', 'bilgi bulunma', 'belirtilmemiş', 'belirtilmemektedir') if w in ft]
    out.append(('ic_ses_yok', not meta, ', '.join(meta)))

    # 5c) kişi adı yok (unvanla anılan kişi) — kamuya açık kartta bireyi öne çıkarmayız
    person = re.findall(r'\b(?:Prof|Doç|Dr|Uzm|Op)\.\s*(?:Dr\.\s*)?[A-ZÇĞİÖŞÜ][a-zçğıöşü]+', text)
    out.append(('kisi_adi_yok', not person, ', '.join(person)))

    # 6) mevzuat: yalnız künye — yorum/değerlendirme sözcüğü yok
    if item.get('streamLabel') == 'Mevzuat':
        evalw = [w for w in ('önemli', 'kritik', 'büyük', 'köklü', 'yeni dönem', 'beklenen', 'olumlu', 'olumsuz') if w in ft]
        out.append(('mevzuat_kunye', not evalw, ', '.join(evalw)))

    # 7) kapak sığması (2026-11-26) — kapaktaki KONUMUNUN kutusuna sığıyor mu (kapak_sigma.py). Konum verilmezse koşmaz
    #    (eşlik fikstürü + kalite kapısının yeniden üretim karşılaştırması konumsuz çağırır).
    if konum is not None:
        out.append(('kapak_sigma', *kapak_sigma(e, konum)))
    return out


def passed(results: list[tuple[str, bool, str]]) -> bool:
    return all(ok for _, ok, _ in results)
