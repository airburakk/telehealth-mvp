// Belge object storage soyutlaması (T11 — base64-in-DB yerine harici depo).
//
// SORUN: PHI belgeleri (diploma, lab, radyoloji, SO ekleri) base64 data URI olarak Postgres
// satırlarında saklanıyordu → satır şişmesi, sorgu maliyeti, Neon boyut baskısı.
//
// ÇÖZÜM: Bytes object storage'a (Vercel Blob) taşınır; DB kolonunda yalnız opak bir REF kalır.
//   - Ref biçimi:  "blob:v1:<url>"  (blob aktifken)  ·  eski/inline satır:  "enc:v1:..." / "data:..."
//   - ŞEMA DEĞİŞMEZ: ref mevcut string kolonuna (content/fileData/fileRef) yazılır; loadDocument her
//     iki biçimi de tanır → geriye dönük tam uyum, prod migration GEREKMEZ.
//   - PHI GÜVENLİĞİ: bytes upload ÖNCESİ encryptField ile şifrelenir → Blob yalnız ciphertext tutar
//     (Blob URL'i tahmin-edilemez rastgele sonekli + asla istemciye sızdırılmaz, auth'lu rota proxy'ler).
//     E2EE Faz 1 at-rest garantisi korunur ([[hasta-verisi-uctan-uca-sifreleme]] §6.1).
//   - FALLBACK: BLOB_READ_WRITE_TOKEN yoksa eski davranış (şifreli/düz string DB'de) → sıfır regresyon.
//
// 🔌 SAĞLAYICI SWAP NOKTASI: yalnız put/del çağrıları (Vercel Blob) S3/R2 ile değiştirilir; ref biçimi
// ve şifreleme aynı kalır. Soyutlama sayesinde rota kodu sağlayıcıdan habersizdir.
import { encryptField, decryptField } from "./crypto";
import { randomUUID } from "crypto";

const BLOB_PREFIX = "blob:v1:";

// Blob erişim modeli — PHI için VARSAYILAN "private" (blob herkese açık DEĞİL, okuma token ister =
// defense-in-depth + ciphertext). Store public yapılandırıldıysa BLOB_ACCESS="public" ile geç.
const BLOB_ACCESS: "public" | "private" = process.env.BLOB_ACCESS === "public" ? "public" : "private";

/** Object storage (Vercel Blob) aktif mi? (env token'ı var mı?) */
export function blobStorageEnabled(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Verilen ref harici object storage'a mı işaret ediyor (yoksa inline/eski satır mı)? */
export function isBlobRef(ref: string | null | undefined): boolean {
  return typeof ref === "string" && ref.startsWith(BLOB_PREFIX);
}

/**
 * Bir belge data URI'sini sakla → DB kolonuna yazılacak opak ref döner.
 *  - Blob aktif: (encrypt ise) şifrele → ciphertext'i Blob'a yükle → "blob:v1:<url>"
 *  - Blob yok (fallback): eski davranış — encrypt ? encryptField(dataUri) : dataUri (inline DB)
 * encrypt varsayılan true (4 belge modelinin tümü at-rest şifreliydi).
 */
export async function storeDocument(
  dataUri: string | null | undefined,
  opts: { encrypt?: boolean; keyPrefix?: string } = {},
): Promise<string | null> {
  if (dataUri == null) return null;
  const encrypt = opts.encrypt ?? true;
  const payload = encrypt ? (encryptField(dataUri) as string) : dataUri;

  if (!blobStorageEnabled()) return payload; // fallback: inline (bugünkü davranış)

  const { put } = await import("@vercel/blob");
  const key = `${opts.keyPrefix ?? "doc"}/${randomUUID()}`;
  const res = await put(key, payload, {
    access: BLOB_ACCESS, // private (varsayılan): blob token'sız okunamaz + içerik zaten ciphertext
    contentType: "application/octet-stream",
    addRandomSuffix: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  return `${BLOB_PREFIX}${res.url}`;
}

/**
 * Bir ref'ten belge data URI'sini geri yükle (storeDocument'in tersi).
 *  - "blob:v1:<url>" → Blob'tan ciphertext indir → (decrypt ise) çöz → data URI
 *  - inline (eski/fallback) → (decrypt ise) decryptField; düz satır no-op (kademeli geçiş)
 */
export async function loadDocument(
  ref: string | null | undefined,
  opts: { encrypt?: boolean } = {},
): Promise<string | null> {
  if (ref == null) return null;
  const decrypt = opts.encrypt ?? true;

  if (isBlobRef(ref)) {
    const url = ref.slice(BLOB_PREFIX.length);
    // Private store: düz fetch token'sız 403 verir → SDK get() ile token'lı indir (public store'da da çalışır).
    const { get } = await import("@vercel/blob");
    const res = await get(url, { access: BLOB_ACCESS, token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!res || !res.stream) throw new Error("Belge Blob'tan okunamadı (bulunamadı veya stream yok).");
    const payload = await new Response(res.stream).text();
    return decrypt ? decryptField(payload) : payload;
  }
  // inline: enc:v1: → çözülür; düz "data:" → decryptField no-op döner
  return decrypt ? decryptField(ref) : ref;
}

/**
 * Bir belge ref'ini sil. Blob ise harici nesneyi kaldırır (best-effort — hata akışı bozmaz);
 * inline ise no-op (DB satırı silinince veri gider). Yetim Blob = kabul edilebilir küçük maliyet.
 */
export async function deleteDocument(ref: string | null | undefined): Promise<void> {
  if (!isBlobRef(ref)) return;
  try {
    const { del } = await import("@vercel/blob");
    await del((ref as string).slice(BLOB_PREFIX.length), { token: process.env.BLOB_READ_WRITE_TOKEN });
  } catch (e) {
    console.warn("[storage] Blob silme hatası (yetim nesne kalabilir):", e instanceof Error ? e.message : e);
  }
}
