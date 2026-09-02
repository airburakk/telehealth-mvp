// Değiştirilemez erişim denetimi — klinik veriye erişimin mührü (E2EE Faz 0 "audit" ayağı).
// v2.72 onam deseni birebir (consent.ts): append-only hash-zinciri (prevHash→entryHash) + (test) RFC 3161
// zaman damgası (timestamp.ts). "Kim, ne zaman, hangi kaydı okudu/yazdı/dışa aktardı" bağımsız doğrulanabilir
// + sonradan silinmediği/değiştirilmediği gösterilebilir.
//
// recordAccess FAIL-SAFE: audit yazımı patlasa bile ÇAĞIRAN isteği bozmaz (notify.ts deseni) — denetim
// kaydı uygulama işlevinin önüne geçmemeli. Yüksek-frekanslı mekanik olaylar (signal polling, i18n) kasıtlı
// olarak audit edilmez (flood önleme) — yalnız anlamlı klinik erişim mühürlenir.
import { db } from "./db";
import {
  sha256, getTimestampToken, verifyTimestampToken, chainSeal, verifyChainSeal, isV2Seal,
} from "./timestamp";
import { sendAlert } from "./alerts";
import type { SessionUser } from "./session";

export type AuditAction =
  | "CASE_VIEW"
  | "CONSULT_WRITE"
  | "CONSULT_END"
  | "FHIR_EXPORT"
  | "DOCUMENT_VIEW"
  | "CODING_WRITE" // FHIR klinik kodlama (ICD-10 + hasta kimliği) yazıldı
  | "LABS_WRITE" // laboratuvar sonuçları (LOINC) yazıldı
  | "DOCUMENT_ANALYZE" // yüklenen belgeler AI ile değerlendirildi/çevrildi (dış AI'ya gider)
  | "DISCHARGE_GENERATE" // epikriz/taburcu raporu AI ile üretildi (tüm yolculuk dış AI'ya gider)
  | "RECOVERY_COMPLETE" // post-op takip tamamlandı → klinik personel erişimi kapandı, hasta-only (E2EE Faz 2A)
  | "RECOVERY_REOPEN" // post-op takip hasta tarafından yeniden açıldı → klinik personel erişimi geri verildi (geri-alma, E2EE Faz 2A)
  | "POSTOP_ACCESS_DENIED" // post-op kapandıktan sonra klinik personel erişim denemesi reddedildi (daraltma kanıtı)
  | "IMPERSONATE_START" // MASTER bir kullanıcıya büründü (actor=master, subject=hedef kullanıcı)
  | "IMPERSONATE_END" // MASTER bürünmeyi bitirdi (kendi kimliğine döndü)
  | "ACCOUNT_DELETE" // hasta hesabını sildi → kişisel veri silindi, klinik kayıt kilitlendi + imha tarihi damgalandı (v6.11)
  | "DELETION_ACCESS_DENIED" // hesap-silme kilidindeki kayda erişim denemesi reddedildi (kilit kanıtı)
  | "RECORD_PURGE" // saklama süresi doldu → klinik kayıt fiziken imha edildi (cron; v6.11)
  | "DEFENSE_REQUEST" // etik kurul karşı taraftan savunma/bilgi talep etti (detail: respondentType; içerik YOK — v6.79)
  | "DEFENSE_REPLY" // karşı taraf savunma talebine yanıt verdi (yanıt içeriği audit'e YAZILMAZ — v6.79)
  // ── Hesap güvenliği (v6.187 — Doctorium "Hesabım") ────────────────────────────────────────
  // LOGIN, "Giriş etkinliği" listesinin TEK kaynağıdır: oturumlar JWT'de yaşıyor (DB'de Session
  // tablosu yok, iptal tek sayaçla — lib/auth sessionVersion), dolayısıyla "şu an açık oturumlar"
  // ÜRETİLEMEZ. Kullanıcıya gösterilen şey açık oturum değil GİRİŞ KAYDIDIR; arayüz de bunu
  // aynen böyle söyler. detail = giriş yöntemi (parola | google | apple).
  | "LOGIN"
  | "PASSWORD_CHANGE" // parola değiştirildi/belirlendi → tüm oturumlar düşürüldü (parola audit'e YAZILMAZ)
  | "DOCTORIUM_LEAVE" // Aşama 2 doktoru Doctorium üyeliğinden çıktı — hesap açık kaldı, katman silindi
  | "DOCTORIUM_ACCOUNT_CLOSE" // yalnız-Doctorium üyesi hesabını kapattı → hesap + üyelik verisi silindi
  | "PASSWORD_RESET"; // parola e-posta bağlantısıyla sıfırlandı — oturum AÇILMAZ, tüm oturumlar düşer

interface RecordInput {
  actor: SessionUser | null;
  action: AuditAction | string;
  resourceType: string;
  resourceId: string;
  subjectUserId: string | null;
  detail?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

// İstek başlıklarından IP + cihaz (audit için minimum bağlam).
export function reqMeta(req: Request): { ip: string | null; userAgent: string | null } {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  return { ip, userAgent: req.headers.get("user-agent") };
}

// ── Mühür şeması (sürümlü) ────────────────────────────────────────────────────────────────────────
// v1 (tarihî): anahtarsız sha256, dar alan kümesi (detail/ip/actorRole/userAgent HARİÇ), pipe-join.
// v2 (P1 #8): TSA_SECRET'lı HMAC (timestamp.chainSeal, "v2:<kid>:<mac>"), TÜM metadata alanları
//   kapsanır, kanonik JSON (serbest-metin `detail` ayraç enjeksiyonuna kapalı). Şema değişikliği YOK —
//   sürüm, değerin önekinden anlaşılır (enc:v1: deseni).
//
// TEHDİT MODELİ (dürüst sınırlar — adversarial inceleme sonrası):
// • Kısmi tamper (v2 çağında bir satırı değiştir/sil/araya ekle): sonraki TÜM satırların mühürleri
//   anahtarsız yeniden üretilemez → verifyAccessChain yakalar. ✅
// • Downgrade (v2 satırı anahtarsız v1 mührüyle değiştirme): zincir YÜRÜYÜŞ-SIRASI kuralıyla yakalanır —
//   zincirde bir v2 görüldükten sonra v1 mühür = bozuk. (Zaman-pini KULLANILMAZ: createdAt saldırgan
//   kontrolünde olduğundan zaman-tabanlı cutover hem aşılabilirdi hem deploy sarkarsa yanlış alarm üretirdi.) ✅
// • TÜM zinciri baştan v1 (anahtarsız) yeniden yazma: bu şemayla KANITLANAMAZ (tarihî v1 satırlar
//   anahtarsız doğrulanabilir kalmak zorunda) → savunma: v1/v2 kompozisyon sayaçları denetçiye raporlanır
//   (v2 canlıya alındıktan sonra v2Count=0 = anomali); kesin çözüm = harici çapa/gerçek RFC 3161 (park).
// • Zincirin UCUNDAN kesme (son N satırı silme): iç veriyle tespit edilemez (harici çapa gerekir) —
//   denetçi UI iddiası buna göre yumuşatıldı.
const AUDIT_SEAL_DOMAIN = "audit-entry";

interface SealFields {
  actorId: string | null;
  actorRole: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  subjectUserId: string | null;
  detail: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  prevHash: string;
}

// v2 kanoniği: alan sırası SABİT, JSON dizisi (null'lar korunur → alan kayması/enjeksiyon imkânsız).
function v2Canonical(f: SealFields): string {
  return JSON.stringify([
    f.actorId, f.actorRole, f.action, f.resourceType, f.resourceId, f.subjectUserId,
    f.detail, f.ip, f.userAgent, f.createdAt.toISOString(), f.prevHash,
  ]);
}

function sealEntryV2(f: SealFields): string {
  return chainSeal(AUDIT_SEAL_DOMAIN, v2Canonical(f));
}

// v1 mührü (yalnız TARİHÎ satırların doğrulanması için — yeni yazım daima v2).
function computeLegacyEntryHash(f: {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  subjectUserId: string | null;
  createdAt: Date;
  prevHash: string;
}): string {
  return sha256(
    [
      f.actorId ?? "",
      f.action,
      f.resourceType,
      f.resourceId,
      f.subjectUserId ?? "",
      f.createdAt.toISOString(),
      f.prevHash,
    ].join("|"),
  );
}

// Tek satır mühür kararı: true/false = kesin; null = mühürsüz VEYA başka ortamın anahtarı (unknown-key).
// v1 satırlar burada yalnız legacy formülle denetlenir (satır-yerel bakışta yazım zamanı bilinemez);
// downgrade tespiti zincir yürüyüşünün işidir (verifyAccessChain — v2'den sonra v1 = bozuk).
function sealVerdict(r: VerifiableRow): boolean | null {
  if (!r.entryHash || !r.prevHash) return null;
  if (isV2Seal(r.entryHash)) {
    const check = verifyChainSeal(AUDIT_SEAL_DOMAIN, v2Canonical({
      actorId: r.actorId, actorRole: r.actorRole, action: r.action, resourceType: r.resourceType,
      resourceId: r.resourceId, subjectUserId: r.subjectUserId, detail: r.detail, ip: r.ip,
      userAgent: r.userAgent, createdAt: r.createdAt, prevHash: r.prevHash,
    }), r.entryHash);
    return check === "valid" ? true : check === "broken" ? false : null; // unknown-key → null
  }
  return computeLegacyEntryHash({
    actorId: r.actorId, action: r.action, resourceType: r.resourceType, resourceId: r.resourceId,
    subjectUserId: r.subjectUserId, createdAt: r.createdAt, prevHash: r.prevHash,
  }) === r.entryHash;
}

// Küresel advisory-lock anahtarı (sabit, 2×int4) — TÜM audit append'lerini tek küresel sıraya dizer.
const CHAIN_LOCK_A = 0x4155; // 'AU'
const CHAIN_LOCK_B = 0x4454; // 'DT'

// Bir erişimi mühürleyip kaydet. FAIL-SAFE — hata olursa yutulur (asıl istek etkilenmez).
// Zincir: global (GENESIS→…); ucu = en güncel mühürlü kayıt.
//
// ÜRETİM SERIALIZATION (inc.2): append, küresel bir advisory **xact**-lock altında tek bir transaction'da
// yapılır → eşzamanlı yazımlar sıraya girer, zincir ÇATALLANMAZ. xact-lock işlem sonunda otomatik bırakılır
// (transaction-pooling/Neon-PgBouncer güvenli; session-lock sızabilirdi). Çok-örnekli Vercel serverless'te
// in-process mutex yetmez (örnekler arası çatal) → kilit DB seviyesinde olmalı.
//
// TSA MİMARİSİ (2026-09-02 — output/tsa-saglayici-karsilastirma-2026-08-19.md §0): satır başına
// zaman damgası YOK — 42 çağrı noktasının her biri gerçek TSA'ya bağlandığında ağ gecikmesi + kontör
// maliyeti doğururdu. Hash-zinciri (prevHash→entryHash, asıl kurcalama koruması) DEĞİŞMEDİ; damga artık
// günde 1 kez zincirin ucuna atılır (sealDailyChainAnchor, cron). Bir noktanın damgalanması hash-zinciri
// gereği ONDAN ÖNCEKİ tüm satırların da o tarihte var olduğunu ispatlar — Merkle-tarzı toplu damga.
export async function recordAccess(input: RecordInput): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHAIN_LOCK_A}::int4, ${CHAIN_LOCK_B}::int4)`;
      // createdAt KİLİT İÇİNDE alınır → insert sırası = createdAt sırası; verify (asc) ile tip (desc) tutarlı,
      // çatal yok. (Aynı-ms artığı id ile çözülür; kilit+RTT döngüsü ms'i pratikte ayırır.)
      const createdAt = new Date();
      const tip = await tx.accessLog.findFirst({
        where: { entryHash: { not: null } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { entryHash: true },
      });
      const prevHash = tip?.entryHash ?? "GENESIS";
      const entryHash = sealEntryV2({
        actorId: input.actor?.id ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        subjectUserId: input.subjectUserId,
        detail: input.detail ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
        createdAt,
        prevHash,
      });
      await tx.accessLog.create({
        data: {
          actorId: input.actor?.id ?? null,
          actorRole: input.actor?.role ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          subjectUserId: input.subjectUserId,
          detail: input.detail ?? null,
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
          createdAt,
          prevHash,
          entryHash,
          // tsAuthority/tsTime/tsToken bilerek NULL: bu satır günlük anchor tarafından kapsanacak
          // (verifyRow — kendi damgası olmayan satırlar kapsayan AuditChainAnchor'a bakar).
        },
      });
    });
  } catch (e) {
    // FAIL-SAFE: audit asla çağıran isteği bozmaz (üretimde gözlemlenebilirlik için log'lanır).
    // Ama sessiz de kalmaz (Ray C): yazım saatlerce düşerse zincirde denetlenmemiş erişim boşluğu
    // birikir → alarm (cooldown'lu; davranış değişmez, istek yine bozulmaz).
    console.error("[audit] recordAccess başarısız (yutuldu):", e);
    void sendAlert(
      "audit-write",
      "Audit kaydı yazılamadı (istek bozulmadı ama zincirde boşluk birikiyor)",
      `action=${input.action} — ${e instanceof Error ? e.message.slice(0, 200) : String(e).slice(0, 200)}`,
    );
  }
}

// ── Günlük kök damgası (TSA mimarisi — bkz. recordAccess yorumu) ────────────────────────────────────
export interface DailyAnchorResult {
  sealed: boolean;
  day: string | null; // "YYYY-MM-DD" (UTC)
  entryCount: number;
  reason?: string; // sealed:false ise (ör. zincir henüz boş)
}

// Zincirin GÜNCEL ucunu bugünün damgasıyla mühürler. Cron'dan (purge-deleted — imha/bütünlük cron'u, 06:30 TR)
// günde 1 kez çağrılır; upsert olduğu için aynı gün içinde tekrar çağrılırsa en güncel ucu yakalar
// (idempotent — ikinci koşum ilkini bozmaz, yalnız günceller).
export async function sealDailyChainAnchor(): Promise<DailyAnchorResult> {
  const tip = await db.accessLog.findFirst({
    where: { entryHash: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { entryHash: true, createdAt: true, id: true },
  });
  if (!tip?.entryHash) {
    return { sealed: false, day: null, entryCount: 0, reason: "zincirde mühürlü satır yok" };
  }
  const entryCount = await db.accessLog.count({ where: { entryHash: { not: null } } });
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ts = getTimestampToken(tip.entryHash);
  await db.auditChainAnchor.upsert({
    where: { day },
    create: {
      day, lastEntryHash: tip.entryHash, throughCreatedAt: tip.createdAt, throughLogId: tip.id,
      entryCount, tsAuthority: ts.authority, tsTime: ts.time, tsToken: ts.token,
    },
    update: {
      lastEntryHash: tip.entryHash, throughCreatedAt: tip.createdAt, throughLogId: tip.id,
      entryCount, tsAuthority: ts.authority, tsTime: ts.time, tsToken: ts.token,
    },
  });
  return { sealed: true, day: day.toISOString().slice(0, 10), entryCount };
}

type ChainAnchorLite = {
  lastEntryHash: string; throughCreatedAt: Date; throughLogId: string;
  tsAuthority: string; tsTime: Date; tsToken: string;
};

// Anchor listesi throughCreatedAt ARTAN sıralı gelmeli — ilk eşleşen = bu satırı kapsayan EN ERKEN anchor.
async function listAnchorsAsc(): Promise<ChainAnchorLite[]> {
  return db.auditChainAnchor.findMany({
    orderBy: { throughCreatedAt: "asc" },
    select: { lastEntryHash: true, throughCreatedAt: true, throughLogId: true, tsAuthority: true, tsTime: true, tsToken: true },
  });
}

function findCoveringAnchor(row: { createdAt: Date; id: string }, anchors: ChainAnchorLite[]): ChainAnchorLite | null {
  for (const a of anchors) {
    const covers =
      a.throughCreatedAt.getTime() > row.createdAt.getTime() ||
      (a.throughCreatedAt.getTime() === row.createdAt.getTime() && a.throughLogId >= row.id);
    if (covers) return a;
  }
  return null; // henüz hiçbir anchor bu satırı kapsamıyor (bugünün cron'u henüz koşmadı)
}

export interface AccessLogEntry {
  id: string;
  actorRole: string | null;
  actorIsYou: boolean; // erişen, kaydı görüntüleyen kullanıcının kendisi mi
  action: string;
  resourceType: string;
  resourceId: string;
  detail: string | null;
  createdAt: string;
  tsAuthority: string | null;
  tsTime: string | null;
  verification: { entryHashValid: boolean | null; timestampValid: boolean | null };
}

// Tek bir kaydın doğrulaması: mührü alanlarından yeniden hesaplanan + zaman damgası geçerli mi?
// (getAccessLog hasta-yüzü + getChainAudit denetçi-yüzü paylaşır.)
// entryHashValid: true/false kesin karar; null = mühürsüz eski kayıt VEYA başka ortamın anahtarı.
//
// Zaman damgası İKİ kademeli (geriye-uyumlu köprü, v1/v2 mühür geçişiyle aynı desen): satırın KENDİ
// tsTime/tsToken'ı varsa (TSA mimarisi öncesi yazılmış eski satır) o kullanılır; yoksa (yeni satır)
// kapsayan günlük AuditChainAnchor'a bakılır — henüz hiçbir anchor kapsamıyorsa null (bugünün cron'u
// henüz koşmadı; "damgasız" değil "henüz damgalanmadı" — UI'da gri/karar verilemez).
type VerifiableRow = {
  actorId: string | null; actorRole: string | null; action: string; resourceType: string;
  resourceId: string; subjectUserId: string | null; detail: string | null; ip: string | null;
  userAgent: string | null; createdAt: Date; prevHash: string | null; entryHash: string | null;
  id: string; tsTime: Date | null; tsToken: string | null;
};
function verifyRow(
  r: VerifiableRow,
  anchors: ChainAnchorLite[],
): { entryHashValid: boolean | null; timestampValid: boolean | null; displayTsAuthority: string | null; displayTsTime: Date | null } {
  const entryHashValid = sealVerdict(r);
  if (!r.entryHash) {
    return { entryHashValid, timestampValid: null, displayTsAuthority: null, displayTsTime: null };
  }
  if (r.tsTime && r.tsToken) {
    return {
      entryHashValid,
      timestampValid: verifyTimestampToken(r.entryHash, r.tsTime, r.tsToken),
      displayTsAuthority: null, // çağıran zaten satırın kendi tsAuthority'sini biliyor
      displayTsTime: r.tsTime,
    };
  }
  const anchor = findCoveringAnchor(r, anchors);
  const timestampValid = anchor ? verifyTimestampToken(anchor.lastEntryHash, anchor.tsTime, anchor.tsToken) : null;
  return {
    entryHashValid, timestampValid,
    displayTsAuthority: anchor?.tsAuthority ?? null,
    displayTsTime: anchor?.tsTime ?? null,
  };
}

// Bir veri-sahibi hastanın erişim kaydı — "verime kim, ne zaman, neye erişti" + giriş-başına doğrulama.
export async function getAccessLog(subjectUserId: string, viewerId?: string): Promise<AccessLogEntry[]> {
  const [rows, anchors] = await Promise.all([
    db.accessLog.findMany({
      where: { subjectUserId },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    listAnchorsAsc(),
  ]);
  return rows.map((r) => {
    const v = verifyRow(r, anchors);
    return {
      id: r.id,
      actorRole: r.actorRole,
      actorIsYou: !!viewerId && r.actorId === viewerId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      detail: r.detail,
      createdAt: r.createdAt.toISOString(),
      tsAuthority: r.tsAuthority ?? v.displayTsAuthority,
      tsTime: r.tsTime?.toISOString() ?? v.displayTsTime?.toISOString() ?? null,
      verification: { entryHashValid: v.entryHashValid, timestampValid: v.timestampValid },
    };
  });
}

// Global zincir bütünlüğü (denetçi) — her kaydın mührü + prevHash bağı tutuyor mu (silme/araya-ekleme tespiti).
// (createdAt+id ile total-order; ardışık yazımda insert sırasını yeniden kurar. Çatallanma = brokenAt.)
// Karma zincir: v1 satırlar legacy formülle, v2 satırlar HMAC'le doğrulanır; zincirde bir v2 görüldükten
// sonra v1 mühür = DOWNGRADE = bozuk (yürüyüş-sırası kuralı — zaman-pini değil).
// Sayaçlar (denetçiye görünürlük — sessiz geçilmez):
// • unverifiableSeals: başka ortamın anahtarıyla mühürlü v2 satır (dev branch'te yerel↔CI karışımı
//   NORMALDİR; ÜRETİMDE > 0 = ŞÜPHELİ — prod tek güçlü anahtarla yazar → araştır).
// • v1Count/v2Count: kompozisyon — v2 canlıya alındıktan sonra v2Count=0 görünüyorsa zincir baştan
//   v1'e yeniden yazılmış olabilir (tam-yeniden-yazım bu şemayla kanıtlanamaz; anomaliyi insan okur).
// • unsealedCount: entryHash'siz tarihî satır sayısı (zincir kapsamı DIŞINDA — mühürsüz satır bağ taşımaz).
export interface ChainIntegrity {
  ok: boolean;
  count: number;
  brokenAt: string | null;
  unverifiableSeals: number;
  v1Count: number;
  v2Count: number;
  unsealedCount: number;
  lastAnchorAt: string | null; // en son günlük kök damgasının TSA zamanı (ISO) — null = henüz hiç anchor yok
}
export async function verifyAccessChain(): Promise<ChainIntegrity> {
  const [rows, unsealedCount, lastAnchor] = await Promise.all([
    db.accessLog.findMany({
      where: { entryHash: { not: null } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    db.accessLog.count({ where: { entryHash: null } }),
    db.auditChainAnchor.findFirst({ orderBy: { throughCreatedAt: "desc" }, select: { tsTime: true } }),
  ]);
  const lastAnchorAt = lastAnchor?.tsTime.toISOString() ?? null;
  let prev = "GENESIS";
  let unverifiableSeals = 0;
  let v1Count = 0;
  let v2Count = 0;
  let sawV2 = false;
  // Kırık zincir = kurcalama/veri kaybı şüphesi → alarm (Ray C — purge-deleted cron'u günlük nöbette koşturur).
  const fail = (id: string) => {
    void sendAlert("audit-chain", "Audit zinciri bütünlük doğrulaması BAŞARISIZ", `brokenAt=${id}`);
    return { ok: false, count: rows.length, brokenAt: id, unverifiableSeals, v1Count, v2Count, unsealedCount, lastAnchorAt };
  };
  for (const r of rows) {
    if (r.prevHash !== prev) return fail(r.id);
    if (isV2Seal(r.entryHash)) {
      v2Count++;
      sawV2 = true;
    } else {
      v1Count++;
      if (sawV2) return fail(r.id); // downgrade: v2 çağından sonra anahtarsız v1 mühür
    }
    const verdict = sealVerdict({ ...r, prevHash: prev });
    if (verdict === false) return fail(r.id);
    if (verdict === null) unverifiableSeals++; // unknown-key: bağ denetlendi, mühür bu ortamda doğrulanamadı
    prev = r.entryHash!;
  }
  return { ok: true, count: rows.length, brokenAt: null, unverifiableSeals, v1Count, v2Count, unsealedCount, lastAnchorAt };
}

// Denetçi (ADMIN / Etik Kurul) görünümü için tek bir kayıt — küresel zincirin metadata'sı (klinik içerik YOK).
export interface ChainEntry {
  id: string;
  createdAt: string;
  actorRole: string | null;
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  subjectUserId: string | null;
  detail: string | null;
  ip: string | null;
  prevHash: string | null;
  entryHash: string | null;
  tsAuthority: string | null;
  tsTime: string | null;
  verification: { entryHashValid: boolean | null; timestampValid: boolean | null };
}

// Denetçi tablosunda sayfa başına kayıt (offset-tabanlı sayfalama varsayılanı).
export const AUDIT_PAGE_SIZE = 50;

// Denetçi tam-zincir görünümü: KÜRESEL bütünlük (tüm zinciri tarar → silme/araya-ekleme/çatal tespiti)
// + istenen sayfanın (en güncelden eskiye) metadata'sı. Klinik içerik DÖNDÜRMEZ (yalnız kim/ne-zaman/hangi-kayıt).
//
// SAYFALAMA (offset/skip): bütünlük taraması sayfadan BAĞIMSIZ tüm zinciri kapsar (her görünümde tam doğrulama);
// sayfalama yalnız metadata tablosunun görünür dilimini sınırlar → 200+ kayıtta da denetçi tüm zinciri gezebilir.
// Yüksek-frekanslı olaylar audit edilmediğinden (flood önleme) toplam kayıt sayısı yönetilebilir → offset uygun.
export async function getChainAudit(opts: { page?: number; pageSize?: number } = {}): Promise<{
  integrity: ChainIntegrity;
  entries: ChainEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const pageSize = Math.max(1, Math.floor(opts.pageSize ?? AUDIT_PAGE_SIZE));
  const integrity = await verifyAccessChain();
  const total = await db.accessLog.count();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // İstenen sayfayı geçerli aralığa sıkıştır (0/negatif/NaN/aşırı-büyük güvenli → her zaman dolu veya son sayfa).
  const page = Math.min(Math.max(1, Math.floor(opts.page || 1)), totalPages);
  const [rows, anchors] = await Promise.all([
    db.accessLog.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    listAnchorsAsc(),
  ]);
  const entries: ChainEntry[] = rows.map((r) => {
    const v = verifyRow(r, anchors);
    return {
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      actorRole: r.actorRole,
      actorId: r.actorId,
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      subjectUserId: r.subjectUserId,
      detail: r.detail,
      ip: r.ip,
      prevHash: r.prevHash,
      entryHash: r.entryHash,
      tsAuthority: r.tsAuthority ?? v.displayTsAuthority,
      tsTime: r.tsTime?.toISOString() ?? v.displayTsTime?.toISOString() ?? null,
      verification: { entryHashValid: v.entryHashValid, timestampValid: v.timestampValid },
    };
  });
  return { integrity, entries, total, page, pageSize, totalPages };
}
