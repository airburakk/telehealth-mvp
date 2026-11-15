"""Minimal all-green Doctorium Post closing-card proof. Offline only."""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageOps
from newspaper_cover import W, H, WHITE, GREEN, font, article_post

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'back-cover'

def add_editorial_background(im):
    """Decorative code-native line art, with no news, source text or extra logo."""
    layer=Image.new('RGBA',(W,H),(0,0,0,0))
    # A partial latitude/longitude sphere echoes the brand's globe theme.
    # It is ornamental geometry, not a replacement for the authentic brand mark.
    globe=Image.new('RGBA',(660,660),(0,0,0,0));g=ImageDraw.Draw(globe)
    c=(58,171,128,49)
    g.ellipse((70,70,590,590),outline=c,width=2)
    for inset in [142,222]:g.ellipse((inset,70,660-inset,590),outline=c,width=2)
    for inset in [165,250]:g.ellipse((70,inset,590,660-inset),outline=c,width=2)
    g.line((70,330,590,330),fill=c,width=2)
    globe=globe.rotate(-22,resample=Image.Resampling.BICUBIC,expand=False)
    layer.alpha_composite(globe,(744,-38))
    # Delicate print-column rules on a tilted newspaper sheet, mostly off-canvas.
    paper=Image.new('RGBA',(580,710),(0,0,0,0));p=ImageDraw.Draw(paper)
    pc=(70,192,143,45)
    p.rectangle((35,35,545,675),outline=pc,width=2)
    p.rectangle((49,49,559,689),outline=(70,192,143,26),width=1)
    p.line((65,92,515,92),fill=pc,width=3)
    p.line((65,115,515,115),fill=pc,width=1)
    p.line((65,146,515,146),fill=pc,width=2)
    p.line((290,170,290,640),fill=pc,width=1)
    # Abstract typographic rules deliberately contain no readable copy.
    for x in [65,320]:
        p.rectangle((x,175,x+195,267),outline=pc,width=1)
        for n,y in enumerate(range(299,635,24)):
            width=195 if n%5!=4 else 136
            p.line((x,y,x+width,y),fill=pc,width=1)
    paper=paper.rotate(-16,resample=Image.Resampling.BICUBIC,expand=True)
    layer.alpha_composite(paper,(-270,884))
    # Keep the center clean, preserving the message as the strongest element.
    return Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')

def make(background_image_path=None):
    im=Image.new('RGB',(W,H));d=ImageDraw.Draw(im);bounds=[]
    for y in range(H):
        t=max(0,(y-230)/(H-231))
        d.line((0,y,W,y),fill=(round(3+3*t),round(22+49*t),round(16+33*t)))
    if background_image_path is not None:
        # Optional generated light texture is strictly behind the unchanged
        # code-native line art, brand and text. It never rewrites any letter.
        texture=ImageOps.fit(Image.open(background_image_path).convert('RGB'),(W,H),method=Image.Resampling.LANCZOS)
        mask=Image.new('L',(W,H),0);md=ImageDraw.Draw(mask)
        for y in range(250,1130):
            fade=math.sin(math.pi*(y-250)/880)**2
            md.line((0,y,W,y),fill=round(0.8*255*fade))
        im=Image.composite(texture,im,mask)
    im=add_editorial_background(im);d=ImageDraw.Draw(im)
    wordmark=Image.open(ROOT/'references/doctorium-article-wordmark-only.png').convert('RGBA').resize((285,64),Image.Resampling.LANCZOS)
    im.paste(wordmark,(316,122),wordmark)
    article_post(im,d,600,177)

    def text(value,x,y,size,fill=WHITE,bold=False):
        f=font(size,'sans',bold)
        if x is None:x=(W-d.textlength(value,font=f))/2
        ink=d.textbbox((x,y),value,font=f,anchor='lt')
        if ink[0]<54 or ink[2]>1026 or ink[1]<0 or ink[3]>H-54:
            raise ValueError('Text outside safe area: '+value)
        d.text((x,y),value,font=f,fill=fill,anchor='lt')
        bounds.append({'text':value,'fontSize':size,'bounds':ink})

    text('Okumaya',None,440,84,bold=True)
    text('kaynağından',None,543,84,fill='#25C595',bold=True)
    text('devam edin.',None,646,84,bold=True)
    text('Ayrıntılar Doctorium’da.',None,929,43)
    text('doctorium.tr',None,1248,35,fill='#67D6AE',bold=True)
    return im,{'draft':True,'safeToPublish':False,'sourceList':False,'dimensions':[W,H],
               'userRequestedText':'Okumaya kaynağından devam edin, ayrıntılar Doctorium’da.',
               'website':'doctorium.tr',
               'cleanOriginalTypography':True,
               'backgroundLightOnly':background_image_path is not None,
               'decorativeBackground':'Subtle cropped globe line geometry and a tilted newspaper outline; no factual text, source list or stock imagery.',
               'textBounds':bounds,
               'referenceStatus':'Partial only. The second top-row card was visually inspected; pin state was unavailable. Opening the post hit a sign-in wall, so inner slides and exact second-pinned identity were not inspected.',
               'observedProfileCard':'https://www.instagram.com/doctoriumtr/p/Dc1MSsACPi5/',
               'referenceUse':'Centered sans-serif simplicity was visible on the card. Green background follows the user instruction and approved Doctorium palette, not a claimed Instagram color match.',
               'noExternalMutation':True}

if __name__=='__main__':
    OUT.mkdir(exist_ok=True)
    im,qa=make(ROOT/'assets/back-cover-natural-light-background.png')
    target=OUT/'Doctorium_Post_Arka_Kapak_Tasarim_Ornegi.png'
    im.save(target)
    qa['sha256']=hashlib.sha256(target.read_bytes()).hexdigest()
    (OUT/'back-cover-green-qa.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n')
    im.resize((540,675),Image.Resampling.LANCZOS).save(OUT/'back-cover-green-mobile.png')
    print(json.dumps({'path':str(target),'sha256':qa['sha256']}))
