// Landing demo FIXTURE'ları — DB'ye ulaşılamadığında ya da seçim boş döndüğünde YEDEK (2026-08-23).
//
// İlke (DOCV2-003): fixture gerçek `FeedItem` şemasından türetilir (type-only import; compile-time
// sözleşme) ama GERÇEK BİR KAYNAĞI TAKLİT ETMEZ — sourceName "Örnek içerik", url/doi null (sahte
// DOI/bağlantı üretilmez), id "ornek-*" öneki. Ziyaretçi bunu "örnek" olarak görür; canlı veri
// geldiğinde yerini gerçek kartlar alır (lib/doctorium-landing/landing-feed.ts).
// Kişisel veri YOK (yazar adı yok).
import type { ClinicalSummary, FeedItem } from "@/lib/doctorium";

const d = (iso: string) => new Date(iso);

/** Akademik bölüm yedeği — özet metni açıkça "örnek" (gerçek yayın özetini taklit etmez). */
export const FIXTURE_SUMMARY: ClinicalSummary = {
  takeaways: [
    "Örnek çıkarım 1 — gerçek akışta yayının ana bulgusu burada yer alır.",
    "Örnek çıkarım 2 — ikinci temel sonuç.",
    "Örnek çıkarım 3 — klinik pratiğe olası yansıma.",
  ],
  design: "Örnek: çalışma tasarımı (randomizasyon, örneklem, izlem süresi) burada özetlenir.",
  limits: "Örnek: kısıtlılıklar (örneklem, yanlılık riski, genellenebilirlik) burada özetlenir.",
};

/** Hukuk bölümü yedeği — içtihat örnekleri (esas/karar numarası YOK: sahte künye üretilmez). */
export const FIXTURE_LEGAL: readonly FeedItem[] = [
  {
    id: "ornek-ictihat-1", module: "mevzuat", kind: "ictihat", source: "ornek",
    title: "Örnek: Aydınlatılmış onam eksikliğine dayalı tazminat istemi",
    titleOriginal: null,
    summary: "Örnek kart — gerçek akışta Yargıtay kararının metninden alınan aydınlatılmış onam alıntısı burada görünür.",
    sourceName: "Örnek içerik", authors: null, url: null, doi: null,
    publishedAt: d("2025-03-12T00:00:00Z"), branchSlugs: [], category: "ictihat", hasAiSummary: false, imageUrl: null,
  },
  {
    id: "ornek-ictihat-2", module: "mevzuat", kind: "ictihat", source: "ornek",
    title: "Örnek: Aydınlatma yükümlülüğü ve komplikasyon ayrımı",
    titleOriginal: null,
    summary: "Örnek kart — gerçek akışta karar alıntısı ve daire bilgisi burada görünür.",
    sourceName: "Örnek içerik", authors: null, url: null, doi: null,
    publishedAt: d("2024-11-05T00:00:00Z"), branchSlugs: [], category: "ictihat", hasAiSummary: false, imageUrl: null,
  },
  {
    id: "ornek-doktrin-1", module: "mevzuat", kind: "doktrin", source: "ornek",
    title: "Örnek: Tıbbi müdahalede aydınlatılmış onamın sınırları",
    titleOriginal: null,
    summary: "Örnek kart — gerçek akışta TR-Dizin makalesinin dizin özeti ve bağlantısı burada görünür.",
    sourceName: "Örnek içerik", authors: null, url: null, doi: null,
    publishedAt: d("2024-06-01T00:00:00Z"), branchSlugs: [], category: "doktrin", hasAiSummary: false, imageUrl: null,
  },
];

export const FIXTURE_FEED: readonly FeedItem[] = [
  {
    id: "ornek-akademik-1",
    module: "akademik",
    kind: "makale",
    source: "ornek",
    title: "Örnek: Kalp yetersizliğinde yeni tedavi yaklaşımının randomize kontrollü değerlendirmesi",
    titleOriginal: null,
    summary: "Örnek kart — canlı veri yüklenemediğinde gösterilir. Gerçek akışta bu alanda kaynağın özeti bulunur.",
    sourceName: "Örnek içerik",
    authors: null,
    url: null,
    doi: null,
    publishedAt: d("2026-08-20T00:00:00Z"),
    branchSlugs: ["kardiyoloji"],
    category: null,
    hasAiSummary: true,
    imageUrl: null,
  },
  {
    id: "ornek-ilac-1",
    module: "ilac",
    kind: "uyari",
    source: "ornek",
    title: "Örnek: Bir ilaç serisi için geri çekme duyurusu",
    titleOriginal: null,
    summary: "Örnek kart — gerçek akışta openFDA geri çekme duyurusu ve sınıfı burada görünür.",
    sourceName: "Örnek içerik",
    authors: null,
    url: null,
    doi: null,
    publishedAt: d("2026-08-19T00:00:00Z"),
    branchSlugs: [],
    category: null,
    hasAiSummary: false,
    imageUrl: null,
  },
  {
    id: "ornek-mevzuat-1",
    module: "mevzuat",
    kind: "mevzuat",
    source: "ornek",
    title: "Örnek: Sağlık hizmetleri uygulamasında yönetmelik değişikliği",
    titleOriginal: null,
    summary: "Örnek kart — gerçek akışta Resmî Gazete kaydı ve doktor özeti burada görünür.",
    sourceName: "Örnek içerik",
    authors: null,
    url: null,
    doi: null,
    publishedAt: d("2026-08-18T00:00:00Z"),
    branchSlugs: [],
    category: "mevzuat",
    hasAiSummary: false,
    imageUrl: null,
  },
  {
    id: "ornek-etkinlik-1",
    module: "etkinlik",
    kind: "etkinlik",
    source: "ornek",
    title: "Örnek: Ulusal kongre — bildiri son günü yaklaşıyor",
    titleOriginal: null,
    summary: "Örnek kart — gerçek akışta etkinlik tarihi, bildiri ve erken kayıt son günleri burada görünür.",
    sourceName: "Örnek içerik",
    authors: null,
    url: null,
    doi: null,
    publishedAt: d("2026-08-17T00:00:00Z"),
    branchSlugs: ["kardiyoloji"],
    category: null,
    hasAiSummary: false,
    imageUrl: null,
  },
];
