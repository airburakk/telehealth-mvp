// FHIR R4 serileştirme — mevcut Prisma verisini standart FHIR kaynaklarına çevirir.
// ŞEMA DEĞİŞİKLİĞİ YOK: kimlikler mevcut cuid'den türetilir; kodlamasız klinik alanlar
// CodeableConcept.text olarak verilir (kodsuz text geçerli FHIR'dir). LOINC kodları
// (epikriz 18842-5, ateş 8310-5, ağrı 72514-3) Faz 2 terminoloji köprüsü için baştan konur.
// Bkz. vault: [[saglik-veri-standartlari-hl7-fhir]] §Fazlı Uygulama Planı (Faz 1).
import type { Case, Doctor, Consultation, Recovery, CheckIn, ShareLink, ShareAccess } from "@prisma/client";

// Kurumsal kimlik namespace'i (üretimde gerçek domain/OID ile değişir)
const ID_SYSTEM = "https://telehealth-mvp-roan.vercel.app/fhir/identifier";

export type CaseForFhir = Case & {
  doctor: Doctor | null;
  consultations: Consultation[];
  recovery: (Recovery & { checkIns: CheckIn[] }) | null;
};

// Case.dischargeStructured içindeki epikriz bölümleri (ai-clinical.ts Discharge ile aynı anahtarlar)
interface Discharge {
  tani: string;
  anamnez: string;
  tedaviSureci: string;
  klinikSeyir: string;
  cikisIlaclari: string;
  oneriler: string;
}
const SECTIONS: { key: keyof Discharge; title: string }[] = [
  { key: "tani", title: "TANI" },
  { key: "anamnez", title: "ÖYKÜ VE BAŞVURU" },
  { key: "tedaviSureci", title: "UYGULANAN TEDAVİ VE İŞLEMLER" },
  { key: "klinikSeyir", title: "KLİNİK SEYİR VE İYİLEŞME" },
  { key: "cikisIlaclari", title: "ÇIKIŞ İLAÇLARI" },
  { key: "oneriler", title: "ÖNERİLER VE KONTROL PLANI" },
];

type FhirResource = Record<string, unknown>;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// FHIR Narrative (xhtml) — bölüm metnini güvenli biçimde sarmalar
function narrative(text: string): { status: string; div: string } {
  const body = esc(text || "Belirtilmedi").replace(/\n/g, "<br/>");
  return { status: "generated", div: `<div xmlns="http://www.w3.org/1999/xhtml">${body}</div>` };
}

function containedPatient(c: CaseForFhir): FhirResource {
  return {
    resourceType: "Patient",
    id: "patient",
    identifier: [
      ...(c.patientIdentifier
        ? [{ type: { text: c.patientIdentifierType || "Kimlik No" }, system: `${ID_SYSTEM}/patient-identifier`, value: c.patientIdentifier }]
        : []),
      { system: `${ID_SYSTEM}/patient`, value: c.userId ?? c.id },
    ],
    name: [{ text: c.patientName }],
    address: c.country ? [{ country: c.country }] : undefined,
    communication: c.language ? [{ language: { text: c.language }, preferred: true }] : undefined,
  };
}

function containedPractitioner(d: Doctor | null, fallbackName: string): FhirResource {
  const name = d ? `${d.title} ${d.name}`.trim() : fallbackName;
  return {
    resourceType: "Practitioner",
    id: "practitioner",
    identifier: d
      ? [
          ...(d.licenseNo ? [{ type: { text: "Diploma/Tescil No" }, system: `${ID_SYSTEM}/practitioner-license`, value: d.licenseNo }] : []),
          { system: `${ID_SYSTEM}/practitioner`, value: d.id },
        ]
      : undefined,
    name: [{ text: name }],
    qualification: d?.branch ? [{ code: { text: d.branch } }] : undefined,
    communication: d?.languages
      ? d.languages.split(",").map((l) => ({ text: l.trim() })).filter((x) => x.text)
      : undefined,
  };
}

function containedEncounter(c: CaseForFhir): FhirResource {
  const consult = c.consultations[0];
  const status = consult ? (consult.endedAt ? "finished" : "in-progress") : "planned";
  const start = consult?.startedAt ?? c.createdAt;
  const end = consult?.endedAt ?? null;
  return {
    resourceType: "Encounter",
    id: "encounter",
    status,
    // R4: Encounter.class = tekil Coding · VR = uzaktan/sanal karşılaşma (telehealth)
    class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "VR", display: "virtual" },
    subject: { reference: "#patient" },
    participant: c.doctor ? [{ individual: { reference: "#practitioner" } }] : undefined,
    period: { start: new Date(start).toISOString(), ...(end ? { end: new Date(end).toISOString() } : {}) },
    reasonCode: c.symptoms ? [{ text: c.symptoms }] : undefined,
  };
}

// CheckIn → Observation (vücut sıcaklığı + ağrı skoru), LOINC kodlu
function checkInObservations(c: CaseForFhir): FhirResource[] {
  if (!c.recovery) return [];
  const vital = { coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] };
  const out: FhirResource[] = [];
  c.recovery.checkIns.forEach((ch, i) => {
    const when = new Date(ch.createdAt).toISOString();
    out.push({
      resourceType: "Observation",
      id: `obs-temp-${i + 1}`,
      status: "final",
      category: [vital],
      code: { coding: [{ system: "http://loinc.org", code: "8310-5", display: "Body temperature" }], text: "Vücut sıcaklığı" },
      subject: { reference: "#patient" },
      effectiveDateTime: when,
      valueQuantity: { value: ch.feverC, unit: "°C", system: "http://unitsofmeasure.org", code: "Cel" },
    });
    out.push({
      resourceType: "Observation",
      id: `obs-pain-${i + 1}`,
      status: "final",
      code: {
        coding: [{ system: "http://loinc.org", code: "72514-3", display: "Pain severity - 0-10 verbal numeric rating [Score] - Reported" }],
        text: "Ağrı şiddeti (0-10)",
      },
      subject: { reference: "#patient" },
      effectiveDateTime: when,
      valueQuantity: { value: ch.pain, unit: "{score}", system: "http://unitsofmeasure.org", code: "{score}" },
    });
  });
  return out;
}

// Case.labResults (JSON [{loinc,name,value,unit}]) → FHIR Observation[] (kategori: laboratory, LOINC kodlu)
function labObservations(c: CaseForFhir): FhirResource[] {
  let labs: { loinc?: string; name?: string; value?: string; unit?: string; aiSuggested?: boolean }[] = [];
  try {
    const p = c.labResults ? JSON.parse(c.labResults) : [];
    if (Array.isArray(p)) labs = p;
  } catch {
    labs = [];
  }
  // aiSuggested:true = doktorun henüz onaylamadığı (Kaydet'lemediği) AI önerisi → FHIR'a dahil edilmez.
  labs = labs.filter((l) => l && !l.aiSuggested && (l.loinc || l.name) && l.value != null && String(l.value).trim());
  const when = (c.dischargeAt ? new Date(c.dischargeAt) : new Date()).toISOString();
  const category = { coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "laboratory", display: "Laboratory" }] };
  return labs.map((l, i) => {
    const raw = String(l.value).trim();
    const num = Number(raw.replace(",", "."));
    const valuePart =
      raw !== "" && Number.isFinite(num)
        ? { valueQuantity: { value: num, ...(l.unit ? { unit: l.unit } : {}) } }
        : { valueString: raw };
    return {
      resourceType: "Observation",
      id: `obs-lab-${i + 1}`,
      status: "final",
      category: [category],
      code: {
        coding: l.loinc ? [{ system: "http://loinc.org", code: l.loinc, display: l.name || l.loinc }] : undefined,
        text: l.name || l.loinc || "Laboratuvar",
      },
      subject: { reference: "#patient" },
      effectiveDateTime: when,
      ...valuePart,
    };
  });
}

// Tanı → FHIR Condition (ICD-10 kodu varsa kodlu, yoksa epikriz "tanı" metni). FHIR Faz 0.
function containedCondition(c: CaseForFhir, taniText: string): FhirResource {
  return {
    resourceType: "Condition",
    id: "condition",
    clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
    verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "confirmed" }] },
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis", display: "Encounter Diagnosis" }] }],
    code: {
      coding: c.icd10Code ? [{ system: "http://hl7.org/fhir/sid/icd-10", code: c.icd10Code }] : undefined,
      text: taniText || "Belirtilmedi",
    },
    subject: { reference: "#patient" },
  };
}

// KSHFT/SUT (T.C. Sağlık Bakanlığı işlem kodu) — Türkiye'nin birincil işlem kod sistemi (MEDULA/SUT).
const KSHFT_SYSTEM = "http://saglik.gov.tr/CodeSystem/kshft"; // resmî URI tanımlanınca güncellenir
// KSHFT → SNOMED CT cross-walk — DOĞRULANMIŞ küçük örnek (POC). Tam eşleme (8047 işlem) lisanslı
// SNOMED referansı + klinik kodlayıcı işidir; eşleme yoksa KSHFT kodu birincil kalır (geçerli FHIR).
const PROCEDURE_SNOMED: Record<string, { code: string; display: string }> = {
  SP609230: { code: "38102005", display: "Cholecystectomy" },
  SP609235: { code: "45595009", display: "Laparoscopic cholecystectomy" },
  SP603080: { code: "173422009", display: "Tonsillectomy" },
  SP603090: { code: "232679003", display: "Tonsillectomy and adenoidectomy" },
  SP619929: { code: "11466000", display: "Cesarean section" },
  SP619930: { code: "11466000", display: "Cesarean section" },
  SP704210: { code: "302497006", display: "Hemodialysis" },
  SP704230: { code: "302497006", display: "Hemodialysis" },
  SPR102262: { code: "26294005", display: "Radical prostatectomy" },
  SP621390: { code: "90199006", display: "Transurethral prostatectomy" },
  SP621391: { code: "90199006", display: "Transurethral prostatectomy" },
  SPR102260: { code: "236886002", display: "Hysterectomy" },
  SP620419: { code: "265056007", display: "Vaginal hysterectomy" },
};

// İşlem kodu → CodeableConcept: KSHFT birincil (her zaman) + SNOMED (cross-walk varsa) + text.
function procedureCodeableConcept(code: string, name: string): FhirResource {
  const coding: FhirResource[] = [{ system: KSHFT_SYSTEM, code, display: name }];
  const sx = PROCEDURE_SNOMED[code];
  if (sx) coding.push({ system: "http://snomed.info/sct", code: sx.code, display: sx.display });
  return { coding, text: name };
}

// Epikriz (Case.dischargeStructured) → FHIR R4 Composition (taburcu özeti, LOINC 18842-5).
// Patient/Practitioner/Encounter/Condition/Observation/ServiceRequest kaynakları `contained` olarak
// gömülür → tek, kendi kendine yeterli ve doğrulanabilir bir kaynak döner.
export function caseToComposition(c: CaseForFhir, authorFallbackName: string): FhirResource {
  let d: Discharge;
  try {
    d = JSON.parse(c.dischargeStructured ?? "{}");
  } catch {
    d = {} as Discharge;
  }

  const obs = checkInObservations(c);
  const labs = labObservations(c);
  const cond = containedCondition(c, String(d.tani ?? ""));
  const enc = containedEncounter(c);
  // Encounter tanısı → Condition (taburcu tanısı, DD)
  enc.diagnosis = [{
    condition: { reference: "#condition" },
    use: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/diagnosis-role", code: "DD", display: "Discharge diagnosis" }] },
  }];

  // Önerilen işlemler (recommendedProcedures) → ServiceRequest[] (KSHFT birincil + SNOMED cross-walk)
  let recs: { code: string; name?: string }[] = [];
  try {
    const p = c.recommendedProcedures ? JSON.parse(c.recommendedProcedures) : [];
    if (Array.isArray(p)) recs = p;
  } catch {
    recs = [];
  }
  recs = recs.filter((r) => r && typeof r.code === "string" && r.code);
  const serviceRequests: FhirResource[] = recs.map((r, i) => ({
    resourceType: "ServiceRequest",
    id: `servicerequest-${i + 1}`,
    status: "active",
    intent: "plan",
    code: procedureCodeableConcept(r.code, r.name || r.code),
    subject: { reference: "#patient" },
    encounter: { reference: "#encounter" },
    ...(c.doctor ? { requester: { reference: "#practitioner" } } : {}),
  }));

  const contained: FhirResource[] = [
    containedPatient(c),
    containedPractitioner(c.doctor, authorFallbackName),
    enc,
    cond,
    ...obs,
    ...labs,
    ...serviceRequests,
  ];

  const section: FhirResource[] = SECTIONS.map((s) => {
    const sec: FhirResource = {
      title: s.title,
      text: narrative(String(d[s.key] ?? "Belirtilmedi")),
    };
    // Tanı bölümünü kodlu Condition'a, klinik seyri post-op Observation'lara bağla
    if (s.key === "tani") sec.entry = [{ reference: "#condition" }];
    if (s.key === "klinikSeyir" && obs.length) {
      sec.entry = obs.map((o) => ({ reference: `#${(o as { id: string }).id}` }));
    }
    return sec;
  });

  // Önerilen işlemler bölümü (kodlu ServiceRequest'lere bağlı)
  if (serviceRequests.length) {
    section.push({
      title: "ÖNERİLEN İŞLEMLER (KSHFT/SNOMED kodlu)",
      text: narrative(recs.map((r) => `${r.code} — ${r.name || ""}`.trim()).join("\n")),
      entry: serviceRequests.map((r) => ({ reference: `#${(r as { id: string }).id}` })),
    });
  }

  // Laboratuvar sonuçları bölümü (LOINC kodlu Observation'lara bağlı)
  if (labs.length) {
    const labLines = labs.map((o) => {
      const oo = o as Record<string, unknown>;
      const name = (oo.code as { text?: string } | undefined)?.text ?? "Lab";
      const vq = oo.valueQuantity as { value?: number; unit?: string } | undefined;
      const val = vq ? `${vq.value}${vq.unit ? " " + vq.unit : ""}` : (oo.valueString as string | undefined) ?? "";
      return `${name}: ${val}`;
    });
    section.push({
      title: "LABORATUVAR SONUÇLARI (LOINC kodlu)",
      text: narrative(labLines.join("\n")),
      entry: labs.map((o) => ({ reference: `#${(o as { id: string }).id}` })),
    });
  }

  const when = (c.dischargeAt ? new Date(c.dischargeAt) : new Date()).toISOString();
  return {
    resourceType: "Composition",
    id: `discharge-${c.id}`,
    meta: { lastUpdated: when },
    identifier: { system: `${ID_SYSTEM}/composition`, value: `discharge-${c.id}` },
    status: "final",
    type: {
      coding: [{ system: "http://loinc.org", code: "18842-5", display: "Discharge summary" }],
      text: "Epikriz / Taburcu Raporu",
    },
    subject: { reference: "#patient" },
    encounter: { reference: "#encounter" },
    date: when,
    author: [{ reference: "#practitioner" }],
    title: `Epikriz / Taburcu Raporu — ${c.patientName}`,
    confidentiality: "R", // restricted — özel nitelikli sağlık verisi
    contained,
    section,
  };
}

// ── M4 Güvenli Paylaşım → FHIR Consent + AuditEvent ──
// ShareLink (hasta kontrollü, süreli, iptal edilebilir paylaşım izni) → Consent
// ShareAccess (erişim denetim izi) → AuditEvent
// KVKK m.6 (açık rıza) + JCI ISEM (denetlenebilirlik): rıza + audit birebir FHIR karşılığına oturur.

export type ShareForFhir = ShareLink & {
  case: Pick<Case, "id" | "userId" | "patientName" | "country" | "language" | "patientIdentifier" | "patientIdentifierType">;
  accesses: ShareAccess[];
};

const SCOPE_LABELS: Record<string, string> = {
  EPIKRIZ: "Epikriz / taburcu raporu",
  RADYOLOJI: "Radyoloji görüntüleri",
  LAB: "Laboratuvar sonuçları",
  GORUSME_NOTU: "Görüşme (SOAP) notu",
};

function minimalPatient(c: ShareForFhir["case"]): FhirResource {
  return {
    resourceType: "Patient",
    id: "patient",
    identifier: [
      ...(c.patientIdentifier
        ? [{ type: { text: c.patientIdentifierType || "Kimlik No" }, system: `${ID_SYSTEM}/patient-identifier`, value: c.patientIdentifier }]
        : []),
      { system: `${ID_SYSTEM}/patient`, value: c.userId ?? c.id },
    ],
    name: [{ text: c.patientName }],
    ...(c.country ? { address: [{ country: c.country }] } : {}),
  };
}

// ShareLink → FHIR Consent (paylaşım izni). Patient contained → kendi kendine yeterli.
export function shareLinkToConsent(s: ShareForFhir): FhirResource {
  const expired = s.expiresAt ? new Date(s.expiresAt).getTime() < Date.now() : false;
  const status = s.revokedAt || expired ? "inactive" : "active";
  const scopes = (s.scopes || "").split(",").map((x) => x.trim()).filter(Boolean);
  return {
    resourceType: "Consent",
    id: `consent-${s.id}`,
    identifier: [{ system: `${ID_SYSTEM}/consent`, value: s.id }],
    status,
    scope: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentscope", code: "patient-privacy", display: "Privacy Consent" }] },
    category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IDSCL", display: "information disclosure" }] }],
    patient: { reference: "#patient" },
    dateTime: new Date(s.createdAt).toISOString(),
    contained: [minimalPatient(s.case)],
    provision: {
      type: "permit",
      period: {
        start: new Date(s.createdAt).toISOString(),
        ...(s.expiresAt ? { end: new Date(s.expiresAt).toISOString() } : {}),
      },
      actor: [{
        role: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-ParticipationType", code: "IRCP", display: "information recipient" }] },
        reference: { display: s.recipientName || "Dış hekim (bağlantıyla erişim)" },
      }],
      action: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/consentaction", code: "access", display: "Access" }] }],
      // Paylaşım kapsamı (kategoriler) — kodsuz text (geçerli FHIR)
      code: scopes.map((sc) => ({ text: SCOPE_LABELS[sc] || sc })),
    },
  };
}

// ShareAccess → FHIR AuditEvent (erişim denetim izi: kim, ne zaman, hangi eylem)
export function shareAccessToAuditEvent(a: ShareAccess, s: ShareForFhir): FhirResource {
  const isDownload = a.action === "DOWNLOAD";
  return {
    resourceType: "AuditEvent",
    id: `audit-${a.id}`,
    type: { system: "http://terminology.hl7.org/CodeSystem/audit-event-type", code: "rest", display: "RESTful Operation" },
    subtype: [{ system: "http://hl7.org/fhir/restful-interaction", code: "read", display: isDownload ? "download" : "read" }],
    action: "R", // VIEW/DOWNLOAD → read
    recorded: new Date(a.createdAt).toISOString(),
    outcome: "0", // başarılı
    agent: [{
      who: { display: s.recipientName || "Dış hekim (bağlantıyla erişim)" },
      requestor: true,
      ...(a.userAgent ? { name: a.userAgent.slice(0, 200) } : {}),
      network: { address: a.ip || "bilinmiyor", type: "2" }, // 2 = IP adresi
    }],
    source: { observer: { display: "AURA Telehealth" } },
    entity: [{
      what: { reference: `Consent/consent-${s.id}` },
      ...(a.detail ? { detail: [{ type: "downloaded", valueString: a.detail }] } : {}),
    }],
  };
}

// Bir paylaşımın tüm erişim izlerini FHIR Bundle (collection) olarak toplar.
export function shareAuditBundle(s: ShareForFhir): FhirResource {
  const events = s.accesses.map((a) => shareAccessToAuditEvent(a, s));
  return {
    resourceType: "Bundle",
    id: `audit-bundle-${s.id}`,
    type: "collection",
    timestamp: new Date().toISOString(),
    total: events.length,
    entry: events.map((e) => ({ resource: e })),
  };
}
