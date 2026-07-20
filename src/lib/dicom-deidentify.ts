// DICOM PHI tag-strip (v6.32 — DICOM PS3.15 "Basic Application Level Confidentiality Profile" alt kümesi).
// Partner konsültasyon havuzuna DICOM aktarımı ÖNCESİ sunucuda koşulur: kimlik/kurum/hekim/tarih
// etiketleri boşaltılır, açıklama alanları scrubText'ten geçer, UID'ler yeniden üretilir, private
// tag'ler silinir. Piksel verisine DOKUNULMAZ — görüntünün İÇİNE işlenmiş (burned-in) yazılar bu
// katmanda TEMİZLENMEZ; yükleyen partner formda bunu ayrıca beyan eder (kullanıcı onaylı politika,
// 2026-07-20). Bozuk/okunamayan dosya = throw → çağıran REDDEDER (fail-closed: sıyrılamayan saklanmaz).
//
// KALAN klinik-değerli etiketler (bilinçli): PatientSex · PatientAge · Modality · BodyPartExamined ·
// üretici/model · piksel + teknik parametreler (pencere/spacing/transfer syntax). Sıkıştırılmış piksel
// verisi (JPEG2000/JPEG-LS vb.) opak korunur — transfer syntax değişmez, mevcut DicomViewer açar.
import dcmjs from "dcmjs";
import { scrubText } from "./deidentify";

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
  // Hekim / operatör adları
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
export function deidentifyDicom(input: ArrayBuffer, uidMap: Map<string, string> = new Map()): DicomDeidResult {
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

  return { bytes: new Uint8Array(data.write()), summary };
}
