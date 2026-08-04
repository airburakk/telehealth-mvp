// Doctorium sponsorlu içerik — saf mantık sözleşmeleri (v6.68 Faz 1).
// DB'li yollar (activeCampaignsFor, setSponsorPersonalization) entegrasyon işidir; burada
// KVKK hedefleme süzmesi + kategori parkı + frekans tavanı sözleşmesi kilitlenir.
import { describe, it, expect } from "vitest";
import { filterCampaigns, CATEGORY_LABEL, MAX_FEED_CARDS, SPONSOR_CONSENT_SCOPE, SPONSOR_REVOKE_SCOPE } from "@/lib/sponsor";

const camp = (targetBranches: string | null, targetCities: string | null, id = "x") =>
  ({ id, targetBranches, targetCities });

describe("hedefleme süzmesi (KVKK: rızasıza hedefleme YOK)", () => {
  it("rızasız doktor YALNIZ hedefsiz (bağlamsal) kampanyaları görür", () => {
    const rows = [camp(null, null, "genel"), camp('["onkoloji"]', null, "hedefli"), camp(null, '["Ankara"]', "sehirli")];
    const out = filterCampaigns(rows, { personalized: false, branches: ["onkoloji"], city: "Ankara" });
    expect(out.map((c) => c.id)).toEqual(["genel"]);
  });

  it("rızalı doktor: hedefsizler + branşı kesişenler; kesişmeyen elenir", () => {
    const rows = [camp(null, null, "genel"), camp('["onkoloji"]', null, "onko"), camp('["kardiyoloji"]', null, "kardio")];
    const out = filterCampaigns(rows, { personalized: true, branches: ["onkoloji"], city: null });
    expect(out.map((c) => c.id)).toEqual(["genel", "onko"]);
  });

  it("şehir hedefi: eşleşmeyen/bilinmeyen şehirde elenir, eşleşende gelir", () => {
    const rows = [camp(null, '["İstanbul"]', "ist")];
    expect(filterCampaigns(rows, { personalized: true, branches: [], city: "Ankara" })).toEqual([]);
    expect(filterCampaigns(rows, { personalized: true, branches: [], city: null })).toEqual([]);
    expect(filterCampaigns(rows, { personalized: true, branches: [], city: "İstanbul" }).map((c) => c.id)).toEqual(["ist"]);
  });

  it("branş VE şehir hedefi birlikte: ikisi de tutmalı", () => {
    const rows = [camp('["onkoloji"]', '["İstanbul"]', "both")];
    expect(filterCampaigns(rows, { personalized: true, branches: ["onkoloji"], city: "Ankara" })).toEqual([]);
    expect(filterCampaigns(rows, { personalized: true, branches: ["onkoloji"], city: "İstanbul" }).length).toBe(1);
  });

  it("bozuk JSON hedef listesi hedefsiz sayılır (akış düşmez, kampanya bağlamsala düşer)", () => {
    const rows = [camp("{bozuk", "da-bozuk", "b")];
    expect(filterCampaigns(rows, { personalized: false, branches: [], city: null }).map((c) => c.id)).toEqual(["b"]);
  });
});

describe("kategori ve tavan sözleşmeleri", () => {
  it("İLAÇ kategorisi YOKTUR — Modül D parkı (TİTCK hukuki görüş) regresyon kilidi", () => {
    const keys = Object.keys(CATEGORY_LABEL).map((k) => k.toUpperCase());
    expect(keys).not.toContain("ILAC");
    expect(keys).not.toContain("İLAÇ");
    expect(keys).not.toContain("PHARMA");
  });

  it("CIHAZ kategorisi vardır (kullanıcı kararı 2026-08-04)", () => {
    expect(CATEGORY_LABEL.CIHAZ).toBe("Tıbbi Cihaz");
  });

  it("frekans tavanı 2'dir (akış reklam panosuna dönmez)", () => {
    expect(MAX_FEED_CARDS).toBe(2);
  });

  it("grant ve revoke AYRI scope'lardır (aç-kapa-aç zincirde ayrı iz bırakır)", () => {
    expect(SPONSOR_CONSENT_SCOPE).not.toBe(SPONSOR_REVOKE_SCOPE);
  });
});
