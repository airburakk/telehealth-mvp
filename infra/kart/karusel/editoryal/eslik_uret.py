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
import ictihat  # noqa: E402
import kaynak  # noqa: E402
import kapak_sigma  # noqa: E402

KOK = HERE.parents[3]
HEDEF = KOK / 'tests' / 'unit' / 'karusel-kapilar-eslik.json'
KAPAK_HEDEF = KOK / 'tests' / 'unit' / 'karusel-kapak-sigma-eslik.json'

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
    # 27.11 düzeltmeleri — bu haftanın KALDI günlerinden gerçek metinler.
    # 23.11 öğe 6: 45 karakterlik başlık artık uzunluktan geçer (sığma kapak_sigma'nın işi); 53 karakter hâlâ düşer.
    ekle('covertitle-45-gecer', dict(E, coverTitle='Cinsiyet gelişim bozuklukları ve İslam hukuku'), 'x', 'Arşivden Doktrin')
    ekle('uzun-covertitle-53', dict(E, coverTitle='Cinsiyet gelişim bozukluklarında İslam hukuku etiği'
                                                   ' ve'), 'x')
    # 27.11 öğe 4: "in vitro fertilization" klinik öncesi SAYILMAZ; aynı kaynakta hücre geçerse yine sayılır.
    ekle('ivf-klinik-oncesi-degil', E, 'Coping during In Vitro Fertilization: protocol. In vitro fertilisation (IVF) is burdensome.',
         'Akademik')
    ekle('ivf-ve-hucre', E, 'In vitro fertilization outcomes and granulosa cells.', 'Akademik')
    # 26.11 öğe 3: tırnaklı özgün etkinlik adında yasak sözcük → geri bildirim alanı ve tırnak kuralını söyler.
    ekle('yasak-hekim-tirnak', dict(E, detailSummary='Tıp fakültesi, “Hekimlerin Hukuki Sorumluluğu” konulu bilimsel toplantı '
                                                     'düzenliyor. Toplantıda doktorların hukuki sorumlulukları ele alınacak.'), 'x')

    # Onaylı 14 Kasım biçem örnekleri — her biri kendi metniyle kaynak (kapılardan GEÇMELİ)
    ornek = json.loads((HERE / 'ornekler.json').read_text(encoding='utf-8'))['items']
    for i, o in enumerate(ornek):
        t = {k: o[k] for k in ('coverTitle', 'coverDeck', 'detailTitle', 'detailSummary')}
        ekle(f'ornek-{i}', t, ' '.join(t.values()), o.get('coverCategory') or 'Akademik')
    return v


ICTIHAT_HEDEF = KOK / 'tests' / 'unit' / 'karusel-ictihat-eslik.json'
_OZET_UZUN = 'Konu: Malpraktis, Yanlış tedavi/tanı, Aydınlatılmış onam. Dayanak: ' + ', '.join(f'TBK m.{i}' for i in range(40, 60)) + '.'


def ictihat_vakalari():
    """İçtihat şablonu eşliği (2026-11-25): ilk 6 vaka DEV'deki gerçek kararların kart satırı (künye + sözlük satırı)."""
    def oge(ad, title, kaynak_adi, ozet, yedek=False, akis='Arşivden İçtihat'):
        return {'ad': ad, 'item': {'stream': 'ictihat', 'streamLabel': akis, 'url': None, 'title': title, 'sourceName': kaynak_adi,
                                   'publishedAt': '2026-10-14T00:00:00.000Z', 'summaryLong': ozet, 'summaryLongFallback': yedek}}
    d3 = 'Yargıtay — 3. Hukuk Dairesi'
    v = [
        oge('gercek-1', 'Yargıtay 3. Hukuk Dairesi · E. 2025/6274, K. 2026/3304', d3, 'Konu: Malpraktis, Yanlış tedavi/tanı, Tazminat.'),
        oge('gercek-2', 'Yargıtay 3. Hukuk Dairesi · E. 2026/87, K. 2026/3186', d3, 'Konu: Malpraktis, Tazminat, Manevi tazminat.'),
        oge('gercek-3', 'Yargıtay 3. Hukuk Dairesi · E. 2025/6201, K. 2026/3211', d3, 'Konu: Malpraktis, Tazminat, Komplikasyon.'),
        oge('gercek-5', 'Yargıtay 3. Hukuk Dairesi · E. 2025/6022, K. 2026/3076', d3, 'Konu: Tazminat, Manevi tazminat, Aydınlatılmış onam.'),
        oge('gercek-7', 'Yargıtay 3. Hukuk Dairesi · E. 2025/6029, K. 2026/2864', d3, 'Konu: Tazminat, Manevi tazminat, Özen yükümlülüğü.'),
        oge('gercek-8-dayanak', 'Yargıtay 3. Hukuk Dairesi · E. 2025/6156, K. 2026/2829', d3,
            'Konu: Malpraktis, Tazminat, Manevi tazminat. Dayanak: TBK m.56.', akis='İçtihat'),
        oge('konu-kisa', 'Yargıtay 3. Hukuk Dairesi · E. 2025/1, K. 2026/2', d3, 'Konu: Tazminat.'),
        oge('konusuz-bos', 'Yargıtay 3. Hukuk Dairesi · E. 2025/3, K. 2026/4', d3, ''),
        oge('konusuz-dayanakli', 'Yargıtay 3. Hukuk Dairesi · E. 2025/5, K. 2026/6', d3, 'Dayanak: TBK m.49.'),
        oge('yedek-cumle', 'Yargıtay 3. Hukuk Dairesi · E. 2025/7, K. 2026/8', d3, 'Yargıtay kararı; ayrıntı kaynak bağlantısında.', yedek=True),
        oge('ozet-uzun', 'Yargıtay 3. Hukuk Dairesi · E. 2025/9, K. 2026/10', d3, _OZET_UZUN),
        oge('genel-kurul', 'Yargıtay Hukuk Genel Kurulu · E. 2024/11, K. 2025/12', 'Yargıtay — Hukuk Genel Kurulu', 'Konu: Malpraktis, Tazminat.'),
        oge('daire-uzun', 'Yargıtay Hukuk Genel Kurulu · E. 2024/13, K. 2025/14', 'Yargıtay — ' + 'Çok Uzun Adlı Bir Daire ' * 2,
            'Konu: Malpraktis, Tazminat.'),
        oge('kaynak-onekisiz', 'Yargıtay 12. Ceza Dairesi · E. 2024/15, K. 2025/16', 'Yargıtay', 'Konu: Taksirle yaralama, Malpraktis.'),
        oge('baslik-uzun', 'Yargıtay 12. Ceza Dairesi · E. 2024/123456, K. 2025/654321 · Ek karar · Düzeltme ve birleştirme',
            'Yargıtay — 12. Ceza Dairesi', 'Konu: Malpraktis.'),
    ]
    out = []
    for c in v:
        src = kaynak.edisyon_metni(c['item'])
        t = ictihat.ictihat_taslagi(c['item'])
        out.append({**c, 'edisyonMetni': src, 'taslak': t, 'kapilar': [[a, ok, d] for a, ok, d in kapilar.check(t, c['item'], src)]})
    return out


def kapak_vakalari():
    """Kapak sığma kapısı (2026-11-26): derlemdeki her metin × 6 konum → kapak_sigma.py sonucu + yerleşim; TS aynısını vermeli."""
    ornekler = json.loads((HERE / 'kapak_sigma_ornekler.json').read_text(encoding='utf-8'))['ornekler']
    out = []
    for o in ornekler:
        e = {'coverTitle': o['coverTitle'], 'coverDeck': o['coverDeck']}
        for k in range(1, 7):
            bk, ak = kapak_sigma.KONUMLAR[k - 1]
            out.append({'konum': k, 'taslak': e, 'sonuc': list(kapak_sigma.kapak_sigma(e, k)),
                        'baslik': kapak_sigma.yerlesim(e['coverTitle'], bk, True),
                        'aciklama': kapak_sigma.yerlesim(e['coverDeck'], ak, False)})
    return out


def main():
    ic = ictihat_vakalari()
    ICTIHAT_HEDEF.write_text(json.dumps({'kaynak': 'infra/kart/karusel/editoryal/ictihat.py (eslik_uret.py ile üretildi)',
                                         'not': ictihat.ICTIHAT_NOTU, 'vakalar': ic}, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(ic)} içtihat vakası → {ICTIHAT_HEDEF.relative_to(KOK)}')
    # İstem metinleri de eşlik kapsamında (TS uret.ts aynı metni modele vermeli). uret.py SDK'sız içe aktarılabilir.
    import uret
    out = []
    for c in vakalar():
        r = kapilar.check(c['taslak'], c['item'], c['src'])
        # Ret geri bildirimi (2026-11-18): TS kapiSorunlari aynı satırları üretmeli.
        # Kısaltma adımı (2026-11-21): uygunluk + mesaj TS kisaltilacakAlanlar/kisaltmaMesaji ile aynı olmalı.
        al = uret.kisaltilacak_alanlar(r, c['taslak'])
        out.append({**c, 'beklenen': [[a, ok, d] for a, ok, d in r], 'geriBildirim': uret.kapi_sorunlari(r, c['taslak']),
                    'kisaltilacak': al, 'kisaltmaMesaji': uret.kisaltma_mesaji(c['taslak'], al) if al else None})
    url = json.loads((HERE / 'ornekler.json').read_text(encoding='utf-8'))['items'][0]['sourceUrl']
    istemler = {'uret': uret.SYSTEM_URET, 'dogrula': uret.SYSTEM_DOGRULA, 'kisalt': uret.SYSTEM_KISALT, 'orneklerHaric': url, 'ornekler': uret.ornekler(url),
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
    kv = kapak_vakalari()
    # Ret geri bildirimi uçtan uca: kapı listesinin sonuna kapak_sigma eklenir, kapi_sorunlari onu "- kapak_sigma: …" yazar.
    tam = dict(E, coverDeck='TJOD Ankara Çankaya Şubesi, Serviks Kanseri Farkındalık Ayı kapsamında bilimsel toplantı '
                            'düzenliyor. Doktorlar davetli.')
    oge = {'streamLabel': 'Sektörel', 'url': 'https://x'}
    geri = {str(k): uret.kapi_sorunlari(kapilar.check(tam, oge, 'x', k), tam) for k in (3, 4)}
    KAPAK_HEDEF.write_text(json.dumps({'kaynak': 'infra/kart/karusel/editoryal/kapak_sigma.py (eslik_uret.py ile üretildi)',
                                       'geriBildirim': {'taslak': tam, 'konumlar': geri}, 'vakalar': kv},
                                      ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'{len(kv)} kapak vakası → {KAPAK_HEDEF.relative_to(KOK)}')


if __name__ == '__main__':
    main()
