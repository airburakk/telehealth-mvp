import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activeCampaignsFor, countImpressions, CATEGORY_LABEL as SPONSOR_CATEGORY_LABEL,
  type SponsorCard,
} from "@/lib/sponsor";
import { activeSurveysFor, doctorResponse, aggregateResults } from "@/lib/survey";
import { SurveyCardView } from "./SurveyCard";
import {
  DOCTORIUM_MODULES, RANGE_OPTIONS, DEFAULT_RANGE, rangeDays,
  SECTOR_CATEGORIES, SECTOR_SOURCE_SCOPES, LEGAL_TABS, parseLegalTab, LEGAL_ONLY_CATEGORIES,
  CAREER_TABS, parseCareerTab, careerPathways,
  effectiveBranches, personalFeedPage, moduleFeed, singleBranchFeedPage, upcomingCongresses,
  upcomingCountByIds, localizeTitles, branchLabel, followedCongressIds, BRANCH_OPTIONS,
  parseScope, parseSourceScope, savedArticleIds, parseFeedModules,
  todayModuleCounts, MODULE_ALIASES, parseEventTypes,
  trDayStart, parseEventTypePref, parseViewPrefs,
  type FeedItem, type ModuleKey, type LegalTabKey, type CareerTabKey, type EventTypeKey,
} from "@/lib/doctorium";
import { isStudentOnly } from "@/lib/doctor-activation";
import { keywordByKey } from "@/lib/hukuk-keywords";
import { LegalSearchBox } from "./LegalSearchBox";
import { CongressList } from "./CongressList";
import { ProspektusSearch } from "./ProspektusSearch";
import { CareerDisclaimer, careerDate, COUNTRY_LABEL } from "./CareerShared";
import { ArticleCard, SourcePlate } from "./ArticleCard";
import { FeedLoadMore } from "./FeedLoadMore";
import { SaveButton } from "./SaveButton";
import {
  ArrowLeft, ExternalLink, Info, Star, X, Megaphone, SlidersHorizontal,
} from "lucide-react";
import { getDoctorBalance } from "@/lib/rewards";
import { DoctoriumShell } from "./DoctoriumSidebar";

export const dynamic = "force-dynamic";

// Ayrışma (2026-08-24): sekme yalın "Doctorium". 🪤 absolute ŞART — segmentin page'i KENDİ
// layout'unun şablonunu almaz (şablon yalnız ALT segmentlere; düz title köke kaçıp "· AURA" alır).
export const metadata = { title: { absolute: "Doctorium" } };

const MODULE_KEYS = new Set(DOCTORIUM_MODULES.map((m) => m.key));

const VALID_SLUGS = new Set(BRANCH_OPTIONS.map((b) => b.slug));

// Modül üst alanı metinleri (Faz 1, kullanıcı onayı 2026-08-14). Renkler = kart kapağı (Cover) +
// bant (DoctoriumSidebar) kimlik hex'leri; Etkinlik'in kimliği "beyaz" = tema-duyarlı ink (color
// yok → var(--c-ink)). Kariyer satırı İŞKUR sınırının dilini korur ("ilan değil").
const MODULE_HEAD: Record<ModuleKey, { eyebrow: string; title: string; desc: string; color?: string }> = {
  akis: { eyebrow: "AKIŞIM", title: "Sizin için seçilenler", desc: "Branşınız, bilimsel yayınlar ve sektörel gelişmeler tek akışta.", color: "#facc15" },
  akademik: { eyebrow: "AKADEMİK", title: "Branşınızda hakemli yayınlar", desc: "PubMed, Europe PMC ve DOAJ'dan hakemli çalışmalar, kısa klinik özetlerle.", color: "#34d399" },
  sektorel: { eyebrow: "SEKTÖREL", title: "Sağlık gündeminin nabzı", desc: "Doktor hakları, yönetim, teknoloji ve küresel gelişmeler.", color: "#a78bfa" },
  ilac: { eyebrow: "İLAÇ & CİHAZ", title: "Geri çekmeler ve klinik fazlar", desc: "Ruhsat, geri çekme, klinik faz ve prospektüs bilgisi tek yerde.", color: "#22d3ee" },
  etkinlik: { eyebrow: "ETKİNLİK", title: "Etkinlik takvimi", desc: "Kongre, sempozyum ve kurslar; bildiri ve erken kayıt tarihleriyle." },
  kariyer: { eyebrow: "KARİYER", title: "Doktorluk yollarının haritası", desc: "Yurt dışı denklik ve akademik yükselme süreçleri — ilan değil, süreç bilgisi.", color: "#60a5fa" },
  mevzuat: { eyebrow: "HUKUK", title: "Sağlık hukuku, tek yerde", desc: "Mevzuat değişiklikleri, emsal kararlar ve hakemli doktrin.", color: "#fb7185" },
};

// (Mobil grup şeridi 2026-08-19'da kalktı: alt çubuk artık masaüstü rafının birebir eşleniği —
// tüm modüller orada; page-içi ikinci şerit çift navigasyon olurdu. Grup kavramı rafın
// hairline ayraçlarında yaşıyor.)

// Doctorium — doktor bilgi portalı. Modüller: Akışım (A) · Akademik (C) · Sektörel (B) · Etkinlik (E).
// Modül D (ilaç tanıtımı/e-mümessil) PARK: TİTCK tanıtım yönetmeliği hukuki görüş ister.
export default async function DoctoriumPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string; b?: string; c?: string; s?: string; h?: string; k?: string; t?: string; f?: string; l?: string; n?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || !["DOCTOR", "COORDINATOR", "ADMIN"].includes(user.role)) redirect("/");

  const me = await db.user.findUnique({ where: { id: user.id }, select: { doctorId: true } });
  const doctor = me?.doctorId
    ? await db.doctor.findUnique({
        where: { id: me.doctorId },
        select: {
          id: true, branch: true, newsBranches: true, city: true,
          // Akış Tercihleri (Faz 2, 2026-08-14): Akışım'a hangi bölümler girsin.
          feedModules: true,
          // v6.95: öğrenci-sınırlı üyelik tespiti (isStudentOnly) — pazarlama yüzeyi süzgeci.
          activatedAt: true, studentVerifiedAt: true,
          congressAlertDays: true,
          // v6.62: bildiri ve erken kayıt eşikleri AYRI (eski congressDeadlineAlertDays okunmuyor).
          congressAbstractAlertDays: true, congressEarlyBirdAlertDays: true,
          // v6.132 — etkinlik tür/kapsam TERCİHİ (URL parametresi yoksa bunlar uygulanır).
          congressEventTypes: true, congressScope: true,
          // v6.142 — Sektörel/İlaç & Cihaz/Mevzuat GÖRÜNÜM süzgeçleri TERCİHİ (aynı sözleşme).
          doctoriumViewPrefs: true,
          // v6.68: sponsorlu içerik kişiselleştirme rızası (city hedefleme için birlikte okunur).
          sponsorPersonalizationAt: true,
        },
      })
    : null;
  const branches = effectiveBranches(doctor?.newsBranches, doctor?.branch);
  // v6.142 — bkz. lib/doctorium parseViewPrefs (aşağıda range/cat/srcScope'ta kullanılır).
  const viewPrefs = parseViewPrefs(doctor?.doctoriumViewPrefs);

  const sp = await searchParams;
  // ?m= çözümü: geçerli anahtar → kendisi; ESKİ anahtar (kongre) → alias'tan etkinliğe; yoksa akış.
  // Alias v6.120 rename'inin bedeli: eski yer imleri ve bildirim href'leri boş sayfa açmasın.
  const rawModule = sp.m ?? "";
  const active: ModuleKey = MODULE_KEYS.has(rawModule as ModuleKey)
    ? (rawModule as ModuleKey)
    : (MODULE_ALIASES[rawModule] ?? "akis");
  // v6.142 — GÖRÜNÜM süzgeci TERCİH ilişkisi (aşağıdaki scope/eventTypes'la AYNI sözleşme):
  // URL parametresi kayıtlı tercihi yalnız bu GÖRÜNÜM için ezer, kalıcı tercihi DEĞİŞTİRMEZ.
  const persistedRange =
    active === "sektorel" ? viewPrefs.sektorel.range
    : active === "ilac" ? viewPrefs.ilac.range
    : active === "mevzuat" ? viewPrefs.mevzuat.range
    : DEFAULT_RANGE;
  const range = sp.d && RANGE_OPTIONS.some((r) => r.key === sp.d) ? sp.d : persistedRange;
  // Tek-branş odağı (?b=): çipleri üreten "Akışınız:" şeridi KALDIRILDI (kullanıcı kararı
  // 2026-08-18 — çok branşta renk karmaşası); parametre eski/paylaşılan URL'ler için yaşar.
  // Yalnız doktorun AKIŞINDAKİ branşlar seçilebilir (rastgele slug'la başka akış açılmasın).
  const focus = sp.b && VALID_SLUGS.has(sp.b) && branches.includes(sp.b) ? sp.b : null;

  // "Yeni" süzgeci (v6.132): sayaç şeridinden gelinir — bu gece akışa DÜŞEN kayıtlar
  // (createdAt), kaynağın yayım tarihi değil. 2026-08-24: Akışım da destekler (raf nabzı
  // "BUGÜN N YENİ" artık ?n=1 ile gelir — kullanıcı bildirimi: sayaç tıklaması yalnız yeniler
  // yerine düz sekmeye götürüyordu). Tek-branş odağında (?b=) anlamsız — akış dalında elenir.
  const onlyNew = sp.n === "1";
  // İçtihat serbest metin araması (v6.132): kutu içinden gelir, URL'de taşınır (?q=).
  const legalQuery = sp.q?.trim().slice(0, 80) || null;

  const persistedCategory =
    active === "sektorel" ? viewPrefs.sektorel.category
    : active === "mevzuat" ? viewPrefs.mevzuat.category
    : null;
  const cat = sp.c && SECTOR_CATEGORIES.some((x) => x.key === sp.c) ? sp.c : persistedCategory;
  // Hukuk modülü alt-sekmesi (v6.86): ?h=mevzuat|ictihat — yalnız bu modülde anlamlı.
  const legalTab: LegalTabKey | null = active === "mevzuat" ? parseLegalTab(sp.h) : null;
  // İçtihat anahtar-kelime filtresi (v6.87): ?k= sözlük anahtarı; bilinmeyen değer filtresiz liste.
  const legalKeyword = legalTab === "ictihat" ? keywordByKey(sp.k) : null;

  // Akış Tercihleri (Faz 2): [] = tümü. Kongre/Kariyer dahil her seçili bölüm akışa KART olarak
  // girer (bölüm-kotalı karışım — lib/doctorium personalFeed).
  const feedMods = parseFeedModules(doctor?.feedModules);

  // "Yeni" süzgeci tüm modül sorgularına aynı sınırla girer (trDayStart — sayaçla AYNI kaynak).
  const since = onlyNew ? trDayStart() : undefined;

  let items: FeedItem[] = [];
  // Sonsuz kaydırma (2026-08-21, kullanıcı bildirimi "belli sayıda içerikte duruyor"): ilk parti
  // burada basılır, `feedNextCursor` FeedLoadMore'a geçer — null ise (ilk partide zaten her şey
  // gösterildiyse) bileşen hiç render edilmez. Yalnız Akışım'da (diğer sekmeler moduleFeed'in
  // sabit 40 sınırında kalıyor, bkz. plan notu).
  let feedNextCursor: string | null = null;
  if (active === "akis") {
    if (focus) {
      const page = await singleBranchFeedPage(focus, 30);
      items = page.items;
      feedNextCursor = page.cursor ? JSON.stringify(page.cursor) : null;
    } else {
      // 2026-08-24 — Akışım da tercihleri uygular (kullanıcı bildirimi: "ulusal'a çektim ama
      // akışta uluslararası haber var"): sektörel kaynak kapsamı + "yalnız yeni" (?n=1).
      const page = await personalFeedPage(branches, feedMods, {}, 40, {
        sektorelSources: viewPrefs.sektorel.source ? SECTOR_SOURCE_SCOPES[viewPrefs.sektorel.source] : undefined,
        createdSince: since,
      });
      items = page.items;
      feedNextCursor = page.done ? null : JSON.stringify(page.cursors);
    }
  }
  else if (active === "akademik") items = await moduleFeed("akademik", branches, { createdSince: since });
  else if (active === "mevzuat") {
    // İçtihat + Doktrin = ARŞİV: tarih penceresi bilinçli YOK — kararlar/makaleler eski tarihli
    // (dizin yıl bazlı), 30 günlük varsayılan pencere sekmeyi daima boş gösterirdi.
    items = legalTab === "ictihat"
      ? await moduleFeed("mevzuat", [], {
          category: "ictihat", textContainsAny: legalKeyword?.patterns,
          textQuery: legalQuery ?? undefined, createdSince: since,
        })
      : legalTab === "doktrin"
      ? await moduleFeed("mevzuat", [], {
          category: "doktrin", textQuery: legalQuery ?? undefined, createdSince: since,
        })
      : await moduleFeed("mevzuat", [], {
          // ⚠️ Arama varsa TARİH PENCERESİ kalkar: doktor "sağlık turizmi" arayıp 30 günlük
          // varsayılan pencerede hiç sonuç bulamazsa aramanın çalışmadığını sanır. Arşiv
          // aramasında pencere aramanın kendisiyle çelişir (içtihat sekmesindeki aynı karar).
          days: legalQuery ? undefined : rangeDays(range),
          category: cat, excludeCategories: LEGAL_ONLY_CATEGORIES,
          textQuery: legalQuery ?? undefined, createdSince: since,
        });
  }
  else if (active === "sektorel") {
    // v6.99.3 — "Kaynak" filtresi (?s=ulusal|uluslararasi): etkinlik kapsamıyla aynı PARAM,
    // ayrı PARSE (v6.120) — haber kaynağında "uluslararası katılımlı" diye bir şey yok.
    // v6.142: param yoksa kayıtlı tercih (scope/eventTypes'la aynı sözleşme).
    const srcScope = sp.s !== undefined ? parseSourceScope(sp.s) : viewPrefs.sektorel.source;
    items = await moduleFeed("sektorel", [], {
      days: rangeDays(range), category: cat,
      sources: srcScope ? SECTOR_SOURCE_SCOPES[srcScope] : undefined,
      createdSince: since,
    });
  }
  else if (active === "ilac") items = await moduleFeed("ilac", [], { days: rangeDays(range), createdSince: since });
  if (items.length) items = await localizeTitles(items);

  // ── KULVAR AYRIMI (v6.132, kullanıcı kararı 2026-08-19) ────────────────────────────────
  // Tür çipleri kalkınca akış "karmaşa" olarak okundu (kullanıcı bildirimi): Doximity'nin
  // çipsiz kartı işliyor çünkü onun akışında HER ŞEY AYNI TÜR. Sekiz türü tek yığında
  // karıştıran akışın endüstri cevabı SEKME (Lexpera: tek arama → hukuki niteliğe göre ayrı
  // sekmeler). Kulvar yalnız AKIŞIM'da anlamlı — bölüm sekmeleri zaten tek modül gösteriyor.
  // ⚠️ Kulvar bir GÖRÜNÜM süzgecidir: sorgu değişmez, tercihler (feedModules) aynen işler.
  // 🔄 SÜPERSEDE (kullanıcı kararı 2026-08-20): kulvar SÜZGECİ kaldırıldı. Klinik/Mesleki
  // ayrımı akıştan çıkıp TERCİHLER SAYFASININ omurgası oldu — taksonomi artık içeriği
  // bölmüyor, ayarları örgütlüyor (/doktor/doctorium/tercihler). Akış yine tek yığın;
  // hangi bölümlerin gireceğine doktor tercihlerden karar verir (feedModules).
  // LANES sabiti lib/doctorium'a taşındı, tercihler sayfası oradan okur.
  // 🪤 Kulvar süzgeci ÇEŞİTLİLİĞİ BOZAR: personalFeed listeyi interleaveByModule ile
  // "aynı modülden art arda en fazla 3" olacak şekilde diziyor; diğer kulvarın kartları
  // çekilince kalanlar yeniden kümeleniyordu (canlıda art arda 6 HABER görüldü).
  // Süzgeçten SONRA yeniden geçiş şart.
  const shown = items;

  // v6.132 — TERCİH ile URL ilişkisi: URL parametresi kayıtlı tercihi EZER (paylaşılan bağlantı
  // beklendiği gibi açılmalı) ama tercihi DEĞİŞTİRMEZ; yalnız o görünüm için geçerlidir.
  // Parametre hiç yoksa doktorun tercihler sayfasındaki seçimi devreye girer.
  const scope = sp.s !== undefined ? parseScope(sp.s) : parseScope(doctor?.congressScope);
  // Etkinlik türü çipi (v6.120): ?t=sempozyum,kurs · ?t=hepsi · param yoksa TERCİH,
  // tercih de yoksa VARSAYILAN (kongre + sempozyum). Kariyer de ?t= kullanır ama farklı
  // modülde — çakışma yok.
  const eventTypes: EventTypeKey[] | null =
    active === "etkinlik"
      ? sp.t !== undefined ? parseEventTypes(sp.t) : parseEventTypePref(doctor?.congressEventTypes)
      : null;
  const followed = active === "etkinlik" && doctor ? await followedCongressIds(doctor.id) : new Set<string>();
  // "Takip ettiklerim" süzgeci (kullanıcı isteği 2026-08-19): ?f=takip yalnız takip edilen
  // YAKLAŞAN etkinlikleri listeler — tür/kapsam/branş süzgeçlerinden BAĞIMSIZ (doktor branş
  // dışından da takip etmiş olabilir; "takip ettim ama listede yok" sürprizi üretme). Takip
  // hâlâ bir bildirim aboneliğidir (congress-reminder üç eşiği); bu süzgeç yalnız GÖRÜNÜM.
  const followFilter = active === "etkinlik" && !!doctor && sp.f === "takip";
  const congresses = active === "etkinlik"
    ? followFilter
      ? await upcomingCongresses([], { onlyIds: [...followed] })
      : await upcomingCongresses(branches, { scope, types: eventTypes })
    : [];
  // Çip sayacı: süzgeç açıkken listenin kendisi; kapalıyken ayrı count (takip kaydı geçmiş
  // etkinlikte de durur — followed.size çipte olduğundan BÜYÜK sayı gösterirdi).
  const followedUpcoming = active === "etkinlik" && doctor && followed.size
    ? followFilter
      ? congresses.length
      : await upcomingCountByIds([...followed])
    : 0;

  // Kariyer modülü alt-sekmesi (v6.89): ?t=yurtdisi|turkiye — yalnız bu modülde anlamlı.
  // (?c= sektörel kategoriye, ?h= Hukuk'a, ?s= etkinlik kapsamına ait — param çakışması yok.)
  const careerTab: CareerTabKey | null = active === "kariyer" ? parseCareerTab(sp.t) : null;
  const pathways = careerTab ? await careerPathways(careerTab) : [];

  // v6.95: öğrenci-sınırlı üye (öğrenci damgası var, klinik aktivasyon yok) pazarlama yüzeyi
  // GÖRMEZ — sponsor kartı, anket (COMMUNITY dahil — kullanıcı kararı 2026-08-14) ve ödül puanı.
  // Tıp öğrencisi sağlık meslek mensubu değildir; meslek-mensubuna-tanıtım rejimi ona uygulanamaz.
  const studentOnly = !!doctor && isStudentOnly(doctor);

  // v6.68 Faz 1: sponsorlu kartlar YALNIZ Akışım'da (diğer sekmeler temiz kalır) ve boş akışa
  // basılmaz. Kişiselleştirilmiş seçim yalnız AÇIK RIZALI doktorda (sponsorPersonalizationAt);
  // rızasız doktor + personel hedefsiz (bağlamsal) kampanya görür. Sayaç agregat (kişisiz).
  const sponsorPersonalized = !!doctor?.sponsorPersonalizationAt;
  const sponsorCards: SponsorCard[] =
    active === "akis" && items.length > 0 && !studentOnly
      ? await activeCampaignsFor({ personalized: sponsorPersonalized, branches, city: doctor?.city ?? null })
      : [];
  if (sponsorCards.length) await countImpressions(sponsorCards.map((c) => c.id));

  // v6.69 Faz 2: akışta TEK anket kartı, yalnız DOCTOR'a (personel yanıtlayamaz → kart çizilmez).
  // COMMUNITY = içerik rejimi (akış branşları, rıza şartsız) · SPONSORED = pazarlama rejimi
  // (rıza-şartlı hedef — lib/survey.ts). Sonuç, yanıt verilmeden gösterilmez (önden sızdırma yok);
  // yanıtlamış doktora server-render'da hazır gelir.
  let surveyProps: Parameters<typeof SurveyCardView>[0] | null = null;
  if (active === "akis" && doctor && items.length > 0 && !studentOnly) {
    const [s] = await activeSurveysFor({ personalized: sponsorPersonalized, branches, city: doctor.city });
    if (s) {
      const myIndex = await doctorResponse(s.id, doctor.id);
      const initialResults = myIndex != null ? await aggregateResults(s.id, s.options.length) : null;
      surveyProps = {
        surveyId: s.id, kind: s.kind, sponsor: s.sponsor, question: s.question,
        options: s.options, points: s.points, myIndex, initialResults,
      };
    }
  }

  // v6.88 ödül puanı — yalnız DOCTOR'da; v6.95 öğrenci-sınırlıda null (koşullu-href: kapalı
  // yüzeyin linki çizilmez). Faz 1'de banttaki rozeti de bu değer besler (Shell prop'u).
  const myPointBalance = user.role === "DOCTOR" && doctor && !studentOnly ? await getDoctorBalance(doctor.id) : null;

  // Faz 2 (2026-08-14): kart "Kaydet" düğmelerinin başlangıç durumu — tek sorgu, Set.
  // Öğrenci-sınırlı DAHİL (kaydetme içerik işlevi, pazarlama yüzeyi değil); personelde null → düğme çizilmez.
  const isDoctor = user.role === "DOCTOR" && !!doctor;
  const savedIds = isDoctor && doctor ? await savedArticleIds(doctor.id) : null;

  // v6.102 bant nabzı: bugün akışa düşen içerik sayıları (Shell → Sidebar).
  const counts = await todayModuleCounts();

  return (
    <DoctoriumShell active={active} balance={myPointBalance} isDoctor={isDoctor} counts={counts}>
    {/* mx-auto (2026-08-18 Üst Raf kararı): sol bant kalktı, okuma kolonu ORTALI dergi
        düzeni — [id] ve kariyer/[slug] ile aynı hiza; eski sol-yaslı hiza bantla emekli. */}
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* Masaüstünde dönüş banttadır (layout DoctoriumSidebar); bu link yalnız mobil için. */}
      <Link href="/doktor" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)] md:hidden">
        <ArrowLeft size={15} /> Ana Sayfa
      </Link>

      {/* v6.102 "Nabızlı Kule": sayfa içi lockup BANTA taşındı (marka tek konumda yaşar —
          DoctoriumSidebar kimlik bloğu; 2026-08-01 L1 kimliği orada sürer). Sahne başlığı
          artık sayfanın h1'i; öğrenci rozeti onun satırında. Slogan portal içinden kalktı
          (landing'de yaşıyor). Mobilde marka Header'daki AURA↔Doctorium toggle'ında. */}

      {/* Mobil grup şeridi KALKTI (2026-08-19): alt çubuk artık rafın birebir eşleniği,
          tüm modüller orada — page-içi ikinci şerit çift navigasyon olurdu. */}

      {/* Modül üst alanı (Faz 1, taslak v3.2 — metinler kullanıcı onaylı 2026-08-14): mono etiket
          (modül kimlik renginde) + display başlık + tek satır açıklama. 2026-08-01'de kaldırılan
          silik "desc satırı"nın dönüşü DEĞİL — editoryal başlık bloğu, ayrı karar. */}
      <div className="mt-5">
        <div
          className="aura-mono text-[11px] font-bold tracking-[0.16em]"
          style={{ color: MODULE_HEAD[active].color ?? "var(--c-ink)" }}
        >
          {MODULE_HEAD[active].eyebrow}
        </div>
        {/* text-3xl = /doktor ve Post-Op h1 ölçüsü. v6.102: lockup banta taşınınca sahnenin
            asıl başlığı h1 oldu (sayfa başına tek h1 — erişilebilirlik). */}
        {/* Başlık + ÖZELLEŞTİR düğmesi tek satırda (kullanıcı isteği 2026-08-20): tercihler
            artık ayrı sayfa, girişi de sahne başlığının yanında duruyor. Yalnız DOCTOR'a
            çizilir — personelin yazacağı tercih yok (koşullu-href ilkesi). */}
        <div className="mt-1 flex flex-wrap items-start justify-between gap-x-5 gap-y-3">
          <h1 className="aura-display flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            {MODULE_HEAD[active].title}
            {/* v6.95 — öğrenci-sınırlı üyelik etiketi: mono rozet, yüzey boyamaz (kit renk disiplini) */}
            {studentOnly && (
              <span className="aura-mono rounded-full border border-[var(--c-hairline)] px-2 py-px text-[11px] font-semibold uppercase tracking-wider text-[var(--c-ink-3)]">
                Öğrenci Üyeliği
              </span>
            )}
          </h1>
          {isDoctor && (
            <Link
              href="/doktor/doctorium/tercihler"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2.5 text-[14px] font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
            >
              <SlidersHorizontal size={16} /> Özelleştir
            </Link>
          )}
        </div>
        <p className="mt-1.5 text-[13px] text-[var(--c-ink-2)]">{MODULE_HEAD[active].desc}</p>
      </div>

      {/* Sayaç + kulvar — yalnız Akışım'da. İkisi birlikte çalışır: sayaç "ne kadar var"ı,
          kulvar "hangi tür nerede"yi söyler. Tür çipleri kalktığı için ikisi de yapısal
          gereklilik oldu (kullanıcı bildirimi 2026-08-19: çipsiz + kulvarsız akış "karmaşa"). */}
      {/* "Yeni" süzgeci açıkken kapatma yolu GÖRÜNÜR olmalı (aktif süzgeç çipi deseni —
          içtihat anahtar kelimesi ve "Takip ettiklerim" ile aynı dil). Yoksa doktor kısa
          listeyi "içerik bitmiş" sanır. */}
      {onlyNew && (
        <div className="mt-4">
          <Link
            href={active === "akis" ? "/doktor/doctorium" : `/doktor/doctorium?m=${active}`}
            className="aura-mono inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.4)] hover:bg-emerald-500/25"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
            Yalnızca bugün eklenenler
            <X size={11} />
          </Link>
        </div>
      )}

      {active === "akis" && <PulseStrip items={items} todayCounts={counts} />}

      {/* Sayaç → akış geçiş ayracı (2026-08-21, kullanıcı bildirimi: "sayaçtan sonra habere
          geçiş çok belli olmuyor"). PulseStrip'in son kartı görmezden gelinip akışın ilk kartına
          kayabildiği tek nokta buydu — ikisi de aura-display + benzer ölçüde rakam/başlık
          taşıyordu, aralarında hiçbir ayrım yoktu (ilk kart üst saç çizgisini de kapatıyor,
          bkz. ArticleCard "first:border-t-0"). Kutu YOK: mevcut dile uyan mono etiket + saç
          çizgisi — PulseStrip'in kendi "BUGÜN AKIŞA DÜŞEN" etiketiyle aynı gramer. */}
      {active === "akis" && shown.length > 0 && (
        <div className="mt-6 flex items-center gap-2.5" aria-hidden="true">
          <span className="aura-mono shrink-0 text-[10px] font-bold tracking-[0.14em] text-[var(--c-ink-3)]">
            SON EKLENENLER
          </span>
          <span className="h-px flex-1 bg-[var(--c-hairline)]" />
        </div>
      )}

      {/* "Takip ettiklerim (N)" süzgeç çipi (kullanıcı isteği 2026-08-19): İçtihat anahtar-kelime
          çipi deseninin etkinlik eşleniği — URL'de taşınır (?f=takip), paylaşılabilir; renk dili
          FollowButton'ın amber yıldızı. Takipli yaklaşan etkinlik 0 ise ÇİZİLMEZ (koşullu-href:
          işlevsiz yüzeyin linki çizilmez); personel (doctor'suz) hiç görmez. İSTİSNA: süzgeç
          AÇIKKEN çip 0'da da çizilir — yoksa aktif süzgecin kapatma yolu (X) kaybolur (takipler
          geçmişte kalmış + elle URL senaryosu). Süzgeç açıkken çipi kapatmak tür/kapsam
          parametrelerini de sıfırlar — takip modu zaten onlardan bağımsızdı. */}
      {active === "etkinlik" && (followedUpcoming > 0 || followFilter) && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <Link
            href={followFilter ? "/doktor/doctorium?m=etkinlik" : "/doktor/doctorium?m=etkinlik&f=takip"}
            aria-current={followFilter ? "true" : undefined}
            className={`aura-mono inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              followFilter
                ? "bg-amber-500/20 text-amber-300 shadow-[inset_0_0_0_1px_#fbbf24]"
                : "bg-amber-500/[0.08] text-amber-300/90 hover:bg-amber-500/15"
            }`}
          >
            <Star size={11} className={followFilter ? "fill-amber-300" : ""} />
            Takip ettiklerim ({followedUpcoming})
            {followFilter && <X size={11} />}
          </Link>
        </div>
      )}

      {/* Kariyer alt-sekmeleri (v6.89): Yurt Dışı · Türkiye. Hukuk şeridinin birebir eşleniği
          (ikincil nav görünümü). Yurt Dışı linki t'siz: varsayılan sekme, kanonik URL tek kalsın. */}
      {active === "kariyer" && (
        <nav className="mt-3.5 flex items-center gap-4 border-b border-[var(--c-hairline)]" aria-label="Kariyer bölümleri">
          {CAREER_TABS.map((t) => {
            const on = careerTab === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "yurtdisi" ? "/doktor/doctorium?m=kariyer" : `/doktor/doctorium?m=kariyer&t=${t.key}`}
                aria-current={on ? "page" : undefined}
                className={`-mb-px border-b-2 pb-2 text-xs font-semibold transition ${
                  on
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* Beklenti notu (kullanıcı onaylı metin, 2026-08-12): doktor "Kariyer" görünce iş ilanı
          bekleyebilir — bu bölümde ilan YOK. Aynı zamanda İŞKUR sınırının kullanıcıya bakan yüzü:
          aracılık yapılmadığı burada açıkça yazılı (envanter §3). */}
      {active === "kariyer" && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
          <Info size={13} className="mt-px shrink-0 text-emerald-300" />
          Bu bölüm iş ilanı içermez; doktorluk süreçlerinin nasıl işlediğini anlatır.
        </p>
      )}

      {/* Hukuk alt-sekmeleri (v6.86; v6.91'de Doktrin açıldı — TR-Dizin içeriğiyle).
          Modül pill'lerinden bilinçli İKİNCİL görünüm (küçük, alt çizgili aktiflik) — iki nav
          katmanı yarışmasın. Mevzuat linki h'siz: varsayılan sekme, kanonik URL tek kalsın. */}
      {active === "mevzuat" && (
        <nav className="mt-3.5 flex items-center gap-4 border-b border-[var(--c-hairline)]" aria-label="Hukuk bölümleri">
          {LEGAL_TABS.map((t) => {
            const on = legalTab === t.key;
            return (
              <Link
                key={t.key}
                href={t.key === "mevzuat" ? "/doktor/doctorium?m=mevzuat" : `/doktor/doctorium?m=mevzuat&h=${t.key}`}
                aria-current={on ? "page" : undefined}
                className={`-mb-px border-b-2 pb-2 text-xs font-semibold transition ${
                  on
                    ? "border-emerald-400 text-emerald-300"
                    : "border-transparent text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      )}

      {/* "Hukuk bölümü nedir, nasıl kullanılır?" kutusu KALDIRILDI (kullanıcı kararı
          2026-08-18) — 2026-08-11'de eklenen <details> tanıtımı süperseDE; içtihat
          kartlarındaki "hukuki mütalaa değildir" uyarısı kart düzeyinde yaşamaya devam eder. */}

      {/* Hukuk arama kutusu (v6.132, kullanıcı isteği): ÜÇ alt-sekmede de var — mevzuat,
          içtihat, doktrin. Üstte yalnız başlık + arama; içtihatta örnek anahtar kelimeler
          AÇILIR KAPANIR bölümde. Prospektüs kutusuyla aynı desen — arşiv yüzeyleri aynı
          dili konuşur. */}
      {active === "mevzuat" && legalTab && (
        <LegalSearchBox tab={legalTab} query={legalQuery} activeKeyword={legalKeyword?.key ?? null} />
      )}

      {/* Sekme içi "Özelleştir" paneli KALDIRILDI (v6.142, kullanıcı kararı 2026-08-23):
          sektörel/ilaç/etkinlik/mevzuat'ta AYNI adı taşıyan İKİ ayrı kontrol duruyordu — üstteki
          başlık düğmesi (/tercihler, kalıcı) ve burada geçici bir görünüm paneli (DoctoriumFilters,
          şimdi silindi). Kaynak/Geriye dönük/Kategori/Etkinlik türü/Kapsam artık HEPSİ /tercihler'de
          kalıcı tercih (lib/doctorium parseViewPrefs + PreferencesBoard.tsx); yukarıdaki
          range/cat/srcScope ve scope/eventTypes hâlâ URL parametresiyle (?d=/?c=/?s=/?t=) o GÖRÜNÜM
          için ezilebilir — kalıcı tercihi DEĞİŞTİRMEZ (paylaşılan bağlantı beklendiği gibi açılır). */}

      {active === "ilac" && <ProspektusSearch />}

      {active === "kariyer" ? (
        <CareerList rows={pathways} savedIds={savedIds} />
      ) : active === "etkinlik" ? (
        <CongressList rows={congresses} followed={followed} canFollow={!!doctor} savedIds={savedIds} followedOnly={followFilter} />
      ) : (
        <>
          {shown.length === 0 ? (
            <EmptyState active={active} focus={focus} range={range} legalTab={legalTab} keywordLabel={legalKeyword?.label ?? null} />
          ) : (
            <ul className="mt-5 grid grid-cols-[minmax(0,1fr)]">
              {/* grid-cols-[minmax(0,1fr)] (2026-08-16 taşma dersi): örtük "auto" kolon, en geniş
                  kartın min-content'ine BÜYÜR (grid item min-width:auto) — truncate'li nowrap
                  metinler mobilde tüm listeyi 441px'e itiyordu. minmax(0,1fr) kolonu konteynere
                  kilitler; kart içi max-w/truncate zinciri ancak o zaman çalışır.
                  ⚠️ gap-3 KALKTI (sentez, 2026-08-19): öğeler artık kendi üst saç çizgileriyle
                  ayrılıyor — boşluk + çizgi birlikte çift ayrım olurdu. */}
              {/* Sponsorlu kart enjeksiyonu (v6.68): 1.si 2 organik karttan, 2.si 9 organikten
                  sonra; akış kısaysa listenin sonuna düşer (frekans tavanı MAX_FEED_CARDS=2). */}
              {/* Kart görünümü TÜM listelerde TEK (5. tur kullanıcı kararı): Akışım'daki kart,
                  bölüm sekmesindekiyle birebir aynı — bölüm kimliği şerit + çip + sembol taşır.
                  (Manşet varyantı 4. turda, kart üstü modül etiketi 5. turda kaldırıldı.) */}
              {/* AĞIRLIK RİTMİ (sentez, 2026-08-19): ilk öğe lider, sonraki dördü orta, kalanı
                  kompakt. Oran Guardian'ın 452 kart ölçümünden: ~%4 lider · ~%11 orta · ~%70
                  iş gören. Ölçü farkı bilinçli DAR (23/17/15px = 1,53x) — dramatik büyütme
                  editoryal ürünlerde de yok. Tek ölçüye inmek monotonluğu kurumsallaştırır
                  (anti-örnek CNN Lite: 101 kalem tek ölçü → düz liste). */}
              {shown.map((it, i) => (
                <Fragment key={it.id}>
                  {i === 2 && sponsorCards[0] && <SponsorCardView c={sponsorCards[0]} />}
                  {i === 5 && surveyProps && <SurveyCardView {...surveyProps} />}
                  {i === 9 && sponsorCards[1] && <SponsorCardView c={sponsorCards[1]} />}
                  <ArticleCard
                    item={it}
                    saved={savedIds ? savedIds.has(it.id) : null}
                    weight={i === 0 ? "lead" : i <= 4 ? "mid" : "min"}
                  />
                </Fragment>
              ))}
              {shown.length <= 2 && sponsorCards[0] && <SponsorCardView c={sponsorCards[0]} />}
              {shown.length <= 5 && surveyProps && <SurveyCardView {...surveyProps} />}
              {shown.length <= 9 && sponsorCards[1] && <SponsorCardView c={sponsorCards[1]} />}
              {/* Sonsuz kaydırma (2026-08-21): yalnız Akışım, yalnız sunucudaki ilk parti
                  tükenmediyse (feedNextCursor null değilse) render edilir. */}
              {active === "akis" && feedNextCursor && (
                <FeedLoadMore focus={focus} initialCursor={feedNextCursor} onlyNew={onlyNew && !focus} />
              )}
            </ul>
          )}
        </>
      )}
    </div>
    </DoctoriumShell>
  );
}

/**
 * Akış nabzı — "12 makale · 8 hukuk · 5 haber".
 *
 * 🔄 SÜPERSEDE (aynı gün, kullanıcı bildirimi "yukarıda sayaç yok"): ilk sürüm
 * todayModuleCounts'u (BUGÜN eklenen) sayıyordu ve gece ingest'i koşmamışsa şerit hiç
 * çizilmiyordu — kullanıcı sentezde gördüğü sayacı canlıda bulamadı. Artık AKIŞIN KENDİ
 * BİLEŞİMİNİ sayar: içerik varsa sayaç da vardır. Tazelik bilgisi zaten rafta yaşıyor
 * (DoctoriumSidebar "BUGÜN N YENİ" nabzı) — ikisi farklı soruyu yanıtlar, tekrar değil.
 *
 * Gerekçe (saha taraması, Türkiye bulgusu): Türk profesyoneli "yoğunluk = zenginlik"
 * refleksiyle geliyor; sakin tek kolonlu koyu ekran ilk saniyede "içerik az" okunabiliyor.
 * Çözüm koyu temayı bırakmak değil, yoğunluğu SAYIYLA vermek.
 */
const PULSE_LABEL: { key: string; label: string }[] = [
  { key: "akademik", label: "makale" },
  { key: "mevzuat", label: "hukuk" },
  { key: "sektorel", label: "haber" },
  { key: "ilac", label: "ilaç ve cihaz" },
  { key: "etkinlik", label: "etkinlik" },
  { key: "kariyer", label: "rehber" },
];

function PulseStrip({ items, todayCounts }: { items: FeedItem[]; todayCounts: Record<string, number> }) {
  // İKİ DURUM, tek bileşen (kullanıcı isteği 2026-08-19 "tıklayınca yalnızca yenilere gitsin"):
  //  · BUGÜN YENİ varsa → gece ingest'inin getirdiği sayılar; tıklama `?n=1` ile o modülün
  //    YALNIZCA yeni kayıtlarına götürür (createdAt sınırı sayaçla aynı: trDayStart).
  //  · Hiç yeni yoksa → akışın bileşimi; tıklama süzgeçsiz modüle götürür. Şerit KAYBOLMAZ
  //    (ilk sürümün hatası buydu: ingest koşmamışsa sayaç yok oluyordu).
  const todayTotal = Object.values(todayCounts).reduce((a, b) => a + b, 0);
  const fresh = todayTotal > 0;
  const by = new Map<string, number>();
  for (const i of items) by.set(i.module, (by.get(i.module) ?? 0) + 1);
  const rows = PULSE_LABEL
    .map((p) => ({ ...p, n: fresh ? todayCounts[p.key] ?? 0 : by.get(p.key) ?? 0 }))
    .filter((p) => p.n > 0);
  // 🪤 Eşik moda göre DEĞİŞİR (dev'de yakalandı): bileşim modunda tek satır bilgi taşımaz
  // (akışın zaten tek türden olduğunu söyler), ama YENİ modunda "3 yeni makale" tek başına
  // değerlidir. Tek eşik kullanınca, gecede yalnız bir modüle içerik düştüğünde şerit
  // tamamen kayboluyordu — kullanıcının "sayaç yok" şikâyetiyle aynı sınıftan hata.
  if (rows.length < (fresh ? 1 : 2)) return null;

  return (
    // Çerçeve KALKTI (kullanıcı kararı 2026-08-20): kutu, kart dilinden kutuları kaldırma
    // kararıyla çelişiyordu — sayaç da artık boşlukla ayrılıyor.
    <div className="mt-4">
      <div className="aura-mono flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-emerald-300">
        {fresh && <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />}
        {fresh ? "BUGÜN AKIŞA DÜŞEN" : "AKIŞINDA"}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-2">
        {rows.map((r) => (
          <Link
            key={r.key}
            href={fresh ? `/doktor/doctorium?m=${r.key}&n=1` : `/doktor/doctorium?m=${r.key}`}
            className="group flex items-baseline gap-1.5"
            title={fresh ? `${r.label}: bugün eklenen ${r.n} kayıt` : `${r.label}: akışında ${r.n} kayıt`}
          >
            <span className="aura-display text-[22px] font-semibold leading-none tracking-tight tabular-nums text-[var(--c-ink)] transition-colors group-hover:text-emerald-300">
              {r.n}
            </span>
            <span className="text-[13px] text-[var(--c-ink-3)] transition-colors group-hover:text-[var(--c-ink-2)]">
              {r.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// LEGAL_BOX + LegalSearchBox → ./LegalSearchBox.tsx (2026-08-23; landing V2 demo modunda da kullanır).

function EmptyState({ active, focus, range, legalTab, keywordLabel }: { active: ModuleKey; focus: string | null; range: string; legalTab: LegalTabKey | null; keywordLabel: string | null }) {
  const label = RANGE_OPTIONS.find((r) => r.key === range)?.label.toLocaleLowerCase("tr-TR") ?? "";
  const msg = focus
    ? `${branchLabel(focus)} için henüz yayın toplanmadı. Akış her gece güncellenir.`
    : active === "mevzuat" && legalTab === "ictihat" && keywordLabel
      ? `"${keywordLabel}" terimi arşivdeki hiçbir kararın metninde geçmiyor. Çipi kapatıp tüm arşivi görebilirsiniz.`
      : active === "mevzuat" && legalTab === "ictihat"
      ? "İçtihat arşivi henüz yüklenmedi. Sağlık hukuku ve malpraktis konulu Yargıtay kararları toplandıkça burada listelenecek."
      : active === "mevzuat"
      ? `Seçtiğiniz ${label} pencerede bu kategoride mevzuat kaydı yok. Resmî Gazete + OHSAD her gece taranır; daha geniş aralık veya "Tümü" kategorisini deneyin.`
      : active === "sektorel"
        ? `Seçtiğiniz ${label} pencerede bu kategoride sektörel haber yok. Daha geniş bir aralık deneyebilirsiniz.`
        : active === "ilac"
          ? `Seçtiğiniz ${label} pencerede ilaç/cihaz kaydı yok. Geri çekme ve klinik faz akışı her gece güncellenir.`
          : "Henüz içerik toplanmadı. Yayın akışı her gece güncellenir.";
  return (
    <p className="mt-6 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
      <Info size={16} className="mt-0.5 shrink-0" />
      <span>{msg}</span>
    </p>
  );
}

// formatDate + KIND_STYLE + Cover + IctihatCardMeta + ArticleCard → ./ArticleCard.tsx'e taşındı
// (Faz 2, 2026-08-14): Kaydettiklerim sayfası aynı kartı kullanıyor.

// Sponsorlu kart (v6.68 Faz 1): organik karttan NET görsel+metinsel ayrım — kesikli amber çerçeve
// + "Sponsorlu · <reklamveren>" mono rozet (iddia dürüstlüğü: doğal içerik görünümü verilmez;
// çerçeve sözleşme taslağı Belge 2 md.2a). Renk disiplini korunur: amber yalnız şerit/rozet, yüzey
// boyanmaz. Tıklama /api/sponsor/click üzerinden sayılır (agregat) → dış bağlantı rel="sponsored".
function SponsorCardView({ c }: { c: SponsorCard }) {
  return (
    /* Kart standardı (2026-08-14, 4. tur — kullanıcı): sponsor kutusu TÜM ÇEVRE kalın sarı
       (yalnız sol şerit değil). Reklam ayrımı: kalın amber çerçeve + megafon + SPONSORLU rozet. */
    <li className="rounded-2xl border-2 border-amber-400/70 bg-[var(--c-surface)] px-4 py-3.5">
      <div className="flex items-center gap-2">
        <Megaphone size={16} strokeWidth={1.9} style={{ color: "#f59e0b" }} />
        <span className="aura-mono text-[11px] font-bold tracking-[0.16em] text-amber-300">SPONSORLU</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="aura-mono rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
          Sponsorlu · {c.sponsor}
        </span>
        <span className="aura-mono rounded-full bg-[var(--c-surface-2)] px-2 py-0.5 text-[11px] text-[var(--c-ink-2)]">
          {SPONSOR_CATEGORY_LABEL[c.category] ?? c.category}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold leading-snug text-[var(--c-ink)]">{c.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-2)]">{c.body}</p>
      {c.linkUrl && (
        <a
          href={`/api/sponsor/click?id=${c.id}`}
          target="_blank"
          rel="sponsored noopener"
          className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:underline"
        >
          {c.linkLabel || "Ayrıntılar"} <ExternalLink size={11} />
        </a>
      )}
    </li>
  );
}

// CongressRow + CongressList → ./CongressList.tsx (2026-08-23; landing V2 salt-okunur kullanır).

// ── Kariyer modülü (v6.89) ──────────────────────────────────────────────────
// Ortak parçalar (uyarı · tarih biçimi · ülke etiketi) ./CareerShared'da — detay sayfası da
// oradan okur (route dosyasından bileşen import etmek Next.js'te kırılgan olurdu).

/**
 * Süreç kartları. Her kartta "Son doğrulama" GÖRÜNÜR (bayatlık gizlenmez); confidence="kismi"
 * kayıtlar "Teyit bekliyor" ibaresi taşır — doktor bilginin kesinlik derecesini kartta görür.
 * ⚠️ Başvuru butonu / işveren teması YOK (İŞKUR sınırı) — kart yalnız detay sayfasına götürür.
 */
function CareerList({ rows, savedIds }: { rows: Awaited<ReturnType<typeof careerPathways>>; savedIds: Set<string> | null }) {
  if (!rows.length) {
    return (
      <>
        <p className="mt-5 rounded-2xl border border-dashed border-[var(--c-hairline)] px-4 py-6 text-center text-xs leading-relaxed text-[var(--c-ink-3)]">
          Bu kapsamda henüz süreç kaydı yok. Kayıtlar resmî otorite kaynaklarından doğrulanarak
          eklenir — doğrulanmamış bilgi yayımlanmaz.
        </p>
        <CareerDisclaimer />
      </>
    );
  }
  return (
    <>
      {/* grid-cols-[minmax(0,1fr)]: ana listedeki taşma dersinin eşleniği. */}
      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)]">
        {rows.map((p) => (
          /* Kutu KALKTI (sentez, 2026-08-19) — ArticleCard gramerine hizalandı. Künyeyi
             OTORİTE açar (Bundesärztekammer, GMC…): kariyerde güvenin kaynağı odur. */
          <li key={p.id} className="min-w-0 border-t border-[var(--c-hairline)] py-[17px] first:border-t-0 first:pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <SourcePlate name={p.authority} />
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold leading-[1.3] text-[var(--c-ink)]">
                    {p.authority}
                  </div>
                  <div className="mt-px flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[var(--c-ink-3)]">
                    <span className="aura-mono text-[11px] font-semibold tracking-[0.06em] text-blue-300">
                      {(COUNTRY_LABEL[p.country] ?? p.country).toLocaleUpperCase("tr-TR")}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>Son doğrulama: {careerDate(p.verifiedAt)}</span>
                    {p.confidence === "kismi" && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="aura-mono text-[11px] font-semibold text-amber-300">TEYİT BEKLİYOR</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {savedIds != null && <SaveButton articleId={p.slug} initialSaved={savedIds.has(p.slug)} />}
            </div>

            <Link
              href={`/doktor/doctorium/kariyer/${p.slug}`}
              className="aura-display mt-2.5 block text-[17px] font-semibold leading-[1.32] tracking-[-0.018em] text-[var(--c-ink)] hover:underline hover:underline-offset-[3px]"
            >
              {p.title}
            </Link>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">{p.summary}</p>

            {(p.languageReq || p.examReq) && (
              <dl className="mt-3 grid gap-1.5 text-[11px] sm:grid-cols-2">
                {p.languageReq && (
                  <div>
                    <dt className="text-[var(--c-ink-3)]">Dil şartı</dt>
                    <dd className="text-[var(--c-ink-2)]">{p.languageReq}</dd>
                  </div>
                )}
                {p.examReq && (
                  <div>
                    <dt className="text-[var(--c-ink-3)]">Sınav</dt>
                    <dd className="text-[var(--c-ink-2)]">{p.examReq}</dd>
                  </div>
                )}
              </dl>
            )}

            {p.warning && (
              <p className="mt-3 flex items-start gap-1.5 rounded-xl bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
                <Info size={12} className="mt-0.5 shrink-0" /> {p.warning}
              </p>
            )}

            {/* Çizgili aksiyon satırı KALKTI (sentez): başlık zaten aynı yere gidiyor, bu
                link yalnız ne bulunacağını söylediği için meta tonunda kuyrukta kalır. */}
            <Link
              href={`/doktor/doctorium/kariyer/${p.slug}`}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-300 hover:underline"
            >
              Adımları ve belge listesini gör <ArrowLeft size={11} className="rotate-180" />
            </Link>
          </li>
        ))}
      </ul>
      <CareerDisclaimer />
    </>
  );
}
