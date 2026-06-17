// İkinci Görüş — branşa özel gerekli belge şablonu (KOD-KONFİGÜRASYONU kararı).
// Boundary spec §6.5: 4 kanonik belge tipi; ortak temel set tüm branşlarda geçerli,
// branşa özgü farklar override eder. Admin-yönetilen DB tablosu yerine kod-config
// seçildi (todo §belge şablonu); §9.3'teki "koşullu kural" ihtiyacı netleşince
// gerekirse DB'ye taşınır. Tipler SecondOpinionDocument.type ile birebir eşleşir.

export type SoDocType = "EPICRISIS" | "IMAGING" | "PATHOLOGY" | "MEDICATION_LIST";
export type SoDocRequirement = "REQUIRED" | "OPTIONAL" | "CONDITIONAL";
export type SoDeliveryMethod = "FILE_UPLOAD" | "EXTERNAL_LINK";

export interface SoDocSpec {
  type: SoDocType;
  requirement: SoDocRequirement;
  defaultDelivery: SoDeliveryMethod;
  label: string; // hasta-yüzü etiket (TR kanonik; i18n ile çevrilir)
  note?: string;
}

// Ortak temel set (§5/§6.5): epikriz + ilaç listesi zorunlu, görüntüleme zorunlu (genelde
// link/bulut → EXTERNAL_LINK), patoloji koşullu (varsa). Her branş bunu miras alır.
const BASE: Record<SoDocType, SoDocSpec> = {
  EPICRISIS: {
    type: "EPICRISIS",
    requirement: "REQUIRED",
    defaultDelivery: "FILE_UPLOAD",
    label: "Epikriz raporları",
    note: "Mevcut durumu özetleyen doktor notları.",
  },
  IMAGING: {
    type: "IMAGING",
    requirement: "REQUIRED",
    defaultDelivery: "EXTERNAL_LINK",
    label: "Görüntüleme (MR / BT / PET-BT — DICOM)",
    note: "DICOM dosyaları büyüktür; link / bulut referansı olarak iletilir (portal içi görüntüleyici yok).",
  },
  PATHOLOGY: {
    type: "PATHOLOGY",
    requirement: "CONDITIONAL",
    defaultDelivery: "FILE_UPLOAD",
    label: "Patoloji / biyopsi sonuçları",
    note: "Varsa.",
  },
  MEDICATION_LIST: {
    type: "MEDICATION_LIST",
    requirement: "REQUIRED",
    defaultDelivery: "FILE_UPLOAD",
    label: "Güncel ilaç listesi",
    note: "Kullanılan tüm ilaçlar.",
  },
};

// Branşa özgü farklar — yalnız BASE'den SAPAN tipler. Anahtarlar lib/triage BRANCHES.key ile aynı.
const OVERRIDES: Record<string, Partial<Record<SoDocType, SoDocRequirement>>> = {
  // Onkolojik / hematolojik branşlarda patoloji zorunlu
  onkoloji: { PATHOLOGY: "REQUIRED" },
  "radyasyon-onkolojisi": { PATHOLOGY: "REQUIRED" },
  hematoloji: { PATHOLOGY: "REQUIRED" },
  // Görüntülemenin merkezi olmadığı branşlarda IMAGING opsiyonel
  psikiyatri: { IMAGING: "OPTIONAL" },
  dermatoloji: { IMAGING: "OPTIONAL" },
  dis: { IMAGING: "OPTIONAL" },
  "cocuk-sagligi": { IMAGING: "OPTIONAL" },
  ivf: { IMAGING: "OPTIONAL" },
  endokrinoloji: { IMAGING: "OPTIONAL" },
};

// Belge sunum sırası (UI) — epikriz, görüntüleme, patoloji, ilaç listesi.
const DOC_ORDER: SoDocType[] = ["EPICRISIS", "IMAGING", "PATHOLOGY", "MEDICATION_LIST"];

/** Branş için çözümlenmiş belge şablonu (override'lar uygulanmış). Tanımsız branş → temel set. */
export function secondOpinionDocSpecs(branchKey: string): SoDocSpec[] {
  const ov = OVERRIDES[branchKey] ?? {};
  return DOC_ORDER.map((t) => {
    const req = ov[t];
    return req ? { ...BASE[t], requirement: req } : BASE[t];
  });
}

export const SO_DOC_TYPE_LABELS: Record<SoDocType, string> = {
  EPICRISIS: "Epikriz",
  IMAGING: "Görüntüleme",
  PATHOLOGY: "Patoloji",
  MEDICATION_LIST: "İlaç listesi",
};
