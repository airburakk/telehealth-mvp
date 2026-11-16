"""Print-inspired Doctorium Post front page; no network or publication actions."""
from PIL import Image, ImageDraw, ImageFont, ImageOps
from pathlib import Path
import math
import hashlib
from datetime import date
import os

W,H=1080,1350
PAPER='#F5F1E6'; INK='#18251F'; GREEN='#00A675'; DEEP='#031610'; WHITE='#F6F5EC'; MUTED='#5B685F'; BODY_GREEN='#137452'
FONT=Path(os.environ.get('DOCTORIUM_FONT_DIR','/usr/share/fonts/opentype/urw-base35'))
ORIGINAL_LEAD='Normotermik makine perfüzyonunda düzensiz koagülasyon ex vivo gen-düzenlenmiş domuz karaciğerinde: moleküler mekanizmalar, genetik mühendislik stratejileri ve klinik uygulamaya yönelik çıkarımlar'

def font(size,kind='roman',bold=False):
    if kind=='brand':
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',size)
    if kind=='sans': name='NimbusSans-Bold.otf' if bold else 'NimbusSans-Regular.otf'
    elif kind=='italic': name='NimbusRoman-Italic.otf'
    elif kind=='post': name='P052-BoldItalic.otf'
    else:name='NimbusRoman-Bold.otf' if bold else 'NimbusRoman-Regular.otf'
    return ImageFont.truetype(str(FONT/name),size)

def label(d,text,x,y,size=16,fill=INK,bold=False,kind='sans'):
    d.text((x,y),text,font=font(size,kind,bold),fill=fill,anchor='lt')

def fit_label(d,text,x,y,width,size=16,fill=INK,bold=False,kind='sans',minsize=None):
    """No truncation: a label either fits, shrinks within its budget, or fails."""
    for current in range(size,(minsize or size)-1,-1):
        if d.textlength(text,font=font(current,kind,bold))<=width:
            label(d,text,x,y,current,fill,bold,kind)
            return
    raise ValueError('Label exceeds its safe width: '+text)

MONTHS=('Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık')
def tr_upper(text):
    return text.replace('i','İ').replace('ı','I').upper()

def display_day(value):
    parsed=date.fromisoformat(value)
    if parsed.isoformat()!=value:raise ValueError('Issue date must be YYYY-MM-DD')
    return f'{parsed.day} {MONTHS[parsed.month-1]} {parsed.year}'

def wrap(d,text,f,width):
    out=[];current=''
    for word in text.split():
        if d.textlength(word,font=f)>width:raise ValueError('Unbreakable word exceeds print column')
        test=(current+' '+word).strip()
        if d.textlength(test,font=f)>width:out.append(current);current=word
        else:current=test
    if current:out.append(current)
    return out

def box(d,text,xywh,size,minsize,bold=False,kind='roman',fill=INK,leading=1.12):
    x,y,w,h=xywh
    for sz in range(size,minsize-1,-1):
        f=font(sz,kind,bold);ls=wrap(d,text,f,w);step=math.ceil(sz*leading)
        if len(ls)*step<=h:
            bounds=[]
            for i,line in enumerate(ls):
                yy=y+i*step;d.text((x,yy),line,font=f,fill=fill,anchor='lt')
                bounds.append(d.textbbox((x,yy),line,font=f,anchor='lt'))
            return {'text':text,'size':sz,'lines':ls,'textSha256':hashlib.sha256(text.encode('utf-8')).hexdigest(),'textWasTruncated':False,'height':len(ls)*step,'box':xywh,'inkBounds':bounds}
    raise ValueError('Text does not fit; editorial revision required')

def article_post(im,d,x,baseline):
    # Italic P + actual Doctorium globe as o + italic st; never redraw the brand symbol.
    f=font(74,'post')
    d.text((x,baseline),'P',font=f,fill=WHITE,anchor='ls')
    px=x+d.textlength('P',font=f)-1
    globe=Image.open(Path(__file__).parent/'references/doctorium-article-globe.png').convert('RGBA')
    globe=globe.resize((38,39),Image.Resampling.LANCZOS)
    im.paste(globe,(round(px),baseline-37),globe)
    d.text((px+37,baseline),'st',font=f,fill=WHITE,anchor='ls')
    return [round(px),baseline-37,38,39]

def cover(titles, *, issue_day, lead_image_path, lead_image_caption, categories, draft=True, image_focus=(0.5,0.53), decks=None):
    if len(titles)!=6:raise ValueError('Newspaper proof requires the same six verified display titles')
    if len(categories)!=6 or any(not isinstance(c,str) or not c.strip() for c in categories):
        raise ValueError('Six non-empty categories are required')
    if len(image_focus)!=2 or any(not 0<=v<=1 for v in image_focus):raise ValueError('Invalid image crop focus')
    issue_label=display_day(issue_day)
    if not isinstance(lead_image_caption,str) or not lead_image_caption.strip():raise ValueError('Lead image caption required')
    im=Image.new('RGB',(W,H),PAPER);d=ImageDraw.Draw(im);stats=[]
    decks=decks or ['']*6
    for y in list(range(190))+list(range(1234,H)):
        t=y/(H-1);d.line((0,y,W,y),fill=(3,round(22+4*t),round(16+2*t)))
    label(d,'DOKTORLAR İÇİN KİŞİSEL PROFESYONEL GÜNDEM',54,24,14,'#B8CFC2')
    d.line((54,47,1026,47),fill='#446656',width=1)
    wordmark=Image.open(Path(__file__).parent/'references/doctorium-article-wordmark-only.png').convert('RGBA')
    wordmark=wordmark.resize((285,64),Image.Resampling.LANCZOS)
    im.paste(wordmark,(316,72),wordmark)
    article_post(im,d,600,127)
    tagline='Size özel günlük gazeteniz';tf=font(23,'italic')
    d.text(((W-d.textlength(tagline,font=tf))/2,148),tagline,font=tf,fill=WHITE,anchor='lt')
    d.line((54,204,1026,204),fill=INK,width=3)
    fit_label(d,tr_upper(issue_label),54,216,360,16,bold=True,minsize=14)
    label(d,'GÜNLÜK SEÇKİ',453,216,16,bold=True)
    fit_label(d,'6 HABER · TASARIM PROVASI' if draft else '6 HABER · DOCTORIUM POST',807,216,219,15,minsize=13)
    d.line((54,242,1026,242),fill=INK,width=1)

    fit_label(d,'01  /  MANŞET · '+tr_upper(categories[0]),54,272,618,16,BODY_GREEN,True,minsize=14)
    stats.append(box(d,titles[0],(54,309,618,147),42,40,bold=True))
    stats.append(box(d,decks[0],(54,397,618,62),21,20))
    lead=Image.open(lead_image_path)
    if lead.width<618 or lead.height<332:raise ValueError('Lead image resolution is below 618x332')
    lead=ImageOps.exif_transpose(lead).convert('RGB')
    lead=ImageOps.fit(lead,(618,332),method=Image.Resampling.LANCZOS,centering=tuple(image_focus))
    im.paste(lead,(54,470))
    d.rectangle((54,470,671,801),outline='#B2BAAA',width=1)
    fit_label(d,lead_image_caption,54,817,618,18,MUTED,minsize=16)
    d.line((698,271,698,842),fill='#7F9182',width=1)

    fit_label(d,'02  /  '+tr_upper(categories[1]),726,273,300,15,BODY_GREEN,True,minsize=13)
    stats.append(box(d,titles[1],(726,312,300,220),30,28,bold=True))
    stats.append(box(d,decks[1],(726,422,300,104),22,20))
    label(d,'Kaynak ve ayrıntılar →',726,541,17,MUTED,kind='italic')
    d.line((726,581,1026,581),fill='#7F9182',width=1)
    fit_label(d,'03  /  '+tr_upper(categories[2]),726,609,300,15,BODY_GREEN,True,minsize=13)
    stats.append(box(d,titles[2],(726,647,300,140),30,28,bold=True))
    stats.append(box(d,decks[2],(726,728,300,78),20,19))
    label(d,'Etkinlik bilgileri ve kaynak →' if tr_upper(categories[2])=='ETKİNLİK' else 'Ayrıntılar ve kaynak →',726,818,17,MUTED,kind='italic')
    d.line((54,869,1026,869),fill=INK,width=2)

    cols=[54,392,730]
    tags=[f'{i+4:02}  /  '+tr_upper(categories[i+3]) for i in range(3)]
    for i,(x,tag) in enumerate(zip(cols,tags)):
        fit_label(d,tag,x,901,296,15,BODY_GREEN,True,minsize=13)
        stats.append(box(d,titles[i+3],(x,939,296,190),30,28,bold=True))
        stats.append(box(d,decks[i+3],(x,1054,296,100),21,19))
        label(d,'Ayrıntılar ve kaynak →',x,1169,17,MUTED,kind='italic')
    for x in [372,710]:d.line((x,901,x,1190),fill='#7F9182',width=1)
    d.line((54,1234,1026,1234),fill='#446656',width=3)
    label(d,'doctorium.tr',54,1255,23,GREEN,True)
    label(d,'KAYNAKLAR VE AYRINTILAR İÇİN KAYDIRIN →',496,1260,17,WHITE,True)
    fit_label(d,issue_label+' tarihli tasarım provasıdır. Yayımlanmamıştır.' if draft else issue_label+' tarihli seçki · doctorium.tr',54,1301,972,15,'#A6BDAE')
    return im,stats
