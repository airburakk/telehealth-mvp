// Bağımlılıksız "store" ZIP yazıcı (v6.332, 2026-10-06) — yayın paketi (PNG slaytlar + altyazı) tarayıcıda TEK dosya olarak indirilsin diye.
// PNG zaten sıkışık olduğundan sıkıştırma YOK (yöntem 0 = store): biçim basit, hata yüzeyi küçük, ek paket gerekmez.
// Kapsam bilinçli dar: ZIP32 (≤65535 girdi, dosya başına <4 GiB), düz dosya adları (klasör/şifre/yorum yok), UTF-8 ad bayrağı (bit 11).
// SAF: DOM/Node'a dokunmaz → aynı kod hem tarayıcıda hem birim testte koşar. Kimlik bilgisi/PHI taşımaz (yalnız verilen baytları paketler).

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (IEEE 802.3) — ZIP'in beklediği sağlama toplamı (işaretsiz 32 bit). */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** base64 → bayt (tarayıcı ve Node ≥ 16: `atob`). Geçersiz girdi `atob` hatasıyla fırlar. */
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DOS tarih/saat (ZIP üstbilgisi): 1980–2107, saniye 2'şer. Yerel saat bileşenleri (arşiv yöneticileri yerel saat gösterir). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.min(Math.max(d.getFullYear(), 1980), 2107);
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** Düz ve güvenli dosya adı: boş/çok uzun olamaz; "..", mutlak yol, ters bölü, NUL yasak (açarken yol atlatma yüzeyi bırakmaz). */
function checkName(name: string): void {
  if (!name || name.length > 255) throw new Error("ZIP: dosya adı boş ya da çok uzun.");
  if (name.includes("\\") || name.includes("\u0000") || name.startsWith("/") || name.split("/").includes("..")) throw new Error(`ZIP: güvenli olmayan dosya adı: ${name}`);
}

/** Dosyaları sıkıştırmadan tek ZIP baytlarına paketler. Aynı ad iki kez verilemez; sınır aşımı Error fırlatır. */
export function createZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array<ArrayBuffer> {
  if (entries.length > 0xffff) throw new Error("ZIP: en çok 65535 dosya paketlenebilir.");
  const enc = new TextEncoder();
  const seen = new Set<string>();
  const items = entries.map((e) => {
    checkName(e.name);
    if (seen.has(e.name)) throw new Error(`ZIP: yinelenen dosya adı: ${e.name}`);
    seen.add(e.name);
    if (e.data.length > 0xffffffff) throw new Error("ZIP: dosya 4 GiB'ı aşamaz.");
    return { name: enc.encode(e.name), data: e.data, crc: crc32(e.data) };
  });
  const { time, date } = dosDateTime(now);

  let localSize = 0;
  let centralSize = 0;
  for (const it of items) {
    localSize += 30 + it.name.length + it.data.length;
    centralSize += 46 + it.name.length;
  }
  const total = localSize + centralSize + 22;
  if (total > 0xffffffff) throw new Error("ZIP: paket 4 GiB'ı aşamaz.");

  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  let p = 0;
  const u16 = (n: number) => {
    v.setUint16(p, n, true);
    p += 2;
  };
  const u32 = (n: number) => {
    v.setUint32(p, n, true);
    p += 4;
  };

  const offsets: number[] = [];
  for (const it of items) {
    offsets.push(p);
    u32(0x04034b50); // yerel dosya üstbilgisi
    u16(20); // gereken sürüm
    u16(0x0800); // bayrak: ad UTF-8
    u16(0); // yöntem: store
    u16(time);
    u16(date);
    u32(it.crc);
    u32(it.data.length); // sıkıştırılmış boyut
    u32(it.data.length); // gerçek boyut
    u16(it.name.length);
    u16(0); // ek alan yok
    out.set(it.name, p);
    p += it.name.length;
    out.set(it.data, p);
    p += it.data.length;
  }

  const centralStart = p;
  items.forEach((it, i) => {
    u32(0x02014b50); // merkez dizin kaydı
    u16(20); // yapan sürüm
    u16(20); // gereken sürüm
    u16(0x0800);
    u16(0);
    u16(time);
    u16(date);
    u32(it.crc);
    u32(it.data.length);
    u32(it.data.length);
    u16(it.name.length);
    u16(0); // ek alan
    u16(0); // dosya yorumu
    u16(0); // disk no
    u16(0); // iç öznitelikler
    u32(0); // dış öznitelikler
    u32(offsets[i]); // yerel üstbilgi konumu
    out.set(it.name, p);
    p += it.name.length;
  });

  u32(0x06054b50); // merkez dizin sonu
  u16(0); // bu disk
  u16(0); // merkez dizinin diski
  u16(items.length);
  u16(items.length);
  u32(centralSize);
  u32(centralStart);
  u16(0); // arşiv yorumu yok
  return out;
}
