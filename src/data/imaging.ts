// Görüntüleme (radyoloji) tetkik sözlüğü — küratörlü, LOINC kodlu.
// FHIR ServiceRequest.code → system "http://loinc.org" (radyoloji order kodları).
// ⚠️ DOĞRULANMIŞ KÜÇÜK ÖRNEK (POC): yaygın tetkikler; tam radyoloji kod indeksini kapsamaz.
// Kesin kodlama klinik kodlayıcı işidir (PROCEDURE_SNOMED cross-walk'taki aynı disiplin). Küratör düzeltebilir.

export interface ImagingEntry {
  code: string; // LOINC radyoloji order kodu
  label: string; // TR tetkik adı
  branchHints?: string[];
}

export const IMAGING_SYSTEM = "http://loinc.org";

export const IMAGING_STUDIES: ImagingEntry[] = [
  { code: "36643-5", label: "Akciğer grafisi (PA + lateral)", branchHints: ["Göğüs Hastalıkları", "Kardiyoloji", "Enfeksiyon Hastalıkları"] },
  { code: "24627-2", label: "Toraks BT", branchHints: ["Göğüs Hastalıkları", "Onkoloji", "Göğüs Cerrahisi"] },
  { code: "30799-1", label: "Abdomen BT", branchHints: ["Gastroenteroloji", "Genel Cerrahi", "Onkoloji"] },
  { code: "24725-4", label: "Beyin BT", branchHints: ["Nöroloji", "Nöroşirürji"] },
  { code: "24593-6", label: "Beyin MR", branchHints: ["Nöroloji", "Nöroşirürji"] },
  { code: "24747-8", label: "Lomber omurga MR", branchHints: ["Nöroşirürji", "Ortopedi", "Fiziksel Tıp ve Rehabilitasyon"] },
  { code: "30704-1", label: "Diz MR", branchHints: ["Ortopedi"] },
  { code: "24851-8", label: "Abdomen ultrasonografi", branchHints: ["Gastroenteroloji", "Dahiliye (İç Hastalıkları)", "Nefroloji"] },
  { code: "45036-0", label: "Tiroid ultrasonografi", branchHints: ["Endokrinoloji ve Metabolizma"] },
  { code: "26175-0", label: "Üriner sistem ultrasonografi", branchHints: ["Üroloji", "Nefroloji"] },
  { code: "42148-7", label: "Meme mamografi", branchHints: ["Onkoloji", "Kadın Hastalıkları ve Doğum"] },
  { code: "34552-0", label: "Ekokardiyografi", branchHints: ["Kardiyoloji"] },
];

export function imagingForBranch(branchLabel: string | null | undefined): ImagingEntry[] {
  if (!branchLabel) return IMAGING_STUDIES;
  const hinted = IMAGING_STUDIES.filter((m) => m.branchHints?.includes(branchLabel));
  const rest = IMAGING_STUDIES.filter((m) => !m.branchHints?.includes(branchLabel));
  return [...hinted, ...rest];
}

export function findImaging(code: string): ImagingEntry | undefined {
  return IMAGING_STUDIES.find((m) => m.code === code);
}
