// Bağımsız ZIP yazıcı (lib/zip-store) sözleşmeleri (v6.332, 2026-10-06): CRC-32 bilinen vektörler · yazıcının KENDİ mantığına güvenmeyen asgari
// okuyucuyla gidiş-dönüş (merkez dizin → yerel üstbilgi → veri) · UTF-8 ad bayrağı · DOS tarih/saat · güvenli ad kuralları · sınır/hata yolları.
// Gerçek bir arşiv yöneticisiyle (Expand-Archive) elle doğrulama ayrıca yapılır; bu dosya biçim kuralını kilitler.
import { describe, expect, it } from "vitest";
import { base64ToBytes, createZip, crc32 } from "@/lib/zip-store";

const enc = new TextEncoder();
const dec = new TextDecoder();

interface ReadEntry {
  name: string;
  flags: number;
  method: number;
  time: number;
  date: number;
  crc: number;
  csize: number;
  usize: number;
  data: Uint8Array;
}

/** Test için asgari ZIP okuyucu: merkez dizinden girdileri sayar, her girdinin yerel üstbilgisini ve verisini çapraz doğrular. */
function readZip(zip: Uint8Array): ReadEntry[] {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
  const eocd = zip.length - 22;
  expect(v.getUint32(eocd, true)).toBe(0x06054b50);
  const count = v.getUint16(eocd + 10, true);
  expect(v.getUint16(eocd + 8, true)).toBe(count);
  const cdSize = v.getUint32(eocd + 12, true);
  const cdOff = v.getUint32(eocd + 16, true);
  expect(cdOff + cdSize).toBe(eocd);
  const out: ReadEntry[] = [];
  let p = cdOff;
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(p, true)).toBe(0x02014b50);
    const nlen = v.getUint16(p + 28, true);
    const lho = v.getUint32(p + 42, true);
    const e: ReadEntry = {
      name: dec.decode(zip.subarray(p + 46, p + 46 + nlen)),
      flags: v.getUint16(p + 8, true),
      method: v.getUint16(p + 10, true),
      time: v.getUint16(p + 12, true),
      date: v.getUint16(p + 14, true),
      crc: v.getUint32(p + 16, true),
      csize: v.getUint32(p + 20, true),
      usize: v.getUint32(p + 24, true),
      data: new Uint8Array(0),
    };
    // yerel üstbilgi merkez kaydıyla TUTARLI olmalı
    expect(v.getUint32(lho, true)).toBe(0x04034b50);
    expect(v.getUint16(lho + 6, true)).toBe(e.flags);
    expect(v.getUint32(lho + 14, true)).toBe(e.crc);
    expect(v.getUint32(lho + 18, true)).toBe(e.csize);
    expect(v.getUint32(lho + 22, true)).toBe(e.usize);
    const lnlen = v.getUint16(lho + 26, true);
    expect(dec.decode(zip.subarray(lho + 30, lho + 30 + lnlen))).toBe(e.name);
    const dataStart = lho + 30 + lnlen + v.getUint16(lho + 28, true);
    e.data = zip.slice(dataStart, dataStart + e.usize);
    out.push(e);
    p += 46 + nlen + v.getUint16(p + 30, true) + v.getUint16(p + 32, true);
  }
  expect(p).toBe(eocd); // merkez dizin tam tüketildi
  return out;
}

describe("crc32", () => {
  it("bilinen vektörler (IEEE 802.3)", () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
    expect(crc32(enc.encode("123456789"))).toBe(0xcbf43926);
    expect(crc32(enc.encode("The quick brown fox jumps over the lazy dog"))).toBe(0x414fa339);
  });
  it("işaretsiz 32 bit döner (en yüksek bit 1 olan sonuç negatif ÇIKMAZ)", () => {
    for (const s of ["a", "abc", "özet", "\u0000ÿ"]) {
      const c = crc32(enc.encode(s));
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe("createZip — gidiş-dönüş", () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 248 }, (_, i) => i)]);
  const NOW = new Date(2026, 9, 6, 14, 30, 8); // YEREL saat bileşenleriyle kurulur → saat dilimi bağımsız

  it("iki dosya: ad, bayt, CRC, boyut ve konum doğru; yöntem 0 (store); UTF-8 ad bayrağı açık", () => {
    const zip = createZip(
      [
        { name: "01-kapak.png", data: PNG },
        { name: "özet-çıkarım.txt", data: enc.encode("Altyazı: ğüşiöç İ\n\n#etiket") },
      ],
      NOW,
    );
    const r = readZip(zip);
    expect(r.map((e) => e.name)).toEqual(["01-kapak.png", "özet-çıkarım.txt"]);
    expect(Array.from(r[0].data)).toEqual(Array.from(PNG));
    expect(dec.decode(r[1].data)).toBe("Altyazı: ğüşiöç İ\n\n#etiket");
    for (const e of r) {
      expect(e.method).toBe(0);
      expect(e.flags).toBe(0x0800);
      expect(e.csize).toBe(e.usize);
      expect(e.crc).toBe(crc32(e.data));
    }
  });
  it("DOS tarih/saat: 2026-10-06 14:30:08 → saat 29636, tarih 23878", () => {
    const [e] = readZip(createZip([{ name: "a.txt", data: enc.encode("x") }], NOW));
    expect(e.time).toBe((14 << 11) | (30 << 5) | 4);
    expect(e.time).toBe(29636);
    expect(e.date).toBe(((2026 - 1980) << 9) | (10 << 5) | 6);
    expect(e.date).toBe(23878);
  });
  it("boş paket geçerli: yalnız 22 baytlık merkez dizin sonu, 0 girdi", () => {
    const zip = createZip([]);
    expect(zip.length).toBe(22);
    expect(readZip(zip)).toEqual([]);
  });
  it("boş dosya ve büyük (300 KB) dosya birlikte bozulmadan döner; konumlar birbirine karışmaz", () => {
    const big = new Uint8Array(300 * 1024);
    for (let i = 0; i < big.length; i++) big[i] = (i * 31 + (i >> 8)) & 0xff;
    const r = readZip(createZip([{ name: "bos.txt", data: new Uint8Array(0) }, { name: "buyuk.bin", data: big }, { name: "son.txt", data: enc.encode("son") }]));
    expect(r.map((e) => e.usize)).toEqual([0, big.length, 3]);
    expect(r[1].crc).toBe(crc32(big));
    expect(Buffer.from(r[1].data).equals(Buffer.from(big))).toBe(true);
    expect(dec.decode(r[2].data)).toBe("son");
  });
  it("girdi dizisi/baytları DEĞİŞTİRİLMEZ", () => {
    const data = Uint8Array.from([1, 2, 3]);
    const before = Array.from(data);
    createZip([{ name: "a.bin", data }]);
    expect(Array.from(data)).toEqual(before);
  });
});

describe("createZip — güvenli ad ve sınır kuralları", () => {
  const f = (name: string) => () => createZip([{ name, data: enc.encode("x") }]);
  it("yol atlatma / mutlak yol / ters bölü / NUL / boş ad reddedilir", () => {
    for (const bad of ["../x.png", "a/../b.png", "/mutlak.png", "a\\b.png", "a\u0000b.png", ""]) expect(f(bad), bad).toThrow(/ZIP:/);
  });
  it("255 karakterden uzun ad reddedilir; 255 kabul", () => {
    expect(f("a".repeat(256))).toThrow(/ZIP:/);
    expect(f("a".repeat(255))).not.toThrow();
  });
  it("aynı ad iki kez verilemez", () => {
    expect(() =>
      createZip([
        { name: "a.png", data: enc.encode("1") },
        { name: "a.png", data: enc.encode("2") },
      ]),
    ).toThrow(/yinelenen/);
  });
  it("alt klasörlü ad (a/b.png) kabul edilir — yalnız '..' ve mutlak yol yasak", () => {
    expect(readZip(createZip([{ name: "klasor/b.png", data: enc.encode("x") }]))[0].name).toBe("klasor/b.png");
  });
});

describe("base64ToBytes", () => {
  it("gidiş-dönüş: tüm bayt değerleri korunur", () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    const back = base64ToBytes(Buffer.from(all).toString("base64"));
    expect(Array.from(back)).toEqual(Array.from(all));
  });
  it("PNG imzası: kart servisinin döndürdüğü base64 doğru çözülür", () => {
    const b64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).toString("base64");
    expect(b64.startsWith("iVBORw0KGgo")).toBe(true);
    expect(Array.from(base64ToBytes(b64))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });
  it("geçersiz base64 fırlatır (sessizce bozuk dosya üretmez)", () => {
    expect(() => base64ToBytes("***geçersiz***")).toThrow();
  });
});
