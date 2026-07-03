// Sinyalleşme taraf-token'ı (P1: DB-polling yetki maliyetini azalt).
// GET /signal polling'i her istekte callerSide'ı (1-3 DB sorgusu + canCaseBeAccessedBy) yeniden
// çalıştırıyordu. Bu token, callerSide bir kez GERÇEK doğrulandıktan sonra (userId, channelId, side)
// üçlüsünü SESSION_SECRET'lı HMAC ile mühürler → sonraki poll'lar DB'ye dokunmadan doğrulanır.
//
// GÜVENLİK: birincil kimlik zaten oturum çerezidir (getCurrentUser). Bu token yalnız "bu
// doğrulanmış kullanıcı bu kanalda X tarafı olarak saptandı" iddiasını taşır; forge edilemez
// (HMAC), userId'ye bağlıdır (A'nın token'ı B'de geçmez), channelId'ye bağlıdır (kanaldan kanala
// taşınmaz), kısa ömürlüdür (TTL sonrası bir poll full-auth'a düşüp taze token alır). side MAC'e
// dahildir → geçerli bir token'ın tarafı tam olarak sunucunun atadığıdır (taklit yok).
import { createHmac, timingSafeEqual } from "crypto";

export type Side = "patient" | "doctor";
// TTL kısa (60sn): token bir kez verilince o süre boyunca DB-yetki atlanır → görüşme ortasında erişim
// iptali (verified düşmesi / yeniden atama) en fazla ~60sn geç yansır. Eski token-öncesi kod her poll'da
// (≤1.2sn) tam-auth yapıyordu; 60sn iptal penceresi kurumsal telehealth'te kabul edilebilir ve DB
// tasarrufunun ~%97'sini korur (2sn poll'da her ~30 istekte 1'i tam-auth). Ably'ye geçişte konu değişir.
const TTL_MS = 60_000;

function signingKey(): string {
  // SESSION_SECRET üretimde güçlü-zorunlu (session.ts T4 boot hard-fail) → imza anahtarı olarak yeniden kullan.
  return process.env.SESSION_SECRET || "air-mvp-dev-secret";
}

function mac(userId: string, channelId: string, side: Side, exp: number): string {
  return createHmac("sha256", signingKey())
    .update(`sig|${userId}|${channelId}|${side}|${exp}`, "utf8")
    .digest("hex");
}

// Taze token üret: "side.exp.mac" (now = Date.now(), çağıran verir → test edilebilir/deterministik).
export function issueSideToken(userId: string, channelId: string, side: Side, now: number): string {
  const exp = now + TTL_MS;
  return `${side}.${exp}.${mac(userId, channelId, side, exp)}`;
}

// Doğrula: geçerli + userId/channelId eşleşiyor + süresi geçmemiş → side; aksi halde null (full-auth'a düş).
export function verifySideToken(token: string | null | undefined, userId: string, channelId: string, now: number): Side | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [side, expStr, macHex] = parts;
  if (side !== "patient" && side !== "doctor") return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < now) return null;
  const expected = mac(userId, channelId, side, exp);
  let a: Buffer, b: Buffer;
  try {
    a = Buffer.from(expected, "hex");
    b = Buffer.from(macHex, "hex");
  } catch {
    return null;
  }
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return side;
}
