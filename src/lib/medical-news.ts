// M5 — Haberler penceresi içerik motoru (Faz 1 STUB; Faz 4'te branşa özel küratörlü/AI ile zenginleşir).
// Harici API yok — kod-config örnek kartlar. Genel tıp haberleri + hekimin branşına özel haber/makale/ilaç raporu.

export type NewsKind = "haber" | "makale" | "ilac";

export interface NewsItem {
  id: string;
  kind: NewsKind;
  title: string;
  source: string;
  summary: string;
  date: string; // ISO; demo göreli tarihler üretimde sabit tutulur
}

export const NEWS_KIND_LABEL: Record<NewsKind, string> = {
  haber: "Haber",
  makale: "Makale",
  ilac: "İlaç Geliştirme",
};

// Her hekime gösterilen genel tıp gündemi (branştan bağımsız).
const GENERAL: NewsItem[] = [
  { id: "gen-1", kind: "haber", title: "DSÖ dijital sağlık çerçevesini güncelledi", source: "WHO Bülten", summary: "Teletıp ve sınır-ötesi konsültasyon için yeni rehber ilkeler yayımlandı.", date: "2026-06-24" },
  { id: "gen-2", kind: "makale", title: "Yapay zekâ destekli triyajda doğruluk meta-analizi", source: "The Lancet Digital Health", summary: "Çok merkezli çalışma, AI ön-değerlendirmenin aciliyet sınıflamasında uzman uyumunu inceledi.", date: "2026-06-20" },
  { id: "gen-3", kind: "ilac", title: "Geniş spektrumlu antiviral faz-3 sonuçları", source: "NEJM", summary: "Yeni molekül için faz-3 verileri güvenlik profiliyle birlikte açıklandı.", date: "2026-06-18" },
];

// Branşa özel örnek kartlar (Faz 1 demo). Anahtar = Doctor.branch etiketi; eşleşme yoksa yalnız GENERAL döner.
const BY_BRANCH: Record<string, NewsItem[]> = {
  Kardiyoloji: [
    { id: "kar-1", kind: "makale", title: "Yeni nesil antikoagülanlarda kanama riski karşılaştırması", source: "JACC", summary: "Gerçek-dünya verisinde DOAC alt grupları arasında kanama olaylarının dağılımı.", date: "2026-06-23" },
    { id: "kar-2", kind: "ilac", title: "Kalp yetmezliğinde SGLT2 inhibitörü endikasyon genişlemesi", source: "ESC Haber", summary: "Düzenleyici kurum, korunmuş ejeksiyon fraksiyonu için onay sürecini ilerletti.", date: "2026-06-19" },
  ],
  Onkoloji: [
    { id: "onk-1", kind: "ilac", title: "Solid tümörlerde yeni hedefe yönelik ajan faz-2 verisi", source: "ASCO", summary: "Belirli mutasyon taşıyan hastalarda yanıt oranları umut verici bulundu.", date: "2026-06-22" },
    { id: "onk-2", kind: "makale", title: "Likit biyopsi ile erken nüks tespiti", source: "Nature Medicine", summary: "ctDNA temelli izlem, görüntülemeden önce nüksü öngörmede değerlendirildi.", date: "2026-06-17" },
  ],
  Ortopedi: [
    { id: "ort-1", kind: "makale", title: "Diz protezinde robotik asistans uzun dönem sonuçları", source: "JBJS", summary: "Robotik destekli artroplastide revizyon oranları geleneksel yöntemle kıyaslandı.", date: "2026-06-21" },
  ],
  Nöroloji: [
    { id: "nor-1", kind: "ilac", title: "Migren profilaksisinde anti-CGRP gerçek-dünya etkinliği", source: "Neurology", summary: "Aylık enjeksiyon tedavisinde atak sıklığında azalma raporlandı.", date: "2026-06-20" },
  ],
};

// Hekimin branşına göre haber akışı: genel gündem + (varsa) branşa özel kartlar.
export function newsForBranch(branch: string | null | undefined): NewsItem[] {
  const branchItems = branch && BY_BRANCH[branch] ? BY_BRANCH[branch] : [];
  return [...branchItems, ...GENERAL];
}
