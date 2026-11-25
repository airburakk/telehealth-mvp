"""kalite_kapisi.py — her bağın tek tek koparıldığı sentetik gün klasörleri. Ağ/model YOK.

Çalıştır: python -X utf8 -m unittest test_kalite_kapisi -v   (sources/karusel içinde)
"""
import copy
import hashlib
import json
import struct
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import kalite_kapisi as kk  # noqa: E402
import ictihat  # noqa: E402

DAY = '2026-11-14'
ALAN = ('coverTitle', 'coverDeck', 'detailTitle', 'detailSummary')


def sha(b):
    return hashlib.sha256(b).hexdigest()


def png(w, h, tohum):
    return b'\x89PNG\r\n\x1a\n' + b'\x00\x00\x00\x0dIHDR' + struct.pack('>II', w, h) + tohum.encode()


def kur(kok: Path, ic: dict | None = None):
    """Tutarlı (GEÇMESİ gereken) bir gün: edisyon → editoryal → görsel → çizim."""
    urls = [f'https://ornek.org/{i}' for i in range(1, 7)]
    ed_items = [{'id': f'oge-{i}', 'url': u, 'streamLabel': 'Akademik'} for i, u in enumerate(urls, 1)]
    if ic:   # 6. öğe içtihat (bağlantısız) — 24.11 Salı biçimi
        urls[5] = None
        ed_items[5] = ic
    body = json.dumps({'items': ed_items})
    edition = {'day': DAY, 'rawBodyUtf8': body, 'rawBodySha256': sha(body.encode())}
    gun, kart = kok / 'gun', kok / 'kartlar'
    (gun / 'gorseller').mkdir(parents=True)
    kart.mkdir()
    (kok / 'edition.json').write_text(json.dumps(edition), encoding='utf-8')
    taslaklar = [{a: f'{a} {i}' for a in ALAN} for i in range(1, 7)]
    if ic:
        taslaklar[5] = ictihat.ictihat_taslagi(ic)
    edit = {'day': DAY, 'edition': {'rawBodySha256': edition['rawBodySha256']},
            'items': [{'itemId': o['id'], 'sourceUrl': u, 'coverCategory': 'Akademik', **t}
                      for o, u, t in zip(ed_items, urls, taslaklar)]}
    eb = json.dumps(edit, ensure_ascii=False).encode()
    (gun / 'editorial.json').write_bytes(eb)
    deneme = lambda t: {'sonuc': 'GECTI', 'taslak': t, 'kapilar': [{'ad': 'uzunluk', 'gecti': True}],  # noqa: E731
                        'dogrulama': [{'etiket': 'desteklenir'}]}
    qa_a = {'day': DAY, 'gun': 'GECTI', 'editionRawSha256': edition['rawBodySha256'], 'tahminiUsd': 0.01,
            'ogeler': [{'sonuc': 'GECTI', 'taslak': t, 'denemeler': [deneme(t)]} for t in taslaklar]}
    if ic:   # şablon kaydı: model doğrulaması YOK, sablon işareti VAR
        qa_a['ogeler'][5]['denemeler'] = [{'sonuc': 'GECTI', 'taslak': taslaklar[5], 'kapilar': [{'ad': 'uzunluk', 'gecti': True}],
                                           'sablon': 'ictihat'}]
    (gun / 'QA-editoryal.json').write_text(json.dumps(qa_a), encoding='utf-8')
    gor = []
    for ad in kk.GORSEL_ADLARI:
        b = png(1344, 752, ad)
        (gun / 'gorseller' / f'{ad}.png').write_bytes(b)
        gor.append({'gorsel': ad, 'sonuc': 'GECTI', 'yedekGerekli': False, 'denemeler': [{'gecti': True, 'sha256': sha(b)}]})
    (gun / 'QA-gorsel.json').write_text(json.dumps({'gorseller': gor}), encoding='utf-8')
    files = []
    for ad in kk.KART_ADLARI:
        b = png(1080, 1350, ad)
        (kart / ad).write_bytes(b)
        files.append({'name': ad, 'sha256': sha(b)})
    cards = [{'card': n, 'imageSha256': sha(png(1344, 752, f'haber-{n - 1}'))} for n in range(2, 8)]
    qa_c = {'day': DAY, 'editionRawSha256': edition['rawBodySha256'], 'editorialSha256': sha(eb),
            'closing': kk.KAPANIS_TAMAM, 'cards': cards, 'files': files}
    (kart / 'QA.json').write_text(json.dumps(qa_c, ensure_ascii=False), encoding='utf-8')
    return gun, kart, kok / 'edition.json'


def jdegis(p: Path, f):
    d = json.loads(p.read_text(encoding='utf-8'))
    f(d)
    p.write_text(json.dumps(d, ensure_ascii=False), encoding='utf-8')


class Kapi(unittest.TestCase):
    def setUp(self):
        self._t = tempfile.TemporaryDirectory()
        self.gun, self.kart, self.ed = kur(Path(self._t.name))

    def tearDown(self):
        self._t.cleanup()

    def karar(self):
        return kk.degerlendir(self.gun, self.kart, self.ed)

    def kaldi(self, parca):
        r = self.karar()
        self.assertEqual(r['karar'], 'KALDI')
        self.assertIsNone(r['muhur'])
        self.assertTrue(any(parca in s for s in r['sorunlar']), r['sorunlar'])

    def test_tutarli_gun_gecer_ve_muhur_dogrulanir(self):
        r = self.karar()
        self.assertEqual(r['karar'], 'GECTI', r['sorunlar'])
        kartlar = [(self.kart / a).read_bytes() for a in kk.KART_ADLARI]
        eb = (self.gun / 'editorial.json').read_bytes()
        self.assertTrue(kk.muhur_dogrula(r, eb, kartlar))
        self.assertFalse(kk.muhur_dogrula(r, eb + b' ', kartlar))                     # metin sonradan değişti
        self.assertFalse(kk.muhur_dogrula(r, eb, kartlar[:7] + [kartlar[7] + b'x']))  # PNG sonradan değişti
        self.assertFalse(kk.muhur_dogrula({**r, 'karar': 'KALDI'}, eb, kartlar))

    def test_metin_kapidan_sonra_degismis(self):
        jdegis(self.gun / 'editorial.json', lambda d: d['items'][2].update(detailTitle='Mucize tedavi'))
        self.kaldi('öğe 3: metin kapıdan SONRA değişmiş')

    def test_ikinci_model_abartili(self):
        jdegis(self.gun / 'QA-editoryal.json', lambda d: d['ogeler'][0]['denemeler'][-1]['dogrulama'].append({'etiket': 'abartili'}))
        self.kaldi('öğe 1: ikinci model')

    def test_bes_ogeyle_yayin_yok(self):
        jdegis(self.gun / 'editorial.json', lambda d: d['items'].pop())
        self.kaldi('6/6 değil')

    def test_baska_edisyon(self):
        jdegis(self.gun / 'QA-editoryal.json', lambda d: d.update(editionRawSha256='0' * 64))
        self.kaldi('başka bir edisyona')

    def test_gorsel_dosyasi_degistirilmis(self):
        (self.gun / 'gorseller' / 'haber-4.png').write_bytes(png(1344, 752, 'baska'))
        self.kaldi('haber-4: dosya denetlenen görsel değil')

    def test_gorsel_denetimden_kalmis(self):
        jdegis(self.gun / 'QA-gorsel.json', lambda d: d['gorseller'][0].update(sonuc='KALDI'))
        self.kaldi('kapak: görsel denetimden geçmedi')

    def test_onaysiz_yedek_gecmez_onayli_yedek_gecer(self):
        b = (self.gun / 'gorseller' / 'kapak.png').read_bytes()
        yedek = {'gorsel': 'kapak', 'sonuc': 'KALDI', 'yedekGerekli': True, 'yedek': {'onayli': False, 'sha256': sha(b)}}
        jdegis(self.gun / 'QA-gorsel.json', lambda d: d['gorseller'].__setitem__(0, copy.deepcopy(yedek)))
        self.kaldi('kapak: görsel denetimden geçmedi')
        yedek['yedek']['onayli'] = True
        jdegis(self.gun / 'QA-gorsel.json', lambda d: d['gorseller'].__setitem__(0, yedek))
        r = self.karar()
        self.assertEqual((r['karar'], r['yedekGorseller']), ('GECTI', ['kapak']), r['sorunlar'])

    def test_cizim_baska_editoryalle(self):
        jdegis(self.kart / 'QA.json', lambda d: d.update(editorialSha256='f' * 64))
        self.kaldi('bu editorial.json ile yapılmamış')

    def test_kapanis_kilidi(self):
        jdegis(self.kart / 'QA.json', lambda d: d.update(closing='tutmadı'))
        self.kaldi('kapanış kilidi')

    def test_kart_dosyasi_eksik_ya_da_boyut_yanlis(self):
        (self.kart / '05.png').unlink()
        self.kaldi('05.png: yok')

    def test_kart_boyutu(self):
        b = png(1080, 1080, '03.png')
        (self.kart / '03.png').write_bytes(b)
        jdegis(self.kart / 'QA.json', lambda d: [f.update(sha256=sha(b)) for f in d['files'] if f['name'] == '03.png'])
        self.kaldi('03.png: (1080, 1080)')

    def test_testOnly_edisyon(self):
        jdegis(self.ed, lambda d: d.update(testOnly=True))
        self.kaldi('testOnly')


IC = {'id': 'ictihat-1', 'stream': 'ictihat', 'streamLabel': 'Arşivden İçtihat', 'url': None,
      'title': 'Yargıtay 3. Hukuk Dairesi · E. 2025/6274, K. 2026/3304', 'sourceName': 'Yargıtay — 3. Hukuk Dairesi',
      'summaryLong': 'Konu: Malpraktis, Yanlış tedavi/tanı, Tazminat.', 'summaryLongFallback': False}


class IctihatGunu(unittest.TestCase):
    """2026-11-25: bağlantısız içtihat öğesi şablonla geçer; şablon dışı metin ya da yanlış yerde şablon KALDI."""
    def setUp(self):
        self._t = tempfile.TemporaryDirectory()
        self.gun, self.kart, self.ed = kur(Path(self._t.name), IC)

    def tearDown(self):
        self._t.cleanup()

    def kaldi(self, parca):
        r = kk.degerlendir(self.gun, self.kart, self.ed)
        self.assertEqual(r['karar'], 'KALDI')
        self.assertTrue(any(parca in s for s in r['sorunlar']), r['sorunlar'])

    def test_tutarli_ictihat_gunu_gecer(self):
        r = kk.degerlendir(self.gun, self.kart, self.ed)
        self.assertEqual(r['karar'], 'GECTI', r['sorunlar'])
        self.assertTrue(r['muhur'])

    def test_sablon_disi_metin_kalir(self):
        def bozuk(d):
            d['ogeler'][5]['denemeler'][-1]['taslak'] = dict(d['ogeler'][5]['taslak'], coverDeck='Yargıtay doktoru haklı buldu.')
        jdegis(self.gun / 'QA-editoryal.json', bozuk)
        self.kaldi('içtihat metni şablonla uyuşmuyor')

    def test_sablon_isareti_icin_ictihat_olmayan_oge_kalir(self):
        jdegis(self.gun / 'QA-editoryal.json', lambda d: d['ogeler'][0]['denemeler'][-1].update(sablon='ictihat'))
        self.kaldi('şablon/bağlantı yalnız içtihatta')

    def test_yanlis_kimlik_kalir(self):
        jdegis(self.gun / 'editorial.json', lambda d: d['items'][2].update(itemId='baska'))
        self.kaldi('öğe 3: editoryal kimlik edisyonla uyuşmuyor')

    def test_kimliksiz_baglantisiz_oge_kalir(self):
        jdegis(self.gun / 'editorial.json', lambda d: d['items'][5].pop('itemId'))
        self.kaldi('öğe 6: bağlantısız öğe kimlikle eşleşmeli')

    def test_kimliksiz_eski_editoryal_baglantili_ogede_gecer(self):
        """Geriye uyum: itemId'siz (yeni sürüm öncesi) editoryal bağlantılı öğelerde URL ile eşleşir."""
        jdegis(self.gun / 'editorial.json', lambda d: [i.pop('itemId') for i in d['items'][:5]])
        r = kk.degerlendir(self.gun, self.kart, self.ed)
        self.assertNotIn('kimlik', ' '.join(r['sorunlar']))


if __name__ == '__main__':
    unittest.main()
