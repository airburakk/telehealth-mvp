// Regresyon nöbeti (2026-09-29) — şifreleme kapsam sondasının kapattığı boşluklar: CaseDocument AI alanları ve
// SecondOpinionRequest.description yazımda encryptField'den, okuyucularda decryptField'den geçer. Kaynak taraması
// (AST değil, düzenli ifade) — bir yazım/okuma noktası düz metne geri dönerse test kırılır.
// Neden: bu kolonlar üretimde 17/17/4 + 1 düz satırla bulundu; şifreleme yazım noktasında unutulunca sondaya dek görünmüyor.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("şifreleme kapsam boşlukları (2026-09-29) — yazımda şifrele, okumada çöz", () => {
  it("analyze-docs: CaseDocument AI alanları encryptField ile yazılır, GET yanıtında decryptField ile çözülür", () => {
    const src = read("src/app/api/cases/[id]/analyze-docs/route.ts");
    for (const f of ["aiSummary: encryptField(a.summary)", "aiTranslation: encryptField(a.translation)", "aiFlags: encryptField(a.flags)"]) {
      expect(src, f).toContain(f);
    }
    expect(src).toMatch(/aiSummary: a\.summary,/.source ? /aiSummary: encryptField\(a\.summary\)/ : /./);
    expect(src).not.toMatch(/aiSummary: a\.summary,/);
    expect(src).toContain("aiSummary: decryptField(d.aiSummary)");
  });

  it("doktor/vaka/[id]: belge AI alanları sayfada çözülür", () => {
    const src = read("src/app/doktor/vaka/[id]/page.tsx");
    expect(src).toContain("aiSummary: decryptField(d.aiSummary)");
    expect(src).toContain("aiTranslation: decryptField(d.aiTranslation)");
    expect(src).toContain("aiFlags: decryptField(d.aiFlags)");
  });

  it("ikinci görüş talebi: description encryptField ile yazılır; üç okuyucu decryptField ile çözer", () => {
    expect(read("src/app/api/second-opinion/cases/[id]/request/route.ts")).toContain("description: encryptField(description.slice(0, 1000))");
    for (const rel of ["src/app/doktor/ikinci-gorus/[id]/page.tsx", "src/app/operasyon/ikinci-gorus/[id]/page.tsx", "src/app/second-opinion/vaka/[id]/page.tsx"]) {
      const src = read(rel);
      expect(src, rel).toMatch(/description: decryptField\(r\.description\)/);
      expect(src, rel).toContain('from "@/lib/crypto"');
    }
  });

  it("geriye dönük şifreleme betiği şema-güdümlüdür (elle envanter yok) ve find-kek sözleşmesini korur", () => {
    const src = read("scripts/encrypt-existing.ts");
    expect(src).toContain("discoverTextColumns");
    expect(src).toContain('argv.includes("--apply")');
    expect(src).toContain('argv.includes("--allow-unproven-kek")');
    expect(src).toMatch(/new PrismaClient\(\)/); // find-kek --run: DATABASE_URL'i o kurar
    expect(src).not.toMatch(/db\.caseDocument\.findMany/); // eski elle envanter yürüyüşü kalmadı
  });
});
