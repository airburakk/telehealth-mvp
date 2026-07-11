// HealthTürkiye (healthturkiye.gov.tr) kayıt defteri senkronu — FAZ 6 (2026-07-10).
// Kaynak: resmi sitenin kendi web API'si (keşif 2026-07-10, oturum kayıtlı):
//   GET https://web-api.healthturkiye.gov.tr/api/v1/doctor/search?pageIndex=N&pageSize=100
//     → { pageCount, dataCount, data: [{id, name, lastName, jobName, branchName/Id, cityId,
//        establishmentId/Name, slug, address, expreience(sic), genderId, jobId}] } (~10.000 doktor)
//   GET .../establishment/search?pageIndex=N&pageSize=100 → (~4.600 tesis; şehir/havalimanı/personel/
//        tesis türü/akreditasyon sayıları/branches/treatments dahil)
//   GET .../city → şehir lookup (cityId → ad + havalimanı)
// ⚠️ Site Cloudflare arkasında; varsayılan (bot) User-Agent 403 alır → tarayıcı UA taklidi ŞART.
// Kamuya açık resmi dizin verisi (PHI DEĞİL) → şifreleme yok.
//
// Diff modeli (soft-delete): kaynaktan kalkan kayıt SİLİNMEZ, removedAt damgalanır; geri gelirse
// removedAt temizlenir + alanları tazelenir. Günlük eklenen/çıkarılan listeleri RegistryReport'a
// yazılır (tek rapor/gün).
// Alan-güncellemesi (v5.4): fingerprint'li SEÇİCİ UPDATE — liste-API alanlarının kısa hash'i
// satırda saklanır; senkronda yalnız hash'i değişen kayıtlar güncellenir (14k körlemesine UPDATE
// yerine günde tipik birkaç kayıt). Detay/enrichment alanları hash'e ve güncellemeye GİRMEZ.
import { createHash } from "node:crypto";
import { db } from "./db";
import { notifyRoles } from "./notify";

const API = "https://web-api.healthturkiye.gov.tr/api/v1";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const PAGE_SIZE = 100;
const CONCURRENCY = 6; // Vercel fonksiyon süresi içinde ~150 sayfayı bitirmek için paralel şerit

interface RawDoctor {
  id: number; name: string; lastName: string; jobName: string | null; jobId: number | null;
  branchName: string | null; branchId: number | null; cityId: number | null;
  establishmentId: number | null; establishmentName: string | null;
  slug: string | null; address: string | null; expreience: number | null; genderId: number | null;
}
interface RawHospital {
  id: number; name: string; slug: string | null; cityName: string | null; cityCode: string | null;
  cityHasAirport: boolean | null; address: string | null; phone: string | null;
  totalPersonnel: number | null; unitCapacity: number | null;
  establishmentHealthFacilityTypeId: number | null; establishmentHealthFacilityTypeName: string | null;
  establishmentAccreditationCount: number | null; establishmentCertificationCount: number | null;
  establishmentInsuranceCount: number | null; establishmentDoctorCount: number | null;
  foundationYear: number | null; xaxisCoordinate: string | null; yaxisCoordinate: string | null;
  branches: { id: number; name: string }[] | null;
  treatments: unknown[] | null;
}
interface SearchResp<T> { pageCount: number; dataCount: number; data: T[] }

// Tek sayfa fetch — 20sn zaman aşımı + 2 yeniden deneme (kaynak API tek tek sayfalarda
// ara sıra yavaşlıyor; ilk tam çekimde bir sayfanın timeout'u tüm koşuyu düşürmesin).
async function htFetch<T>(path: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`${API}/${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`healthturkiye ${path} → HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// Sayfalı ucu tamamen çek (pageIndex 0-bazlı; CONCURRENCY şeritli).
async function fetchAll<T>(endpoint: "doctor/search" | "establishment/search" | "city"): Promise<T[]> {
  const first = await htFetch<SearchResp<T>>(`${endpoint}?pageIndex=0&pageSize=${PAGE_SIZE}`);
  const pages = Math.max(1, Math.ceil(first.dataCount / PAGE_SIZE));
  const out: T[][] = [first.data];
  const idxs = Array.from({ length: pages - 1 }, (_, i) => i + 1);
  for (let i = 0; i < idxs.length; i += CONCURRENCY) {
    const batch = idxs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((p) => htFetch<SearchResp<T>>(`${endpoint}?pageIndex=${p}&pageSize=${PAGE_SIZE}`)),
    );
    for (const r of results) out.push(r.data);
  }
  // id bazında tekilleştir (kaynak sayfalaması kayabilir)
  const seen = new Set<number>();
  const flat: T[] = [];
  for (const row of out.flat() as (T & { id: number })[]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    flat.push(row);
  }
  return flat;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

interface RawCity { id: number; name: string }

// Şehir lookup'ı (cityId → ad). ⚠️ /city ucu SAYFALIDIR (~4.9k dünya şehri, 49 sayfa) — parametresiz
// çağrı yalnız İLK 10 kaydı verir (v5.5 ilk gece dolumunun 0 kalmasının kök nedeni; 2026-07-11 06:04
// cron'unda yakalandı) → fetchAll ile tam çekilir. Hata/boşlukta boş map döner: şehir-dolum adımı
// atlanır, senkronun kendisi ETKİLENMEZ (fill opsiyonel süs verisi, diff değil).
export async function fetchCityMap(): Promise<Map<number, string>> {
  try {
    const cities = await fetchAll<RawCity>("city");
    return new Map(
      cities
        .filter((c) => typeof c?.id === "number" && typeof c?.name === "string" && c.name.trim())
        .map((c) => [c.id, c.name.trim()]),
    );
  } catch {
    return new Map();
  }
}

// ── Fingerprint (v5.4): liste-API alanlarının kısa hash'i ──
// Raw (senkron) ve DB satırı (backfill) İKİ yoldan da AYNI değer dizisi üretilmeli — alan sırası
// sözleşmedir, değiştirme. Doktorda türetilmiş cityName hash'e GİRMEZ (city lookup'ı opsiyonel:
// lookup'ın düştüğü gün tüm dizinin hash'i değişmesin; cityId değişimi şehri zaten yakalar).
function fp(vals: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(vals)).digest("hex").slice(0, 16);
}

function doctorFpFromRaw(d: RawDoctor): string {
  return fp([d.name ?? "", d.lastName ?? "", d.jobName, d.jobId, d.branchName, d.branchId, d.cityId, d.establishmentId, d.establishmentName, d.slug, d.address, d.expreience, d.genderId]);
}
export function doctorFpFromRow(r: { name: string; lastName: string; jobName: string | null; jobId: number | null; branchName: string | null; branchId: number | null; cityId: number | null; establishmentId: number | null; establishmentName: string | null; slug: string | null; address: string | null; experience: number | null; genderId: number | null }): string {
  return fp([r.name, r.lastName, r.jobName, r.jobId, r.branchName, r.branchId, r.cityId, r.establishmentId, r.establishmentName, r.slug, r.address, r.experience, r.genderId]);
}

const hospBranchesStr = (h: RawHospital) => (h.branches ? JSON.stringify(h.branches) : null);
const hospTreatmentsStr = (h: RawHospital) => (h.treatments ? JSON.stringify(h.treatments).slice(0, 20_000) : null);
function hospitalFpFromRaw(h: RawHospital): string {
  return fp([h.name ?? "", h.slug, h.cityName, h.cityCode, h.cityHasAirport, h.address, h.phone, h.totalPersonnel, h.unitCapacity, h.establishmentHealthFacilityTypeId, h.establishmentHealthFacilityTypeName, h.establishmentAccreditationCount, h.establishmentCertificationCount, h.establishmentInsuranceCount, h.establishmentDoctorCount, h.foundationYear, h.xaxisCoordinate, h.yaxisCoordinate, hospBranchesStr(h), hospTreatmentsStr(h)]);
}
export function hospitalFpFromRow(r: { name: string; slug: string | null; cityName: string | null; cityCode: string | null; cityHasAirport: boolean | null; address: string | null; phone: string | null; totalPersonnel: number | null; unitCapacity: number | null; facilityTypeId: number | null; facilityTypeName: string | null; accreditationCount: number | null; certificationCount: number | null; insuranceCount: number | null; doctorCount: number | null; foundationYear: number | null; latitude: string | null; longitude: string | null; branches: string | null; treatments: string | null }): string {
  return fp([r.name, r.slug, r.cityName, r.cityCode, r.cityHasAirport, r.address, r.phone, r.totalPersonnel, r.unitCapacity, r.facilityTypeId, r.facilityTypeName, r.accreditationCount, r.certificationCount, r.insuranceCount, r.doctorCount, r.foundationYear, r.latitude, r.longitude, r.branches, r.treatments]);
}

// Savunma tavanı: kaynak format kayması / hash sözleşmesi bozulması TÜM dizinin hash'ini
// değiştirirse cron'u 14k tekil UPDATE ile boğma — o koşuda alan-güncelleme atlanır, rapora not düşer.
const FIELD_UPDATE_CAP = 1000;

// Tekil güncellemeleri sınırlı eşzamanlılıkla koş (değişen kayıtlar tipik günde birkaç adet).
async function runUpdates<T>(rows: T[], run: (r: T) => Promise<unknown>): Promise<void> {
  for (const batch of chunk(rows, 25)) await Promise.all(batch.map(run));
}

// Doktor alan seti (create/update ortak) — cityName yalnız çözülebiliyorsa yazılır (update'te
// undefined = mevcut değeri koru; createMany'de ?? null gerekir, aşağıda ayrıca ele alınır).
function doctorFields(d: RawDoctor, cityMap: Map<number, string>) {
  return {
    name: d.name ?? "", lastName: d.lastName ?? "",
    jobName: d.jobName, jobId: d.jobId, branchName: d.branchName, branchId: d.branchId,
    cityId: d.cityId, cityName: d.cityId != null ? cityMap.get(d.cityId) : undefined,
    establishmentId: d.establishmentId, establishmentName: d.establishmentName,
    slug: d.slug, address: d.address, experience: d.expreience, genderId: d.genderId,
    fingerprint: doctorFpFromRaw(d),
  };
}

// Hastane liste-API alan seti (create/update ortak) — enrichment kolonlarına DOKUNMAZ.
function hospitalFields(h: RawHospital) {
  return {
    name: h.name ?? "", slug: h.slug,
    cityName: h.cityName, cityCode: h.cityCode, cityHasAirport: h.cityHasAirport,
    address: h.address, phone: h.phone,
    totalPersonnel: h.totalPersonnel, unitCapacity: h.unitCapacity,
    facilityTypeId: h.establishmentHealthFacilityTypeId, facilityTypeName: h.establishmentHealthFacilityTypeName,
    accreditationCount: h.establishmentAccreditationCount, certificationCount: h.establishmentCertificationCount,
    insuranceCount: h.establishmentInsuranceCount, doctorCount: h.establishmentDoctorCount,
    foundationYear: h.foundationYear, latitude: h.xaxisCoordinate, longitude: h.yaxisCoordinate,
    branches: hospBranchesStr(h), treatments: hospTreatmentsStr(h),
    fingerprint: hospitalFpFromRaw(h),
  };
}

export interface SyncSummary {
  status: "OK" | "FETCH_FAILED";
  date: string;
  doctorsTotal: number;
  hospitalsTotal: number;
  updatedDoctors: number; // alan-güncellemesi yapılan kayıt (v5.4 fingerprint)
  updatedHospitals: number;
  addedDoctors: { id: number; name: string; lastName: string; branchName: string | null; cityName: string | null; establishmentName: string | null }[];
  removedDoctors: { id: number; name: string; lastName: string; branchName: string | null; cityName: string | null; establishmentName: string | null }[];
  addedHospitals: { id: number; name: string; cityName: string | null; facilityTypeName: string | null }[];
  removedHospitals: { id: number; name: string; cityName: string | null; facilityTypeName: string | null }[];
  detail?: string;
}

function todayIstanbul(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Istanbul", dateStyle: "short" }).format(new Date()); // YYYY-MM-DD
}

// Tam senkron: doktor + hastane TEK koşuda, TEK günlük rapor (kullanıcı kararı).
export async function runRegistrySync(): Promise<SyncSummary> {
  const date = todayIstanbul();
  const now = new Date();

  let doctors: RawDoctor[];
  let hospitals: RawHospital[];
  let cityMap = new Map<number, string>();
  try {
    // Şehir lookup — doktor kaydındaki cityId'yi ada çevirir (rapor + filtre + şehir-dolum adımı).
    // Sayfalı tam çekim (fetchCityMap); başarısızlıkta boş map = adsız devam (opsiyonel).
    cityMap = await fetchCityMap();

    [doctors, hospitals] = await Promise.all([
      fetchAll<RawDoctor>("doctor/search"),
      fetchAll<RawHospital>("establishment/search"),
    ]);
  } catch (e) {
    // Kaynak erişilemedi (WAF/kesinti) → rapor FETCH_FAILED; mevcut veri DOKUNULMAZ, yarın yeniden denenir.
    const detail = e instanceof Error ? e.message : String(e);
    const failed: SyncSummary = {
      status: "FETCH_FAILED", date, doctorsTotal: 0, hospitalsTotal: 0,
      updatedDoctors: 0, updatedHospitals: 0,
      addedDoctors: [], removedDoctors: [], addedHospitals: [], removedHospitals: [], detail,
    };
    await writeReport(failed);
    return failed;
  }

  // ── Doktor diff ──
  const existingDocs = await db.registryDoctor.findMany({ select: { id: true, removedAt: true, fingerprint: true, name: true, lastName: true, branchName: true, cityName: true, establishmentName: true } });
  const existingDocMap = new Map(existingDocs.map((d) => [d.id, d]));
  const fetchedDocIds = new Set(doctors.map((d) => d.id));

  const addedDocs = doctors.filter((d) => !existingDocMap.has(d.id));
  const returnedDocs = doctors.filter((d) => existingDocMap.get(d.id)?.removedAt);
  const removedDocs = existingDocs.filter((d) => !d.removedAt && !fetchedDocIds.has(d.id));
  const seenDocIds = doctors.filter((d) => existingDocMap.has(d.id) && !existingDocMap.get(d.id)!.removedAt).map((d) => d.id);
  // Alan-güncellemesi: aktif + fingerprint'i DOLU (backfill'lenmiş) + hash'i değişen kayıtlar.
  // null-fingerprint satırlar karşılaştırılmaz (ilk doldurma scripts/registry-fingerprint-backfill.ts).
  const changedDocs = doctors.filter((d) => {
    const ex = existingDocMap.get(d.id);
    return ex && !ex.removedAt && ex.fingerprint != null && ex.fingerprint !== doctorFpFromRaw(d);
  });
  const docUpdateSkipped = changedDocs.length > FIELD_UPDATE_CAP;

  if (addedDocs.length) {
    for (const batch of chunk(addedDocs, 1000)) {
      await db.registryDoctor.createMany({
        data: batch.map((d) => ({
          ...doctorFields(d, cityMap), id: d.id,
          cityName: d.cityId != null ? cityMap.get(d.cityId) ?? null : null, // create'te undefined olmaz
          firstSeenAt: now, lastSeenAt: now,
        })),
        skipDuplicates: true,
      });
    }
  }
  // Geri gelen kayıt: removedAt temizlenir + alanlar tazelenir (aradan geçen sürede değişmiş olabilir)
  await runUpdates(returnedDocs, (d) =>
    db.registryDoctor.update({ where: { id: d.id }, data: { ...doctorFields(d, cityMap), removedAt: null, lastSeenAt: now } }));
  if (!docUpdateSkipped) {
    await runUpdates(changedDocs, (d) =>
      db.registryDoctor.update({ where: { id: d.id }, data: { ...doctorFields(d, cityMap), lastSeenAt: now } }));
  }
  for (const batch of chunk(removedDocs.map((d) => d.id), 2000)) {
    if (batch.length) await db.registryDoctor.updateMany({ where: { id: { in: batch } }, data: { removedAt: now } });
  }
  for (const batch of chunk(seenDocIds, 2000)) {
    if (batch.length) await db.registryDoctor.updateMany({ where: { id: { in: batch } }, data: { lastSeenAt: now } });
  }

  // ── Şehir adı dolumu (v5.5): türetilmiş cityName fingerprint'e GİRMEZ → fingerprint eşit kaldıkça
  // eski satırlar hiç dolmaz (ilk tam çekim lookup'sızdı: ~10k satırda cityName=null, cityId ~5.7k dolu).
  // cityId-gruplu updateMany ile ucuz idempotent dolum; sonraki günlerde 0 satır etkilenir.
  // ⚠️ YALNIZ doktorlarda geçen cityId'ler üzerinde dönülür (~≤100): cityMap ~4.9k DÜNYA şehridir —
  // tamamında dönmek ~4.9k sorgu = cron maxDuration aşımı (dev-branch provasında yakalandı, 2026-07-11).
  // Lookup o koşuda düşmüşse (cityMap boş) adım atlanır, mevcut adlara dokunulmaz.
  let cityNamesFilled = 0;
  const usedCityIds = new Set<number>();
  for (const d of doctors) if (d.cityId != null && cityMap.has(d.cityId)) usedCityIds.add(d.cityId);
  for (const cid of usedCityIds) {
    const cname = cityMap.get(cid)!;
    const r = await db.registryDoctor.updateMany({
      where: { cityId: cid, OR: [{ cityName: null }, { cityName: { not: cname } }] },
      data: { cityName: cname },
    });
    cityNamesFilled += r.count;
  }

  // ── Hastane diff ──
  const existingHosps = await db.registryHospital.findMany({ select: { id: true, removedAt: true, fingerprint: true, name: true, cityName: true, facilityTypeName: true } });
  const existingHospMap = new Map(existingHosps.map((h) => [h.id, h]));
  const fetchedHospIds = new Set(hospitals.map((h) => h.id));

  const addedHosps = hospitals.filter((h) => !existingHospMap.has(h.id));
  const returnedHosps = hospitals.filter((h) => existingHospMap.get(h.id)?.removedAt);
  const removedHosps = existingHosps.filter((h) => !h.removedAt && !fetchedHospIds.has(h.id));
  const seenHospIds = hospitals.filter((h) => existingHospMap.has(h.id) && !existingHospMap.get(h.id)!.removedAt).map((h) => h.id);
  const changedHosps = hospitals.filter((h) => {
    const ex = existingHospMap.get(h.id);
    return ex && !ex.removedAt && ex.fingerprint != null && ex.fingerprint !== hospitalFpFromRaw(h);
  });
  const hospUpdateSkipped = changedHosps.length > FIELD_UPDATE_CAP;

  if (addedHosps.length) {
    for (const batch of chunk(addedHosps, 500)) {
      await db.registryHospital.createMany({
        data: batch.map((h) => ({ ...hospitalFields(h), id: h.id, firstSeenAt: now, lastSeenAt: now })),
        skipDuplicates: true,
      });
    }
  }
  // Geri gelen tesis: removedAt temizlenir + liste-API alanları tazelenir (enrichment kolonları korunur)
  await runUpdates(returnedHosps, (h) =>
    db.registryHospital.update({ where: { id: h.id }, data: { ...hospitalFields(h), removedAt: null, lastSeenAt: now } }));
  if (!hospUpdateSkipped) {
    await runUpdates(changedHosps, (h) =>
      db.registryHospital.update({ where: { id: h.id }, data: { ...hospitalFields(h), lastSeenAt: now } }));
  }
  for (const batch of chunk(removedHosps.map((h) => h.id), 2000)) {
    if (batch.length) await db.registryHospital.updateMany({ where: { id: { in: batch } }, data: { removedAt: now } });
  }
  for (const batch of chunk(seenHospIds, 2000)) {
    if (batch.length) await db.registryHospital.updateMany({ where: { id: { in: batch } }, data: { lastSeenAt: now } });
  }

  // Cap notu: kaynak format kayması şüphesi — alan-güncelleme o koşuda atlanır, ertesi gün yeniden değerlendirilir
  const capNotes = [
    docUpdateSkipped ? `Alan-güncelleme ATLANDI (doktor): ${changedDocs.length} değişiklik > ${FIELD_UPDATE_CAP} tavanı (kaynak format kayması olabilir).` : "",
    hospUpdateSkipped ? `Alan-güncelleme ATLANDI (tesis): ${changedHosps.length} değişiklik > ${FIELD_UPDATE_CAP} tavanı.` : "",
    cityNamesFilled ? `Şehir adı dolduruldu: ${cityNamesFilled} doktor.` : "",
  ].filter(Boolean).join(" ");

  const summary: SyncSummary = {
    status: "OK",
    date,
    doctorsTotal: doctors.length,
    hospitalsTotal: hospitals.length,
    updatedDoctors: docUpdateSkipped ? 0 : changedDocs.length,
    updatedHospitals: hospUpdateSkipped ? 0 : changedHosps.length,
    addedDoctors: addedDocs.map((d) => ({ id: d.id, name: d.name ?? "", lastName: d.lastName ?? "", branchName: d.branchName, cityName: d.cityId != null ? cityMap.get(d.cityId) ?? null : null, establishmentName: d.establishmentName })),
    removedDoctors: removedDocs.map((d) => ({ id: d.id, name: d.name, lastName: d.lastName, branchName: d.branchName, cityName: d.cityName, establishmentName: d.establishmentName })),
    addedHospitals: addedHosps.map((h) => ({ id: h.id, name: h.name ?? "", cityName: h.cityName, facilityTypeName: h.establishmentHealthFacilityTypeName })),
    removedHospitals: removedHosps.map((h) => ({ id: h.id, name: h.name, cityName: h.cityName, facilityTypeName: h.facilityTypeName })),
    ...(capNotes ? { detail: capNotes } : {}),
  };
  await writeReport(summary);

  // Değişiklik varsa yöneticiye bildirim (günlük rapor sayfasına link)
  const changes = summary.addedDoctors.length + summary.removedDoctors.length + summary.addedHospitals.length + summary.removedHospitals.length + summary.updatedDoctors + summary.updatedHospitals;
  if (changes > 0) {
    await notifyRoles(["ADMIN"], {
      type: "REGISTRY_REPORT",
      title: "📋 HealthTürkiye günlük değişiklik raporu",
      body: `+${summary.addedDoctors.length}/−${summary.removedDoctors.length}/✎${summary.updatedDoctors} doktor · +${summary.addedHospitals.length}/−${summary.removedHospitals.length}/✎${summary.updatedHospitals} tesis`,
      href: "/admin/registry-raporu",
    });
  }
  return summary;
}

// Günlük raporu yaz (aynı gün yeniden koşulursa üzerine yazar — upsert by date).
// Rapor listeleri JSON'da 500 kayıtla sınırlanır (ilk tam çekimde "eklenen 10.000 doktor" raporu şişmesin).
async function writeReport(s: SyncSummary): Promise<void> {
  const cap = <T,>(a: T[]) => a.slice(0, 500);
  const capNote = (a: unknown[], label: string) => (a.length > 500 ? `${label}: ${a.length} kayıt (ilk 500 listelendi). ` : "");
  const detail =
    (s.detail ? `${s.detail}. ` : "") +
    capNote(s.addedDoctors, "Eklenen doktor") + capNote(s.removedDoctors, "Çıkarılan doktor") +
    capNote(s.addedHospitals, "Eklenen tesis") + capNote(s.removedHospitals, "Çıkarılan tesis");
  try {
    await db.registryReport.upsert({
      where: { date: s.date },
      update: {
        status: s.status, doctorsTotal: s.doctorsTotal, hospitalsTotal: s.hospitalsTotal,
        updatedDoctors: s.updatedDoctors, updatedHospitals: s.updatedHospitals,
        addedDoctors: JSON.stringify(cap(s.addedDoctors)), removedDoctors: JSON.stringify(cap(s.removedDoctors)),
        addedHospitals: JSON.stringify(cap(s.addedHospitals)), removedHospitals: JSON.stringify(cap(s.removedHospitals)),
        detail: detail || null,
      },
      create: {
        date: s.date, status: s.status, doctorsTotal: s.doctorsTotal, hospitalsTotal: s.hospitalsTotal,
        updatedDoctors: s.updatedDoctors, updatedHospitals: s.updatedHospitals,
        addedDoctors: JSON.stringify(cap(s.addedDoctors)), removedDoctors: JSON.stringify(cap(s.removedDoctors)),
        addedHospitals: JSON.stringify(cap(s.addedHospitals)), removedHospitals: JSON.stringify(cap(s.removedHospitals)),
        detail: detail || null,
      },
    });
  } catch (e) {
    console.warn("[ht-registry] rapor yazılamadı:", e instanceof Error ? e.message : e);
  }
}

// ── Tesis detay zenginleştirme (2026-07-10): languages/accreditations/facilities ADLARI ──
// Liste API'si bu alanları yalnız SAYI olarak verir; adlar sitenin SSR detay sayfasında yaşar:
//   GET https://healthturkiye.gov.tr/_next/data/<buildId>/hospital/<slug>.json
//     → pageProps.template.hospital.{languages,accreditations,resources,...} [{id,name}]
// buildId site her deploy'unda değişir → koşu başında anasayfadan dinamik çözülür.
// Doldurma modeli: languages=null satırlar aday (doctorCount yüksek önce); başarı=adlar,
// detay-sayfası-yok="[]" (yeniden denenmez), ağ hatası=null bırakılır (sonraki koşu dener).
const SITE = "https://healthturkiye.gov.tr";
const ENRICH_CONCURRENCY = 4;

async function siteFetch(path: string): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(`${SITE}${path}`, {
        headers: { "User-Agent": UA, Accept: "application/json, text/html" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
    } catch (e) {
      lastErr = e;
      if (attempt < 1) await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function discoverBuildId(): Promise<string> {
  const res = await siteFetch("/");
  if (!res.ok) throw new Error(`healthturkiye site → HTTP ${res.status}`);
  const html = await res.text();
  const m = html.match(/"buildId":"([^"]+)"/);
  if (!m) throw new Error("healthturkiye buildId bulunamadı (site yapısı değişmiş olabilir)");
  return m[1];
}

// {id,name} dizisinden temiz ad listesi (trim + boş/yinelenen ayıkla + tavan)
function names(list: unknown, cap: number): string[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    const raw = typeof item === "string" ? item : (item as { name?: unknown })?.name;
    if (typeof raw !== "string") continue;
    const n = raw.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!n || seen.has(n.toLowerCase())) continue;
    seen.add(n.toLowerCase());
    out.push(n);
    if (out.length >= cap) break;
  }
  return out;
}

type DetailNames = { languages: string[]; accreditations: string[]; facilities: string[]; authorizationNumber: string };

// Tek tesisin detay adlarını çek; "notfound" = detay sayfası yok (kalıcı, "[]" yazılır).
async function fetchHospitalDetailNames(buildId: string, slug: string): Promise<DetailNames | "notfound"> {
  const res = await siteFetch(`/_next/data/${buildId}/hospital/${encodeURIComponent(slug)}.json`);
  if (res.status === 404) return "notfound"; // buildId taze iken 404 = sayfa yok
  if (!res.ok) throw new Error(`hospital/${slug} → HTTP ${res.status}`);
  const j = (await res.json()) as { pageProps?: { error?: unknown; template?: { hospital?: Record<string, unknown> } } };
  const h = j.pageProps?.template?.hospital;
  if (!h) return "notfound"; // CMS "post bulunamadı" cevabı da buraya düşer
  return {
    languages: names(h.languages, 30),
    accreditations: names(h.accreditations, 20),
    facilities: names(h.resources, 60), // sitedeki "resources" = Tesis Olanakları
    // Sağlık turizmi YETKİ BELGE NO (ör. "ST-0292"); yoksa "" = kontrol edildi, dizinde kayıt yok
    authorizationNumber: typeof h.authorizationNumber === "string" ? h.authorizationNumber.replace(/\s+/g, " ").trim().slice(0, 60) : "",
  };
}

export interface EnrichSummary { scanned: number; enriched: number; empty: number; failed: number }

// Aktif tesisleri detaydan zenginleştir (limit'le sınırlı; cron + bulk script kullanır).
// mode "new" (varsayılan): languages=null adaylar — günlük cron yeni tesisleri böyle doldurur.
// mode "auth-backfill": authorizationNumber=null adaylar — v5.2 kolon backfill'i (bir defalık;
// languages dolu satırları da yeniden çeker, taze veriyle üzerine yazar — zararsız tazeleme).
export async function enrichHospitalDetails(limit: number, mode: "new" | "auth-backfill" = "new"): Promise<EnrichSummary> {
  const candidates = await db.registryHospital.findMany({
    where: mode === "auth-backfill" ? { removedAt: null, authorizationNumber: null } : { removedAt: null, languages: null },
    select: { id: true, slug: true },
    orderBy: { doctorCount: "desc" }, // en görünür tesisler önce dolsun
    take: limit,
  });
  const sum: EnrichSummary = { scanned: candidates.length, enriched: 0, empty: 0, failed: 0 };
  if (!candidates.length) return sum;

  const buildId = await discoverBuildId();
  for (const batch of chunk(candidates, ENRICH_CONCURRENCY)) {
    await Promise.all(batch.map(async (c) => {
      try {
        const d = !c.slug ? "notfound" : await fetchHospitalDetailNames(buildId, c.slug);
        if (d === "notfound") {
          await db.registryHospital.update({ where: { id: c.id }, data: { languages: "[]", accreditations: "[]", facilities: "[]", authorizationNumber: "" } });
          sum.empty++;
        } else {
          await db.registryHospital.update({
            where: { id: c.id },
            data: {
              languages: JSON.stringify(d.languages), accreditations: JSON.stringify(d.accreditations),
              facilities: JSON.stringify(d.facilities), authorizationNumber: d.authorizationNumber,
            },
          });
          sum.enriched++;
        }
      } catch {
        sum.failed++; // null kalır → sonraki koşu yeniden dener
      }
    }));
  }
  return sum;
}

// ── Doktor kayıt doğrulaması (FAZ 6): platform doktoru HealthTürkiye dizininde var mı? ──
// Ad-soyad normalize eşleşmesi (ünvan öneki atılır; Türkçe karakterler sadeleştirilir).
// Sonuç Doctor.registryStatus'a yazılır → /admin/hekim-onay onay kartında bayrak olarak görünür.
// Fire-safe: hata kayıt akışını bozmaz (registry boşsa NOT_FOUND yazmak yerine null bırakılır).
function trNorm(s: string): string {
  return s
    .replace(/İ/g, "i").replace(/I/g, "ı").toLowerCase()
    .replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ı/g, "i")
    .replace(/ö/g, "o").replace(/ş/g, "s").replace(/ü/g, "u")
    .replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
}
const TITLE_PREFIX = /^(prof\.?|doç\.?|doc\.?|op\.?|uzm\.?|dr\.?|dt\.?)\s+/i;

export async function verifyDoctorAgainstRegistry(doctorId: string, fullName: string): Promise<void> {
  try {
    const total = await db.registryDoctor.count({ where: { removedAt: null } });
    if (total === 0) return; // dizin henüz senkronlanmadı → karar verme (null = "henüz bakılmadı")

    let n = fullName.trim();
    for (let i = 0; i < 4; i++) n = n.replace(TITLE_PREFIX, ""); // "Prof. Dr. Op. ..." zincirini soy
    const parts = trNorm(n).split(" ").filter(Boolean);
    if (parts.length < 2) {
      await db.doctor.update({ where: { id: doctorId }, data: { registryStatus: "NOT_FOUND", registryCheckedAt: new Date() } });
      return;
    }
    const last = parts[parts.length - 1];
    const first = parts.slice(0, -1).join(" ");

    // Aday havuzu: soyadı (insensitive contains) eşleşenler → bellekte normalize kıyas
    const candidates = await db.registryDoctor.findMany({
      where: { removedAt: null, lastName: { contains: last, mode: "insensitive" } },
      select: { name: true, lastName: true },
      take: 500,
    });
    const found = candidates.some((c) => trNorm(c.lastName) === last && (trNorm(c.name) === first || trNorm(c.name).startsWith(first) || first.startsWith(trNorm(c.name))));

    await db.doctor.update({
      where: { id: doctorId },
      data: { registryStatus: found ? "FOUND" : "NOT_FOUND", registryCheckedAt: new Date() },
    });
  } catch (e) {
    console.warn("[ht-registry] doktor doğrulaması başarısız (kayıt akışı bozulmaz):", e instanceof Error ? e.message : e);
  }
}
