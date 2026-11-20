"""Karusel editoryal taslağı — kart konteynerinde (karusel planı adım 5, 2026-11-16). YAYINLAMAZ.

Akış (öğe başına): kaynak metni topla → taslak üret → deterministik kapılar (kapilar.py) → ikinci model doğrulaması
→ geçmezse gerekçesiyle yeniden dene (en çok DENEME_SAYISI). İnsan onayı YOK (👤 15.11): bir öğe geçmezse GÜN KALDI,
editorial.json YAZILMAZ (fail-closed → 07:50 tek kart). Eksik öğeyle (6'dan az) karusel yoktur.
Kaynak: Atölye `sources/karusel/uretici.py` (13–16 Kasım ölçümü). Burada yollar girdi/çıktı klasörüne bağlandı.

Kullanım: python3 uret.py <girdi_klasörü> <çıktı_klasörü>
  girdi:  edition.json (sunucu edisyonu: day · rawBodyUtf8 · rawBodySha256)
  çıktı:  QA-editoryal.json (her durumda) · editorial.json (yalnız GEÇTİ; v3 çizici şeması, görsel yolları sabit adlarla)
  stdout: son satır JSON {karar, cagri, girisToken, cikisToken, tahminiUsd, sureSn} ya da {hata}
  çıkış:  0 GEÇTİ · 1 KALDI · 2 girdi/ortam hatası
Ortam:  ANTHROPIC_API_KEY (zorunlu; YAZDIRILMAZ) · CAROUSEL_EDITORIAL_MODEL (varsayılan claude-haiku-5-5)
"""
from __future__ import annotations

import hashlib
import json
import os
import sys
import time
from pathlib import Path
from typing import Literal

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kapilar  # noqa: E402
import kaynak  # noqa: E402

DEFAULT_MODEL = 'claude-haiku-5-5'
# 👤 19.11: 3 → 4 deneme. 18–19.11 koşularında 6 öğeden biri 3. denemede doğrulamaya (abartı) takılıp hak bitince günü düşürdü;
# doğrulama yalnız kapılar geçince koşar, uzunluğa harcanan deneme abartı düzeltmesinin hakkını yiyordu.
DENEME_SAYISI = 4
# USD / MTok (giriş, çıkış) — claude-api fiyat tablosu (önbellek 2026-11-03). Tahminîdir; Console esastır.
PRICES = {'claude-haiku-5-5': (0.10, 0.50), 'claude-haiku-4-5': (1.0, 5.0), 'claude-sonnet-5-5': (2.0, 10.0)}
LEAD_CAPTION = 'Temsili illüstrasyon · Yapay zekâ ile oluşturulmuştur'

SYSTEM_URET = """Doctorium Post, doktorlara yönelik günlük bir sağlık haberleri seçkisidir. Görevin: verilen TEK haber için \
Instagram karuselinde kullanılacak kısa Türkçe metinleri yazmak.

Kurallar (hepsi zorunlu):
- Yalnız "KAYNAK METNİ"ndeki bilgiyi kullan. Kaynakta olmayan hiçbir sayı, tarih, kurum, sonuç veya yorum ekleme.
- Sayıları kaynaktaki gibi yaz (ondalıkta Türkçe virgül kullanabilirsin: 19,66).
- Laboratuvar, hücre kültürü, bilgisayar modeli veya hayvan çalışmasıysa özetin son cümlesi bunun insanlarda tedavi \
etkinliği göstermediğini açıkça söyler. Klinik araştırma kaydıysa (sonuç yoksa) "bu bir araştırma duyurusudur, tedavi \
sonucu değildir" anlamını taşıyan bir cümle bulunur.
- Laboratuvar/hayvan çalışmasında BAŞLIKLAR da bulgunun nerede gözlendiğini söyler ("farede", "hücre kültüründe", \
"hayvan çalışmasında") ya da yalnız konuyu adlandırır ("… incelendi"); başlık bulguyu genel bir etki gibi sunmaz.
- Mevzuat haberinde yalnız künye bilgisi: ne yayımlandı, sayısı, tarihi, hangi Resmî Gazete. Değerlendirme yok.
- Kişi adı yazma (kurum adı yazılabilir). Kaynak hakkında açıklama cümlesi yazma ("kaynakta … yok" gibi); \
bilmediğin şeyi hiç anma.
- Abartı yok: "çığır açan, devrim, umut verici, mucize, kanıtlandı, kesin tedavi" gibi sözcükler YASAK. "hekim" yerine \
daima "doktor" yaz.
- Metne bağlantı, kaynak adı listesi veya etiket (#) koyma; künye kartta ayrıca yazılıyor.
- Uzunluk: coverTitle en çok 5 kelime; coverDeck en çok 12 kelime (1-2 kısa cümle); detailTitle ≤ 60 karakter; detailSummary en çok 28 kelime (2-3 kısa cümle; temkin cümlesi gerekiyorsa sonuncusu).
- Kısa yaz: uzun kurum ve çalışma adlarını kısa biçimde an; laboratuvar ölçüm ayrıntılarına (hücre hattı adı, IC50 \
gibi değerler) girme. Tek ana fikir yeterli.
- Uzun kimyasal ad veya formül (ör. "N-(α-…)" biçimli adlar) yazma; ana bileşiğin adı + "türevleri" gibi kısa, genel bir adla an. \
Yazdığın her özel adı (ilaç, molekül, kurum, çalışma adı) kaynaktaki yazımıyla aynen kullan; harfini değiştirme.
- Kapak (coverTitle, coverDeck) teknik terim taşımaz: hedef molekül, mekanizma, hücre hattı veya yöntem adı yazma; konuyu \
ve bulgunun aşamasını sade Türkçeyle söyle (ör. "Hücre kültüründe deneysel bulgu").
- Haber bir klinik araştırma duyurusuysa (hasta alımı, devam eden çalışma) başlıklar "çalışma" veya "araştırma" \
sözcüğünü korur; kısaltırken "yeni tedavi" gibi sonuç izlenimi veren bir ifadeye dönüştürme.
- Sade, tarafsız haber dili. Özgün başlığı çevirme; konuyu bir doktorun anlayacağı kısa bir başlıkla anlat.

Biçem örnekleri (onaylı yayından; içeriklerini KOPYALAMA, yalnız ton ve uzunluk için):
{ornekler}"""

SYSTEM_DOGRULA = """Bir sağlık haberi için yazılmış kısa metinleri KAYNAK METNİ'ne göre denetliyorsun. Görevin metni \
düzeltmek DEĞİL, her iddiayı etiketlemek.

Dört alanın (coverTitle, coverDeck, detailTitle, detailSummary) içindeki her olgusal iddiayı ayrı ayrı çıkar ve etiketle:
- "desteklenir": iddia kaynak metinde açıkça yer alıyor ya da doğrudan çıkıyor.
- "desteklenmez": kaynakta yok, kaynakla çelişiyor ya da kaynaktan daha fazlasını söylüyor (yeni sayı, kurum, sonuç).
- "abartili": kaynakta var ama metin bulguyu olduğundan güçlü, kesin veya klinik olarak yararlı gösteriyor.
"Henüz insanlarda gösterilmedi" gibi temkin cümleleri, kaynak klinik sonuç sunmuyorsa "desteklenir" sayılır.
Özel ad (ilaç, molekül, kurum, çalışma adı) kaynaktakinden farklı yazılmışsa — tek harf bile — o iddia "desteklenmez"dir; dil farkından gelen düzenli Türkçe karşılık (ör. -oyl → -oil) fark sayılmaz.
Gerekçeyi bir kısa cümleyle yaz. Şüphedeysen "desteklenmez" seç."""


# İstemdeki hedef uzunluklar (kapı sınırlarının biraz altında). Ret geri bildirimi modele bu hedefe göre kaç karakter
# kısaltacağını söyler — 17.11 gerçek koşusu: yalnız "coverDeck=141" denince model 141 → 136 → 137 gezindi.
HEDEF = {'coverTitle': 36, 'coverDeck': 90, 'detailTitle': 60, 'detailSummary': 220}
# 19.11 cümle kuralı: açıklama/özet hedefi KELİME cinsinden — karakter hedefi tutmadı (özet 301 → 301 → 295).
# 19.11 başlık kuralı: kapak başlığı da kelime cinsinden (45 karakter → karakter geri bildirimiyle 2. denemede hiç kısalmadı).
KELIME_HEDEF = {'coverTitle': 5, 'coverDeck': 12, 'detailSummary': 28}
KISALTMA_YOLU = ('- Kısaltma yolu: uzun kurum ve çalışma adlarını kısa biçimde an; laboratuvar ölçüm ayrıntılarını '
                 '(hücre hattı adı, IC50 gibi değerler) çıkar; tek ana fikir yaz. Kaynakta olmayan bilgi ekleme.')


def kapi_sorunlari(gates, e: dict) -> list[str]:
    """Başarısız deterministik kapılar → modele gidecek ret satırları. Uzunlukta alan başına sayı + hedef + fark verilir."""
    out, uzun = [], False
    for a, ok, d in gates:
        if ok:
            continue
        if a != 'uzunluk':
            out.append(f'- {a}: {d}')
            continue
        for k in kapilar.LIMITS:
            n = len(e[k])
            if n > kapilar.LIMITS[k]:
                if k in KELIME_HEDEF:
                    w = len(e[k].split())
                    out.append(f'- uzunluk: {k} {n} karakter ({w} kelime); sınır {kapilar.LIMITS[k]} karakter. '
                               f'En çok {KELIME_HEDEF[k]} kelime yaz → en az {max(1, w - KELIME_HEDEF[k])} kelime çıkar.')
                else:
                    out.append(f'- uzunluk: {k} {n} karakter; sınır {kapilar.LIMITS[k]}. Hedef en çok {HEDEF[k]} → '
                               f'en az {n - HEDEF[k]} karakter kısalt.')
                uzun = True
            elif n < kapilar.MIN_LEN[k]:
                out.append(f'- uzunluk: {k} {n} karakter; en az {kapilar.MIN_LEN[k]} olmalı → '
                           f'en az {kapilar.MIN_LEN[k] - n} karakter uzat (yalnız kaynaktaki bilgiyle).')
    if uzun:
        out.append(KISALTMA_YOLU)
    return out


def deneme_mesaji(akis: str, src: str, geri: str = '', onceki: dict | None = None) -> str:
    """Bir üretim denemesinin kullanıcı mesajı. Yeniden denemede reddedilen taslak alan alan karakter sayısıyla gösterilir
    (18.11 ikinci koşu: taslağı görmeyen model "23 karakter kısalt" denince sıfırdan yazıp yalnız 1–3 karakter kısalttı)."""
    user = f"AKIŞ: {akis}\n\nKAYNAK METNİ:\n{src}"
    if onceki:
        satirlar = '\n'.join(f'- {k} ({len(onceki[k])} karakter): {onceki[k]}' for k in kapilar.LIMITS)
        user += f"\n\nÖNCEKİ TASLAK:\n{satirlar}"
    if geri:
        user += f"\n\nÖNCEKİ TASLAK REDDEDİLDİ. Nedenleri:\n{geri}\nBu sorunları gidererek yeniden yaz."
        if onceki:
            user += ' Sorunsuz alanları koruyabilir, sorunlu alanı önceki metni düzelterek yazabilirsin.'
    return user


class Hata(Exception):
    pass


def edisyon_oku(p: Path) -> tuple[dict, list[dict]]:
    try:
        ed = json.loads(p.read_text(encoding='utf-8'))
        items = json.loads(ed['rawBodyUtf8'])['items']
    except (OSError, ValueError, KeyError, TypeError) as exc:
        raise Hata(f'edisyon okunamadı: {type(exc).__name__}') from None
    if hashlib.sha256(ed['rawBodyUtf8'].encode('utf-8')).hexdigest() != ed.get('rawBodySha256') or ed.get('testOnly'):
        raise Hata('edisyon doğrulanamadı')
    if len(items) != 6:
        raise Hata(f'edisyonda 6 öğe yok ({len(items)})')
    return ed, items


# 19.11: 5 → 3 örneğe geri (18.11 koşusu: 5 örnek kısalık kazandırmadı, yalnız token + süre ekledi).
ORNEK_SAYISI = 3


def ornekler(exclude_url: str) -> str:
    items = json.loads((HERE / 'ornekler.json').read_text(encoding='utf-8'))['items']
    rows = [i for i in items if i['sourceUrl'] != exclude_url][:ORNEK_SAYISI]   # aynı haber örnek olarak verilmez
    return '\n'.join(json.dumps({k: i[k] for k in ('coverTitle', 'coverDeck', 'detailTitle', 'detailSummary')},
                                ensure_ascii=False) for i in rows)


class Sayac:
    def __init__(self, model: str):
        self.model, self.inp, self.out, self.calls = model, 0, 0, 0

    def ekle(self, usage):
        self.inp += usage.input_tokens
        self.out += usage.output_tokens
        self.calls += 1

    def usd(self) -> float:
        pi, po = PRICES.get(self.model, (0, 0))
        return round(self.inp / 1e6 * pi + self.out / 1e6 * po, 5)


def editorial_kur(day: str, ed_sha: str, model: str, rows: list[dict]) -> dict:
    """v3 çizicinin beklediği şema; görseller sabit adlarla (gorseller/kapak.png · gorseller/haber-N.png)."""
    return {'schemaVersion': 1, 'day': day, 'origin': f'otomatik ({model}); insan onayı yok — kapılar + ikinci model doğrulaması',
            'edition': {'rawBodySha256': ed_sha}, 'leadImage': {'path': 'gorseller/kapak.png', 'caption': LEAD_CAPTION},
            'items': [{'sourceUrl': r['sourceUrl'], 'coverCategory': r['streamLabel'], 'detailCategory': r['streamLabel'],
                       **r['taslak'], 'image': f"gorseller/haber-{r['n']}.png"} for r in rows]}


def calistir(girdi: Path, cikti: Path, client, model: str) -> dict:
    # Model şemaları yalnız burada gerekir (pydantic) — saf yardımcılar/testler SDK'sız içe aktarılabilsin.
    from pydantic import BaseModel, Field

    class Taslak(BaseModel):
        coverTitle: str = Field(description='Kapak için çok kısa başlık, en çok 5 kelime')
        coverDeck: str = Field(description='Kapak için en çok 12 kelime, 1-2 kısa cümle')
        detailTitle: str = Field(description='Haber kartı başlığı')
        detailSummary: str = Field(description='Haber kartı özeti, en çok 28 kelime, 2-3 kısa cümle')

    class Iddia(BaseModel):
        alan: Literal['coverTitle', 'coverDeck', 'detailTitle', 'detailSummary']
        iddia: str
        etiket: Literal['desteklenir', 'desteklenmez', 'abartili']
        gerekce: str

    class Dogrulama(BaseModel):
        iddialar: list[Iddia]

    ed, items = edisyon_oku(girdi / 'edition.json')
    sayac, rows, t0 = Sayac(model), [], time.time()

    def parse(system, user, schema):
        r = client.messages.parse(model=model, max_tokens=4000, system=system, messages=[{'role': 'user', 'content': user}],
                                  output_config={'effort': 'low'}, output_format=schema)
        sayac.ekle(r.usage)
        if r.stop_reason == 'refusal':
            raise RuntimeError('model reddetti')
        if r.stop_reason == 'max_tokens' or r.parsed_output is None:
            raise RuntimeError(f'eksik yanıt (stop_reason={r.stop_reason})')
        return r.parsed_output

    for n, item in enumerate(items, 1):
        pkt = kaynak.collect(item, cikti / 'onbellek')
        src = kaynak.source_text(pkt)
        log, geri, kabul, onceki = [], '', None, None
        for deneme in range(1, DENEME_SAYISI + 1):
            user = deneme_mesaji(item['streamLabel'], src, geri, onceki)
            try:
                e = parse(SYSTEM_URET.format(ornekler=ornekler(item['url'])), user, Taslak).model_dump()
            except Exception as exc:  # noqa: BLE001 — bir deneme düşer, gün devam eder
                log.append({'deneme': deneme, 'hata': str(exc)[:300]})
                geri = 'Yanıt alınamadı; kurallara uyarak yeniden yaz.'
                continue
            gates = kapilar.check(e, item, src)
            rec = {'deneme': deneme, 'taslak': e, 'kapilar': [{'ad': a, 'gecti': ok, 'ayrinti': d} for a, ok, d in gates]}
            sorun = kapi_sorunlari(gates, e)
            if not sorun:   # deterministik kapılar geçtiyse ikinci model doğrulaması
                try:
                    v = parse(SYSTEM_DOGRULA, f"KAYNAK METNİ:\n{src}\n\nDENETLENECEK METİN:\n{json.dumps(e, ensure_ascii=False, indent=1)}",
                              Dogrulama)
                    rec['dogrulama'] = [i.model_dump() for i in v.iddialar]
                    sorun += [f'- {i.alan}: "{i.iddia}" → {i.etiket} ({i.gerekce})' for i in v.iddialar if i.etiket != 'desteklenir']
                    if not v.iddialar:
                        sorun.append('- doğrulama hiç iddia çıkarmadı')
                except Exception as exc:  # noqa: BLE001
                    sorun.append(f'- doğrulama yapılamadı: {str(exc)[:200]}')
            rec['sonuc'] = 'GECTI' if not sorun else 'KALDI'
            log.append(rec)
            if not sorun:
                kabul = e
                break
            geri, onceki = '\n'.join(sorun), e
        rows.append({'n': n, 'sourceUrl': item['url'], 'streamLabel': item['streamLabel'], 'kaynakOkundu': pkt['fetchedOk'],
                     'kaynakHatasi': pkt['error'], 'sonuc': 'GECTI' if kabul else 'KALDI', 'denemeler': log, 'taslak': kabul})

    gecti = len(rows) == 6 and all(r['taslak'] for r in rows)
    qa = {'kind': 'karusel-editoryal', 'day': ed['day'], 'model': model, 'editionRawSha256': ed['rawBodySha256'],
          'gun': 'GECTI' if gecti else 'KALDI', 'denemeSiniri': DENEME_SAYISI, 'cagri': sayac.calls, 'girisToken': sayac.inp,
          'cikisToken': sayac.out, 'tahminiUsd': sayac.usd(), 'sureSn': round(time.time() - t0, 1), 'ogeler': rows}
    cikti.mkdir(parents=True, exist_ok=True)
    (cikti / 'QA-editoryal.json').write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding='utf-8')
    if gecti:
        (cikti / 'editorial.json').write_text(json.dumps(editorial_kur(ed['day'], ed['rawBodySha256'], model, rows),
                                                         ensure_ascii=False, indent=2), encoding='utf-8')
    return qa


def main():
    try:
        if len(sys.argv) != 3:
            raise Hata('kullanım: uret.py <girdi> <çıktı>')
        girdi, cikti = Path(sys.argv[1]), Path(sys.argv[2])
        key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
        if not key:
            raise Hata('ANTHROPIC_API_KEY tanımlı değil')
        edisyon_oku(girdi / 'edition.json')   # model çağrısından ÖNCE girdi denetimi
        import anthropic
        model = os.environ.get('CAROUSEL_EDITORIAL_MODEL', '').strip() or DEFAULT_MODEL
        qa = calistir(girdi, cikti, anthropic.Anthropic(api_key=key, max_retries=3), model)
    except Hata as exc:
        print(json.dumps({'hata': str(exc)}, ensure_ascii=False))
        sys.exit(2)
    print(json.dumps({k: qa[k] for k in ('gun', 'cagri', 'girisToken', 'cikisToken', 'tahminiUsd', 'sureSn')} | {'karar': qa['gun']},
                     ensure_ascii=False))
    sys.exit(0 if qa['gun'] == 'GECTI' else 1)


if __name__ == '__main__':
    main()
