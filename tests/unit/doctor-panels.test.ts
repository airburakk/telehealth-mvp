// panelVisibility — doktor Ana Sayfa pencerelerinin görünürlük matrisi.
// v6.105 (kullanıcı kararı 2026-08-17): İkinci Görüş + Sağlık Turizmi TERCİHE bağlandı.
//   ÖNCE: so = ünvanla otomatik · tourism = KOŞULSUZ açık
//   SONRA: so = soEligible(title) && soOptIn · tourism = tourismOptIn
// Bu dosya iki şeyi kilitler: (1) yeni matris, (2) ünvan kapısının opt-in ile AŞILAMAZ olması.
import { describe, it, expect } from "vitest";
import { panelVisibility, soEligible, type DoctorPanelFields } from "@/lib/doctor-home";

// Tüm tercihleri açık bir taban — testler yalnız ilgilendikleri alanı değiştirir.
const base: DoctorPanelFields = {
  title: "Prof. Dr.",
  freeCareOptIn: true,
  consultOptIn: true,
  soOptIn: true,
  tourismOptIn: true,
};

describe("soEligible — İkinci Görüş ünvan kapısı", () => {
  it("yalnız Doçent/Profesör geçer", () => {
    expect(soEligible("Prof. Dr.")).toBe(true);
    expect(soEligible("Doç. Dr.")).toBe(true);
    expect(soEligible("Uzm. Dr.")).toBe(false);
    expect(soEligible("Op. Dr.")).toBe(false);
    expect(soEligible(null)).toBe(false);
  });
});

describe("panelVisibility", () => {
  it("Uzaktan Sağlık (duty) DAİMA açık — tercihlerin hepsi kapalı olsa bile", () => {
    const v = panelVisibility({ title: null, freeCareOptIn: false, consultOptIn: false, soOptIn: false, tourismOptIn: false });
    expect(v.duty).toBe(true);
  });

  it("tam yetkili doktorda beş panel de açık", () => {
    const v = panelVisibility(base);
    expect(v).toEqual({ duty: true, so: true, freeCare: true, consult: true, tourism: true });
  });

  it("🔑 İkinci Görüş İKİ şart ister: ünvan VE tercih (dört kombinasyon)", () => {
    expect(panelVisibility({ ...base, title: "Prof. Dr.", soOptIn: true }).so).toBe(true);
    expect(panelVisibility({ ...base, title: "Prof. Dr.", soOptIn: false }).so).toBe(false); // tercih yok
    expect(panelVisibility({ ...base, title: "Uzm. Dr.", soOptIn: true }).so).toBe(false); // ünvan yok
    expect(panelVisibility({ ...base, title: "Uzm. Dr.", soOptIn: false }).so).toBe(false);
  });

  it("🔒 opt-in ünvan kapısını AŞAMAZ — migration herkesi true damgaladığı için bu kritik", () => {
    // Migration mevcut TÜM satırlara soOptIn=true yazar. Ünvanı uygun olmayan doktorda bu damga
    // paneli AÇMAMALI; aksi hâlde migration sessizce yetki dağıtmış olurdu.
    for (const title of ["Uzm. Dr.", "Op. Dr.", "Dr.", null]) {
      expect(panelVisibility({ ...base, title, soOptIn: true }).so).toBe(false);
    }
  });

  it("Sağlık Turizmi artık tercihe bağlı (v6.105 öncesi koşulsuz açıktı)", () => {
    expect(panelVisibility({ ...base, tourismOptIn: true }).tourism).toBe(true);
    expect(panelVisibility({ ...base, tourismOptIn: false }).tourism).toBe(false);
  });

  it("Sağlık Turizmi'nde ünvan şartı YOK — her branş doktoru seçebilir", () => {
    expect(panelVisibility({ ...base, title: "Uzm. Dr.", tourismOptIn: true }).tourism).toBe(true);
  });

  it("Ücretsiz Sağlık + Konsültasyon tercihe bağlı kalır (davranış değişmedi)", () => {
    expect(panelVisibility({ ...base, freeCareOptIn: false }).freeCare).toBe(false);
    expect(panelVisibility({ ...base, consultOptIn: false }).consult).toBe(false);
  });

  it("hiçbir tercih yoksa yalnız Uzaktan Sağlık açık kalır", () => {
    const v = panelVisibility({ title: "Prof. Dr.", freeCareOptIn: false, consultOptIn: false, soOptIn: false, tourismOptIn: false });
    expect(v).toEqual({ duty: true, so: false, freeCare: false, consult: false, tourism: false });
  });
});
