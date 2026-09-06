// VERİ NÖBETÇİSİ — SAF yardımcılar (2026-09-06). scripts/data-watch.mjs ve tests/unit/data-watch.test.ts kullanır; ağ/dosya YOK.
// Görev: kayıt defterlerinden (lib/tus-data · lib/yok-data · lib/yok-mezun) mevcut anahtarları OKUMAK, sıradaki beklenen kaynağı
// TÜRETMEK (ÖSYM slug'ları, YÖKSİS sayfa etiketi) ve yeni veri geldiğinde defterlere `approvedAt: null` satırı EKLEMEK
// (👤 onay kapısı korunur: nöbetçi veriyi ÇEKER ama YAYINA ALMAZ).

/** "2026-1" → { year, term }. */
export function parseKey(key) {
  const m = /^(\d{4})-([12])$/.exec(key);
  if (!m) throw new Error(`geçersiz dönem anahtarı: ${key}`);
  return { year: Number(m[1]), term: Number(m[2]) };
}
export const keyOf = (year, term) => `${year}-${term}`;

/** Son dönemden sonraki n dönem (2026-1 → 2026-2, 2027-1, …). */
export function nextPeriodKeys(lastKey, n = 2) {
  let { year, term } = parseKey(lastKey);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (term === 1) term = 2; else { term = 1; year += 1; }
    out.push(keyOf(year, term));
  }
  return out;
}

/** ÖSYM slug adayları — 🪤 ÖSYM 2025/1 ve 2026/1 ek yerleştirmede farklı slug kullandı; ikisi de denenir. */
export function osymSlugs(kind, key) {
  const { year, term } = parseKey(key);
  const base = `https://www.osym.gov.tr/${year}tus-${term}-donem`;
  if (kind === "main") return [`${base}-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler`];
  if (kind === "ek") return [`${base}-ek-yerlestirme-sonuclarina-iliskin-sayisal-bilgiler`, `${base}-ek-yerlestirme-sonuclarina-iliskin-en-buyuk-ve-en-kucuk-puanlar-genelyabanci-uyruklu`];
  if (kind === "kilavuz") return [`${base}-kilavuz-ve-basvuru-bilgileri`];
  throw new Error(`bilinmeyen tür: ${kind}`);
}

/** TS kaynağından bir dizi bloğundaki `key: "…"` (ya da year/endYear) değerlerini çıkarır. */
export function registryKeys(source, arrayName, field = "key") {
  const start = source.indexOf(`export const ${arrayName}`);
  if (start < 0) throw new Error(`${arrayName} bulunamadı`);
  const end = source.indexOf("];", start);
  const block = source.slice(start, end);
  const re = field === "key" ? /key:\s*"([^"]+)"/g : new RegExp(`${field}:\\s*(\\d{4})`, "g");
  return [...block.matchAll(re)].map((m) => (field === "key" ? m[1] : Number(m[1])));
}

/** `TUS_GUIDE_SOURCE.page` değeri. */
export function guideSourcePage(source) {
  const m = /page:\s*"([^"]+)"/.exec(source);
  return m ? m[1] : null;
}

function insertBeforeClose(source, headerNeedle, closeToken, line) {
  const start = source.indexOf(headerNeedle);
  if (start < 0) throw new Error(`blok bulunamadı: ${headerNeedle.slice(0, 40)}`);
  const close = source.indexOf(closeToken, start);
  if (close < 0) throw new Error(`blok kapanışı yok: ${headerNeedle.slice(0, 40)}`);
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  // kapanış satırının başına (önceki satır sonundan sonra) ekle
  const lineStart = source.lastIndexOf(eol, close) + eol.length;
  return source.slice(0, lineStart) + line + eol + source.slice(lineStart);
}

/** lib/tus-data.ts: yeni dönemi defter + yükleyici haritasına ekler (approvedAt: null). kind: "main" | "ek". */
export function patchTusRegistry(source, key, kind = "main") {
  const { year, term } = parseKey(key);
  const reg = kind === "ek" ? "export const TUS_EK_SNAPSHOTS" : "export const TUS_SNAPSHOTS";
  const loaders = kind === "ek" ? "const EK_ROW_LOADERS" : "const ROW_LOADERS";
  const file = kind === "ek" ? `ek-${key}` : key;
  if (registryKeys(source, kind === "ek" ? "TUS_EK_SNAPSHOTS" : "TUS_SNAPSHOTS").includes(key)) return source;
  let s = insertBeforeClose(source, reg, "];", `  { key: "${key}", year: ${year}, term: ${term}, approvedAt: null }, // 📡 veri nöbetçisi ${new Date().toISOString().slice(0, 10)} — 👤 onay bekliyor`);
  s = insertBeforeClose(s, loaders, "};", `  "${key}": () => import("@/data/tus/${file}.json"),`);
  return s;
}

/** lib/yok-data.ts: yeni YKS yılı (import + defter + FILES). */
export function patchYokAtlasRegistry(source, year) {
  if (registryKeys(source, "YOK_SNAPSHOTS", "year").includes(year)) return source;
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const importRe = /import snapshot(\d{4}) from "@\/data\/yok\/tip-programlari-\d{4}\.json";/g;
  const imports = [...source.matchAll(importRe)];
  if (!imports.length) throw new Error("yok-data import satırı yok");
  const last = imports[imports.length - 1];
  let s = source.slice(0, last.index + last[0].length) + eol + `import snapshot${year} from "@/data/yok/tip-programlari-${year}.json";` + source.slice(last.index + last[0].length);
  s = insertBeforeClose(s, "export const YOK_SNAPSHOTS", "];", `  { year: ${year}, approvedAt: null }, // 📡 veri nöbetçisi — 👤 onay bekliyor`);
  s = s.replace(/as unknown as YokFile \};/, `as unknown as YokFile, ${year}: snapshot${year} as unknown as YokFile };`);
  if (!s.includes(`${year}: snapshot${year}`)) throw new Error("FILES haritası yamalanamadı");
  return s;
}

/** lib/yok-mezun.ts: yeni mezun yılı (import + defter + FILES). */
export function patchYokMezunRegistry(source, endYear) {
  if (registryKeys(source, "YOK_MEZUN_SNAPSHOTS", "endYear").includes(endYear)) return source;
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const importRe = /import m(\d{4}) from "@\/data\/yok\/mezun-tip-\d{4}\.json";/g;
  const imports = [...source.matchAll(importRe)];
  if (!imports.length) throw new Error("yok-mezun import satırı yok");
  const last = imports[imports.length - 1];
  let s = source.slice(0, last.index + last[0].length) + eol + `import m${endYear} from "@/data/yok/mezun-tip-${endYear}.json";` + source.slice(last.index + last[0].length);
  s = insertBeforeClose(s, "export const YOK_MEZUN_SNAPSHOTS", "];", `  { endYear: ${endYear}, approvedAt: null }, // 📡 veri nöbetçisi — 👤 onay bekliyor`);
  s = insertBeforeClose(s, "const FILES: Record<number, YokMezunFile>", "};", `  ${endYear}: m${endYear} as unknown as YokMezunFile,`);
  return s;
}

/** YÖKSİS sayfa etiketi "2026-2027 Öğretim Yılı" → o sayfadaki Tablo 12 mezun yılının sonu (bir önceki öğretim yılı: 2026). */
export function mezunEndYearForPage(label) {
  const m = /(\d{4})-(\d{4})/.exec(label);
  if (!m) throw new Error(`etiket çözülemedi: ${label}`);
  return Number(m[1]);
}
/** endYear → beklenen YÖKSİS sayfa etiketi ("2026" → "2026-2027 Öğretim Yılı"). */
export const pageLabelForEndYear = (endYear) => `${endYear}-${endYear + 1} Öğretim Yılı`;

/** Statik Kariyer EDU listesinde bayat kayıtlar: son başvurusu geçmiş ya da doğrulaması 180 günden eski. */
export function staleEdu(list, todayIso, maxAgeDays = 180) {
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  const out = [];
  for (const o of list) {
    if (o.deadline && new Date(`${o.deadline}T00:00:00Z`).getTime() < today) out.push({ id: o.id, reason: `son başvuru geçti (${o.deadline})` });
    else if (o.verifiedAt && (today - new Date(`${o.verifiedAt}T00:00:00Z`).getTime()) / 86400000 > maxAgeDays) out.push({ id: o.id, reason: `doğrulama ${o.verifiedAt} — ${maxAgeDays} günden eski` });
  }
  return out;
}
