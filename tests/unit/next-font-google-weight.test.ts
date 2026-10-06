// next/font/google ayrık-ağırlık nöbeti (2026-10-06 olayı) — `Space_Grotesk({ weight: ["400","500","600","700"] })` ayrık küme
// ister (`css2?family=Space+Grotesk:wght@400;500;600;700`). Google ayrık kümeyi bazen dinamik "kit" hizmetinden UZANTISIZ
// `https://fonts.gstatic.com/l/font?kit=…&skey=…&v=…` adresleriyle yanıtlar (ölçüm: ayrık istek 7/562, tam aralık istekleri 0/1734)
// ve Next 16.2.x Turbopack bu adresi font-dosyası sorgusuna JSON olarak gömüp `&`'ten böler → BUILD kırılır
// ("next/font/google queries have exactly one entry", 12 hata; vercel/next.js#99114 — AÇIK, 16.2.12/16.3.6'da da var).
// Kırılma rastgele ve ÖNBELLEKTEN BAĞIMSIZDIR (Vercel'de ~200 derlemede 1; CI `next build` koşmadığı için burada görünmez).
// Değişken ailelerde `weight` VERİLMEZ → Next tam eksen aralığını ister (`wght@300..700`), Google hep hazır dosyayı sunar.
// Bu test, ayrık `weight` dizisini KAYNAK TARAMASIYLA reddeder (düzenli ifade; AST değil). STATİK bir aile gerçekten çok ağırlık
// ister (değişken eksen yok → `weight` zorunlu) ise aşağıdaki izinli listeye GEREKÇEYLE eklenir (yalnız bilinçli karar).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Ayrık `weight` dizisine İZİN verilen aileler (kodda kullanılan ad). Boş = bugün hiçbiri. Eklerken: neden statik, neden dizi? */
const ARRAY_WEIGHT_ALLOWED: ReadonlySet<string> = new Set<string>([]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Yorumları atar — nöbet, açıklama metnindeki örnek (`weight: [...]`) yüzünden yanlış alarm vermesin. `://` korunur (URL). */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** `from "next/font/google"` içe aktarımındaki yerel adlar (`Inter as Sans` → "Sans"). */
function importedFonts(src: string): string[] {
  const names: string[] = [];
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']next\/font\/google["']/g)) {
    for (const part of m[1].split(",")) {
      const t = part.trim();
      if (!t) continue;
      const alias = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/.exec(t);
      if (alias) names.push(alias[2] ?? alias[1]);
    }
  }
  return names;
}

/** `Ad( … )` çağrılarının argüman gövdeleri (dengeli parantez; dize içi parantez beklenmez). */
function callBodies(src: string, name: string): string[] {
  const bodies: string[] = [];
  const re = new RegExp(`\\b${name.replace(/\$/g, "\\$")}\\s*\\(`, "g");
  for (const m of src.matchAll(re)) {
    let depth = 1;
    let i = (m.index ?? 0) + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i++) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
    }
    bodies.push(src.slice(start, i - 1));
  }
  return bodies;
}

/** Bir kaynakta ayrık `weight` dizisi veren next/font/google çağrıları ("Ad" listesi). */
function arrayWeightFonts(source: string, allowed: ReadonlySet<string> = ARRAY_WEIGHT_ALLOWED): string[] {
  const src = stripComments(source);
  const hits: string[] = [];
  for (const name of importedFonts(src)) {
    if (allowed.has(name)) continue;
    for (const body of callBodies(src, name)) {
      if (/\bweight\s*:\s*\[/.test(body)) hits.push(name);
    }
  }
  return hits;
}

const files = walk(SRC);
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/");

describe("next/font/google — ayrık weight dizisi YASAK (Google dinamik 'kit' adresi → Turbopack build kırılır)", () => {
  it("kaynak ağacı taranabiliyor ve kök layout dört aileyi tanıyor (nöbetin kendisi çalışıyor mu)", () => {
    expect(files.length).toBeGreaterThan(300);
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");
    expect(importedFonts(layout)).toEqual(
      expect.arrayContaining(["Space_Grotesk", "Inter", "JetBrains_Mono", "Noto_Sans_Arabic"]),
    );
  });

  it("hiçbir next/font/google çağrısı ayrık `weight` dizisi vermez", () => {
    const violations: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!src.includes("next/font/google")) continue;
      for (const name of arrayWeightFonts(src)) violations.push(`${rel(f)} → ${name}`);
    }
    expect(
      violations,
      "değişken ailede `weight` dizisini KALDIR (tam eksen aralığı istenir) — ayrıntı: src/app/layout.tsx 'weight DİZİSİ VERİLMEZ' notu",
    ).toEqual([]);
  });

  it("ayrıştırıcı: olayı yakalar (4 ağırlıklı Space_Grotesk), çok satırlı ve takma adlı biçimi de", () => {
    const incident =
      'import { Space_Grotesk } from "next/font/google";\n' +
      'const serif = Space_Grotesk({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-serif", display: "swap", preload: false });';
    expect(arrayWeightFonts(incident)).toEqual(["Space_Grotesk"]);

    const multiline =
      'import { Inter as Sans, JetBrains_Mono } from "next/font/google";\n' +
      "const a = Sans({\n  subsets: [\"latin\"],\n  weight: [\n    \"400\",\n    \"700\",\n  ],\n});\n" +
      'const b = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });';
    expect(arrayWeightFonts(multiline)).toEqual(["Sans"]);
  });

  it("ayrıştırıcı: geçerli biçimleri reddetmez (ağırlıksız · tek dize ağırlık · yorum · başka paket · izinli liste)", () => {
    const ok =
      'import { Inter, Poppins } from "next/font/google";\n' +
      '// eski hâl: Inter({ weight: ["400", "700"] }) — yorumdaki örnek sayılmaz\n' +
      'const a = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });\n' +
      'const b = Poppins({ subsets: ["latin"], weight: "400" });';
    expect(arrayWeightFonts(ok)).toEqual([]);

    const otherPackage = 'import { Inter } from "somewhere-else";\nconst a = Inter({ weight: ["400", "700"] });';
    expect(arrayWeightFonts(otherPackage)).toEqual([]);

    const allowedSrc = 'import { Poppins } from "next/font/google";\nconst a = Poppins({ weight: ["400", "700"] });';
    expect(arrayWeightFonts(allowedSrc)).toEqual(["Poppins"]);
    expect(arrayWeightFonts(allowedSrc, new Set(["Poppins"]))).toEqual([]);
  });
});
