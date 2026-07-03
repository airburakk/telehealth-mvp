// Landing statik kopyası — 8 dil (kullanıcı kararı 2026-07-03: TR·EN·DE·FR·RU·AR·FA·AZ).
// Landing halka açık → auth'lu /api/i18n KULLANILAMAZ; pazarlama metni küratörlü olmalı →
// statik gömülü desen (error-i18n.ts ile aynı yaklaşım). Ağ/DB yok, saf veri modülü.
// ⚠️ Çeviriler LLM yazımıdır — yayın öncesi ana-dil gözden geçirmesi önerilir (özellikle AR/FA/AZ).

export type LandingLocale = "tr" | "en" | "de" | "fr" | "ru" | "ar" | "fa" | "az";

export const LANDING_LOCALES: { code: LandingLocale; native: string }[] = [
  { code: "tr", native: "Türkçe" },
  { code: "en", native: "English" },
  { code: "de", native: "Deutsch" },
  { code: "fr", native: "Français" },
  { code: "ru", native: "Русский" },
  { code: "ar", native: "العربية" },
  { code: "fa", native: "فارسی" },
  { code: "az", native: "Azərbaycanca" },
];

// constants.ts langDir dil-ADI (Türkçe/Arapça…) bazlıdır; landing kod-bazlı çalışır → yerel yardımcı.
export function landingDir(code: LandingLocale): "rtl" | "ltr" {
  return code === "ar" || code === "fa" ? "rtl" : "ltr";
}

export interface LandingCopy {
  nav: { how: string; corporate: string; cta: string };
  hero: { eyebrow: string; h: string; p: string; stats: { n: string; l: string }[] };
  trust: string;
  how: { eyebrow: string; h: string; steps: { t: string; d: string }[] };
  doctors: { h: string };
  testimonial: { quote: string; name: string; meta: string };
  cta: { h: string; p: string; b: string };
  footer: { desc: string; how: string; patientLogin: string; patientSignup: string; corporate: string; doctorSignup: string };
  showcase: {
    slides: { tag: string; title: string; sub: string; cta: string }[];
    hp: { eyebrow: string; t1: string; t2: string; btn: string };
    live: string;
    s2: { doc: string; reviewing: string; verified: string; note: string };
  };
}

export const LANDING_COPY: Record<LandingLocale, LandingCopy> = {
  tr: {
    nav: { how: "Nasıl Çalışır", corporate: "Kurumsal Giriş", cta: "Doktorla Görüş" },
    hero: {
      eyebrow: "Sağlık turizmi & teletıp",
      h: "Türkiye'de birinci sınıf sağlık hizmetine açılan kapınız.",
      p: "AI ile triyaj olun, 70 dilde simültane tercüme hizmetiyle akredite uzmanlarla video görüşün ve her şey dahil tedavi planıyla seyahat edin — uçuş, otel ve iyileşme takibi bizden.",
      stats: [
        { n: "20k+", l: "Uluslararası hasta" },
        { n: "40+", l: "Akredite klinik" },
        { n: "4.9★", l: "Hasta puanı" },
      ],
    },
    trust: "Akredite & güvenilir",
    how: {
      eyebrow: "Nasıl çalışır", h: "Dört adım, her şey bizden.",
      steps: [
        { t: "Ücretsiz değerlendirme", d: "Şikayetinizi ve belgelerinizi paylaşın; AI triyaj sizi doğru branşa yönlendirsin." },
        { t: "Kişiye özel plan", d: "Uzmanla video görüşme, ardından şeffaf her-şey-dahil paket." },
        { t: "Gelin & iyileşin", d: "Uçuş, otel, transfer ve tıbbi tercüman — hepsi ayarlanır." },
        { t: "Evde takip", d: "Günlük iyileşme kontrolleri ve kırmızı bayrak uyarıları, nerede olursanız olun." },
      ],
    },
    doctors: { h: "Uzmanlarla tanışın" },
    testimonial: {
      quote: "“İlk video görüşmeden eve döndükten sonraki kontrollere kadar her şey organizeydi. Yabancı bir ülkede bir an bile yalnız hissetmedim.”",
      name: "James W. · Birleşik Krallık", meta: "Saç ekimi · İstanbul'da 2 gece",
    },
    cta: { h: "Bakımınıza açılan kapıyı aralamaya hazır mısınız?", p: "Ücretsiz değerlendirmeyle başlayın — dakikalar içinde branş, aciliyet skoru ve tedavi planı alın.", b: "Doktorla Görüş" },
    footer: { desc: "Teletıp ve sağlık turizmi, uçtan uca.", how: "Nasıl Çalışır", patientLogin: "Hasta Girişi", patientSignup: "Hasta Üyeliği", corporate: "Kurumsal Giriş", doctorSignup: "Doktor Kaydı" },
    showcase: {
      slides: [
        { tag: "Doktorla Görüş", title: "AURA'yı açın — video görüşmeniz başlasın.", sub: "Görüşme doğrudan ana sayfamızdan başlar, her cihazdan. Siz konuşurken tıbbi terimler 70 dilde anlık çevrilir.", cta: "Hemen başla" },
        { tag: "İkinci Görüş", title: "Teşhisinize uzman bir ikinci bakış.", sub: "Elinizde bir teşhis mi var? Raporlarınızı paylaşın; bağımsız, akredite bir uzman bunları yeniden değerlendirsin — büyük karar öncesi netlik ve huzur.", cta: "İkinci görüş al" },
        { tag: "Ücretsiz Sağlık Hizmeti", title: "Sağlık bir insan hakkı — ayrıcalık değil.", sub: "Bakıma ulaşamayanların yanında gönüllü doktorlarımız var. Birbirimize sahip çıkmak hepimizin sorumluluğudur.", cta: "Başvur" },
      ],
      hp: { eyebrow: "Sağlık turizmi & teletıp", t1: "Birinci sınıf sağlık", t2: "Türkiye'de.", btn: "Doktorla görüş" },
      live: "CANLI",
      s2: { doc: "Teşhis raporu", reviewing: "İnceleniyor…", verified: "İkinci görüş", note: "Bağımsız değerlendirme" },
    },
  },

  en: {
    nav: { how: "How it works", corporate: "Corporate login", cta: "Talk to a Doctor" },
    hero: {
      eyebrow: "Health tourism & telehealth",
      h: "Your gateway to world-class care in Türkiye.",
      p: "Triage with AI, meet accredited specialists over video with live interpreting in 70 languages, and travel with an all-inclusive treatment plan — flights, hotel and aftercare handled.",
      stats: [
        { n: "20k+", l: "International patients" },
        { n: "40+", l: "Accredited clinics" },
        { n: "4.9★", l: "Patient rating" },
      ],
    },
    trust: "Accredited & trusted",
    how: {
      eyebrow: "How it works", h: "Four steps, fully taken care of.",
      steps: [
        { t: "Free assessment", d: "Share your symptoms and records; our AI triage routes you to the right specialty." },
        { t: "Tailored plan", d: "Video consult with a specialist, then a transparent all-inclusive package." },
        { t: "Arrive & heal", d: "Flights, hotel, transfers and a medical translator — all arranged." },
        { t: "Follow-up at home", d: "Daily recovery check-ins and red-flag alerts, wherever you are." },
      ],
    },
    doctors: { h: "Meet the specialists" },
    testimonial: {
      quote: "“From the first video call to the follow-ups after I flew home, everything was organised. I never felt alone in a foreign country.”",
      name: "James W. · United Kingdom", meta: "Hair transplant · 2 nights in Istanbul",
    },
    cta: { h: "Ready to open the door to your care?", p: "Start with a free assessment — get a specialty, an urgency score and a treatment plan in minutes.", b: "Talk to a Doctor" },
    footer: { desc: "Telehealth & health tourism, end to end.", how: "How it works", patientLogin: "Patient login", patientSignup: "Patient sign-up", corporate: "Corporate login", doctorSignup: "Doctor sign-up" },
    showcase: {
      slides: [
        { tag: "Talk to a Doctor", title: "Open AURA — your video visit begins.", sub: "Start right from our homepage, on any device. As you talk, medical terms are interpreted live across 70 languages.", cta: "Start now" },
        { tag: "Second Opinion", title: "A second set of expert eyes on your diagnosis.", sub: "Already diagnosed? Share your reports and an independent, accredited specialist reviews them — clarity and peace of mind before any big decision.", cta: "Get a second opinion" },
        { tag: "Free Care", title: "Health is a human right — not a privilege.", sub: "When care is out of reach, our volunteer doctors step in. Looking after one another is a responsibility we all share.", cta: "Apply" },
      ],
      hp: { eyebrow: "Health tourism & telehealth", t1: "World-class care", t2: "in Türkiye.", btn: "Talk to a doctor" },
      live: "LIVE",
      s2: { doc: "Diagnosis report", reviewing: "Reviewing…", verified: "Second opinion", note: "Independent review" },
    },
  },

  de: {
    nav: { how: "So funktioniert's", corporate: "Für Fachpersonal", cta: "Arzt sprechen" },
    hero: {
      eyebrow: "Gesundheitstourismus & Telemedizin",
      h: "Ihr Tor zu erstklassiger Medizin in der Türkei.",
      p: "KI-gestützte Ersteinschätzung, Videosprechstunden mit akkreditierten Fachärzten und Live-Dolmetschen in 70 Sprachen — dazu ein Rundum-Behandlungsplan mit Flug, Hotel und Nachsorge.",
      stats: [
        { n: "20k+", l: "Internationale Patienten" },
        { n: "40+", l: "Akkreditierte Kliniken" },
        { n: "4.9★", l: "Patientenbewertung" },
      ],
    },
    trust: "Akkreditiert & vertrauenswürdig",
    how: {
      eyebrow: "So funktioniert's", h: "Vier Schritte — wir kümmern uns um alles.",
      steps: [
        { t: "Kostenlose Ersteinschätzung", d: "Teilen Sie Beschwerden und Unterlagen; unsere KI-Triage leitet Sie an die richtige Fachrichtung weiter." },
        { t: "Individueller Plan", d: "Videosprechstunde mit dem Facharzt, danach ein transparentes Rundum-Paket." },
        { t: "Anreisen & genesen", d: "Flüge, Hotel, Transfers und medizinischer Dolmetscher — alles organisiert." },
        { t: "Nachsorge zu Hause", d: "Tägliche Genesungs-Check-ins und Warnhinweise — wo immer Sie sind." },
      ],
    },
    doctors: { h: "Unsere Fachärzte" },
    testimonial: {
      quote: "„Vom ersten Videogespräch bis zu den Kontrollen nach meiner Heimreise war alles organisiert. Ich habe mich in einem fremden Land nie allein gefühlt.“",
      name: "James W. · Vereinigtes Königreich", meta: "Haartransplantation · 2 Nächte in Istanbul",
    },
    cta: { h: "Bereit für den ersten Schritt zu Ihrer Behandlung?", p: "Starten Sie mit einer kostenlosen Ersteinschätzung — Fachrichtung, Dringlichkeit und Behandlungsplan in Minuten.", b: "Arzt sprechen" },
    footer: { desc: "Telemedizin & Gesundheitstourismus, aus einer Hand.", how: "So funktioniert's", patientLogin: "Patienten-Login", patientSignup: "Patienten-Registrierung", corporate: "Für Fachpersonal", doctorSignup: "Arzt-Registrierung" },
    showcase: {
      slides: [
        { tag: "Arzt sprechen", title: "AURA öffnen — Ihre Videosprechstunde beginnt.", sub: "Starten Sie direkt von unserer Startseite, auf jedem Gerät. Während Sie sprechen, werden medizinische Begriffe live in 70 Sprachen übersetzt.", cta: "Jetzt starten" },
        { tag: "Zweitmeinung", title: "Ein zweiter Expertenblick auf Ihre Diagnose.", sub: "Sie haben bereits eine Diagnose? Teilen Sie Ihre Befunde — ein unabhängiger, akkreditierter Facharzt prüft sie. Klarheit vor jeder großen Entscheidung.", cta: "Zweitmeinung einholen" },
        { tag: "Kostenlose Versorgung", title: "Gesundheit ist ein Menschenrecht — kein Privileg.", sub: "Wenn Versorgung unerreichbar ist, helfen unsere ehrenamtlichen Ärzte. Füreinander da zu sein ist unsere gemeinsame Verantwortung.", cta: "Jetzt beantragen" },
      ],
      hp: { eyebrow: "Gesundheitstourismus & Telemedizin", t1: "Erstklassige Medizin", t2: "in der Türkei.", btn: "Arzt sprechen" },
      live: "LIVE",
      s2: { doc: "Diagnosebericht", reviewing: "Wird geprüft…", verified: "Zweitmeinung", note: "Unabhängige Prüfung" },
    },
  },

  fr: {
    nav: { how: "Comment ça marche", corporate: "Espace professionnel", cta: "Parler à un médecin" },
    hero: {
      eyebrow: "Tourisme médical & télésanté",
      h: "Votre porte d'entrée vers des soins d'excellence en Turquie.",
      p: "Évaluation par IA, consultations vidéo avec des spécialistes accrédités et interprétation en direct en 70 langues — puis un plan de traitement tout compris : vols, hôtel et suivi assurés.",
      stats: [
        { n: "20k+", l: "Patients internationaux" },
        { n: "40+", l: "Cliniques accréditées" },
        { n: "4.9★", l: "Note des patients" },
      ],
    },
    trust: "Accrédité & fiable",
    how: {
      eyebrow: "Comment ça marche", h: "Quatre étapes, tout est pris en charge.",
      steps: [
        { t: "Évaluation gratuite", d: "Partagez vos symptômes et dossiers ; notre triage par IA vous oriente vers la bonne spécialité." },
        { t: "Plan sur mesure", d: "Consultation vidéo avec un spécialiste, puis un forfait tout compris transparent." },
        { t: "Venez & guérissez", d: "Vols, hôtel, transferts et interprète médical — tout est organisé." },
        { t: "Suivi à domicile", d: "Contrôles quotidiens de récupération et alertes, où que vous soyez." },
      ],
    },
    doctors: { h: "Rencontrez nos spécialistes" },
    testimonial: {
      quote: "« Du premier appel vidéo aux suivis après mon retour, tout était organisé. Je ne me suis jamais senti seul dans un pays étranger. »",
      name: "James W. · Royaume-Uni", meta: "Greffe de cheveux · 2 nuits à Istanbul",
    },
    cta: { h: "Prêt à ouvrir la porte de vos soins ?", p: "Commencez par une évaluation gratuite — spécialité, score d'urgence et plan de traitement en quelques minutes.", b: "Parler à un médecin" },
    footer: { desc: "Télésanté & tourisme médical, de bout en bout.", how: "Comment ça marche", patientLogin: "Connexion patient", patientSignup: "Inscription patient", corporate: "Espace professionnel", doctorSignup: "Inscription médecin" },
    showcase: {
      slides: [
        { tag: "Parler à un médecin", title: "Ouvrez AURA — votre consultation vidéo commence.", sub: "Démarrez depuis notre page d'accueil, sur n'importe quel appareil. Pendant que vous parlez, les termes médicaux sont traduits en direct en 70 langues.", cta: "Commencer" },
        { tag: "Second avis", title: "Un second regard d'expert sur votre diagnostic.", sub: "Déjà diagnostiqué ? Partagez vos rapports : un spécialiste indépendant et accrédité les réévalue — clarté et sérénité avant toute grande décision.", cta: "Obtenir un second avis" },
        { tag: "Soins gratuits", title: "La santé est un droit humain — pas un privilège.", sub: "Quand les soins sont hors de portée, nos médecins bénévoles interviennent. Prendre soin les uns des autres est notre responsabilité à tous.", cta: "Faire une demande" },
      ],
      hp: { eyebrow: "Tourisme médical & télésanté", t1: "Des soins d'excellence", t2: "en Turquie.", btn: "Parler à un médecin" },
      live: "DIRECT",
      s2: { doc: "Rapport de diagnostic", reviewing: "Analyse en cours…", verified: "Second avis", note: "Évaluation indépendante" },
    },
  },

  ru: {
    nav: { how: "Как это работает", corporate: "Для специалистов", cta: "Поговорить с врачом" },
    hero: {
      eyebrow: "Медицинский туризм и телемедицина",
      h: "Ваш путь к медицине мирового уровня в Турции.",
      p: "ИИ-триаж, видеоконсультации с аккредитованными специалистами и синхронный перевод на 70 языков — плюс план лечения «всё включено»: перелёт, отель и последующее наблюдение.",
      stats: [
        { n: "20k+", l: "Иностранных пациентов" },
        { n: "40+", l: "Аккредитованных клиник" },
        { n: "4.9★", l: "Оценка пациентов" },
      ],
    },
    trust: "Аккредитовано и надёжно",
    how: {
      eyebrow: "Как это работает", h: "Четыре шага — всё берём на себя.",
      steps: [
        { t: "Бесплатная оценка", d: "Опишите жалобы и загрузите документы — ИИ-триаж направит вас к нужному специалисту." },
        { t: "Индивидуальный план", d: "Видеоконсультация со специалистом, затем прозрачный пакет «всё включено»." },
        { t: "Приезжайте и лечитесь", d: "Перелёт, отель, трансферы и медицинский переводчик — всё организовано." },
        { t: "Наблюдение дома", d: "Ежедневные чек-ины восстановления и тревожные сигналы — где бы вы ни были." },
      ],
    },
    doctors: { h: "Наши специалисты" },
    testimonial: {
      quote: "«От первого видеозвонка до контрольных осмотров после возвращения домой — всё было организовано. В чужой стране я ни разу не почувствовал себя одиноким».",
      name: "Джеймс У. · Великобритания", meta: "Пересадка волос · 2 ночи в Стамбуле",
    },
    cta: { h: "Готовы сделать первый шаг к лечению?", p: "Начните с бесплатной оценки — специальность, срочность и план лечения за считанные минуты.", b: "Поговорить с врачом" },
    footer: { desc: "Телемедицина и медицинский туризм — под ключ.", how: "Как это работает", patientLogin: "Вход для пациентов", patientSignup: "Регистрация пациента", corporate: "Для специалистов", doctorSignup: "Регистрация врача" },
    showcase: {
      slides: [
        { tag: "Поговорить с врачом", title: "Откройте AURA — видеоприём начинается.", sub: "Начните прямо с главной страницы, с любого устройства. Пока вы говорите, медицинские термины синхронно переводятся на 70 языков.", cta: "Начать" },
        { tag: "Второе мнение", title: "Второй взгляд эксперта на ваш диагноз.", sub: "Уже есть диагноз? Поделитесь заключениями — независимый аккредитованный специалист их пересмотрит. Ясность перед важным решением.", cta: "Получить второе мнение" },
        { tag: "Бесплатная помощь", title: "Здоровье — право человека, а не привилегия.", sub: "Когда помощь недоступна, на связь выходят наши врачи-волонтёры. Заботиться друг о друге — общая ответственность.", cta: "Подать заявку" },
      ],
      hp: { eyebrow: "Медицинский туризм и телемедицина", t1: "Медицина мирового уровня", t2: "в Турции.", btn: "Поговорить с врачом" },
      live: "LIVE",
      s2: { doc: "Заключение", reviewing: "Проверяется…", verified: "Второе мнение", note: "Независимая оценка" },
    },
  },

  ar: {
    nav: { how: "كيف نعمل", corporate: "دخول المختصين", cta: "تحدث مع طبيب" },
    hero: {
      eyebrow: "السياحة العلاجية والرعاية عن بُعد",
      h: "بوابتك إلى رعاية صحية عالمية المستوى في تركيا.",
      p: "فرز أولي بالذكاء الاصطناعي، واستشارات فيديو مع أخصائيين معتمدين مع ترجمة فورية بـ70 لغة، وخطة علاج شاملة — الطيران والفندق والمتابعة علينا.",
      stats: [
        { n: "+20k", l: "مريض دولي" },
        { n: "+40", l: "عيادة معتمدة" },
        { n: "4.9★", l: "تقييم المرضى" },
      ],
    },
    trust: "معتمدون وموثوقون",
    how: {
      eyebrow: "كيف نعمل", h: "أربع خطوات، ونتكفل بكل شيء.",
      steps: [
        { t: "تقييم مجاني", d: "شارك أعراضك وتقاريرك؛ يوجهك الفرز الذكي إلى التخصص المناسب." },
        { t: "خطة مخصصة", d: "استشارة فيديو مع الأخصائي، ثم باقة شفافة شاملة." },
        { t: "احضر وتعافَ", d: "الطيران والفندق والتنقلات ومترجم طبي — كل شيء مرتب." },
        { t: "متابعة في المنزل", d: "متابعة يومية للتعافي وتنبيهات فورية أينما كنت." },
      ],
    },
    doctors: { h: "تعرف على الأخصائيين" },
    testimonial: {
      quote: "«من أول مكالمة فيديو إلى المتابعات بعد عودتي، كان كل شيء منظمًا. لم أشعر بالوحدة في بلد أجنبي قط.»",
      name: "جيمس و. · المملكة المتحدة", meta: "زراعة الشعر · ليلتان في إسطنبول",
    },
    cta: { h: "هل أنت مستعد لفتح باب رعايتك الصحية؟", p: "ابدأ بتقييم مجاني — احصل على التخصص ودرجة الإلحاح وخطة العلاج في دقائق.", b: "تحدث مع طبيب" },
    footer: { desc: "الرعاية عن بُعد والسياحة العلاجية، من البداية إلى النهاية.", how: "كيف نعمل", patientLogin: "دخول المرضى", patientSignup: "تسجيل المرضى", corporate: "دخول المختصين", doctorSignup: "تسجيل الأطباء" },
    showcase: {
      slides: [
        { tag: "تحدث مع طبيب", title: "افتح AURA — تبدأ زيارتك بالفيديو.", sub: "ابدأ مباشرة من صفحتنا الرئيسية وعلى أي جهاز. أثناء حديثك تُترجم المصطلحات الطبية فوريًا بـ70 لغة.", cta: "ابدأ الآن" },
        { tag: "رأي طبي ثانٍ", title: "نظرة خبير ثانية على تشخيصك.", sub: "لديك تشخيص بالفعل؟ شارك تقاريرك ليراجعها أخصائي مستقل معتمد — وضوح وطمأنينة قبل أي قرار كبير.", cta: "احصل على رأي ثانٍ" },
        { tag: "رعاية مجانية", title: "الصحة حق إنساني — لا امتياز.", sub: "حين تتعذر الرعاية، يتدخل أطباؤنا المتطوعون. رعاية بعضنا البعض مسؤوليتنا جميعًا.", cta: "قدّم طلبًا" },
      ],
      hp: { eyebrow: "السياحة العلاجية والرعاية عن بُعد", t1: "رعاية عالمية المستوى", t2: "في تركيا.", btn: "تحدث مع طبيب" },
      live: "مباشر",
      s2: { doc: "تقرير التشخيص", reviewing: "قيد المراجعة…", verified: "رأي ثانٍ", note: "مراجعة مستقلة" },
    },
  },

  fa: {
    nav: { how: "چطور کار می‌کند", corporate: "ورود متخصصان", cta: "گفت‌وگو با پزشک" },
    hero: {
      eyebrow: "گردشگری درمانی و سلامت از راه دور",
      h: "دروازهٔ شما به مراقبت‌های درمانی در سطح جهانی در ترکیه.",
      p: "تریاژ با هوش مصنوعی، ویزیت ویدیویی با متخصصان معتبر همراه با ترجمهٔ هم‌زمان به ۷۰ زبان، و سفر با برنامهٔ درمانی همه‌چیز شامل — پرواز، هتل و پیگیری با ما.",
      stats: [
        { n: "+20k", l: "بیمار بین‌المللی" },
        { n: "+40", l: "کلینیک معتبر" },
        { n: "4.9★", l: "امتیاز بیماران" },
      ],
    },
    trust: "معتبر و مورد اعتماد",
    how: {
      eyebrow: "چطور کار می‌کند", h: "چهار گام — همه‌چیز با ما.",
      steps: [
        { t: "ارزیابی رایگان", d: "علائم و مدارک خود را به اشتراک بگذارید؛ تریاژ هوشمند شما را به تخصص درست هدایت می‌کند." },
        { t: "برنامهٔ اختصاصی", d: "ویزیت ویدیویی با متخصص و سپس بسته‌ای شفاف و همه‌چیز شامل." },
        { t: "بیایید و بهبود یابید", d: "پرواز، هتل، ترانسفر و مترجم پزشکی — همه هماهنگ شده." },
        { t: "پیگیری در خانه", d: "پایش روزانهٔ بهبودی و هشدارهای فوری، هر جا که باشید." },
      ],
    },
    doctors: { h: "با متخصصان آشنا شوید" },
    testimonial: {
      quote: "«از نخستین تماس ویدیویی تا پیگیری‌های پس از بازگشتم، همه‌چیز منظم بود. در کشوری غریب هرگز احساس تنهایی نکردم.»",
      name: "جیمز دبلیو · بریتانیا", meta: "کاشت مو · دو شب در استانبول",
    },
    cta: { h: "آماده‌اید در مسیر درمان قدم بگذارید؟", p: "با ارزیابی رایگان شروع کنید — در چند دقیقه تخصص، درجهٔ فوریت و برنامهٔ درمان دریافت کنید.", b: "گفت‌وگو با پزشک" },
    footer: { desc: "سلامت از راه دور و گردشگری درمانی، سرتاسری.", how: "چطور کار می‌کند", patientLogin: "ورود بیماران", patientSignup: "ثبت‌نام بیماران", corporate: "ورود متخصصان", doctorSignup: "ثبت‌نام پزشکان" },
    showcase: {
      slides: [
        { tag: "گفت‌وگو با پزشک", title: "AURA را باز کنید — ویزیت ویدیویی شما آغاز می‌شود.", sub: "از صفحهٔ اصلی ما و با هر دستگاهی شروع کنید. هنگام صحبت، اصطلاحات پزشکی به‌صورت زنده به ۷۰ زبان ترجمه می‌شوند.", cta: "همین حالا شروع کنید" },
        { tag: "نظر دوم", title: "نگاه دوم یک متخصص به تشخیص شما.", sub: "تشخیصی دارید؟ گزارش‌های خود را به اشتراک بگذارید تا متخصصی مستقل و معتبر آن‌ها را بازبینی کند — شفافیت پیش از هر تصمیم بزرگ.", cta: "دریافت نظر دوم" },
        { tag: "خدمات درمانی رایگان", title: "سلامت حق انسان است — نه امتیاز.", sub: "وقتی درمان در دسترس نیست، پزشکان داوطلب ما کنار شما هستند. مراقبت از یکدیگر مسئولیت همهٔ ماست.", cta: "درخواست دهید" },
      ],
      hp: { eyebrow: "گردشگری درمانی و سلامت از راه دور", t1: "مراقبت در سطح جهانی", t2: "در ترکیه.", btn: "گفت‌وگو با پزشک" },
      live: "زنده",
      s2: { doc: "گزارش تشخیص", reviewing: "در حال بررسی…", verified: "نظر دوم", note: "بازبینی مستقل" },
    },
  },

  az: {
    nav: { how: "Necə işləyir", corporate: "Korporativ giriş", cta: "Həkimlə danış" },
    hero: {
      eyebrow: "Sağlamlıq turizmi & teletibb",
      h: "Türkiyədə birinci sinif tibbi xidmətə açılan qapınız.",
      p: "Sİ ilə ilkin qiymətləndirmə, 70 dildə canlı tərcümə ilə akkreditə olunmuş mütəxəssislərlə video görüş və hər şey daxil müalicə planı ilə səyahət — uçuş, otel və sağalma izləməsi bizdən.",
      stats: [
        { n: "20k+", l: "Beynəlxalq xəstə" },
        { n: "40+", l: "Akkreditə klinika" },
        { n: "4.9★", l: "Xəstə reytinqi" },
      ],
    },
    trust: "Akkreditə və etibarlı",
    how: {
      eyebrow: "Necə işləyir", h: "Dörd addım — hər şey bizdən.",
      steps: [
        { t: "Pulsuz qiymətləndirmə", d: "Şikayət və sənədlərinizi paylaşın; Sİ triajı sizi düzgün ixtisasa yönləndirsin." },
        { t: "Fərdi plan", d: "Mütəxəssislə video görüş, ardınca şəffaf hər-şey-daxil paket." },
        { t: "Gəlin və sağalın", d: "Uçuş, otel, transfer və tibbi tərcüməçi — hamısı təşkil olunur." },
        { t: "Evdə izləmə", d: "Gündəlik sağalma yoxlamaları və xəbərdarlıqlar — harada olursunuz olun." },
      ],
    },
    doctors: { h: "Mütəxəssislərlə tanış olun" },
    testimonial: {
      quote: "“İlk video zəngdən evə qayıtdıqdan sonrakı nəzarətlərə qədər hər şey təşkil olunmuşdu. Yad ölkədə bir an belə özümü tənha hiss etmədim.”",
      name: "James W. · Birləşmiş Krallıq", meta: "Saç əkimi · İstanbulda 2 gecə",
    },
    cta: { h: "Müalicənizə açılan qapını aralamağa hazırsınız?", p: "Pulsuz qiymətləndirmə ilə başlayın — dəqiqələr içində ixtisas, təcililik balı və müalicə planı alın.", b: "Həkimlə danış" },
    footer: { desc: "Teletibb və sağlamlıq turizmi — başdan-başa.", how: "Necə işləyir", patientLogin: "Xəstə girişi", patientSignup: "Xəstə üzvlüyü", corporate: "Korporativ giriş", doctorSignup: "Həkim qeydiyyatı" },
    showcase: {
      slides: [
        { tag: "Həkimlə danış", title: "AURA-nı açın — video görüşünüz başlasın.", sub: "Görüş birbaşa ana səhifəmizdən, istənilən cihazdan başlayır. Siz danışarkən tibbi terminlər 70 dildə anında tərcümə olunur.", cta: "İndi başla" },
        { tag: "İkinci rəy", title: "Diaqnozunuza mütəxəssisdən ikinci baxış.", sub: "Artıq diaqnozunuz var? Hesabatlarınızı paylaşın; müstəqil, akkreditə olunmuş mütəxəssis onları yenidən qiymətləndirsin — böyük qərardan öncə aydınlıq.", cta: "İkinci rəy al" },
        { tag: "Pulsuz Sağlamlıq Xidməti", title: "Sağlamlıq insan haqqıdır — imtiyaz deyil.", sub: "Xidmət əlçatmaz olanda könüllü həkimlərimiz dəstək olur. Bir-birimizə sahib çıxmaq hamımızın məsuliyyətidir.", cta: "Müraciət et" },
      ],
      hp: { eyebrow: "Sağlamlıq turizmi & teletibb", t1: "Birinci sinif tibb", t2: "Türkiyədə.", btn: "Həkimlə danış" },
      live: "CANLI",
      s2: { doc: "Diaqnoz hesabatı", reviewing: "Nəzərdən keçirilir…", verified: "İkinci rəy", note: "Müstəqil qiymətləndirmə" },
    },
  },
};
