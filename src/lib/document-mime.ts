// Belge içerik-tipi güvenliği (2026-08-03 dış denetimi P0) — yükleme + sunum tek kaynaktan.
//
// SORUN: yükleme uçları yalnız `data:` önekine bakıyordu ve `mimeType` istemciden geldiği gibi
// saklanıyordu; indirme ucu da onu `Content-Type` olarak `inline` döndürüyordu. Hasta kendi vakasına
// `data:text/html;base64,...` yükleyip belgeyi açan doktorun oturumunda AYNI ORIGIN'de kod
// çalıştırabiliyordu (depolanmış XSS).
//
// ⚠️ CSP bu saldırıyı DURDURMAZ: `script-src` içinde `'unsafe-inline'` var (Next App Router hydration
// script'i için bilinçli, next.config.ts). `X-Content-Type-Options: nosniff` de kurtarmaz — nosniff
// yalnız tarayıcının TAHMİN etmesini engeller; tip açıkça `text/html` beyan edildiğinde tahmin yoktur.
//
// ÇÖZÜM: istemcinin tip beyanı TAMAMEN YOK SAYILIR. Tip dosyanın kendi imzasından (magic bytes)
// tespit edilir; tanınmayan her şey reddedilir. Böylece "beyan ile içerik uyuşmuyor" diye bir durum
// kalmaz — beyan hiç kullanılmaz.
//
// YENİ BİR DOSYA TİPİ EKLERKEN: `inline: true` vermeden önce "bu tip tarayıcıda script çalıştırabilir
// mi?" diye sor. HTML, SVG ve XML script çalıştırabilir → bu tabloya ASLA `inline: true` ile girmezler
// (hiç girmemeleri gerekir; arayüz zaten kabul etmiyor).

export type DocKind = {
  /** Kanonik MIME — istemciden gelen değil, imzadan TESPİT EDİLEN tip. */
  mime: string;
  /** Tarayıcıda sekmede açılması güvenli mi? (script çalıştıramayan formatlar) */
  inline: boolean;
  /** Kullanıcıya gösterilecek uzantı (indirme adı için). */
  ext: string;
};

type Signature = DocKind & {
  /** Baytların başlangıç konumu (DICOM'da 128 baytlık preamble sonrası). */
  offset: number;
  /** Aranan bayt dizisi; `null` = joker (o bayt kontrol edilmez). */
  bytes: readonly (number | null)[];
};

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

// Sıra ÖNEMLİ: daha spesifik imza (WEBP = RIFF+WEBP) daha genel olandan (yok) önce denenir.
const SIGNATURES: readonly Signature[] = [
  // %PDF-
  { mime: "application/pdf", inline: true, ext: "pdf", offset: 0, bytes: ascii("%PDF-") },
  // JPEG: FF D8 FF
  { mime: "image/jpeg", inline: true, ext: "jpg", offset: 0, bytes: [0xff, 0xd8, 0xff] },
  // PNG: 89 P N G CR LF SUB LF
  { mime: "image/png", inline: true, ext: "png", offset: 0, bytes: [0x89, ...ascii("PNG"), 0x0d, 0x0a, 0x1a, 0x0a] },
  // WEBP: "RIFF" + 4 bayt uzunluk (joker) + "WEBP"
  { mime: "image/webp", inline: true, ext: "webp", offset: 0, bytes: [...ascii("RIFF"), null, null, null, null, ...ascii("WEBP")] },
  // GIF87a / GIF89a — sürüm baytı joker
  { mime: "image/gif", inline: true, ext: "gif", offset: 0, bytes: [...ascii("GIF8"), null, ascii("a")[0]] },
  // DICOM Part 10: 128 bayt preamble + "DICM". Sunum DAİMA indirme (tarayıcı render edemez;
  // görüntüleme ayrı /dicom rotasından, tipi orada sabit kodlu).
  { mime: "application/dicom", inline: false, ext: "dcm", offset: 128, bytes: ascii("DICM") },
  // DOCX (ve tüm OOXML) = ZIP konteyneri: PK\x03\x04. İndirme.
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    inline: false, ext: "docx", offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04],
  },
  // Eski .doc = OLE2 bileşik dosya: D0 CF 11 E0 A1 B1 1A E1. İndirme.
  { mime: "application/msword", inline: false, ext: "doc", offset: 0, bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] },
];

/** İmza eşleşmesi için okunması gereken en fazla bayt (DICOM preamble'ı en uzunu). */
const SNIFF_BYTES = 160;

function matches(buf: Buffer, sig: Signature): boolean {
  if (buf.length < sig.offset + sig.bytes.length) return false;
  return sig.bytes.every((b, i) => b === null || buf[sig.offset + i] === b);
}

/**
 * Bir data URI'nin GERÇEK tipini içeriğinden tespit eder. İstemcinin `data:` başlığındaki tip
 * beyanı OKUNMAZ. Tanınmayan/izinsiz tip → null (çağıran reddeder; fail-closed).
 */
export function detectDocumentKind(dataUri: string): DocKind | null {
  const m = /^data:[^;,]*;base64,([\s\S]*)$/.exec(dataUri);
  if (!m) return null;
  // İmza için baştan birkaç yüz base64 karakteri yeter (4 karakter = 3 bayt).
  const head = m[1].slice(0, Math.ceil((SNIFF_BYTES / 3) * 4) + 4);
  let buf: Buffer;
  try {
    buf = Buffer.from(head, "base64");
  } catch {
    return null;
  }
  const hit = SIGNATURES.find((s) => matches(buf, s));
  return hit ? { mime: hit.mime, inline: hit.inline, ext: hit.ext } : null;
}

/** Kullanıcıya gösterilecek ret mesajı (izin verilen tipler tek yerde yazılı). */
export const DOC_REJECT_MESSAGE =
  "Bu dosya türü kabul edilmiyor. İzin verilen türler: PDF, JPEG, PNG, WEBP, GIF, DICOM (.dcm), Word (.doc/.docx). " +
  "Dosyanın içeriği uzantısıyla uyuşmuyorsa da reddedilir.";

/**
 * SAKLANMIŞ bir belgenin sunum başlıkları. Eski kayıtlarda (denetim öncesi) `mimeType` istemciden
 * gelmiş olabilir → burada da güvenilmez sayılır: tabloda YOKSA `application/octet-stream` +
 * indirme olarak sunulur. Böylece geçmiş kayıtlar veri kaybı olmadan zararsızlaşır.
 */
export function documentResponseHeaders(storedMime: string | null | undefined, fileName: string): HeadersInit {
  const known = SIGNATURES.find((s) => s.mime === storedMime);
  const safeInline = known?.inline === true;
  const contentType = known ? known.mime : "application/octet-stream";
  // filename* (RFC 5987) — Türkçe karakterli etiketler bozulmasın.
  const disposition = `${safeInline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(fileName)}`;
  return {
    "Content-Type": contentType,
    "Content-Disposition": disposition,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}
