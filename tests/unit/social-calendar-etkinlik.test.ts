// İçerik takvimi — Etkinlik radarı aday penceresi + taslak üreticisi (v6.346). SAF; DB yok.
import { describe, expect, it } from "vitest";
import {
  ETKINLIK,
  adayNedeni,
  buildEtkinlikDraft,
  etkinlikAdaylari,
  etkinlikSlayti,
  pencere,
  resmiAdlar,
  sonTarihler,
  tarihAraligi,
  yerSatiri,
  type EtkinlikKaydi,
} from "@/lib/social-calendar/etkinlik";
import { evaluateGates } from "@/lib/social-calendar/gates";
import { LIMITS } from "@/lib/social-calendar/limits";
import { seriesByKey } from "@/lib/social-calendar/series";

const TUR = { kongre: "Kongre", sempozyum: "Sempozyum", kurs: "Kurs" };
const SLOT = "2026-10-12"; // Pazartesi
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const k = (o: Partial<EtkinlikKaydi> & { id: string; title: string; startDate: Date }): EtkinlikKaydi => ({
  organizer: null, city: null, country: "TR", venue: null, endDate: null, abstractDeadline: null, earlyBirdDeadline: null,
  eventType: "kongre", scope: "ulusal", ttbCode: null, url: null, warning: null, ...o,
});

describe("tarih ve yer biçimleri", () => {
  it("tarihAraligi: aynı ay · ay geçişi · yıl geçişi · tek gün", () => {
    expect(tarihAraligi(d("2026-10-14"), d("2026-10-18"))).toBe("14–18 Ekim 2026");
    expect(tarihAraligi(d("2026-10-30"), d("2026-11-02"))).toBe("30 Ekim – 2 Kasım 2026");
    expect(tarihAraligi(d("2026-12-28"), d("2027-01-03"))).toBe("28 Aralık 2026 – 3 Ocak 2027");
    expect(tarihAraligi(d("2026-10-14"), null)).toBe("14 Ekim 2026");
    expect(tarihAraligi(d("2026-10-14"), d("2026-10-14"))).toBe("14 Ekim 2026");
  });
  it("yerSatiri: şehir · mekân; yurt dışı ülke kodu; boş", () => {
    expect(yerSatiri({ city: "Ankara", venue: "Sheraton", country: "TR" })).toBe("Ankara · Sheraton");
    expect(yerSatiri({ city: "Barselona", venue: null, country: "ES" })).toBe("Barselona (ES)");
    expect(yerSatiri({ city: null, venue: null, country: "TR" })).toBe("Yer bilgisi yok");
  });
});

describe("pencere ve aday nedeni (60 gün)", () => {
  it("pencere = yayın günü + 60 gün", () => {
    expect(pencere(SLOT)).toEqual({ bas: "2026-10-12", son: "2026-12-11" });
    expect(ETKINLIK).toMatchObject({ pencereGun: 60, enCok: 6, enAz: 1 });
  });
  it("başlangıcı pencerede → 'pencere' (iki uç dahil); geçmiş → aday değil", () => {
    expect(adayNedeni(k({ id: "a", title: "A", startDate: d("2026-10-12") }), SLOT)).toBe("pencere");
    expect(adayNedeni(k({ id: "a", title: "A", startDate: d("2026-12-11") }), SLOT)).toBe("pencere");
    expect(adayNedeni(k({ id: "a", title: "A", startDate: d("2026-10-11") }), SLOT)).toBeNull();
  });
  it("ileri tarihli + bildiri/erken kayıt son günü pencerede → 'son-tarih'; son günü de dışarıda → aday değil", () => {
    expect(adayNedeni(k({ id: "a", title: "A", startDate: d("2027-03-01"), abstractDeadline: d("2026-11-20") }), SLOT)).toBe("son-tarih");
    expect(adayNedeni(k({ id: "a", title: "A", startDate: d("2027-03-01"), earlyBirdDeadline: d("2026-12-31") }), SLOT)).toBeNull();
  });
  it("sonTarihler: yalnız yayın gününden SONRAKİ son günler yazılır (geçmişi yanıltmasın)", () => {
    expect(sonTarihler({ abstractDeadline: d("2026-08-02"), earlyBirdDeadline: d("2026-11-01") }, SLOT)).toEqual(["Erken kayıt son günü: 1 Kasım 2026"]);
  });
  it("adaylar: pencere içindekiler önce, tarih sırasıyla; tür/kapsam etiketi; kullanıldı rozeti", () => {
    const L = etkinlikAdaylari(
      [
        k({ id: "c", title: "C", startDate: d("2027-02-01"), abstractDeadline: d("2026-10-30") }),
        k({ id: "b", title: "B", startDate: d("2026-11-20"), eventType: "kurs", scope: "uluslararasi" }),
        k({ id: "a", title: "A", startDate: d("2026-10-20") }),
        k({ id: "x", title: "X", startDate: d("2027-05-01") }),
      ],
      SLOT,
      TUR,
      new Map([["a", "2026-10-05"]]),
    );
    expect(L.map((x) => x.id)).toEqual(["a", "b", "c"]);
    expect(L[1]).toMatchObject({ turEtiketi: "Kurs", kapsamEtiketi: "Uluslararası", neden: "pencere" });
    expect(L[2]).toMatchObject({ neden: "son-tarih", sonTarihler: ["Bildiri son günü: 30 Ekim 2026"] });
    expect(L[0]!.kullanildi).toBe("2026-10-05");
  });
});

describe("taslak üretimi", () => {
  const ev = [
    k({ id: "2", title: "62. Ulusal Psikiyatri Kongresi", organizer: "Türkiye Psikiyatri Derneği (TPD)", city: "Ankara", venue: "Sheraton Ankara Hotel", startDate: d("2026-10-14"), endDate: d("2026-10-18"), earlyBirdDeadline: d("2026-09-15"), url: "https://62upk.org/" }),
    k({ id: "1", title: "Sempozyum A", startDate: d("2026-10-13"), eventType: "sempozyum", ttbCode: "SMP34941", warning: "Sahte kayıt sitelerine dikkat; yalnız resmî siteyi kullanın." }),
  ];
  it("sayı sınırı: 0 ve 7 → null; 1–6 → taslak", () => {
    expect(buildEtkinlikDraft([], SLOT, TUR)).toBeNull();
    expect(buildEtkinlikDraft(Array.from({ length: 7 }, (_, i) => k({ id: String(i), title: `E${i}`, startDate: d("2026-10-20") })), SLOT, TUR)).toBeNull();
    expect(buildEtkinlikDraft(ev.slice(0, 1), SLOT, TUR)).not.toBeNull();
  });
  it("kapak + tarih sırasıyla etkinlik slaytları + kaynak; altyazı, etiket ve kaynak künyeleri", () => {
    const p = buildEtkinlikDraft(ev, SLOT, TUR)!;
    expect(p.slides.map((s) => s.role)).toEqual(["kapak", "genel", "genel", "kaynak"]);
    expect(p.slides[0]).toMatchObject({ title: "Yaklaşan 2 etkinlik", body: "13–18 Ekim 2026 · sempozyum, kongre" });
    expect(p.slides[1]!.title).toBe("Sempozyum A");
    expect(p.slides[2]).toMatchObject({ title: "62. Ulusal Psikiyatri Kongresi", body: "14–18 Ekim 2026\nAnkara · Sheraton Ankara Hotel\nDüzenleyen: Türkiye Psikiyatri Derneği (TPD)\nKongre · Ulusal" });
    expect(p.slides[2]!.bullets).toBeUndefined(); // erken kayıt son günü yayından ÖNCE → yazılmaz
    expect(p.slides[1]!.bullets).toEqual(["TTB-STE kodu: SMP34941", "Dikkat: Sahte kayıt sitelerine dikkat; yalnız resmî siteyi kullanın."]);
    expect(p.caption).toContain("Etkinlik radarı · 12 Ekim 2026");
    expect(p.caption).toContain("• 62. Ulusal Psikiyatri Kongresi — 14–18 Ekim 2026, Ankara");
    expect(p.hashtags.length).toBeLessThanOrEqual(LIMITS.hashtags);
    expect(p.sources).toEqual([{ label: "Sempozyum A", ref: "TTB-STE SMP34941" }, { label: "62. Ulusal Psikiyatri Kongresi", ref: "https://62upk.org/" }]);
  });
  it("kendi metnimizde kredi SAYISI, 'akredit' ya da 'hekim' yok", () => {
    const t = JSON.stringify(buildEtkinlikDraft(ev, SLOT, TUR)).toLocaleLowerCase("tr-TR");
    expect(t).not.toMatch(/akredit|hekim|kredi(si)? \d|\d+ kredi/);
  });
  it("uzun ad sınırda kelime ortasından değil, '…' ile kısalır", () => {
    const s = etkinlikSlayti(k({ id: "u", title: "Çok ".repeat(60) + "Uzun Kongre", startDate: d("2026-10-20") }), SLOT, TUR);
    expect(s.title.length).toBeLessThanOrEqual(LIMITS.title);
    expect(s.title.endsWith("…")).toBe(true);
  });
});

describe("onay kapısı — resmî ad istisnası (yalnız Etkinlik radarı)", () => {
  const series = seriesByKey("etkinlik-radari")!;
  const ev = [k({ id: "d", title: "Türk Diş Hekimleri Birliği Uluslararası Dişhekimliği Kongresi", organizer: "Türk Diş Hekimleri Birliği", startDate: d("2026-10-20") })];
  const ifade = (payload: ReturnType<typeof buildEtkinlikDraft>, adlar: string[]) =>
    evaluateGates({ series, payload, attestIdentity: false, sourceIds: ["d"], sourceTexts: adlar }).gates.find((g) => g.id === "ifade")!;
  it("etkinliğin RESMÎ ADINDAKİ 'Hekim' kapıyı düşürmez", () => {
    expect(ifade(buildEtkinlikDraft(ev, SLOT, TUR), resmiAdlar(ev)).ok).toBe(true);
  });
  it("resmî adlar verilmezse aynı metin yakalanır (istisna yalnız adlar için)", () => {
    expect(ifade(buildEtkinlikDraft(ev, SLOT, TUR), []).ok).toBe(false);
  });
  it("editörün KENDİ yazdığı 'hekim' yine yakalanır", () => {
    const p = buildEtkinlikDraft(ev, SLOT, TUR)!;
    p.caption += "\n\nTüm hekimlerimizi bekliyoruz.";
    expect(ifade(p, resmiAdlar(ev)).ok).toBe(false);
  });
  it("Karar masası'nda istisna YOK (sourceTexts karar metnidir)", () => {
    const karar = seriesByKey("karar-masasi")!;
    const p = buildEtkinlikDraft(ev, SLOT, TUR)!;
    expect(evaluateGates({ series: karar, payload: p, attestIdentity: true, sourceIds: ["d"], sourceTexts: resmiAdlar(ev) }).gates.find((g) => g.id === "ifade")!.ok).toBe(false);
  });
  it("resmiAdlar kısaltılmış biçimleri de içerir (uzundan kısaya)", () => {
    const uzun = k({ id: "u", title: "Hekim ".repeat(40), startDate: d("2026-10-20") });
    const a = resmiAdlar([uzun]);
    expect(a.length).toBeGreaterThan(1);
    expect(a[0]!.length).toBeGreaterThanOrEqual(a[a.length - 1]!.length);
  });
});
