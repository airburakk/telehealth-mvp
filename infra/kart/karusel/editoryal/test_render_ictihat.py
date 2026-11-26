"""render.py — bağlantısız (içtihat) öğe: kimlikle eşleşme + adres satırı yerine künye (2026-11-25, plan adım 2).

Saf kurallar (eslestir · kunye · load) her yerde koşar; gerçek çizim yalnız yazı tipleri kurulu ortamda (kart imajı —
CI: kart-karusel.yml `unittest discover -s /app/karusel/editoryal`). Ağ/model YOK.
Çalıştır: python -X utf8 -m unittest test_render_ictihat -v   (editoryal/ içinde)
"""
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import render  # noqa: E402
from PIL import Image  # noqa: E402

DAY = '2026-11-24'
IC = {'id': 'ictihat-1', 'stream': 'ictihat', 'streamLabel': 'Arşivden İçtihat', 'url': None,
      'title': 'Yargıtay 3. Hukuk Dairesi · E. 2025/6274, K. 2026/3304', 'sourceName': 'Yargıtay — 3. Hukuk Dairesi'}


def yazi_tipi_var() -> bool:
    try:
        render.dr._font(20, False, False)
        return True
    except OSError:
        return False


def kur(kok: Path, editoryal_degis=None):
    items = [{'id': f'oge-{i}', 'stream': 'sektorel', 'url': f'https://ornek.org/{i}', 'title': f'Başlık {i}',
              'sourceName': 'Örnek'} for i in range(1, 7)]
    items[5] = dict(IC)
    body = json.dumps({'items': items}, ensure_ascii=False)
    ed = {'day': DAY, 'rawBodyUtf8': body, 'rawBodySha256': hashlib.sha256(body.encode('utf-8')).hexdigest()}
    (kok / 'edition.json').write_text(json.dumps(ed, ensure_ascii=False), encoding='utf-8')
    (kok / 'gorseller').mkdir()
    for ad in ['kapak'] + [f'haber-{i}' for i in range(1, 7)]:
        Image.new('RGB', (1344, 752), '#88aa99').save(kok / 'gorseller' / f'{ad}.png')
    e_items = [{'itemId': it['id'], 'sourceUrl': it['url'], 'coverCategory': 'Sektörel', 'detailCategory': 'Sektörel',
                'coverTitle': 'Kapak', 'coverDeck': 'Kısa açıklama', 'detailTitle': 'Ayrıntı başlığı',
                'detailSummary': 'Ayrıntı özeti.', 'image': f'gorseller/haber-{n}.png'} for n, it in enumerate(items, 1)]
    edit = {'day': DAY, 'edition': {'rawBodySha256': ed['rawBodySha256']}, 'items': e_items,
            'leadImage': {'path': 'gorseller/kapak.png', 'caption': 'x'}}
    if editoryal_degis:
        editoryal_degis(edit)
    (kok / 'editorial.json').write_text(json.dumps(edit, ensure_ascii=False), encoding='utf-8')
    return kok


class Eslestirme(unittest.TestCase):
    def setUp(self):
        self._t = tempfile.TemporaryDirectory()
        self.kok = Path(self._t.name)

    def tearDown(self):
        self._t.cleanup()

    def hata(self, degis, parca):
        kur(self.kok, degis)
        with self.assertRaises(render.Hata) as c:
            render.load(self.kok)
        self.assertIn(parca, str(c.exception))

    def test_tutarli_ictihat_gunu_yuklenir(self):
        _, _, items, edit = render.load(kur(self.kok))
        self.assertIsNone(items[5]['url'])
        self.assertEqual(edit['items'][5]['itemId'], 'ictihat-1')

    def test_kimliksiz_baglantisiz_oge_duser(self):
        self.hata(lambda d: d['items'][5].pop('itemId'), 'öğe 6: bağlantısız öğe kimlikle eşleşmeli')

    def test_iki_baglantisiz_oge_yer_degistiremez(self):
        def degis(d):
            d['items'][5]['itemId'] = 'baska'
        self.hata(degis, 'öğe 6: editoryal kimlik edisyonla uyuşmuyor')

    def test_yanlis_kimlik_baglantili_ogede_de_duser(self):
        self.hata(lambda d: d['items'][0].update(itemId='oge-2'), 'öğe 1: editoryal kimlik edisyonla uyuşmuyor')

    def test_url_uyusmazligi_duser(self):
        self.hata(lambda d: d['items'][1].update(sourceUrl='https://ornek.org/x'), 'öğe 2: editoryal sıra/URL')

    def test_kimliksiz_eski_editoryal_baglantili_ogede_kabul(self):
        """Geriye uyum (14.11 kabul fikstürü itemId taşımaz): bağlantılı öğe URL ile eşleşir."""
        def degis(d):
            for i in d['items'][:5]:
                i.pop('itemId')
        kur(self.kok, degis)
        render.load(self.kok)

    def test_icthat_disi_baglantisiz_oge_duser(self):
        def degis_ed():
            ed = json.loads((self.kok / 'edition.json').read_text(encoding='utf-8'))
            body = json.loads(ed['rawBodyUtf8'])
            body['items'][5]['stream'] = 'sektorel'
            ed['rawBodyUtf8'] = json.dumps(body, ensure_ascii=False)
            ed['rawBodySha256'] = hashlib.sha256(ed['rawBodyUtf8'].encode('utf-8')).hexdigest()
            (self.kok / 'edition.json').write_text(json.dumps(ed, ensure_ascii=False), encoding='utf-8')
            edit = json.loads((self.kok / 'editorial.json').read_text(encoding='utf-8'))
            edit['edition']['rawBodySha256'] = ed['rawBodySha256']
            (self.kok / 'editorial.json').write_text(json.dumps(edit, ensure_ascii=False), encoding='utf-8')
        kur(self.kok)
        degis_ed()
        with self.assertRaises(render.Hata) as c:
            render.load(self.kok)
        self.assertIn('bağlantısız öğe yalnız içtihat akışında', str(c.exception))


class Kunye(unittest.TestCase):
    def test_baslikten_esas_karar(self):
        self.assertEqual(render.kunye(IC), 'E. 2025/6274, K. 2026/3304 · Yargıtay karar arama sistemi')

    def test_kunye_yoksa_baslik_aynen(self):
        self.assertEqual(render.kunye({'title': ' Yargıtay HGK kararı '}), 'Yargıtay HGK kararı · Yargıtay karar arama sistemi')


@unittest.skipUnless(yazi_tipi_var(), 'yazı tipleri yok (yalnız kart imajında çizilir)')
class Cizim(unittest.TestCase):
    def test_ictihat_karti_kunyeyle_cizilir(self):
        with tempfile.TemporaryDirectory() as t:
            kok = kur(Path(t))
            day, _, items, edit = render.load(kok)
            image, lay = render.detail({'day': day, 'draft': False, 'testOnly': False}, kok, 5, items[5], edit['items'][5])
            self.assertEqual(image.size, (1080, 1350))
            self.assertGreaterEqual(lay['imageBox'][3], render.MIN_IMG)
            # adres satırı bölgesi boş değil (künye çizildi)
            bolge = image.crop((72, 1178, 1008, 1248)).convert('L')
            self.assertLess(min(bolge.getdata()), 200)

    def test_alt_baslikli_uzun_dergi_adi_kisa_adla_yazilir(self):
        """26.11 provası: 98 karakterlik PubMed dergi adı kaynak satırına sığmıyordu → kart düşüyordu."""
        im = Image.new('RGB', (1080, 1350), 'white')
        s = render.kaynak_adi(im, 'Dermatologic surgery : official publication for American Society for Dermatologic Surgery [et al.]')
        self.assertEqual(s['text'], 'Dermatologic surgery')
        self.assertEqual(render.kaynak_adi(im, 'Europe PMC')['text'], 'Europe PMC')

    def test_ayiricisiz_sigmayan_ad_yine_duser(self):
        with self.assertRaises(ValueError):
            render.kaynak_adi(Image.new('RGB', (1080, 1350), 'white'), 'Çok uzun kurum adı ' * 6)

    def test_en_uzun_kunye_sigar(self):
        uzun = {'title': 'Yargıtay 12. Ceza Dairesi · E. 2024/123456, K. 2025/654321'}
        im = Image.new('RGB', (1080, 1350), 'white')
        s = render.dr._draw_text(im, render.kunye(uzun), (72, 1178, 936, 70), 20, 18, field='sourceKunye', fill=render.dr.MUTED)
        self.assertFalse(s['textWasTruncated'])


if __name__ == '__main__':
    unittest.main()
