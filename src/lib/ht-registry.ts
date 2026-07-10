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
// removedAt temizlenir. Günlük eklenen/çıkarılan listeleri RegistryReport'a yazılır (tek rapor/gün).
// Bilinçli sınır: mevcut kayıtların ALAN GÜNCELLEMESİ yapılmaz (ör. hastane adı değişimi) — günlük
// 14k tekil UPDATE Neon'a gereksiz yük; eklenen/çıkarılan takibi tam ve kesindir. (İleride
// fingerprint kolonu ile seçici alan-güncelleme eklenebilir.)
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
async function fetchAll<T>(endpoint: "doctor/search" | "establishment/search"): Promise<T[]> {
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

export interface SyncSummary {
  status: "OK" | "FETCH_FAILED";
  date: string;
  doctorsTotal: number;
  hospitalsTotal: number;
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
    // Şehir lookup — doktor kaydındaki cityId'yi ada çevirir (rapor + filtre okunabilirliği)
    try {
      const cities = await htFetch<{ data?: { id: number; name: string }[] } | { id: number; name: string }[]>("city");
      const list = Array.isArray(cities) ? cities : (cities.data ?? []);
      cityMap = new Map(list.map((c) => [c.id, c.name]));
    } catch { /* şehir lookup opsiyonel — adsız devam */ }

    [doctors, hospitals] = await Promise.all([
      fetchAll<RawDoctor>("doctor/search"),
      fetchAll<RawHospital>("establishment/search"),
    ]);
  } catch (e) {
    // Kaynak erişilemedi (WAF/kesinti) → rapor FETCH_FAILED; mevcut veri DOKUNULMAZ, yarın yeniden denenir.
    const detail = e instanceof Error ? e.message : String(e);
    const failed: SyncSummary = {
      status: "FETCH_FAILED", date, doctorsTotal: 0, hospitalsTotal: 0,
      addedDoctors: [], removedDoctors: [], addedHospitals: [], removedHospitals: [], detail,
    };
    await writeReport(failed);
    return failed;
  }

  // ── Doktor diff ──
  const existingDocs = await db.registryDoctor.findMany({ select: { id: true, removedAt: true, name: true, lastName: true, branchName: true, cityName: true, establishmentName: true } });
  const existingDocMap = new Map(existingDocs.map((d) => [d.id, d]));
  const fetchedDocIds = new Set(doctors.map((d) => d.id));

  const addedDocs = doctors.filter((d) => !existingDocMap.has(d.id));
  const returnedDocIds = doctors.filter((d) => existingDocMap.get(d.id)?.removedAt).map((d) => d.id);
  const removedDocs = existingDocs.filter((d) => !d.removedAt && !fetchedDocIds.has(d.id));
  const seenDocIds = doctors.filter((d) => existingDocMap.has(d.id) && !existingDocMap.get(d.id)!.removedAt).map((d) => d.id);

  if (addedDocs.length) {
    for (const batch of chunk(addedDocs, 1000)) {
      await db.registryDoctor.createMany({
        data: batch.map((d) => ({
          id: d.id, name: d.name ?? "", lastName: d.lastName ?? "",
          jobName: d.jobName, jobId: d.jobId, branchName: d.branchName, branchId: d.branchId,
          cityId: d.cityId, cityName: d.cityId != null ? cityMap.get(d.cityId) ?? null : null,
          establishmentId: d.establishmentId, establishmentName: d.establishmentName,
          slug: d.slug, address: d.address, experience: d.expreience, genderId: d.genderId,
          firstSeenAt: now, lastSeenAt: now,
        })),
        skipDuplicates: true,
      });
    }
  }
  for (const batch of chunk(returnedDocIds, 2000)) {
    if (batch.length) await db.registryDoctor.updateMany({ where: { id: { in: batch } }, data: { removedAt: null, lastSeenAt: now } });
  }
  for (const batch of chunk(removedDocs.map((d) => d.id), 2000)) {
    if (batch.length) await db.registryDoctor.updateMany({ where: { id: { in: batch } }, data: { removedAt: now } });
  }
  for (const batch of chunk(seenDocIds, 2000)) {
    if (batch.length) await db.registryDoctor.updateMany({ where: { id: { in: batch } }, data: { lastSeenAt: now } });
  }

  // ── Hastane diff ──
  const existingHosps = await db.registryHospital.findMany({ select: { id: true, removedAt: true, name: true, cityName: true, facilityTypeName: true } });
  const existingHospMap = new Map(existingHosps.map((h) => [h.id, h]));
  const fetchedHospIds = new Set(hospitals.map((h) => h.id));

  const addedHosps = hospitals.filter((h) => !existingHospMap.has(h.id));
  const returnedHospIds = hospitals.filter((h) => existingHospMap.get(h.id)?.removedAt).map((h) => h.id);
  const removedHosps = existingHosps.filter((h) => !h.removedAt && !fetchedHospIds.has(h.id));
  const seenHospIds = hospitals.filter((h) => existingHospMap.has(h.id) && !existingHospMap.get(h.id)!.removedAt).map((h) => h.id);

  if (addedHosps.length) {
    for (const batch of chunk(addedHosps, 500)) {
      await db.registryHospital.createMany({
        data: batch.map((h) => ({
          id: h.id, name: h.name ?? "", slug: h.slug,
          cityName: h.cityName, cityCode: h.cityCode, cityHasAirport: h.cityHasAirport,
          address: h.address, phone: h.phone,
          totalPersonnel: h.totalPersonnel, unitCapacity: h.unitCapacity,
          facilityTypeId: h.establishmentHealthFacilityTypeId, facilityTypeName: h.establishmentHealthFacilityTypeName,
          accreditationCount: h.establishmentAccreditationCount, certificationCount: h.establishmentCertificationCount,
          insuranceCount: h.establishmentInsuranceCount, doctorCount: h.establishmentDoctorCount,
          foundationYear: h.foundationYear, latitude: h.xaxisCoordinate, longitude: h.yaxisCoordinate,
          branches: h.branches ? JSON.stringify(h.branches) : null,
          treatments: h.treatments ? JSON.stringify(h.treatments).slice(0, 20_000) : null, // aşırı büyük JSON freni
          firstSeenAt: now, lastSeenAt: now,
        })),
        skipDuplicates: true,
      });
    }
  }
  for (const batch of chunk(returnedHospIds, 2000)) {
    if (batch.length) await db.registryHospital.updateMany({ where: { id: { in: batch } }, data: { removedAt: null, lastSeenAt: now } });
  }
  for (const batch of chunk(removedHosps.map((h) => h.id), 2000)) {
    if (batch.length) await db.registryHospital.updateMany({ where: { id: { in: batch } }, data: { removedAt: now } });
  }
  for (const batch of chunk(seenHospIds, 2000)) {
    if (batch.length) await db.registryHospital.updateMany({ where: { id: { in: batch } }, data: { lastSeenAt: now } });
  }

  const summary: SyncSummary = {
    status: "OK",
    date,
    doctorsTotal: doctors.length,
    hospitalsTotal: hospitals.length,
    addedDoctors: addedDocs.map((d) => ({ id: d.id, name: d.name ?? "", lastName: d.lastName ?? "", branchName: d.branchName, cityName: d.cityId != null ? cityMap.get(d.cityId) ?? null : null, establishmentName: d.establishmentName })),
    removedDoctors: removedDocs.map((d) => ({ id: d.id, name: d.name, lastName: d.lastName, branchName: d.branchName, cityName: d.cityName, establishmentName: d.establishmentName })),
    addedHospitals: addedHosps.map((h) => ({ id: h.id, name: h.name ?? "", cityName: h.cityName, facilityTypeName: h.establishmentHealthFacilityTypeName })),
    removedHospitals: removedHosps.map((h) => ({ id: h.id, name: h.name, cityName: h.cityName, facilityTypeName: h.facilityTypeName })),
  };
  await writeReport(summary);

  // Değişiklik varsa yöneticiye bildirim (günlük rapor sayfasına link)
  const changes = summary.addedDoctors.length + summary.removedDoctors.length + summary.addedHospitals.length + summary.removedHospitals.length;
  if (changes > 0) {
    await notifyRoles(["ADMIN"], {
      type: "REGISTRY_REPORT",
      title: "📋 HealthTürkiye günlük değişiklik raporu",
      body: `+${summary.addedDoctors.length}/−${summary.removedDoctors.length} doktor · +${summary.addedHospitals.length}/−${summary.removedHospitals.length} tesis`,
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
        addedDoctors: JSON.stringify(cap(s.addedDoctors)), removedDoctors: JSON.stringify(cap(s.removedDoctors)),
        addedHospitals: JSON.stringify(cap(s.addedHospitals)), removedHospitals: JSON.stringify(cap(s.removedHospitals)),
        detail: detail || null,
      },
      create: {
        date: s.date, status: s.status, doctorsTotal: s.doctorsTotal, hospitalsTotal: s.hospitalsTotal,
        addedDoctors: JSON.stringify(cap(s.addedDoctors)), removedDoctors: JSON.stringify(cap(s.removedDoctors)),
        addedHospitals: JSON.stringify(cap(s.addedHospitals)), removedHospitals: JSON.stringify(cap(s.removedHospitals)),
        detail: detail || null,
      },
    });
  } catch (e) {
    console.warn("[ht-registry] rapor yazılamadı:", e instanceof Error ? e.message : e);
  }
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
