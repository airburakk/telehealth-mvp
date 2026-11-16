"""Offline six-detail/green-closing-card renderer. No network, publishing, or copy editing.

The sourceEvidence gate checks the caller's recorded review and exact-content
bindings. It cannot authenticate a publisher, verify medical claims, or establish
that a supplied sourceContentSha256 actually came from the cited URL.

Required item fields: id, title, summaryLong, streamLabel, sourceName, sourceUrl,
sourceEvidence. Required sourceEvidence fields: verified:true,
summaryVerified:true, url, summarySha256, titleSha256, sourceNameSha256,
sourceContentSha256, checkedAt (offset ISO), forItemId, forDay, forDigestHash,
classification (current|archive), archiveLabelled (boolean), kind
(reviewed|synthetic_test), evidenceRef. Archive items also require sourceDate
(YYYY-MM-DD) and archiveContext. Test fixtures require testOnly:true,draft:true;
other manifests require testOnly:false,headlineOnly:false. summaryLong must contain
at least 60 normalized characters and 10 words, must not repeat the title, and
summaryLongFallback must be absent or explicitly false. These structural checks
do not verify semantic truth. Nothing is shortened.

Fonts: DOCTORIUM_DETAIL_FONT_DIR defaults to the existing DejaVu installation.
Outputs use card-02.png through card-08.png. The destination directory must not
already exist. All seven images are validated before the directory is committed.
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta
from functools import lru_cache
import hashlib
import importlib
import io
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import unicodedata
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from PIL import Image, ImageDraw, ImageFont

WIDTH, HEIGHT = 1080, 1350
PAPER = '#F7F5EF'
INK = '#123F35'
GREEN = '#00A675'
MUTED = '#60726B'
RULE = '#DFE6DC'
FONT_DIR = Path(os.environ.get('DOCTORIUM_DETAIL_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
FONT_FILES = ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSerif-Bold.ttf')
MONTHS = ('Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık')
TURKEY = ZoneInfo('Europe/Istanbul')
COVER_ROOT = Path(__file__).resolve().parent.parent / 'raster-post'
CLOSING_DESIGN_VERSION = 'green-light-native-v8'
CLOSING_MASTER_SHA256 = '8fd64078a4e21f5564e47e257bba029b47386705a1af5a0440e79ab904a41c59'
CLOSING_BACKGROUND_SHA256 = 'b71e197b5d64bb8889703ea1dd5350d40826f8acacffb8e2658e0eb96e0a1d13'
CLOSING_RENDERER_SHA256 = '57c4440f038c2afc459e15dddd88e757499999ab5b40a5a2d50f755e09751bd1'
CLOSING_BACKGROUND = COVER_ROOT / 'assets/back-cover-natural-light-background.png'
# The caller supplied this exact requested design and master for implementation.
# Pixel/source verification does not grant publication or verify news content.


def text_hash(text: str) -> str:
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _text(value, field, limit=2000, multiline=False):
    if not isinstance(value, str) or not value.strip() or len(value) > limit:
        raise ValueError(f'{field}: non-empty bounded string required')
    if any(unicodedata.category(c).startswith('C') and not (multiline and c == '\n') for c in value):
        raise ValueError(f'{field}: control or invisible formatting characters forbidden')
    if not multiline and any(c.isspace() and c != ' ' for c in value):
        raise ValueError(f'{field}: unexpected whitespace')
    return value


def _day(value, field):
    _text(value, field, 10)
    parsed = date.fromisoformat(value)
    if parsed.isoformat() != value:
        raise ValueError(f'{field}: YYYY-MM-DD required')
    return parsed


def _aware(value, field):
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError as exc:
            raise ValueError(f'{field}: offset ISO timestamp required') from exc
    if not isinstance(value, datetime) or value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f'{field}: timezone-aware timestamp required')
    return value


def _sha(value, field):
    if not isinstance(value, str) or re.fullmatch(r'[0-9a-f]{64}', value) is None:
        raise ValueError(f'{field}: lowercase SHA-256 required')
    return value


def _url(value, field):
    _text(value, field, 2000)
    if any(c.isspace() for c in value) or any(c in value for c in ('\\', '<', '>')):
        raise ValueError(f'{field}: malformed source URL')
    if re.search(r'%(?![0-9a-fA-F]{2})', value) or re.search(r'%(?:00|0a|0d)', value, re.I):
        raise ValueError(f'{field}: invalid URL escape')
    try:
        parsed = urlsplit(value)
        host = parsed.hostname
        port = parsed.port
    except ValueError as exc:
        raise ValueError(f'{field}: malformed source URL') from exc
    if parsed.scheme != 'https' or not host or parsed.username is not None or parsed.password is not None or port not in (None, 443):
        raise ValueError(f'{field}: HTTPS public source URL without credentials required')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError(f'{field}: a public source hostname is required, not an IP')
    if '.' not in host or host.endswith(('.local', '.localhost', '.internal')):
        raise ValueError(f'{field}: public source hostname required')
    ascii_host = host.encode('idna').decode('ascii')
    if any(not re.fullmatch(r'[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?', part) for part in ascii_host.split('.')):
        raise ValueError(f'{field}: invalid source hostname')
    return value


def _summary_shape(item, prefix):
    """Reject obvious non-summaries, without asserting factual or semantic truth."""
    if 'summaryLongFallback' in item and item['summaryLongFallback'] is not False:
        raise ValueError(f'{prefix}.summaryLongFallback: fallback summaries are forbidden; explicit false required')
    summary = ' '.join(unicodedata.normalize('NFKC', item['summaryLong']).split())
    words = re.findall(r"[^\W_]+(?:['’][^\W_]+)*", summary)
    if len(summary) < 60 or len(words) < 10:
        raise ValueError(f'{prefix}.summaryLong: at least 60 normalized characters and 10 words required')
    def signature(text):
        normalized = unicodedata.normalize('NFKC', text).casefold().replace('\u0307', '').replace('ı', 'i')
        return ''.join(re.findall(r'[^\W_]+', normalized))
    if signature(summary) == signature(item['title']):
        raise ValueError(f'{prefix}.summaryLong: title repetition is not a summary')


def validate_details(payload, *, expected_day, now, base_dir='.'):
    """Validate exact issue/content bindings; returns plain serializable metadata.

    base_dir is accepted for the shared adapter interface; no remote/local source
    is opened. Evidence provenance remains the upstream reviewer's responsibility.
    """
    del base_dir
    if not isinstance(payload, dict) or type(payload.get('schemaVersion')) is not int or payload['schemaVersion'] != 1:
        raise ValueError('Unsupported schemaVersion')
    day = _day(payload.get('day'), 'day')
    _day(expected_day, 'expected_day')
    now = _aware(now, 'now')
    if payload['day'] != expected_day or expected_day != now.astimezone(TURKEY).date().isoformat():
        raise ValueError('Issue day does not match expected Turkey-local date')
    digest = _sha(payload.get('digestHash'), 'digestHash')
    for field in ('draft', 'testOnly', 'headlineOnly'):
        if type(payload.get(field)) is not bool:
            raise ValueError(f'Explicit {field} boolean required')
    if 'summaryLongFallback' in payload and payload['summaryLongFallback'] is not False:
        raise ValueError('summaryLongFallback: fallback summaries are forbidden; explicit false required')
    if payload['headlineOnly']:
        raise ValueError('Headline-only input cannot render a full detail carousel')
    if payload['testOnly'] and not payload['draft']:
        raise ValueError('Synthetic test inputs must remain visibly draft')
    items = payload.get('items')
    if not isinstance(items, list) or len(items) != 6:
        raise ValueError('Exactly six complete stories required')
    ids = []
    checked = []
    for index, item in enumerate(items):
        prefix = f'items[{index}]'
        if not isinstance(item, dict):
            raise ValueError(f'{prefix}: object required')
        for field, limit in (('id', 300), ('title', 2000), ('summaryLong', 10000), ('streamLabel', 120), ('sourceName', 300)):
            _text(item.get(field), f'{prefix}.{field}', limit, multiline=field == 'summaryLong')
        _summary_shape(item, prefix)
        ids.append(item['id'])
        url = _url(item.get('sourceUrl'), f'{prefix}.sourceUrl')
        ev = item.get('sourceEvidence')
        if not isinstance(ev, dict):
            raise ValueError(f'{prefix}: sourceEvidence required even for drafts')
        for flag in ('verified', 'summaryVerified'):
            if ev.get(flag) is not True:
                raise ValueError(f'{prefix}.sourceEvidence.{flag}: explicit true required')
        if type(ev.get('archiveLabelled')) is not bool:
            raise ValueError(f'{prefix}: archiveLabelled must be an explicit boolean')
        if ev.get('classification') not in ('current', 'archive'):
            raise ValueError(f'{prefix}: source classification required')
        expected_kind = 'synthetic_test' if payload['testOnly'] else 'reviewed'
        if ev.get('kind') != expected_kind:
            raise ValueError(f'{prefix}: evidence kind does not match testOnly')
        for field, expected in (('url', url), ('forItemId', item['id']), ('forDay', payload['day']), ('forDigestHash', digest),
                                ('titleSha256', text_hash(item['title'])), ('summarySha256', text_hash(item['summaryLong'])),
                                ('sourceNameSha256', text_hash(item['sourceName']))):
            if ev.get(field) != expected:
                raise ValueError(f'{prefix}: sourceEvidence.{field} mismatch')
        _sha(ev.get('sourceContentSha256'), f'{prefix}.sourceEvidence.sourceContentSha256')
        _text(ev.get('evidenceRef'), f'{prefix}.sourceEvidence.evidenceRef', 2000)
        checked_at = _aware(ev.get('checkedAt'), f'{prefix}.sourceEvidence.checkedAt')
        if checked_at > now or now - checked_at > timedelta(hours=24):
            raise ValueError(f'{prefix}: source evidence must be from the last 24 hours and not in the future')
        if ev['classification'] == 'archive':
            if ev['archiveLabelled'] is not True:
                raise ValueError(f'{prefix}: archive source must be visibly labelled')
            source_day = _day(item.get('sourceDate'), f'{prefix}.sourceDate')
            if source_day > day:
                raise ValueError(f'{prefix}: archive sourceDate cannot be in the future')
            _text(item.get('archiveContext'), f'{prefix}.archiveContext', 180)
        elif ev['archiveLabelled']:
            raise ValueError(f'{prefix}: current source cannot be archiveLabelled')
        for legacy_flag in ('sourceVerified', 'summaryVerified'):
            if legacy_flag in item and item[legacy_flag] is not True:
                raise ValueError(f'{prefix}: contradictory {legacy_flag}')
        checked.append({'itemId': item['id'], 'classification': ev['classification'], 'checkedAt': checked_at.isoformat(),
                        'sourceUrl': url, 'sourceContentSha256': ev['sourceContentSha256'], 'kind': ev['kind']})
    if len(set(ids)) != 6:
        raise ValueError('Duplicate story IDs are forbidden')
    for filename in FONT_FILES:
        if not (FONT_DIR / filename).is_file():
            raise ValueError('Required detail font missing: ' + str(FONT_DIR / filename))
    return {'day': payload['day'], 'digestHash': digest, 'testOnly': payload['testOnly'],
            'sourceChecks': checked, 'checkedAgainst': now.isoformat(), 'sourceEvidenceIndependentlyVerified': False}


@lru_cache(maxsize=64)
def _font(size, bold=False, serif=False):
    name = 'DejaVuSerif-Bold.ttf' if serif else ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf')
    return ImageFont.truetype(str(FONT_DIR / name), size)


def _upper(text):
    return text.replace('i', 'İ').replace('ı', 'I').upper()


def _display_date(value):
    day = _day(value, 'display date')
    return f'{day.day} {MONTHS[day.month-1]} {day.year}'


def _wrap(text, font, width, *, url=False):
    draw = ImageDraw.Draw(Image.new('L', (1, 1)))
    rows = []
    if url:
        current = ''
        for char in text:
            proposed = current + char
            if draw.textlength(proposed, font=font) > width:
                if not current:
                    raise ValueError('URL character exceeds safe width')
                rows.append(current)
                current = char
            else:
                current = proposed
        rows.append(current)
    else:
        for paragraph in text.split('\n'):
            current = ''
            for word in paragraph.split():
                if draw.textlength(word, font=font) > width:
                    raise ValueError('Unbreakable word exceeds safe text width')
                proposed = (current + ' ' + word).strip()
                if draw.textlength(proposed, font=font) > width:
                    rows.append(current)
                    current = word
                else:
                    current = proposed
            rows.append(current)
    if ''.join(''.join(rows).split()) != ''.join(text.split()):
        raise ValueError('Internal error: text content was lost during wrapping')
    return rows


def _measure(text, width, size, *, bold=False, serif=False, leading=1.25, url=False):
    f = _font(size, bold, serif)
    rows = _wrap(text, f, width - 4, url=url)
    step = math.ceil(size * leading)
    return rows, step, len(rows) * step


def _draw_text(image, text, box, size, minsize=None, *, field, fill=INK, bold=False, serif=False, leading=1.25, url=False):
    """Render into a full-size mask, reject actual raster ink outside the box."""
    x, y, width, height = box
    for chosen in range(size, (minsize if minsize is not None else size) - 1, -1):
        try:
            rows, step, required = _measure(text, width, chosen, bold=bold, serif=serif, leading=leading, url=url)
        except ValueError:
            continue
        if required > height:
            continue
        mask = Image.new('L', image.size, 0)
        d = ImageDraw.Draw(mask)
        f = _font(chosen, bold, serif)
        bounds = []
        for index, row in enumerate(rows):
            if row:
                pos = (x + 2, y + index * step)
                d.text(pos, row, font=f, fill=255, anchor='lt')
                bounds.append(d.textbbox(pos, row, font=f, anchor='lt'))
        actual = mask.getbbox()
        if actual and not (x <= actual[0] < actual[2] <= x + width and y <= actual[1] < actual[3] <= y + height):
            continue
        if any(not (x <= a <= c <= x + width and y <= b <= e <= y + height) for a, b, c, e in bounds):
            continue
        image.paste(fill, (0, 0), mask)
        return {'field': field, 'text': text, 'textSha256': text_hash(text), 'size': chosen, 'box': list(box),
                'lines': rows, 'height': required, 'inkBounds': [list(b) for b in bounds],
                'pixelBounds': list(actual) if actual else None, 'textWasTruncated': False}
    raise ValueError(f'{field}: full text does not fit the approved safe area; editorial intervention required')


def _base(payload, page_number):
    image = Image.new('RGB', (WIDTH, HEIGHT), PAPER)
    stats = []
    x = 72
    for label, color, serif in (('Doctor', INK, False), ('ium', GREEN, False), ('Post', INK, True)):
        if serif:
            x += 11
        width = math.ceil(_font(34, True, serif).getlength(label)) + 5
        stats.append(_draw_text(image, label, (x, 66, width, 44), 34, field='masthead', fill=color, bold=True, serif=serif))
        x += width - 4
    if payload['testOnly']:
        tag = 'SENTETİK TEST · YAYIMLANMAZ'
    elif payload['draft']:
        tag = 'TASLAK · YAYIMLANMADI'
    else:
        tag = 'DOCTORIUM POST'
    stats.append(_draw_text(image, tag, (664, 76, 344, 32), 17, 15, field='draftLabel', fill=MUTED))
    draw = ImageDraw.Draw(image)
    draw.line((72, 139, 1008, 139), fill=RULE)
    draw.line((72, 1260, 1008, 1260), fill=RULE)
    footer = _upper(_display_date(payload['day']))
    if payload['testOnly']:
        footer += ' · SENTETİK TEST · YAYIMLANMAZ'
    elif payload['draft']:
        footer += ' · YAYIMLANMAYAN TASLAK'
    stats.append(_draw_text(image, footer, (72, 1290, 830, 28), 18, 16, field='footer', fill=MUTED))
    stats.append(_draw_text(image, f'{page_number:02} / 08', (916, 1290, 92, 28), 18, 16, field='pageNumber', fill=MUTED))
    return image, stats


def _archive_label(item):
    if item['sourceEvidence']['classification'] == 'archive':
        return 'ARŞİV · ' + _display_date(item['sourceDate']) + ' · ' + item['archiveContext']
    return 'KAYNAK'


def _render_detail(payload, item, index):
    image, stats = _base(payload, index + 2)
    category = f'{index+1:02} / ' + _upper(item['streamLabel'])
    if item['sourceEvidence']['classification'] == 'archive' and 'ARŞİV' not in category:
        category += ' · ARŞİVDEN'
    stats.append(_draw_text(image, category, (72, 184, 936, 42), 23, 20, field='category', fill='#27735C', bold=True))
    # Give the complete title and complete long summary one shared finite budget.
    # The readable floors are 40px title and 26px body; never shrink indefinitely.
    layout = None
    for title_size in range(52, 39, -1):
        for summary_size in range(30, 25, -1):
            try:
                _, _, title_height = _measure(item['title'], 936, title_size, bold=True, leading=1.18)
                _, _, summary_height = _measure(item['summaryLong'], 936, summary_size, leading=1.28)
            except ValueError:
                continue
            if title_height + 35 + summary_height <= 797:
                layout = (title_size, title_height, summary_size, summary_height)
                break
        if layout:
            break
    if layout is None:
        raise ValueError(f'items[{index}]: complete title and summary overflow detail card; no text was omitted')
    title_size, title_height, summary_size, summary_height = layout
    stats.append(_draw_text(image, item['title'], (72, 245, 936, title_height), title_size, field='title', bold=True, leading=1.18))
    summary_y = 245 + title_height + 35
    stats.append(_draw_text(image, item['summaryLong'], (72, summary_y, 936, summary_height), summary_size,
                            field='summaryLong', fill='#193D34', leading=1.28))
    stats.append(_draw_text(image, _archive_label(item), (72, 1082, 936, 44), 18, 17, field='sourceContext', fill=MUTED, bold=True))
    stats.append(_draw_text(image, item['sourceName'], (72, 1132, 936, 30), 22, 20, field='sourceName', fill=MUTED))
    stats.append(_draw_text(image, item['sourceUrl'], (72, 1178, 936, 70), 20, 18, field='sourceUrl', fill=MUTED, url=True))
    return image, stats


def _closing_master():
    """Import the supplied native renderer; never execute its preview entrypoint."""
    source = COVER_ROOT / 'back_cover_green.py'
    if hashlib.sha256(source.read_bytes()).hexdigest() != CLOSING_RENDERER_SHA256:
        raise ValueError('Closing renderer source differs from the supplied design')
    if hashlib.sha256(CLOSING_BACKGROUND.read_bytes()).hexdigest() != CLOSING_BACKGROUND_SHA256:
        raise ValueError('Closing background differs from the supplied design')
    if str(COVER_ROOT) not in sys.path:
        sys.path.insert(0, str(COVER_ROOT))
    module = importlib.import_module('back_cover_green')
    if Path(module.__file__).resolve() != source.resolve():
        raise ValueError('Unexpected closing renderer import location')
    image, native_qa = module.make(background_image_path=CLOSING_BACKGROUND)
    if image.size != (WIDTH, HEIGHT) or image.mode != 'RGB':
        raise ValueError('Closing design must be 1080x1350 RGB')
    buffer = io.BytesIO()
    image.save(buffer, format='PNG')
    if hashlib.sha256(buffer.getvalue()).hexdigest() != CLOSING_MASTER_SHA256:
        raise ValueError('Closing pixels differ from supplied master; verify fonts and Pillow')
    if native_qa.get('sourceList') is not False or native_qa.get('backgroundLightOnly') is not True:
        raise ValueError('Closing design requires light background and no source list')
    return image, native_qa


def _render_closing(payload):
    image, native_qa = _closing_master()
    stats = []
    for index, check in enumerate(native_qa['textBounds']):
        left, top, right, bottom = check['bounds']
        if not (54 <= left < right <= 1026 and 0 <= top < bottom <= HEIGHT-54):
            raise ValueError('Closing text exceeds native safe boundaries')
        text = check['text']
        stats.append({'field': f'closingText[{index}]', 'text': text, 'textSha256': text_hash(text),
                      'size': check['fontSize'], 'box': [math.floor(left), math.floor(top),
                          math.ceil(right)-math.floor(left), math.ceil(bottom)-math.floor(top)],
                      'lines': [text], 'height': math.ceil(bottom-top), 'inkBounds': [list(check['bounds'])],
                      'pixelBounds': None, 'textWasTruncated': False})
    overlay_boxes = []
    if payload['draft']:
        label = 'SENTETİK TEST · YAYIMLANMAZ' if payload['testOnly'] else 'TASLAK · YAYIMLANMADI'
        stats.append(_draw_text(image, label, (72, 54, 936, 28), 18, field='draftLabel', fill='#B8CFC2'))
        footer = _upper(_display_date(payload['day'])) + ' · YAYIMLANMAYAN TASLAK · 08 / 08'
        stats.append(_draw_text(image, footer, (72, 1304, 936, 26), 16, field='footer', fill='#B8CFC2'))
        overlay_boxes = [[72,54,936,28], [72,1304,936,26]]
    qa = {'designVersion': CLOSING_DESIGN_VERSION, 'requestedDesignVerified': True,
          'masterSha256': CLOSING_MASTER_SHA256, 'backgroundSha256': CLOSING_BACKGROUND_SHA256,
          'rendererSha256': CLOSING_RENDERER_SHA256, 'masterPixelExactBeforeDraftLabel': True,
          'sourceList': False, 'backgroundLightOnly': True, 'forDay': payload['day'],
          'forDigestHash': payload['digestHash'], 'draft': payload['draft'], 'safeToPublish': False,
          'originalText': [check['text'] for check in native_qa['textBounds']],
          'draftOverlayBoxes': overlay_boxes}
    return image, stats, qa


def render_details(payload, output_dir, *, expected_day, now, base_dir='.'):
    """Commit a new directory containing seven 1080x1350 PNGs and return QA.

    Every output is rendered and checked before any output directory is made
    visible. Existing destinations are refused, preserving any earlier output.
    There is no publisher lock or production readiness assertion here.
    """
    validated = validate_details(payload, expected_day=expected_day, now=now, base_dir=base_dir)
    output = Path(output_dir).resolve()
    if output.exists():
        raise ValueError('Output directory already exists; use a new issue-specific staging directory')
    rendered = []
    for index, item in enumerate(payload['items']):
        image, stats = _render_detail(payload, item, index)
        rendered.append((f'card-{index+2:02}.png', image, stats, item['id']))
    image, stats, closing_qa = _render_closing(payload)
    rendered.append(('card-08.png', image, stats, None))
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = Path(tempfile.mkdtemp(prefix='.' + output.name + '.', dir=output.parent))
    cards = []
    try:
        for name, image, stats, item_id in rendered:
            path = temporary / name
            image.save(path, format='PNG')
            with Image.open(path) as check:
                if check.size != (WIDTH, HEIGHT) or check.mode != 'RGB':
                    raise ValueError('PNG dimensions or color mode changed')
                check.verify()
            cards.append({'output': str(output / name), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                          'itemId': item_id, 'kind': 'detail' if item_id else 'closing', 'textChecks': stats})
        if output.exists():
            raise ValueError('Output destination appeared during rendering; commit refused')
        os.rename(temporary, output)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return {'schemaVersion': 1, 'status': 'details_and_closing_rendered', **validated,
            'draft': payload['draft'], 'dimensions': [WIDTH, HEIGHT], 'cards': cards,
            'files': [{'path': card['output'], 'role': card['kind'], 'order': index+2,
                       'itemId': card['itemId'], 'sha256': card['sha256']} for index, card in enumerate(cards)],
            'detailCount': 6, 'sourceCardCount': 0, 'closingCardCount': 1, 'closingQA': closing_qa,
            'requestedDesignVerified': True, 'textWasTruncated': False,
            'safeToPublish': False, 'completeCarouselReady': False,
            'sourceEvidenceGatePassed': True, 'htmlOrBrowserUsed': False, 'networkUsed': False,
            'remainingGates': ['Upstream factual source/summary review', 'Approved cover for identical issue',
                               'Independent visual QA of this exact carousel', 'Authorized publisher integration']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest', type=Path)
    parser.add_argument('--output-dir', type=Path, required=True)
    parser.add_argument('--qa', type=Path, required=True)
    parser.add_argument('--expected-day', required=True)
    parser.add_argument('--now', required=True, help='Timezone-aware caller timestamp, not an implicit machine clock')
    args = parser.parse_args()
    try:
        payload = json.loads(args.manifest.read_text(encoding='utf-8'))
        report = render_details(payload, args.output_dir, expected_day=args.expected_day, now=args.now, base_dir=args.manifest.parent)
        args.qa.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    except (ValueError, TypeError, KeyError, OSError) as exc:
        raise SystemExit('DETAIL RENDER BLOCKED: ' + str(exc))
    print(json.dumps({'status': report['status'], 'outputDirectory': str(args.output_dir), 'safeToPublish': False}))


if __name__ == '__main__':
    main()
