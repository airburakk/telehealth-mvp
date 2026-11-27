"""Doctorium Post Instagram karuseli — v3 çizici, kart konteyneri sürümü. YAYINLAMAZ.

Kaynak: Doctorium-Atolye/sources/render_carousel_v3.py (onaylı tasarım, 15.11). Yerleşim mantığı BİREBİR aynıdır;
farkları yalnız konteyner ihtiyaçlarıdır:
  - girdi/çıktı klasörü argümanla gelir (POST /karusel/uret bir iş klasörü hazırlar);
  - görseller yalnız `gorseller/` içinden ve sabit adlarla okunur (yol kaçışı yok);
  - kapanış kartı ana kopya piksel hash'i TUTMAK ZORUNDA (Linux + RAQM'de tutar; yerel Windows'taki "kod+arka plan
    hash'i yeter" gevşemesi burada YOK — tutmazsa iş düşer).
Paket dosyaları (raster-post/ · post-carousel-integration/) Atölye paketinden BAYT BAYT kopyadır; düzenlenmez.
Yazı tipleri sistem paketlerinden gelir (Dockerfile: fonts-urw-base35 · fonts-dejavu-core) — paketin varsayılan yolları.

Kullanım: python3 render.py <girdi_klasörü> <çıktı_klasörü>
  girdi: edition.json (sunucu edisyonu: day · rawBodyUtf8 · rawBodySha256) · editorial.json · gorseller/{kapak,haber-1..6}.png
  çıktı: 01.png … 08.png · contact.png · QA.json        (çıkış kodu 0 = tamam; 2 = girdi/yerleşim hatası; 3 = kapanış kilidi)
"""
from pathlib import Path
import hashlib
import json
import re
import sys

PKG = Path(__file__).resolve().parent
sys.path[:0] = [str(PKG / 'raster-post'), str(PKG / 'post-carousel-integration')]
sys.dont_write_bytecode = True

from PIL import Image, ImageOps, features  # noqa: E402
import newspaper_cover as nc  # noqa: E402
import details_renderer as dr  # noqa: E402

IMG_BOTTOM = 1040      # görselin alt sınırı (hariç) — onaylı kartlarda 1039. satır
IMG_GAP = 44           # özetin son satır adımından görsele boşluk (onaylı kartlarda ölçüldü)
MIN_IMG = 330          # görsel için asgari yükseklik
CAPTION = 'Temsili görsel · Yapay zekâ ile oluşturulmuştur'
IMAGE_NAME = re.compile(r'^gorseller/(kapak|haber-[1-6])\.png$')
ICTIHAT_STREAM = 'ictihat'
KUNYE_RE = re.compile(r'E\. \S+, K\. \S+')


class Hata(Exception):
    pass


class KilitHata(Exception):
    pass


def sha(b):
    return hashlib.sha256(b if isinstance(b, bytes) else b.encode('utf-8')).hexdigest()


def image_path(girdi: Path, rel: str) -> Path:
    if not isinstance(rel, str) or not IMAGE_NAME.match(rel):
        raise Hata(f'geçersiz görsel adı: {rel!r}')
    p = girdi / rel
    if not p.is_file():
        raise Hata(f'görsel yok: {rel}')
    return p


def eslestir(n: int, it: dict, e: dict) -> None:
    """Editoryal öğe ↔ edisyon öğesi. Editoryal `itemId` taşıyorsa kimlik birebir tutmalı; URL de her durumda tutmalı.
    Bağlantısız öğe (Yargıtay kararının kalıcı adresi yok) yalnız içtihat akışında ve yalnız kimlikle eşleşir — iki
    bağlantısız öğe `None == None` diye yer değiştirebilirdi; kimlik bu boşluğu kapatır (fail-closed)."""
    if 'itemId' in e and e['itemId'] != it.get('id'):
        raise Hata(f'öğe {n}: editoryal kimlik edisyonla uyuşmuyor')
    if it.get('url') != e.get('sourceUrl'):
        raise Hata(f'öğe {n}: editoryal sıra/URL edisyonla uyuşmuyor')
    if not it.get('url'):
        if it.get('stream') != ICTIHAT_STREAM:
            raise Hata(f'öğe {n}: bağlantısız öğe yalnız içtihat akışında olabilir')
        if not isinstance(it.get('id'), str) or not it['id'] or e.get('itemId') != it['id']:
            raise Hata(f'öğe {n}: bağlantısız öğe kimlikle eşleşmeli')


def kunye(it: dict) -> str:
    """Bağlantısız (içtihat) öğede adres satırının yerine: başlıktaki esas/karar künyesi + nereden bulunacağı.
    Yeni bilgi üretmez — künye edisyon başlığından alınır (hukuk-ingest: `Yargıtay <daire> · E. x, K. y`)."""
    m = KUNYE_RE.search(it['title'])
    return f"{m.group(0) if m else it['title'].strip()} · Yargıtay karar arama sistemi"


def kaynak_adi(image, ad: str) -> dict:
    """Kaynak adı satırı (2026-11-26). PubMed/Europe PMC dergi adı alt başlıkla gelebilir ("Dermatologic surgery : official
    publication for American Society for Dermatologic Surgery [et al.]" — 98 karakter, satıra sığmadı → kart düştü). Tam ad
    sığmazsa " : " ÖNCESİ (derginin kendi adı) yazılır: yeni metin üretilmez, ortadan kırpılmaz. Ayırıcı yoksa ya da kısa ad
    da sığmazsa çizici eskisi gibi düşer (fail-closed)."""
    kutu = (72, 1132, 936, 30)
    try:
        return dr._draw_text(image, ad, kutu, 22, 20, field='sourceName', fill=dr.MUTED)
    except ValueError:
        kisa = ad.split(' : ')[0].strip()
        if not kisa or kisa == ad.strip():
            raise
        return dr._draw_text(image, kisa, kutu, 22, 20, field='sourceName', fill=dr.MUTED)


def load(girdi: Path):
    ed = json.loads((girdi / 'edition.json').read_bytes())
    day = ed.get('day')
    if not isinstance(day, str) or not re.match(r'^\d{4}-\d{2}-\d{2}$', day):
        raise Hata('edisyon günü geçersiz')
    if sha(ed['rawBodyUtf8']) != ed['rawBodySha256'] or ed.get('testOnly'):
        raise Hata('edisyon doğrulanamadı')
    items = json.loads(ed['rawBodyUtf8'])['items']
    edit = json.loads((girdi / 'editorial.json').read_text(encoding='utf-8'))
    if edit.get('day') != day or edit['edition']['rawBodySha256'] != ed['rawBodySha256']:
        raise Hata('editoryal katman bu edisyona bağlı değil')
    if len(items) != 6 or len(edit['items']) != 6:
        raise Hata('tam altı öğe gerekli')
    for n, (it, e) in enumerate(zip(items, edit['items']), 1):
        eslestir(n, it, e)
        for k in ('coverTitle', 'coverDeck', 'detailTitle', 'detailSummary', 'image', 'coverCategory', 'detailCategory'):
            if not isinstance(e.get(k), str) or not e[k].strip():
                raise Hata(f'öğe {n}: eksik alan {k}')
        image_path(girdi, e['image'])
    image_path(girdi, edit['leadImage']['path'])
    return day, ed, items, edit


def detail(payload, girdi, index, it, e):
    image, stats = dr._base(payload, index + 2)
    cat = f'{index + 1:02} / ' + dr._upper(e['detailCategory'])
    stats.append(dr._draw_text(image, cat, (72, 184, 936, 42), 23, 20, field='category', fill='#27735C', bold=True))
    layout = None
    for ts in range(52, 39, -1):
        for ss in range(30, 25, -1):
            _, _, th = dr._measure(e['detailTitle'], 936, ts, bold=True, leading=1.18)
            _, _, sh = dr._measure(e['detailSummary'], 936, ss, leading=1.28)
            top = 245 + th + 35 + sh + IMG_GAP
            if IMG_BOTTOM - top >= MIN_IMG:
                layout = (ts, th, ss, sh, top)
                break
        if layout:
            break
    if not layout:
        raise Hata(f'kart {index + 2}: metin + görsel sığmıyor')
    ts, th, ss, sh, top = layout
    stats.append(dr._draw_text(image, e['detailTitle'], (72, 245, 936, th), ts, field='title', bold=True, leading=1.18))
    stats.append(dr._draw_text(image, e['detailSummary'], (72, 245 + th + 35, 936, sh), ss,
                               field='summary', fill='#193D34', leading=1.28))
    art = Image.open(image_path(girdi, e['image'])).convert('RGB')
    if art.width < 900:
        raise Hata('görsel çözünürlüğü düşük: ' + e['image'])
    art = ImageOps.fit(art, (936, IMG_BOTTOM - top), method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    image.paste(art, (72, top))
    stats.append(dr._draw_text(image, CAPTION, (72, 1046, 936, 24), 16, field='caption', fill=dr.MUTED))
    stats.append(dr._draw_text(image, 'KAYNAK', (72, 1082, 936, 44), 18, 17, field='sourceContext', fill=dr.MUTED, bold=True))
    stats.append(kaynak_adi(image, it['sourceName']))
    if it.get('url'):
        stats.append(dr._draw_text(image, it['url'], (72, 1178, 936, 70), 20, 18, field='sourceUrl', fill=dr.MUTED, url=True))
    else:
        stats.append(dr._draw_text(image, kunye(it), (72, 1178, 936, 70), 20, 18, field='sourceKunye', fill=dr.MUTED))
    return image, {'titleSize': ts, 'summarySize': ss, 'imageBox': [72, top, 936, IMG_BOTTOM - top]}


def render(girdi: Path, out: Path) -> dict:
    day, ed, items, edit = load(girdi)
    payload = {'day': day, 'draft': False, 'testOnly': False}
    cards, qa_cards = {}, []
    for i, (it, e) in enumerate(zip(items, edit['items'])):
        im, lay = detail(payload, girdi, i, it, e)
        cards[i + 2] = im
        qa_cards.append({'card': i + 2, 'itemId': it['id'], 'sourceUrl': it.get('url'), 'detailTitle': e['detailTitle'],
                         'image': e['image'], 'imageSha256': sha(image_path(girdi, e['image']).read_bytes()), **lay})
    cover, _ = nc.cover([e['coverTitle'] for e in edit['items']], issue_day=day,
                        lead_image_path=str(image_path(girdi, edit['leadImage']['path'])),
                        lead_image_caption=edit['leadImage']['caption'],
                        categories=[e['coverCategory'] for e in edit['items']], draft=False,
                        decks=[e['coverDeck'] for e in edit['items']])
    cards[1] = cover
    try:
        cards[8], _ = dr._closing_master()
    except ValueError as exc:
        raise KilitHata(f'kapanış kartı kilidi tutmadı: {exc}') from None

    out.mkdir(parents=True, exist_ok=True)
    files = []
    for n in range(1, 9):
        p = out / f'{n:02d}.png'
        cards[n].save(p)
        with Image.open(p) as a:
            a.load()
            if a.size != (1080, 1350):
                raise Hata(f'{p.name} boyutu {a.size}')
        files.append({'name': p.name, 'sha256': sha(p.read_bytes())})
    contact = Image.new('RGB', (1080, 675), '#BDCABD')
    for n in range(8):
        contact.paste(cards[n + 1].resize((270, 337), Image.Resampling.LANCZOS), ((n % 4) * 270, (n // 4) * 337))
    contact.save(out / 'contact.png')
    qa = {'safeToPublish': False, 'day': day, 'editionRawSha256': ed['rawBodySha256'],
          'editorialSha256': sha((girdi / 'editorial.json').read_bytes()),
          'closing': 'ana kopya piksel hash\'i birebir tuttu', 'raqm': features.check('raqm'),
          'cards': qa_cards, 'files': files,
          'notes': ['Yayın kararı bu çizicinin işi değildir (kalite kapısı ayrı adım).']}
    (out / 'QA.json').write_text(json.dumps(qa, ensure_ascii=False, indent=2), encoding='utf-8')
    return qa


def main():
    if len(sys.argv) != 3:
        raise SystemExit('kullanım: render.py <girdi> <çıktı>')
    try:
        qa = render(Path(sys.argv[1]), Path(sys.argv[2]))
    except (Hata, KeyError, json.JSONDecodeError) as exc:
        print(json.dumps({'hata': str(exc)}, ensure_ascii=False))
        sys.exit(2)
    except KilitHata as exc:
        print(json.dumps({'hata': str(exc)}, ensure_ascii=False))
        sys.exit(3)
    print(json.dumps({'tamam': True, 'day': qa['day'], 'files': qa['files']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
