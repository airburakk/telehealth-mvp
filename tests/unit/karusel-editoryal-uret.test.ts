// Karusel editoryal üretici (Vercel) — model ve ağ YOK (sahte `olustur` + sahte `getir`). Python uret.py'nin testleriyle
// aynı senaryolar + istem metinlerinin Python'la BİREBİR eşliği + kart'taki kalite_kapisi.py'nin okuduğu kayıt alanları.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import eslik from "./karusel-kapilar-eslik.json";
import {
  calistir, DENEME_SAYISI, denemeMesaji, Hata, LEAD_CAPTION, ornekler, SYSTEM_DOGRULA, SYSTEM_URET, type Olustur,
} from "@/lib/karusel-editoryal/uret";
import { collect, htmlText, sourceText, webGetir, type Getir } from "@/lib/karusel-editoryal/kaynak";

const E = {
  coverTitle: "Yapay zekâ ve sağlık hukuku",
  coverDeck: "Doktrin incelemesi yapay zekâyı sağlık hukuku açısından ele alıyor.",
  detailTitle: "Yapay zekâ sağlık hukuku kapsamında değerlendirildi",
  detailSummary: "Doktrin incelemesi, yapay zekânın sağlık hukukunda doğurduğu sorumluluk sorularını ele alıyor. " +
    "Makale, mevcut düzenlemelerin bu teknolojiye nasıl uygulanabileceğini tartışıyor.",
};

function edisyon(o: { testOnly?: boolean; bozukSha?: boolean; adet?: number } = {}) {
  const items = Array.from({ length: o.adet ?? 6 }, (_, k) => ({
    url: `https://ornek.org/${k + 1}`, title: `Başlık ${k + 1}`, sourceName: "Örnek", streamLabel: "Sektörel",
    summaryLong: "Kurum yeni bir sağlık hukuku değerlendirmesi yayımladı.",
  }));
  const body = JSON.stringify({ items });
  return {
    day: "2026-11-16", rawBodyUtf8: body,
    rawBodySha256: o.bozukSha ? "0".repeat(64) : createHash("sha256").update(body, "utf8").digest("hex"),
    ...(o.testOnly ? { testOnly: true } : {}),
  };
}

const mesaj = (input: unknown, stop: Anthropic.Message["stop_reason"] = "tool_use") =>
  ({ id: "m", type: "message", role: "assistant", model: "x", stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: "tool_use", id: "t", name: "x", input }] }) as unknown as Anthropic.Message;

/** Taslak isteğine E; doğrulamada `kotu` (1 tabanlı) öğe için 'abartili'. */
function sahte(o: { kotu?: number; dogrulamaMetin?: boolean } = {}) {
  const cagri: string[] = [];
  const taslakMesajlari: string[] = [];
  let oge = 0;
  const olustur: Olustur = async (p) => {
    const ad = (p.tool_choice as { name: string }).name;
    cagri.push(ad);
    const u = String(p.messages[0].content);
    if (ad === "submit_taslak") {
      taslakMesajlari.push(u);
      oge = Number(/Başlık: Başlık (\d)/.exec(u)![1]);
      return mesaj({ detailSummary: E.detailSummary, coverTitle: E.coverTitle, detailTitle: E.detailTitle, coverDeck: E.coverDeck });
    }
    const iddialar = [{ alan: "detailSummary", iddia: "x", etiket: oge === o.kotu ? "abartili" : "desteklenir", gerekce: "y" }];
    return mesaj({ iddialar: o.dogrulamaMetin ? JSON.stringify(iddialar) : iddialar });
  };
  return { olustur, cagri, taslakMesajlari };
}
const getirYok: Getir = async () => { throw new Error("ağ yok"); };

describe("istemler — Python uret.py ile birebir", () => {
  const p = eslik.istemler;
  it("sistem istemleri + örnekler + sabitler", () => {
    expect(SYSTEM_URET).toBe(p.uret);
    expect(SYSTEM_DOGRULA).toBe(p.dogrula);
    expect(ornekler(p.orneklerHaric)).toBe(p.ornekler);
    expect(ornekler("https://yok")).toBe(p.orneklerHepsi);
    expect(LEAD_CAPTION).toBe(p.leadCaption);
    expect(DENEME_SAYISI).toBe(p.denemeSayisi);
  });
  it("deneme mesajı (ilk · önceki taslaklı tekrar · hata sonrası)", () => {
    const m = p.denemeMesaji;
    expect(denemeMesaji("Akademik", "KAYNAK X")).toBe(m.ilk);
    expect(denemeMesaji("Akademik", "KAYNAK X", "- uzunluk: coverDeck 141 karakter",
      { ...E, coverTitle: "Yapay zekâ 🤖 ve sağlık hukuku" })).toBe(m.tekrar);
    expect(denemeMesaji("Sektörel", "KAYNAK Y", "Yanıt alınamadı; kurallara uyarak yeniden yaz.")).toBe(m.hataSonrasi);
  });
  it("biçem örnekleri kart'taki kopyayla aynı", () => {
    const kart = path.join(process.cwd(), "infra/kart/karusel/editoryal/ornekler.json");
    const yerel = path.join(process.cwd(), "src/lib/karusel-editoryal/ornekler.json");
    expect(JSON.parse(fs.readFileSync(yerel, "utf8"))).toEqual(JSON.parse(fs.readFileSync(kart, "utf8")));
  });
});

describe("üretici", () => {
  it("6 öğe geçer → GEÇTİ, 12 çağrı, v3 çizici şeması (alan sırası sabit)", async () => {
    const s = sahte();
    const { qa, editorial } = await calistir(edisyon(), { olustur: s.olustur, getir: getirYok, model: "claude-haiku-5-5" });
    expect(qa.gun).toBe("GECTI");
    expect(qa.cagri).toBe(12);
    expect(s.cagri.filter((c) => c === "submit_taslak")).toHaveLength(6);
    expect(editorial!.leadImage.path).toBe("gorseller/kapak.png");
    expect(editorial!.items.map((i) => i.image)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `gorseller/haber-${n}.png`));
    expect(Object.keys(editorial!.items[0])).toEqual(
      ["sourceUrl", "coverCategory", "detailCategory", "coverTitle", "coverDeck", "detailTitle", "detailSummary", "image"]);
    expect(Object.keys(qa.ogeler[0].taslak!)).toEqual(["coverTitle", "coverDeck", "detailTitle", "detailSummary"]);
    expect(qa.ogeler[0].kaynakOkundu).toBe(false);
    expect(qa.ogeler[0].kaynakHatasi).toContain("ağ yok");
    expect(qa.tahminiUsd).toBeCloseTo((1200 / 1e6) * 0.1 + (600 / 1e6) * 0.5, 6);
  });

  it("kart kalite_kapisi.py'nin okuduğu alanlar tutarlı (gün · edisyon bağı · son deneme · etiketler · metin = taslak)", async () => {
    const ed = edisyon();
    const { qa, editorial } = await calistir(ed, { olustur: sahte().olustur, getir: getirYok });
    expect([qa.day, editorial!.day]).toEqual([ed.day, ed.day]);
    expect([qa.editionRawSha256, editorial!.edition.rawBodySha256]).toEqual([ed.rawBodySha256, ed.rawBodySha256]);
    expect(editorial!.items.map((i) => i.sourceUrl)).toEqual(JSON.parse(ed.rawBodyUtf8).items.map((i: { url: string }) => i.url));
    qa.ogeler.forEach((og, k) => {
      const son = og.denemeler.at(-1) as { sonuc: string; kapilar: { gecti: boolean }[]; dogrulama: { etiket: string }[] };
      expect(og.sonuc).toBe("GECTI");
      expect(son.sonuc).toBe("GECTI");
      expect(son.kapilar.length > 0 && son.kapilar.every((x) => x.gecti)).toBe(true);
      expect(son.dogrulama.map((d) => d.etiket)).toEqual(["desteklenir"]);
      const it = editorial!.items[k];
      expect({ coverTitle: it.coverTitle, coverDeck: it.coverDeck, detailTitle: it.detailTitle, detailSummary: it.detailSummary }).toEqual(og.taslak);
    });
  });

  it("doğrulamadan kalan öğe günü düşürür; editorial dönmez; o öğe DENEME_SAYISI kez denenir", async () => {
    const { qa, editorial } = await calistir(edisyon(), { olustur: sahte({ kotu: 3 }).olustur, getir: getirYok });
    expect(qa.gun).toBe("KALDI");
    expect(editorial).toBeNull();
    expect(qa.ogeler[2].denemeler).toHaveLength(DENEME_SAYISI);
    expect(qa.ogeler[2].taslak).toBeNull();
  });

  it("yeniden denemede model reddedilen taslağı karakter sayısıyla görür; ilk denemede görmez", async () => {
    const s = sahte({ kotu: 3 });
    await calistir(edisyon(), { olustur: s.olustur, getir: getirYok });
    const oge3 = s.taslakMesajlari.filter((m) => m.includes("Başlık: Başlık 3"));
    expect(oge3).toHaveLength(DENEME_SAYISI);
    expect(oge3[0]).not.toContain("ÖNCEKİ TASLAK");
    expect(oge3[1]).toContain(`ÖNCEKİ TASLAK:\n- coverTitle (27 karakter): ${E.coverTitle}`);
    expect(oge3[1]).toContain('- detailSummary: "x" → abartili (y)');
  });

  it("JSON metnine sarılmış iddia dizisi kurtarılır", async () => {
    const { qa } = await calistir(edisyon(), { olustur: sahte({ dogrulamaMetin: true }).olustur, getir: getirYok });
    expect(qa.gun).toBe("GECTI");
  });

  it("ret / eksik yanıt denemeyi düşürür, gün devam eder", async () => {
    let n = 0;
    const s = sahte();
    const olustur: Olustur = async (p) => (++n === 1 ? mesaj({}, "refusal") : s.olustur(p));
    const { qa } = await calistir(edisyon(), { olustur, getir: getirYok });
    expect(qa.ogeler[0].denemeler[0]).toEqual({ deneme: 1, hata: "model reddetti" });
    expect(qa.gun).toBe("GECTI");
  });

  it.each([["bozuk hash", { bozukSha: true }], ["testOnly", { testOnly: true }], ["5 öğe", { adet: 5 }]] as const)(
    "%s → model çağrılmadan Hata", async (_ad, o) => {
      const s = sahte();
      await expect(calistir(edisyon(o), { olustur: s.olustur, getir: getirYok })).rejects.toBeInstanceOf(Hata);
      expect(s.cagri).toEqual([]);
    });
});

describe("kaynak toplayıcı", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  it("HTML: script/nav atılır, p/li metni, 30 karakter altı satır düşer, varlıklar çözülür", () => {
    const html = "<nav><p>Menü menü menü menü menü menü menü menü</p></nav><script>x</script>" +
      "<p>Bu paragraf yeterince uzun bir cümle&nbsp;içeriyor ve n&ouml;roloji alanındadır.</p><li>kısa</li>";
    expect(htmlText(enc(html))).toBe("Bu paragraf yeterince uzun bir cümle içeriyor ve nöroloji alanındadır.");
  });
  it("windows-1254 yedek çözümleme", () => {
    const raw = new Uint8Array([0x3c, 0x70, 0x3e, ...enc("Resmi Gazete fihristi okunuyor: "), 0xfe, 0xf0, 0xfd, 0x3c, 0x2f, 0x70, 0x3e]);
    expect(htmlText(raw)).toBe("Resmi Gazete fihristi okunuyor: şğı");
  });
  it("yedek cümle kaynak sayılmaz; tarih Türkçe; okuma hatası fail-open", async () => {
    const p = await collect({ url: "https://x.org/a", title: "T", sourceName: "S", streamLabel: "Sektörel",
      publishedAt: "2026-11-05T08:00:00Z", summaryLong: "yedek", summaryLongFallback: true }, getirYok);
    expect(p.edition).toBe("Kaynak: S · Akış: Sektörel · Yayım tarihi: 5 Kasım 2026\nBaşlık: T");
    expect([p.fetchedOk, p.error]).toEqual([false, "Error: ağ yok"]);
    expect(sourceText(p)).toBe(p.edition);
  });
  it("web okuyucu: 5xx'te bir kez yeniden dener, 4xx'te denemez; aynı URL bir koşuda bir kez çekilir", async () => {
    const durumlar: Record<string, number[]> = { "https://a.org/x": [503, 200], "https://a.org/y": [404, 200] };
    const cagri: string[] = [];
    vi.stubGlobal("fetch", async (u: URL) => {
      cagri.push(String(u));
      return new Response("ok", { status: durumlar[String(u)].shift() });
    });
    try {
      const getir = webGetir();
      expect(new TextDecoder().decode(await getir("https://a.org/x"))).toBe("ok");
      expect(new TextDecoder().decode(await getir("https://a.org/x"))).toBe("ok");
      await expect(getir("https://a.org/y")).rejects.toThrow("HTTP 404");
      await expect(getir("file:///etc/passwd")).rejects.toThrow("desteklenmeyen şema");
      expect(cagri).toEqual(["https://a.org/x", "https://a.org/x", "https://a.org/y"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("ClinicalTrials.gov kaydı yapılandırılmış okunur", async () => {
    const d = { protocolSection: { identificationModule: { officialTitle: "OT", acronym: "AC" }, statusModule: { overallStatus: "RECRUITING" },
      designModule: { phases: ["PHASE3"] }, descriptionModule: { briefSummary: "BS" },
      armsInterventionsModule: { armGroups: [{ label: "A", interventionNames: ["i1", "i2"] }] }, outcomesModule: { primaryOutcomes: [{ measure: "OS" }] } } };
    const getir: Getir = async (url) => { expect(url).toBe("https://clinicaltrials.gov/api/v2/studies/NCT1"); return enc(JSON.stringify(d)); };
    const p = await collect({ url: "https://clinicaltrials.gov/study/NCT1", title: "T", sourceName: "CT", streamLabel: "İlaç & Cihaz" }, getir);
    expect(p.fetched).toBe("Resmî başlık: OT\nKısa ad: AC\nFaz: PHASE3\nDurum: RECRUITING\nÖzet: BS\nKol: A — i1, i2\nBirincil sonlanım: OS");
  });
});
