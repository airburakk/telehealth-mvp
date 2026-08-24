// navItemsFor — rol bazlı nav bileşimi matrisi (FAZ 2, 2026-07-04).
// Hasta nav kararı: PATIENT = Vakalarım · Post Op · Paylaşımlarım (Triyaj/Ücretsiz Sağlık Hizmeti/Doktorlar kalktı).
// Tam birleşme (2026-07-12): journey-bazlı SO daraltması KALDIRILDI — hasta nav'ı herkes için aynı,
// SO vakaları /vakalarim'daki karma listede.
import { describe, it, expect } from "vitest";
import { navItemsFor } from "@/lib/nav";

const hrefs = (role: string | null) => navItemsFor(role).map((n) => n.href);

describe("navItemsFor", () => {
  it("PATIENT: Vakalarım + Post Op + Paylaşımlarım; Triyaj/Ücretsiz Sağlık Hizmeti/Doktorlar YOK", () => {
    const h = hrefs("PATIENT");
    expect(h).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
    expect(h).not.toContain("/triyaj");
    expect(h).not.toContain("/ucretsiz-saglik/basvur");
    expect(h).not.toContain("/doktorlar");
  });

  it("PATIENT: SO daraltması yok — Vakalarım daima /vakalarim, Paylaşımlarım daima görünür (tam birleşme)", () => {
    const h = hrefs("PATIENT");
    expect(h).not.toContain("/second-opinion/vakalarim");
    expect(h).toContain("/paylasimlarim");
  });

  it("DOCTOR: Doktor + Post-Op + Doctorium (ayrışma 2026-08-24: toggle kalktı, sekme geri geldi)", () => {
    expect(hrefs("DOCTOR")).toEqual(["/doktor", "/doktor/takip", "/doktor/doctorium"]);
    expect(hrefs("DOCTOR")).not.toContain("/doktor/ucretsiz-saglik");
    expect(hrefs("DOCTOR")).not.toContain("/doktor/profil");
  });

  it("DOCTOR + student (v6.95): bant BOŞ — Doctorium'a giriş Header'daki marka bloğundan", () => {
    expect(navItemsFor("DOCTOR", { student: true }).map((n) => n.href)).toEqual([]);
  });

  it("DOCTOR + stage1 (v6.105, kullanıcı kararı 2026-08-17): AŞAMA 1 doktorunun bandı BOŞ — Doktor + Post-Op çizilmez", () => {
    const h = navItemsFor("DOCTOR", { stage1: true }).map((n) => n.href);
    expect(h).toEqual([]);
    expect(h).not.toContain("/doktor");
    expect(h).not.toContain("/doktor/takip");
  });

  it("stage1 bayrağı DOCTOR-dışı rolleri değiştirmez (koordinatör gözetimi daralmaz)", () => {
    expect(navItemsFor("COORDINATOR", { stage1: true }).map((n) => n.href)).toEqual(["/operasyon", "/doktor", "/doktor/takip", "/doktor/doctorium"]);
    expect(navItemsFor("PATIENT", { stage1: true }).map((n) => n.href)).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
    expect(navItemsFor("ADMIN", { stage1: true }).map((n) => n.href)).toEqual(["/admin", "/operasyon"]);
  });

  it("stage1=false DOCTOR (AURA üyeliği tam) bandını AYNEN görür — daraltma durum bazlı, kalıcı değil", () => {
    expect(navItemsFor("DOCTOR", { stage1: false }).map((n) => n.href)).toEqual(["/doktor", "/doktor/takip", "/doktor/doctorium"]);
  });

  it("student bayrağı DOCTOR-dışı rolleri değiştirmez (yanlış pozitif daraltma yok)", () => {
    expect(navItemsFor("COORDINATOR", { student: true }).map((n) => n.href)).toEqual(["/operasyon", "/doktor", "/doktor/takip", "/doktor/doctorium"]);
    expect(navItemsFor("PATIENT", { student: true }).map((n) => n.href)).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
    expect(navItemsFor("ADMIN", { student: true }).map((n) => n.href)).toEqual(["/admin", "/operasyon"]);
  });

  it("COORDINATOR: Operasyon + Doktor + Post-Op + Doctorium (ayrışma 2026-08-24); Ücretsiz Sağlık kalktı", () => {
    expect(hrefs("COORDINATOR")).toEqual(["/operasyon", "/doktor", "/doktor/takip", "/doktor/doctorium"]);
  });

  it("ADMIN bandı SADE (v6.73 iki tur, kullanıcı kararı): YALNIZ Yönetim + Operasyon — TAM liste", () => {
    // 11 öğe geniş ekranda bile taşıyordu; TÜM denetim kısayolları (Doktor/Doctorium/Sağlık
    // Turizmi dahil) /admin "Denetim görünümleri"ne indi.
    expect(hrefs("ADMIN")).toEqual(["/admin", "/operasyon"]);
  });

  it("Yönetim dizini (/admin) YALNIZ ADMIN'de (v6.71 — bant tek öğe, paneller dizinden dağılır)", () => {
    expect(hrefs("ADMIN")).toContain("/admin");
    expect(hrefs("DOCTOR")).not.toContain("/admin");
    expect(hrefs("COORDINATOR")).not.toContain("/admin");
    expect(hrefs("PATIENT")).not.toContain("/admin");
  });

  it("ETHICS ve PARTNER: tek sekme; rol yoksa boş", () => {
    expect(hrefs("ETHICS")).toEqual(["/etik-kurul"]);
    expect(hrefs("PARTNER")).toEqual(["/partner"]);
    expect(hrefs(null)).toEqual([]);
  });

  it("AGENCY ve HEALTH_PRO: tek sekme (2026-08-12 — Sağlık Uzmanı başlangıç paneli /uzman)", () => {
    expect(hrefs("AGENCY")).toEqual(["/acente"]);
    expect(hrefs("HEALTH_PRO")).toEqual(["/uzman"]);
  });
});
