// Regresyon nöbeti — SWC JSX varlık+çok-satır boşluk tuzağı (2026-09-06).
//
// GERÇEK OLAY: doctorium.tr/onam kutusunda "Aydınlatma metnini okudum" canlıda "metniniokudum"
// çıktı. Kaynakta boşluk zaten vardı — Next'in gerçek derleyicisi (SWC) bir JSX metin düğümünün
// BAŞTAKİ boşluğunu şu üç koşul BİRLİKTE sağlandığında düşürüyor:
//   (a) düğüm bir kardeşe (ör. `{ifade}`, `</strong>`, `<Icon />`) YENİ SATIRLA DEĞİL BOŞLUKLA
//       bitişik başlıyor — yani gerçekten korunması gereken bir boşluk var,
//   (b) düğüm birden çok kaynak satırına yayılıyor (genelde kapanış etiketi ayrı satırda),
//   (c) düğüm içinde bir HTML varlığı geçiyor (&apos; &quot; &rsquo; &nbsp; &amp; &#39; …).
// Üçü BİRLİKTE gerekli: tek satırda, varlıksız veya baştan yeni satırla başlayan (kendi
// paragraf satırı) düğümlerde sorun yok. TypeScript'in kendi derleyicisi ve Babel aynı satırı
// doğru derler — bu yüzden `tsc --noEmit` ve tip kontrolü sorunu YAKALAMAZ; yalnız gerçek
// SWC çıktısını inceleyerek görülür. Detay ve ölçüm: hafıza `swc-jsx-varlik-bosluk-tuzagi`.
//
// Bu test o üç koşulu TypeScript'in kendi JSX ayrıştırıcısıyla (gerçek derleme değil, statik
// AST taraması — hızlı ve yeterli, çünkü tetikleyici tamamen sözdizimsel) tüm `src/**/*.tsx`
// ağacında arar. Çözüm daima aynı: boşluğu `{" "}` ile açıkça vermek (bkz. herhangi bir
// düzeltilmiş örnek, ör. DoctoriumConsentGate.tsx).
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import * as ts from "typescript";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

// Ad ("amp") veya sayısal (#39, #x27) HTML varlığı — hangi varlık olduğu önemsiz, hepsi tetikler.
const ENTITY_RE = /&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/;

/** Bir JsxText düğümünün HAM kaynak metni tuzağa uygun mu? Üç koşul BİRLİKTE (yukarıdaki yorum). */
function isAtRisk(rawText: string): boolean {
  return /^[ \t]+\S/.test(rawText) && rawText.includes("\n") && ENTITY_RE.test(rawText);
}

function findJsxTextNodes(sourceFile: ts.SourceFile): ts.JsxText[] {
  const out: ts.JsxText[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) out.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return out;
}

const files = walk(SRC);

describe("SWC JSX varlık+boşluk tuzağı", () => {
  it("tarama çalışıyor mu (dosya sayısı > eşik)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("tuzak deseni doğru tanınıyor (bilinen iyi/kötü örnekler)", () => {
    // Gerçek olayın kısaltılmış hâli: {ifade} sonrası boşlukla başlıyor, çok satırlı, varlık içeriyor.
    const kotu = ' okudum; Doctorium&apos;da kişisel verilerimin.\n        ';
    const tekSatir = " bar&apos;s"; // (a)+(c) var ama (b) yok → SWC boşluğu KORUR
    const varlıksız = " bar ş\n"; // (a)+(b) var ama (c) yok → KORUR
    const kendiParagrafi = "\n          Aydınlatma metnini"; // baştan \n ile başlıyor → zaten trim edilir, kaybedilecek boşluk yok
    expect(isAtRisk(kotu)).toBe(true);
    expect(isAtRisk(tekSatir)).toBe(false);
    expect(isAtRisk(varlıksız)).toBe(false);
    expect(isAtRisk(kendiParagrafi)).toBe(false);
  });

  it("src/**/*.tsx içinde tuzağa uygun yeni bir JSX metin düğümü yok", () => {
    const ihlaller: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      if (!ENTITY_RE.test(src)) continue; // hızlı ön-eleme: dosyada hiç varlık yoksa AST'ye hiç girme
      const sourceFile = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
      for (const node of findJsxTextNodes(sourceFile)) {
        // 🪤 node.getText() BAŞTAKİ BOŞLUĞU YUTAR (trivia sanıp atlar) — tam da aradığımız şeyi.
        // Ham metin İÇİN pos/end'i doğrudan kaynağa uygulamak ŞART.
        const raw = sourceFile.text.slice(node.pos, node.end);
        if (!isAtRisk(raw)) continue;
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.pos);
        const onizleme = raw.trim().slice(0, 60).replace(/\s+/g, " ");
        ihlaller.push(`${f.replace(SRC, "src")}:${line + 1}: "${onizleme}…" — boşluğu {" "} ile açıkça ver`);
      }
    }
    expect(ihlaller, `SWC varlık+boşluk tuzağına uygun metin düğümü bulundu:\n${ihlaller.join("\n")}`).toEqual([]);
  });
});
