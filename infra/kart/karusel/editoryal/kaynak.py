"""Kaynak metni toplayıcı — editoryal metnin tek dayanağı.

Her öğe için edisyondaki metin (başlık + summaryLong) + kaynağın kendisinden okunan metin birleştirilir.
Kaynak okunamazsa yalnız edisyon metni kalır (`fetched=False`) — üretici ve kapılar bunu bilir.
Okuma yalnız herkese açık sayfa/API'dir; kimlik bilgisi YOK. Ham yanıt `cache/` altına yazılır (tekrar okuma + iz).
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

UA = 'Mozilla/5.0 (compatible; DoctoriumKaynakOkuyucu/1.0)'
MAX_CHARS = 6000
AYLAR = ('Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık')


def _get(url: str, cache: Path, accept: str = '*/*') -> bytes:
    cache.mkdir(parents=True, exist_ok=True)
    f = cache / (hashlib.sha256(url.encode()).hexdigest()[:24] + '.bin')
    if f.exists():
        return f.read_bytes()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': accept})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
    f.write_bytes(body)
    return body


def _decode(raw: bytes) -> str:
    try:
        return raw.decode('utf-8')
    except UnicodeDecodeError:
        return raw.decode('cp1254', 'replace')   # Resmî Gazete fihristi windows-1254


def _html_text(raw: bytes) -> str:
    s = _decode(raw)
    s = re.sub(r'(?is)<(script|style|noscript|nav|footer|header|form)[^>]*>.*?</\1>', ' ', s)
    paras = re.findall(r'(?is)<(?:p|h1|h2|li)[^>]*>(.*?)</(?:p|h1|h2|li)>', s)
    text = '\n'.join(html.unescape(re.sub(r'<[^>]+>', ' ', p)) for p in paras)
    text = re.sub(r'[ \t ]+', ' ', text)
    return '\n'.join(l.strip() for l in text.splitlines() if len(l.strip()) > 30)


def _europepmc(doi: str, cache: Path) -> str:
    q = urllib.parse.quote(f'DOI:"{doi}"')
    data = json.loads(_get(f'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query={q}&resultType=core&format=json', cache))
    res = (data.get('resultList') or {}).get('result') or []
    if not res:
        return ''
    r = res[0]
    abstract = re.sub(r'<[^>]+>', ' ', r.get('abstractText') or '')
    return f"Başlık: {r.get('title', '')}\nDergi: {(r.get('journalInfo') or {}).get('journal', {}).get('title', '')}\nÖzet: {abstract}"


def _ctgov(nct: str, cache: Path) -> str:
    d = json.loads(_get(f'https://clinicaltrials.gov/api/v2/studies/{nct}', cache, 'application/json'))
    p = d.get('protocolSection', {})
    ident, status, design = p.get('identificationModule', {}), p.get('statusModule', {}), p.get('designModule', {})
    arms = p.get('armsInterventionsModule', {}).get('armGroups', [])
    outs = p.get('outcomesModule', {}).get('primaryOutcomes', [])
    lines = [f"Resmî başlık: {ident.get('officialTitle', '')}", f"Kısa ad: {ident.get('acronym', '')}",
             f"Faz: {', '.join(design.get('phases', []))}", f"Durum: {status.get('overallStatus', '')}",
             f"Özet: {p.get('descriptionModule', {}).get('briefSummary', '')}"]
    lines += [f"Kol: {a.get('label', '')} — {', '.join(a.get('interventionNames', []))}" for a in arms]
    lines += [f"Birincil sonlanım: {o.get('measure', '')}" for o in outs]
    return '\n'.join(lines)


def _resmigazete(pdf_url: str, title: str, cache: Path) -> str:
    # PDF taranmış görüntü olabilir → aynı günün fihrist sayfası (sayı + karar adı) okunur.
    m = re.search(r'/eskiler/(\d{4})/(\d{2})/(\d{8})', pdf_url)
    if not m:
        return ''
    raw = _get(f'https://www.resmigazete.gov.tr/eskiler/{m.group(1)}/{m.group(2)}/{m.group(3)}.htm', cache)
    flat = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', _decode(raw))))
    head = re.search(r'(\d{1,2} \w+ \d{4}) Tarihli ve (\d+) Sayılı Resm', flat)
    key = re.search(r'Karar Sayısı:\s*(\d+)', title)
    hit = re.search(r'[^.]{0,160}Karar Sayısı:\s*' + key.group(1) + r'\)?', flat) if key else None
    parts = []
    if head:
        parts.append(f'Fihrist: {head.group(1)} tarihli ve {head.group(2)} sayılı Resmî Gazete')
    if hit:
        parts.append('Fihrist kaydı: ' + hit.group(0).strip())
    return '\n'.join(parts)


def collect(item: dict, cache: Path) -> dict:
    """Bir öğe için kaynak paketi: {'edition': str, 'fetched': str, 'fetchedOk': bool, 'error': str|None}."""
    day = (item.get('publishedAt') or '')[:10]
    meta = f"Kaynak: {item['sourceName']} · Akış: {item.get('streamLabel', '')}"
    if day:
        y, m, d = day.split('-')
        meta += f" · Yayım tarihi: {int(d)} {AYLAR[int(m) - 1]} {y}"
    edition = f"{meta}\nBaşlık: {item['title']}\nÖzet: {item.get('summaryLong') or ''}"
    if item.get('summaryLongFallback'):
        edition = f"{meta}\nBaşlık: {item['title']}"   # yedek cümle kaynak bilgisi değildir
    url, fetched, err = item['url'], '', None
    try:
        if item['sourceName'] == 'Europe PMC' and url.startswith('https://doi.org/'):
            fetched = _europepmc(url.removeprefix('https://doi.org/'), cache)
        elif 'clinicaltrials.gov/study/' in url:
            fetched = _ctgov(url.rsplit('/', 1)[-1], cache)
        elif 'resmigazete.gov.tr' in url:
            fetched = _resmigazete(url, item['title'], cache)
        else:
            fetched = _html_text(_get(url, cache))
    except Exception as exc:  # okuma hatası fail-open: yalnız edisyon metni kalır, QA'ya yazılır
        err = f'{type(exc).__name__}: {exc}'
    fetched = fetched[:MAX_CHARS]
    return {'edition': edition, 'fetched': fetched, 'fetchedOk': bool(fetched.strip()), 'error': err}


def source_text(pkt: dict) -> str:
    return pkt['edition'] + ('\n\n--- KAYNAKTAN OKUNAN METİN ---\n' + pkt['fetched'] if pkt['fetchedOk'] else '')
