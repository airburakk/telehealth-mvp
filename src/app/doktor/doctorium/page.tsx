import { Fragment } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  activeCampaignsFor, countImpressions, SPONSOR_CONSENT_TEXT, CATEGORY_LABEL as SPONSOR_CATEGORY_LABEL,
  type SponsorCard,
} from "@/lib/sponsor";
import { activeSurveysFor, doctorResponse, aggregateResults } from "@/lib/survey";
import { SurveyCardView } from "./SurveyCard";
import {
  DOCTORIUM_MODULES, RANGE_OPTIONS, DEFAULT_RANGE, rangeDays,
  SECTOR_CATEGORIES, SECTOR_SOURCE_SCOPES, LEGAL_TABS, parseLegalTab, LEGAL_ONLY_CATEGORIES,
  CAREER_TABS, parseCareerTab, careerPathways,
  effectiveBranches, personalFeed, moduleFeed, singleBranchFeed, upcomingCongresses,
  localizeTitles, branchLabel, followedCongressIds, BRANCH_OPTIONS, parseBranchPrefs,
  slugForLabel, parseScope, savedArticleIds, FEED_MODULE_OPTIONS, parseFeedModules,
  todayModuleCounts,
  type FeedItem, type ModuleKey, type LegalTabKey, type CareerTabKey,
} from "@/lib/doctorium";
import { isStudentOnly } from "@/lib/doctor-activation";
import { HUKUK_KEYWORDS, keywordByKey } from "@/lib/hukuk-keywords";
import { DoctoriumFilters } from "./DoctoriumFilters";
import { FollowButton } from "./CongressControls";
import { ProspektusSearch } from "./ProspektusSearch";
import { CareerDisclaimer, careerDate, COUNTRY_LABEL } from "./CareerShared";
import { ArticleCard, formatDate } from "./ArticleCard";
import { SaveButton } from "./SaveButton";
import {
  ArrowLeft, ExternalLink, Info, MapPin, X, CalendarClock, Megaphone,
} from "lucide-react";
import { getDoctorBalance } from "@/lib/rewards";
import { DoctoriumShell } from "./DoctoriumSidebar";

export const dynamic = "force-dynamic";

// Sekme başlığı "Doctorium · AURA" — kök layout template'i (%s · AURA) ekler, ELLE " · AURA" YAZMA
// (v6.43 dersi: çift-AURA olur).
export const metadata = { title: "Doctorium" };

const MODULE_KEYS = new Set(DOCTORIUM_MODULES.map((m) => m.key));
const VALID_SLUGS = new Set(BRANCH_OPTIONS.map((b) => b.slug));

// Modül üst alanı metinleri (Faz 1, kullanıcı onayı 2026-08-14). Renkler = kart kapağı (Cover) +
// bant (DoctoriumSidebar) kimlik hex'leri; Kongre'nin kimliği "beyaz" = tema-duyarlı ink (color
// yok → var(--c-ink)). Kariyer satırı İŞKUR sınırının dilini korur ("ilan değil").
const MODULE_HEAD: Record<ModuleKey, { eyebrow: string; title: string; desc: string; color?: string }> = {
  akis: { eyebrow: "AKIŞIM", title: "Sizin için seçilenler", desc: "Branşınız, bilimsel yayınlar ve sektörel gelişmeler tek akışta.", color: "#facc15" },
  akademik: { eyebrow: "AKADEMİK", title: "Branşınızda hakemli yayınlar", desc: "PubMed, Europe PMC ve DOAJ'dan hakemli çalışmalar, kısa klinik özetlerle.", color: "#34d399" },
  sektorel: { eyebrow: "SEKTÖREL", title: "Sağlık gündeminin nabzı", desc: "Doktor hakları, yönetim, teknoloji ve küresel gelişmeler.", color: "#a78bfa" },
  ilac: { eyebrow: "İLAÇ & CİHAZ", title: "Geri çekmeler ve klinik fazlar", desc: "Ruhsat, geri çekme, klinik faz ve prospektüs bilgisi tek yerde.", color: "#22d3ee" },
  kongre: { eyebrow: "KONGRE", title: "Kongre takvimi", desc: "Ulusal ve uluslararası kongreler; bildiri ve erken kayıt tarihleriyle." },
  kariyer: { eyebrow: "KARİYER", title: "Doktorluk yollarının haritası", desc: "Yurt dışı denklik ve akademik yükselme süreçleri — ilan değil, süreç bilgisi.", color: "#60a5fa" },
  mevzuat: { eyebrow: "HUKUK", title: "Sağlık hukuku, tek yerde", desc: "Mevzuat değişiklikleri, emsal kararlar ve hakemli doktrin.", color: "#fb7185" },
};

// Mobil grup şeridi üyelikleri (M2): BİLGİ ve MESLEĞİM grupları — DoctoriumSidebar'daki
// gruplamanın page tarafındaki eşleniği (alt çubuk grubu seçer, şerit modülü seçer).
const MOBILE_GROUPS: Partial<Record<ModuleKey, ModuleKey[]>> = {
  akademik: ["akademik", "sektorel", "ilac"],
  sektorel: ["akademik", "sektorel", "ilac"],
  ilac: ["akademik", "sektorel", "ilac"],
  kongre: ["kongre", "kariyer", "mevzuat"],
  kariyer: ["kongre", "kariyer", "mevzuat"],
  mevzuat: ["kongre", "kariyer", "mevzuat"],
};

// Doctorium — doktor bilgi portalı. Modüller: Akışım (A) · Akademik (C) · Sektörel (B) · Kongre (E).
// Modül D (ilaç tanıtımı/e-mümessil) PARK: TİTCK tanıtım yönetmeliği hukuki görüş ister.
export default async function DoctoriumPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; d?: string; b?: string; c?: string; s?: string; h?: string; k?: string; t?: string }>;
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
          // v6.68: sponsorlu içerik kişiselleştirme rızası (city hedefleme için birlikte okunur).
          sponsorPersonalizationAt: true,
        },
      })
    : null;
  const branches = effectiveBranches(doctor?.newsBranches, doctor?.branch);

  const sp = await searchParams;
  const active: ModuleKey = sp.m && MODULE_KEYS.has(sp.m as ModuleKey) ? (sp.m as ModuleKey) : "akis";
  const range = RANGE_OPTIONS.some((r) => r.key === sp.d) ? (sp.d as string) : DEFAULT_RANGE;
  // Tek-branş odağı (?b=): çipleri üreten "Akışınız:" şeridi KALDIRILDI (kullanıcı kararı
  // 2026-08-18 — çok branşta renk karmaşası); parametre eski/paylaşılan URL'ler için yaşar.
  // Yalnız doktorun AKIŞINDAKİ branşlar seçilebilir (rastgele slug'la başka akış açılmasın).
  const focus = sp.b && VALID_SLUGS.has(sp.b) && branches.includes(sp.b) ? sp.b : null;

  const cat = sp.c && SECTOR_CATEGORIES.some((x) => x.key === sp.c) ? sp.c : null;
  // Hukuk modülü alt-sekmesi (v6.86): ?h=mevzuat|ictihat — yalnız bu modülde anlamlı.
  const legalTab: LegalTabKey | null = active === "mevzuat" ? parseLegalTab(sp.h) : null;
  // İçtihat anahtar-kelime filtresi (v6.87): ?k= sözlük anahtarı; bilinmeyen değer filtresiz liste.
  const legalKeyword = legalTab === "ictihat" ? keywordByKey(sp.k) : null;

  // Akış Tercihleri (Faz 2): [] = tümü. Kongre/Kariyer dahil her seçili bölüm akışa KART olarak
  // girer (bölüm-kotalı karışım — lib/doctorium personalFeed).
  const feedMods = parseFeedModules(doctor?.feedModules);

  let items: FeedItem[] = [];
  if (active === "akis") items = focus ? await singleBranchFeed(focus) : await personalFeed(branches, 40, feedMods);
  else if (active === "akademik") items = await moduleFeed("akademik", branches);
  else if (active === "mevzuat") {
    // İçtihat + Doktrin = ARŞİV: tarih penceresi bilinçli YOK — kararlar/makaleler eski tarihli
    // (dizin yıl bazlı), 30 günlük varsayılan pencere sekmeyi daima boş gösterirdi.
    items = legalTab === "ictihat"
      ? await moduleFeed("mevzuat", [], { category: "ictihat", textContainsAny: legalKeyword?.patterns })
      : legalTab === "doktrin"
      ? await moduleFeed("mevzuat", [], { category: "doktrin" })
      : await moduleFeed("mevzuat", [], { days: rangeDays(range), category: cat, excludeCategories: LEGAL_ONLY_CATEGORIES });
  }
  else if (active === "sektorel") {
    // v6.99.3 — "Kaynak" filtresi (?s=ulusal|uluslararasi): kongre kapsamıyla aynı param/parse.
    const srcScope = parseScope(sp.s);
    items = await moduleFeed("sektorel", [], {
      days: rangeDays(range), category: cat,
      sources: srcScope ? SECTOR_SOURCE_SCOPES[srcScope] : undefined,
    });
  }
  else if (active === "ilac") items = await moduleFeed("ilac", [], { days: rangeDays(range) });
  if (items.length) items = await localizeTitles(items);

  const scope = parseScope(sp.s);
  const congresses = active === "kongre" ? await upcomingCongresses(branches, { scope }) : [];
  const followed = active === "kongre" && doctor ? await followedCongressIds(doctor.id) : new Set<string>();

  // Kariyer modülü alt-sekmesi (v6.89): ?t=yurtdisi|turkiye — yalnız bu modülde anlamlı.
  // (?c= sektörel kategoriye, ?h= Hukuk'a, ?s= kongre kapsamına ait — param çakışması yok.)
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

      {/* Mobil grup şeridi (M2, Faz 1 — taslak v3.2): alt çubuk (layout'taki DoctoriumSidebar)
          grubu seçer, bu şerit grubun modüllerini gezdirir; Akışım'da şerit yok. Masaüstünde
          navigasyonu sol bant devraldı — v6.88 pill dizisi + Puanlarım pill'i Faz 1'de kalktı
          (Puanlarım rozeti bantta yaşıyor; bakiye layout'ta hesaplanır). */}
      {MOBILE_GROUPS[active] && (
        <nav
          className="mt-4 flex items-center gap-4 overflow-x-auto border-b border-[var(--c-hairline)] md:hidden"
          aria-label="Bölüm modülleri"
        >
          {MOBILE_GROUPS[active].map((k) => {
            const m = DOCTORIUM_MODULES.find((x) => x.key === k)!;
            const on = k === active;
            return (
              <Link
                key={k}
                href={`/doktor/doctorium?m=${k}`}
                aria-current={on ? "page" : undefined}
                className={`-mb-px whitespace-nowrap border-b-2 pb-2 text-xs font-semibold transition ${
                  on ? "border-emerald-400 text-emerald-300" : "border-transparent text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
      )}

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
        <h1 className="aura-display mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
          {MODULE_HEAD[active].title}
          {/* v6.95 — öğrenci-sınırlı üyelik etiketi: mono rozet, yüzey boyamaz (kit renk disiplini) */}
          {studentOnly && (
            <span className="aura-mono rounded-full border border-[var(--c-hairline)] px-2 py-px text-[11px] font-semibold uppercase tracking-wider text-[var(--c-ink-3)]">
              Öğrenci Üyeliği
            </span>
          )}
        </h1>
        <p className="mt-1 text-[13px] text-[var(--c-ink-2)]">{MODULE_HEAD[active].desc}</p>
      </div>

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

      {/* İçtihat anahtar-kelime çipleri (v6.87, kullanıcı kararı): sözlük deterministik —
          tıklanan terim kararın METNİNDE aranır (lib/hukuk-keywords.ts). URL'de taşınır (?k=),
          paylaşılabilir. Aktif çip yeniden tıklanınca filtre kalkar (X). */}
      {active === "mevzuat" && legalTab === "ictihat" && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[var(--c-ink-3)]">Anahtar kelime:</span>
          {HUKUK_KEYWORDS.map((kw) => {
            const on = legalKeyword?.key === kw.key;
            return (
              <Link
                key={kw.key}
                href={on ? "/doktor/doctorium?m=mevzuat&h=ictihat" : `/doktor/doctorium?m=mevzuat&h=ictihat&k=${kw.key}`}
                aria-current={on ? "true" : undefined}
                className={`aura-mono inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  on
                    ? "bg-rose-500/20 text-rose-200 shadow-[inset_0_0_0_1px_#fb7185]"
                    : "bg-rose-500/[0.08] text-rose-300/90 hover:bg-rose-500/15"
                }`}
              >
                {kw.label}
                {on && <X size={11} />}
              </Link>
            );
          })}
        </div>
      )}

      {/* TEK "Özelleştir" penceresi (v6.52): aralık · kategori · kongre alarmı · branş tercihleri.
          Önceden ayrı satırlardaydı ve dağınık duruyordu (kullanıcı bildirimi).
          Bölüm yoksa bileşen hiç çizilmez (ör. Akademik) — boş panel açılmasın.
          İçtihat alt-sekmesinde aralık/kategori GİZLİ: arşiv tarih penceresiz listelenir,
          kategoriler (SUT vb.) mevzuat kalemlerine aittir. */}
      <DoctoriumFilters
        module={active}
        showFeedPrefs={active === "akis" && !!doctor}
        feedOptions={FEED_MODULE_OPTIONS.map((o) => ({ key: o.key, label: o.label }))}
        feedInitial={feedMods}
        showRange={(active === "mevzuat" && legalTab === "mevzuat") || active === "sektorel" || active === "ilac"}
        showCategory={(active === "mevzuat" && legalTab === "mevzuat") || active === "sektorel"}
        showAlerts={active === "kongre" && !!doctor}
        showScope={active === "kongre"}
        scope={scope}
        // v6.99.3 — sektörel "Kaynak" filtresi (panelin İLK bölümü; kullanıcı isteği 2026-08-16).
        showSourceScope={active === "sektorel"}
        sourceScope={active === "sektorel" ? parseScope(sp.s) : null}
        rangeKey={range}
        rangeOptions={RANGE_OPTIONS}
        category={cat}
        categoryOptions={SECTOR_CATEGORIES}
        /* Branş tercihi akışa FİİLEN etki eden sekmelerde: Akışım + Akademik + **Kongre** (v6.62
           düzeltmesi — kongre listesi upcomingCongresses(branches) ile v6.48'den beri branşa göre
           süzülüyordu ama seçici burada çizilmediği için doktor GÖREMEDİĞİ bir filtreyle eksik
           liste görüyordu; eski yorum "kongre branşa göre süzülmez" diyerek koddan sapmıştı).
           Mevzuat/sektörel/ilaç gerçekten branşa göre süzülmez. */
        branchOptions={
          (active === "akis" || active === "akademik" || active === "kongre") && doctor ? BRANCH_OPTIONS : null
        }
        branchInitial={parseBranchPrefs(doctor?.newsBranches)}
        ownBranchSlug={slugForLabel(doctor?.branch)}
        alertStart={doctor?.congressAlertDays ?? null}
        alertAbstract={doctor?.congressAbstractAlertDays ?? null}
        alertEarlyBird={doctor?.congressEarlyBirdAlertDays ?? null}
        showSponsor={active === "akis" && !!doctor}
        sponsorInitial={sponsorPersonalized}
        sponsorText={SPONSOR_CONSENT_TEXT}
      />

      {active === "ilac" && <ProspektusSearch />}

      {active === "kariyer" ? (
        <CareerList rows={pathways} savedIds={savedIds} />
      ) : active === "kongre" ? (
        <CongressList rows={congresses} followed={followed} canFollow={!!doctor} savedIds={savedIds} />
      ) : (
        <>
          {items.length === 0 ? (
            <EmptyState active={active} focus={focus} range={range} legalTab={legalTab} keywordLabel={legalKeyword?.label ?? null} />
          ) : (
            <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3">
              {/* grid-cols-[minmax(0,1fr)] (2026-08-16 taşma dersi): örtük "auto" kolon, en geniş
                  kartın min-content'ine BÜYÜR (grid item min-width:auto) — truncate'li nowrap
                  metinler mobilde tüm listeyi 441px'e itiyordu. minmax(0,1fr) kolonu konteynere
                  kilitler; kart içi max-w/truncate zinciri ancak o zaman çalışır. */}
              {/* Sponsorlu kart enjeksiyonu (v6.68): 1.si 2 organik karttan, 2.si 9 organikten
                  sonra; akış kısaysa listenin sonuna düşer (frekans tavanı MAX_FEED_CARDS=2). */}
              {/* Kart görünümü TÜM listelerde TEK (5. tur kullanıcı kararı): Akışım'daki kart,
                  bölüm sekmesindekiyle birebir aynı — bölüm kimliği şerit + çip + sembol taşır.
                  (Manşet varyantı 4. turda, kart üstü modül etiketi 5. turda kaldırıldı.) */}
              {items.map((it, i) => (
                <Fragment key={it.id}>
                  {i === 2 && sponsorCards[0] && <SponsorCardView c={sponsorCards[0]} />}
                  {i === 5 && surveyProps && <SurveyCardView {...surveyProps} />}
                  {i === 9 && sponsorCards[1] && <SponsorCardView c={sponsorCards[1]} />}
                  <ArticleCard item={it} saved={savedIds ? savedIds.has(it.id) : null} />
                </Fragment>
              ))}
              {items.length <= 2 && sponsorCards[0] && <SponsorCardView c={sponsorCards[0]} />}
              {items.length <= 5 && surveyProps && <SurveyCardView {...surveyProps} />}
              {items.length <= 9 && sponsorCards[1] && <SponsorCardView c={sponsorCards[1]} />}
            </ul>
          )}
        </>
      )}
    </div>
    </DoctoriumShell>
  );
}

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

interface CongressRow {
  id: string; title: string; organizer: string | null; city: string | null; country: string;
  startDate: Date; endDate: Date | null; abstractDeadline: Date | null; earlyBirdDeadline: Date | null;
  url: string | null; branchSlugs: string;
  scope: string; venue: string | null; warning: string | null; confidence: string;
}

function CongressList({ rows, followed, canFollow, savedIds }: { rows: CongressRow[]; followed: Set<string>; canFollow: boolean; savedIds: Set<string> | null }) {
  if (!rows.length) {
    return (
      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Seçtiğiniz branş ve kapsamda yaklaşan kongre yok. Kapsam filtresini
          <strong className="text-[var(--c-ink)]"> Tümü</strong> yapmayı ya da Özelleştir'den branş
          tercihlerinizi genişletmeyi deneyin.
        </span>
      </p>
    );
  }
  return (
    /* grid-cols-[minmax(0,1fr)]: ana listedeki taşma dersinin eşleniği (grid item min-width:auto). */
    <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3">
      {rows.map((c) => (
        /* Kart standardı (2026-08-14): sol kenarda 3px bölüm şeridi (Kongre = tema-duyarlı ink),
           üst satırda sembol+etiket · sağda Kaydet+Takip, altta ÇİZGİLİ aksiyon satırı. */
        <li
          key={c.id}
          className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5"
          style={{ borderInlineStart: "3px solid var(--c-ink)" }}
        >
          {/* Künye: "KONGRE" etiket tekrarı KALKTI (3. tur — sahne başlığı zaten söylüyor);
              rozetler + sağda Kaydet/Takip tek satır, altı çizgiyle kapanır. */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-[var(--c-ink-3)]">
              <span className="aura-mono rounded-full bg-sky-500/15 px-2 py-0.5 font-semibold text-sky-300">
                {formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : ""}
              </span>
              {/* Kapsam rozeti: doktorun ilk baktığı ayrım (yurt içi mi, yurt dışı mı). */}
              <span className="aura-mono rounded-full border border-[var(--c-hairline)] px-2 py-0.5">
                {c.scope === "uluslararasi" ? "🌍 Uluslararası" : "🇹🇷 Ulusal"}
              </span>
              {(c.city || c.country) && (
                <span className="inline-flex items-center gap-1"><MapPin size={11} />{[c.city, c.country].filter(Boolean).join(", ")}</span>
              )}
            </div>
            <span className="flex shrink-0 items-center gap-1">
              {savedIds != null && <SaveButton articleId={c.id} initialSaved={savedIds.has(c.id)} />}
              {canFollow && <FollowButton congressId={c.id} following={followed.has(c.id)} />}
            </span>
          </div>
          {/* Künye alt sınırı — ArticleCard üst çizgisinin eşleniği (kullanıcı ayarı 2026-08-16). */}
          <div className="mt-2 border-b border-[var(--c-hairline)]" aria-hidden="true" />
          <h3 className="mt-2.5 text-sm font-semibold text-[var(--c-ink)]">
            <Link href={`/doktor/doctorium/kongre/${c.id}`} className="hover:underline">{c.title}</Link>
          </h3>
          {c.organizer && <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">{c.organizer}</p>}

          {(c.abstractDeadline || c.earlyBirdDeadline) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--c-ink-2)]">
              {c.abstractDeadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={11} /> Bildiri son: <strong>{formatDate(c.abstractDeadline)}</strong>
                </span>
              )}
              {c.earlyBirdDeadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={11} /> Erken kayıt: <strong>{formatDate(c.earlyBirdDeadline)}</strong>
                </span>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--c-hairline)] pt-2.5">
            <Link href={`/doktor/doctorium/kongre/${c.id}`}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--c-accent-stronger)] hover:underline">
              Kongre kartı →
            </Link>
            {c.url && (
              <a href={c.url} target="_blank" rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-[11px] text-[var(--c-ink-2)] hover:underline">
                <ExternalLink size={12} /> Resmî site
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

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
      <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
        {rows.map((p) => (
          <li
            key={p.id}
            className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-4 transition hover:border-emerald-400/40"
            style={{ borderInlineStart: "3px solid #60a5fa" }}
          >
            {/* Künye: "KARİYER" etiket tekrarı KALKTI (3. tur — sahne başlığı zaten söylüyor);
                rozetler + sağda Kaydet tek satır, altı çizgiyle kapanır. */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                  {COUNTRY_LABEL[p.country] ?? p.country}
                </span>
                {p.confidence === "kismi" && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                    ⚠️ Teyit bekliyor
                  </span>
                )}
                <span className="text-[11px] text-[var(--c-ink-3)]">
                  Son doğrulama: {careerDate(p.verifiedAt)}
                </span>
              </div>
              {savedIds != null && <SaveButton articleId={p.slug} initialSaved={savedIds.has(p.slug)} />}
            </div>

            {/* Künye alt sınırı — ArticleCard üst çizgisinin eşleniği (kullanıcı ayarı 2026-08-16). */}
            <div className="mt-2 border-b border-[var(--c-hairline)]" aria-hidden="true" />
            <h3 className="mt-2.5 text-sm font-semibold text-[var(--c-ink)]">
              <Link href={`/doktor/doctorium/kariyer/${p.slug}`} className="hover:underline">
                {p.title}
              </Link>
            </h3>
            <p className="mt-0.5 text-[11px] text-[var(--c-ink-3)]">{p.authority}</p>
            <p className="mt-2 text-xs leading-relaxed text-[var(--c-ink-2)]">{p.summary}</p>

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

            {/* Kart standardı: ÇİZGİLİ aksiyon satırı (2026-08-14). */}
            <div className="mt-3 border-t border-[var(--c-hairline)] pt-2.5">
              <Link
                href={`/doktor/doctorium/kariyer/${p.slug}`}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 hover:underline"
              >
                Adımları ve belge listesini gör <ArrowLeft size={12} className="rotate-180" />
              </Link>
            </div>
          </li>
        ))}
      </ul>
      <CareerDisclaimer />
    </>
  );
}
