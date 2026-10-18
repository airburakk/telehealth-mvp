// Yönetim panosu sosyal medya bölümü — hesap kayıt defteri + yayın planı. SAF modül.
//
// 👤 2026-10-17: panoda "paylaşımlar kaç kişiye ulaşmış, kaç beğeni almış" görünecek. Platform jetonları n8n'de yaşar
// (Hetzner), uygulama hiçbir platform API'sine bağlanmaz: n8n günlük hesap toplamını POST /api/social-metrics ile İTER
// (v6.351, tablo SocialMetricDaily, özet lib/social-metrics). Bir platformdan satır gelmedikçe kart ölçüleri "—" ve
// aşağıdaki `readiness` aşamasını çizer — örnek/uydurma sayı GÖSTERMEZ (vitrin iddia disiplini iç yüzeyde de geçerli:
// yöneticinin karar verdiği ekranda sahte sayı en tehlikelisidir). Platform başına plan:
// vault output/doctorium-pano-sosyal-veri-kaynaklari-2026-10-17.md.
//
// Yayın planı = 13.10.2026 👤 kararlarından sonraki DURUM (LinkedIn videosu + Facebook hikâyeleri KAPALI; Facebook Reel
// kalır). Plan değişince burası da güncellenir — tek kaynak n8n akışlarıdır, bu liste onların ekrandaki özeti.
// "Gönderildi" durumu burada üretilmez: kanıtı sabah yayın kontrolü (vault output/yayin-kontrol) verir.

export type SocialPlatformKey = "instagram" | "facebook" | "linkedin" | "x" | "youtube";

/** Panoda gösterilecek ölçü — sıra kart sırasıdır. `kpi` = 13.10 kararındaki asıl başarı ölçüsü. */
export interface SocialMetricSpec {
  key: "followers" | "reach" | "likes" | "comments" | "saves" | "profileClicks";
  label: string;
  kpi?: boolean;
}

export interface SocialPlatform {
  key: SocialPlatformKey;
  name: string;
  handle: string | null;
  url: string | null;
  mark: string;
  /** Bugünkü planlı paylaşımlar (TSİ). */
  schedule: { time: string; what: string }[];
  /** Ölçülerin geleceği kaynak — kısa etiket. */
  source: string;
  /** Bu platformda okunabilen ölçüler (API kısıtına göre). */
  metrics: SocialMetricSpec["key"][];
  /** Bağlantı durumu: "n8n" = n8n zaten okuyor (aktarım eksik) · "token" = jeton n8n'de, okuma akışı yok · "izin" = ek API izni gerekir. */
  readiness: "n8n" | "token" | "izin";
  readinessNote: string;
}

export const SOCIAL_METRIC_LABEL: Record<SocialMetricSpec["key"], string> = {
  followers: "Takipçi",
  reach: "Erişim",
  likes: "Beğeni",
  comments: "Yorum",
  saves: "Kaydetme",
  profileClicks: "Profil tıklaması",
};

export const KPI_METRICS: ReadonlySet<SocialMetricSpec["key"]> = new Set(["saves", "profileClicks", "comments"]);

export const SOCIAL_PLATFORMS: readonly SocialPlatform[] = [
  {
    key: "instagram", name: "Instagram", handle: "@doctoriumtr", url: "https://www.instagram.com/doctoriumtr/", mark: "IG",
    schedule: [{ time: "07:50", what: "Kart" }, { time: "07:55", what: "Hikâye + Reel" }],
    source: "Instagram Graph API", metrics: ["followers", "reach", "likes", "comments", "saves", "profileClicks"],
    readiness: "token", readinessNote: "Sayfa jetonu n8n'de; içgörü izni (instagram_manage_insights) doğrulanmalı",
  },
  {
    key: "facebook", name: "Facebook", handle: "/doctoriumtr", url: "https://www.facebook.com/doctoriumtr", mark: "f",
    schedule: [{ time: "07:45", what: "Kart" }, { time: "08:25", what: "Reel" }],
    source: "Graph API · Sayfa içgörüleri", metrics: ["followers", "reach", "likes", "comments"],
    readiness: "token", readinessNote: "Sayfa jetonu n8n'de; 'impressions' ölçüleri Meta'da 'views' ile değişti",
  },
  {
    key: "linkedin", name: "LinkedIn", handle: "/company/doctoriumtr", url: "https://www.linkedin.com/company/doctoriumtr", mark: "in",
    schedule: [{ time: "07:45", what: "Kart" }],
    source: "LinkedIn Community Management API", metrics: ["followers", "reach", "likes", "comments"],
    readiness: "izin", readinessNote: "Paylaşım Buffer üzerinden; istatistik için LinkedIn ürün onayı gerekir",
  },
  {
    key: "x", name: "X", handle: "@Doctoriumtr", url: "https://x.com/Doctoriumtr", mark: "X",
    schedule: [{ time: "07:45", what: "Kart" }, { time: "20:30", what: "Video" }],
    source: "X API (kullanım başına)", metrics: ["followers", "reach", "likes", "comments", "saves", "profileClicks"],
    readiness: "n8n", readinessNote: "Haftalık metrik nöbetçisi zaten okuyor (Pzt 09:10); panoya aktarım yok",
  },
  {
    key: "youtube", name: "YouTube", handle: null, url: null, mark: "▶",
    schedule: [{ time: "20:30", what: "Short" }],
    source: "YouTube Data + Analytics API", metrics: ["followers", "reach", "likes", "comments"],
    readiness: "token", readinessNote: "Yükleme yetkisi n8n'de; okuma kapsamı (yt-analytics.readonly) eklenmeli",
  },
];

export const READINESS_LABEL: Record<SocialPlatform["readiness"], string> = {
  n8n: "Veri toplanıyor",
  token: "Jeton hazır",
  izin: "İzin gerekli",
};
