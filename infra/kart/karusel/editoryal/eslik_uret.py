"""Python ↔ TypeScript kapı eşliği fikstürünü üretir (Vercel'e taşıma, 2026-11-17).

Aynı (taslak, öğe, kaynak) vakalarını kapilar.check'ten geçirir ve beklenen sonucu yazar; TS sürümü
(src/lib/karusel-editoryal/kapilar.ts) tests/unit/karusel-editoryal-kapilar.test.ts'te aynı vakalarla BİREBİR aynı
[ad, geçti, ayrıntı] listesini vermelidir. kapilar.py değişirse bu betik yeniden koşulur ve TS de güncellenir.

Kullanım (depo kökünden): python -X utf8 infra/kart/karusel/editoryal/eslik_uret.py
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kapilar  # noqa: E402

KOK = HERE.parents[3]
HEDEF = KOK / 'tests' / 'unit' / 'karusel-kapilar-eslik.json'

E = {'coverTitle': 'Yapay zekâ ve sağlık hukuku', 'coverDeck': 'Doktrin incelemesi yapay zekâyı sağlık hukuku açısından ele alıyor.',
     'detailTitle': 'Yapay zekâ sağlık hukuku kapsamında değerlendirildi',
     'detailSummary': 'Doktrin incelemesi, yapay zekânın sağlık hukukunda doğurduğu sorumluluk sorularını ele alıyor. '
                      'Makale, mevcut düzenlemelerin bu teknolojiye nasıl uygulanabileceğini tartışıyor.'}


def vakalar():
    v = []

    def ekle(ad, e, src, akis='Sektörel'):
        v.append({'ad': ad, 'taslak': e, 'item': {'streamLabel': akis, 'url': 'https://x'}, 'src': src})

    # test_editoryal.py vakaları
    ekle('temkin-firat', E, 'Fırat Üniversitesi Doğu Araştırmaları Dergisi (2007).', 'Arşivden Doktrin')
    for i, s in enumerate(('Bulgu farelerde gözlendi.', 'Treated rat model.', 'Kanser hücrelerinde etki.', 'Study in mice.')):
        ekle(f'temkin-klinik-oncesi-{i}', E, s)
    src = 'More than 11,000 cases have been recorded, and nearly half of those infected have died.'
    for i, oz in enumerate(('Kongo’da 11 binden fazla vaka kaydedildi; enfekte olanların yaklaşık yarısı öldü.',
                            'Kongo’da 11 vaka kaydedildi ve enfekte olanların yaklaşık yarısı öldü bildirildi.',
                            'Kongo’da 12 binden fazla vaka kaydedildi; enfekte olanların yarısı öldü bildirildi.',
                            'Kongo’da 11 binlerce vaka; 11 bine yakın kişi etkilendi, yaklaşık yarısı öldü bildirildi.')):
        ekle(f'bin-{i}', dict(E, detailSummary=oz), src)
    ekle('yasak-mucize', dict(E, coverDeck='Mucize bir yaklaşım sağlık hukukunda ele alınıyor, deniyor.'), 'x')
    akr = dict(E, coverDeck='Klinik beş yıllık akreditasyon aldı; karar kurum tarafından duyuruldu.')
    ekle('akredit-kaynaksiz', akr, 'Klinik yeni bir dönem başlattı.')
    ekle('akredit-kaynakli', akr, 'The clinic was accredited for five years.')
    ekle('uzunluk-kisa', dict(E, detailSummary='Kısa.'), 'x')
    ekle('baglanti', dict(E, coverDeck=E['coverDeck'] + ' https://ornek.org'), 'x')

    # Unicode / katlama / sınır vakaları (Python ↔ JS farkının çıkabileceği yerler)
    ekle('hekim-buyuk', dict(E, coverTitle='HEKİMLER için yeni rehber'), 'x')
    ekle('insanlarda-buyuk', dict(E, detailSummary=E['detailSummary'] + ' İNSANLARDA etkinlik gösterilmedi.'), 'Bulgu farelerde gözlendi.')
    ekle('sayi-ondalik', dict(E, detailSummary='Oran yüzde 19,66 ve 44.66 olarak ölçüldü; çalışma 2026 yılında yayımlandı ve tartışıldı.'),
         'Rates were 19.66 and 44,66 in 2026.')
    ekle('sayi-eksik', dict(E, detailSummary='Oran yüzde 19,67 ölçüldü; LITESPARK-034 çalışması 2026 yılında tartışıldı ve yayımlandı.'),
         'Rates were 19.66 in 2026, LITESPARK-034.')
    ekle('kisi-adi', dict(E, detailSummary='Prof. Dr. Ayşe Yılmaz ve Doç. Şükrü ile Dr.Ömer değerlendirmeyi yaptı; çalışma sorumluluğu ele alıyor.'), 'x')
    ekle('ic-ses', dict(E, detailSummary=E['detailSummary'] + ' Kaynakta tarih belirtilmemiş.'), 'x')
    ekle('mevzuat-yorum', dict(E, detailSummary='Önemli bir yönetmelik yayımlandı; yeni dönem başlıyor ve kurumlar olumlu karşıladı, değerlendirme sürüyor.'),
         'x', 'Mevzuat')
    ekle('mevzuat-temiz', E, 'x', 'Mevzuat')
    ekle('ilac-temkinsiz', E, 'x', 'İlaç & Cihaz')
    ekle('ilac-temkinli', dict(E, detailSummary=E['detailSummary'] + ' Bu bir araştırma duyurusudur.'), 'x', 'İlaç & Cihaz')
    ekle('rat-sozcuk-sonu', E, 'Ratios and pirate data; rats.')
    ekle('rat-tam', E, 'In the rat, dosing differed.')
    ekle('in-vitro', E, 'An IN VITRO assay with cell lines.')
    ekle('kesin-tedavi', dict(E, coverDeck='Kesin tedavi iddiası olmadan yeni yaklaşım hukuk açısından ele alınıyor.'), 'A cure was not claimed.')
    ekle('garanti', dict(E, coverDeck='Garanti verilmeden yeni yaklaşım sağlık hukuku açısından ele alınıyor.'), 'x')
    ekle('emoji-uzunluk', dict(E, coverTitle='Yapay zekâ 🤖 ve sağlık hukuku'), 'x')
    # 17.11 gerçek koşusundan uzunluk aşımları (geri bildirim eşliği: alan başına sayı + hedef + kısaltma yolu)
    ekle('uzun-coverdeck', dict(E, coverDeck='SBÜ İzmir Tepecik Eğitim Araştırma Hastanesi İnfeksiyon Hastalıkları ve '
                                            'Klinik Mikrobiyoloji Kliniği beş yıl süreyle yeniden akredite edildi.'), 'x')
    ekle('uzun-iki-alan', dict(E, coverDeck='ö' * 133, detailSummary='Uzun özet ' * 31 + 'sona erdi.'), 'x')
    ekle('uzun-emoji', dict(E, detailTitle='🧪' * 73), 'x')
    # 19.11 gerçek koşu: 45 karakter / 6 kelime kapak başlığı → kelime yolundan geri bildirim.
    ekle('uzun-covertitle', dict(E, coverTitle='İleri böbrek kanserinde yeni tedavi çalışması'), 'x')

    # Onaylı 14 Kasım biçem örnekleri — her biri kendi metniyle kaynak (kapılardan GEÇMELİ)
    ornek = json.loads((HERE / 'ornekler.json').read_text(encoding='utf-8'))['items']
    for i, o in enumerate(ornek):
        t = {k: o[k] for k in ('coverTitle', 'coverDeck', 'detailTitle', 'detailSummary')}
        ekle(f'ornek-{i}', t, ' '.join(t.values()), o.get('coverCategory') or 'Akademik')
    return v


def main():
    # İstem metinleri de eşlik kapsamında (TS uret.ts aynı metni modele vermeli). uret.py SDK'sız içe aktarılabilir.
    import uret
    out = []
    for c in vakalar():
        r = kapilar.check(c['taslak'], c['item'], c['src'])
        # Ret geri bildirimi (2026-11-18): TS kapiSorunlari aynı satırları üretmeli.
        out.append({**c, 'beklenen': [[a, ok, d] for a, ok, d in r], 'geriBildirim': uret.kapi_sorunlari(r, c['taslak'])})
    url = json.loads((HERE / 'ornekler.json').read_text(encoding='utf-8'))['items'][0]['sourceUrl']
    istemler = {'uret': uret.SYSTEM_URET, 'dogrula': uret.SYSTEM_DOGRULA, 'orneklerHaric': url, 'ornekler': uret.ornekler(url),
                'orneklerHepsi': uret.ornekler('https://yok'), 'leadCaption': uret.LEAD_CAPTION, 'denemeSayisi': uret.DENEME_SAYISI,
                # Deneme mesajı (2026-11-18): yeniden denemede önceki taslak alan alan karakter sayısıyla (emoji = 1 karakter).
                'denemeMesaji': {
                    'ilk': uret.deneme_mesaji('Akademik', 'KAYNAK X'),
                    'tekrar': uret.deneme_mesaji('Akademik', 'KAYNAK X', '- uzunluk: coverDeck 141 karakter',
                                                 dict(E, coverTitle='Yapay zekâ 🤖 ve sağlık hukuku')),
                    'hataSonrasi': uret.deneme_mesaji('Sektörel', 'KAYNAK Y', 'Yanıt alınamadı; kurallara uyarak yeniden yaz.'),
                }}
    HEDEF.write_text(json.dumps({'kaynak': 'infra/kart/karusel/editoryal/kapilar.py + uret.py (eslik_uret.py ile üretildi)',
                                 'istemler': istemler, 'vakalar': out},
                                ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(out)} vaka → {HEDEF.relative_to(KOK)}')


if __name__ == '__main__':
    main()
