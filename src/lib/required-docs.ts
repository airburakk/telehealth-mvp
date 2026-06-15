// Branşa özel gerekli belgeler — triyajda kontrol listesi olarak gösterilir.
// `required: true` olanlar eksikse hasta uyarılır ve "görüşmeden önce ileteceğim" onayı
// alınmadan süreç ilerlemez ("zorunlu belge yoksa süreç durmalı"). Tanımsız branş → GENERIC.
// Belgeler şu an demo: hasta beyanı (checkbox). Gerçek tipli yükleme + storage üretimde.
export interface RequiredDoc {
  key: string;
  label: string;
  required: boolean;
}

const DOCS: Record<string, RequiredDoc[]> = {
  onkoloji: [
    { key: "patoloji", label: "Patoloji / biyopsi raporu", required: true },
    { key: "goruntuleme", label: "Görüntüleme (BT / MR / PET-BT)", required: true },
    { key: "kan", label: "Güncel kan tahlilleri", required: false },
  ],
  "radyasyon-onkolojisi": [
    { key: "patoloji", label: "Patoloji raporu", required: true },
    { key: "goruntuleme", label: "Görüntüleme (BT / MR / PET-BT)", required: true },
  ],
  "sac-ekimi": [
    { key: "foto", label: "Saçlı deri fotoğrafları (ön / tepe / arka)", required: true },
  ],
  estetik: [
    { key: "foto", label: "İlgili bölgenin fotoğrafları", required: true },
  ],
  ivf: [
    { key: "hormon", label: "Hormon testleri (AMH / FSH / LH)", required: true },
    { key: "sperm", label: "Spermiyogram (varsa)", required: false },
  ],
  ortopedi: [
    { key: "goruntuleme", label: "Röntgen / MR görüntüleri", required: true },
  ],
  norosirurji: [
    { key: "goruntuleme", label: "Beyin / omurga MR veya BT", required: true },
  ],
  kardiyoloji: [
    { key: "ekg", label: "EKG / Ekokardiyografi raporu", required: true },
    { key: "kan", label: "Kan tahlilleri", required: false },
  ],
  kvc: [
    { key: "anjio", label: "Anjiyografi / koroner görüntüleme", required: true },
    { key: "eko", label: "Ekokardiyografi raporu", required: true },
  ],
  "gogus-cerrahisi": [
    { key: "goruntuleme", label: "Toraks BT / akciğer görüntüleme", required: true },
  ],
  "organ-nakli": [
    { key: "uygunluk", label: "Kan grubu / doku uygunluk testleri", required: true },
    { key: "goruntuleme", label: "İlgili organ görüntüleme raporları", required: true },
    { key: "epikriz", label: "Mevcut tıbbi epikriz / hastalık öyküsü", required: true },
  ],
  "genel-cerrahi": [
    { key: "goruntuleme", label: "İlgili görüntüleme (USG / BT / MR)", required: true },
  ],
  dis: [
    { key: "panoramik", label: "Panoramik diş röntgeni", required: true },
  ],
  hematoloji: [
    { key: "kan", label: "Hemogram / kan tahlilleri", required: true },
  ],
  uroloji: [
    { key: "tahlil", label: "İdrar / kan tahlilleri (gerekirse PSA)", required: false },
    { key: "goruntuleme", label: "Üriner sistem görüntüleme (USG / BT)", required: false },
  ],
  "kadin-dogum": [
    { key: "usg", label: "Jinekolojik USG / ilgili raporlar", required: false },
  ],
  goz: [
    { key: "muayene", label: "Göz muayene / görme raporu", required: false },
  ],
};

const GENERIC: RequiredDoc[] = [
  { key: "rapor", label: "Mevcut tıbbi rapor ve tetkikler (varsa)", required: false },
];

export function requiredDocs(branchKey: string): RequiredDoc[] {
  return DOCS[branchKey] ?? GENERIC;
}
