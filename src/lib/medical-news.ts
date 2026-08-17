// Haber içerik sabitleri — İKİ tüketici (v6.48'de ayrıştı):
//
//   1) STUB kartlar (GENERAL / BY_BRANCH / newsForBranch) — PARTNER sayfasının haber şeridi.
//      ⚠️ Bu kartlar ÖRNEK içeriktir (uydurma) → gerçek makale bağlantısı ASLA verilmez.
//      Doktor tarafı bunları KULLANMAZ; Doctorium gerçek yayın çeker (lib/doctorium).
//
//   2) NEWS_QUERIES — branş → PubMed MeSH sorgusu. Doctorium ingestion'ı bunu okur
//      (lib/doctorium-ingest); PubMed istemcisi de oraya taşındı (tek yer, çift kopya yok).
//
// NEDEN PubMed: anahtar/kayıt gerektirmez, kaynak birincil (dergi + DOI), sağlık verisi GÖNDERMEZ
// (yalnız branş adına karşılık gelen MeSH sorgusu gider — hasta bilgisi çıkmaz).

export type NewsKind = "haber" | "makale" | "ilac";

export interface NewsItem {
  id: string;
  kind: NewsKind;
  title: string;
  source: string;
  summary: string;
  date: string; // ISO
}

export const NEWS_KIND_LABEL: Record<NewsKind, string> = {
  haber: "Haber",
  makale: "Makale",
  ilac: "İlaç Geliştirme",
};

// Her doktora gösterilen genel tıp gündemi (branştan bağımsız).
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

// Doktorun branşına göre haber akışı: genel gündem + (varsa) branşa özel kartlar.
// ⚠️ STUB (örnek içerik) — canlı yayın akışı için fetchBranchNews() kullan.
export function newsForBranch(branch: string | null | undefined): NewsItem[] {
  const branchItems = branch && BY_BRANCH[branch] ? BY_BRANCH[branch] : [];
  return [...branchItems, ...GENERAL];
}

// ─────────────────────────────────────────────────────────────────────────────
// Branş → PubMed MeSH sorgusu (Doctorium ingestion'ı kullanır: lib/doctorium-ingest).
// ─────────────────────────────────────────────────────────────────────────────

export const NEWS_QUERIES: Record<string, string> = {
  Onkoloji: "neoplasms[mh] AND (therapy[sh] OR diagnosis[sh])",
  "Radyasyon Onkolojisi": "radiotherapy[mh] AND neoplasms[mh]",
  Kardiyoloji: "cardiovascular diseases[mh] AND (therapy[sh] OR diagnosis[sh])",
  "Kalp ve Damar Cerrahisi": "cardiac surgical procedures[mh] OR vascular surgical procedures[mh]",
  Ortopedi: "orthopedic procedures[mh] OR musculoskeletal diseases[mh]",
  Nöroloji: "nervous system diseases[mh] AND (therapy[sh] OR diagnosis[sh])",
  Nöroşirürji: "neurosurgical procedures[mh]",
  "Dahiliye (İç Hastalıkları)": "internal medicine[mh]",
  "Dermatoloji (Cilt Hastalıkları)": "skin diseases[mh]",
  "Göz Cerrahisi": "eye diseases[mh] AND (surgery[sh] OR therapy[sh])",
  "Kulak Burun Boğaz (KBB)": "otorhinolaryngologic diseases[mh]",
  Üroloji: "urologic diseases[mh]",
  "Kadın Hastalıkları ve Doğum": "genital diseases, female[mh] OR pregnancy complications[mh]",
  "Tüp Bebek (IVF)": "fertilization in vitro[mh] OR infertility[mh]",
  "Çocuk Sağlığı ve Hastalıkları": "pediatrics[mh]",
  "Genel Cerrahi": "general surgery[mh]",
  "Göğüs Cerrahisi": "thoracic surgical procedures[mh]",
  "Estetik Cerrahi": "surgery, plastic[mh]",
  "Saç Ekimi": "hair diseases[mh] OR alopecia[mh]",
  "Endokrinoloji ve Metabolizma": "endocrine system diseases[mh] OR metabolic diseases[mh]",
  Gastroenteroloji: "gastrointestinal diseases[mh]",
  Nefroloji: "kidney diseases[mh]",
  "Göğüs Hastalıkları": "respiratory tract diseases[mh]",
  Romatoloji: "rheumatic diseases[mh]",
  Hematoloji: "hematologic diseases[mh]",
  "Enfeksiyon Hastalıkları": "communicable diseases[mh]",
  Psikiyatri: "mental disorders[mh]",
  "Fiziksel Tıp ve Rehabilitasyon": "physical therapy modalities[mh] OR rehabilitation[mh]",
  "Diş Tedavisi": "stomatognathic diseases[mh] OR dentistry[mh]",
  "Organ Nakli": "organ transplantation[mh]",
};
