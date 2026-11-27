"""Editoryal üretici + kapılar — ağ ve model YOK (sahte istemci, sahte kaynak okuyucu).

Çalıştır (konteynerde CI): python3 -m unittest discover -s /app/karusel/editoryal -p 'test_*.py' -v
Yerelde: python -X utf8 -m unittest discover -s infra/kart/karusel/editoryal -p "test_*.py"
"""
import hashlib
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kapilar  # noqa: E402
import kaynak  # noqa: E402
import uret  # noqa: E402

E = {'coverTitle': 'Yapay zekâ ve sağlık hukuku', 'coverDeck': 'Doktrin incelemesi yapay zekâyı sağlık hukuku açısından ele alıyor.',
     'detailTitle': 'Yapay zekâ sağlık hukuku kapsamında değerlendirildi',
     'detailSummary': 'Doktrin incelemesi, yapay zekânın sağlık hukukunda doğurduğu sorumluluk sorularını ele alıyor. '
                      'Makale, mevcut düzenlemelerin bu teknolojiye nasıl uygulanabileceğini tartışıyor.'}


def kapi(e, src, akis='Sektörel'):
    return {n: ok for n, ok, _ in kapilar.check(e, {'streamLabel': akis, 'url': 'https://x'}, src)}


class Kapilar(unittest.TestCase):
    def test_tup_bebek_klinik_oncesi_sayilmaz(self):   # 27.11 öğe 4: IVF protokolü "klinik öncesi" sanılmıştı
        temkin = lambda src: dict((a, ok) for a, ok, _ in kapilar.check(E, {'streamLabel': 'Akademik'}, src))['temkin']
        self.assertTrue(temkin('Coping during in vitro fertilization (IVF): protocol. In Vitro Fertilisation burden.'))
        self.assertFalse(temkin('In vitro fertilization outcomes and granulosa cells.'))
        self.assertFalse(temkin('An in vitro assay of embryo culture media.'))

    def test_temkin_sozcuk_siniri(self):   # 16.11: kaynakçadaki "Fırat Üniversitesi" 'rat ' sanılıyordu
        self.assertTrue(kapi(E, 'Fırat Üniversitesi Doğu Araştırmaları Dergisi (2007).', 'Arşivden Doktrin')['temkin'])
        for s in ('Bulgu farelerde gözlendi.', 'Treated rat model.', 'Kanser hücrelerinde etki.', 'Study in mice.'):
            self.assertFalse(kapi(E, s)['temkin'], s)

    def test_bin_kalibi(self):             # 16.11 Ebola: "11,000 cases" ↔ "11 binden fazla"
        src = 'More than 11,000 cases have been recorded, and nearly half of those infected have died.'
        ok = lambda ozet: kapi(dict(E, detailSummary=ozet), src)['sayilar']  # noqa: E731
        self.assertTrue(ok('Kongo’da 11 binden fazla vaka kaydedildi; enfekte olanların yaklaşık yarısı öldü.'))
        self.assertFalse(ok('Kongo’da 11 vaka kaydedildi ve enfekte olanların yaklaşık yarısı öldü bildirildi.'))
        self.assertFalse(ok('Kongo’da 12 binden fazla vaka kaydedildi; enfekte olanların yarısı öldü bildirildi.'))

    def test_yasak_sozcuk_ve_kaynak_istisnasi(self):
        self.assertFalse(kapi(dict(E, coverDeck='Mucize bir yaklaşım sağlık hukukunda ele alınıyor, deniyor.'), 'x')['yasak_sozcuk'])
        akr = dict(E, coverDeck='Klinik beş yıllık akreditasyon aldı; karar kurum tarafından duyuruldu.')
        self.assertFalse(kapi(akr, 'Klinik yeni bir dönem başlattı.')['yasak_sozcuk'])
        self.assertTrue(kapi(akr, 'The clinic was accredited for five years.')['yasak_sozcuk'])

    def test_uzunluk_ve_baglanti(self):
        self.assertFalse(kapi(dict(E, detailSummary='Kısa.'), 'x')['uzunluk'])
        self.assertFalse(kapi(dict(E, coverDeck=E['coverDeck'] + ' https://ornek.org'), 'x')['baglanti_yok'])


# ---- üretici: sahte istemci ----
def edisyon(kok: Path) -> Path:
    items = [{'url': f'https://ornek.org/{i}', 'title': f'Başlık {i}', 'sourceName': 'Örnek', 'streamLabel': 'Sektörel',
              'summaryLong': 'Kurum yeni bir sağlık hukuku değerlendirmesi yayımladı.'} for i in range(1, 7)]
    body = json.dumps({'items': items}, ensure_ascii=False)
    d = kok / 'girdi'
    d.mkdir()
    (d / 'edition.json').write_text(json.dumps({'day': '2026-11-16', 'rawBodyUtf8': body,
                                                'rawBodySha256': hashlib.sha256(body.encode()).hexdigest()}), encoding='utf-8')
    return d


class GeriBildirim(unittest.TestCase):
    """Ret satırları: uzunlukta alan başına sayı + sınır + hedefe göre kısaltma miktarı (17.11 gerçek koşusu dersi)."""

    def sorun(self, e):
        return uret.kapi_sorunlari(kapilar.check(e, {'streamLabel': 'Sektörel', 'url': 'https://x'}, 'x'), e)

    def test_uzun_alan_kac_karakter_kisaltilacagini_soyler(self):
        s = self.sorun(dict(E, coverDeck=' '.join(['kelime'] * 20)))
        self.assertIn('- uzunluk: coverDeck 139 karakter (20 kelime); sınır 125 karakter. En çok 12 kelime yaz → en az 8 kelime çıkar.', s)
        self.assertEqual(s[-1], uret.KISALTMA_YOLU)

    def test_baslik_karakter_hedefiyle_kisaltilir(self):
        s = self.sorun(dict(E, detailTitle='ö' * 80))
        self.assertIn('- uzunluk: detailTitle 80 karakter; sınır 72. Hedef en çok 60 → en az 20 karakter kısalt.', s)
        self.assertEqual(s[-1], uret.KISALTMA_YOLU)

    def test_kapak_basligi_kelime_hedefiyle_kisaltilir(self):
        # 27.11: sınır 44 → 52; 45 karakter artık geçer (kapak_sigma ölçer), kelime yolu 53+ karakterde sürer.
        self.assertEqual(self.sorun(dict(E, coverTitle='İleri böbrek kanserinde yeni tedavi çalışması')), [])
        s = self.sorun(dict(E, coverTitle='İleri evre böbrek kanserinde yeni tedavi araştırmaları'))
        self.assertIn('- uzunluk: coverTitle 54 karakter (7 kelime); sınır 52 karakter. En çok 5 kelime yaz → en az 2 kelime çıkar.', s)
        self.assertEqual(s[-1], uret.KISALTMA_YOLU)

    def test_kisa_alan_uzatma_ister_kisaltma_yolu_eklenmez(self):
        self.assertEqual(self.sorun(dict(E, detailSummary='Kısa.')),
                         ['- uzunluk: detailSummary 5 karakter; en az 90 olmalı → en az 85 karakter uzat (yalnız kaynaktaki bilgiyle).'])

    def test_yeniden_denemede_onceki_taslak_karakter_sayisiyla_gosterilir(self):
        m = uret.deneme_mesaji('Sektörel', 'SRC', '- uzunluk: coverDeck 141 karakter', dict(E, coverDeck='ö' * 141))
        self.assertIn('ÖNCEKİ TASLAK:\n- coverTitle (27 karakter): Yapay zekâ ve sağlık hukuku\n- coverDeck (141 karakter): ', m)
        self.assertLess(m.index('ÖNCEKİ TASLAK:'), m.index('ÖNCEKİ TASLAK REDDEDİLDİ'))
        self.assertTrue(m.endswith('önceki metni düzelterek yazabilirsin.'))

    def test_ilk_denemede_onceki_taslak_yok(self):
        self.assertEqual(uret.deneme_mesaji('Sektörel', 'SRC'), 'AKIŞ: Sektörel\n\nKAYNAK METNİ:\nSRC')

    def test_uzunluk_disi_kapi_ayni_bicimde_kalir(self):
        s = self.sorun(dict(E, coverDeck='Mucize bir yaklaşım sağlık hukukunda ele alınıyor, deniyor.'))
        self.assertEqual(len(s), 1)
        self.assertTrue(s[0].startswith('- yasak_sozcuk: mucize (geçtiği alan: coverDeck). Bu sözcük tırnak içindeki'), s[0])
        self.assertNotIn('doktor', s[0])

    def test_yasak_hekim_tirnakli_ad_alani_ve_doktor_onerisi(self):
        # 26.11 öğe 3: tırnaklı özgün etkinlik adı dört denemede de korunmuştu.
        s = self.sorun(dict(E, detailSummary='Tıp fakültesi, “Hekimlerin Hukuki Sorumluluğu” konulu bilimsel toplantı '
                                             'düzenliyor. Toplantıda doktorların hukuki sorumlulukları ele alınacak.'))
        self.assertEqual(len(s), 1)
        self.assertIn('(geçtiği alan: detailSummary)', s[0])
        self.assertIn('"hekim" yerine "doktor" yaz', s[0])


class SahteIstemci:
    """Taslak isteğine E döner; doğrulamada `kotu_oge` (1 tabanlı) için 'abartili' etiketi verir."""
    def __init__(self, kotu_oge=None):
        self.kotu, self.cagri, self.oge = kotu_oge, [], 0
        self.messages = types.SimpleNamespace(parse=self.parse)

    def parse(self, *, output_format, messages, **_):
        self.cagri.append(output_format.__name__)
        if output_format.__name__ == 'Taslak':
            self.oge = int(messages[0]['content'].split('KAYNAK METNİ:\n')[1].split('Başlık ')[1][0])
            out = output_format(**E)
        else:
            etiket = 'abartili' if self.oge == self.kotu else 'desteklenir'
            out = output_format(iddialar=[{'alan': 'detailSummary', 'iddia': 'x', 'etiket': etiket, 'gerekce': 'y'}])
        return types.SimpleNamespace(usage=types.SimpleNamespace(input_tokens=100, output_tokens=50),
                                     stop_reason='end_turn', parsed_output=out)


UZUN_OZET = 'Uzun özet ' * 31 + 'sona erdi.'   # 320 karakter → yalnız uzunluk kapısı kalır
KISA_OZET = E['detailSummary']


class KisaltanIstemci(SahteIstemci):
    """Öğe `uzun_oge`'nin taslağında özet sınırı aşar; kısaltma yanıtı kısa özet + DEĞİŞTİRİLMİŞ başlık döner (yok sayılmalı)."""
    def __init__(self, uzun_oge=2, kisaltma_basarisiz=False):
        super().__init__()
        self.uzun, self.basarisiz, self.kisaltma_mesajlari = uzun_oge, kisaltma_basarisiz, []

    def parse(self, *, output_format, messages, **kw):
        ad = output_format.__name__
        if ad == 'Kisaltma':
            self.cagri.append(ad)
            self.kisaltma_mesajlari.append(messages[0]['content'])
            if self.basarisiz:
                raise RuntimeError('ağ koptu')
            out = output_format(**dict(E, detailSummary=KISA_OZET, coverTitle='Değiştirilmiş başlık metni'))
            return types.SimpleNamespace(usage=types.SimpleNamespace(input_tokens=100, output_tokens=50),
                                         stop_reason='end_turn', parsed_output=out)
        r = super().parse(output_format=output_format, messages=messages, **kw)
        if ad == 'Taslak' and self.oge == self.uzun:
            r.parsed_output = output_format(**dict(E, detailSummary=UZUN_OZET))
        return r


class Uretici(unittest.TestCase):
    def setUp(self):
        self._t = tempfile.TemporaryDirectory()
        self.kok = Path(self._t.name)
        self.girdi, self.cikti = edisyon(self.kok), self.kok / 'cikti'
        self._collect = kaynak.collect
        kaynak.collect = lambda item, cache: {'edition': f"Başlık {item['title'][-1]}\n{item['summaryLong']}",
                                              'fetched': '', 'fetchedOk': False, 'error': None}

    def tearDown(self):
        kaynak.collect = self._collect
        self._t.cleanup()

    def test_yalniz_uzunluk_kalinca_kisaltma_adimi_ayni_denemede_kurtarir(self):
        ist = KisaltanIstemci(uzun_oge=2)
        qa = uret.calistir(self.girdi, self.cikti, ist, 'claude-haiku-5-5')
        self.assertEqual(qa['gun'], 'GECTI')
        og = qa['ogeler'][1]
        self.assertEqual(len(og['denemeler']), 1)                     # yeniden yazma denemesi harcanmadı
        d = og['denemeler'][0]
        self.assertEqual(d['kisaltma']['alanlar'], ['detailSummary'])
        self.assertEqual(d['kisaltma']['taslak']['detailSummary'], UZUN_OZET)   # iz: kısaltma ÖNCESİ
        self.assertFalse(all(k['gecti'] for k in d['kisaltma']['kapilar']))
        self.assertEqual(d['taslak']['detailSummary'], KISA_OZET)              # kayıt: kısaltma SONRASI
        self.assertEqual(d['taslak']['coverTitle'], E['coverTitle'])           # hedef dışı alan KODDA korundu
        self.assertTrue(all(k['gecti'] for k in d['kapilar']) and d['dogrulama'])
        self.assertEqual(qa['cagri'], 13)                                      # 12 + 1 kısaltma
        self.assertEqual(ist.kisaltma_mesajlari, [uret.kisaltma_mesaji(dict(E, detailSummary=UZUN_OZET), ['detailSummary'])])

    def test_kisaltma_cagrisi_duserse_eski_yol_surer(self):
        qa = uret.calistir(self.girdi, self.cikti, KisaltanIstemci(uzun_oge=2, kisaltma_basarisiz=True), 'claude-haiku-5-5')
        og = qa['ogeler'][1]
        self.assertEqual(og['sonuc'], 'KALDI')
        self.assertEqual(len(og['denemeler']), uret.DENEME_SAYISI)
        d = og['denemeler'][0]
        self.assertIn('ağ koptu', d['kisaltma']['hata'])
        self.assertEqual(d['taslak']['detailSummary'], UZUN_OZET)
        self.assertNotIn('dogrulama', d)

    def test_alti_oge_gecer_ve_cizici_semasi_dogru(self):
        qa = uret.calistir(self.girdi, self.cikti, SahteIstemci(), 'claude-haiku-5-5')
        self.assertEqual(qa['gun'], 'GECTI')
        ed = json.loads((self.cikti / 'editorial.json').read_text(encoding='utf-8'))
        self.assertEqual(ed['leadImage']['path'], 'gorseller/kapak.png')
        self.assertEqual([i['image'] for i in ed['items']], [f'gorseller/haber-{n}.png' for n in range(1, 7)])
        for i in ed['items']:   # render.py'nin zorunlu alanları
            for k in ('coverTitle', 'coverDeck', 'detailTitle', 'detailSummary', 'image', 'coverCategory', 'detailCategory'):
                self.assertTrue(i[k].strip(), k)
        self.assertEqual(qa['cagri'], 12)   # 6 taslak + 6 doğrulama

    def test_dogrulamadan_kalan_oge_gunu_dusurur_editoryal_yazilmaz(self):
        ist = SahteIstemci(kotu_oge=3)
        qa = uret.calistir(self.girdi, self.cikti, ist, 'claude-haiku-5-5')
        self.assertEqual(qa['gun'], 'KALDI')
        self.assertFalse((self.cikti / 'editorial.json').exists())
        self.assertEqual(len(qa['ogeler'][2]['denemeler']), uret.DENEME_SAYISI)
        self.assertTrue((self.cikti / 'QA-editoryal.json').exists())

    def test_bozuk_edisyon_model_cagrilmadan_reddedilir(self):
        p = self.girdi / 'edition.json'
        d = json.loads(p.read_text(encoding='utf-8'))
        d['rawBodySha256'] = '0' * 64
        p.write_text(json.dumps(d), encoding='utf-8')
        ist = SahteIstemci()
        with self.assertRaises(uret.Hata):
            uret.calistir(self.girdi, self.cikti, ist, 'claude-haiku-5-5')
        self.assertEqual(ist.cagri, [])


if __name__ == '__main__':
    unittest.main()
