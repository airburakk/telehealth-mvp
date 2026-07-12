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
export const LINKS = {
  platformLogin: "/giris",
  googleStart: "/api/auth/google/start?intent=patient",
  platformSignup: "/kayit/hasta",
  secondOpinion: "/second-opinion",
  freeCare: "/ucretsiz-saglik",
  corporateLogin: "/kurumsal-giris",
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
  consult: {
    src: "/assets/video/v-consult.mp4",
    src720: "/assets/video/v-consult-720.mp4",
    poster: "/assets/video/p-consult.jpg",
    scrub: "/assets/video/v-consult-k720.mp4",
  },
  so: {
    src: "/assets/video/v-so.mp4",
    src720: "/assets/video/v-so-720.mp4",
    poster: "/assets/video/p-so.jpg",
    scrub: "/assets/video/v-so-k720.mp4",
  },
  tourism: {
    src: "/assets/video/v-tourism.mp4",
    src720: "/assets/video/v-tourism-720.mp4",
    poster: "/assets/video/p-tourism.jpg",
    scrub: "/assets/video/v-tourism-k720.mp4",
  },
  freecare: {
    src: "/assets/video/v-freecare.mp4",
    src720: "/assets/video/v-freecare-720.mp4",
    poster: "/assets/video/p-freecare.jpg",
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
      freecare: "Free Health Care",
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
        body: "AI triage routes you to the right specialist in minutes.",
        cta: "enter consult",
        href: "/giris",
        external: false,
      },
      {
        n: "02",
        key: "so",
        strand: "Second Opinion",
        title: "A second set of eyes.",
        body: "Independent accredited specialists review your diagnosis.",
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
        strand: "Free Health Care",
        title: "Health is a right.",
        body: "Volunteer doctors step in when care is out of reach.",
        cta: "apply for free health care",
        href: LINKS.freeCare,
        external: true,
      },
    ],
    doctors: {
      headline: "Meet the specialists.",
      note: "Sample roster from our demo network.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Cardiology", tag: "[cardiology]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Neurology", tag: "[neurology]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Orthopedics", tag: "[orthopedics]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatology", tag: "[dermatology]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "IVF", tag: "[reproductive medicine]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "k+", label: "patients" },
        { value: 40, suffix: "+", label: "clinics" },
        { value: 4.9, suffix: "", label: "rating" },
      ],
      footnote: "* demo data",
      quote: "From the first video call to the follow-ups at home, everything was organised.",
      attribName: "James W.",
      attribRole: "Hair transplant, London",
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
      legal: "By continuing, you acknowledge the platform's Privacy Policy and agree to its Terms of Use.",
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
            { t: "Describe your symptoms", d: "A short guided form; AI triage reads it instantly." },
            { t: "Get matched to a specialist", d: "You are assigned to the right doctor for your case." },
            { t: "Wait in the digital lounge", d: "Follow your place in the digital waiting room in real time." },
            { t: "Meet your doctor on video", d: "A secure video visit; notes and next steps are saved to your file." },
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
            { t: "Explore options in Türkiye", d: "Compare accredited clinics and specialists for your case." },
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
        body: "Yapay zeka triyajı sizi dakikalar içinde doğru uzmana yönlendirir.",
        cta: "görüşmeye başla",
        href: "/giris",
        external: false,
      },
      {
        n: "02",
        key: "so",
        strand: "İkinci Görüş",
        title: "İkinci bir uzman gözü.",
        body: "Bağımsız, akredite uzmanlar tanınızı yeniden değerlendirir.",
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
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Kardiyoloji", tag: "[kardiyoloji]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Nöroloji", tag: "[nöroloji]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Ortopedi", tag: "[ortopedi]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatoloji", tag: "[dermatoloji]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "Tüp bebek", tag: "[üreme sağlığı]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "b+", label: "hasta" },
        { value: 40, suffix: "+", label: "klinik" },
        { value: 4.9, suffix: "", label: "puan" },
      ],
      footnote: "* demo verisi",
      quote: "İlk video görüşmesinden evdeki takiplere kadar her şey organizeydi.",
      attribName: "James W.",
      attribRole: "Saç ekimi, Londra",
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
      legal: "© 2026 AURA. MVP demo, tıbbi tavsiye değildir.",
    },
    signin: {
      word: "AURA",
      wordBefore: "",
      wordAfter: "'ya",
      lineAfter: "hoş geldiniz",
      sub: "Bakım yolculuğunuza başlamak için giriş yapın",
      google: "Google ile devam et",
      apple: "Apple ile devam et",
      email: "E-posta ile devam et",
      or: "VEYA",
      legal: "Devam ederek platformun Gizlilik Politikasını kabul etmiş ve Kullanım Koşullarını onaylamış olursunuz.",
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
            { t: "Semptomlarınızı anlatın", d: "Kısa yönlendirmeli form; yapay zeka triyajı anında değerlendirir." },
            { t: "Doğru uzmana atanın", d: "Vakanıza uygun doktora yönlendirilirsiniz." },
            { t: "Dijital bekleme odasında bekleyin", d: "Sıranızı gerçek zamanlı takip edin." },
            { t: "Doktorunuzla görüntülü görüşün", d: "Güvenli video görüşme; notlar ve sonraki adımlar dosyanıza işlenir." },
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
            { t: "Türkiye'deki seçenekleri keşfedin", d: "Akredite klinikleri ve uzmanları vakanız için karşılaştırın." },
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
      { n: "01", key: "consult", strand: "telemedizin", title: "Sprechen Sie mit einem Arzt.", body: "KI-Triage führt Sie in Minuten zum richtigen Facharzt.", cta: "beratung starten", href: "/giris", external: false },
      { n: "02", key: "so", strand: "Zweitmeinung", title: "Ein zweites Paar Augen.", body: "Unabhängige, akkreditierte Fachärzte prüfen Ihre Diagnose.", cta: "prüfung anfordern", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "gesundheitstourismus", title: "Gesundheitstourismus, geplant.", body: "Flug, Hotel, Operation und Nachsorge in einem Plan.", cta: "reise planen", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "kostenlose Versorgung", title: "Gesundheit ist ein Recht.", body: "Freiwillige Ärzte helfen, wenn Versorgung unerreichbar ist.", cta: "kostenlos bewerben", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Lernen Sie die Fachärzte kennen.",
      note: "Beispielkader aus unserem Demo-Netzwerk.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Kardiologie", tag: "[kardiologie]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Neurologie", tag: "[neurologie]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Orthopädie", tag: "[orthopädie]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatologie", tag: "[dermatologie]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "IVF", tag: "[reproduktionsmedizin]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "k+", label: "Patienten" },
        { value: 40, suffix: "+", label: "Kliniken" },
        { value: 4.9, suffix: "", label: "Bewertung" },
      ],
      footnote: "* Demodaten",
      quote: "Vom ersten Videogespräch bis zur Nachsorge zu Hause war alles organisiert.",
      attribName: "James W.",
      attribRole: "Haartransplantation, London",
    },
    closing: { headline: "Bereit, wenn Sie es sind.", cta: "Arzt sprechen" },
    footer: {
      platform: "Plattform", explore: "Entdecken", patientLogin: "Patienten-Login", patientSignup: "Patienten-Registrierung", corporateLogin: "Firmen-Login", doctorSignup: "Arzt-Registrierung", telehealth: "Telemedizin", tourism: "Gesundheitstourismus", doctors: "Fachärzte",
      legal: "© 2026 AURA. MVP-Demo, keine medizinische Beratung.",
    },
    signin: {
      word: "AURA", wordBefore: "Willkommen bei", wordAfter: "", lineAfter: "",
      sub: "Melden Sie sich an und beginnen Sie Ihre Behandlungsreise",
      google: "Weiter mit Google", apple: "Weiter mit Apple", email: "Weiter mit E-Mail", or: "ODER",
      legal: "Mit dem Fortfahren erkennen Sie die Datenschutzerklärung der Plattform an und stimmen den Nutzungsbedingungen zu.",
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
            { t: "Symptome beschreiben", d: "Ein kurzes geführtes Formular; die KI-Triage wertet sofort aus." },
            { t: "Dem richtigen Facharzt zugewiesen", d: "Sie werden dem passenden Arzt für Ihren Fall zugeteilt." },
            { t: "Im digitalen Wartezimmer", d: "Verfolgen Sie Ihren Platz in Echtzeit." },
            { t: "Videogespräch mit dem Arzt", d: "Sicherer Videotermin; Notizen und nächste Schritte in Ihrer Akte." },
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
            { t: "Optionen in der Türkei entdecken", d: "Vergleichen Sie akkreditierte Kliniken und Spezialisten." },
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
      { n: "01", key: "consult", strand: "télésanté", title: "Parlez à un médecin.", body: "Le triage par IA vous oriente vers le bon spécialiste en quelques minutes.", cta: "démarrer la consultation", href: "/giris", external: false },
      { n: "02", key: "so", strand: "Deuxième avis", title: "Un deuxième regard d'expert.", body: "Des spécialistes indépendants et accrédités réévaluent votre diagnostic.", cta: "demander un examen", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "tourisme médical", title: "Tourisme médical, planifié.", body: "Vol, hôtel, chirurgie et suivi dans un seul plan.", cta: "planifier mon voyage", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "soins gratuits", title: "La santé est un droit.", body: "Des médecins bénévoles interviennent quand les soins sont hors de portée.", cta: "demander des soins gratuits", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Rencontrez les spécialistes.",
      note: "Effectif d'exemple de notre réseau de démonstration.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Cardiologie", tag: "[cardiologie]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Neurologie", tag: "[neurologie]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Orthopédie", tag: "[orthopédie]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatologie", tag: "[dermatologie]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "FIV", tag: "[médecine reproductive]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "k+", label: "patients" },
        { value: 40, suffix: "+", label: "cliniques" },
        { value: 4.9, suffix: "", label: "note" },
      ],
      footnote: "* données de démonstration",
      quote: "Du premier appel vidéo aux suivis à domicile, tout était organisé.",
      attribName: "James W.",
      attribRole: "Greffe de cheveux, Londres",
    },
    closing: { headline: "Prêts quand vous l'êtes.", cta: "Consulter un médecin" },
    footer: {
      platform: "Plateforme", explore: "Explorer", patientLogin: "Connexion patient", patientSignup: "Inscription patient", corporateLogin: "Connexion professionnelle", doctorSignup: "Inscription médecin", telehealth: "Télésanté", tourism: "Tourisme médical", doctors: "Spécialistes",
      legal: "© 2026 AURA. Démo MVP, ne constitue pas un avis médical.",
    },
    signin: {
      word: "AURA", wordBefore: "Bienvenue chez", wordAfter: "", lineAfter: "",
      sub: "Connectez-vous pour commencer votre parcours de soins",
      google: "Continuer avec Google", apple: "Continuer avec Apple", email: "Continuer avec l'e-mail", or: "OU",
      legal: "En continuant, vous reconnaissez la politique de confidentialité de la plateforme et acceptez ses conditions d'utilisation.",
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
            { t: "Décrivez vos symptômes", d: "Un court formulaire guidé ; le triage par IA l'évalue aussitôt." },
            { t: "Orienté vers le bon spécialiste", d: "Vous êtes affecté au médecin adapté à votre cas." },
            { t: "Salle d'attente numérique", d: "Suivez votre place en temps réel." },
            { t: "Consultation vidéo", d: "Visite vidéo sécurisée ; notes et prochaines étapes dans votre dossier." },
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
            { t: "Explorez les options en Türkiye", d: "Comparez cliniques accréditées et spécialistes pour votre cas." },
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
      { n: "01", key: "consult", strand: "телемедицина", title: "Поговорите с врачом.", body: "ИИ-триаж за минуты направит вас к нужному специалисту.", cta: "начать консультацию", href: "/giris", external: false },
      { n: "02", key: "so", strand: "Второе мнение", title: "Свежий взгляд специалиста.", body: "Независимые аккредитованные врачи пересмотрят ваш диагноз.", cta: "запросить пересмотр", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "медицинский туризм", title: "Медицинский туризм — по плану.", body: "Перелёт, отель, операция и восстановление в одном плане.", cta: "спланировать поездку", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "бесплатная помощь", title: "Здоровье — это право.", body: "Врачи-волонтёры помогают, когда лечение недоступно.", cta: "подать заявку", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Познакомьтесь со специалистами.",
      note: "Примерный состав из нашей демо-сети.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Кардиология", tag: "[кардиология]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Неврология", tag: "[неврология]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Ортопедия", tag: "[ортопедия]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Дерматология", tag: "[дерматология]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "ЭКО", tag: "[репродуктивная медицина]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "тыс+", label: "пациентов" },
        { value: 40, suffix: "+", label: "клиник" },
        { value: 4.9, suffix: "", label: "рейтинг" },
      ],
      footnote: "* демо-данные",
      quote: "От первого видеозвонка до наблюдения дома — всё было организовано.",
      attribName: "James W.",
      attribRole: "Пересадка волос, Лондон",
    },
    closing: { headline: "Мы готовы, когда готовы вы.", cta: "Поговорить с врачом" },
    footer: {
      platform: "Платформа", explore: "Обзор", patientLogin: "Вход для пациентов", patientSignup: "Регистрация пациента", corporateLogin: "Корпоративный вход", doctorSignup: "Регистрация врача", telehealth: "Телемедицина", tourism: "Медицинский туризм", doctors: "Специалисты",
      legal: "© 2026 AURA. MVP-демо, не является медицинской рекомендацией.",
    },
    signin: {
      word: "AURA", wordBefore: "Добро пожаловать в", wordAfter: "", lineAfter: "",
      sub: "Войдите, чтобы начать путь к лечению",
      google: "Продолжить с Google", apple: "Продолжить с Apple", email: "Продолжить по эл. почте", or: "ИЛИ",
      legal: "Продолжая, вы принимаете Политику конфиденциальности платформы и соглашаетесь с Условиями использования.",
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
            { t: "Опишите симптомы", d: "Короткая анкета; ИИ-триаж мгновенно её оценивает." },
            { t: "Назначение к специалисту", d: "Вас направляют к врачу, подходящему для вашего случая." },
            { t: "Цифровая комната ожидания", d: "Следите за своей очередью в реальном времени." },
            { t: "Видеоконсультация с врачом", d: "Защищённый видеоприём; заметки и дальнейшие шаги в вашей карте." },
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
            { t: "Изучите варианты в Турции", d: "Сравните аккредитованные клиники и специалистов." },
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
      { n: "01", key: "consult", strand: "الرعاية عن بُعد", title: "تحدث إلى طبيب.", body: "الفرز بالذكاء الاصطناعي يوجهك إلى الأخصائي المناسب خلال دقائق.", cta: "ابدأ الاستشارة", href: "/giris", external: false },
      { n: "02", key: "so", strand: "رأي ثانٍ", title: "عين خبيرة ثانية.", body: "أخصائيون مستقلون معتمدون يراجعون تشخيصك.", cta: "اطلب مراجعة", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "السياحة العلاجية", title: "سياحة علاجية مخطط لها.", body: "الطيران والفندق والجراحة والمتابعة في خطة واحدة.", cta: "خطط رحلتي", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "رعاية مجانية", title: "الصحة حق.", body: "أطباء متطوعون يتدخلون عندما تتعذر الرعاية.", cta: "قدّم للرعاية المجانية", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "تعرّف على الأخصائيين.",
      note: "كادر نموذجي من شبكتنا التجريبية.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "أمراض القلب", tag: "[أمراض القلب]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "طب الأعصاب", tag: "[طب الأعصاب]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "جراحة العظام", tag: "[جراحة العظام]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "الأمراض الجلدية", tag: "[الأمراض الجلدية]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "أطفال الأنابيب", tag: "[طب الإنجاب]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "ألف+", label: "مريض" },
        { value: 40, suffix: "+", label: "عيادة" },
        { value: 4.9, suffix: "", label: "التقييم" },
      ],
      footnote: "* بيانات تجريبية",
      quote: "من أول مكالمة فيديو إلى المتابعة في المنزل، كان كل شيء منظمًا.",
      attribName: "James W.",
      attribRole: "زراعة شعر، لندن",
    },
    closing: { headline: "جاهزون متى كنت جاهزًا.", cta: "تحدث إلى طبيب" },
    footer: {
      platform: "المنصة", explore: "استكشف", patientLogin: "دخول المرضى", patientSignup: "تسجيل المرضى", corporateLogin: "الدخول المؤسسي", doctorSignup: "تسجيل الأطباء", telehealth: "الرعاية عن بُعد", tourism: "السياحة العلاجية", doctors: "الأخصائيون",
      legal: "© 2026 AURA. عرض تجريبي (MVP)، وليس نصيحة طبية.",
    },
    signin: {
      word: "AURA", wordBefore: "مرحبًا بك في", wordAfter: "", lineAfter: "",
      sub: "سجّل الدخول لبدء رحلة رعايتك",
      google: "المتابعة عبر Google", apple: "المتابعة عبر Apple", email: "المتابعة عبر البريد الإلكتروني", or: "أو",
      legal: "بالمتابعة، فإنك تقر بسياسة الخصوصية الخاصة بالمنصة وتوافق على شروط الاستخدام.",
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
            { t: "صف أعراضك", d: "نموذج قصير موجّه؛ يقيّمه الفرز بالذكاء الاصطناعي فورًا." },
            { t: "التوجيه إلى الأخصائي المناسب", d: "تُسند حالتك إلى الطبيب الأنسب لها." },
            { t: "غرفة الانتظار الرقمية", d: "تابع دورك لحظة بلحظة." },
            { t: "قابل طبيبك عبر الفيديو", d: "زيارة فيديو آمنة؛ تُحفظ الملاحظات والخطوات التالية في ملفك." },
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
            { t: "استكشف الخيارات في تركيا", d: "قارن العيادات المعتمدة والأخصائيين لحالتك." },
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
      { n: "01", key: "consult", strand: "سلامت از راه دور", title: "با پزشک صحبت کنید.", body: "تریاژ هوش مصنوعی شما را در چند دقیقه به متخصص درست می‌رساند.", cta: "شروع مشاوره", href: "/giris", external: false },
      { n: "02", key: "so", strand: "نظر دوم", title: "نگاه دومِ یک متخصص.", body: "متخصصان مستقل و معتبر تشخیص شما را بازبینی می‌کنند.", cta: "درخواست بازبینی", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "گردشگری سلامت", title: "گردشگری سلامت، برنامه‌ریزی‌شده.", body: "پرواز، هتل، جراحی و مراقبت پس از آن در یک برنامه.", cta: "برنامه‌ریزی سفر من", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "مراقبت رایگان", title: "سلامت یک حق است.", body: "وقتی درمان در دسترس نیست، پزشکان داوطلب وارد می‌شوند.", cta: "درخواست مراقبت رایگان", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "با متخصصان آشنا شوید.",
      note: "کادر نمونه از شبکه نمایشی ما.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "قلب و عروق", tag: "[قلب و عروق]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "مغز و اعصاب", tag: "[مغز و اعصاب]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "ارتوپدی", tag: "[ارتوپدی]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "پوست", tag: "[پوست]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "آی‌وی‌اف", tag: "[پزشکی باروری]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "هزار+", label: "بیمار" },
        { value: 40, suffix: "+", label: "کلینیک" },
        { value: 4.9, suffix: "", label: "امتیاز" },
      ],
      footnote: "* داده نمایشی",
      quote: "از اولین تماس تصویری تا پیگیری‌های خانه، همه چیز منظم بود.",
      attribName: "James W.",
      attribRole: "کاشت مو، لندن",
    },
    closing: { headline: "هر وقت آماده بودید، ما هستیم.", cta: "با پزشک صحبت کنید" },
    footer: {
      platform: "پلتفرم", explore: "کاوش", patientLogin: "ورود بیمار", patientSignup: "ثبت‌نام بیمار", corporateLogin: "ورود سازمانی", doctorSignup: "ثبت‌نام پزشک", telehealth: "سلامت از راه دور", tourism: "گردشگری سلامت", doctors: "متخصصان",
      legal: "© 2026 AURA. دموی MVP؛ توصیه پزشکی نیست.",
    },
    signin: {
      word: "AURA", wordBefore: "به", wordAfter: "", lineAfter: "خوش آمدید",
      sub: "برای شروع مسیر درمان خود وارد شوید",
      google: "ادامه با Google", apple: "ادامه با Apple", email: "ادامه با ایمیل", or: "یا",
      legal: "با ادامه، سیاست حفظ حریم خصوصی پلتفرم را می‌پذیرید و با شرایط استفاده موافقت می‌کنید.",
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
            { t: "علائم خود را شرح دهید", d: "فرم کوتاه هدایت‌شده؛ تریاژ هوش مصنوعی فوراً ارزیابی می‌کند." },
            { t: "به متخصص مناسب سپرده شوید", d: "به پزشک مناسب پرونده‌تان ارجاع می‌شوید." },
            { t: "اتاق انتظار دیجیتال", d: "نوبت خود را به‌صورت زنده دنبال کنید." },
            { t: "دیدار تصویری با پزشک", d: "ویزیت ویدیویی امن؛ یادداشت‌ها و گام‌های بعدی در پرونده شما ثبت می‌شود." },
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
            { t: "گزینه‌های ترکیه را بررسی کنید", d: "کلینیک‌های معتبر و متخصصان را مقایسه کنید." },
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
      { n: "01", key: "consult", strand: "teletibb", title: "Həkimlə danışın.", body: "Sİ triajı sizi dəqiqələr içində düzgün mütəxəssisə yönləndirir.", cta: "məsləhətə başla", href: "/giris", external: false },
      { n: "02", key: "so", strand: "İkinci Rəy", title: "İkinci mütəxəssis baxışı.", body: "Müstəqil, akkreditə olunmuş mütəxəssislər diaqnozunuzu yenidən dəyərləndirir.", cta: "baxış istə", href: LINKS.secondOpinion, external: true },
      { n: "03", key: "tourism", strand: "sağlamlıq turizmi", title: "Sağlamlıq turizmi, planlı.", body: "Uçuş, otel, əməliyyat və sonrası tək planda.", cta: "səyahətimi planla", href: "/giris", external: false },
      { n: "04", key: "freecare", strand: "pulsuz xidmət", title: "Sağlamlıq haqdır.", body: "Müalicə əlçatmaz olanda könüllü həkimlər köməyə gəlir.", cta: "pulsuz müraciət et", href: LINKS.freeCare, external: true },
    ],
    doctors: {
      headline: "Mütəxəssislərlə tanış olun.",
      note: "Demo şəbəkəmizdən nümunə heyət.",
      list: [
        { img: "doc-cardio", name: "Dr. Mehmet Yılmaz", field: "Kardiologiya", tag: "[kardiologiya]" },
        { img: "doc-neuro", name: "Dr. Ayşe Kaya", field: "Nevrologiya", tag: "[nevrologiya]" },
        { img: "doc-ortho", name: "Dr. Can Demir", field: "Ortopediya", tag: "[ortopediya]" },
        { img: "doc-derm", name: "Dr. Elif Öztürk", field: "Dermatologiya", tag: "[dermatologiya]" },
        { img: "doc-ivf", name: "Dr. Murat Çelik", field: "İVF", tag: "[reproduktiv tibb]" },
      ],
    },
    trust: {
      metrics: [
        { value: 20, suffix: "min+", label: "xəstə" },
        { value: 40, suffix: "+", label: "klinika" },
        { value: 4.9, suffix: "", label: "reytinq" },
      ],
      footnote: "* demo verilənləri",
      quote: "İlk video zəngdən evdəki izləmələrə qədər hər şey mütəşəkkil idi.",
      attribName: "James W.",
      attribRole: "Saç əkimi, London",
    },
    closing: { headline: "Siz hazır olanda.", cta: "Həkimlə görüş" },
    footer: {
      platform: "Platforma", explore: "Kəşf et", patientLogin: "Xəstə girişi", patientSignup: "Xəstə qeydiyyatı", corporateLogin: "Korporativ giriş", doctorSignup: "Həkim qeydiyyatı", telehealth: "Teletibb", tourism: "Sağlamlıq Turizmi", doctors: "Mütəxəssislər",
      legal: "© 2026 AURA. MVP demo, tibbi məsləhət deyil.",
    },
    signin: {
      word: "AURA", wordBefore: "", wordAfter: "-ya", lineAfter: "xoş gəlmisiniz",
      sub: "Baxım səyahətinizə başlamaq üçün daxil olun",
      google: "Google ilə davam et", apple: "Apple ilə davam et", email: "E-poçt ilə davam et", or: "VƏ YA",
      legal: "Davam etməklə platformanın Məxfilik Siyasətini qəbul etmiş və İstifadə Şərtlərini təsdiqləmiş olursunuz.",
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
            { t: "Simptomlarınızı təsvir edin", d: "Qısa yönləndirilmiş form; Sİ triajı dərhal qiymətləndirir." },
            { t: "Düzgün mütəxəssisə yönləndirilin", d: "Vəziyyətinizə uyğun həkimə təyin olunursunuz." },
            { t: "Rəqəmsal gözləmə otağı", d: "Növbənizi real vaxtda izləyin." },
            { t: "Həkimlə video görüş", d: "Təhlükəsiz video görüş; qeydlər və növbəti addımlar faylınıza yazılır." },
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
            { t: "Türkiyədəki seçimləri kəşf edin", d: "Akkreditə olunmuş klinikaları və mütəxəssisləri müqayisə edin." },
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
