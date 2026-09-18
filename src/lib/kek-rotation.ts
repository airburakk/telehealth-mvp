// KEK ROTASYON MOTORU — ŞEMA-GÜDÜMLÜ, tek çekirdek, iki giriş (2026-09-18; tatbikat #1 aksiyon A1):
//   · scripts/rotate-kek.ts     → CLI (operatör yerelden; üretim için PROD_* değerleri AÇIKÇA — runbook sir-envanteri §3.1)
//   · /api/admin/kek-rotate     → BREAK-GLASS: insan-okur KEK kopyası kaybolduğunda Vercel'de çalışan kod eski KEK'i
//                                  (env) hâlâ okuyabildiği için rotasyon sunucu İÇİNDE koşar; operatör YENİ KEK'i verir.
//
// NEDEN ŞEMA-GÜDÜMLÜ (2026-09-18 bulgusu): 2026-07-17'deki ilk motor elle tutulan 13 kolonluk bir envanterle
// yürüyordu; koddaki şifreli kolon evreni o tarihten sonra ~40'a çıktı (Complaint · ConsultationRequest/Message ·
// Doctor.phone/workEmail/mmssPolicyNo · VerificationChallenge.target · SystemMessage · StaffApplication/Document ·
// DoctorDocument · User.patientHealthHistory · Case.patientPhone/healthDeclaration · SecondOpinionCase…). Envanterle
// rotasyon o kolonları ESKİ KEK'te bırakır → env yeni anahtara geçince okunamaz olurlar (sessiz veri kaybı).
// Bu motor envanter TUTMAZ: information_schema'dan TÜM base tabloların TÜM metin kolonlarını bulur, `enc:v1:` /
// `blob:v1:` değer taşıyan satırları tekil `id` üzerinden cursor'la yürür. Yeni şifreli kolon otomatik kapsanır.
//
// İçerik HİÇ ÇÖZÜLMEZ: yalnız DEK sarımı değişir (lib/crypto rewrapEnvelope; iv/tag/ct aynen kalır).
//
// Satır sınıflandırması (hiçbir değer loglanmaz — yalnız Tablo.kolon#id etiketi):
//   enc:v1: + eski KEK açıyor  → rewrap  (yalnız apply ile yazılır)
//   enc:v1: + yeni KEK açıyor  → already (önceki yarım koşudan — idempotent devam)
//   enc:v1: + ikisi de açmıyor → foreign (başka ortamın anahtarı / bozuk) → DOKUNMA; çağıran bitmiş saymaz
//   blob:v1:                   → blob    (apply+blobs ile: indir → rewrap → yeni blob → ref güncelle → eskiyi sil)
//
// Zaman bütçesi (serverless): `deadline` verilirse sayfa sınırında durur, complete=false döner; tekrar çağrı
// idempotent (bitenler already). Çok-örnekli üretimde apply sırasında eski KEK'le yazan örnekler kalabilir →
// env yeni KEK'e geçirilip redeploy'dan sonra BİR TUR DAHA (already ağırlıklı olmalı).
//
// Raw SQL: tanımlayıcılar KATALOGDAN gelir ve `^[A-Za-z_][A-Za-z0-9_]*$` süzgecinden geçmeden sorguya girmez;
// değerler daima parametre ($1/$2). Tekil `id`si olmayan tabloda envelope varsa `unrotatable` listesine düşer
// (sessiz atlama YOK; bugün her tablonun id'si var — 2026-09-18 sondası).
import { createHash } from "crypto";
import { isEncrypted, rewrapEnvelope } from "./crypto";

export const ENVELOPE_PREFIX = "enc:v1:";
export const BLOB_PREFIX = "blob:v1:";
// Onay ifadesi + env adı istemciye güvenli ayrı modülde (client bileşeni bu dosyayı import ETMEZ).
export { CONFIRM_PHRASE, KEK_ROTATION_SECRET_ENV } from "./kek-rotation-constants";

/** Motorun ihtiyaç duyduğu asgari Prisma yüzeyi (PrismaClient yapısal olarak uyar; testte sahte nesne). */
export interface RawDb {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export type RowClass = "rewrap" | "already" | "foreign" | "blob";

export interface ColumnReport {
  table: string;
  column: string;
  rewrap: number;
  already: number;
  foreign: number;
  blob: number;
  blobRotated: number;
}

export interface RotateKekOptions {
  db: RawDb;
  oldKek: Buffer;
  newKek: Buffer;
  /** false (varsayılan) = dry-run: hiçbir şey yazılmaz. */
  apply?: boolean;
  /** apply ile: blob:v1: belgeleri de döndür (Blob token'ı gerekir). */
  blobs?: boolean;
  /** Date.now() cinsinden mutlak son; aşılınca sayfa sınırında durur (complete=false). */
  deadline?: number;
  /** Test dikişi: yalnız true dönen satırlar işlenir (paylaşılan dev DB'de apply provası için). */
  rowFilter?: (table: string, id: string | number) => boolean;
  /** Test/operasyon dikişi: yalnız bu tablolar taranır. Break-glass ucu KULLANMAZ (kısmi rotasyon = tuzak). */
  tables?: string[];
  log?: (line: string) => void;
}

export interface RotateKekResult {
  mode: "dry-run" | "apply";
  blobs: boolean;
  scanned: { tables: number; columns: number };
  /** Yalnız en az bir envelope/blob satırı olan kolonlar. */
  columns: ColumnReport[];
  totals: { rewrap: number; already: number; foreign: number; blob: number; blobRotated: number };
  /** En fazla 10 örnek: Tablo.kolon#id (değer yok). */
  foreignSamples: string[];
  /** Tekil id'si olmayan tabloda envelope: "Tablo.kolon=n" — rotasyon bitmiş SAYILMAZ. */
  unrotatable: string[];
  complete: boolean;
  durationMs: number;
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Katalogdan gelen tanımlayıcıyı doğrula ve çift tırnakla. Süzgeçten geçmeyen ad sorguya GİRMEZ. */
export function quoteIdent(ident: string): string {
  if (!IDENT.test(ident)) throw new Error(`Geçersiz SQL tanımlayıcısı: ${JSON.stringify(ident)}`);
  return `"${ident}"`;
}

/** Escrow belgesiyle aynı reçete: sha256(base64 dizesi, boşluk/satır sonu kırpılmış) — sır basılmadan kimlik. */
export function kekFingerprint(rawBase64: string): string {
  return createHash("sha256").update(rawBase64.trim()).digest("hex");
}

/** İnsan-okur kısa parmak izi (12 hex) — audit/alarm/arayüz için. */
export function shortFingerprint(rawBase64: string): string {
  return kekFingerprint(rawBase64).slice(0, 12);
}

/** Tek bir değeri sınıflandır (saf; DB yok). */
export function classifyValue(value: string, oldKek: Buffer, newKek: Buffer): { cls: RowClass; next?: string } {
  if (value.startsWith(BLOB_PREFIX)) return { cls: "blob" };
  if (!isEncrypted(value)) throw new Error("classifyValue yalnız envelope/blob değer alır.");
  try {
    return { cls: "rewrap", next: rewrapEnvelope(value, oldKek, newKek) };
  } catch {
    try {
      rewrapEnvelope(value, newKek, newKek); // yeni KEK açabiliyor mu? (no-op rewrap = açılış testi)
      return { cls: "already" };
    } catch {
      return { cls: "foreign" };
    }
  }
}

interface CatalogRow { table_name: string; column_name: string; data_type: string }
interface PageRow { id: string | number; v: string }

/** public şemadaki base tabloların metin kolonları + tabloların tekil `id` tipi. */
export async function discoverTextColumns(db: RawDb): Promise<{
  columns: { table: string; column: string }[];
  idTypes: Map<string, string>;
}> {
  const cols = await db.$queryRawUnsafe<CatalogRow[]>(
    "SELECT c.table_name, c.column_name, c.data_type FROM information_schema.columns c " +
      "JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name " +
      "WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE' " +
      "AND c.data_type IN ('text', 'character varying') AND c.table_name NOT LIKE '\\_prisma%' " +
      "ORDER BY c.table_name, c.ordinal_position",
  );
  const ids = await db.$queryRawUnsafe<CatalogRow[]>(
    "SELECT table_name, column_name, data_type FROM information_schema.columns " +
      "WHERE table_schema = 'public' AND column_name = 'id'",
  );
  const idTypes = new Map(ids.map((r) => [r.table_name, r.data_type]));
  const columns = cols
    .filter((c) => c.column_name !== "id")
    .map((c) => ({ table: c.table_name, column: c.column_name }));
  for (const c of columns) { quoteIdent(c.table); quoteIdent(c.column); } // erken doğrulama — sorgu kurulmadan
  return { columns, idTypes };
}

// Büyük gövdeli kolonlarda (base64 belge) sayfa küçük tutulur — RAM ve tek sorgu süresi.
function batchFor(column: string): number {
  return /content|filedata|fileref|photo|evidence/i.test(column) ? 20 : 300;
}

function pageSql(table: string, column: string, withCursor: boolean, limit: number): string {
  const t = quoteIdent(table), c = quoteIdent(column);
  return (
    `SELECT "id", ${c} AS v FROM ${t} WHERE (${c} LIKE 'enc:v1:%' OR ${c} LIKE 'blob:v1:%')` +
    (withCursor ? ` AND "id" > $1` : "") +
    ` ORDER BY "id" LIMIT ${limit}`
  );
}

function countSql(table: string, column: string): string {
  const t = quoteIdent(table), c = quoteIdent(column);
  return `SELECT count(*)::int AS n FROM ${t} WHERE (${c} LIKE 'enc:v1:%' OR ${c} LIKE 'blob:v1:%')`;
}

function updateSql(table: string, column: string): string {
  return `UPDATE ${quoteIdent(table)} SET ${quoteIdent(column)} = $1 WHERE "id" = $2`;
}

/** blob:v1: belgeyi döndür: indir → sınıflandır → yeni blob → ref güncelle → eskiyi sil. İçerik çözülmez. */
async function rotateBlobRef(
  db: RawDb, table: string, column: string, id: string | number, ref: string,
  oldKek: Buffer, newKek: Buffer, log: (line: string) => void,
): Promise<Exclude<RowClass, "blob">> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN yok — blob rotasyonu bu ortamda yapılamaz.");
  const access: "public" | "private" = process.env.BLOB_ACCESS === "public" ? "public" : "private";
  const url = ref.slice(BLOB_PREFIX.length);
  const where = `${table}.${column}#${id}`;
  const { get, put, del } = await import("@vercel/blob");
  const res = await get(url, { access, token });
  if (!res || !res.stream) throw new Error(`${where}: blob indirilemedi (bulunamadı veya stream yok).`);
  const cipher = await new Response(res.stream).text();
  if (!isEncrypted(cipher)) throw new Error(`${where}: blob içeriği envelope değil — dokunulmadı.`);
  const c = classifyValue(cipher, oldKek, newKek);
  if (c.cls !== "rewrap") return c.cls === "blob" ? "foreign" : c.cls; // already / foreign → dokunma
  const putRes = await put(`rotate/${table}/${String(id)}`, c.next!, {
    access, contentType: "application/octet-stream", addRandomSuffix: true, token,
  });
  await db.$executeRawUnsafe(updateSql(table, column), `${BLOB_PREFIX}${putRes.url}`, id);
  await del(url, { token }).catch(() => log(`  ⚠ ${where}: eski blob silinemedi (ref güncellendi; nesne depoda kaldı)`));
  return "rewrap";
}

/**
 * Şema-güdümlü KEK rotasyonu. Dry-run varsayılan. Hata fırlatırsa (ağ/DB) o ana kadar yazılanlar geçerlidir
 * — yeniden koşmak güvenlidir (already sınıfı).
 */
export async function rotateKek(opts: RotateKekOptions): Promise<RotateKekResult> {
  const start = Date.now();
  const apply = opts.apply === true;
  const blobs = opts.blobs === true;
  const log = opts.log ?? (() => {});
  if (opts.oldKek.length !== 32 || opts.newKek.length !== 32) throw new Error("KEK'ler 32 byte olmalı.");
  if (opts.oldKek.equals(opts.newKek)) throw new Error("Eski ve yeni KEK aynı — rotasyon anlamsız.");
  const pastDeadline = () => opts.deadline !== undefined && Date.now() >= opts.deadline;

  const discovered = await discoverTextColumns(opts.db);
  const allow = opts.tables ? new Set(opts.tables) : null;
  const columns = allow ? discovered.columns.filter((c) => allow.has(c.table)) : discovered.columns;
  const idTypes = discovered.idTypes;
  const tables = new Set(columns.map((c) => c.table));
  const reports: ColumnReport[] = [];
  const totals = { rewrap: 0, already: 0, foreign: 0, blob: 0, blobRotated: 0 };
  const foreignSamples: string[] = [];
  const unrotatable: string[] = [];
  let complete = true;

  for (const { table, column } of columns) {
    if (pastDeadline()) { complete = false; break; }
    if (!idTypes.has(table)) {
      const [{ n }] = await opts.db.$queryRawUnsafe<{ n: number }[]>(countSql(table, column));
      if (n > 0) { unrotatable.push(`${table}.${column}=${n}`); log(`  ⛔ ${table}.${column}: ${n} envelope ama tekil id yok — DOKUNULMADI`); }
      continue;
    }
    const rep: ColumnReport = { table, column, rewrap: 0, already: 0, foreign: 0, blob: 0, blobRotated: 0 };
    const batch = batchFor(column);
    let cursor: string | number | null = null;
    for (;;) {
      const rows: PageRow[] = cursor === null
        ? await opts.db.$queryRawUnsafe<PageRow[]>(pageSql(table, column, false, batch))
        : await opts.db.$queryRawUnsafe<PageRow[]>(pageSql(table, column, true, batch), cursor);
      if (rows.length === 0) break;
      for (const r of rows) {
        if (opts.rowFilter && !opts.rowFilter(table, r.id)) continue;
        const c = classifyValue(r.v, opts.oldKek, opts.newKek);
        rep[c.cls]++;
        if (c.cls === "foreign" && foreignSamples.length < 10) foreignSamples.push(`${table}.${column}#${r.id}`);
        if (apply && c.cls === "rewrap") await opts.db.$executeRawUnsafe(updateSql(table, column), c.next!, r.id);
        if (apply && blobs && c.cls === "blob") {
          const outcome = await rotateBlobRef(opts.db, table, column, r.id, r.v, opts.oldKek, opts.newKek, log);
          if (outcome === "rewrap") rep.blobRotated++;
          else if (outcome === "foreign") { rep.foreign++; if (foreignSamples.length < 10) foreignSamples.push(`${table}.${column}#${r.id} (blob)`); }
        }
      }
      cursor = rows[rows.length - 1].id;
      if (rows.length < batch) break;
      if (pastDeadline()) { complete = false; break; }
    }
    if (rep.rewrap + rep.already + rep.foreign + rep.blob > 0) {
      reports.push(rep);
      totals.rewrap += rep.rewrap; totals.already += rep.already; totals.foreign += rep.foreign;
      totals.blob += rep.blob; totals.blobRotated += rep.blobRotated;
      log(
        `  ${`${table}.${column}`.padEnd(40)} rewrap:${String(rep.rewrap).padStart(5)}  already:${String(rep.already).padStart(4)}  ` +
        `blob:${String(rep.blob).padStart(4)}${apply && blobs ? ` (döndü:${rep.blobRotated})` : ""}  foreign:${String(rep.foreign).padStart(3)}`,
      );
    }
    if (!complete) break;
  }

  return {
    mode: apply ? "apply" : "dry-run",
    blobs,
    scanned: { tables: tables.size, columns: columns.length },
    columns: reports,
    totals,
    foreignSamples,
    unrotatable,
    complete,
    durationMs: Date.now() - start,
  };
}
