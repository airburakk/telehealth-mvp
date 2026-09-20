// Birim — lib/doctor-profile.ts (kontrol raporu 2026-09-19 D04): GERÇEK profilde eksik mesleki bilgi ÜRETİLMEZ.
// Eskiden okul isim hash'inden, üyelikler branş sabitlerinden, yayın deneyimi cümlesi sabit metinden üretiliyor ve bu
// üretim demo/gerçek ayırmıyordu. Artık üretim yalnız demo:true modunda; gerçek profil yalnız DB alanlarını gösterir.
import { describe, it, expect } from "vitest";
import { doctorCredentials, richBio, academicNote, isDemoDoctorAccount, type DoctorLike } from "@/lib/doctor-profile";

const base: DoctorLike = {
  id: "d1", name: "Ali Veli", title: "Uzm. Dr.", branch: "Onkoloji", city: "İzmir", languages: "Türkçe,İngilizce",
  experienceYears: 8, rating: null, jci: null, verified: true,
};
const REAL = { demo: false };
const DEMO = { demo: true };

describe("isDemoDoctorAccount", () => {
  it("bağlı hesap yok ya da *@air.test → demo; gerçek e-posta → gerçek", () => {
    expect(isDemoDoctorAccount(null)).toBe(true);
    expect(isDemoDoctorAccount(undefined)).toBe(true);
    expect(isDemoDoctorAccount("doktor@air.test")).toBe(true);
    expect(isDemoDoctorAccount("Dr.X@AIR.TEST")).toBe(true);
    expect(isDemoDoctorAccount("ali.veli@hastane.com.tr")).toBe(false);
  });
});

describe("doctorCredentials — gerçek profilde üretim yok", () => {
  it("boş alanlar → okul/uzmanlık null, sertifika boş; yıl deneyimden TÜRETİLMEZ", () => {
    const c = doctorCredentials(base, REAL);
    expect(c.diploma).toEqual({ school: null, year: null });
    expect(c.uzmanlik).toEqual({ board: null, year: null });
    expect(c.certs).toEqual([]);
  });
  it("DB alanları varsa aynen (JSON sertifika listesi dahil)", () => {
    const c = doctorCredentials({ ...base, eduSchool: "Ege Üniversitesi Tıp Fakültesi", eduYear: 2010, specBoard: "Tıbbi Onkoloji", specYear: 2016, certifications: JSON.stringify(["ESMO üyeliği"]) }, REAL);
    expect(c.diploma).toEqual({ school: "Ege Üniversitesi Tıp Fakültesi", year: 2010 });
    expect(c.uzmanlik).toEqual({ board: "Tıbbi Onkoloji", year: 2016 });
    expect(c.certs).toEqual(["ESMO üyeliği"]);
  });
  it("demo modda eski üretim sürer (okul hash'ten, üyelikler branştan, yıl deneyimden)", () => {
    const c = doctorCredentials(base, DEMO);
    expect(c.diploma.school).toMatch(/Tıp Fakültesi/);
    expect(c.uzmanlik.board).toBe("Tıbbi Onkoloji Yan Dal Uzmanlığı");
    expect(c.certs.length).toBeGreaterThan(0);
    expect(c.uzmanlik.year).toBe(2018);
  });
  it("mode verilmezse geriye uyumlu (demo) — çağıranlar D04 ile açıkça geçirir", () => {
    expect(doctorCredentials(base).diploma.school).not.toBeNull();
  });
});

describe("academicNote / richBio — gerçek profilde iddia üretilmez", () => {
  it("gerçek + boş alanlar → academicNote null (arayüz 'eklenmedi' yazar)", () => {
    expect(academicNote(base, REAL)).toBeNull();
  });
  it("gerçek + yalnız okul → yalnız okul cümlesi; 'bilimsel yayın deneyimi' cümlesi YOK", () => {
    const n = academicNote({ ...base, eduSchool: "Ege Üniversitesi Tıp Fakültesi" }, REAL)!;
    expect(n).toBe("Ege Üniversitesi Tıp Fakültesi mezunu.");
    expect(n).not.toMatch(/yayın deneyimi/);
  });
  it("gerçek + yayın listesi → 'Seçilmiş yayınlar' yazılır", () => {
    const n = academicNote({ ...base, publications: JSON.stringify([{ title: "X", venue: "Y", year: 2020 }]) }, REAL)!;
    expect(n).toMatch(/Seçilmiş yayınlar: “X” \(Y, 2020\)\./);
  });
  it("demo → eski üretim (yayın yoksa genel cümle)", () => {
    expect(academicNote(base, DEMO)).toMatch(/bilimsel yayın deneyimi bulunmaktadır/);
  });
  it("richBio gerçek → yalnız olgusal cümleler (bio + deneyim/şehir/branş + diller); odak/yaklaşım iddiası YOK", () => {
    const b = richBio(base, "Kendi yazdığım bio.", REAL);
    expect(b).toContain("Kendi yazdığım bio.");
    expect(b).toContain("8 yılı aşkın klinik deneyimiyle İzmir'de Onkoloji alanında hizmet vermektedir.");
    expect(b).toContain("Türkçe, İngilizce dillerinde hizmet sunar.");
    expect(b).not.toMatch(/multidisipliner|Kanıta dayalı|JCI/);
    expect(richBio({ ...base, jci: true }, null, REAL)).toMatch(/JCI akrediteli bir merkezde çalışır/); // yalnız jci:true
  });
  it("richBio demo → odak cümlesi sürer", () => {
    expect(richBio(base, null, DEMO)).toMatch(/multidisipliner tümör konseyi/);
  });
});
