// ICD-10 tanı kodu → KSHFT işlem eşlemesi (2026-07-10, değişiklik paketi FAZ 2).
// Küratörlü statik eşleme: BRANCH_CODING'deki yaygın tanılara, procedures.json kataloğundan
// klinik olarak uygun işlem kodları elle eşlendi (tüm kodlar kataloğa karşı DOĞRULANIR —
// aşağıdaki filtre geçersiz kodu sessizce eler; test data/coding.test.ts).
// Kapsam felsefesi: eşleme ÖNERİdir, kısıt değildir — doktor "Tüm branş listesi"ne ve
// "Tüm katalog" aramasına her zaman dönebilir (RecommendedTreatments). Eşlemesi olmayan
// tanılarda (veya işlem havuzu olmayan branşlarda: dahiliye, romatoloji, enfeksiyon vb.)
// davranış bugünkü gibidir: branş havuzu + katalog araması.
// Çapraz-branş kodlar bilinçlidir (ör. lomber disk → nöroşirürji kodları ortopedi tanısında;
// kemoterapi infüzyonu → hematoloji kodları onkoloji tanısında): getByCodes katalog-genelidir.
import { isValidCode } from "@/lib/procedures";
import { branchKeyFromLabel } from "@/lib/procedures";

// branş anahtarı → { ICD-10 kodu → KSHFT işlem kodları }
const RAW: Record<string, Record<string, string[]>> = {
  kardiyoloji: {
    "I20.9": ["SP700810", "SP700820", "S700530", "S700620", "SP700910", "SP700921"],
    "I21.9": ["SP700810", "SP700880", "SP700910", "SP700850", "SP701000"],
    "I10": ["S700470", "S700540", "S700600"],
    "I48.9": ["S700430", "S700540", "SP701010", "SP701062", "SP701064", "SP700992"],
    "I50.9": ["S700600", "SP700740", "SP700680", "SP700730"],
    "I25.1": ["SP700810", "SP700830", "SP700910", "S700620"],
    "I35.0": ["S700600", "S700610", "SP700940", "SP700944"],
  },
  onkoloji: {
    "C34.9": ["S704692", "SP608700", "SP608950", "S800440", "S800410"],
    "C50.9": ["S704692", "SP603670", "SP603752", "S800440"],
    "C18.9": ["S704692", "SP610150", "SP610151", "S800440"],
    "C61": ["S704692", "SP621410", "S800440", "S800050"],
    "C16.9": ["S704692", "SP609790", "SP609801", "S800440"],
    "C22.0": ["S704692", "SP609110", "SP609111"],
    "C78.0": ["S704692", "S800440", "SP608950"],
  },
  "radyasyon-onkolojisi": {
    "C50.9": ["S800160", "S800440", "S800410"],
    "C61": ["S800440", "S800050", "S800520"],
    "C34.9": ["S800440", "S800410"],
    "C71.9": ["SP800615", "S800440"],
    "C53.9": ["S800440", "S800520", "S800050"],
    "C32.9": ["S800440", "S800410"],
  },
  ortopedi: {
    "M17.9": ["SP612420", "SP612421", "SP612440", "SP612730"],
    "M16.9": ["SP612340", "SP612341", "SP612480"],
    "M51.1": ["SP615880", "SP615910", "SP616010"],
    "M75.1": ["SP612910", "SP612900", "SP613260"],
    "M23.2": ["SP612650", "SP612760", "SP613180", "SP612730"],
    "M54.5": ["S702360", "SP614160", "S550370"],
    "S82.20": ["SP610990", "SP611000", "SP611020"],
  },
  norosirurji: {
    "M51.1": ["SP615880", "SP615890", "SP615900", "SP615910", "SP615922"],
    "M50.1": ["SP615940", "SP615950", "SP615951"],
    "G91.9": ["SP615160", "SP615161"],
    "I60.9": ["SP615380", "SP615360"],
    "D32.9": ["SP615586"],
  },
  noroloji: {
    "G40.9": ["S703020", "S703090", "S703100", "SP615680"],
    "G43.9": ["S703460", "S703470"],
    "I63.9": ["S702340"],
    "G20": ["SP614860", "SP614870", "S703310", "S703140"],
    "G35": ["S703440", "S703390", "S703420"],
    "G62.9": ["S703200", "S703290"],
    "G45.9": ["S803680"],
  },
  "sac-ekimi": {
    "L64.9": ["S101260"],
    "L65.9": ["S101260"],
    "L63.9": ["S101260"],
    "L66.9": ["S101260"],
  },
  estetik: {
    "Z41.1": ["S101740", "S101710", "S101610", "SP601630"],
    "E65": ["S101740", "S101750", "S101760", "S101770", "S101710"],
  },
  ivf: {
    "N97.9": ["SP621045", "S704644", "S704643", "S704641", "S704560"],
    "N97.0": ["SP621045", "S704644", "S704560"],
    "N46": ["S704640", "S704631", "S704632", "S704644"],
    "E28.2": ["SP620990", "SP621045", "S704644"],
    "N80.9": ["SP621000", "SP620520", "SP620521"],
  },
  dis: {
    "K02.9": ["S402090", "S402100", "S402110", "S402010"],
    "K04.7": ["S402150", "S402152", "S402153", "S402251"],
    "K08.1": ["S404400", "S404410", "S404420", "S404010", "S404030"],
    "K05.3": ["S406020", "S406021", "S406030", "S406031"],
    "K01.1": ["S405030", "S405040", "S405050"],
  },
  goz: {
    "H25.9": ["SP617340", "SP617341", "SP617342"],
    "H40.9": ["SP617610", "SP617560", "SP617400", "SP617540"],
    "H52.4": ["SP617341", "SP617260"],
    "H33.0": ["SP617650", "SP617680", "SP617690", "SP617660"],
    "H35.3": ["S617720"],
    "H52.1": ["SP617260", "SP617261", "SP617250"],
  },
  "genel-cerrahi": {
    "K35.80": ["SP610130", "SP610131"],
    "K80.2": ["SP609230", "SP609235"],
    "K40.9": ["SP603780", "SP603781", "SP603790"],
    "K21.9": ["SP609780", "SP609781", "SP609782"],
    "K57.3": ["SP610150", "SP610151", "SP610160"],
    "E04.9": ["SP618480", "SP618490", "SP618460"],
  },
  gastroenteroloji: {
    "K21.9": ["S701540", "S701250", "S701550"],
    "K25.9": ["S701540", "S701550", "SP701270"],
    "K58.9": ["S701450"],
    "K50.9": ["S701450", "S701281", "S701550"],
    "K51.9": ["S701450", "S701400"],
    "K74.6": ["S701570", "S701572"],
  },
  nefroloji: {
    "N18.9": ["SP704230", "SP704232", "S704260", "SP618610"],
    "N17.9": ["SP704210", "SP704231"],
    "N20.0": ["SP618640", "SP618641", "SP618910"],
    "I12.9": ["SP704230"],
  },
  "gogus-hastaliklari": {
    "J44.9": ["S701220", "S701230", "S701076", "S702430"],
    "J45.9": ["S701220", "S701230", "S701210", "S701075"],
    "J18.9": ["S701221", "S701080"],
    "A15.0": ["S701200", "S701221", "S701080"],
    "J84.9": ["S701161", "S701080", "S701222"],
    "J90": ["S701190", "S701170", "S608880"],
  },
  hematoloji: {
    "D50.9": ["S704730", "S704720"],
    "D64.9": ["S704730", "S704740"],
    "C91.0": ["S704730", "S704740", "S704692", "S704890"],
    "C92.0": ["S704730", "S704740", "S704692", "S705010"],
    "C90.0": ["S704730", "S704692", "S704890", "S705010"],
    "D69.6": ["S704730", "S705350"],
  },
  dermatoloji: {
    "L40.9": ["S700190", "S700170", "S700180"],
    "L20.9": ["S700190"],
    "C43.9": ["SP600040", "SP600050", "SP600060"],
    "L80": ["S700190", "S700180"],
  },
  psikiyatri: {
    "F32.9": ["S702700", "S702790", "S702712", "S702710"],
    "F41.9": ["S702700", "S702790"],
    "F20.9": ["S702790", "S702710", "S702750"],
    "F31.9": ["S702790", "S702710", "S702700"],
    "F43.1": ["S702700", "S702790"],
    "F41.0": ["S702700", "S702790"],
  },
  "fizik-tedavi": {
    "M54.5": ["SP915032", "SP915031", "S702230", "S702380"],
    "M54.2": ["SP915031", "S702320", "S702170"],
    "M25.5": ["SP915031", "S702170"],
    "I69.3": ["S702340", "S702300", "S702510"],
    "M62.9": ["S702400", "S702310"],
  },
  uroloji: {
    "N40": ["SP621390", "SP621391", "SP621400"],
    "N20.0": ["SP618640", "SP618641", "SP618642"],
    "N20.1": ["SP618910", "SP619130"],
    "N39.0": ["SP619530"],
    "C67.9": ["SP619390", "SP619400", "SP619415", "SP619520"],
    "N52.9": ["S704360", "SP621180", "SP621190"],
  },
  kbb: {
    "J32.9": ["SP602330", "SP602320"],
    "J35.0": ["SP603080", "SP603090"],
    "H66.9": ["SP618411", "SP618410", "SP602390"],
    "J34.2": ["SP601620", "SP602290", "SP601630"],
    "H81.1": ["S703530"],
  },
  "kadin-dogum": {
    "N80.9": ["SP620520", "SP620521"],
    "D25.9": ["SP621020", "SP620530", "SP620740"],
    "N97.9": ["SP621045", "SP620990"],
    "N92.0": ["SP620050"],
    "N83.2": ["SP620600", "SP620601"],
    "C53.9": ["SP620950", "SP620260"],
  },
  kvc: {
    "I25.1": ["SP604940", "SP604930", "SP604950", "SP605010"],
    "I70.2": ["SP606750", "SP606780"],
    "I83.9": ["S607720"],
    "I35.0": ["SP604791", "SP700944"],
    "I34.0": ["SP604791", "SP700943"],
  },
  "gogus-cerrahisi": {
    "C34.9": ["SP608700", "SP608920", "SP608730", "SP608960"],
    "J93.9": ["S608880", "SP608650"],
    "J90": ["S608880", "SP608650"],
    "C38.4": ["SP608950", "SP608740"],
  },
  "organ-nakli": {
    "N18.6": ["SP618610", "SP618670"],
  },
};

// Geçersiz (katalogda olmayan) kodları modül yüklenirken ele — eşleme her zaman güvenli.
const ICD_PROCEDURES: Record<string, Record<string, string[]>> = {};
for (const [branch, m] of Object.entries(RAW)) {
  const cleaned: Record<string, string[]> = {};
  for (const [icd, codes] of Object.entries(m)) {
    const valid = codes.filter((c) => isValidCode(c));
    if (valid.length) cleaned[icd] = valid;
  }
  if (Object.keys(cleaned).length) ICD_PROCEDURES[branch] = cleaned;
}

export { ICD_PROCEDURES };

// Vaka branşı ETİKET olarak gelir (ör. "Kardiyoloji") → o branş+tanı için eşlenmiş işlem kodları.
// Boş dizi = eşleme yok → çağıran taraf branş havuzuna düşer.
export function proceduresForIcd(branchLabel: string | null | undefined, icd10: string | null | undefined): string[] {
  if (!icd10) return [];
  const key = branchKeyFromLabel(branchLabel);
  if (!key) return [];
  return ICD_PROCEDURES[key]?.[icd10.trim().toUpperCase()] ?? [];
}

// Bir branşta eşlemesi olan tüm ICD kodları (UI: tanı listesinde "önerili" rozeti için).
export function icdCodesWithProcedures(branchLabel: string | null | undefined): Set<string> {
  const key = branchKeyFromLabel(branchLabel);
  if (!key || !ICD_PROCEDURES[key]) return new Set();
  return new Set(Object.keys(ICD_PROCEDURES[key]));
}
