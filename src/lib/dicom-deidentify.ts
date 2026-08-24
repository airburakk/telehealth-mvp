// DICOM PHI tag-strip (v6.32 — DICOM PS3.15 "Basic Application Level Confidentiality Profile" alt kümesi).
// Partner konsültasyon havuzuna DICOM aktarımı ÖNCESİ sunucuda koşulur: kimlik/kurum/doktorlar/tarih
// etiketleri boşaltılır, açıklama alanları scrubText'ten geçer, UID'ler yeniden üretilir, private
// tag'ler silinir. Bozuk/okunamayan dosya = throw → çağıran REDDEDER (fail-closed: sıyrılamayan saklanmaz).
//
// 🆕 v6.37 — PİKSEL KATMANI: görüntünün İÇİNE işlenmiş (burned-in) yazılar artık maskelenebilir
// (deidentifyDicomFull). Bu dosyadaki tag-strip hâlâ piksele DOKUNMAZ; piksel işi lib/dicom-pixels +
// lib/dicom-burnin katmanındadır ve tag-strip'ten ÖNCE koşar. Maskeleme "otomatik garanti" değildir:
// standarda dayalı kurallar + yükleyenin çizdiği kutular uygulanır, beyan kutusu KALIR.
//
// KALAN klinik-değerli etiketler (bilinçli): PatientSex · PatientAge · Modality · BodyPartExamined ·
// üretici/model · piksel + teknik parametreler (pencere/spacing/transfer syntax). Maskeleme YOKSA
// sıkıştırılmış piksel verisi (JPEG2000/JPEG-LS vb.) opak korunur — transfer syntax değişmez.
// Maskeleme VARSA dosya sıkıştırmasız yeniden yazılır (bkz. dicom-pixels.writeUncompressed).
import dcmjs from "dcmjs";
import { scrubText } from "./deidentify";
import { analyzeBurnIn, normalizeRects, type BurnInAnalysis } from "./dicom-burnin";
import { decodePixels, maskFrames, writeUncompressed, DicomPixelError, type Rect } from "./dicom-pixels";

const { DicomMessage, DicomMetaDictionary } = dcmjs.data;

// Mevcutsa İÇERİĞİ BOŞALTILIR (vr korunur, zero-length — PS3.15 Type-2 uyumu; yoksa dokunulmaz).
const EMPTY_TAGS: readonly string[] = [
  // Hasta kimliği (PatientName ayrı — "ANONIM" yazılır)
  "00100020", // PatientID
  "00100030", // PatientBirthDate
  "00100032", // PatientBirthTime
  "00101000", // OtherPatientIDs
  "00101001", // OtherPatientNames
  "00101040", // PatientAddress
  "00102154", // PatientTelephoneNumbers
  "00101090", // MedicalRecordLocator
  "00102160", // EthnicGroup (hassas — klinik gereklilik havuz özeti için yok)
  "00102180", // Occupation
  "00101081", // BranchOfService
  "00102150", // CountryOfResidence (talep metnindeki kaba bölge yeter)
  "00102152", // RegionOfResidence
  // Doktor / operatör adları
  "00080090", // ReferringPhysicianName
  "00080092", // ReferringPhysicianAddress
  "00080094", // ReferringPhysicianTelephoneNumbers
  "00081048", // PhysiciansOfRecord
  "00081050", // PerformingPhysicianName
  "00081060", // NameOfPhysiciansReadingStudy
  "00081070", // OperatorsName
  // Kurum / cihaz kimliği
  "00080080", // InstitutionName
  "00080081", // InstitutionAddress
  "00081010", // StationName
  "00081040", // InstitutionalDepartmentName
  "00181000", // DeviceSerialNumber
  // Çalışma kimliği / tarih-saat (klinik bağlam talep metninde — kullanıcı onaylı temkinli seçim)
  "00080050", // AccessionNumber
  "00200010", // StudyID
  "00080020", // StudyDate
  "00080021", // SeriesDate
  "00080022", // AcquisitionDate
  "00080023", // ContentDate
  "00080030", // StudyTime
  "00080031", // SeriesTime
  "00080032", // AcquisitionTime
  "00080033", // ContentTime
];

// Mevcutsa TAMAMEN SİLİNİR (serbest-metin yorumlar — Type 3).
const DELETE_TAGS: readonly string[] = [
  "00104000", // PatientComments
  "00204000", // ImageComments
  "00324000", // StudyComments (retired ama sahada görülür)
];

// Mevcutsa scrubText'ten GEÇER (protokol adı kalır, gömülü kimlik maskelenir).
const SCRUB_TAGS: readonly string[] = [
  "00081030", // StudyDescription
  "0008103E", // SeriesDescription
];

// Yeni UID üretilir (kurum/altyapı izi taşımasın). Aynı eski UID → aynı yeni UID (dosya içi tutarlılık;
// aynı çağrıda işlenen çoklu dosyalarda seri bütünlüğü için map dışarıdan da verilebilir).
const UID_TAGS: readonly string[] = [
  "0020000D", // StudyInstanceUID
  "0020000E", // SeriesInstanceUID
  "00080018", // SOPInstanceUID
  "00200052", // FrameOfReferenceUID
];

export interface DicomDeidSummary {
  emptied: number; // boşaltılan mevcut etiket sayısı
  deleted: number; // silinen yorum etiketi sayısı
  scrubbed: number; // maskelenen açıklama alanı sayısı
  privateRemoved: number; // silinen private tag sayısı
  uidsRegenerated: number;
}

export interface DicomDeidResult {
  bytes: Uint8Array; // anonimleştirilmiş DICOM (Part-10, aynı transfer syntax)
  summary: DicomDeidSummary;
}

function setString(el: { vr: string; Value?: unknown[] }, v: string): void {
  // PN alanları dcmjs'te {Alphabetic} nesnesiyle de gelebilir — yazarken düz string yeterli.
  el.Value = el.vr === "PN" ? [{ Alphabetic: v }] : [v];
}

function firstString(el: { Value?: unknown[] } | undefined): string {
  const v = el?.Value?.[0];
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && "Alphabetic" in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).Alphabetic ?? "");
  }
  return String(v);
}

/**
 * Bir DICOM dosyasını PHI etiketlerinden arındırır. Bozuk/parse-edilemez dosyada THROW eder —
 * çağıran dosyayı REDDETMELİDİR (fail-closed; sıyrılamayan içerik asla saklanmaz).
 * uidMap: aynı taleple gelen çoklu dosyalar arasında Study/Series UID tutarlılığı için paylaşılabilir.
 */
export function deidentifyDicom(
  input: ArrayBuffer,
  uidMap: Map<string, string> = new Map(),
  /** (0012,0063) DeidentificationMethod'a eklenecek piksel katmanı notu — şeffaflık için. */
  pixelNote?: string,
): DicomDeidResult {
  const data = DicomMessage.readFile(input);
  const dict = data.dict;
  const summary: DicomDeidSummary = { emptied: 0, deleted: 0, scrubbed: 0, privateRemoved: 0, uidsRegenerated: 0 };

  // Hasta adı — boş değil, açık "ANONIM" (görüntüleyicide bilinçli anonimlik sinyali).
  if (dict["00100010"]) { setString(dict["00100010"], "ANONIM"); summary.emptied++; }

  for (const tag of EMPTY_TAGS) {
    const el = dict[tag];
    if (el) { el.Value = []; summary.emptied++; }
  }
  for (const tag of DELETE_TAGS) {
    if (dict[tag]) { delete dict[tag]; summary.deleted++; }
  }
  for (const tag of SCRUB_TAGS) {
    const el = dict[tag];
    if (el && el.Value?.length) {
      const cur = firstString(el);
      if (cur) { setString(el, scrubText(cur)); summary.scrubbed++; }
    }
  }

  // Private tag'ler: grup numarası TEK olan her şey gider (üretici alanları kimlik/kurum izi taşıyabilir).
  for (const tag of Object.keys(dict)) {
    const group = parseInt(tag.slice(0, 4), 16);
    if (Number.isFinite(group) && group % 2 === 1) { delete dict[tag]; summary.privateRemoved++; }
  }

  // UID yenileme — deterministik eşleme (aynı eski → aynı yeni).
  const freshUid = (old: string): string => {
    const hit = uidMap.get(old);
    if (hit) return hit;
    const nu = DicomMetaDictionary.uid();
    uidMap.set(old, nu);
    return nu;
  };
  for (const tag of UID_TAGS) {
    const el = dict[tag];
    const old = firstString(el);
    if (el && old) { el.Value = [freshUid(old)]; summary.uidsRegenerated++; }
  }
  // Meta başlığı dosya gövdesiyle senkron kalmalı: MediaStorageSOPInstanceUID = yeni SOPInstanceUID.
  const newSop = firstString(dict["00080018"]);
  if (data.meta["00020003"] && newSop) data.meta["00020003"].Value = [newSop];
  if (data.meta["00020016"]) data.meta["00020016"].Value = []; // SourceApplicationEntityTitle — kurum izi

  // Alıcı sisteme ne yapıldığının DICOM-standart beyanı (PS3.3 C.12.1). Etiket kimliği gerçekten
  // kaldırıldığı için PatientIdentityRemoved=YES; piksel katmanının durumu metinde AÇIKÇA yazılır
  // (maskeleme yapıldıysa kutu sayısı, yapılmadıysa "piksel maskesi uygulanmadı") — abartılı
  // "tam anonim" iddiası taşımaz.
  // ⚠️ Metin ASCII: SpecificCharacterSet (0008,0005) yazmadığımız için DICOM varsayılanı ASCII'dir;
  // Türkçe karakter alıcı sistemde bozulur. VR=LO sınırı 64 karakter → kısa tutulur.
  dict["00120062"] = { vr: "CS", Value: ["YES"] }; // PatientIdentityRemoved
  dict["00120063"] = {
    vr: "LO",
    Value: [`AURA deid: tags; ${pixelNote ?? "no pixel mask"}`.slice(0, 64)],
  }; // DeidentificationMethod

  return { bytes: new Uint8Array(data.write()), summary };
}

// ── v6.37: piksel + etiket katmanlarını birleştiren TAM de-identification ──

export interface DicomFullDeidOptions {
  /** Yükleyenin editörde çizdiği ek maskeler (normalize 0..1). Sunucu bunlara İLAVETEN kendi kurallarını uygular. */
  userRects?: unknown;
  /** Otomatik kuralları kapatır (yalnız testler için; üretim yollarında DAİMA açık). */
  disableAutoMask?: boolean;
}

export interface DicomFullDeidResult extends DicomDeidResult {
  /** Uygulanan maske sayısı (otomatik + kullanıcı). 0 = piksellere dokunulmadı. */
  masksApplied: number;
  /** Maskeleme nedeniyle dosya sıkıştırmasız yeniden yazıldı mı? */
  recompressed: boolean;
  analysis: BurnInAnalysis;
}

/**
 * Havuza gidecek DICOM kopyasını hazırlar: (1) burned-in piksel maskeleri (standart kurallar +
 * yükleyenin kutuları) → (2) PHI etiket temizliği. Her iki adım da FAIL-CLOSED: maskeleme istendiği
 * hâlde piksel çözülemiyorsa THROW eder — yarı-temiz dosya asla saklanmaz.
 *
 * ⚠️ Kutu yoksa piksel katmanı hiç çalışmaz; dosya sıkıştırılmış hâliyle (yalnız tag-strip'li) geçer.
 */
export async function deidentifyDicomFull(
  input: ArrayBuffer,
  uidMap: Map<string, string> = new Map(),
  opts: DicomFullDeidOptions = {},
): Promise<DicomFullDeidResult> {
  const analysis = analyzeBurnIn(input);
  const userRects = normalizeRects(opts.userRects);
  const rects: Rect[] = [...(opts.disableAutoMask ? [] : analysis.autoRects), ...userRects];

  let working = input;
  let recompressed = false;
  if (rects.length) {
    // Piksel çözme/yeniden yazma hatası = dosya REDDEDİLİR (maskelenemeyen görüntü havuza gitmez).
    const dec = await decodePixels(input);
    const touched = maskFrames(dec, rects);
    if (!touched) throw new DicomPixelError("Maske uygulanamadı (kutular görüntü dışında).");
    const bytes = writeUncompressed(input, dec);
    working = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    recompressed = true;
  }

  // ASCII (bkz. deidentifyDicom'daki karakter seti notu) — LO alanı 64 karakterle sınırlı.
  const note = rects.length
    ? `pixel masks ${rects.length} (auto ${analysis.autoRects.length}, manual ${userRects.length})`
    : "no pixel mask";
  const { bytes, summary } = deidentifyDicom(working, uidMap, note);
  return { bytes, summary, masksApplied: rects.length, recompressed, analysis };
}
