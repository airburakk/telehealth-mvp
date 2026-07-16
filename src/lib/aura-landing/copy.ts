// AURA landing sozlugu + varlik haritalari — SAF VERI, "use client" YOK:
// server sayfalar (JSON-LD) da import eder (RSC client-reference tuzagi olmasin).
// AURA v2 vitrin i18n — EN birincil; platform landing'inin 8 dil seti (RTL dahil).
// Tum gorunur metinler buradan.
export type Lang = "en" | "tr" | "de" | "fr" | "ru" | "ar" | "fa" | "az";

// Dil secici + <html lang/dir> icin meta (platform LANDING_LOCALES ile ayni set).
export const LANGS: { code: Lang; native: string }[] = [
  { code: "en", native: "English" },
  { code: "tr", native: "Türkçe" },
  { code: "de", native: "Deutsch" },
  { code: "fr", native: "Français" },
  { code: "ru", native: "Русский" },
  { code: "ar", native: "العربية" },
  { code: "fa", native: "فارسی" },
  { code: "az", native: "Azərbaycanca" },
];
export const LANG_CODES = LANGS.map((l) => l.code);
export function langDir(l: Lang): "rtl" | "ltr" {
  return l === "ar" || l === "fa" ? "rtl" : "ltr";
}

// Vitrin platforma tasindi (2026-07-12): hedefler artik ayni uygulamanin
// GORELI rotalari. /giris sonrasi hasta zaten huniye iner (tek huni /triyaj).
// Kapi/form ayrimi (ayni gun): /giris ve /kurumsal-giris vitrin KAPI
// panelleri; calisan e-posta/demo formlari /e-posta alt rotalarinda.
export const LINKS = {
  platformLogin: "/giris",
  emailLogin: "/giris/e-posta",
  googleStart: "/api/auth/google/start?intent=patient",
  platformSignup: "/kayit/hasta",
  secondOpinion: "/second-opinion",
  freeCare: "/ucretsiz-saglik",
  corporateLogin: "/kurumsal-giris",
  corporateEmailLogin: "/kurumsal-giris/e-posta",
  doctorSignup: "/kayit",
};

export const VIDEOS = {
  // hero v3: 15 sn; cekim koprude biter (son karede acikligin askilari ust-orta
  // bantta = AURA letterform'uyla ortusur). Ad-versiyonlama onbellek deler.
  // KAYNAK SECIMI: asset sunucusu Range desteklemedigi icin agir kaynak
  // baglamak preload hint'inden bagimsiz TAM indirme demektir → yuzeyler
  // "src720" hafif kopyayi kullanir. TEK ISTISNA landing hero'su (hero.tsx):
  // tam-genislik ana ekranda 720p gorunur kalite kaybetti → kullanici karari
  // ile 1080p "src" kullanir. "scrub" = mobil scroll-scrub'in all-keyframe
  // kaynagi (ffmpeg -g 1), 720p (-k720).
  hero: {
    src: "/assets/video/v-hero3.mp4",
    src720: "/assets/video/v-hero3-720.mp4",
    poster: "/assets/video/p-hero3.jpg",
  },
  // ⚠️ POSTERLER "2" SONEKLI (v6.14.5) — DÜZ p-consult.jpg'ye GERİ DÖNME:
  // 4 kulvar videosu 2026-07-12'de yeniden üretildi ama posterler bir gün
  // önceki ESKİ sürümden kaldı → poster ile videonun ilk karesi FARKLI SAHNE
  // (ölçüldü: ortalama fark 23-46; hero 0.4 ve HIW 0.7-1.1 ile kıyasla).
  // Kullanıcı /v2'de yakaladı: "videonun başında başka bir fotoğraf var,
  // sonradan videoya bağlanıyor" — preload="none" posteri uzun tuttuğu için
  // orada göze battı, ama CANLI landing chapters'ında da aynı zıplama vardı.
  // Yeniden üretim: ffmpeg -i <video> -frames:v 1 -q:v 2 → fark 0.87-1.26 ✓
  // Ad-versiyonlama ŞART: aynı URL'de içerik değiştirmek edge cache'te ESKİYİ
  // sundurur (video yenilemelerindeki aynı ders). Yeni video = yeni poster +
  // yeni ad; posterin videodan ÜRETİLDİĞİNİ ölç, göz kararı yapma.
  consult: {
    src: "/assets/video/v-consult.mp4",
    src720: "/assets/video/v-consult-720.mp4",
    poster: "/assets/video/p-consult2.jpg",
    scrub: "/assets/video/v-consult-k720.mp4",
  },
  so: {
    src: "/assets/video/v-so.mp4",
    src720: "/assets/video/v-so-720.mp4",
    poster: "/assets/video/p-so2.jpg",
    scrub: "/assets/video/v-so-k720.mp4",
  },
  tourism: {
    src: "/assets/video/v-tourism.mp4",
    src720: "/assets/video/v-tourism-720.mp4",
    poster: "/assets/video/p-tourism2.jpg",
    scrub: "/assets/video/v-tourism-k720.mp4",
  },
  freecare: {
    src: "/assets/video/v-freecare.mp4",
    src720: "/assets/video/v-freecare-720.mp4",
    poster: "/assets/video/p-freecare2.jpg",
    scrub: "/assets/video/v-freecare-k720.mp4",
  },
};

// How-It-Works rehber videolari (2026-07-12): 4x seedance 15 sn multi-shot
// surec sekansi (kayit→odeme→semptom→bekleme→gorusme vb.). Revizyonda ayni
// desen: yeniden uretim + AD-VERSIYONLAMA (ayni URL'de icerik degistirme —
// edge cache eskiyi sunar), yalniz bu harita cevrilir.
// Kaynaklar 720p hafif kopyalar (~1 MB; 1080p orijinaller depoda duruyor):
// rehber paneli en fazla ~600px genislikte cizilir, 1080p'nin 4'lu toplami
// ~50 MB idi ve Range'siz sunucuda sayfa acilisinda tamami iniyordu.
export const HIW_VIDEOS = {
  consult: {
    src: "/assets/video/v-hiw-consult-720.mp4",
    poster: "/assets/video/p-hiw-consult.jpg",
  },
  so: { src: "/assets/video/v-hiw-so-720.mp4", poster: "/assets/video/p-hiw-so.jpg" },
  tourism: {
    src: "/assets/video/v-hiw-tourism-720.mp4",
    poster: "/assets/video/p-hiw-tourism.jpg",
  },
  freecare: {
    src: "/assets/video/v-hiw-freecare-720.mp4",
    poster: "/assets/video/p-hiw-freecare.jpg",
  },
};

// AURA logo letterform dilimleri (yatayda siki kirpilmis "-t" kesimler) —
// hero ve giris basliklari ayni kaynagi kullanir.
export const LETTERS = ["aura-a1-t", "aura-u-t", "aura-r-t", "aura-a2-t"];

export const COPY = {
  en: {
    nav: {
      // 4 sekme = 4 chapter capasi (sirali); iki marka ayagi turkuaz vurgulu.
      telehealth: "Telehealth",
      so: "Second Opinion",
      tourism: "Health Tourism",
      // "Access Care" = EN vitrin adi (kullanici karari 2026-07-16, brand paketi).
      // ⚠️ YALNIZ EN: urun/hukuki ad "Ucretsiz Saglik Hizmeti" (v4.21 rename) TR ve
      // diger dillerde KORUNUR; rota /ucretsiz-saglik + DB freeCare* degismedi.
      // ⚠️ Ad ucretsizligi SOYLEMIYOR → "free" bilgisi metinlerde TUTULUR (cta +
      // /ucretsiz-saglik sayfasi). Adi degistirirken o bilgiyi silme.
      freecare: "Access Care",
      how: "How It Works",
      cta: "See a doctor",
      menu: "Menu",
      close: "Close menu",
    },
    hero: {
      word: "AURA",
      // Ilk satir parcali: iki marka ayagi (a/b) turkuaza boyanir.
      l1: { a: "Telehealth", mid: " and ", b: "Health Tourism", tail: "," },
      line2: "end to end.",
      cta: "See a doctor",
      scenes: "01/04 scenes",
    },
    chapters: [
      {
        n: "01",
        key: "consult",
        strand: "telehealth",
        title: "Talk to a doctor.",
        body: "AURA prepares your case and suggests an appropriate specialty.",
        cta: "enter consult",
        href: "/giris",
        external: false,
      },
      {
        n: "02",
        key: "so",
        strand: "Second Opinion",
        title: "A second set of eyes.",
        body: "Independent specialists review your diagnosis.",
        cta: "request review",
        href: LINKS.secondOpinion,
        external: true,
      },
      {
        n: "03",
        key: "tourism",
        strand: "health tourism",
        title: "Health tourism, planned.",
        body: "Flights, hotel, surgery and aftercare in one plan.",
        cta: "plan my trip",
        href: "/giris",
        external: false,
      },
      {
        n: "04",
        key: "freecare",
        strand: "Access Care",
        title: "Health is a right.",
        body: "Volunteer doctors step in when care is out of reach.",
        // "free" KASITLI: ad artik ucretsizligi soylemiyor (Access Care) →
        // tek ucretsizlik sinyali burada kaldi, silme.
        cta: "apply for free care",
        href: LINKS.freeCare,
        external: true,
      },
    ],
    doctors: {
      headline: "Meet the specialists.",
      note: "Sample roster from our demo network.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Cardiology" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Neurology" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Orthopedics" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatology" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "IVF" },
      ],
    },
    // Guven bolumu (P0 durustluk, 2026-07-15): demo metrik + uydurma yorum +
    // akreditasyon rozetleri KALDIRILDI (olculmeden/belgelenmeden iddia edilmez).
    // Yerine yalniz URUNDE KANITLANABILIR olan (Tier A) 6 madde — her birinin kod
    // karsiligi dogrulandi: consent.ts · crypto.ts · ownership.ts · admin/hekim-onay
    // · audit.ts · booking route agencySentAt kapisi. Yeni madde eklemeden ONCE
    // kod kanitini goster (claims framework: iddia > kanit > sahip > tarih).
    trust: {
      headline: "Trust is part of the product",
      items: [
        { title: "Clear consent", desc: "Consent is recorded before AI-supported steps, with the approved text, a timestamp and a tamper-evident chain." },
        { title: "Encrypted in transit and at rest", desc: "Health data is encrypted in transit and encrypted again before it is stored." },
        { title: "Role-based access", desc: "Patients, doctors, coordinators and partners see only what their role requires." },
        { title: "Verified doctor onboarding", desc: "Professional documents are reviewed and approved before a doctor becomes visible." },
        { title: "Tamper-evident access log", desc: "Access to clinical data is written to an append-only chain that can be independently verified." },
        { title: "Assessment before commitments", desc: "Pricing and travel arrangements only follow a clinical assessment — never precede it." },
      ],
    },
    howItWorks: {
      headline: "How it works",
      note: "Four steps, one continuous journey.",
      steps: [
        { title: "Tell us", desc: "Describe your symptoms or goal in your own language." },
        { title: "AURA prepares your case", desc: "Your information is organised and an appropriate specialty is suggested." },
        { title: "Video consult", desc: "Meet your doctor over encrypted video, with live interpretation." },
        { title: "Follow-up", desc: "Reports, recovery checks and aftercare — all from home." },
      ],
      // AI sorumluluk mikro-metni (backlog P0#5) — AI adiminin hemen altinda durur:
      // destek ile klinik yargiyi ayirir. Cevirilerde bu ayrim korunmali.
      safety: "Medical decisions are made by qualified healthcare professionals. AURA supports assessment, coordination and communication.",
      cta: "See the full walkthrough",
    },
    closing: {
      headline: "Ready when you are.",
      cta: "See a doctor",
    },
    footer: {
      platform: "Platform",
      explore: "Explore",
      patientLogin: "Patient login",
      patientSignup: "Patient sign-up",
      corporateLogin: "Corporate login",
      doctorSignup: "Doctor sign-up",
      telehealth: "Telehealth",
      tourism: "Health Tourism",
      doctors: "Specialists",
      trust: "Trust & Privacy",
      legal: "© 2026 AURA. MVP demo, not medical advice.",
    },
    signin: {
      // Letterform baslik parcalari: [wordBefore] / [AURA dilimleri + wordAfter]
      // / [lineAfter] — bos parca render edilmez (EN/TR soz dizimi farki).
      word: "AURA",
      wordBefore: "Welcome to",
      wordAfter: "",
      lineAfter: "",
      sub: "Sign in to start your care journey",
      google: "Continue with Google",
      apple: "Continue with Apple",
      email: "Continue with Email",
      or: "OR",
      // DURUSTLUK (2026-07-15): eski metin "Gizlilik Politikasi + Kullanim
      // Kosullari"na atif yapiyordu — IKISI DE YOK (link bile degil). Okunamayan
      // belgeye onay aldirmak v6.8'de temizlenen iddia sinifi. Simdi YAYINDA OLAN
      // /guven-ve-gizlilik sayfasina atif + gercek link (legalLink).
      // ⚠️ Gizlilik Politikasi + Kullanim Kosullari yazilinca burasi yeniden duzenlenir.
      // Cumle-ici link: [legal] <a>legalLink</a> [legalAfter] — sayfa adi bir kez
      // gecer (ayri link satiri sayfa adini TEKRARLIYORDU). Bosluklar kasitli.
      legal: "By continuing, you accept the data-processing principles set out on our ",
      legalLink: "Trust & Privacy",
      legalAfter: " page.",
      back: "Back to home",
    },
    corporate: {
      title: "AURA · Corporate sign-in",
      word: "AURA",
      wordBefore: "",
      wordAfter: "",
      lineAfter: "Corporate sign-in",
      sub: "Select your role and continue to the corporate portal.",
      roleLabel: "Sign in as",
      roles: [
        "Doctor",
        "Partner Doctor",
        "Health Professional",
        "Health Tourism Agency Officer",
        "Coordinator",
        "Ethics Board",
      ],
      continue: "Continue to sign in",
      legal: "Corporate access is limited to verified staff and partners of the platform.",
      back: "Back to home",
    },
    // ——— /v2 — YENI ANA SAYFA (2026-07-16, onizleme rotasi; noindex) ———
    // Kaynak: kullanicinin brand paketi (AURA_homepage_copy_v1.md + wireframe +
    // blueprint). ⚠️ Blueprint kendi basliginda "review artifact, NOT a drop-in
    // replacement" diyor ve video/gsap'i KASTEN disarida birakiyor → IA + metin
    // ondan alinir, sinematik katman MEVCUT bilesenlerden tasinir (wireframe §1
    // de "current cinematic video can remain" diyor).
    //
    // KULLANICI KARARI (2026-07-16): chapters'in 4 kulvar videosu entryPaths
    // bölümünün ARKASINA gömülür; hangi kart aktifse o video oynar.
    //
    // 🪤 copy_v1 §3 "Connect by SECURE video" diyor → YAZILMADI: "secure" bizim
    // yasak ifademiz ([[public-claim-honesty]]); blueprint'in kendisi "protected"
    // kullaniyor. Burada "encrypted" (v6.8 onayli ifade) kullanildi.
    v2: {
      // Nav (v6.16): dort hizmet sekmesi → tek bakim mimarisi. Sayfa "tek bakim
      // yolculugu, dort giris kapisi" derken nav'in dort ayri hizmeti ayri sekme
      // olarak siralamasi sayfayla CELISIYORDU. Care → #care capasi (entry-paths).
      // ⚠️ Bu sozluk YALNIZ /v2 nav'ina bagli: mevcut / landing'in nav'i (kok nav
      // alani) dokunulmadan durur — #care capasi orada YOK (kirik link olurdu).
      // cta = hero.ctaPrimary ile AYNI etiket (nav.tsx "ayni etiket = ayni niyet":
      // ayni hedefe -/giris- giden iki dugme ayni sozu vermeli).
      // 🪤 OLCULDU (v6.16): brand paketinin nav cevirileri ile v6.14 hero cevirileri
      // AYRI kalemlerden gelmis → EN disinda 7 dilde iki farkli etiket cikti
      // (TR "Bakiminiza baslayin" vs "Bakim yolculugunu baslat"). nav.cta HER dilde
      // hero.ctaPrimary'ye esitlendi. Tasma degil, SES sorunuydu: 1024px'te en uzun
      // etiket (TR 187px) ile link grubu arasinda 222px bosluk olculdu.
      // ⚠️ hero.ctaPrimary'yi degistirirsen nav.cta'yi da degistir (8 dil).
      // menu/close kok nav sozlugunden yeniden kullanilir (t.nav.menu) — 8 dilde hazir.
      nav: {
        care: "Care",
        how: "How It Works",
        trust: "Trust & Privacy",
        clinicians: "For Clinicians",
        cta: "Start your care",
      },
      hero: {
        eyebrow: "Cross-border digital care",
        headline: "Care, without borders.",
        lede: "Meet the right specialist, understand your options and continue your care wherever you are — with multilingual support from first assessment to follow-up.",
        ctaPrimary: "Start your care",
        ctaSecondary: "See how AURA works",
        // Klinik sorumluluk mikro-metni — hero'da, CTA'nin hemen altinda.
        safety: "Clinical decisions are made by qualified healthcare professionals. AURA supports assessment, coordination and communication.",
      },
      entry: {
        eyebrow: "Start from what you need today",
        headline: "One care journey. Four ways to begin.",
        intro: "AURA organises the next steps around you.",
        // Kart sirasi = arkadaki video sirasi (key → VIDEOS haritasi).
        cards: [
          {
            key: "consult",
            n: "01",
            title: "Talk to a Doctor",
            body: "Describe your concern in your own language. AURA prepares your case and guides you to the appropriate specialty.",
            cta: "Start an assessment",
          },
          {
            key: "so",
            n: "02",
            title: "Second Opinion",
            body: "Have a diagnosis, scan or treatment plan reviewed by an independent specialist.",
            cta: "Prepare my case",
          },
          {
            key: "tourism",
            n: "03",
            title: "Health Tourism",
            body: "Explore treatment in Türkiye only after clinical review — before travel, price or reservation is confirmed.",
            cta: "Explore treatment options",
          },
          {
            key: "freecare",
            n: "04",
            title: "Access Care",
            // ⚠️ Ad ucretsizligi soylemiyor → "free" burada KASITLI.
            body: "Apply for free, supported consultations when distance, cost or access stands between you and care.",
            cta: "Apply for support",
          },
        ],
      },

      // ——— FAZ 2 (v6.16): AI sorumlulugu + Erisilebilirlik ———
      // KURAL [[public-claim-honesty]]: her madde KOD KANITLI. Kanit haritasi:
      //   ai.01 → components/ClinicalDecisionPanel.tsx ("AI — endikatif; karar doktora aittir")
      //   ai.02 → lib/ai-consent.ts (AI_TRIAGE scope, GENERAL_KVKK'dan AYRI kova) + AiConsentGate
      //           (riza verilene dek form MOUNT OLMAZ — "form acilmaz" iddiasi buradan)
      //   ai.03 → lib/ai-minimize.ts (ad → [HASTA] placeholder; istek cikmadan once degisir,
      //           doktorun okudugunda geri konur ⇒ "saglayici adi HIC gormez")
      //   ai.04 → lib/ai-consent.ts kapsam metni (brans yonlendirme + belge cevirisi)
      //   a11y.01 → copy.ts LANG_CODES (8) + langDir (ar/fa = rtl; dir KONTEYNERE, koke degil)
      //   a11y.02 → v2/hero.tsx + motion.tsx + chapters.tsx: reduced-motion'da pin/scrub HIC kurulmaz
      //   a11y.03 → v2/entry-paths.tsx (kart aktifligi hover + KLAVYE focus + mobil IO)
      //   a11y.04 → v2/hero.tsx (gizleme yalniz mount SONRASI gsap.set = fail-open)
      //
      // ⚠️ BOLUME GIRMEYENLER (kasitli — iddia edemedigimiz icin):
      //   · Sesle dikte: KULLANICI KARARI (2026-07-16) — yalnzi 3 hasta formunda
      //     (triyaj/SO/turizm), TUM yuzeylerde degil ⇒ landing'de genel vaat YANILTICI olurdu.
      //   · Braille: GORSEL marka ogesi — Braille cihazi/ekran okuyucu destegi DEGIL. note'ta
      //     acikca reddediliyor ([[aura-braille-under-wordmark]] marka kurali, a11y kaniti DEGIL).
      //   · WCAG: bagimsiz denetim YOK ⇒ uyumluluk beyani YOK (note'ta).
      // 🪤 Yeni madde eklerken: once KOD KANITI bul, sonra yaz. Kanitlanamayan madde GIRMEZ.
      // Yapisal not: items UNIFORM ({key,n,title,body}) + note ({label,text}) — 8 dilin yapi
      // imzasi birebir kalsin (tests/unit/aura-landing-copy.test.ts shape(), dizi UZUNLUGU da imzada).
      ai: {
        eyebrow: "Where AI stops",
        headline: "AI prepares. Doctors decide.",
        intro: "AURA uses AI for a narrow job, behind a consent gate you control.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "The decision is your doctor's",
            body: "Where AI suggests a procedure for a diagnosis, your doctor sees it labelled as indicative — and decides.",
          },
          {
            key: "consent",
            n: "02",
            title: "AI processing has its own consent",
            body: "Separate from general data-protection consent, and asked before you describe a single symptom. Until you give it, the form does not open.",
          },
          {
            key: "minimize",
            n: "03",
            title: "Your name never reaches the AI provider",
            body: "Clinical content is the AI's job, so it is sent. Your name is not needed for that job — it is replaced before the request leaves us, and restored in what your doctor reads.",
          },
          {
            key: "scope",
            n: "04",
            title: "A narrow job",
            body: "Guiding you to the right specialty, and translating the documents you upload. That is the scope.",
          },
        ],
        note: {
          label: "What we don't claim",
          text: "AI does not diagnose, choose treatment, or produce clinical judgement. Any AI output you see is indicative — it informs your doctor's decision, it does not replace it.",
        },
      },
      accessibility: {
        eyebrow: "Accessibility",
        headline: "Built to be usable, not just visible.",
        intro: "Your language, your reading direction, your motion preference — read from your device, not asked twice.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "Eight languages, two read right to left",
            body: "Arabic and Persian mirror the whole layout, not just the text.",
          },
          {
            key: "motion",
            n: "02",
            title: "If you asked your device for less motion, we listen",
            body: "The cinematic opening is not toned down — it is not built at all. Everything stays readable, scrolling stays normal.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "The keyboard is not an afterthought",
            body: "Cards respond to focus, not only to a hovering mouse.",
          },
          {
            key: "resilience",
            n: "04",
            title: "If our scripts fail, the words stay",
            body: "Text is in the page before any animation runs.",
          },
        ],
        note: {
          label: "What we don't claim",
          text: "We make no WCAG conformance claim — we have not been independently audited. The Braille mark beneath the AURA wordmark is a visual brand element; it does not mean Braille device or screen-reader support.",
        },
      },
    },

    // /guven-ve-gizlilik — Guven ve Gizlilik sayfasi (2026-07-15).
    // KURAL [[public-claim-honesty]]: her madde KOD KANITLI. Kanit haritasi
    // vault: output/trust-safety-sayfa-taslagi-2026-07-15.md (bolum → dosya).
    // Sayfanin degeri "neyi iddia ETMIYORUZ" kutularinda (kullanici karari:
    // "sayfanin asil degeri bu") → note.text dolu olan bolumlerde cizilir.
    // Yapisal not: sections UNIFORM ({key,n,title,body,note}) — bolume ozgu iki
    // parca kokte durur (aiEmphasis=02 · transferItems=08) ki 8 dilin yapi
    // imzasi birebir kalsin (tests/unit/aura-landing-copy.test.ts shape()).
    trustPage: {
      eyebrow: "trust",
      word: "AURA",
      // ⚠️ wordAfter BOS BIRAKILDI (olculdu 2026-07-15): letterform dilimlerinin
      // dogal sag boslugu + ml-1 = ~12px → "AURA ." gibi kopuk noktalama cizer.
      // Noktalama/dil eki gerekiyorsa lineAfter'a (ayri satir) yazilir.
      wordBefore: "Trust and privacy at",
      wordAfter: "",
      lineAfter: "",
      sub: "At AURA, trust is not a marketing promise — it is something you can point to in the product. Under every heading below we set out what we do, what we do not yet do, and what is not ours to decide.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "How your health data is protected",
          body: "Your data is encrypted in transit, and encrypted a second time with a separate key before it is written to our servers. Reports and images you upload arrive at storage already encrypted — the storage provider only ever sees the encrypted form. Your data is stored and processed in the European Union (Frankfurt).",
          note: {
            label: "What we don't claim",
            text: "This is not \"end-to-end encryption\". The key is managed on our servers — because clinical summaries, interpretation and the doctor's view all require the data to be processed on the server. A truly end-to-end encrypted system could not offer those functions.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "Consent and artificial intelligence",
          body: "Three separate consents are taken, and none stands in for another: general data-protection consent · AI pre-assessment of your complaint · AI simultaneous interpretation of your visit. For each one we store the exact text you approved, the moment you approved it, and a chain showing it has not been altered since. No step begins before consent — the form does not open, camera permission is not requested. You can view your own consent record at any time.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "Who can see what",
          body: "Access follows your role: patients see only their own records · a doctor only if verified and assigned to the case · a partner doctor cannot reach the patient database at all, and personal names are masked in the question forwarded to them · coordinators and agencies see logistics, not clinical records. When your post-operative follow-up ends, clinical staff access closes and the record stays with you alone; you can reopen it whenever you wish.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "Doctor verification",
          body: "Before a doctor becomes visible or receives any patient assignment, they upload their professional documents — diploma, specialty certificate and professional liability insurance — and these are reviewed and approved. An unapproved doctor's profile is never published.",
          note: {
            label: "What we don't claim",
            text: "We do not say \"accredited doctor\" — what we verify is the existence and validity of the documents.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "Video, documents and sharing",
          body: "Your consultations are not recorded. Video and audio are encrypted with WebRTC; when a direct connection cannot be established, the relay server that steps in carries only encrypted traffic and cannot see its content. When you share your records, you choose which categories are visible; you can set an expiry, add a password, disable downloads, and revoke the link at any moment. Every access is logged.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "Audit and access history",
          body: "Every meaningful access to your clinical data is written to a chain that cannot later be deleted or altered, and that can be independently verified.",
          note: {
            label: "The limit",
            text: "The audit log is designed not to block the application — if an entry cannot be written, the operation still completes. High-frequency technical events such as signalling are deliberately not logged.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "Retention and deletion",
          body: "You can delete your account and your personal data. When you do, your e-mail, name, phone number, profile and notifications are genuinely deleted, your share links are revoked, and signing in becomes impossible. Your health records must be kept for the statutory retention period of 20 years — but they close to access (no one can open them: not doctors, not coordinators, not administrators, and not you) and they are destroyed automatically when the period ends. Two things are kept on purpose: your consent records, which prove the legal basis for what we hold and are destroyed together with the records, and the access history, a tamper-evident chain that carries no identifying data and whose deletion would break the chain.",
          note: {
            label: "What we don't claim",
            text: "Deletion is not performed by destroying a key (\"crypto-shredding\") but by physically deleting the record.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "International transfer and service providers",
          body: "Storage and processing take place in the European Union (Frankfurt). The limited cases that leave the EU:",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "Clinical responsibility",
          body: "Diagnosis, treatment and medical decisions belong to qualified healthcare professionals. AURA supports assessment, coordination and communication; it does not replace your doctor. A second opinion is not binding.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "Report a privacy or security concern",
          body: "If you have a concern about your data, or a security finding, tell us.",
          note: {
            label: "⚖️ Draft",
            text: "The data controller's contact address has not been published yet; this section will be updated once it is final. We are not inventing an address in the meantime.",
          },
        },
      ],
      // 02'nin altinda vurgulu paragraf: AI destegi ile klinik yargiyi ayirir
      // (howItWorks.safety ile ayni sinir — cevirilerde ayrim korunmali).
      aiEmphasis: "Medical decisions do not belong to artificial intelligence: AURA organises your information and suggests an appropriate specialty; diagnosis and treatment decisions are made by qualified healthcare professionals.",
      // 08'in madde listesi.
      transferItems: [
        "AI pre-assessment and clinical summary (Anthropic, USA): your name is not sent — a placeholder is used; the clinical content is sent because it is the substance of the task.",
        "Simultaneous interpretation (Google, USA): the audio of your visit is processed for interpretation, subject to separate explicit consent; without that consent it does not run.",
        "Connection relay (Cloudflare): carries encrypted media only.",
        "Signalling (Ably) and rate limiting (Upstash): no health data is sent.",
      ],
    },
    // How-It-Works rehberi: hero parcalari + 4 rehberin adim listeleri.
    // Rehberin n/strand/baslik/intro/CTA'si chapters kaydindan key ile bulunur.
    hiw: {
      eyebrow: "guide",
      word: "AURA",
      wordBefore: "How",
      wordAfter: "",
      lineAfter: "works.",
      sub: "Four journeys, one platform. Every step from sign-up to consultation, explained below.",
      pick: "Choose your journey",
      watch: "watch the guide",
      step: "step",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "Create your account", d: "Sign up in minutes with Google, Apple or e-mail." },
            { t: "Complete payment", d: "One transparent fee, paid securely by card." },
            { t: "Describe your symptoms", d: "A short guided form; AURA organises what you share." },
            { t: "Get matched to a specialist", d: "You are assigned to a doctor in the suggested specialty." },
            { t: "Wait in the digital lounge", d: "Follow your place in the digital waiting room in real time." },
            { t: "Meet your doctor on video", d: "An encrypted video visit; notes and next steps are saved to your file." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "Start with a diagnosis", d: "You have seen a doctor and hold a diagnosis or a treatment plan." },
            { t: "Enter AURA", d: "Open the Second Opinion flow and create your case." },
            { t: "Upload your files", d: "Reports, MRI scans and lab results, uploaded securely and privately." },
            { t: "Meet the professor", d: "A video session with a senior academic specialist." },
            { t: "Receive a written report", d: "A detailed, structured second-opinion report in writing." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "Choose your treatment", d: "Hollywood smile, hair transplant, aesthetic surgery, or a medical operation." },
            { t: "Explore options in Türkiye", d: "Compare health-tourism authorised clinics and specialists for your case." },
            { t: "Talk to specialists", d: "Meet doctors and health advisors over video." },
            { t: "Receive your offer", d: "A clear package covering treatment, stay and logistics." },
            { t: "Travel with a full plan", d: "Flights, hotel, procedure and aftercare, planned end to end." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "Check the criteria", d: "Eligibility depends on where you live and the specialty you need." },
            { t: "Apply online", d: "A short application with the basics of your situation." },
            { t: "Get matched to a volunteer", d: "A volunteer doctor in the right specialty takes your case." },
            { t: "Meet on video", d: "When your doctor is online, your visit happens as a video consultation." },
          ],
        },
      ],
    },
  },
  tr: {
    nav: {
      telehealth: "Uzaktan Sağlık",
      so: "İkinci Görüş",
      tourism: "Sağlık Turizmi",
      freecare: "Ücretsiz Sağlık",
      how: "Nasıl Çalışır",
      cta: "Doktorla görüş",
      menu: "Menü",
      close: "Menüyü kapat",
    },
    hero: {
      word: "AURA",
      l1: { a: "Uzaktan Sağlık", mid: " ve ", b: "Sağlık Turizmi", tail: "," },
      line2: "uçtan uca.",
      cta: "Doktorla görüş",
      scenes: "01/04 sahne",
    },
    chapters: [
      {
        n: "01",
        key: "consult",
        strand: "uzaktan sağlık",
        title: "Doktorla görüşün.",
        body: "AURA vakanızı hazırlar ve uygun branşı önerir.",
        cta: "görüşmeye başla",
        href: "/giris",
        external: false,
      },
      {
        n: "02",
        key: "so",
        strand: "İkinci Görüş",
        title: "İkinci bir uzman gözü.",
        body: "Bağımsız uzmanlar tanınızı yeniden değerlendirir.",
        cta: "inceleme iste",
        href: LINKS.secondOpinion,
        external: true,
      },
      {
        n: "03",
        key: "tourism",
        strand: "sağlık turizmi",
        title: "Sağlık turizmi, planlı.",
        body: "Uçuş, otel, ameliyat ve sonrası tek planda.",
        cta: "yolculuğumu planla",
        href: "/giris",
        external: false,
      },
      {
        n: "04",
        key: "freecare",
        strand: "ücretsiz sağlık",
        title: "Sağlık bir haktır.",
        body: "Bakım ulaşılmaz olduğunda gönüllü doktorlar devreye girer.",
        cta: "ücretsiz başvur",
        href: LINKS.freeCare,
        external: true,
      },
    ],
    doctors: {
      headline: "Uzmanlarla tanışın.",
      note: "Demo ağımızdan örnek kadro.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Kardiyoloji" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Nöroloji" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Ortopedi" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatoloji" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "Tüp Bebek" },
      ],
    },
    trust: {
      headline: "Güven, ürünün bir parçası",
      items: [
        { title: "Açık rıza kaydı", desc: "Yapay zeka destekli adımlardan önce rızanız; onaylanan metin, zaman damgası ve değiştirilemez zincirle kaydedilir." },
        { title: "İletimde ve sunucuda şifreli", desc: "Sağlık verileriniz iletim sırasında şifrelenir, saklanmadan önce yeniden şifrelenir." },
        { title: "Rol-bazlı erişim", desc: "Hasta, doktor, koordinatör ve iş ortakları yalnız rollerinin gerektirdiğini görür." },
        { title: "Doktor belge doğrulaması", desc: "Mesleki belgeler incelenip onaylanmadan doktor profili yayına çıkmaz." },
        { title: "Değiştirilemez erişim kaydı", desc: "Klinik veriye her erişim, bağımsız doğrulanabilen ekle-only bir zincire işlenir." },
        { title: "Önce değerlendirme, sonra taahhüt", desc: "Fiyat ve seyahat düzenlemeleri klinik değerlendirmenin ardından gelir — öncesinde asla." },
      ],
    },
    howItWorks: {
      headline: "Nasıl çalışır",
      note: "Dört adım, tek kesintisiz yolculuk.",
      steps: [
        { title: "Anlatın", desc: "Şikayetinizi veya hedefinizi kendi dilinizde anlatın." },
        { title: "AURA vakanızı hazırlar", desc: "Bilgileriniz düzenlenir ve uygun branş önerilir." },
        { title: "Video görüşme", desc: "Doktorunuzla şifreli video ve canlı çeviriyle görüşün." },
        { title: "Takip", desc: "Raporlar, iyileşme kontrolleri ve bakım — hepsi evden." },
      ],
      safety: "Tıbbi kararları yetkili sağlık profesyonelleri verir. AURA değerlendirme, koordinasyon ve iletişimi destekler.",
      cta: "Tüm adımları görün",
    },
    closing: {
      headline: "Siz hazır olduğunuzda.",
      cta: "Doktorla görüş",
    },
    footer: {
      platform: "Platform",
      explore: "Keşfet",
      patientLogin: "Hasta girişi",
      patientSignup: "Hasta kaydı",
      corporateLogin: "Kurumsal giriş",
      doctorSignup: "Doktor kaydı",
      telehealth: "Uzaktan Sağlık",
      tourism: "Sağlık Turizmi",
      doctors: "Uzmanlar",
      trust: "Güven ve Gizlilik",
      legal: "© 2026 AURA. MVP demo, tıbbi tavsiye değildir.",
    },
    signin: {
      word: "AURA",
      // 🪤 wordAfter BOŞ: dil eki letterform dilimlerinden ~9px kopuk çizilirdi
      // ("AURA 'ya hoş geldiniz"; ölçüldü 2026-07-16) — dilimlerin doğal sağ
      // boşluğu + ml-1. Ek/noktalama gereken dillerde lineAfter kullan.
      wordBefore: "",
      wordAfter: "",
      lineAfter: "Hoş geldiniz",
      sub: "Bakım yolculuğunuza başlamak için giriş yapın",
      google: "Google ile devam et",
      apple: "Apple ile devam et",
      email: "E-posta ile devam et",
      or: "VEYA",
      legal: "Devam ederek ",
      legalLink: "Güven ve Gizlilik",
      legalAfter: " sayfasında açıklanan veri işleme esaslarını kabul edersiniz.",
      back: "Ana sayfaya dön",
    },
    corporate: {
      title: "AURA · Kurumsal giriş",
      word: "AURA",
      wordBefore: "",
      wordAfter: "",
      lineAfter: "Kurumsal giriş",
      sub: "Rolünüzü seçin ve kurumsal portala devam edin.",
      roleLabel: "Giriş rolü",
      roles: [
        "Doktor",
        "Partner Doktor",
        "Sağlık Uzmanı",
        "Sağlık Turizmi Acente Yetkilisi",
        "Koordinatör",
        "Etik Kurul",
      ],
      continue: "Girişe devam et",
      legal: "Kurumsal erişim, platformun doğrulanmış personeli ve iş ortaklarıyla sınırlıdır.",
      back: "Ana sayfaya dön",
    },
    v2: {
      // ⚠️ "Doktorlar İçin" — "Hekim" DEĞİL (v4.21 proje-geneli rename).
      nav: {
        care: "Bakım",
        how: "Nasıl Çalışır",
        trust: "Güven ve Gizlilik",
        clinicians: "Doktorlar İçin",
        cta: "Bakım yolculuğunu başlat",
      },
      hero: {
        eyebrow: "Sınır ötesi dijital bakım",
        headline: "Bakım, sınırların ötesinde.",
        lede: "Doğru uzmanla buluşun, seçeneklerinizi anlayın ve bakımınıza bulunduğunuz yerden devam edin — ilk değerlendirmeden takibe kadar çok dilli destekle.",
        ctaPrimary: "Bakım yolculuğunu başlat",
        ctaSecondary: "AURA nasıl çalışır?",
        safety: "Tıbbi kararları yetkili sağlık profesyonelleri verir. AURA değerlendirme, koordinasyon ve iletişimi destekler.",
      },
      entry: {
        eyebrow: "Bugün neye ihtiyacınız varsa oradan başlayın",
        headline: "Tek bakım yolculuğu. Başlamanın dört yolu.",
        intro: "AURA sonraki adımları sizin etrafınızda düzenler.",
        cards: [
          {
            key: "consult",
            n: "01",
            title: "Doktorla Görüşün",
            body: "Şikayetinizi kendi dilinizde anlatın. AURA vakanızı hazırlar ve uygun branşa yönlendirir.",
            cta: "Değerlendirmeye başla",
          },
          {
            key: "so",
            n: "02",
            title: "İkinci Görüş",
            body: "Tanınızı, görüntülemenizi veya tedavi planınızı bağımsız bir uzmana inceletin.",
            cta: "Vakamı hazırla",
          },
          {
            key: "tourism",
            n: "03",
            title: "Sağlık Turizmi",
            body: "Türkiye'de tedaviyi ancak klinik değerlendirmeden sonra keşfedin — seyahat, fiyat veya rezervasyon onaylanmadan önce.",
            cta: "Tedavi seçeneklerini keşfet",
          },
          {
            key: "freecare",
            n: "04",
            // TR'de urun/hukuki ad korunur (v4.21); "Access Care" YALNIZ EN.
            title: "Ücretsiz Sağlık Hizmeti",
            body: "Mesafe, maliyet veya erişim sizinle bakım arasına girdiğinde ücretsiz, destekli görüşme için başvurun.",
            cta: "Destek için başvur",
          },
        ],
      },
      ai: {
        eyebrow: "Yapay zekânın durduğu yer",
        headline: "AI hazırlar. Kararı doktor verir.",
        intro: "AURA yapay zekâyı dar bir iş için, sizin kontrol ettiğiniz bir rıza kapısının ardında kullanır.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "Karar doktorunuzundur",
            body: "Yapay zekâ bir tanıya işlem önerdiğinde, doktorunuz bunu “endikatif” etiketiyle görür — ve kararı verir.",
          },
          {
            key: "consent",
            n: "02",
            title: "AI işlemesinin ayrı rızası var",
            body: "Genel veri koruma onamından ayrı; tek bir semptom yazmadan önce sorulur. Siz vermeden form açılmaz.",
          },
          {
            key: "minimize",
            n: "03",
            title: "Adınız AI sağlayıcısına hiç ulaşmaz",
            body: "Klinik içerik yapay zekânın işidir, gönderilir. Adınız o iş için gerekli değildir — istek bizden çıkmadan önce değiştirilir, doktorunuzun okuduğu metinde geri konur.",
          },
          {
            key: "scope",
            n: "04",
            title: "Dar bir görev",
            body: "Sizi doğru branşa yönlendirmek ve yüklediğiniz belgeleri çevirmek. Kapsam bu kadar.",
          },
        ],
        note: {
          label: "Neyi iddia etmiyoruz",
          text: "Yapay zekâ tanı koymaz, tedavi seçmez, klinik yargı üretmez. Gördüğünüz AI çıktısı endikatiftir — doktorunuzun kararının yerine geçmez, ona bağlam olur.",
        },
      },
      accessibility: {
        eyebrow: "Erişilebilirlik",
        headline: "Görünür değil, kullanılabilir olsun diye.",
        intro: "Diliniz, okuma yönünüz, hareket tercihiniz — cihazınızdan okunur, size iki kez sorulmaz.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "Sekiz dil, ikisi sağdan sola",
            body: "Arapça ve Farsça yalnız metni değil, düzenin tamamını aynalar.",
          },
          {
            key: "motion",
            n: "02",
            title: "Cihazınızdan az hareket istediyseniz, dinleriz",
            body: "Sinematik açılış hafifletilmez — hiç kurulmaz. Her şey okunur kalır, kaydırma normal çalışır.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "Klavye sonradan eklenmiş bir şey değil",
            body: "Kartlar yalnız fareyle üzerine gelmeye değil, klavye odağına da yanıt verir.",
          },
          {
            key: "resilience",
            n: "04",
            title: "Kodumuz çökerse, kelimeler kalır",
            body: "Metin, hiçbir animasyon çalışmadan önce sayfadadır.",
          },
        ],
        note: {
          label: "Neyi iddia etmiyoruz",
          text: "WCAG uyumluluk beyanımız yok — bağımsız erişilebilirlik denetiminden geçmedik. AURA yazısının altındaki Braille işareti görsel bir marka öğesidir; Braille cihazı veya ekran okuyucu desteği anlamına gelmez.",
        },
      },
    },

    trustPage: {
      eyebrow: "güven",
      word: "AURA",
      // wordAfter boş: "'da" eki letterform'dan ~12px kopuk çizilirdi ("AURA 'da").
      wordBefore: "",
      wordAfter: "",
      lineAfter: "Güven ve gizlilik.",
      sub: "AURA'da güven bir pazarlama vaadi değil, üründe gösterilebilen bir şey. Aşağıda her başlıkta ne yaptığımızı, neyi henüz yapmadığımızı ve neyin bize bağlı olmadığını ayrı yazdık.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "Sağlık bilgileriniz nasıl korunur",
          body: "Verileriniz iletim sırasında şifrelenir; sunucuya kaydedilmeden önce ikinci kez, ayrı bir anahtarla şifrelenir. Yüklediğiniz rapor ve görüntüler depoya şifrelenmiş gider — depolama sağlayıcısı yalnız şifreli hâli görür. Verileriniz Avrupa Birliği'nde (Frankfurt) saklanır ve işlenir.",
          note: {
            label: "Neyi iddia etmiyoruz",
            text: "Bu bir \"uçtan uca şifreleme\" değildir. Anahtar bizim sunucumuzda yönetilir — çünkü klinik özet, tercüme ve doktor görünümü verinin sunucuda işlenmesini gerektirir. Gerçekten uçtan uca şifreli bir sistem bu işlevleri veremez.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "Rıza ve yapay zeka",
          body: "Üç ayrı rıza alınır, biri diğerinin yerine geçmez: genel KVKK açık rızası · şikayetin AI ile ön değerlendirilmesi · görüşmenin AI ile simültane tercümesi. Her rızada onayladığınız metnin birebir kendisi, onay anınız ve sonradan değiştirilmediğini gösteren zincir saklanır. Rıza vermeden adım başlamaz — form açılmaz, kamera izni istenmez. Kendi rıza kaydınızı istediğiniz an görüntüleyebilirsiniz.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "Kim neye erişir",
          body: "Erişim role bağlıdır: hasta yalnız kendi kayıtlarına · doktor yalnız doğrulanmış ve vakaya atanmışsa · partner doktor hasta veritabanına erişemez, kendisine iletilen soruda kişi adları maskelenir · koordinatör ve acente lojistik bilgi görür, klinik kayıt değil. Post-op takibiniz bitince klinik personelin erişimi kapanır, kayıt yalnız size kalır; isterseniz yeniden açarsınız.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "Doktor doğrulaması",
          body: "Bir doktor görünür olmadan ve hasta ataması almadan önce mesleki belgelerini yükler — diploma, uzmanlık belgesi ve mesleki sorumluluk sigortası — ve bunlar incelenip onaylanır. Onaylanmamış doktorun profili yayında olmaz.",
          note: {
            label: "Neyi iddia etmiyoruz",
            text: "\"Akredite doktor\" demiyoruz — doğruladığımız şey belgelerin varlığı ve geçerliliğidir.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "Video, belgeler ve paylaşım",
          body: "Görüşmeleriniz kaydedilmez. Video ve ses WebRTC ile şifrelenir; doğrudan bağlantı kurulamayınca devreye giren röle sunucusu yalnız şifreli trafiği taşır, içeriği göremez. Kayıtlarınızı paylaşırken hangi kategorilerin görüneceğini siz seçersiniz; süre koyabilir, şifre ekleyebilir, indirmeyi kapatabilir, linki istediğiniz an iptal edebilirsiniz. Her erişim kaydedilir.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "Denetim ve erişim geçmişi",
          body: "Klinik verinize yapılan anlamlı her erişim, sonradan silinip değiştirilemeyen bir zincire yazılır ve bağımsız doğrulanabilir.",
          note: {
            label: "Sınırı",
            text: "Denetim kaydı uygulamayı bloke etmeyecek şekilde tasarlandı — kayıt yazılamazsa işlem yine tamamlanır. Sinyalleşme gibi yüksek frekanslı teknik olaylar kasıtlı olarak kaydedilmez.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "Saklama ve silme",
          body: "Hesabınızı ve kişisel verilerinizi silebilirsiniz. Sildiğinizde e-posta, ad, telefon, profil ve bildirimleriniz gerçekten silinir; paylaşım linkleriniz iptal edilir ve giriş imkânsız hâle gelir. Sağlık kayıtlarınız yasal saklama süresi boyunca — 20 yıl — tutulmak zorundadır; ancak erişime kapanır (doktorlar, koordinatörler, yöneticiler ve siz dahil hiç kimse açamaz) ve süre dolunca otomatik olarak imha edilir. Bilerek saklanan iki şey var: onay kayıtlarınız, sakladığımız kaydın hukuki dayanağını ispatlar ve kayıtlarla birlikte imha edilir; erişim geçmişi ise değiştirilemez bir denetim zinciridir, kimlik verisi taşımaz ve silinmesi zinciri kırar.",
          note: {
            label: "Neyi iddia etmiyoruz",
            text: "Silme, anahtar imhası (\"crypto-shred\") ile değil, kaydın fiziken silinmesiyle yapılır.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "Uluslararası aktarım ve hizmet sağlayıcılar",
          body: "Saklama ve işleme Avrupa Birliği'nde (Frankfurt) gerçekleşir. AB dışına çıkan sınırlı durumlar:",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "Klinik sorumluluk",
          body: "Tanı, tedavi ve tıbbi kararlar yetkili sağlık profesyonellerine aittir. AURA değerlendirmeyi, koordinasyonu ve iletişimi destekler; hekimin yerine geçmez. İkinci görüş bağlayıcı değildir.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "Gizlilik veya güvenlik endişesi bildirin",
          body: "Verilerinizle ilgili bir endişeniz veya bir güvenlik bulgunuz varsa bize bildirin.",
          note: {
            label: "⚖️ Taslak",
            text: "Veri sorumlusunun iletişim adresi henüz yayımlanmadı; adres netleşince bu bölüm güncellenecek. O zamana kadar uydurma bir adres yazmıyoruz.",
          },
        },
      ],
      aiEmphasis: "Tıbbi karar yapay zekaya ait değildir: AURA bilgilerinizi düzenler, uygun branşı önerir; tanı ve tedavi kararını yetkili sağlık profesyonelleri verir.",
      transferItems: [
        "AI ön değerlendirme ve klinik özet (Anthropic, ABD): adınız gönderilmez — yer tutucu kullanılır; klinik içerik, görevin özü olduğu için gönderilir.",
        "Simültane tercüme (Google, ABD): görüşme sesi tercüme için işlenir, ayrı açık rızaya tabidir; rıza vermezseniz çalışmaz.",
        "Bağlantı rölesi (Cloudflare): yalnız şifreli medya taşır.",
        "Sinyalleşme (Ably) ve hız sınırlama (Upstash): sağlık verisi gönderilmez.",
      ],
    },
    hiw: {
      eyebrow: "rehber",
      word: "AURA",
      wordBefore: "",
      wordAfter: "",
      lineAfter: "nasıl çalışır?",
      sub: "Dört yolculuk, tek platform. Kayıttan görüşmeye her adım, aşağıda adım adım.",
      pick: "Yolculuğunuzu seçin",
      watch: "rehberi izle",
      step: "adım",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "Hesabınızı oluşturun", d: "Google, Apple veya e-posta ile dakikalar içinde kaydolun." },
            { t: "Ödemeyi tamamlayın", d: "Tek ve şeffaf ücret; kartla güvenle ödeyin." },
            { t: "Semptomlarınızı anlatın", d: "Kısa yönlendirmeli form; AURA paylaştıklarınızı düzenler." },
            { t: "Uzmana atanın", d: "Önerilen branştaki bir doktora yönlendirilirsiniz." },
            { t: "Dijital bekleme odasında bekleyin", d: "Sıranızı gerçek zamanlı takip edin." },
            { t: "Doktorunuzla görüntülü görüşün", d: "Şifreli video görüşme; notlar ve sonraki adımlar dosyanıza işlenir." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "Teşhisinizle başlayın", d: "Bir doktora göründünüz; elinizde bir teşhis ya da tedavi planı var." },
            { t: "AURA'ya girin", d: "İkinci Görüş akışını açın ve vakanızı oluşturun." },
            { t: "Dosyalarınızı yükleyin", d: "Raporlar, MR ve tahliller; güvenli ve gizli." },
            { t: "Hocayla görüşün", d: "Kıdemli akademik uzmanla görüntülü seans." },
            { t: "Yazılı raporunuzu alın", d: "Ayrıntılı, yapılandırılmış ikinci görüş raporu." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "Tedavinizi seçin", d: "Hollywood gülüşü, saç ekimi, estetik operasyon ya da medikal bir operasyon." },
            { t: "Türkiye'deki seçenekleri keşfedin", d: "Sağlık turizmi yetki belgeli klinikleri ve uzmanları vakanız için karşılaştırın." },
            { t: "Uzmanlarla görüşün", d: "Doktorlar ve sağlık danışmanlarıyla görüntülü tanışın." },
            { t: "Teklifinizi alın", d: "Tedavi, konaklama ve lojistiği kapsayan net bir paket." },
            { t: "Tam planla yola çıkın", d: "Uçuş, otel, operasyon ve sonrası; uçtan uca planlı." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "Şartları kontrol edin", d: "Uygunluk, yaşadığınız yere ve ihtiyaç duyduğunuz branşa göre belirlenir." },
            { t: "Online başvurun", d: "Durumunuzu özetleyen kısa bir başvuru." },
            { t: "Gönüllüyle eşleşin", d: "Doğru branştan gönüllü bir doktor vakanızı üstlenir." },
            { t: "Görüntülü görüşün", d: "Doktorunuz çevrimiçi olduğunda görüşme video ile yapılır." },
          ],
        },
      ],
    },
  },
  de: {
    nav: { telehealth: "Telemedizin", so: "Zweitmeinung", tourism: "Gesundheitstourismus", freecare: "Kostenlose Versorgung", how: "So funktioniert's", cta: "Arzt sprechen", menu: "Menü", close: "Menü schließen" },
    hero: {
      word: "AURA",
      l1: { a: "Telemedizin", mid: " und ", b: "Gesundheitstourismus", tail: "," },
      line2: "von Anfang bis Ende.",
      cta: "Arzt sprechen",
      scenes: "01/04 Szenen",
    },
    chapters: [
      { n: "01", key: "consult", strand: "telemedizin", title: "Sprechen Sie mit einem Arzt.", body: "AURA bereitet Ihren Fall auf und schlägt ein passendes Fachgebiet vor.", cta: "beratung starten", href: "/giris", external: false },
      { n: "02", key: "so", strand: "Zweitmeinung", title: "Ein zweites Paar Augen.", body: "Unabhängige Fachärzte prüfen Ihre Diagnose.", cta: "prüfung anfordern", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "gesundheitstourismus", title: "Gesundheitstourismus, geplant.", body: "Flug, Hotel, Operation und Nachsorge in einem Plan.", cta: "reise planen", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "kostenlose Versorgung", title: "Gesundheit ist ein Recht.", body: "Freiwillige Ärzte helfen, wenn Versorgung unerreichbar ist.", cta: "kostenlos bewerben", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Lernen Sie die Fachärzte kennen.",
      note: "Beispielkader aus unserem Demo-Netzwerk.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Kardiologie" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Neurologie" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Orthopädie" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatologie" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "IVF" },
      ],
    },
    trust: {
      headline: "Vertrauen ist Teil des Produkts",
      items: [
        { title: "Klare Einwilligung", desc: "Vor KI-gestützten Schritten wird Ihre Einwilligung mit dem freigegebenen Text, Zeitstempel und manipulationssicherer Kette erfasst." },
        { title: "Verschlüsselt bei Übertragung und Speicherung", desc: "Gesundheitsdaten werden bei der Übertragung verschlüsselt und vor der Speicherung erneut verschlüsselt." },
        { title: "Rollenbasierter Zugriff", desc: "Patienten, Ärzte, Koordinatoren und Partner sehen nur, was ihre Rolle erfordert." },
        { title: "Geprüfte Arzt-Registrierung", desc: "Berufsnachweise werden geprüft und freigegeben, bevor ein Arzt sichtbar wird." },
        { title: "Manipulationssicheres Zugriffsprotokoll", desc: "Zugriffe auf klinische Daten werden in eine unabhängig überprüfbare Kette geschrieben." },
        { title: "Erst Beurteilung, dann Zusagen", desc: "Preise und Reisearrangements folgen der klinischen Beurteilung — sie gehen ihr nie voraus." },
      ],
    },
    howItWorks: {
      headline: "So funktioniert es",
      note: "Vier Schritte, eine durchgehende Reise.",
      steps: [
        { title: "Erzählen Sie uns", desc: "Beschreiben Sie Ihre Beschwerden oder Ihr Ziel in Ihrer Sprache." },
        { title: "AURA bereitet Ihren Fall auf", desc: "Ihre Angaben werden geordnet und ein passendes Fachgebiet vorgeschlagen." },
        { title: "Videosprechstunde", desc: "Treffen Sie Ihren Arzt per verschlüsseltem Video mit Live-Dolmetschen." },
        { title: "Nachsorge", desc: "Berichte, Genesungskontrollen und Betreuung — alles von zu Hause." },
      ],
      safety: "Medizinische Entscheidungen treffen qualifizierte Fachkräfte. AURA unterstützt Beurteilung, Koordination und Kommunikation.",
      cta: "Zur vollständigen Anleitung",
    },
    closing: { headline: "Bereit, wenn Sie es sind.", cta: "Arzt sprechen" },
    footer: {
      platform: "Plattform", explore: "Entdecken", patientLogin: "Patienten-Login", patientSignup: "Patienten-Registrierung", corporateLogin: "Firmen-Login", doctorSignup: "Arzt-Registrierung", telehealth: "Telemedizin", tourism: "Gesundheitstourismus", doctors: "Fachärzte", trust: "Vertrauen und Datenschutz",
      legal: "© 2026 AURA. MVP-Demo, keine medizinische Beratung.",
    },
    signin: {
      word: "AURA", wordBefore: "Willkommen bei", wordAfter: "", lineAfter: "",
      sub: "Melden Sie sich an und beginnen Sie Ihre Behandlungsreise",
      google: "Weiter mit Google", apple: "Weiter mit Apple", email: "Weiter mit E-Mail", or: "ODER",
      legal: "Mit dem Fortfahren akzeptieren Sie die auf der Seite ",
      legalLink: "Vertrauen und Datenschutz",
      legalAfter: " dargelegten Grundsätze der Datenverarbeitung.",
      back: "Zurück zur Startseite",
    },
    corporate: {
      title: "AURA · Firmenzugang", word: "AURA", wordBefore: "", wordAfter: "", lineAfter: "Firmenzugang",
      sub: "Wählen Sie Ihre Rolle und fahren Sie mit dem Firmenportal fort.",
      roleLabel: "Anmelden als",
      roles: ["Arzt", "Partnerarzt", "Gesundheitsfachkraft", "Agenturbeauftragter Gesundheitstourismus", "Koordinator", "Ethikkommission"],
      continue: "Weiter zur Anmeldung",
      legal: "Der Firmenzugang ist auf verifizierte Mitarbeitende und Partner der Plattform beschränkt.",
      back: "Zurück zur Startseite",
    },
    v2: {
      nav: {
        care: "Versorgung",
        how: "So funktioniert es",
        trust: "Vertrauen & Datenschutz",
        clinicians: "Für Ärztinnen und Ärzte",
        cta: "Versorgung beginnen",
      },
      hero: {
        eyebrow: "Grenzüberschreitende digitale Versorgung",
        headline: "Versorgung, ohne Grenzen.",
        lede: "Finden Sie die richtige Fachärztin oder den richtigen Facharzt, verstehen Sie Ihre Optionen und setzen Sie Ihre Versorgung fort, wo immer Sie sind — mit mehrsprachiger Unterstützung von der ersten Einschätzung bis zur Nachsorge.",
        ctaPrimary: "Versorgung beginnen",
        ctaSecondary: "So funktioniert AURA",
        safety: "Medizinische Entscheidungen treffen qualifizierte Gesundheitsfachkräfte. AURA unterstützt Bewertung, Koordination und Kommunikation.",
      },
      entry: {
        eyebrow: "Beginnen Sie mit dem, was Sie heute brauchen",
        headline: "Eine Versorgung. Vier Wege, zu beginnen.",
        intro: "AURA ordnet die nächsten Schritte um Sie herum.",
        cards: [
          {
            key: "consult",
            n: "01",
            title: "Mit einer Ärztin sprechen",
            body: "Schildern Sie Ihr Anliegen in Ihrer eigenen Sprache. AURA bereitet Ihren Fall auf und leitet Sie zum passenden Fachgebiet.",
            cta: "Einschätzung starten",
          },
          {
            key: "so",
            n: "02",
            title: "Zweitmeinung",
            body: "Lassen Sie Diagnose, Aufnahme oder Behandlungsplan von unabhängigen Fachleuten prüfen.",
            cta: "Meinen Fall vorbereiten",
          },
          {
            key: "tourism",
            n: "03",
            title: "Gesundheitstourismus",
            body: "Behandlung in der Türkei erst nach klinischer Prüfung erkunden — bevor Reise, Preis oder Reservierung bestätigt werden.",
            cta: "Behandlungsoptionen erkunden",
          },
          {
            key: "freecare",
            n: "04",
            title: "Kostenlose Versorgung",
            body: "Beantragen Sie kostenlose, unterstützte Beratungen, wenn Entfernung, Kosten oder Zugang zwischen Ihnen und der Versorgung stehen.",
            cta: "Unterstützung beantragen",
          },
        ],
      },
      ai: {
        eyebrow: "Wo KI aufhört",
        headline: "KI bereitet vor. Ärztinnen und Ärzte entscheiden.",
        intro: "AURA setzt KI für eine eng umrissene Aufgabe ein — hinter einer Einwilligung, die Sie steuern.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "Die Entscheidung trifft Ihre Ärztin oder Ihr Arzt",
            body: "Schlägt die KI zu einer Diagnose einen Eingriff vor, sieht Ihre Ärztin oder Ihr Arzt diesen als „indikativ“ gekennzeichnet — und entscheidet.",
          },
          {
            key: "consent",
            n: "02",
            title: "Die KI-Verarbeitung hat ihre eigene Einwilligung",
            body: "Getrennt von der allgemeinen Datenschutzeinwilligung und erfragt, bevor Sie ein einziges Symptom beschreiben. Bis Sie sie erteilen, öffnet sich das Formular nicht.",
          },
          {
            key: "minimize",
            n: "03",
            title: "Ihr Name erreicht den KI-Anbieter nie",
            body: "Klinische Inhalte sind die Aufgabe der KI und werden übermittelt. Ihr Name wird dafür nicht gebraucht — er wird ersetzt, bevor die Anfrage uns verlässt, und in dem, was Ihre Ärztin oder Ihr Arzt liest, wiederhergestellt.",
          },
          {
            key: "scope",
            n: "04",
            title: "Eine eng umrissene Aufgabe",
            body: "Sie zum richtigen Fachgebiet führen und die von Ihnen hochgeladenen Dokumente übersetzen. Das ist der Umfang.",
          },
        ],
        note: {
          label: "Was wir nicht behaupten",
          text: "Die KI stellt keine Diagnose, wählt keine Behandlung und bildet kein klinisches Urteil. Jede KI-Ausgabe, die Sie sehen, ist indikativ — sie informiert die ärztliche Entscheidung, ersetzt sie nicht.",
        },
      },
      accessibility: {
        eyebrow: "Barrierefreiheit",
        headline: "Gebaut, um nutzbar zu sein — nicht nur sichtbar.",
        intro: "Ihre Sprache, Ihre Leserichtung, Ihre Bewegungspräferenz — von Ihrem Gerät gelesen, nicht zweimal gefragt.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "Acht Sprachen, zwei von rechts nach links",
            body: "Arabisch und Persisch spiegeln das gesamte Layout, nicht nur den Text.",
          },
          {
            key: "motion",
            n: "02",
            title: "Wenn Sie Ihr Gerät um weniger Bewegung gebeten haben, hören wir zu",
            body: "Die filmische Eröffnung wird nicht abgeschwächt — sie wird gar nicht erst aufgebaut. Alles bleibt lesbar, das Scrollen bleibt normal.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "Die Tastatur ist kein nachträglicher Einfall",
            body: "Karten reagieren auf den Fokus, nicht nur auf eine schwebende Maus.",
          },
          {
            key: "resilience",
            n: "04",
            title: "Versagen unsere Skripte, bleiben die Worte",
            body: "Der Text steht auf der Seite, bevor irgendeine Animation läuft.",
          },
        ],
        note: {
          label: "Was wir nicht behaupten",
          text: "Wir erheben keinen Anspruch auf WCAG-Konformität — wir wurden nicht unabhängig geprüft. Das Braille-Zeichen unter dem AURA-Schriftzug ist ein visuelles Markenelement; es bedeutet keine Unterstützung für Braillezeilen oder Screenreader.",
        },
      },
    },

    trustPage: {
      eyebrow: "Vertrauen",
      word: "AURA",
      wordBefore: "Vertrauen und Datenschutz bei",
      wordAfter: "",
      lineAfter: "",
      sub: "Bei AURA ist Vertrauen kein Marketingversprechen, sondern etwas, das sich im Produkt zeigen lässt. Unter jeder Überschrift steht getrennt, was wir tun, was wir noch nicht tun und was nicht in unserer Hand liegt.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "Wie Ihre Gesundheitsdaten geschützt werden",
          body: "Ihre Daten werden bei der Übertragung verschlüsselt und vor dem Speichern ein zweites Mal mit einem separaten Schlüssel verschlüsselt. Hochgeladene Befunde und Bilder erreichen den Speicher bereits verschlüsselt — der Speicheranbieter sieht ausschließlich die verschlüsselte Form. Ihre Daten werden in der Europäischen Union (Frankfurt) gespeichert und verarbeitet.",
          note: {
            label: "Was wir nicht behaupten",
            text: "Dies ist keine „Ende-zu-Ende-Verschlüsselung\". Der Schlüssel wird auf unseren Servern verwaltet — denn klinische Zusammenfassung, Dolmetschen und die Arztansicht setzen voraus, dass die Daten auf dem Server verarbeitet werden. Ein wirklich Ende-zu-Ende verschlüsseltes System könnte diese Funktionen nicht bieten.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "Einwilligung und künstliche Intelligenz",
          body: "Es werden drei getrennte Einwilligungen eingeholt, von denen keine die andere ersetzt: allgemeine Datenschutzeinwilligung · KI-Vorbewertung Ihres Anliegens · KI-Simultandolmetschen Ihres Gesprächs. Zu jeder Einwilligung speichern wir den exakten Text, den Sie bestätigt haben, den Zeitpunkt der Bestätigung und eine Kette, die belegt, dass er seither nicht verändert wurde. Ohne Einwilligung beginnt kein Schritt — das Formular öffnet sich nicht, die Kameraerlaubnis wird nicht angefragt. Ihren eigenen Einwilligungsnachweis können Sie jederzeit einsehen.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "Wer was sehen kann",
          body: "Der Zugriff richtet sich nach der Rolle: Patientinnen und Patienten sehen nur ihre eigenen Unterlagen · eine Ärztin oder ein Arzt nur, wenn verifiziert und dem Fall zugewiesen · eine Partnerärztin oder ein Partnerarzt hat überhaupt keinen Zugriff auf die Patientendatenbank, und in der weitergeleiteten Frage werden Personennamen maskiert · Koordination und Agentur sehen Logistik, keine klinischen Unterlagen. Endet Ihre postoperative Nachsorge, schließt sich der Zugang des klinischen Personals und die Unterlagen bleiben allein bei Ihnen; auf Wunsch öffnen Sie sie wieder.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "Ärztliche Verifizierung",
          body: "Bevor eine Ärztin oder ein Arzt sichtbar wird oder eine Zuweisung erhält, werden die Berufsnachweise hochgeladen — Approbation, Facharztnachweis und Berufshaftpflichtversicherung — und geprüft und freigegeben. Das Profil einer nicht freigegebenen Ärztin oder eines nicht freigegebenen Arztes wird nie veröffentlicht.",
          note: {
            label: "Was wir nicht behaupten",
            text: "Wir sagen nicht „akkreditierte Ärztin\" oder „akkreditierter Arzt\" — geprüft wird das Vorliegen und die Gültigkeit der Nachweise.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "Video, Dokumente und Freigaben",
          body: "Ihre Gespräche werden nicht aufgezeichnet. Video und Ton werden mit WebRTC verschlüsselt; kommt keine direkte Verbindung zustande, überträgt der einspringende Relay-Server ausschließlich verschlüsselten Verkehr und kann den Inhalt nicht sehen. Beim Teilen Ihrer Unterlagen wählen Sie, welche Kategorien sichtbar sind; Sie können eine Frist setzen, ein Passwort ergänzen, das Herunterladen deaktivieren und den Link jederzeit widerrufen. Jeder Zugriff wird protokolliert.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "Protokoll und Zugriffshistorie",
          body: "Jeder relevante Zugriff auf Ihre klinischen Daten wird in eine Kette geschrieben, die später weder gelöscht noch verändert werden kann und unabhängig überprüfbar ist.",
          note: {
            label: "Die Grenze",
            text: "Das Protokoll ist so ausgelegt, dass es die Anwendung nicht blockiert — lässt sich ein Eintrag nicht schreiben, wird der Vorgang dennoch abgeschlossen. Hochfrequente technische Ereignisse wie die Signalisierung werden bewusst nicht protokolliert.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "Aufbewahrung und Löschung",
          body: "Sie können Ihr Konto und Ihre personenbezogenen Daten löschen. Dabei werden E-Mail, Name, Telefonnummer, Profil und Benachrichtigungen tatsächlich gelöscht, Ihre Freigabelinks widerrufen und eine Anmeldung wird unmöglich. Ihre Gesundheitsunterlagen müssen für die gesetzliche Aufbewahrungsfrist von 20 Jahren aufbewahrt werden — sie werden jedoch für den Zugriff geschlossen (niemand kann sie öffnen: weder Ärztinnen und Ärzte noch Koordination, Verwaltung oder Sie selbst) und nach Ablauf der Frist automatisch vernichtet. Zwei Dinge bleiben bewusst erhalten: Ihre Einwilligungsnachweise, die die Rechtsgrundlage des Aufbewahrten belegen und gemeinsam mit den Unterlagen vernichtet werden, sowie die Zugriffshistorie — eine manipulationssichere Kette, die keine Identifikationsdaten enthält und deren Löschung die Kette brechen würde.",
          note: {
            label: "Was wir nicht behaupten",
            text: "Die Löschung erfolgt nicht durch Vernichtung eines Schlüssels („Crypto-Shredding\"), sondern durch physisches Löschen des Datensatzes.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "Internationale Übermittlung und Dienstleister",
          body: "Speicherung und Verarbeitung finden in der Europäischen Union (Frankfurt) statt. Die begrenzten Fälle, die die EU verlassen:",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "Klinische Verantwortung",
          body: "Diagnose, Behandlung und medizinische Entscheidungen liegen bei qualifizierten Gesundheitsfachkräften. AURA unterstützt Bewertung, Koordination und Kommunikation; es ersetzt Ihre Ärztin oder Ihren Arzt nicht. Eine Zweitmeinung ist nicht bindend.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "Datenschutz- oder Sicherheitsbedenken melden",
          body: "Wenn Sie Bedenken zu Ihren Daten oder einen Sicherheitsbefund haben, teilen Sie es uns mit.",
          note: {
            label: "⚖️ Entwurf",
            text: "Die Kontaktadresse des Verantwortlichen ist noch nicht veröffentlicht; sobald sie feststeht, wird dieser Abschnitt aktualisiert. Bis dahin erfinden wir keine Adresse.",
          },
        },
      ],
      aiEmphasis: "Die medizinische Entscheidung gehört nicht der künstlichen Intelligenz: AURA ordnet Ihre Angaben und schlägt ein passendes Fachgebiet vor; Diagnose und Behandlungsentscheidung treffen qualifizierte Gesundheitsfachkräfte.",
      transferItems: [
        "KI-Vorbewertung und klinische Zusammenfassung (Anthropic, USA): Ihr Name wird nicht übermittelt — es wird ein Platzhalter verwendet; der klinische Inhalt wird übermittelt, weil er der Kern der Aufgabe ist.",
        "Simultandolmetschen (Google, USA): der Ton Ihres Gesprächs wird zum Dolmetschen verarbeitet und unterliegt einer gesonderten ausdrücklichen Einwilligung; ohne diese Einwilligung läuft es nicht.",
        "Verbindungs-Relay (Cloudflare): überträgt ausschließlich verschlüsselte Medien.",
        "Signalisierung (Ably) und Ratenbegrenzung (Upstash): es werden keine Gesundheitsdaten übermittelt.",
      ],
    },
    hiw: {
      eyebrow: "Leitfaden",
      word: "AURA",
      wordBefore: "So funktioniert",
      wordAfter: "",
      lineAfter: "",
      sub: "Vier Wege, eine Plattform. Jeder Schritt von der Registrierung bis zum Gespräch, hier erklärt.",
      pick: "Wählen Sie Ihren Weg",
      watch: "Anleitung ansehen",
      step: "Schritt",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "Konto erstellen", d: "In Minuten registrieren, mit Google, Apple oder E-Mail." },
            { t: "Zahlung abschließen", d: "Eine transparente Gebühr, sicher per Karte bezahlt." },
            { t: "Symptome beschreiben", d: "Ein kurzes geführtes Formular; AURA ordnet Ihre Angaben." },
            { t: "Einem Facharzt zugewiesen", d: "Sie werden einem Arzt im vorgeschlagenen Fachgebiet zugeteilt." },
            { t: "Im digitalen Wartezimmer", d: "Verfolgen Sie Ihren Platz in Echtzeit." },
            { t: "Videogespräch mit dem Arzt", d: "Verschlüsselter Videotermin; Notizen und nächste Schritte in Ihrer Akte." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "Mit einer Diagnose starten", d: "Sie waren beim Arzt und haben eine Diagnose oder einen Behandlungsplan." },
            { t: "AURA öffnen", d: "Starten Sie den Zweitmeinungs-Ablauf und legen Sie Ihren Fall an." },
            { t: "Unterlagen hochladen", d: "Befunde, MRT und Laborwerte, sicher und vertraulich." },
            { t: "Mit dem Professor sprechen", d: "Videositzung mit einem erfahrenen akademischen Spezialisten." },
            { t: "Schriftlichen Bericht erhalten", d: "Ein detaillierter, strukturierter Zweitmeinungsbericht." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "Behandlung wählen", d: "Hollywood-Lächeln, Haartransplantation, ästhetische Chirurgie oder eine medizinische Operation." },
            { t: "Optionen in der Türkei entdecken", d: "Vergleichen Sie für den Gesundheitstourismus zugelassene Kliniken und Spezialisten." },
            { t: "Mit Spezialisten sprechen", d: "Lernen Sie Ärzte und Gesundheitsberater per Video kennen." },
            { t: "Angebot erhalten", d: "Ein klares Paket für Behandlung, Aufenthalt und Logistik." },
            { t: "Mit komplettem Plan reisen", d: "Flug, Hotel, Eingriff und Nachsorge, von Anfang bis Ende geplant." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "Kriterien prüfen", d: "Die Berechtigung richtet sich nach Wohnort und benötigtem Fachgebiet." },
            { t: "Online bewerben", d: "Eine kurze Bewerbung mit den Grundzügen Ihrer Situation." },
            { t: "Freiwilligen Arzt erhalten", d: "Ein freiwilliger Arzt im richtigen Fachgebiet übernimmt Ihren Fall." },
            { t: "Per Video treffen", d: "Ist Ihr Arzt online, findet der Termin als Videogespräch statt." },
          ],
        },
      ],
    },
  },
  fr: {
    nav: { telehealth: "Télésanté", so: "Deuxième avis", tourism: "Tourisme médical", freecare: "Soins gratuits", how: "Comment ça marche", cta: "Consulter un médecin", menu: "Menu", close: "Fermer le menu" },
    hero: {
      word: "AURA",
      l1: { a: "Télésanté", mid: " et ", b: "Tourisme médical", tail: "," },
      line2: "de bout en bout.",
      cta: "Consulter un médecin",
      scenes: "01/04 scènes",
    },
    chapters: [
      { n: "01", key: "consult", strand: "télésanté", title: "Parlez à un médecin.", body: "AURA prépare votre dossier et propose une spécialité appropriée.", cta: "démarrer la consultation", href: "/giris", external: false },
      { n: "02", key: "so", strand: "Deuxième avis", title: "Un deuxième regard d'expert.", body: "Des spécialistes indépendants réévaluent votre diagnostic.", cta: "demander un examen", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "tourisme médical", title: "Tourisme médical, planifié.", body: "Vol, hôtel, chirurgie et suivi dans un seul plan.", cta: "planifier mon voyage", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "soins gratuits", title: "La santé est un droit.", body: "Des médecins bénévoles interviennent quand les soins sont hors de portée.", cta: "demander des soins gratuits", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Rencontrez les spécialistes.",
      note: "Effectif d'exemple de notre réseau de démonstration.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Cardiologie" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Neurologie" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Orthopédie" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatologie" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "FIV" },
      ],
    },
    trust: {
      headline: "La confiance fait partie du produit",
      items: [
        { title: "Consentement explicite", desc: "Avant les étapes assistées par IA, votre consentement est enregistré avec le texte approuvé, un horodatage et une chaîne inviolable." },
        { title: "Chiffré en transit et au repos", desc: "Les données de santé sont chiffrées en transit puis chiffrées à nouveau avant stockage." },
        { title: "Accès selon le rôle", desc: "Patients, médecins, coordinateurs et partenaires ne voient que ce que leur rôle exige." },
        { title: "Inscription vérifiée des médecins", desc: "Les documents professionnels sont examinés et approuvés avant qu'un médecin soit visible." },
        { title: "Journal d'accès inviolable", desc: "Chaque accès aux données cliniques est inscrit dans une chaîne vérifiable de façon indépendante." },
        { title: "L'évaluation avant les engagements", desc: "Les tarifs et les modalités de voyage suivent l'évaluation clinique — jamais l'inverse." },
      ],
    },
    howItWorks: {
      headline: "Comment ça marche",
      note: "Quatre étapes, un parcours continu.",
      steps: [
        { title: "Expliquez-nous", desc: "Décrivez vos symptômes ou votre objectif dans votre langue." },
        { title: "AURA prépare votre dossier", desc: "Vos informations sont organisées et une spécialité appropriée est proposée." },
        { title: "Consultation vidéo", desc: "Rencontrez votre médecin en vidéo chiffrée, avec interprétation en direct." },
        { title: "Suivi", desc: "Comptes rendus, contrôles de récupération et soins — depuis chez vous." },
      ],
      safety: "Les décisions médicales sont prises par des professionnels de santé qualifiés. AURA soutient l'évaluation, la coordination et la communication.",
      cta: "Voir le parcours complet",
    },
    closing: { headline: "Prêts quand vous l'êtes.", cta: "Consulter un médecin" },
    footer: {
      platform: "Plateforme", explore: "Explorer", patientLogin: "Connexion patient", patientSignup: "Inscription patient", corporateLogin: "Connexion professionnelle", doctorSignup: "Inscription médecin", telehealth: "Télésanté", tourism: "Tourisme médical", doctors: "Spécialistes", trust: "Confiance et confidentialité",
      legal: "© 2026 AURA. Démo MVP, ne constitue pas un avis médical.",
    },
    signin: {
      word: "AURA", wordBefore: "Bienvenue chez", wordAfter: "", lineAfter: "",
      sub: "Connectez-vous pour commencer votre parcours de soins",
      google: "Continuer avec Google", apple: "Continuer avec Apple", email: "Continuer avec l'e-mail", or: "OU",
      legal: "En continuant, vous acceptez les principes de traitement des données exposés sur la page ",
      legalLink: "Confiance et confidentialité",
      legalAfter: ".",
      back: "Retour à l'accueil",
    },
    corporate: {
      title: "AURA · Connexion professionnelle", word: "AURA", wordBefore: "", wordAfter: "", lineAfter: "Connexion professionnelle",
      sub: "Sélectionnez votre rôle et continuez vers le portail professionnel.",
      roleLabel: "Se connecter en tant que",
      roles: ["Médecin", "Médecin partenaire", "Professionnel de santé", "Agent d'agence de tourisme médical", "Coordinateur", "Comité d'éthique"],
      continue: "Continuer vers la connexion",
      legal: "L'accès professionnel est réservé au personnel vérifié et aux partenaires de la plateforme.",
      back: "Retour à l'accueil",
    },
    v2: {
      nav: {
        care: "Soins",
        how: "Comment ça marche",
        trust: "Confiance & confidentialité",
        clinicians: "Pour les cliniciens",
        cta: "Commencer mes soins",
      },
      hero: {
        eyebrow: "Soins numériques transfrontaliers",
        headline: "Des soins, sans frontières.",
        lede: "Rencontrez le bon spécialiste, comprenez vos options et poursuivez vos soins où que vous soyez — avec un accompagnement multilingue, de la première évaluation au suivi.",
        ctaPrimary: "Commencer mes soins",
        ctaSecondary: "Comment fonctionne AURA",
        safety: "Les décisions médicales relèvent des professionnels de santé qualifiés. AURA soutient l'évaluation, la coordination et la communication.",
      },
      entry: {
        eyebrow: "Commencez par ce dont vous avez besoin aujourd'hui",
        headline: "Un parcours de soins. Quatre façons de commencer.",
        intro: "AURA organise les prochaines étapes autour de vous.",
        cards: [
          {
            key: "consult",
            n: "01",
            title: "Parler à un médecin",
            body: "Décrivez votre problème dans votre langue. AURA prépare votre dossier et vous oriente vers la spécialité appropriée.",
            cta: "Commencer une évaluation",
          },
          {
            key: "so",
            n: "02",
            title: "Deuxième avis",
            body: "Faites examiner un diagnostic, une imagerie ou un plan de traitement par un spécialiste indépendant.",
            cta: "Préparer mon dossier",
          },
          {
            key: "tourism",
            n: "03",
            title: "Tourisme médical",
            body: "Explorez un traitement en Türkiye uniquement après examen clinique — avant toute confirmation de voyage, de prix ou de réservation.",
            cta: "Explorer les options de traitement",
          },
          {
            key: "freecare",
            n: "04",
            title: "Soins solidaires",
            body: "Demandez des consultations gratuites et accompagnées lorsque la distance, le coût ou l'accès vous séparent des soins.",
            cta: "Demander un accompagnement",
          },
        ],
      },
      ai: {
        eyebrow: "Là où l'IA s'arrête",
        headline: "L'IA prépare. Le médecin décide.",
        intro: "AURA utilise l'IA pour une tâche restreinte, derrière un consentement que vous contrôlez.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "La décision revient à votre médecin",
            body: "Lorsque l'IA propose un acte pour un diagnostic, votre médecin le voit signalé comme indicatif — et décide.",
          },
          {
            key: "consent",
            n: "02",
            title: "Le traitement par l'IA a son propre consentement",
            body: "Distinct du consentement général à la protection des données, et demandé avant que vous ne décriviez le moindre symptôme. Tant que vous ne l'avez pas donné, le formulaire ne s'ouvre pas.",
          },
          {
            key: "minimize",
            n: "03",
            title: "Votre nom n'atteint jamais le fournisseur d'IA",
            body: "Le contenu clinique est la tâche de l'IA : il est transmis. Votre nom n'est pas nécessaire à cette tâche — il est remplacé avant que la requête ne nous quitte, et rétabli dans ce que lit votre médecin.",
          },
          {
            key: "scope",
            n: "04",
            title: "Une tâche restreinte",
            body: "Vous orienter vers la bonne spécialité et traduire les documents que vous déposez. Voilà le périmètre.",
          },
        ],
        note: {
          label: "Ce que nous ne prétendons pas",
          text: "L'IA ne pose pas de diagnostic, ne choisit pas de traitement et ne produit pas de jugement clinique. Toute sortie d'IA que vous voyez est indicative — elle éclaire la décision de votre médecin, elle ne la remplace pas.",
        },
      },
      accessibility: {
        eyebrow: "Accessibilité",
        headline: "Conçu pour être utilisable, pas seulement visible.",
        intro: "Votre langue, votre sens de lecture, votre préférence de mouvement — lus depuis votre appareil, sans vous le demander deux fois.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "Huit langues, deux se lisent de droite à gauche",
            body: "L'arabe et le persan reflètent toute la mise en page, pas seulement le texte.",
          },
          {
            key: "motion",
            n: "02",
            title: "Si vous avez demandé moins de mouvement à votre appareil, nous écoutons",
            body: "L'ouverture cinématographique n'est pas atténuée — elle n'est pas construite du tout. Tout reste lisible, le défilement reste normal.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "Le clavier n'est pas une arrière-pensée",
            body: "Les cartes répondent au focus, pas seulement à une souris qui survole.",
          },
          {
            key: "resilience",
            n: "04",
            title: "Si nos scripts échouent, les mots restent",
            body: "Le texte est dans la page avant que la moindre animation ne s'exécute.",
          },
        ],
        note: {
          label: "Ce que nous ne prétendons pas",
          text: "Nous ne revendiquons aucune conformité WCAG — nous n'avons pas fait l'objet d'un audit indépendant. Le signe braille sous le logotype AURA est un élément visuel de marque ; il ne signifie pas la prise en charge des plages braille ou des lecteurs d'écran.",
        },
      },
    },

    trustPage: {
      eyebrow: "confiance",
      word: "AURA",
      wordBefore: "Confiance et confidentialité chez",
      wordAfter: "",
      lineAfter: "",
      sub: "Chez AURA, la confiance n'est pas une promesse marketing : c'est quelque chose que l'on peut montrer dans le produit. Sous chaque titre, nous indiquons séparément ce que nous faisons, ce que nous ne faisons pas encore et ce qui ne dépend pas de nous.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "Comment vos données de santé sont protégées",
          body: "Vos données sont chiffrées pendant leur transmission, puis chiffrées une seconde fois avec une clé distincte avant d'être enregistrées sur nos serveurs. Les comptes rendus et images que vous téléversez arrivent déjà chiffrés dans le stockage — le prestataire de stockage n'en voit jamais que la forme chiffrée. Vos données sont conservées et traitées dans l'Union européenne (Francfort).",
          note: {
            label: "Ce que nous ne prétendons pas",
            text: "Il ne s'agit pas d'un « chiffrement de bout en bout ». La clé est gérée sur nos serveurs — car le résumé clinique, l'interprétation et la vue du médecin exigent que les données soient traitées côté serveur. Un système réellement chiffré de bout en bout ne pourrait pas offrir ces fonctions.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "Consentement et intelligence artificielle",
          body: "Trois consentements distincts sont recueillis, et aucun ne remplace l'autre : consentement général en matière de protection des données · pré-évaluation de votre demande par l'IA · interprétation simultanée de votre consultation par l'IA. Pour chacun, nous conservons le texte exact que vous avez approuvé, le moment de votre approbation et une chaîne montrant qu'il n'a pas été modifié depuis. Aucune étape ne commence sans consentement — le formulaire ne s'ouvre pas, l'autorisation de la caméra n'est pas demandée. Vous pouvez consulter votre propre preuve de consentement à tout moment.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "Qui voit quoi",
          body: "L'accès dépend du rôle : le patient ne voit que ses propres dossiers · un médecin uniquement s'il est vérifié et affecté au dossier · un médecin partenaire n'a aucun accès à la base de données patients, et les noms des personnes sont masqués dans la question qui lui est transmise · les coordinateurs et l'agence voient la logistique, pas le dossier clinique. Lorsque votre suivi postopératoire se termine, l'accès du personnel clinique se ferme et le dossier ne reste qu'à vous ; vous pouvez le rouvrir si vous le souhaitez.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "Vérification des médecins",
          body: "Avant qu'un médecin ne devienne visible ou ne reçoive une affectation, il téléverse ses justificatifs professionnels — diplôme, titre de spécialiste et assurance de responsabilité civile professionnelle — qui sont examinés et approuvés. Le profil d'un médecin non approuvé n'est jamais publié.",
          note: {
            label: "Ce que nous ne prétendons pas",
            text: "Nous ne disons pas « médecin accrédité » — ce que nous vérifions, c'est l'existence et la validité des documents.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "Vidéo, documents et partage",
          body: "Vos consultations ne sont pas enregistrées. La vidéo et l'audio sont chiffrés avec WebRTC ; lorsqu'une connexion directe ne peut être établie, le serveur relais qui prend le relais ne transporte que du trafic chiffré et ne peut pas en voir le contenu. Lorsque vous partagez vos dossiers, vous choisissez les catégories visibles ; vous pouvez fixer une échéance, ajouter un mot de passe, désactiver le téléchargement et révoquer le lien à tout instant. Chaque accès est journalisé.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "Journal et historique des accès",
          body: "Chaque accès significatif à vos données cliniques est inscrit dans une chaîne qui ne peut ensuite être ni supprimée ni modifiée, et qui peut être vérifiée de manière indépendante.",
          note: {
            label: "La limite",
            text: "Le journal est conçu pour ne pas bloquer l'application — si une entrée ne peut pas être écrite, l'opération aboutit tout de même. Les événements techniques à haute fréquence, comme la signalisation, ne sont délibérément pas journalisés.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "Conservation et suppression",
          body: "Vous pouvez supprimer votre compte et vos données personnelles. Dans ce cas, votre e-mail, votre nom, votre téléphone, votre profil et vos notifications sont réellement supprimés, vos liens de partage sont révoqués et la connexion devient impossible. Vos dossiers de santé doivent être conservés pendant la durée légale de conservation de 20 ans — mais ils sont fermés à tout accès (personne ne peut les ouvrir : ni les médecins, ni les coordinateurs, ni les administrateurs, ni vous) et sont détruits automatiquement à l'expiration de ce délai. Deux éléments sont conservés à dessein : vos preuves de consentement, qui établissent la base légale de ce que nous conservons et sont détruites avec les dossiers, et l'historique des accès, une chaîne infalsifiable qui ne contient aucune donnée d'identification et dont la suppression romprait la chaîne.",
          note: {
            label: "Ce que nous ne prétendons pas",
            text: "La suppression ne se fait pas par destruction d'une clé (« crypto-shredding ») mais par l'effacement physique de l'enregistrement.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "Transferts internationaux et prestataires",
          body: "La conservation et le traitement ont lieu dans l'Union européenne (Francfort). Les cas limités qui sortent de l'UE :",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "Responsabilité clinique",
          body: "Le diagnostic, le traitement et les décisions médicales relèvent des professionnels de santé qualifiés. AURA soutient l'évaluation, la coordination et la communication ; elle ne remplace pas votre médecin. Un deuxième avis n'a pas de valeur contraignante.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "Signaler une inquiétude de confidentialité ou de sécurité",
          body: "Si vous avez une inquiétude concernant vos données ou une découverte de sécurité, dites-le-nous.",
          note: {
            label: "⚖️ Projet",
            text: "L'adresse de contact du responsable de traitement n'est pas encore publiée ; cette section sera mise à jour dès qu'elle sera arrêtée. D'ici là, nous n'inventons pas d'adresse.",
          },
        },
      ],
      aiEmphasis: "La décision médicale n'appartient pas à l'intelligence artificielle : AURA organise vos informations et suggère une spécialité appropriée ; le diagnostic et la décision thérapeutique reviennent aux professionnels de santé qualifiés.",
      transferItems: [
        "Pré-évaluation par l'IA et résumé clinique (Anthropic, États-Unis) : votre nom n'est pas transmis — un espace réservé est utilisé ; le contenu clinique est transmis car il constitue l'objet même de la tâche.",
        "Interprétation simultanée (Google, États-Unis) : l'audio de votre consultation est traité à des fins d'interprétation, sous réserve d'un consentement explicite distinct ; sans ce consentement, la fonction ne s'exécute pas.",
        "Relais de connexion (Cloudflare) : ne transporte que des médias chiffrés.",
        "Signalisation (Ably) et limitation de débit (Upstash) : aucune donnée de santé n'est transmise.",
      ],
    },
    hiw: {
      eyebrow: "guide",
      word: "AURA",
      wordBefore: "Comment fonctionne",
      wordAfter: "",
      lineAfter: "",
      sub: "Quatre parcours, une plateforme. Chaque étape, de l'inscription à la consultation, expliquée ci-dessous.",
      pick: "Choisissez votre parcours",
      watch: "voir le guide",
      step: "étape",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "Créez votre compte", d: "Inscrivez-vous en quelques minutes avec Google, Apple ou e-mail." },
            { t: "Réglez le paiement", d: "Un tarif unique et transparent, payé en toute sécurité par carte." },
            { t: "Décrivez vos symptômes", d: "Un court formulaire guidé ; AURA organise ce que vous partagez." },
            { t: "Orienté vers un spécialiste", d: "Vous êtes affecté à un médecin de la spécialité proposée." },
            { t: "Salle d'attente numérique", d: "Suivez votre place en temps réel." },
            { t: "Consultation vidéo", d: "Visite vidéo chiffrée ; notes et prochaines étapes dans votre dossier." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "Partez d'un diagnostic", d: "Vous avez consulté un médecin et disposez d'un diagnostic ou d'un plan de traitement." },
            { t: "Entrez dans AURA", d: "Ouvrez le parcours Deuxième avis et créez votre dossier." },
            { t: "Téléversez vos documents", d: "Comptes rendus, IRM et analyses, en toute sécurité et confidentialité." },
            { t: "Rencontrez le professeur", d: "Séance vidéo avec un spécialiste académique confirmé." },
            { t: "Recevez un rapport écrit", d: "Un rapport de deuxième avis détaillé et structuré." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "Choisissez votre traitement", d: "Sourire hollywoodien, greffe de cheveux, chirurgie esthétique ou opération médicale." },
            { t: "Explorez les options en Türkiye", d: "Comparez cliniques autorisées pour le tourisme médical et spécialistes pour votre cas." },
            { t: "Parlez aux spécialistes", d: "Échangez en vidéo avec médecins et conseillers santé." },
            { t: "Recevez votre offre", d: "Un forfait clair : traitement, séjour et logistique." },
            { t: "Partez avec un plan complet", d: "Vol, hôtel, intervention et suivi, planifiés de bout en bout." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "Vérifiez les critères", d: "L'éligibilité dépend de votre lieu de résidence et de la spécialité requise." },
            { t: "Candidatez en ligne", d: "Une courte demande résumant votre situation." },
            { t: "Un médecin bénévole est affecté", d: "Un bénévole de la bonne spécialité prend votre cas." },
            { t: "Rendez-vous en vidéo", d: "Quand votre médecin est en ligne, la consultation se fait en vidéo." },
          ],
        },
      ],
    },
  },
  ru: {
    nav: { telehealth: "Телемедицина", so: "Второе мнение", tourism: "Медицинский туризм", freecare: "Бесплатная помощь", how: "Как это работает", cta: "Поговорить с врачом", menu: "Меню", close: "Закрыть меню" },
    hero: {
      word: "AURA",
      l1: { a: "Телемедицина", mid: " и ", b: "медицинский туризм", tail: "," },
      line2: "от начала до конца.",
      cta: "Поговорить с врачом",
      scenes: "01/04 сцены",
    },
    chapters: [
      { n: "01", key: "consult", strand: "телемедицина", title: "Поговорите с врачом.", body: "AURA готовит ваш случай и предлагает подходящую специальность.", cta: "начать консультацию", href: "/giris", external: false },
      { n: "02", key: "so", strand: "Второе мнение", title: "Свежий взгляд специалиста.", body: "Независимые врачи пересмотрят ваш диагноз.", cta: "запросить пересмотр", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "медицинский туризм", title: "Медицинский туризм — по плану.", body: "Перелёт, отель, операция и восстановление в одном плане.", cta: "спланировать поездку", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "бесплатная помощь", title: "Здоровье — это право.", body: "Врачи-волонтёры помогают, когда лечение недоступно.", cta: "подать заявку", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Познакомьтесь со специалистами.",
      note: "Примерный состав из нашей демо-сети.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Кардиология" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Неврология" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Ортопедия" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Дерматология" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "ЭКО" },
      ],
    },
    trust: {
      headline: "Доверие — часть продукта",
      items: [
        { title: "Явное согласие", desc: "Перед шагами с участием ИИ согласие фиксируется вместе с утверждённым текстом, отметкой времени и защищённой от подмены цепочкой." },
        { title: "Шифрование при передаче и хранении", desc: "Медицинские данные шифруются при передаче и повторно шифруются перед сохранением." },
        { title: "Доступ по роли", desc: "Пациенты, врачи, координаторы и партнёры видят только то, что требует их роль." },
        { title: "Проверка документов врача", desc: "Профессиональные документы проверяются и утверждаются до появления врача в системе." },
        { title: "Защищённый журнал доступа", desc: "Каждый доступ к клиническим данным записывается в цепочку, которую можно проверить независимо." },
        { title: "Сначала оценка, потом обязательства", desc: "Цены и организация поездки следуют за клинической оценкой — никогда не предшествуют ей." },
      ],
    },
    howItWorks: {
      headline: "Как это работает",
      note: "Четыре шага, один непрерывный путь.",
      steps: [
        { title: "Расскажите нам", desc: "Опишите симптомы или цель на своём языке." },
        { title: "AURA готовит ваш случай", desc: "Ваши данные упорядочиваются, и предлагается подходящая специальность." },
        { title: "Видеоконсультация", desc: "Встреча с врачом по зашифрованному видео с живым переводом." },
        { title: "Наблюдение", desc: "Отчёты, контроль восстановления и уход — всё из дома." },
      ],
      safety: "Медицинские решения принимают квалифицированные специалисты здравоохранения. AURA поддерживает оценку, координацию и общение.",
      cta: "Посмотреть весь процесс",
    },
    closing: { headline: "Мы готовы, когда готовы вы.", cta: "Поговорить с врачом" },
    footer: {
      platform: "Платформа", explore: "Обзор", patientLogin: "Вход для пациентов", patientSignup: "Регистрация пациента", corporateLogin: "Корпоративный вход", doctorSignup: "Регистрация врача", telehealth: "Телемедицина", tourism: "Медицинский туризм", doctors: "Специалисты", trust: "Доверие и конфиденциальность",
      legal: "© 2026 AURA. MVP-демо, не является медицинской рекомендацией.",
    },
    signin: {
      word: "AURA", wordBefore: "Добро пожаловать в", wordAfter: "", lineAfter: "",
      sub: "Войдите, чтобы начать путь к лечению",
      google: "Продолжить с Google", apple: "Продолжить с Apple", email: "Продолжить по эл. почте", or: "ИЛИ",
      legal: "Продолжая, вы принимаете принципы обработки данных, изложенные на странице ",
      legalLink: "Доверие и конфиденциальность",
      legalAfter: ".",
      back: "На главную",
    },
    corporate: {
      title: "AURA · Корпоративный вход", word: "AURA", wordBefore: "", wordAfter: "", lineAfter: "Корпоративный вход",
      sub: "Выберите свою роль и продолжите в корпоративный портал.",
      roleLabel: "Войти как",
      roles: ["Врач", "Врач-партнёр", "Медицинский специалист", "Сотрудник агентства медтуризма", "Координатор", "Этический совет"],
      continue: "Перейти ко входу",
      legal: "Корпоративный доступ предоставляется только проверенным сотрудникам и партнёрам платформы.",
      back: "На главную",
    },
    v2: {
      nav: {
        care: "Медицинская помощь",
        how: "Как это работает",
        trust: "Доверие и конфиденциальность",
        clinicians: "Для врачей",
        cta: "Начать заботу о себе",
      },
      hero: {
        eyebrow: "Трансграничная цифровая медицина",
        headline: "Забота без границ.",
        lede: "Найдите нужного специалиста, разберитесь в своих вариантах и продолжайте лечение, где бы вы ни были — с многоязычной поддержкой от первой оценки до наблюдения.",
        ctaPrimary: "Начать заботу о себе",
        ctaSecondary: "Как работает AURA",
        safety: "Медицинские решения принимают квалифицированные специалисты здравоохранения. AURA поддерживает оценку, координацию и общение.",
      },
      entry: {
        eyebrow: "Начните с того, что нужно вам сегодня",
        headline: "Один путь лечения. Четыре способа начать.",
        intro: "AURA выстраивает следующие шаги вокруг вас.",
        cards: [
          {
            key: "consult",
            n: "01",
            title: "Поговорить с врачом",
            body: "Опишите жалобу на своём языке. AURA подготовит ваш случай и направит к подходящей специальности.",
            cta: "Начать оценку",
          },
          {
            key: "so",
            n: "02",
            title: "Второе мнение",
            body: "Дайте независимому специалисту проверить диагноз, снимок или план лечения.",
            cta: "Подготовить мой случай",
          },
          {
            key: "tourism",
            n: "03",
            title: "Медицинский туризм",
            body: "Рассматривайте лечение в Турции только после клинической оценки — до подтверждения поездки, цены или брони.",
            cta: "Изучить варианты лечения",
          },
          {
            key: "freecare",
            n: "04",
            title: "Бесплатная помощь",
            body: "Подайте заявку на бесплатные консультации с поддержкой, когда расстояние, стоимость или доступ стоят между вами и лечением.",
            cta: "Обратиться за поддержкой",
          },
        ],
      },
      ai: {
        eyebrow: "Где ИИ останавливается",
        headline: "ИИ готовит. Решает врач.",
        intro: "AURA использует ИИ для узкой задачи — за согласием, которым управляете вы.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "Решение принимает ваш врач",
            body: "Когда ИИ предлагает процедуру к диагнозу, врач видит её с пометкой «ориентировочно» — и принимает решение.",
          },
          {
            key: "consent",
            n: "02",
            title: "У обработки с помощью ИИ отдельное согласие",
            body: "Оно отделено от общего согласия на защиту данных и запрашивается прежде, чем вы опишете хотя бы один симптом. Пока вы его не дадите, форма не откроется.",
          },
          {
            key: "minimize",
            n: "03",
            title: "Ваше имя никогда не доходит до поставщика ИИ",
            body: "Клиническое содержание — задача ИИ, поэтому оно передаётся. Ваше имя для этой задачи не нужно: оно заменяется до того, как запрос уходит от нас, и восстанавливается в том, что читает врач.",
          },
          {
            key: "scope",
            n: "04",
            title: "Узкая задача",
            body: "Направить вас к нужной специальности и перевести загруженные вами документы. Вот и весь объём.",
          },
        ],
        note: {
          label: "Чего мы не утверждаем",
          text: "ИИ не ставит диагноз, не выбирает лечение и не формирует клиническое суждение. Любой результат ИИ, который вы видите, носит ориентировочный характер — он информирует решение врача, но не заменяет его.",
        },
      },
      accessibility: {
        eyebrow: "Доступность",
        headline: "Сделано, чтобы им можно было пользоваться, а не только смотреть.",
        intro: "Ваш язык, ваше направление чтения, ваше предпочтение по движению — считываются с вашего устройства, а не спрашиваются дважды.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "Восемь языков, два читаются справа налево",
            body: "Арабский и персидский зеркалят всю вёрстку, а не только текст.",
          },
          {
            key: "motion",
            n: "02",
            title: "Если вы попросили устройство о меньшем движении, мы слышим",
            body: "Кинематографичное вступление не смягчается — оно вовсе не создаётся. Всё остаётся читаемым, прокрутка остаётся обычной.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "Клавиатура — не запоздалая мысль",
            body: "Карточки реагируют на фокус, а не только на наведённую мышь.",
          },
          {
            key: "resilience",
            n: "04",
            title: "Если наши скрипты откажут, слова останутся",
            body: "Текст есть на странице ещё до того, как запустится любая анимация.",
          },
        ],
        note: {
          label: "Чего мы не утверждаем",
          text: "Мы не заявляем о соответствии WCAG — независимого аудита мы не проходили. Знак Брайля под логотипом AURA — визуальный элемент бренда; он не означает поддержку брайлевских дисплеев или программ чтения с экрана.",
        },
      },
    },

    trustPage: {
      eyebrow: "доверие",
      word: "AURA",
      wordBefore: "Доверие и конфиденциальность в",
      wordAfter: "",
      lineAfter: "",
      sub: "В AURA доверие — не маркетинговое обещание, а то, что можно показать в самом продукте. Под каждым заголовком мы отдельно указываем, что мы делаем, чего ещё не делаем и что от нас не зависит.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "Как защищены ваши медицинские данные",
          body: "Ваши данные шифруются при передаче и шифруются второй раз отдельным ключом перед записью на наши серверы. Загружаемые вами заключения и снимки попадают в хранилище уже зашифрованными — поставщик хранилища видит только зашифрованную форму. Ваши данные хранятся и обрабатываются в Европейском союзе (Франкфурт).",
          note: {
            label: "Чего мы не утверждаем",
            text: "Это не «сквозное шифрование». Ключ управляется на наших серверах — потому что клиническое резюме, перевод и представление для врача требуют обработки данных на сервере. Система с настоящим сквозным шифрованием не смогла бы предоставить эти функции.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "Согласие и искусственный интеллект",
          body: "Берутся три отдельных согласия, и ни одно не заменяет другое: общее согласие на обработку данных · предварительная оценка вашего обращения с помощью ИИ · синхронный перевод приёма с помощью ИИ. По каждому согласию мы сохраняем точный текст, который вы одобрили, момент одобрения и цепочку, подтверждающую, что он не изменялся впоследствии. Без согласия ни один шаг не начинается — форма не открывается, разрешение на камеру не запрашивается. Свою запись о согласии вы можете посмотреть в любой момент.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "Кто что видит",
          body: "Доступ зависит от роли: пациент видит только свои записи · врач — только если он проверен и назначен на случай · партнёрский врач вообще не имеет доступа к базе данных пациентов, а в передаваемом ему вопросе имена людей маскируются · координаторы и агентство видят логистику, а не клинические записи. После завершения послеоперационного наблюдения доступ клинического персонала закрывается, и запись остаётся только у вас; при желании вы открываете её снова.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "Проверка врачей",
          body: "Прежде чем врач станет видимым и получит назначение пациента, он загружает профессиональные документы — диплом, сертификат специалиста и страхование профессиональной ответственности, — которые проверяются и утверждаются. Профиль неутверждённого врача не публикуется.",
          note: {
            label: "Чего мы не утверждаем",
            text: "Мы не говорим «аккредитованный врач» — мы проверяем наличие и действительность документов.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "Видео, документы и обмен",
          body: "Ваши консультации не записываются. Видео и звук шифруются по WebRTC; когда прямое соединение установить не удаётся, подключающийся ретранслятор передаёт только зашифрованный трафик и не видит его содержимого. Делясь своими записями, вы сами выбираете, какие категории будут видны; можно задать срок, добавить пароль, отключить скачивание и отозвать ссылку в любой момент. Каждый доступ фиксируется.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "Аудит и история доступа",
          body: "Каждый значимый доступ к вашим клиническим данным записывается в цепочку, которую впоследствии нельзя удалить или изменить и которую можно независимо проверить.",
          note: {
            label: "Ограничение",
            text: "Журнал аудита спроектирован так, чтобы не блокировать приложение: если запись не удаётся сохранить, операция всё равно завершается. Высокочастотные технические события, такие как сигнализация, намеренно не журналируются.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "Хранение и удаление",
          body: "Вы можете удалить свою учётную запись и персональные данные. При этом ваши e-mail, имя, телефон, профиль и уведомления действительно удаляются, ссылки для обмена отзываются, а вход становится невозможным. Ваши медицинские записи должны храниться в течение установленного законом срока — 20 лет, — но они закрываются для доступа (открыть их не может никто: ни врачи, ни координаторы, ни администраторы, ни вы) и по истечении срока уничтожаются автоматически. Намеренно сохраняются две вещи: ваши записи о согласии, подтверждающие правовое основание хранения и уничтожаемые вместе с записями, и история доступа — защищённая от подделки цепочка, которая не содержит идентифицирующих данных и удаление которой разорвало бы цепочку.",
          note: {
            label: "Чего мы не утверждаем",
            text: "Удаление выполняется не уничтожением ключа («crypto-shredding»), а физическим удалением записи.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "Международная передача и поставщики услуг",
          body: "Хранение и обработка происходят в Европейском союзе (Франкфурт). Ограниченные случаи, выходящие за пределы ЕС:",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "Клиническая ответственность",
          body: "Диагноз, лечение и медицинские решения принадлежат квалифицированным специалистам здравоохранения. AURA поддерживает оценку, координацию и общение; она не заменяет врача. Второе мнение не является обязывающим.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "Сообщить о проблеме конфиденциальности или безопасности",
          body: "Если у вас есть опасения по поводу ваших данных или находка в области безопасности, сообщите нам.",
          note: {
            label: "⚖️ Черновик",
            text: "Контактный адрес оператора данных ещё не опубликован; этот раздел будет обновлён, как только он будет определён. До тех пор мы не выдумываем адрес.",
          },
        },
      ],
      aiEmphasis: "Медицинское решение не принадлежит искусственному интеллекту: AURA упорядочивает вашу информацию и предлагает подходящую специальность; диагноз и решение о лечении принимают квалифицированные специалисты здравоохранения.",
      transferItems: [
        "Предварительная оценка ИИ и клиническое резюме (Anthropic, США): ваше имя не передаётся — используется заполнитель; клиническое содержание передаётся, поскольку составляет суть задачи.",
        "Синхронный перевод (Google, США): звук приёма обрабатывается для перевода и требует отдельного явного согласия; без него функция не работает.",
        "Ретранслятор соединения (Cloudflare): передаёт только зашифрованные медиаданные.",
        "Сигнализация (Ably) и ограничение частоты запросов (Upstash): медицинские данные не передаются.",
      ],
    },
    hiw: {
      eyebrow: "гид",
      word: "AURA",
      wordBefore: "Как работает",
      wordAfter: "",
      lineAfter: "",
      sub: "Четыре пути, одна платформа. Каждый шаг от регистрации до консультации, по порядку.",
      pick: "Выберите свой путь",
      watch: "смотреть гид",
      step: "шаг",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "Создайте аккаунт", d: "Регистрация за несколько минут через Google, Apple или e-mail." },
            { t: "Оплатите визит", d: "Единая прозрачная цена; безопасная оплата картой." },
            { t: "Опишите симптомы", d: "Короткая анкета; AURA упорядочивает то, чем вы делитесь." },
            { t: "Назначение к специалисту", d: "Вас направляют к врачу предложенной специальности." },
            { t: "Цифровая комната ожидания", d: "Следите за своей очередью в реальном времени." },
            { t: "Видеоконсультация с врачом", d: "Зашифрованный видеоприём; заметки и дальнейшие шаги в вашей карте." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "Начните с диагноза", d: "Вы были у врача, и у вас есть диагноз или план лечения." },
            { t: "Войдите в AURA", d: "Откройте поток «Второе мнение» и создайте свой случай." },
            { t: "Загрузите документы", d: "Заключения, МРТ и анализы; безопасно и конфиденциально." },
            { t: "Встреча с профессором", d: "Видеосессия с опытным академическим специалистом." },
            { t: "Получите письменный отчёт", d: "Подробное структурированное заключение второго мнения." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "Выберите лечение", d: "Голливудская улыбка, пересадка волос, пластическая операция или медицинская операция." },
            { t: "Изучите варианты в Турции", d: "Сравните клиники с разрешением на медицинский туризм и специалистов." },
            { t: "Пообщайтесь со специалистами", d: "Видеовстречи с врачами и медицинскими консультантами." },
            { t: "Получите предложение", d: "Понятный пакет: лечение, проживание и логистика." },
            { t: "Поездка по полному плану", d: "Перелёт, отель, операция и восстановление; всё спланировано." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "Проверьте условия", d: "Право на помощь зависит от места жительства и нужной специальности." },
            { t: "Подайте заявку онлайн", d: "Короткая анкета с описанием вашей ситуации." },
            { t: "Подбор врача-волонтёра", d: "Волонтёр нужной специальности берёт ваш случай." },
            { t: "Видеовстреча", d: "Когда врач в сети, приём проходит по видеосвязи." },
          ],
        },
      ],
    },
  },
  ar: {
    nav: { telehealth: "الرعاية عن بُعد", so: "رأي ثانٍ", tourism: "السياحة العلاجية", freecare: "رعاية مجانية", how: "كيف يعمل", cta: "تحدث إلى طبيب", menu: "القائمة", close: "إغلاق القائمة" },
    hero: {
      word: "AURA",
      l1: { a: "الرعاية عن بُعد", mid: " و", b: "السياحة العلاجية", tail: "،" },
      line2: "من البداية إلى النهاية.",
      cta: "تحدث إلى طبيب",
      scenes: "01/04 مشاهد",
    },
    chapters: [
      { n: "01", key: "consult", strand: "الرعاية عن بُعد", title: "تحدث إلى طبيب.", body: "تُعدّ AURA ملفك وتقترح تخصصًا مناسبًا.", cta: "ابدأ الاستشارة", href: "/giris", external: false },
      { n: "02", key: "so", strand: "رأي ثانٍ", title: "عين خبيرة ثانية.", body: "أخصائيون مستقلون يراجعون تشخيصك.", cta: "اطلب مراجعة", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "السياحة العلاجية", title: "سياحة علاجية مخطط لها.", body: "الطيران والفندق والجراحة والمتابعة في خطة واحدة.", cta: "خطط رحلتي", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "رعاية مجانية", title: "الصحة حق.", body: "أطباء متطوعون يتدخلون عندما تتعذر الرعاية.", cta: "قدّم للرعاية المجانية", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "تعرّف على الأخصائيين.",
      note: "كادر نموذجي من شبكتنا التجريبية.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "أمراض القلب" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "طب الأعصاب" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "جراحة العظام" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "الأمراض الجلدية" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "أطفال الأنابيب" },
      ],
    },
    trust: {
      headline: "الثقة جزء من المنتج",
      items: [
        { title: "موافقة صريحة", desc: "قبل الخطوات المدعومة بالذكاء الاصطناعي، تُسجَّل موافقتك مع النص المعتمد وختم زمني وسلسلة يصعب العبث بها." },
        { title: "مشفّر أثناء النقل والتخزين", desc: "تُشفَّر البيانات الصحية أثناء النقل، ثم تُشفَّر مرة أخرى قبل تخزينها." },
        { title: "وصول حسب الدور", desc: "المرضى والأطباء والمنسقون والشركاء يرون فقط ما يتطلبه دورهم." },
        { title: "تحقق من وثائق الطبيب", desc: "تُراجَع الوثائق المهنية وتُعتمد قبل ظهور الطبيب في المنصة." },
        { title: "سجل وصول محمي من العبث", desc: "يُكتب كل وصول إلى البيانات السريرية في سلسلة يمكن التحقق منها بشكل مستقل." },
        { title: "التقييم أولًا، ثم الالتزامات", desc: "الأسعار وترتيبات السفر تأتي بعد التقييم السريري — لا تسبقه أبدًا." },
      ],
    },
    howItWorks: {
      headline: "كيف يعمل",
      note: "أربع خطوات، رحلة واحدة متواصلة.",
      steps: [
        { title: "أخبرنا", desc: "صِف أعراضك أو هدفك بلغتك." },
        { title: "AURA تُعدّ ملفك", desc: "تُنظَّم معلوماتك ويُقترح تخصص مناسب." },
        { title: "استشارة فيديو", desc: "قابل طبيبك عبر فيديو مشفّر مع ترجمة فورية." },
        { title: "المتابعة", desc: "التقارير وفحوص التعافي والرعاية — كلها من المنزل." },
      ],
      safety: "القرارات الطبية يتخذها مختصون مؤهلون في الرعاية الصحية. تدعم AURA التقييم والتنسيق والتواصل.",
      cta: "شاهد الدليل الكامل",
    },
    closing: { headline: "جاهزون متى كنت جاهزًا.", cta: "تحدث إلى طبيب" },
    footer: {
      platform: "المنصة", explore: "استكشف", patientLogin: "دخول المرضى", patientSignup: "تسجيل المرضى", corporateLogin: "الدخول المؤسسي", doctorSignup: "تسجيل الأطباء", telehealth: "الرعاية عن بُعد", tourism: "السياحة العلاجية", doctors: "الأخصائيون", trust: "الثقة والخصوصية",
      legal: "© 2026 AURA. عرض تجريبي (MVP)، وليس نصيحة طبية.",
    },
    signin: {
      word: "AURA", wordBefore: "مرحبًا بك في", wordAfter: "", lineAfter: "",
      sub: "سجّل الدخول لبدء رحلة رعايتك",
      google: "المتابعة عبر Google", apple: "المتابعة عبر Apple", email: "المتابعة عبر البريد الإلكتروني", or: "أو",
      legal: "بالمتابعة، فإنك تقبل مبادئ معالجة البيانات الموضحة في صفحة ",
      legalLink: "الثقة والخصوصية",
      legalAfter: ".",
      back: "العودة إلى الرئيسية",
    },
    corporate: {
      title: "AURA · الدخول المؤسسي", word: "AURA", wordBefore: "", wordAfter: "", lineAfter: "الدخول المؤسسي",
      sub: "اختر دورك وتابع إلى البوابة المؤسسية.",
      roleLabel: "تسجيل الدخول بصفة",
      roles: ["طبيب", "طبيب شريك", "أخصائي صحي", "موظف وكالة سياحة علاجية", "منسق", "لجنة الأخلاقيات"],
      continue: "المتابعة لتسجيل الدخول",
      legal: "الدخول المؤسسي مقصور على موظفي المنصة وشركائها الموثقين.",
      back: "العودة إلى الرئيسية",
    },
    v2: {
      nav: {
        care: "الرعاية",
        how: "كيف تعمل AURA",
        trust: "الثقة والخصوصية",
        clinicians: "للأطباء",
        cta: "ابدأ رعايتك",
      },
      hero: {
        eyebrow: "رعاية رقمية عابرة للحدود",
        headline: "رعاية بلا حدود.",
        lede: "التقِ بالأخصائي المناسب، افهم خياراتك، وواصل رعايتك أينما كنت — بدعم متعدد اللغات من التقييم الأول حتى المتابعة.",
        ctaPrimary: "ابدأ رعايتك",
        ctaSecondary: "كيف تعمل AURA",
        safety: "القرارات الطبية يتخذها مهنيون صحيون مؤهلون. تدعم AURA التقييم والتنسيق والتواصل.",
      },
      entry: {
        eyebrow: "ابدأ مما تحتاجه اليوم",
        headline: "رحلة رعاية واحدة. أربع طرق للبدء.",
        intro: "تنظّم AURA الخطوات التالية حولك.",
        cards: [
          {
            key: "consult",
            n: "01",
            title: "تحدّث إلى طبيب",
            body: "صِف شكواك بلغتك. تجهّز AURA حالتك وتوجّهك إلى التخصص المناسب.",
            cta: "ابدأ التقييم",
          },
          {
            key: "so",
            n: "02",
            title: "رأي ثانٍ",
            body: "دع أخصائيًا مستقلًا يراجع تشخيصك أو صورك أو خطة علاجك.",
            cta: "جهّز حالتي",
          },
          {
            key: "tourism",
            n: "03",
            title: "السياحة العلاجية",
            body: "استكشف العلاج في تركيا بعد المراجعة السريرية فقط — قبل تأكيد السفر أو السعر أو الحجز.",
            cta: "استكشف خيارات العلاج",
          },
          {
            key: "freecare",
            n: "04",
            title: "رعاية ميسّرة",
            body: "قدّم طلبًا لاستشارات مجانية مدعومة عندما تحول المسافة أو التكلفة أو صعوبة الوصول بينك وبين الرعاية.",
            cta: "اطلب الدعم",
          },
        ],
      },
      ai: {
        eyebrow: "حيث يتوقف الذكاء الاصطناعي",
        headline: "الذكاء الاصطناعي يُهيّئ. والطبيب يقرر.",
        intro: "تستخدم AURA الذكاء الاصطناعي لمهمة ضيقة، خلف بوابة موافقة تتحكم أنت بها.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "القرار قرار طبيبك",
            body: "حين يقترح الذكاء الاصطناعي إجراءً لتشخيص ما، يراه طبيبك موسومًا بأنه استرشادي — ثم يقرر.",
          },
          {
            key: "consent",
            n: "02",
            title: "لمعالجة الذكاء الاصطناعي موافقة خاصة بها",
            body: "منفصلة عن الموافقة العامة لحماية البيانات، وتُطلب قبل أن تصف عرضًا واحدًا. وإلى أن تمنحها، لا يُفتح النموذج.",
          },
          {
            key: "minimize",
            n: "03",
            title: "اسمك لا يصل أبدًا إلى مزوّد الذكاء الاصطناعي",
            body: "المحتوى السريري هو مهمة الذكاء الاصطناعي، لذا يُرسل. أما اسمك فليس لازمًا لتلك المهمة — يُستبدل قبل أن يغادر الطلب من عندنا، ويُعاد في ما يقرأه طبيبك.",
          },
          {
            key: "scope",
            n: "04",
            title: "مهمة ضيقة",
            body: "توجيهك إلى التخصص المناسب، وترجمة المستندات التي ترفعها. هذا هو النطاق.",
          },
        ],
        note: {
          label: "ما لا ندّعيه",
          text: "الذكاء الاصطناعي لا يُشخّص، ولا يختار العلاج، ولا يُنتج حكمًا سريريًا. أي مخرج للذكاء الاصطناعي تراه هو استرشادي — يُثري قرار طبيبك ولا يحل محله.",
        },
      },
      accessibility: {
        eyebrow: "إمكانية الوصول",
        headline: "مبني ليكون قابلًا للاستخدام، لا ليُرى فحسب.",
        intro: "لغتك، واتجاه قراءتك، وتفضيلك للحركة — تُقرأ من جهازك، ولا تُسأل عنها مرتين.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "ثماني لغات، اثنتان تُقرأان من اليمين إلى اليسار",
            body: "العربية والفارسية تعكسان التخطيط بأكمله، لا النص وحده.",
          },
          {
            key: "motion",
            n: "02",
            title: "إن طلبت من جهازك حركة أقل، فنحن نُصغي",
            body: "الافتتاحية السينمائية لا تُخفَّف — بل لا تُبنى أصلًا. يبقى كل شيء مقروءًا، ويبقى التمرير طبيعيًا.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "لوحة المفاتيح ليست فكرة لاحقة",
            body: "البطاقات تستجيب للتركيز، لا لمؤشر الفأرة المُحوّم وحده.",
          },
          {
            key: "resilience",
            n: "04",
            title: "إن تعطّلت برامجنا، تبقى الكلمات",
            body: "النص موجود في الصفحة قبل أن تعمل أي حركة.",
          },
        ],
        note: {
          label: "ما لا ندّعيه",
          text: "لا ندّعي مطابقة WCAG — لم نخضع لتدقيق مستقل. وعلامة برايل أسفل شعار AURA عنصر بصري للعلامة التجارية؛ وهي لا تعني دعم أجهزة برايل أو قارئات الشاشة.",
        },
      },
    },

    trustPage: {
      eyebrow: "الثقة",
      word: "AURA",
      wordBefore: "الثقة والخصوصية في",
      wordAfter: "",
      lineAfter: "",
      sub: "في AURA، الثقة ليست وعدًا تسويقيًا بل شيء يمكن إظهاره داخل المنتج. تحت كل عنوان أدناه نوضح بشكل منفصل ما نفعله، وما لم نفعله بعد، وما ليس بيدنا.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "كيف تُحمى بياناتك الصحية",
          body: "تُشفَّر بياناتك أثناء النقل، ثم تُشفَّر مرة ثانية بمفتاح منفصل قبل حفظها على خوادمنا. التقارير والصور التي ترفعها تصل إلى التخزين مشفَّرة بالفعل — ومزوّد التخزين لا يرى سوى الشكل المشفَّر. تُخزَّن بياناتك وتُعالَج داخل الاتحاد الأوروبي (فرانكفورت).",
          note: {
            label: "ما لا ندّعيه",
            text: "هذا ليس «تشفيرًا من طرف إلى طرف». المفتاح يُدار على خوادمنا — لأن الملخص السريري والترجمة وعرض الطبيب تتطلب جميعها معالجة البيانات على الخادم. أي نظام مشفَّر فعليًا من طرف إلى طرف لا يمكنه تقديم هذه الوظائف.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "الموافقة والذكاء الاصطناعي",
          body: "تُؤخذ ثلاث موافقات منفصلة، ولا تحل أي منها محل الأخرى: الموافقة العامة على حماية البيانات · التقييم الأولي لشكواك بالذكاء الاصطناعي · الترجمة الفورية لجلستك بالذكاء الاصطناعي. لكل موافقة نحفظ النص الذي وافقت عليه حرفيًا، ولحظة موافقتك، وسلسلة تثبت أنه لم يُعدَّل بعدها. لا تبدأ أي خطوة قبل الموافقة — لا يُفتح النموذج ولا يُطلب إذن الكاميرا. ويمكنك الاطلاع على سجل موافقتك في أي وقت.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "من يرى ماذا",
          body: "الوصول يتبع الدور: المريض يرى سجلاته فقط · الطبيب فقط إذا كان موثقًا ومُسندًا إلى الحالة · الطبيب الشريك لا يصل إلى قاعدة بيانات المرضى إطلاقًا، وتُخفى أسماء الأشخاص في السؤال المُحال إليه · المنسّقون والوكالة يرون البيانات اللوجستية لا السجل السريري. وعند انتهاء متابعتك بعد العملية يُغلق وصول الطاقم السريري ويبقى السجل لك وحدك؛ ويمكنك إعادة فتحه متى شئت.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "توثيق الأطباء",
          body: "قبل أن يظهر الطبيب أو يتلقى أي إسناد لمريض، يرفع وثائقه المهنية — الشهادة الجامعية وشهادة التخصص وتأمين المسؤولية المهنية — وتُراجع وتُعتمد. ولا يُنشر ملف طبيب غير معتمد.",
          note: {
            label: "ما لا ندّعيه",
            text: "لا نقول «طبيب معتمد اعتمادًا مؤسسيًا» — ما نتحقق منه هو وجود الوثائق وصلاحيتها.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "الفيديو والمستندات والمشاركة",
          body: "جلساتك لا تُسجَّل. يُشفَّر الفيديو والصوت عبر WebRTC؛ وعند تعذّر الاتصال المباشر، ينقل خادم التتابع الذي يتدخل حركة مشفَّرة فقط ولا يمكنه رؤية محتواها. وعند مشاركة سجلاتك تختار أنت الفئات الظاهرة؛ ويمكنك تحديد مدة، وإضافة كلمة مرور، وتعطيل التنزيل، وإلغاء الرابط في أي لحظة. وكل وصول يُسجَّل.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "التدقيق وسجل الوصول",
          body: "كل وصول ذي معنى إلى بياناتك السريرية يُكتب في سلسلة لا يمكن حذفها أو تغييرها لاحقًا، ويمكن التحقق منها بشكل مستقل.",
          note: {
            label: "الحد",
            text: "صُمِّم سجل التدقيق بحيث لا يعطّل التطبيق — فإذا تعذّرت كتابة قيد، تكتمل العملية رغم ذلك. أما الأحداث التقنية عالية التكرار مثل الإشارات فلا تُسجَّل عن قصد.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "الحفظ والحذف",
          body: "يمكنك حذف حسابك وبياناتك الشخصية. وعندها يُحذف فعليًا بريدك الإلكتروني واسمك وهاتفك وملفك وإشعاراتك، وتُلغى روابط المشاركة، ويصبح تسجيل الدخول مستحيلًا. أما سجلاتك الصحية فيجب حفظها طوال مدة الحفظ القانونية — 20 عامًا — لكنها تُغلق أمام الوصول (لا يستطيع أحد فتحها: لا الأطباء ولا المنسّقون ولا الإداريون ولا أنت) وتُتلف تلقائيًا عند انتهاء المدة. ويُحتفظ بشيئين عن قصد: سجلات موافقتك، التي تثبت الأساس القانوني لما نحفظه وتُتلف مع السجلات، وسجل الوصول، وهو سلسلة تدقيق غير قابلة للتلاعب لا تحمل بيانات تعريف، وحذفها يكسر السلسلة.",
          note: {
            label: "ما لا ندّعيه",
            text: "الحذف لا يتم بإتلاف مفتاح («crypto-shredding») بل بالحذف الفعلي للسجل.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "النقل الدولي ومزوّدو الخدمة",
          body: "يجري الحفظ والمعالجة داخل الاتحاد الأوروبي (فرانكفورت). أما الحالات المحدودة التي تخرج من الاتحاد الأوروبي:",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "المسؤولية السريرية",
          body: "التشخيص والعلاج والقرارات الطبية تعود إلى المهنيين الصحيين المؤهلين. تدعم AURA التقييم والتنسيق والتواصل؛ وهي لا تحل محل طبيبك. والرأي الثاني غير مُلزِم.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "أبلغ عن مخاوف تتعلق بالخصوصية أو الأمان",
          body: "إذا كان لديك قلق بشأن بياناتك أو اكتشاف أمني، فأخبرنا.",
          note: {
            label: "⚖️ مسودة",
            text: "لم يُنشر بعد عنوان التواصل الخاص بالمسؤول عن البيانات؛ وسيُحدَّث هذا القسم فور تحديده. وإلى ذلك الحين لا نختلق عنوانًا.",
          },
        },
      ],
      aiEmphasis: "القرار الطبي ليس ملكًا للذكاء الاصطناعي: تنظّم AURA معلوماتك وتقترح التخصص المناسب؛ أما قرار التشخيص والعلاج فيتخذه المهنيون الصحيون المؤهلون.",
      transferItems: [
        "التقييم الأولي بالذكاء الاصطناعي والملخص السريري (Anthropic، الولايات المتحدة): لا يُرسل اسمك — يُستخدم عنصر نائب؛ ويُرسل المحتوى السريري لأنه جوهر المهمة.",
        "الترجمة الفورية (Google، الولايات المتحدة): يُعالَج صوت جلستك لأغراض الترجمة، ويخضع ذلك لموافقة صريحة منفصلة؛ ودون هذه الموافقة لا يعمل.",
        "تتابع الاتصال (Cloudflare): ينقل الوسائط المشفَّرة فقط.",
        "الإشارات (Ably) وتحديد المعدل (Upstash): لا تُرسل أي بيانات صحية.",
      ],
    },
    hiw: {
      eyebrow: "دليل",
      word: "AURA",
      wordBefore: "كيف يعمل",
      wordAfter: "",
      lineAfter: "",
      sub: "أربع رحلات، منصة واحدة. كل خطوة من التسجيل إلى الاستشارة، مشروحة أدناه.",
      pick: "اختر رحلتك",
      watch: "شاهد الدليل",
      step: "خطوة",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "أنشئ حسابك", d: "سجّل خلال دقائق عبر Google أو Apple أو البريد الإلكتروني." },
            { t: "أكمل الدفع", d: "رسوم واحدة وشفافة؛ ادفع بأمان بالبطاقة." },
            { t: "صف أعراضك", d: "نموذج قصير موجّه؛ تنظّم AURA ما تشاركه." },
            { t: "التوجيه إلى أخصائي", d: "تُسند حالتك إلى طبيب في التخصص المقترح." },
            { t: "غرفة الانتظار الرقمية", d: "تابع دورك لحظة بلحظة." },
            { t: "قابل طبيبك عبر الفيديو", d: "زيارة فيديو مشفّرة؛ تُحفظ الملاحظات والخطوات التالية في ملفك." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "ابدأ بتشخيص", d: "راجعت طبيبًا ولديك تشخيص أو خطة علاج." },
            { t: "ادخل إلى AURA", d: "افتح مسار الرأي الثاني وأنشئ حالتك." },
            { t: "ارفع ملفاتك", d: "التقارير وصور الرنين والتحاليل؛ بأمان وخصوصية." },
            { t: "قابل البروفيسور", d: "جلسة فيديو مع أخصائي أكاديمي متمرس." },
            { t: "استلم تقريرًا مكتوبًا", d: "تقرير رأي ثانٍ مفصّل ومنظّم." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "اختر علاجك", d: "ابتسامة هوليوود، زراعة الشعر، جراحة تجميلية أو عملية طبية." },
            { t: "استكشف الخيارات في تركيا", d: "قارن العيادات المرخّصة للسياحة العلاجية والأخصائيين لحالتك." },
            { t: "تحدث إلى الأخصائيين", d: "لقاءات فيديو مع الأطباء ومستشاري الصحة." },
            { t: "استلم عرضك", d: "باقة واضحة تشمل العلاج والإقامة والتنقل." },
            { t: "سافر بخطة كاملة", d: "الطيران والفندق والإجراء والمتابعة؛ مخطط من البداية إلى النهاية." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "تحقق من الشروط", d: "تعتمد الأهلية على مكان إقامتك والتخصص الذي تحتاجه." },
            { t: "قدّم عبر الإنترنت", d: "طلب قصير يلخّص وضعك." },
            { t: "مطابقة مع طبيب متطوع", d: "طبيب متطوع في التخصص المناسب يتولى حالتك." },
            { t: "لقاء عبر الفيديو", d: "عندما يكون طبيبك متصلًا، تتم الزيارة عبر الفيديو." },
          ],
        },
      ],
    },
  },
  fa: {
    nav: { telehealth: "سلامت از راه دور", so: "نظر دوم", tourism: "گردشگری سلامت", freecare: "مراقبت رایگان", how: "چطور کار می‌کند", cta: "با پزشک صحبت کنید", menu: "منو", close: "بستن منو" },
    hero: {
      word: "AURA",
      l1: { a: "سلامت از راه دور", mid: " و ", b: "گردشگری سلامت", tail: "،" },
      line2: "از ابتدا تا انتها.",
      cta: "با پزشک صحبت کنید",
      scenes: "01/04 صحنه",
    },
    chapters: [
      { n: "01", key: "consult", strand: "سلامت از راه دور", title: "با پزشک صحبت کنید.", body: "AURA پرونده شما را آماده می‌کند و تخصص مناسبی پیشنهاد می‌دهد.", cta: "شروع مشاوره", href: "/giris", external: false },
      { n: "02", key: "so", strand: "نظر دوم", title: "نگاه دومِ یک متخصص.", body: "متخصصان مستقل تشخیص شما را بازبینی می‌کنند.", cta: "درخواست بازبینی", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "گردشگری سلامت", title: "گردشگری سلامت، برنامه‌ریزی‌شده.", body: "پرواز، هتل، جراحی و مراقبت پس از آن در یک برنامه.", cta: "برنامه‌ریزی سفر من", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "مراقبت رایگان", title: "سلامت یک حق است.", body: "وقتی درمان در دسترس نیست، پزشکان داوطلب وارد می‌شوند.", cta: "درخواست مراقبت رایگان", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "با متخصصان آشنا شوید.",
      note: "کادر نمونه از شبکه نمایشی ما.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "قلب و عروق" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "مغز و اعصاب" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "ارتوپدی" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "پوست" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "آی‌وی‌اف" },
      ],
    },
    trust: {
      headline: "اعتماد بخشی از محصول است",
      items: [
        { title: "رضایت صریح", desc: "پیش از گام‌های مبتنی بر هوش مصنوعی، رضایت شما همراه با متن تأییدشده، مهر زمانی و زنجیره‌ای مقاوم در برابر دستکاری ثبت می‌شود." },
        { title: "رمزگذاری در انتقال و ذخیره‌سازی", desc: "داده‌های سلامت هنگام انتقال رمزگذاری و پیش از ذخیره‌سازی دوباره رمزگذاری می‌شوند." },
        { title: "دسترسی بر پایه نقش", desc: "بیماران، پزشکان، هماهنگ‌کنندگان و شرکا فقط آنچه را نقششان ایجاب می‌کند می‌بینند." },
        { title: "بررسی مدارک پزشک", desc: "مدارک حرفه‌ای پیش از نمایش پزشک در پلتفرم بررسی و تأیید می‌شوند." },
        { title: "گزارش دسترسی مقاوم در برابر دستکاری", desc: "هر دسترسی به داده‌های بالینی در زنجیره‌ای ثبت می‌شود که مستقل قابل راستی‌آزمایی است." },
        { title: "نخست ارزیابی، سپس تعهدات", desc: "قیمت‌ها و ترتیبات سفر پس از ارزیابی بالینی می‌آیند — هرگز پیش از آن." },
      ],
    },
    howItWorks: {
      headline: "چگونه کار می‌کند",
      note: "چهار گام، یک سفر پیوسته.",
      steps: [
        { title: "به ما بگویید", desc: "علائم یا هدف خود را به زبان خودتان شرح دهید." },
        { title: "AURA پرونده شما را آماده می‌کند", desc: "اطلاعات شما سامان می‌یابد و تخصص مناسبی پیشنهاد می‌شود." },
        { title: "مشاوره ویدیویی", desc: "با پزشک خود از طریق ویدیوی رمزگذاری‌شده و ترجمه زنده ملاقات کنید." },
        { title: "پیگیری", desc: "گزارش‌ها، بررسی‌های بهبود و مراقبت — همه از خانه." },
      ],
      safety: "تصمیم‌های پزشکی را متخصصان واجد شرایط سلامت می‌گیرند. AURA از ارزیابی، هماهنگی و ارتباط پشتیبانی می‌کند.",
      cta: "مشاهده راهنمای کامل",
    },
    closing: { headline: "هر وقت آماده بودید، ما هستیم.", cta: "با پزشک صحبت کنید" },
    footer: {
      platform: "پلتفرم", explore: "کاوش", patientLogin: "ورود بیمار", patientSignup: "ثبت‌نام بیمار", corporateLogin: "ورود سازمانی", doctorSignup: "ثبت‌نام پزشک", telehealth: "سلامت از راه دور", tourism: "گردشگری سلامت", doctors: "متخصصان", trust: "اعتماد و حریم خصوصی",
      legal: "© 2026 AURA. دموی MVP؛ توصیه پزشکی نیست.",
    },
    signin: {
      word: "AURA", wordBefore: "به", wordAfter: "", lineAfter: "خوش آمدید",
      sub: "برای شروع مسیر درمان خود وارد شوید",
      google: "ادامه با Google", apple: "ادامه با Apple", email: "ادامه با ایمیل", or: "یا",
      legal: "با ادامه، اصول پردازش داده‌ها را که در صفحهٔ ",
      legalLink: "اعتماد و حریم خصوصی",
      legalAfter: " توضیح داده شده می‌پذیرید.",
      back: "بازگشت به خانه",
    },
    corporate: {
      title: "AURA · ورود سازمانی", word: "AURA", wordBefore: "", wordAfter: "", lineAfter: "ورود سازمانی",
      sub: "نقش خود را انتخاب کنید و به پورتال سازمانی ادامه دهید.",
      roleLabel: "ورود به عنوان",
      roles: ["پزشک", "پزشک همکار", "متخصص سلامت", "کارشناس آژانس گردشگری سلامت", "هماهنگ‌کننده", "کمیته اخلاق"],
      continue: "ادامه به ورود",
      legal: "دسترسی سازمانی به کارکنان و شرکای تأییدشده پلتفرم محدود است.",
      back: "بازگشت به خانه",
    },
    v2: {
      nav: {
        care: "مراقبت",
        how: "AURA چگونه کار می‌کند",
        trust: "اعتماد و حریم خصوصی",
        clinicians: "برای پزشکان",
        cta: "مراقبت خود را آغاز کنید",
      },
      hero: {
        eyebrow: "مراقبت دیجیتال فرامرزی",
        headline: "مراقبت، بدون مرز.",
        lede: "با متخصص مناسب دیدار کنید، گزینه‌هایتان را بشناسید و مراقبت خود را هرجا که هستید ادامه دهید — با پشتیبانی چندزبانه از نخستین ارزیابی تا پیگیری.",
        ctaPrimary: "مراقبت خود را آغاز کنید",
        ctaSecondary: "AURA چگونه کار می‌کند",
        safety: "تصمیم‌های پزشکی را متخصصان صلاحیت‌دار سلامت می‌گیرند. AURA از ارزیابی، هماهنگی و ارتباط پشتیبانی می‌کند.",
      },
      entry: {
        eyebrow: "از همان چیزی شروع کنید که امروز نیاز دارید",
        headline: "یک مسیر مراقبت. چهار راه برای شروع.",
        intro: "AURA گام‌های بعدی را پیرامون شما سامان می‌دهد.",
        cards: [
          {
            key: "consult",
            n: "01",
            title: "با پزشک صحبت کنید",
            body: "مشکل خود را به زبان خودتان شرح دهید. AURA پرونده‌تان را آماده می‌کند و شما را به تخصص مناسب راهنمایی می‌کند.",
            cta: "شروع ارزیابی",
          },
          {
            key: "so",
            n: "02",
            title: "نظر دوم",
            body: "بگذارید متخصصی مستقل تشخیص، تصویربرداری یا طرح درمان شما را بررسی کند.",
            cta: "آماده‌سازی پرونده‌ام",
          },
          {
            key: "tourism",
            n: "03",
            title: "گردشگری سلامت",
            body: "درمان در ترکیه را تنها پس از بررسی بالینی بررسی کنید — پیش از تأیید سفر، قیمت یا رزرو.",
            cta: "بررسی گزینه‌های درمان",
          },
          {
            key: "freecare",
            n: "04",
            title: "مراقبت در دسترس",
            body: "وقتی فاصله، هزینه یا دسترسی میان شما و مراقبت قرار می‌گیرد، برای مشاورهٔ رایگان و پشتیبانی‌شده درخواست دهید.",
            cta: "درخواست پشتیبانی",
          },
        ],
      },
      ai: {
        eyebrow: "جایی که هوش مصنوعی متوقف می‌شود",
        headline: "هوش مصنوعی آماده می‌کند. پزشک تصمیم می‌گیرد.",
        intro: "AURA از هوش مصنوعی برای وظیفه‌ای محدود استفاده می‌کند، پشت دروازهٔ رضایتی که در اختیار شماست.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "تصمیم با پزشک شماست",
            body: "هرگاه هوش مصنوعی برای یک تشخیص اقدامی پیشنهاد دهد، پزشک شما آن را با برچسب «راهنما» می‌بیند — و تصمیم می‌گیرد.",
          },
          {
            key: "consent",
            n: "02",
            title: "پردازش با هوش مصنوعی رضایت جداگانهٔ خود را دارد",
            body: "جدا از رضایت عمومی حفاظت از داده‌ها، و پیش از آنکه حتی یک نشانه را شرح دهید پرسیده می‌شود. تا آن را ندهید، فرم باز نمی‌شود.",
          },
          {
            key: "minimize",
            n: "03",
            title: "نام شما هرگز به ارائه‌دهندهٔ هوش مصنوعی نمی‌رسد",
            body: "محتوای بالینی وظیفهٔ هوش مصنوعی است، پس فرستاده می‌شود. نام شما برای آن وظیفه لازم نیست — پیش از آنکه درخواست از ما خارج شود جایگزین می‌گردد و در آنچه پزشکتان می‌خواند بازگردانده می‌شود.",
          },
          {
            key: "scope",
            n: "04",
            title: "وظیفه‌ای محدود",
            body: "راهنمایی شما به تخصص درست، و ترجمهٔ مدارکی که بارگذاری می‌کنید. دامنه همین است.",
          },
        ],
        note: {
          label: "آنچه ادعا نمی‌کنیم",
          text: "هوش مصنوعی تشخیص نمی‌دهد، درمان انتخاب نمی‌کند و قضاوت بالینی تولید نمی‌کند. هر خروجی هوش مصنوعی که می‌بینید راهنماست — به تصمیم پزشک شما آگاهی می‌دهد، جایگزین آن نمی‌شود.",
        },
      },
      accessibility: {
        eyebrow: "دسترس‌پذیری",
        headline: "ساخته شده تا قابل استفاده باشد، نه فقط دیده شود.",
        intro: "زبان شما، جهت خواندن شما، ترجیح شما برای حرکت — از دستگاهتان خوانده می‌شود، دو بار پرسیده نمی‌شود.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "هشت زبان، دو زبان از راست به چپ",
            body: "عربی و فارسی کل چیدمان را آینه می‌کنند، نه فقط متن را.",
          },
          {
            key: "motion",
            n: "02",
            title: "اگر از دستگاهتان حرکت کمتر خواسته‌اید، ما می‌شنویم",
            body: "گشایش سینمایی کم‌رنگ نمی‌شود — اصلاً ساخته نمی‌شود. همه چیز خوانا می‌ماند و پیمایش عادی می‌ماند.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "صفحه‌کلید فکری ثانویه نیست",
            body: "کارت‌ها به فوکوس پاسخ می‌دهند، نه فقط به ماوسی که روی آن‌ها می‌ایستد.",
          },
          {
            key: "resilience",
            n: "04",
            title: "اگر کدهای ما از کار بیفتند، واژه‌ها می‌مانند",
            body: "متن پیش از اجرای هر انیمیشنی در صفحه هست.",
          },
        ],
        note: {
          label: "آنچه ادعا نمی‌کنیم",
          text: "ما ادعای انطباق با WCAG نداریم — ممیزی مستقل نشده‌ایم. نشان بریل زیر نشان‌واژهٔ AURA یک عنصر بصری برند است؛ به معنای پشتیبانی از نمایشگر بریل یا صفحه‌خوان نیست.",
        },
      },
    },

    trustPage: {
      eyebrow: "اعتماد",
      word: "AURA",
      wordBefore: "اعتماد و حریم خصوصی در",
      wordAfter: "",
      lineAfter: "",
      sub: "در AURA اعتماد یک وعدهٔ بازاریابی نیست؛ چیزی است که می‌توان در خودِ محصول نشان داد. زیر هر عنوان جداگانه نوشته‌ایم چه می‌کنیم، چه چیزی را هنوز انجام نداده‌ایم و چه چیزی در اختیار ما نیست.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "داده‌های سلامت شما چگونه محافظت می‌شود",
          body: "داده‌های شما هنگام انتقال رمزگذاری می‌شوند و پیش از ذخیره روی سرورهای ما بار دوم با کلیدی جداگانه رمزگذاری می‌شوند. گزارش‌ها و تصاویری که بارگذاری می‌کنید، رمزگذاری‌شده به فضای ذخیره‌سازی می‌رسند — ارائه‌دهندهٔ ذخیره‌سازی تنها شکل رمزگذاری‌شده را می‌بیند. داده‌های شما در اتحادیهٔ اروپا (فرانکفورت) ذخیره و پردازش می‌شود.",
          note: {
            label: "چه چیزی را ادعا نمی‌کنیم",
            text: "این «رمزگذاری سرتاسری» نیست. کلید روی سرورهای ما مدیریت می‌شود — زیرا خلاصهٔ بالینی، ترجمه و نمای پزشک همگی نیازمند پردازش داده روی سرور هستند. سامانه‌ای که واقعاً سرتاسری رمزگذاری شده باشد نمی‌تواند این کارکردها را ارائه دهد.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "رضایت و هوش مصنوعی",
          body: "سه رضایت جداگانه گرفته می‌شود و هیچ‌کدام جای دیگری را نمی‌گیرد: رضایت عمومی حفاظت از داده‌ها · ارزیابی اولیهٔ شکایت شما با هوش مصنوعی · ترجمهٔ همزمان ویزیت شما با هوش مصنوعی. برای هر رضایت، عین متنی که تأیید کرده‌اید، لحظهٔ تأیید و زنجیره‌ای که نشان می‌دهد پس از آن تغییر نکرده است نگهداری می‌شود. هیچ مرحله‌ای پیش از رضایت آغاز نمی‌شود — فرم باز نمی‌شود و اجازهٔ دوربین درخواست نمی‌شود. سابقهٔ رضایت خود را هر زمان می‌توانید ببینید.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "چه کسی چه چیزی را می‌بیند",
          body: "دسترسی بر پایهٔ نقش است: بیمار فقط سوابق خودش را می‌بیند · پزشک تنها اگر تأییدشده و به پرونده گمارده شده باشد · پزشک همکار اصلاً به پایگاه دادهٔ بیماران دسترسی ندارد و در پرسشی که به او ارجاع می‌شود نام اشخاص پوشانده می‌شود · هماهنگ‌کننده و آژانس اطلاعات لجستیکی را می‌بینند نه پروندهٔ بالینی را. با پایان پیگیری پس از عمل، دسترسی کادر بالینی بسته می‌شود و پرونده تنها نزد شما می‌ماند؛ در صورت تمایل دوباره آن را باز می‌کنید.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "احراز هویت پزشکان",
          body: "پیش از آنکه پزشک دیده شود یا بیماری به او ارجاع شود، مدارک حرفه‌ای خود را بارگذاری می‌کند — مدرک تحصیلی، گواهی تخصص و بیمهٔ مسئولیت حرفه‌ای — و این مدارک بررسی و تأیید می‌شوند. پروفایل پزشک تأییدنشده هرگز منتشر نمی‌شود.",
          note: {
            label: "چه چیزی را ادعا نمی‌کنیم",
            text: "ما نمی‌گوییم «پزشک دارای اعتبارنامهٔ نهادی» — آنچه راستی‌آزمایی می‌کنیم وجود و اعتبار مدارک است.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "ویدیو، اسناد و اشتراک‌گذاری",
          body: "ویزیت‌های شما ضبط نمی‌شود. ویدیو و صدا با WebRTC رمزگذاری می‌شوند؛ هنگامی که اتصال مستقیم برقرار نشود، سرور رله‌ای که وارد می‌شود تنها ترافیک رمزگذاری‌شده را حمل می‌کند و محتوای آن را نمی‌بیند. هنگام اشتراک‌گذاری سوابق، خودتان انتخاب می‌کنید کدام دسته‌ها دیده شوند؛ می‌توانید مهلت بگذارید، رمز عبور بیفزایید، دانلود را غیرفعال کنید و پیوند را هر لحظه باطل کنید. هر دسترسی ثبت می‌شود.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "ممیزی و تاریخچهٔ دسترسی",
          body: "هر دسترسی معنادار به داده‌های بالینی شما در زنجیره‌ای نوشته می‌شود که بعداً نه حذف و نه تغییر می‌پذیرد و می‌توان آن را مستقلاً راستی‌آزمایی کرد.",
          note: {
            label: "مرز آن",
            text: "سابقهٔ ممیزی چنان طراحی شده که برنامه را متوقف نکند — اگر ثبت یک رکورد ممکن نباشد، عملیات همچنان کامل می‌شود. رویدادهای فنی پرتکرار مانند سیگنالینگ عمداً ثبت نمی‌شوند.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "نگهداری و حذف",
          body: "می‌توانید حساب و داده‌های شخصی خود را حذف کنید. در این صورت ایمیل، نام، تلفن، پروفایل و اعلان‌های شما واقعاً حذف می‌شوند، پیوندهای اشتراک باطل می‌شوند و ورود ناممکن می‌شود. سوابق سلامت شما باید در طول مدت نگهداری قانونی — ۲۰ سال — نگه داشته شوند؛ اما به روی دسترسی بسته می‌شوند (هیچ‌کس نمی‌تواند آن‌ها را باز کند: نه پزشکان، نه هماهنگ‌کنندگان، نه مدیران و نه خود شما) و با پایان مدت به‌صورت خودکار امحا می‌شوند. دو چیز عمداً نگه داشته می‌شود: سوابق رضایت شما که مبنای قانونی آنچه نگه می‌داریم را اثبات می‌کند و همراه با سوابق امحا می‌شود، و تاریخچهٔ دسترسی که زنجیره‌ای دست‌نخوردنی است، دادهٔ هویتی ندارد و حذف آن زنجیره را می‌شکند.",
          note: {
            label: "چه چیزی را ادعا نمی‌کنیم",
            text: "حذف با امحای کلید («crypto-shredding») انجام نمی‌شود، بلکه با حذف فیزیکی رکورد انجام می‌شود.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "انتقال بین‌المللی و ارائه‌دهندگان خدمات",
          body: "نگهداری و پردازش در اتحادیهٔ اروپا (فرانکفورت) انجام می‌شود. موارد محدودی که از اتحادیهٔ اروپا خارج می‌شوند:",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "مسئولیت بالینی",
          body: "تشخیص، درمان و تصمیم‌های پزشکی از آنِ متخصصان صلاحیت‌دار سلامت است. AURA از ارزیابی، هماهنگی و ارتباط پشتیبانی می‌کند؛ جایگزین پزشک شما نیست. نظر دوم الزام‌آور نیست.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "گزارش نگرانی حریم خصوصی یا امنیت",
          body: "اگر دربارهٔ داده‌هایتان نگرانی یا یافته‌ای امنیتی دارید، به ما بگویید.",
          note: {
            label: "⚖️ پیش‌نویس",
            text: "نشانی تماس مسئول داده هنوز منتشر نشده است؛ به‌محض نهایی‌شدن، این بخش به‌روز می‌شود. تا آن زمان نشانی ساختگی نمی‌نویسیم.",
          },
        },
      ],
      aiEmphasis: "تصمیم پزشکی از آنِ هوش مصنوعی نیست: AURA اطلاعات شما را سامان می‌دهد و تخصص مناسب را پیشنهاد می‌کند؛ تشخیص و تصمیم درمان را متخصصان صلاحیت‌دار سلامت می‌گیرند.",
      transferItems: [
        "ارزیابی اولیه با هوش مصنوعی و خلاصهٔ بالینی (Anthropic، ایالات متحده): نام شما ارسال نمی‌شود — از جانگهدار استفاده می‌شود؛ محتوای بالینی ارسال می‌شود چون جوهرِ کار است.",
        "ترجمهٔ همزمان (Google، ایالات متحده): صدای ویزیت شما برای ترجمه پردازش می‌شود و مشمول رضایت صریح جداگانه است؛ بدون آن رضایت کار نمی‌کند.",
        "رلهٔ اتصال (Cloudflare): تنها رسانهٔ رمزگذاری‌شده را حمل می‌کند.",
        "سیگنالینگ (Ably) و محدودسازی نرخ (Upstash): هیچ دادهٔ سلامتی ارسال نمی‌شود.",
      ],
    },
    hiw: {
      eyebrow: "راهنما",
      word: "AURA",
      wordBefore: "",
      wordAfter: "",
      lineAfter: "چطور کار می‌کند",
      sub: "چهار مسیر، یک پلتفرم. هر گام از ثبت‌نام تا مشاوره، در ادامه توضیح داده شده است.",
      pick: "مسیر خود را انتخاب کنید",
      watch: "راهنما را ببینید",
      step: "گام",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "حساب خود را بسازید", d: "در چند دقیقه با Google، Apple یا ایمیل ثبت‌نام کنید." },
            { t: "پرداخت را کامل کنید", d: "یک هزینه شفاف؛ پرداخت امن با کارت." },
            { t: "علائم خود را شرح دهید", d: "فرم کوتاه هدایت‌شده؛ AURA آنچه را به اشتراک می‌گذارید سامان می‌دهد." },
            { t: "به متخصص سپرده شوید", d: "به پزشکی در تخصص پیشنهادشده ارجاع می‌شوید." },
            { t: "اتاق انتظار دیجیتال", d: "نوبت خود را به‌صورت زنده دنبال کنید." },
            { t: "دیدار تصویری با پزشک", d: "ویزیت ویدیویی رمزگذاری‌شده؛ یادداشت‌ها و گام‌های بعدی در پرونده شما ثبت می‌شود." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "با یک تشخیص شروع کنید", d: "نزد پزشک رفته‌اید و تشخیص یا برنامه درمانی دارید." },
            { t: "وارد AURA شوید", d: "مسیر نظر دوم را باز کنید و پرونده‌تان را بسازید." },
            { t: "فایل‌های خود را بارگذاری کنید", d: "گزارش‌ها، ام‌آرآی و آزمایش‌ها؛ امن و محرمانه." },
            { t: "با استاد دیدار کنید", d: "جلسه ویدیویی با متخصص دانشگاهی باتجربه." },
            { t: "گزارش کتبی بگیرید", d: "گزارش نظر دوم، مفصل و ساختارمند." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "درمان خود را انتخاب کنید", d: "لبخند هالیوودی، کاشت مو، جراحی زیبایی یا یک عمل پزشکی." },
            { t: "گزینه‌های ترکیه را بررسی کنید", d: "کلینیک‌های دارای مجوز گردشگری سلامت و متخصصان را مقایسه کنید." },
            { t: "با متخصصان گفتگو کنید", d: "دیدارهای ویدیویی با پزشکان و مشاوران سلامت." },
            { t: "پیشنهاد خود را دریافت کنید", d: "بسته‌ای شفاف شامل درمان، اقامت و رفت‌وآمد." },
            { t: "با برنامه کامل سفر کنید", d: "پرواز، هتل، عمل و مراقبت پس از آن؛ از ابتدا تا انتها." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "شرایط را بررسی کنید", d: "واجد شرایط بودن به محل زندگی و تخصص موردنیاز بستگی دارد." },
            { t: "آنلاین درخواست دهید", d: "درخواستی کوتاه با شرح وضعیت شما." },
            { t: "با پزشک داوطلب همتا شوید", d: "پزشکی داوطلب در تخصص مناسب پرونده شما را می‌پذیرد." },
            { t: "دیدار ویدیویی", d: "وقتی پزشک آنلاین باشد، ویزیت به‌صورت ویدیویی انجام می‌شود." },
          ],
        },
      ],
    },
  },
  az: {
    nav: { telehealth: "Teletibb", so: "İkinci Rəy", tourism: "Sağlamlıq Turizmi", freecare: "Pulsuz Xidmət", how: "Necə işləyir", cta: "Həkimlə görüş", menu: "Menyu", close: "Menyunu bağla" },
    hero: {
      word: "AURA",
      l1: { a: "Teletibb", mid: " və ", b: "Sağlamlıq Turizmi", tail: "," },
      line2: "başdan sona.",
      cta: "Həkimlə görüş",
      scenes: "01/04 səhnə",
    },
    chapters: [
      { n: "01", key: "consult", strand: "teletibb", title: "Həkimlə danışın.", body: "AURA işinizi hazırlayır və uyğun ixtisas təklif edir.", cta: "məsləhətə başla", href: "/giris", external: false },
      { n: "02", key: "so", strand: "İkinci Rəy", title: "İkinci mütəxəssis baxışı.", body: "Müstəqil mütəxəssislər diaqnozunuzu yenidən dəyərləndirir.", cta: "baxış istə", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "sağlamlıq turizmi", title: "Sağlamlıq turizmi, planlı.", body: "Uçuş, otel, əməliyyat və sonrası tək planda.", cta: "səyahətimi planla", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "pulsuz xidmət", title: "Sağlamlıq haqdır.", body: "Müalicə əlçatmaz olanda könüllü həkimlər köməyə gəlir.", cta: "pulsuz müraciət et", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Mütəxəssislərlə tanış olun.",
      note: "Demo şəbəkəmizdən nümunə heyət.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Kardiologiya" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Nevrologiya" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Ortopediya" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatologiya" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "İVF" },
      ],
    },
    trust: {
      headline: "Etibar məhsulun bir hissəsidir",
      items: [
        { title: "Açıq razılıq", desc: "Sİ dəstəkli addımlardan əvvəl razılığınız təsdiqlənmiş mətn, vaxt möhürü və dəyişdirilməsi aşkarlanan zəncirlə qeyd olunur." },
        { title: "Ötürülmədə və saxlanmada şifrəli", desc: "Sağlamlıq məlumatları ötürülərkən şifrələnir və saxlanmadan əvvəl yenidən şifrələnir." },
        { title: "Rol əsaslı giriş", desc: "Xəstələr, həkimlər, koordinatorlar və tərəfdaşlar yalnız rollarının tələb etdiyini görür." },
        { title: "Həkim sənədlərinin yoxlanması", desc: "Peşə sənədləri həkim görünməzdən əvvəl yoxlanır və təsdiqlənir." },
        { title: "Dəyişdirilməsi aşkarlanan giriş jurnalı", desc: "Klinik məlumatlara hər giriş müstəqil yoxlana bilən zəncirə yazılır." },
        { title: "Əvvəl qiymətləndirmə, sonra öhdəliklər", desc: "Qiymət və səyahət tənzimləmələri klinik qiymətləndirmədən sonra gəlir — heç vaxt ondan əvvəl." },
      ],
    },
    howItWorks: {
      headline: "Necə işləyir",
      note: "Dörd addım, bir davamlı yolçuluq.",
      steps: [
        { title: "Bizə danışın", desc: "Şikayətinizi və ya hədəfinizi öz dilinizdə təsvir edin." },
        { title: "AURA işinizi hazırlayır", desc: "Məlumatlarınız nizamlanır və uyğun ixtisas təklif olunur." },
        { title: "Video görüş", desc: "Həkiminizlə şifrəli video və canlı tərcümə ilə görüşün." },
        { title: "İzləmə", desc: "Hesabatlar, sağalma yoxlamaları və qulluq — hamısı evdən." },
      ],
      safety: "Tibbi qərarları ixtisaslı səhiyyə mütəxəssisləri verir. AURA qiymətləndirmə, koordinasiya və ünsiyyəti dəstəkləyir.",
      cta: "Tam təlimatı görün",
    },
    closing: { headline: "Siz hazır olanda.", cta: "Həkimlə görüş" },
    footer: {
      platform: "Platforma", explore: "Kəşf et", patientLogin: "Xəstə girişi", patientSignup: "Xəstə qeydiyyatı", corporateLogin: "Korporativ giriş", doctorSignup: "Həkim qeydiyyatı", telehealth: "Teletibb", tourism: "Sağlamlıq Turizmi", doctors: "Mütəxəssislər", trust: "Etibar və Məxfilik",
      legal: "© 2026 AURA. MVP demo, tibbi məsləhət deyil.",
    },
    signin: {
      // wordAfter boş — TR ile aynı letterform tuzağı ("AURA -ya xoş gəlmisiniz").
      word: "AURA", wordBefore: "", wordAfter: "", lineAfter: "Xoş gəlmisiniz",
      sub: "Baxım səyahətinizə başlamaq üçün daxil olun",
      google: "Google ilə davam et", apple: "Apple ilə davam et", email: "E-poçt ilə davam et", or: "VƏ YA",
      legal: "Davam etməklə ",
      legalLink: "Etibar və Məxfilik",
      legalAfter: " səhifəsində izah olunan məlumat emalı prinsiplərini qəbul edirsiniz.",
      back: "Ana səhifəyə qayıt",
    },
    corporate: {
      title: "AURA · Korporativ giriş", word: "AURA", wordBefore: "", wordAfter: "", lineAfter: "Korporativ giriş",
      sub: "Rolunuzu seçin və korporativ portala davam edin.",
      roleLabel: "Giriş rolu",
      roles: ["Həkim", "Partnyor Həkim", "Sağlamlıq Mütəxəssisi", "Sağlamlıq Turizmi Agentliyi Əməkdaşı", "Koordinator", "Etika Şurası"],
      continue: "Girişə davam et",
      legal: "Korporativ giriş platformanın təsdiqlənmiş əməkdaşları və tərəfdaşları ilə məhdudlaşır.",
      back: "Ana səhifəyə qayıt",
    },
    v2: {
      nav: {
        care: "Qayğı",
        how: "Necə işləyir",
        trust: "Etibar və məxfilik",
        clinicians: "Həkimlər üçün",
        cta: "Qayğınıza başlayın",
      },
      hero: {
        eyebrow: "Sərhədlərarası rəqəmsal qayğı",
        headline: "Qayğı, sərhədsiz.",
        lede: "Doğru mütəxəssislə görüşün, seçimlərinizi anlayın və qayğınıza olduğunuz yerdən davam edin — ilk qiymətləndirmədən izləməyə qədər çoxdilli dəstəklə.",
        ctaPrimary: "Qayğınıza başlayın",
        ctaSecondary: "AURA necə işləyir",
        safety: "Tibbi qərarları səlahiyyətli səhiyyə mütəxəssisləri verir. AURA qiymətləndirmə, koordinasiya və ünsiyyəti dəstəkləyir.",
      },
      entry: {
        eyebrow: "Bu gün nəyə ehtiyacınız varsa oradan başlayın",
        headline: "Bir qayğı yolu. Başlamağın dörd yolu.",
        intro: "AURA sonrakı addımları sizin ətrafınızda nizamlayır.",
        cards: [
          {
            key: "consult",
            n: "01",
            title: "Həkimlə danışın",
            body: "Şikayətinizi öz dilinizdə danışın. AURA işinizi hazırlayır və uyğun ixtisasa yönləndirir.",
            cta: "Qiymətləndirməyə başla",
          },
          {
            key: "so",
            n: "02",
            title: "İkinci rəy",
            body: "Diaqnozunuzu, təsvirinizi və ya müalicə planınızı müstəqil mütəxəssisə yoxlatın.",
            cta: "İşimi hazırla",
          },
          {
            key: "tourism",
            n: "03",
            title: "Sağlamlıq Turizmi",
            body: "Türkiyədə müalicəni yalnız klinik dəyərləndirmədən sonra araşdırın — səyahət, qiymət və ya rezervasiya təsdiqlənməzdən əvvəl.",
            cta: "Müalicə seçimlərini araşdır",
          },
          {
            key: "freecare",
            n: "04",
            title: "Pulsuz Sağlamlıq Xidməti",
            body: "Məsafə, xərc və ya əlçatanlıq sizinlə qayğı arasına girəndə pulsuz, dəstəkli görüş üçün müraciət edin.",
            cta: "Dəstək üçün müraciət et",
          },
        ],
      },
      ai: {
        eyebrow: "Süni intellektin dayandığı yer",
        headline: "Süni intellekt hazırlayır. Qərarı həkim verir.",
        intro: "AURA süni intellektdən dar bir iş üçün, sizin idarə etdiyiniz razılıq qapısının arxasında istifadə edir.",
        items: [
          {
            key: "decision",
            n: "01",
            title: "Qərar həkiminizindir",
            body: "Süni intellekt bir diaqnoza əməliyyat təklif etdikdə, həkiminiz bunu “təxmini” etiketi ilə görür — və qərarı verir.",
          },
          {
            key: "consent",
            n: "02",
            title: "Süni intellekt emalının öz razılığı var",
            body: "Ümumi məlumatların qorunması razılığından ayrıdır və siz bir dənə də əlamət yazmadan əvvəl soruşulur. Siz verməyincə forma açılmır.",
          },
          {
            key: "minimize",
            n: "03",
            title: "Adınız süni intellekt təchizatçısına heç vaxt çatmır",
            body: "Klinik məzmun süni intellektin işidir, ona görə göndərilir. Adınız isə o iş üçün lazım deyil — sorğu bizdən çıxmazdan əvvəl əvəzlənir və həkiminizin oxuduğu mətndə geri qaytarılır.",
          },
          {
            key: "scope",
            n: "04",
            title: "Dar bir iş",
            body: "Sizi doğru ixtisasa yönəltmək və yüklədiyiniz sənədləri tərcümə etmək. Əhatə bundan ibarətdir.",
          },
        ],
        note: {
          label: "İddia etmədiklərimiz",
          text: "Süni intellekt diaqnoz qoymur, müalicə seçmir, klinik mühakimə yürütmür. Gördüyünüz istənilən süni intellekt nəticəsi təxminidir — həkiminizin qərarına məlumat verir, onu əvəz etmir.",
        },
      },
      accessibility: {
        eyebrow: "Əlçatanlıq",
        headline: "Yalnız görünmək üçün deyil, istifadə oluna bilmək üçün quruldu.",
        intro: "Diliniz, oxuma istiqamətiniz, hərəkət seçiminiz — cihazınızdan oxunur, sizdən iki dəfə soruşulmur.",
        items: [
          {
            key: "languages",
            n: "01",
            title: "Səkkiz dil, ikisi sağdan sola",
            body: "Ərəb və fars dilləri yalnız mətni deyil, bütöv düzümü güzgüləyir.",
          },
          {
            key: "motion",
            n: "02",
            title: "Cihazınızdan az hərəkət istəmisinizsə, eşidirik",
            body: "Kinematik açılış yumşaldılmır — ümumiyyətlə qurulmur. Hər şey oxunaqlı qalır, sürüşdürmə normal işləyir.",
          },
          {
            key: "keyboard",
            n: "03",
            title: "Klaviatura sonradan düşünülmüş bir şey deyil",
            body: "Kartlar yalnız üzərinə gələn siçana deyil, klaviatura fokusuna da cavab verir.",
          },
          {
            key: "resilience",
            n: "04",
            title: "Kodumuz sınarsa, sözlər qalır",
            body: "Mətn hər hansı animasiya işləməzdən əvvəl səhifədədir.",
          },
        ],
        note: {
          label: "İddia etmədiklərimiz",
          text: "WCAG uyğunluğu iddiamız yoxdur — müstəqil auditdən keçməmişik. AURA sözünün altındakı Brayl işarəsi vizual bir brend elementidir; Brayl cihazı və ya ekran oxuyucu dəstəyi demək deyil.",
        },
      },
    },

    trustPage: {
      eyebrow: "etibar",
      word: "AURA",
      // wordAfter boş: "-da" eki letterform'dan ~12px kopuk çizilirdi.
      wordBefore: "",
      wordAfter: "",
      lineAfter: "Etibar və məxfilik.",
      sub: "AURA-da etibar marketinq vədi deyil, məhsulun içində göstərilə bilən bir şeydir. Aşağıda hər başlıq altında nə etdiyimizi, nəyi hələ etmədiyimizi və nəyin bizdən asılı olmadığını ayrıca yazdıq.",
      sections: [
        {
          key: "security",
          n: "01",
          title: "Sağlamlıq məlumatlarınız necə qorunur",
          body: "Məlumatlarınız ötürülmə zamanı şifrələnir; serverə yazılmazdan əvvəl ikinci dəfə, ayrıca açarla şifrələnir. Yüklədiyiniz hesabatlar və görüntülər anbara artıq şifrələnmiş halda çatır — anbar təchizatçısı yalnız şifrələnmiş formanı görür. Məlumatlarınız Avropa İttifaqında (Frankfurt) saxlanılır və emal olunur.",
          note: {
            label: "Nəyi iddia etmirik",
            text: "Bu, «uçdan-uca şifrələmə» deyil. Açar bizim serverlərimizdə idarə olunur — çünki klinik xülasə, tərcümə və həkim görünüşü məlumatın serverdə emalını tələb edir. Həqiqətən uçdan-uca şifrələnmiş sistem bu funksiyaları verə bilməzdi.",
          },
        },
        {
          key: "consent",
          n: "02",
          title: "Razılıq və süni intellekt",
          body: "Üç ayrı razılıq alınır və heç biri digərini əvəz etmir: ümumi məlumatların qorunması razılığı · şikayətinizin süni intellektlə ilkin qiymətləndirilməsi · görüşünüzün süni intellektlə sinxron tərcüməsi. Hər razılıqda təsdiqlədiyiniz mətnin eynisi, təsdiq anınız və sonradan dəyişdirilmədiyini göstərən zəncir saxlanılır. Razılıq olmadan heç bir addım başlamır — forma açılmır, kamera icazəsi istənilmir. Öz razılıq qeydinizi istənilən vaxt görə bilərsiniz.",
          note: { label: "", text: "" },
        },
        {
          key: "access",
          n: "03",
          title: "Kim nəyi görür",
          body: "Giriş rola bağlıdır: xəstə yalnız öz qeydlərini görür · həkim yalnız təsdiqlənmişdirsə və işə təyin olunubsa · tərəfdaş həkimin xəstə bazasına ümumiyyətlə girişi yoxdur və ona ötürülən sualda şəxs adları maskalanır · koordinator və agentlik logistik məlumatı görür, klinik qeydi yox. Əməliyyatdan sonrakı müşahidəniz bitdikdə klinik heyətin girişi bağlanır və qeyd yalnız sizdə qalır; istəsəniz yenidən açırsınız.",
          note: { label: "", text: "" },
        },
        {
          key: "doctors",
          n: "04",
          title: "Həkim təsdiqi",
          body: "Həkim görünməzdən və hər hansı xəstə təyinatı almazdan əvvəl peşə sənədlərini yükləyir — diplom, ixtisas sənədi və peşə məsuliyyət sığortası — və bunlar yoxlanılıb təsdiqlənir. Təsdiqlənməmiş həkimin profili yayımlanmır.",
          note: {
            label: "Nəyi iddia etmirik",
            text: "«Akkreditə olunmuş həkim» demirik — yoxladığımız şey sənədlərin mövcudluğu və etibarlılığıdır.",
          },
        },
        {
          key: "video",
          n: "05",
          title: "Video, sənədlər və paylaşma",
          body: "Görüşləriniz qeydə alınmır. Video və səs WebRTC ilə şifrələnir; birbaşa əlaqə qurulmadıqda işə düşən rele serveri yalnız şifrələnmiş trafiki daşıyır və məzmununu görə bilmir. Qeydlərinizi paylaşarkən hansı kateqoriyaların görünəcəyini siz seçirsiniz; müddət qoya, parol əlavə edə, yükləməni söndürə və linki istənilən an ləğv edə bilərsiniz. Hər giriş qeydə alınır.",
          note: { label: "", text: "" },
        },
        {
          key: "audit",
          n: "06",
          title: "Audit və giriş tarixçəsi",
          body: "Klinik məlumatınıza edilən hər mənalı giriş sonradan silinə və dəyişdirilə bilməyən bir zəncirə yazılır və müstəqil şəkildə yoxlana bilər.",
          note: {
            label: "Həddi",
            text: "Audit qeydi tətbiqi bloklamayacaq şəkildə hazırlanıb — qeyd yazıla bilmirsə, əməliyyat yenə tamamlanır. Siqnallaşma kimi yüksək tezlikli texniki hadisələr qəsdən qeyd edilmir.",
          },
        },
        {
          key: "retention",
          n: "07",
          title: "Saxlanma və silinmə",
          body: "Hesabınızı və şəxsi məlumatlarınızı silə bilərsiniz. Bu zaman e-poçtunuz, adınız, telefonunuz, profiliniz və bildirişləriniz həqiqətən silinir, paylaşım linkləriniz ləğv olunur və giriş mümkünsüz olur. Sağlamlıq qeydləriniz qanuni saxlanma müddəti boyunca — 20 il — saxlanmalıdır; lakin girişə bağlanır (heç kim aça bilmir: nə həkimlər, nə koordinatorlar, nə inzibatçılar, nə də siz) və müddət bitdikdə avtomatik məhv edilir. İki şey qəsdən saxlanılır: saxladığımızın hüquqi əsasını sübut edən və qeydlərlə birlikdə məhv edilən razılıq qeydləriniz, və giriş tarixçəsi — dəyişdirilə bilməyən audit zənciridir, kimlik məlumatı daşımır və silinməsi zənciri qırar.",
          note: {
            label: "Nəyi iddia etmirik",
            text: "Silinmə açarın məhv edilməsi («crypto-shredding») ilə deyil, qeydin fiziki olaraq silinməsi ilə həyata keçirilir.",
          },
        },
        {
          key: "transfers",
          n: "08",
          title: "Beynəlxalq ötürmə və xidmət təchizatçıları",
          body: "Saxlanma və emal Avropa İttifaqında (Frankfurt) baş verir. Aİ-dən kənara çıxan məhdud hallar:",
          note: { label: "", text: "" },
        },
        {
          key: "responsibility",
          n: "09",
          title: "Klinik məsuliyyət",
          body: "Diaqnoz, müalicə və tibbi qərarlar səlahiyyətli səhiyyə mütəxəssislərinə aiddir. AURA qiymətləndirməni, koordinasiyanı və ünsiyyəti dəstəkləyir; həkiminizi əvəz etmir. İkinci rəy məcburi deyil.",
          note: { label: "", text: "" },
        },
        {
          key: "report",
          n: "10",
          title: "Məxfilik və ya təhlükəsizlik narahatlığını bildirin",
          body: "Məlumatlarınızla bağlı narahatlığınız və ya təhlükəsizlik tapıntınız varsa, bizə bildirin.",
          note: {
            label: "⚖️ Layihə",
            text: "Məlumat operatorunun əlaqə ünvanı hələ dərc olunmayıb; ünvan dəqiqləşdikdə bu bölmə yenilənəcək. O vaxta qədər uydurma ünvan yazmırıq.",
          },
        },
      ],
      aiEmphasis: "Tibbi qərar süni intellektə aid deyil: AURA məlumatlarınızı nizamlayır və uyğun ixtisası təklif edir; diaqnoz və müalicə qərarını səlahiyyətli səhiyyə mütəxəssisləri verir.",
      transferItems: [
        "Süni intellektlə ilkin qiymətləndirmə və klinik xülasə (Anthropic, ABŞ): adınız göndərilmir — yer tutucu istifadə olunur; klinik məzmun tapşırığın mahiyyəti olduğu üçün göndərilir.",
        "Sinxron tərcümə (Google, ABŞ): görüşünüzün səsi tərcümə üçün emal olunur və ayrıca açıq razılığa tabedir; həmin razılıq olmadan işləmir.",
        "Bağlantı relesi (Cloudflare): yalnız şifrələnmiş medianı daşıyır.",
        "Siqnallaşma (Ably) və sürət məhdudlaşdırma (Upstash): sağlamlıq məlumatı göndərilmir.",
      ],
    },
    hiw: {
      eyebrow: "bələdçi",
      word: "AURA",
      wordBefore: "",
      wordAfter: "",
      lineAfter: "necə işləyir?",
      sub: "Dörd yol, tək platforma. Qeydiyyatdan görüşə qədər hər addım, aşağıda izah olunub.",
      pick: "Yolunuzu seçin",
      watch: "bələdçiyə baxın",
      step: "addım",
      guides: [
        {
          key: "consult",
          steps: [
            { t: "Hesabınızı yaradın", d: "Google, Apple və ya e-poçt ilə dəqiqələr içində qeydiyyatdan keçin." },
            { t: "Ödənişi tamamlayın", d: "Tək və şəffaf ödəniş; kartla təhlükəsiz ödəyin." },
            { t: "Simptomlarınızı təsvir edin", d: "Qısa yönləndirilmiş form; AURA paylaşdıqlarınızı nizamlayır." },
            { t: "Mütəxəssisə yönləndirilin", d: "Təklif olunan ixtisasdan bir həkimə təyin olunursunuz." },
            { t: "Rəqəmsal gözləmə otağı", d: "Növbənizi real vaxtda izləyin." },
            { t: "Həkimlə video görüş", d: "Şifrəli video görüş; qeydlər və növbəti addımlar faylınıza yazılır." },
          ],
        },
        {
          key: "so",
          steps: [
            { t: "Diaqnozla başlayın", d: "Həkimə getmisiniz; diaqnozunuz və ya müalicə planınız var." },
            { t: "AURA-ya daxil olun", d: "İkinci Rəy axınını açın və işinizi yaradın." },
            { t: "Fayllarınızı yükləyin", d: "Hesabatlar, MRT və analizlər; təhlükəsiz və məxfi." },
            { t: "Professorla görüşün", d: "Təcrübəli akademik mütəxəssislə video seans." },
            { t: "Yazılı hesabat alın", d: "Ətraflı, strukturlaşdırılmış ikinci rəy hesabatı." },
          ],
        },
        {
          key: "tourism",
          steps: [
            { t: "Müalicənizi seçin", d: "Hollivud gülüşü, saç əkimi, estetik əməliyyat və ya tibbi əməliyyat." },
            { t: "Türkiyədəki seçimləri kəşf edin", d: "Sağlamlıq turizmi icazəli klinikaları və mütəxəssisləri müqayisə edin." },
            { t: "Mütəxəssislərlə danışın", d: "Həkimlər və sağlamlıq məsləhətçiləri ilə video görüşlər." },
            { t: "Təklifinizi alın", d: "Müalicə, qalma və logistikanı əhatə edən aydın paket." },
            { t: "Tam planla yola çıxın", d: "Uçuş, otel, əməliyyat və sonrakı qulluq; başdan sona planlı." },
          ],
        },
        {
          key: "freecare",
          steps: [
            { t: "Şərtləri yoxlayın", d: "Uyğunluq yaşadığınız yerə və lazım olan ixtisasa görə müəyyən olunur." },
            { t: "Onlayn müraciət edin", d: "Vəziyyətinizi qısaca təsvir edən müraciət." },
            { t: "Könüllü həkimlə eşləşin", d: "Uyğun ixtisasdan könüllü həkim işinizi götürür." },
            { t: "Video görüş", d: "Həkiminiz onlayn olduqda görüş video ilə keçirilir." },
          ],
        },
      ],
    },
  },
};

export type Copy = (typeof COPY)["en"];
