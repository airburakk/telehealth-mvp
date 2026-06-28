// İlaç kodu sözlüğü — WHO ATC (Anatomical Therapeutic Chemical) kodlu, küratörlü yaygın ilaçlar.
// FHIR MedicationRequest.medicationCodeableConcept → system "http://www.whocc.no/atc".
// Gerçek ATC kodları kullanıldı (uydurma yok); yaygın etken maddeler — tam ATC indeksini kapsamaz.
// Küratör genişletebilir/düzeltebilir. branchHints = seçicide o branşta öne çıkar (zorlamadan).

export interface MedEntry {
  atc: string; // WHO ATC kodu (etken madde)
  name: string; // etken madde adı (TR)
  branchHints?: string[]; // bu etiketli branşlarda önerilir (BRANCHES.label)
}

export const ATC_SYSTEM = "http://www.whocc.no/atc";

export const MEDICATIONS: MedEntry[] = [
  // Ağrı / ateş / antiinflamatuar
  { atc: "N02BE01", name: "Parasetamol", branchHints: ["Dahiliye (İç Hastalıkları)", "Ortopedi"] },
  { atc: "M01AE01", name: "İbuprofen", branchHints: ["Ortopedi", "Romatoloji", "Fiziksel Tıp ve Rehabilitasyon"] },
  { atc: "M01AB05", name: "Diklofenak", branchHints: ["Ortopedi", "Romatoloji"] },
  { atc: "M01AH01", name: "Selekoksib", branchHints: ["Romatoloji", "Ortopedi"] },
  { atc: "N02AX02", name: "Tramadol", branchHints: ["Ortopedi", "Onkoloji"] },
  // Kardiyovasküler
  { atc: "B01AC06", name: "Asetilsalisilik asit (Aspirin)", branchHints: ["Kardiyoloji", "Nöroloji"] },
  { atc: "C09AA05", name: "Ramipril", branchHints: ["Kardiyoloji", "Nefroloji"] },
  { atc: "C09CA01", name: "Losartan", branchHints: ["Kardiyoloji", "Nefroloji"] },
  { atc: "C07AB07", name: "Bisoprolol", branchHints: ["Kardiyoloji"] },
  { atc: "C07AB02", name: "Metoprolol", branchHints: ["Kardiyoloji"] },
  { atc: "C08CA01", name: "Amlodipin", branchHints: ["Kardiyoloji"] },
  { atc: "C10AA05", name: "Atorvastatin", branchHints: ["Kardiyoloji", "Endokrinoloji ve Metabolizma"] },
  { atc: "C10AA07", name: "Rosuvastatin", branchHints: ["Kardiyoloji"] },
  { atc: "C03CA01", name: "Furosemid", branchHints: ["Kardiyoloji", "Nefroloji"] },
  { atc: "C03DA01", name: "Spironolakton", branchHints: ["Kardiyoloji", "Nefroloji"] },
  { atc: "B01AF01", name: "Rivaroksaban", branchHints: ["Kardiyoloji", "Hematoloji"] },
  { atc: "B01AA03", name: "Varfarin", branchHints: ["Kardiyoloji", "Hematoloji"] },
  { atc: "B01AB01", name: "Heparin", branchHints: ["Kardiyoloji", "Hematoloji"] },
  // Endokrin / metabolik
  { atc: "A10BA02", name: "Metformin", branchHints: ["Endokrinoloji ve Metabolizma", "Dahiliye (İç Hastalıkları)"] },
  { atc: "A10BJ02", name: "Liraglutid", branchHints: ["Endokrinoloji ve Metabolizma"] },
  { atc: "A10AB01", name: "İnsülin (insan)", branchHints: ["Endokrinoloji ve Metabolizma"] },
  { atc: "H03AA01", name: "Levotiroksin", branchHints: ["Endokrinoloji ve Metabolizma"] },
  { atc: "H02AB06", name: "Prednizolon", branchHints: ["Romatoloji", "Göğüs Hastalıkları", "Dermatoloji (Cilt Hastalıkları)"] },
  // Gastrointestinal
  { atc: "A02BC01", name: "Omeprazol", branchHints: ["Gastroenteroloji", "Dahiliye (İç Hastalıkları)"] },
  { atc: "A02BC02", name: "Pantoprazol", branchHints: ["Gastroenteroloji"] },
  { atc: "A03FA01", name: "Metoklopramid", branchHints: ["Gastroenteroloji"] },
  // Antibiyotik / antiviral / antifungal
  { atc: "J01CA04", name: "Amoksisilin", branchHints: ["Enfeksiyon Hastalıkları", "Kulak Burun Boğaz (KBB)"] },
  { atc: "J01CR02", name: "Amoksisilin/klavulanat", branchHints: ["Enfeksiyon Hastalıkları", "Kulak Burun Boğaz (KBB)"] },
  { atc: "J01DD04", name: "Seftriakson", branchHints: ["Enfeksiyon Hastalıkları"] },
  { atc: "J01MA02", name: "Siprofloksasin", branchHints: ["Enfeksiyon Hastalıkları", "Üroloji"] },
  { atc: "J01FA09", name: "Klaritromisin", branchHints: ["Göğüs Hastalıkları", "Enfeksiyon Hastalıkları"] },
  { atc: "J05AB11", name: "Valasiklovir", branchHints: ["Enfeksiyon Hastalıkları", "Dermatoloji (Cilt Hastalıkları)"] },
  // Solunum
  { atc: "R03AC02", name: "Salbutamol", branchHints: ["Göğüs Hastalıkları"] },
  { atc: "R03BB01", name: "İpratropium", branchHints: ["Göğüs Hastalıkları"] },
  { atc: "R03BA02", name: "Budesonid (inhaler)", branchHints: ["Göğüs Hastalıkları"] },
  // Nöro / psikiyatri
  { atc: "N03AX14", name: "Levetirasetam", branchHints: ["Nöroloji"] },
  { atc: "N06AB03", name: "Fluoksetin", branchHints: ["Psikiyatri"] },
  { atc: "N06AB10", name: "Essitalopram", branchHints: ["Psikiyatri"] },
  { atc: "N05BA01", name: "Diazepam", branchHints: ["Psikiyatri", "Nöroloji"] },
  { atc: "N02CC01", name: "Sumatriptan", branchHints: ["Nöroloji"] },
  // Üroloji
  { atc: "G04CA02", name: "Tamsulosin", branchHints: ["Üroloji"] },
  { atc: "G04BE03", name: "Sildenafil", branchHints: ["Üroloji"] },
  // Onkoloji destek
  { atc: "A04AA01", name: "Ondansetron", branchHints: ["Onkoloji", "Gastroenteroloji"] },
];

// Belirli bir branş için önerilen ilaçları öne al; geri kalanı arkaya ekle (selector için tam liste).
export function medicationsForBranch(branchLabel: string | null | undefined): MedEntry[] {
  if (!branchLabel) return MEDICATIONS;
  const hinted = MEDICATIONS.filter((m) => m.branchHints?.includes(branchLabel));
  const rest = MEDICATIONS.filter((m) => !m.branchHints?.includes(branchLabel));
  return [...hinted, ...rest];
}

export function findMedication(atc: string): MedEntry | undefined {
  return MEDICATIONS.find((m) => m.atc === atc);
}
