// İçerik takvimi — rubrik LinkedIn belge (PDF carousel) (v6.342). Saf HTML + sayfa sayacı; gerçek Chromium ile PDF bu testte YOK
// (yerel prova: 7 slayt → 7 sayfa, 1080×1350 kayıpsız Flate görsel, 0,2 sn).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { BELGE, belgeHtml, pdfSayfaSayisi } from "../../infra/kart/lib/rubrik-belge.mjs";

const KOK = path.resolve(__dirname, "../..");

describe("belgeHtml", () => {
  it("sayfa başına TEK görsel; @page boyutu slayt boyutu, kenar boşluğu 0; başlık kaçışlı", () => {
    const h = belgeHtml(["QUFB", "QkJC", "Q0ND"], "Karar <masası> & test");
    expect(h.match(/<img /g)).toHaveLength(3);
    expect(h).toContain(`@page { size: ${BELGE.w}px ${BELGE.h}px; margin: 0; }`);
    expect(h).toContain("data:image/png;base64,QkJC");
    expect(h).toContain("<title>Karar &lt;masası&gt; &amp; test</title>");
    expect(h).toContain('<html lang="tr">');
  });
  it("metin üretmez: gövdede görsel dışında içerik yok", () => {
    const govde = belgeHtml(["QUFB"], "x").split("<body>")[1]!;
    expect(govde.replace(/<[^>]+>/g, "").trim()).toBe("");
  });
  it("slayt oranı 4:5", () => {
    expect(BELGE.w / BELGE.h).toBeCloseTo(4 / 5);
  });
});

describe("pdfSayfaSayisi", () => {
  it("/Type /Page sayılır, /Pages sayılmaz", () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >>\n2 0 obj << /Type /Page >>\n3 0 obj << /Type/Page /Parent 1 0 R >>\n", "latin1");
    expect(pdfSayfaSayisi(pdf)).toBe(2);
    expect(pdfSayfaSayisi(Buffer.from("%PDF-1.4"))).toBe(0);
  });
});

describe("kaynak kuralları", () => {
  const kod = fs.readFileSync(path.join(KOK, "infra/kart/lib/rubrik-belge.mjs"), "utf8").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
  it("\\uXXXX kaçışı ve emoji yok", () => {
    expect(kod).not.toMatch(/\\u[0-9a-fA-F]{4}/);
    expect(kod).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
  });
});
