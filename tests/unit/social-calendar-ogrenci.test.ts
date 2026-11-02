// İçerik takvimi — Öğrenci köşesi fırsat adayları + taslak üreticisi (v6.349). SAF; DB yok.
import { describe, expect, it } from "vitest";
import { OGRENCI, buildOgrenciDraft, firsatAdayMi, firsatAdaylari, firsatResmiAdlari, firsatSlayti, siraliFirsatlar, takvimSatiri, type FirsatKaydi } from "@/lib/social-calendar/ogrenci";
import { EDU_OPPORTUNITIES } from "@/lib/edu-opportunities";
import { evaluateGates } from "@/lib/social-calendar/gates";
import { LIMITS } from "@/lib/social-calendar/limits";
import { seriesByKey } from "@/lib/social-calendar/series";

const SLOT = "2026-10-16"; // Cuma
const d = (s: string) => new Date(`${s}T00:00:00Z`);
const f = (o: Partial<FirsatKaydi> & { id: string; title: string }): FirsatKaydi => ({
  kind: "burs", organizer: "TÜBİTAK BİDEB", country: "TR", deadline: null, deadlineNote: null, startsAt: null, eligibility: "Lisans öğrencisi.", sourceUrl: "https://tubitak.gov.tr/", ...o,
});

describe("aday kuralı", () => {
  it("dönemsel her zaman aday; tarihli yalnız son başvuru yayın günü ya da sonrası", () => {
    expect(firsatAdayMi({ deadline: null }, SLOT)).toBe(true);
    expect(firsatAdayMi({ deadline: d(SLOT) }, SLOT)).toBe(true);
    expect(firsatAdayMi({ deadline: d("2026-10-15") }, SLOT)).toBe(false);
    expect(OGRENCI).toMatchObject({ enCok: 3, enAz: 1 });
  });
  it("takvim satırı: tarih · dönem notu · dürüst yedek", () => {
    expect(takvimSatiri({ deadline: d("2026-11-16"), deadlineNote: null })).toBe("Son başvuru: 16 Kasım 2026");
    expect(takvimSatiri({ deadline: null, deadlineNote: "Her yıl Ekim'de" })).toBe("Dönemsel: Her yıl Ekim'de");
    expect(takvimSatiri({ deadline: null, deadlineNote: "  " })).toBe("Dönemsel: takvim kurumun resmî sayfasında duyurulur");
  });
  it("adaylar: kapananlar düşer; tarihliler yakın son başvuruya göre üstte, dönemseller adla altta; kullanıldı rozeti", () => {
    const L = firsatAdaylari(
      [
        f({ id: "z", title: "Zeta dönemsel" }),
        f({ id: "k", title: "Kapanan", deadline: d("2026-10-08") }),
        f({ id: "b", title: "B", deadline: d("2026-12-01"), kind: "staj", country: null }),
        f({ id: "a", title: "A dönemsel" }),
        f({ id: "c", title: "C", deadline: d("2026-11-16") }),
      ],
      SLOT,
      new Map([["c", "2026-10-09"]]),
    );
    expect(L.map((x) => x.id)).toEqual(["c", "b", "a", "z"]);
    expect(L[0]).toMatchObject({ sonBasvuru: "2026-11-16", turEtiketi: "Burs / destek", ulke: "Türkiye", kullanildi: "2026-10-09" });
    expect(L[1]).toMatchObject({ turEtiketi: "Staj / gözlemcilik", ulke: "Çok ülkeli" });
    expect(L[2]!.takvim.startsWith("Dönemsel:")).toBe(true);
  });
});

describe("taslak", () => {
  const sec = [f({ id: "d1", title: "Dönemsel burs", deadlineNote: "Ekim–Kasım" }), f({ id: "t1", title: "STAR", deadline: d("2026-11-16"), startsAt: "Ocak 2027" })];
  it("sayı sınırı: 0 ve 4 → null; 1–3 → taslak", () => {
    expect(buildOgrenciDraft([], SLOT)).toBeNull();
    expect(buildOgrenciDraft([1, 2, 3, 4].map((i) => f({ id: String(i), title: `F${i}` })), SLOT)).toBeNull();
    expect(buildOgrenciDraft(sec.slice(0, 1), SLOT)).not.toBeNull();
  });
  it("kapak + tarihli önce + dönemsel + kaynak; altyazı, etiketler, künyeler", () => {
    const p = buildOgrenciDraft(sec, SLOT)!;
    expect(p.slides.map((s) => s.role)).toEqual(["kapak", "genel", "genel", "kaynak"]);
    expect(p.slides[0]).toMatchObject({ title: "Tıp öğrencileri için 2 fırsat", body: "burs / destek" });
    expect(p.slides[1]).toMatchObject({ title: "STAR", body: "Burs / destek · Türkiye\nDüzenleyen: TÜBİTAK BİDEB\nSon başvuru: 16 Kasım 2026" });
    expect(p.slides[1]!.bullets).toEqual(["Kimler için: Lisans öğrencisi.", "Başlangıç: Ocak 2027"]);
    expect(p.slides[2]!.body).toContain("Dönemsel: Ekim–Kasım");
    expect(p.caption).toContain("Öğrenci köşesi · 16 Ekim 2026");
    expect(p.caption).toContain("• STAR — Son başvuru: 16 Kasım 2026");
    expect(p.hashtags.length).toBeLessThanOrEqual(LIMITS.hashtags);
    expect(p.sources.map((s) => s.label)).toEqual(["STAR", "Dönemsel burs"]);
    expect(siraliFirsatlar(sec).map((k) => k.id)).toEqual(["t1", "d1"]); // sourceIds sırası = slayt sırası
  });
  it("uzun şart özeti madde sınırına sığar", () => {
    const s = firsatSlayti(f({ id: "u", title: "U", eligibility: "çok ".repeat(200) }));
    expect(s.bullets![0]!.length).toBeLessThanOrEqual(LIMITS.bullet);
    expect(s.bullets![0]!.endsWith("…")).toBe(true);
  });
  it("⚖️ İŞKUR + terim dili: gerçek E1 kayıtlarıyla üretilen taslakta ilan/işe alım/pozisyon/kadro/maaş/hekim yok", () => {
    const kayitlar: FirsatKaydi[] = EDU_OPPORTUNITIES.map((o) => ({ ...o, deadline: o.deadline ? d(o.deadline) : null }));
    for (let i = 0; i < kayitlar.length; i += 3) {
      const t = JSON.stringify(buildOgrenciDraft(kayitlar.slice(i, i + 3), "2026-01-02")).toLocaleLowerCase("tr-TR");
      for (const w of ["hekim", "ilan", "işe alım", "pozisyon", "kadro", "maaş"]) expect(t.includes(w), w).toBe(false);
    }
  });
});

describe("onay kapısı — resmî ad istisnası Öğrenci köşesinde de", () => {
  const series = seriesByKey("ogrenci-kosesi")!;
  const sec = [f({ id: "x", title: "Diş Hekimliği Öğrencileri Yaz Stajı", organizer: "Türk Diş Hekimleri Birliği", kind: "staj" })];
  const ifade = (payload: ReturnType<typeof buildOgrenciDraft>, adlar: string[]) =>
    evaluateGates({ series, payload, attestIdentity: false, sourceIds: ["x"], sourceTexts: adlar }).gates.find((g) => g.id === "ifade")!;
  it("fırsatın/düzenleyenin RESMÎ ADINDAKİ 'Hekim' kapıyı düşürmez; adlar verilmezse yakalanır", () => {
    expect(ifade(buildOgrenciDraft(sec, SLOT), firsatResmiAdlari(sec)).ok).toBe(true);
    expect(ifade(buildOgrenciDraft(sec, SLOT), []).ok).toBe(false);
  });
  it("editörün kendi yazdığı 'hekim' yine yakalanır", () => {
    const p = buildOgrenciDraft(sec, SLOT)!;
    p.caption += "\n\nGeleceğin hekimleri!";
    expect(ifade(p, firsatResmiAdlari(sec)).ok).toBe(false);
  });
});
