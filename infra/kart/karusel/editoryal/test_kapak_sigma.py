"""Kapak sığma kapısı (2026-11-26) — saf kurallar her yerde; gerçek çiziciyle karşılaştırma yalnız yazı tipli ortamda
(kart imajı — CI: kart-karusel.yml `unittest discover -s /app/karusel/editoryal`). Model/ağ YOK.

Çalıştır: python -X utf8 -m unittest test_kapak_sigma -v   (editoryal/ içinde)
"""
import hashlib
import json
import math
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import kapak_sigma as ks  # noqa: E402
import kapilar  # noqa: E402

ORNEKLER = json.loads((HERE / 'kapak_sigma_ornekler.json').read_text(encoding='utf-8'))['ornekler']
# 26.11 sahte Salı provasında kapağı düşüren gerçek metin (3. öğe · 119 karakter)
PROVA = 'TJOD Ankara Çankaya Şubesi, Serviks Kanseri Farkındalık Ayı kapsamında bilimsel toplantı düzenliyor. Doktorlar davetli.'


def cizici():
    try:
        sys.path.insert(0, str(HERE.parent / 'raster-post'))
        import newspaper_cover as nc
        nc.font(20, 'roman', False)
        nc.font(30, 'roman', True)
        return nc
    except (ImportError, OSError):
        return None


NC = cizici()


class Kurallar(unittest.TestCase):
    def test_prova_aciklamasi_3_konumda_duser_4_konumda_gecer(self):
        ok, d = ks.kapak_sigma({'coverTitle': 'Serviks kanseri farkındalık toplantısı', 'coverDeck': PROVA}, 3)
        self.assertFalse(ok)
        self.assertRegex(d, r'^coverDeck 3\. konumda kapaktaki kutuya sığmıyor \(14 kelime\); bu konumda en çok \d+ kelime → en az \d+ kelime çıkar$')
        self.assertTrue(ks.kapak_sigma({'coverTitle': 'Serviks kanseri farkındalık toplantısı', 'coverDeck': PROVA}, 4)[0])

    def test_onerilen_kelime_sayisi_gercekten_sigar(self):
        _, d = ks.kapak_sigma({'coverTitle': 'Kısa başlık', 'coverDeck': PROVA}, 3)
        k = int(d.split('en çok ')[1].split(' ')[0])
        self.assertTrue(ks._aciklama_tamam(' '.join(PROVA.split()[:k]), 3))
        self.assertFalse(ks._aciklama_tamam(' '.join(PROVA.split()[:k + 1]), 3))

    def test_baslik_satir_sayisi_konuma_gore(self):
        # 3 satır: 3. konumda açıklamanın üstüne biner, alt sırada (4–6) sığar; 4 satır alt sırada da biner.
        b3 = 'Serviks kanseri farkındalık ayı bilimsel toplantısı'
        b4 = b3 + ' Ankara'
        self.assertEqual((ks.yerlesim(b3, ks.KONUMLAR[2][0], True), ks.yerlesim(b4, ks.KONUMLAR[3][0], True)), ((30, 3), (30, 4)))
        self.assertFalse(ks._baslik_tamam(b3, 3))
        self.assertTrue(ks._baslik_tamam(b3, 4))
        self.assertFalse(ks._baslik_tamam(b4, 4))

    def test_sutundan_genis_tek_sozcuk_sigmaz(self):
        self.assertIsNone(ks.yerlesim('Mikrobiyolojikolarakdoğrulanmışkardiyovaskülerhastalık', ks.KONUMLAR[2][1], False))

    def test_kapi_yalniz_konum_verilince_kosar(self):
        e = {'coverTitle': 'Kısa başlık burada', 'coverDeck': PROVA, 'detailTitle': 'Ayrıntı başlığı burada yeterince uzun',
             'detailSummary': 'x ' * 60}
        item = {'streamLabel': 'Sektörel', 'url': 'https://x'}
        self.assertNotIn('kapak_sigma', [a for a, _, _ in kapilar.check(e, item, 'x')])
        self.assertEqual(('kapak_sigma', False), kapilar.check(e, item, 'x', 3)[-1][:2])
        self.assertEqual(('kapak_sigma', True, ''), kapilar.check(e, item, 'x', 4)[-1])

    def test_konumlar_cover_cagrilariyla_ayni(self):
        """newspaper_cover.cover() kaynak metnindeki box() çağrıları — orası değişirse tablo da değişmeli."""
        kaynak = (HERE.parent / 'raster-post' / 'newspaper_cover.py').read_text(encoding='utf-8')
        for (by, bw, bh, bs, bm), (ay, aw, ah, as_, am) in ks.KONUMLAR[:3]:
            self.assertIn(f'{by},{bw},{bh}),{bs},{bm},bold=True', kaynak)
            self.assertIn(f'{ay},{aw},{ah}),{as_},{am})', kaynak)
        self.assertIn('(x,939,296,190),30,28,bold=True', kaynak)
        self.assertIn('(x,1054,296,100),21,19)', kaynak)
        self.assertIn('cols=[54,392,730]', kaynak)


@unittest.skipUnless(NC, 'kapak yazı tipleri yok (yalnız kart imajında)')
class GercekCizici(unittest.TestCase):
    def test_tablo_bu_yazi_tiplerinden_uretildi(self):
        for tur in ('roman', 'bold'):
            p = NC.FONT / ('NimbusRoman-Bold.otf' if tur == 'bold' else 'NimbusRoman-Regular.otf')
            self.assertEqual(ks.OLCU['yaziTipiSha256'][tur], hashlib.sha256(p.read_bytes()).hexdigest(),
                             'yazı tipi değişti → kapak_olcu_uret.py yeniden koşulmalı (iki kopya)')

    def test_kapi_sigar_dedigi_metin_cizicide_sigar(self):
        """Yanlış kabul SIFIR; gereksiz ret derlemde en çok %2 (26.11 ölçümü: 0 / 1)."""
        from PIL import Image, ImageDraw
        d = ImageDraw.Draw(Image.new('RGB', (1080, 1350)))

        def gercek(text, kutu, bold):
            y, w, h, size, mn = kutu
            try:
                r = NC.box(d, text, (0, y, w, h), size, mn, bold=bold)
                return r['size'], len(r['lines'])
            except ValueError:
                return None
        gereksiz = toplam = 0
        for o in ORNEKLER:
            for k in range(1, 7):
                bk, ak = ks.KONUMLAR[k - 1]
                g = gercek(o['coverTitle'], bk, True)
                gb = g is not None and bk[0] + g[1] * math.ceil(g[0] * ks.SATIR_ARALIGI) <= ak[0] + ks.BINDIRME_PAYI
                gd = gercek(o['coverDeck'], ak, False) is not None
                sb, sd = ks._baslik_tamam(o['coverTitle'], k), ks._aciklama_tamam(o['coverDeck'], k)
                self.assertFalse(sb and not gb, (k, o['coverTitle']))
                self.assertFalse(sd and not gd, (k, o['coverDeck']))
                gereksiz += (gb and not sb) + (gd and not sd)
                toplam += 2
        self.assertLessEqual(gereksiz, toplam * 0.02)


if __name__ == '__main__':
    unittest.main()
