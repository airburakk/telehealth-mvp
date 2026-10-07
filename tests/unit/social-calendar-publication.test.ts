// İçerik takvimi — yayın kaydı sözleşmesi (lib/social-calendar/publication, v6.332, 2026-10-06): kanal/bağlantı doğrulaması (yalnız https; kimlik
// bilgisi, boşluk, uzunluk, javascript:/data: yasak) · kayıtlı JSON'un güvenli okunması (bozuk → null; geçersiz bağlantı sessizce düşer) ·
// elle yayın yardımcı metinleri (altyazı + etiket, dosya adları).
import { describe, expect, it } from "vitest";
import { CHANNEL_LABEL, MAX_ERROR_LEN, MAX_URL_LEN, PUBLISH_CHANNELS, buildCaptionText, normalizeChannels, parsePublication, slideFileName, zipFileName } from "@/lib/social-calendar/publication";

describe("normalizeChannels", () => {
  it("geçerli: kanal + isteğe bağlı https bağlantı; bağlantı normalleşir, boş bağlantı atılır", () => {
    const r = normalizeChannels([{ channel: "instagram", url: " https://www.instagram.com/p/ABC123/ " }, { channel: "linkedin", url: "" }, { channel: "x" }]);
    expect(r).toEqual({
      ok: true,
      channels: [{ channel: "instagram", url: "https://www.instagram.com/p/ABC123/" }, { channel: "linkedin" }, { channel: "x" }],
    });
  });
  it("bağlantı yoksa/null ise kanal yine geçerli", () => {
    expect(normalizeChannels([{ channel: "facebook", url: null }])).toEqual({ ok: true, channels: [{ channel: "facebook" }] });
  });
  it("hepsi beş kanal birlikte kabul edilir", () => {
    const r = normalizeChannels(PUBLISH_CHANNELS.map((channel) => ({ channel })));
    expect(r.ok && r.channels.map((c) => c.channel)).toEqual([...PUBLISH_CHANNELS]);
  });
  it("boş/dizi-olmayan girdi: 'En az bir kanal'", () => {
    for (const bad of [undefined, null, "instagram", {}, []]) expect(normalizeChannels(bad)).toEqual({ ok: false, error: "En az bir kanal seçin." });
  });
  it("bilinmeyen kanal, tekrarlı kanal, nesne olmayan eleman reddedilir", () => {
    expect(normalizeChannels([{ channel: "tiktok" }])).toMatchObject({ ok: false, error: "Bilinmeyen kanal." });
    expect(normalizeChannels([{ channel: "instagram" }, { channel: "instagram" }])).toMatchObject({ ok: false, error: "Instagram iki kez seçilmiş." });
    for (const bad of ["instagram", 5, null, [], [["instagram"]]]) expect(normalizeChannels([bad]).ok).toBe(false);
  });
  it("kanal sayısı sınırı aşılırsa reddedilir", () => {
    expect(normalizeChannels([...PUBLISH_CHANNELS, "instagram"].map((channel) => ({ channel }))).ok).toBe(false);
  });
  it("https dışı / bozuk / kimlik bilgili / boşluklu / javascript: / data: / uzun bağlantı reddedilir (hata kanal adını taşır)", () => {
    const long = `https://example.com/${"a".repeat(MAX_URL_LEN)}`;
    for (const url of ["http://x.com/p/1", "javascript:alert(1)", "data:text/html,<b>x</b>", "ftp://x.com/a", "x.com/p/1", "https://", "https://user:pw@x.com/p", "https://x.com/a b", long]) {
      const r = normalizeChannels([{ channel: "linkedin", url }]);
      expect(r.ok, url).toBe(false);
      expect(!r.ok && r.error).toContain("LinkedIn");
    }
  });
  it("bağlantı dize değilse reddedilir", () => {
    expect(normalizeChannels([{ channel: "x", url: 42 }])).toMatchObject({ ok: false, error: "X: bağlantı geçersiz." });
  });
  it("kanal etiketleri tamam", () => {
    for (const c of PUBLISH_CHANNELS) expect(CHANNEL_LABEL[c]).toBeTruthy();
  });
});

describe("parsePublication", () => {
  const AT = "2026-10-07T15:30:00.000Z";
  it("PUBLISHED biçimi: gidiş-dönüş", () => {
    const json = JSON.stringify({ v: 1, manual: true, channels: [{ channel: "instagram", url: "https://www.instagram.com/p/A/" }, { channel: "x" }], by: "Yönetici", at: AT });
    expect(parsePublication(json)).toEqual({ v: 1, manual: true, channels: [{ channel: "instagram", url: "https://www.instagram.com/p/A/" }, { channel: "x" }], by: "Yönetici", at: AT });
  });
  it("FAILED biçimi: boş kanal + hata notu (normalizeChannels'ın aksine boş kanal KABUL)", () => {
    expect(parsePublication(JSON.stringify({ v: 1, manual: false, channels: [], at: AT, error: "Instagram 400" }))).toEqual({ v: 1, manual: false, channels: [], at: AT, error: "Instagram 400" });
  });
  it("bozuk / boş / nesne olmayan / yanlış sürüm / geçersiz tarih → null (sayfa çökmez)", () => {
    for (const bad of [null, undefined, "", "{bozuk", "[]", "5", JSON.stringify({ v: 2, at: AT }), JSON.stringify({ v: 1, at: "dün" }), JSON.stringify({ v: 1 })]) expect(parsePublication(bad as string | null | undefined), String(bad)).toBeNull();
  });
  it("bilinmeyen kanal düşer; güvensiz bağlantı SESSİZCE atılır ama kanal kalır", () => {
    const r = parsePublication(JSON.stringify({ v: 1, manual: true, channels: [{ channel: "tiktok" }, { channel: "facebook", url: "javascript:alert(1)" }, "x", { channel: "linkedin", url: "http://x.com" }], at: AT }));
    expect(r?.channels).toEqual([{ channel: "facebook" }, { channel: "linkedin" }]);
  });
  it("manual yalnız true ise true; ad/hata kesilir", () => {
    const r = parsePublication(JSON.stringify({ v: 1, manual: "evet", channels: [], at: AT, by: "a".repeat(500), error: "h".repeat(900) }));
    expect(r?.manual).toBe(false);
    expect(r?.by).toHaveLength(120);
    expect(r?.error).toHaveLength(MAX_ERROR_LEN);
  });
  it("channels dizi değilse boş liste", () => {
    expect(parsePublication(JSON.stringify({ v: 1, manual: true, channels: "instagram", at: AT }))?.channels).toEqual([]);
  });
});

describe("elle yayın yardımcıları", () => {
  it("buildCaptionText: altyazı + boş satır + etiketler; boşlar atlanır; kırpılır", () => {
    expect(buildCaptionText({ caption: "  Bugünün kararı.\nDetay slaytlarda.  ", hashtags: ["#hukuk", "#saglik"] })).toBe("Bugünün kararı.\nDetay slaytlarda.\n\n#hukuk #saglik");
    expect(buildCaptionText({ caption: "Yalnız altyazı", hashtags: [] })).toBe("Yalnız altyazı");
    expect(buildCaptionText({ caption: "", hashtags: ["#a", "#b"] })).toBe("#a #b");
    expect(buildCaptionText({ caption: "", hashtags: [] })).toBe("");
  });
  it("slideFileName: sıra iki haneli, rol ASCII'ye indirgenir, boş rol 'slayt'", () => {
    expect(slideFileName(0, "kapak")).toBe("01-kapak.png");
    expect(slideFileName(9, "uyusmazlik")).toBe("10-uyusmazlik.png");
    expect(slideFileName(2, "Mahkeme Zinciri")).toBe("03-mahkeme-zinciri.png");
    expect(slideFileName(0, "***")).toBe("01-slayt.png");
  });
  it("zipFileName", () => {
    expect(zipFileName("karar-masasi", "2026-10-07")).toBe("karar-masasi-2026-10-07.zip");
  });
});
