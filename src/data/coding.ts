// Branş-anahtarlı klinik kod sözlüğü — FHIR Faz 2 (KSHFT/EK-2 branş yapısıyla hizalı).
// ICD-10 → tanı (Condition.code) · LOINC → lab/gözlem (Observation.code; lab modülü gelince bağlanır).
// Gerçek kodlar kullanıldı (uydurma yok); branş başına YAYGIN tanılar — tüm 8047 işlemi kapsamaz.
// Küratör genişletebilir/düzeltebilir. Branş anahtarları procedures.json (branchLabels) ile birebir.
import { branchKeyFromLabel } from "@/lib/procedures";

export interface CodeEntry {
  code: string;
  label: string;
}
export interface BranchCoding {
  icd10: CodeEntry[];
  loinc?: CodeEntry[];
}

export const BRANCH_CODING: Record<string, BranchCoding> = {
  kardiyoloji: {
    icd10: [
      { code: "I20.9", label: "Angina pektoris" },
      { code: "I21.9", label: "Akut miyokart enfarktüsü" },
      { code: "I10", label: "Esansiyel (primer) hipertansiyon" },
      { code: "I48.9", label: "Atriyal fibrilasyon/flutter" },
      { code: "I50.9", label: "Kalp yetmezliği" },
      { code: "I25.1", label: "Aterosklerotik kalp hastalığı" },
      { code: "I35.0", label: "Aort kapak darlığı" },
    ],
    loinc: [
      { code: "6598-7", label: "Troponin T" },
      { code: "33762-6", label: "NT-proBNP" },
      { code: "2093-3", label: "Kolesterol (total)" },
      { code: "13457-7", label: "LDL kolesterol (hesaplanmış)" },
    ],
  },
  onkoloji: {
    icd10: [
      { code: "C34.9", label: "Bronş/akciğer malign neoplazmı" },
      { code: "C50.9", label: "Meme malign neoplazmı" },
      { code: "C18.9", label: "Kolon malign neoplazmı" },
      { code: "C61", label: "Prostat malign neoplazmı" },
      { code: "C16.9", label: "Mide malign neoplazmı" },
      { code: "C22.0", label: "Hepatoselüler karsinom" },
      { code: "C78.0", label: "Akciğer sekonder malign neoplazmı (metastaz)" },
    ],
    loinc: [
      { code: "2857-1", label: "PSA (prostat spesifik antijen)" },
      { code: "1988-5", label: "CRP" },
    ],
  },
  "radyasyon-onkolojisi": {
    icd10: [
      { code: "C50.9", label: "Meme malign neoplazmı" },
      { code: "C61", label: "Prostat malign neoplazmı" },
      { code: "C34.9", label: "Akciğer malign neoplazmı" },
      { code: "C71.9", label: "Beyin malign neoplazmı" },
      { code: "C53.9", label: "Serviks uteri malign neoplazmı" },
      { code: "C32.9", label: "Larinks malign neoplazmı" },
    ],
  },
  ortopedi: {
    icd10: [
      { code: "M17.9", label: "Gonartroz (diz osteoartriti)" },
      { code: "M16.9", label: "Koksartroz (kalça osteoartriti)" },
      { code: "M51.1", label: "Lomber disk hernisi (radikülopati ile)" },
      { code: "M75.1", label: "Rotator manşet sendromu" },
      { code: "M23.2", label: "Menisküs lezyonu (dejeneratif)" },
      { code: "M54.5", label: "Bel ağrısı (lumbago)" },
      { code: "S82.20", label: "Tibia cisim kırığı" },
    ],
  },
  norosirurji: {
    icd10: [
      { code: "M51.1", label: "Lomber disk hernisi (radikülopati ile)" },
      { code: "M50.1", label: "Servikal disk hernisi (radikülopati ile)" },
      { code: "G91.9", label: "Hidrosefali" },
      { code: "I60.9", label: "Subaraknoid kanama" },
      { code: "D32.9", label: "Meninks benign neoplazmı (menengiom)" },
      { code: "S06.9", label: "Kafa içi yaralanma" },
    ],
  },
  noroloji: {
    icd10: [
      { code: "G40.9", label: "Epilepsi" },
      { code: "G43.9", label: "Migren" },
      { code: "I63.9", label: "Serebral enfarkt (iskemik inme)" },
      { code: "G20", label: "Parkinson hastalığı" },
      { code: "G35", label: "Multipl skleroz" },
      { code: "G62.9", label: "Polinöropati" },
      { code: "G45.9", label: "Geçici iskemik atak (TIA)" },
    ],
  },
  "sac-ekimi": {
    icd10: [
      { code: "L64.9", label: "Androgenetik alopesi" },
      { code: "L65.9", label: "Telojen efluvyum / saç dökülmesi" },
      { code: "L63.9", label: "Alopesi areata" },
      { code: "L66.9", label: "Sikatrisyel alopesi" },
    ],
  },
  estetik: {
    icd10: [
      { code: "Z41.1", label: "Kozmetik/estetik amaçlı cerrahi başvurusu" },
      { code: "L90.5", label: "Skar (nedbe) ve fibrozis" },
      { code: "Q67.4", label: "Yüz/iskelet konjenital deformitesi" },
      { code: "E65", label: "Lokalize adipozite" },
    ],
  },
  ivf: {
    icd10: [
      { code: "N97.9", label: "Kadın infertilitesi" },
      { code: "N97.0", label: "Anovülasyona bağlı kadın infertilitesi" },
      { code: "N46", label: "Erkek infertilitesi" },
      { code: "E28.2", label: "Polikistik over sendromu" },
      { code: "N80.9", label: "Endometriozis" },
    ],
  },
  dis: {
    icd10: [
      { code: "K02.9", label: "Diş çürüğü" },
      { code: "K04.7", label: "Periapikal abse" },
      { code: "K08.1", label: "Diş kaybı (travma/çekim)" },
      { code: "K05.3", label: "Kronik periodontitis" },
      { code: "K01.1", label: "Gömülü diş" },
    ],
  },
  goz: {
    icd10: [
      { code: "H25.9", label: "Senil katarakt" },
      { code: "H40.9", label: "Glokom" },
      { code: "H52.4", label: "Presbiyopi" },
      { code: "H33.0", label: "Retina dekolmanı (yırtık ile)" },
      { code: "H35.3", label: "Yaşa bağlı maküla dejenerasyonu" },
      { code: "H52.1", label: "Miyopi" },
    ],
  },
  "genel-cerrahi": {
    icd10: [
      { code: "K35.80", label: "Akut apandisit" },
      { code: "K80.2", label: "Safra kesesi taşı (kolelitiazis)" },
      { code: "K40.9", label: "İnguinal herni" },
      { code: "K21.9", label: "Gastroözofageal reflü hastalığı" },
      { code: "K57.3", label: "Kolon divertiküler hastalığı" },
      { code: "E04.9", label: "Nontoksik guatr" },
    ],
  },
  dahiliye: {
    icd10: [
      { code: "I10", label: "Esansiyel hipertansiyon" },
      { code: "E11.9", label: "Tip 2 diabetes mellitus" },
      { code: "E78.5", label: "Hiperlipidemi" },
      { code: "E03.9", label: "Hipotiroidi" },
      { code: "D64.9", label: "Anemi" },
      { code: "K21.9", label: "Gastroözofageal reflü hastalığı" },
    ],
    loinc: [
      { code: "4548-4", label: "HbA1c" },
      { code: "2345-7", label: "Glukoz (serum)" },
      { code: "2160-0", label: "Kreatinin (serum)" },
      { code: "718-7", label: "Hemoglobin" },
    ],
  },
  gastroenteroloji: {
    icd10: [
      { code: "K21.9", label: "Gastroözofageal reflü hastalığı" },
      { code: "K25.9", label: "Mide ülseri" },
      { code: "K58.9", label: "İrritabl bağırsak sendromu" },
      { code: "K50.9", label: "Crohn hastalığı" },
      { code: "K51.9", label: "Ülseratif kolit" },
      { code: "K74.6", label: "Karaciğer sirozu" },
      { code: "B18.2", label: "Kronik viral hepatit C" },
    ],
    loinc: [
      { code: "1742-6", label: "ALT" },
      { code: "1920-8", label: "AST" },
      { code: "1975-2", label: "Bilirubin (total)" },
    ],
  },
  endokrinoloji: {
    icd10: [
      { code: "E11.9", label: "Tip 2 diabetes mellitus" },
      { code: "E10.9", label: "Tip 1 diabetes mellitus" },
      { code: "E05.9", label: "Hipertiroidi" },
      { code: "E03.9", label: "Hipotiroidi" },
      { code: "E66.9", label: "Obezite" },
      { code: "E28.2", label: "Polikistik over sendromu" },
    ],
    loinc: [
      { code: "4548-4", label: "HbA1c" },
      { code: "3016-3", label: "TSH" },
      { code: "2345-7", label: "Glukoz (serum)" },
    ],
  },
  nefroloji: {
    icd10: [
      { code: "N18.9", label: "Kronik böbrek hastalığı" },
      { code: "N17.9", label: "Akut böbrek hasarı" },
      { code: "N04.9", label: "Nefrotik sendrom" },
      { code: "N20.0", label: "Böbrek taşı" },
      { code: "I12.9", label: "Hipertansif böbrek hastalığı" },
    ],
    loinc: [
      { code: "2160-0", label: "Kreatinin (serum)" },
      { code: "48642-3", label: "eGFR" },
      { code: "2823-3", label: "Potasyum" },
    ],
  },
  "gogus-hastaliklari": {
    icd10: [
      { code: "J44.9", label: "KOAH" },
      { code: "J45.9", label: "Astım" },
      { code: "J18.9", label: "Pnömoni" },
      { code: "A15.0", label: "Akciğer tüberkülozu" },
      { code: "J84.9", label: "İnterstisyel akciğer hastalığı" },
      { code: "J90", label: "Plevral efüzyon" },
    ],
  },
  hematoloji: {
    icd10: [
      { code: "D50.9", label: "Demir eksikliği anemisi" },
      { code: "D64.9", label: "Anemi" },
      { code: "C91.0", label: "Akut lenfoblastik lösemi" },
      { code: "C92.0", label: "Akut miyeloid lösemi" },
      { code: "C90.0", label: "Multipl miyelom" },
      { code: "D69.6", label: "Trombositopeni" },
    ],
    loinc: [
      { code: "718-7", label: "Hemoglobin" },
      { code: "777-3", label: "Trombosit sayısı" },
      { code: "6690-2", label: "Lökosit sayısı" },
    ],
  },
  romatoloji: {
    icd10: [
      { code: "M06.9", label: "Romatoid artrit" },
      { code: "M32.9", label: "Sistemik lupus eritematozus" },
      { code: "M45", label: "Ankilozan spondilit" },
      { code: "M10.9", label: "Gut" },
      { code: "M35.0", label: "Sjögren sendromu" },
    ],
    loinc: [
      { code: "1988-5", label: "CRP" },
      { code: "4537-7", label: "Sedimentasyon (ESR)" },
      { code: "11572-5", label: "Romatoid faktör (RF)" },
    ],
  },
  enfeksiyon: {
    icd10: [
      { code: "A09", label: "Enfeksiyöz gastroenterit" },
      { code: "A41.9", label: "Sepsis" },
      { code: "B20", label: "HIV hastalığı" },
      { code: "B18.1", label: "Kronik viral hepatit B" },
      { code: "A15.9", label: "Solunum sistemi tüberkülozu" },
      { code: "U07.1", label: "COVID-19" },
    ],
    loinc: [
      { code: "1988-5", label: "CRP" },
      { code: "33959-8", label: "Prokalsitonin" },
    ],
  },
  dermatoloji: {
    icd10: [
      { code: "L40.9", label: "Psoriazis" },
      { code: "L20.9", label: "Atopik dermatit" },
      { code: "L70.0", label: "Akne vulgaris" },
      { code: "L50.9", label: "Ürtiker" },
      { code: "C43.9", label: "Malign melanom" },
      { code: "L80", label: "Vitiligo" },
    ],
  },
  psikiyatri: {
    icd10: [
      { code: "F32.9", label: "Depresif bozukluk" },
      { code: "F41.9", label: "Anksiyete bozukluğu" },
      { code: "F20.9", label: "Şizofreni" },
      { code: "F31.9", label: "Bipolar afektif bozukluk" },
      { code: "F43.1", label: "Travma sonrası stres bozukluğu" },
      { code: "F41.0", label: "Panik bozukluğu" },
    ],
  },
  "fizik-tedavi": {
    icd10: [
      { code: "M54.5", label: "Bel ağrısı (lumbago)" },
      { code: "M54.2", label: "Servikalji (boyun ağrısı)" },
      { code: "M25.5", label: "Eklem ağrısı" },
      { code: "I69.3", label: "Serebral enfarkt sekeli" },
      { code: "M62.9", label: "Kas bozukluğu" },
    ],
  },
  "cocuk-sagligi": {
    icd10: [
      { code: "J06.9", label: "Üst solunum yolu enfeksiyonu" },
      { code: "J45.9", label: "Astım" },
      { code: "A09", label: "Gastroenterit (çocuk)" },
      { code: "J21.9", label: "Akut bronşiyolit" },
      { code: "R50.9", label: "Ateş" },
      { code: "E66.9", label: "Obezite (çocuk)" },
    ],
  },
  uroloji: {
    icd10: [
      { code: "N40", label: "Benign prostat hiperplazisi" },
      { code: "N20.0", label: "Böbrek taşı" },
      { code: "N20.1", label: "Üreter taşı" },
      { code: "N39.0", label: "İdrar yolu enfeksiyonu" },
      { code: "C67.9", label: "Mesane malign neoplazmı" },
      { code: "N52.9", label: "Erektil disfonksiyon" },
    ],
    loinc: [{ code: "2857-1", label: "PSA (prostat spesifik antijen)" }],
  },
  kbb: {
    icd10: [
      { code: "J32.9", label: "Kronik sinüzit" },
      { code: "J35.0", label: "Kronik tonsillit" },
      { code: "H66.9", label: "Otitis media" },
      { code: "J34.2", label: "Nazal septum deviasyonu" },
      { code: "H81.1", label: "Benign paroksismal pozisyonel vertigo" },
      { code: "C32.9", label: "Larinks malign neoplazmı" },
    ],
  },
  "kadin-dogum": {
    icd10: [
      { code: "N80.9", label: "Endometriozis" },
      { code: "D25.9", label: "Uterin leiomyom (miyom)" },
      { code: "N97.9", label: "Kadın infertilitesi" },
      { code: "N92.0", label: "Menoraji (aşırı adet)" },
      { code: "N83.2", label: "Over kisti" },
      { code: "C53.9", label: "Serviks uteri malign neoplazmı" },
    ],
  },
  kvc: {
    icd10: [
      { code: "I25.1", label: "Aterosklerotik kalp hastalığı (bypass)" },
      { code: "I70.2", label: "Ekstremite aterosklerozu (periferik)" },
      { code: "I71.4", label: "Abdominal aort anevrizması" },
      { code: "I83.9", label: "Alt ekstremite varisi" },
      { code: "I35.0", label: "Aort kapak darlığı" },
      { code: "I34.0", label: "Mitral kapak yetmezliği" },
    ],
  },
  "gogus-cerrahisi": {
    icd10: [
      { code: "C34.9", label: "Akciğer malign neoplazmı" },
      { code: "J93.9", label: "Pnömotoraks" },
      { code: "J90", label: "Plevral efüzyon" },
      { code: "Q67.6", label: "Pektus ekskavatum" },
      { code: "C38.4", label: "Plevra malign neoplazmı" },
    ],
  },
  "organ-nakli": {
    icd10: [
      { code: "N18.6", label: "Son dönem böbrek yetmezliği" },
      { code: "K72.9", label: "Karaciğer yetmezliği" },
      { code: "I50.9", label: "Kalp yetmezliği (nakil adayı)" },
      { code: "Z94.0", label: "Böbrek nakli durumu" },
      { code: "Z94.1", label: "Kalp nakli durumu" },
      { code: "Z94.4", label: "Karaciğer nakli durumu" },
    ],
  },
  others: { icd10: [] },
};

// Vaka branşı ETİKET olarak saklanır (ör. "Kardiyoloji") → branş anahtarına çevirip ICD-10 listesini ver.
export function icd10ForBranchLabel(label: string | null | undefined): CodeEntry[] {
  const key = branchKeyFromLabel(label);
  return key ? BRANCH_CODING[key]?.icd10 ?? [] : [];
}

export function loincForBranchLabel(label: string | null | undefined): CodeEntry[] {
  const key = branchKeyFromLabel(label);
  return key ? BRANCH_CODING[key]?.loinc ?? [] : [];
}
