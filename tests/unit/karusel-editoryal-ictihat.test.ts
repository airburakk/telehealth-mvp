// Karusel editoryal — İÇTİHAT ŞABLONU (2026-11-25). Python ictihat.py ↔ TS ictihat.ts eşliği (eslik_uret.py fikstürü) +
// üreticide içtihat öğesinin MODELSİZ yolu + içtihat dışı bağlantısız öğenin fail-closed düşmesi. Model ve ağ YOK.
import { createHash } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import eslik from "./karusel-ictihat-eslik.json";
import { ICTIHAT_NOTU, ictihatMi, ictihatTaslagi, type IctihatOgesi } from "@/lib/karusel-editoryal/ictihat";
import { check, passed, type Taslak } from "@/lib/karusel-editoryal/kapilar";
import { collect, edisyonMetni, type EdisyonOgesi, type Getir } from "@/lib/karusel-editoryal/kaynak";
import { calistir, type Olustur } from "@/lib/karusel-editoryal/uret";

type Vaka = { ad: string; item: EdisyonOgesi & IctihatOgesi; edisyonMetni: string; taslak: Taslak; kapilar: [string, boolean, string][] };
const vakalar = eslik.vakalar as unknown as Vaka[];

describe("içtihat şablonu — Python eşliği", () => {
  it("fikstür dolu, not metni aynı", () => {
    expect(vakalar.length).toBeGreaterThanOrEqual(15);
    expect(ICTIHAT_NOTU).toBe(eslik.not);
  });
  it.each(vakalar.map((v) => [v.ad, v] as const))("%s", (_ad, v) => {
    expect(ictihatMi(v.item)).toBe(true);
    expect(edisyonMetni(v.item)).toBe(v.edisyonMetni);
    expect(ictihatTaslagi(v.item)).toEqual(v.taslak);
    expect(check(v.taslak, v.item, v.edisyonMetni)).toEqual(v.kapilar);
  });
  it("gerçek kararların hepsi kapılardan geçer; ham karar metni yok, yalnız künye + konu satırı", () => {
    for (const v of vakalar.filter((x) => x.ad.startsWith("gercek-"))) {
      expect(passed(v.kapilar), v.ad).toBe(true);
      expect(v.taslak.detailTitle).toBe(v.item.title);
      expect(v.taslak.detailSummary.endsWith(ICTIHAT_NOTU)).toBe(true);
    }
  });
  it("gerçekçi olmayan uzun başlık fail-closed düşer (kırpılmaz)", () => {
    expect(passed(vakalar.find((v) => v.ad === "baslik-uzun")!.kapilar)).toBe(false);
  });
  it("yedek cümle konu bilgisi sayılmaz", () => {
    const v = vakalar.find((x) => x.ad === "yedek-cumle")!;
    expect(v.taslak.detailSummary).not.toContain("bağlantısında");
  });
});

describe("kaynak toplayıcı — bağlantısız öğe ağa çıkmaz", () => {
  it("url null → çekme yok, hata 'bağlantı yok'", async () => {
    let cagrildi = false;
    const getir: Getir = async () => { cagrildi = true; return new Uint8Array(); };
    const p = await collect({ ...vakalar[0].item }, getir);
    expect(cagrildi).toBe(false);
    expect(p).toEqual({ edition: vakalar[0].edisyonMetni, fetched: "", fetchedOk: false, error: "bağlantı yok" });
  });
});

const mesaj = (input: unknown) =>
  ({ id: "m", type: "message", role: "assistant", model: "x", stop_reason: "tool_use", stop_sequence: null,
    usage: { input_tokens: 100, output_tokens: 50 }, content: [{ type: "tool_use", id: "t", name: "x", input }] }) as unknown as Anthropic.Message;

const E: Taslak = {
  coverTitle: "Yapay zekâ ve sağlık hukuku",
  coverDeck: "Doktrin incelemesi yapay zekâyı sağlık hukuku açısından ele alıyor.",
  detailTitle: "Yapay zekâ sağlık hukuku kapsamında değerlendirildi",
  detailSummary: "Doktrin incelemesi, yapay zekânın sağlık hukukunda doğurduğu sorumluluk sorularını ele alıyor. " +
    "Makale, mevcut düzenlemelerin bu teknolojiye nasıl uygulanabileceğini tartışıyor.",
};

function edisyon(ozel: Record<number, Record<string, unknown>>) {
  const items = Array.from({ length: 6 }, (_, k) => ({
    url: `https://ornek.org/${k + 1}`, title: `Başlık ${k + 1}`, sourceName: "Örnek", streamLabel: "Sektörel", stream: "sektorel",
    summaryLong: "Kurum yeni bir sağlık hukuku değerlendirmesi yayımladı.", ...(ozel[k] ?? {}),
  }));
  const body = JSON.stringify({ items });
  return { day: "2026-11-24", rawBodyUtf8: body, rawBodySha256: createHash("sha256").update(body, "utf8").digest("hex") };
}

function sahte() {
  const basliklar: string[] = [];
  const olustur: Olustur = async (p) => {
    const ad = (p.tool_choice as { name: string }).name;
    const u = String(p.messages[0].content);
    if (ad === "submit_taslak") {
      basliklar.push(/Başlık: (.+)/.exec(u)![1]);
      return mesaj(E);
    }
    return mesaj({ iddialar: [{ alan: "detailSummary", iddia: "x", etiket: "desteklenir", gerekce: "y" }] });
  };
  return { olustur, basliklar };
}
const getirYok: Getir = async () => { throw new Error("ağ yok"); };

describe("üretici — içtihat günü (Salı/Perşembe)", () => {
  const ic = vakalar.find((v) => v.ad === "gercek-1")!;

  it("içtihat öğesi modelsiz şablonla GEÇER, gün 6/6 GEÇTİ; editorial sourceUrl null taşır", async () => {
    const s = sahte();
    const { qa, editorial } = await calistir(edisyon({ 5: { ...ic.item, id: "ictihat-1" } }), { olustur: s.olustur, getir: getirYok });
    expect(qa.gun).toBe("GECTI");
    expect(s.basliklar).toHaveLength(5);                      // içtihata taslak çağrısı GİTMEDİ
    expect(s.basliklar).not.toContain(ic.item.title);
    const og = qa.ogeler[5];
    expect(og).toMatchObject({ sonuc: "GECTI", sourceUrl: null, kaynakOkundu: false, taslak: ic.taslak });
    expect(og.denemeler).toHaveLength(1);
    expect(og.denemeler[0]).toMatchObject({ deneme: 1, sablon: "ictihat", sonuc: "GECTI" });
    expect("dogrulama" in og.denemeler[0]).toBe(false);
    expect(editorial!.items[5]).toMatchObject({ itemId: "ictihat-1", sourceUrl: null, coverCategory: "Arşivden İçtihat", ...ic.taslak });
    expect("itemId" in editorial!.items[0]).toBe(false);      // kimliksiz öğe alan taşımaz (eski biçimle aynı)
  });

  it("içtihat dışı öğede bağlantı yoksa model çağrılmadan düşer → gün KALDI", async () => {
    const s = sahte();
    const { qa, editorial } = await calistir(edisyon({ 2: { url: null } }), { olustur: s.olustur, getir: getirYok });
    expect(qa.gun).toBe("KALDI");
    expect(editorial).toBeNull();
    expect(s.basliklar).not.toContain("Başlık 3");
    expect(qa.ogeler[2]).toMatchObject({ sonuc: "KALDI", sourceUrl: null, kaynakHatasi: "bağlantı yok", taslak: null });
  });

  it("şablonun kapıdan kaldığı içtihat (aşırı uzun künye) günü düşürür — kırpma yok", async () => {
    const uzun = vakalar.find((v) => v.ad === "baslik-uzun")!;
    const { qa } = await calistir(edisyon({ 0: { ...uzun.item } }), { olustur: sahte().olustur, getir: getirYok });
    expect(qa.gun).toBe("KALDI");
    expect(qa.ogeler[0]).toMatchObject({ sonuc: "KALDI", taslak: null });
  });
});
