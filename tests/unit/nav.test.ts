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
    expect(h).not.toContain("/hekimler");
  });

  it("PATIENT: SO daraltması yok — Vakalarım daima /vakalarim, Paylaşımlarım daima görünür (tam birleşme)", () => {
    const h = hrefs("PATIENT");
    expect(h).not.toContain("/second-opinion/vakalarim");
    expect(h).toContain("/paylasimlarim");
  });

  it("DOCTOR: Doktor + Post-Op; Doctorium bant sekmesi marka toggle'ına taşındı (2026-08-16)", () => {
    expect(hrefs("DOCTOR")).toEqual(["/doktor", "/doktor/takip"]);
    expect(hrefs("DOCTOR")).not.toContain("/doktor/doctorium");
    expect(hrefs("DOCTOR")).not.toContain("/doktor/ucretsiz-saglik");
    expect(hrefs("DOCTOR")).not.toContain("/doktor/profil");
  });

  it("DOCTOR + student (v6.95 + 2026-08-16): bant BOŞ — Doctorium'a tek giriş Header toggle'ı", () => {
    expect(navItemsFor("DOCTOR", { student: true }).map((n) => n.href)).toEqual([]);
  });

  it("student bayrağı DOCTOR-dışı rolleri değiştirmez (yanlış pozitif daraltma yok)", () => {
    expect(navItemsFor("COORDINATOR", { student: true }).map((n) => n.href)).toEqual(["/operasyon", "/doktor", "/doktor/takip"]);
    expect(navItemsFor("PATIENT", { student: true }).map((n) => n.href)).toEqual(["/vakalarim", "/takip", "/paylasimlarim"]);
    expect(navItemsFor("ADMIN", { student: true }).map((n) => n.href)).toEqual(["/admin", "/operasyon"]);
  });

  it("COORDINATOR: Operasyon + Doktor + Post-Op; Doctorium sekmesi toggle'a taşındı, Ücretsiz Sağlık kalktı", () => {
    expect(hrefs("COORDINATOR")).toEqual(["/operasyon", "/doktor", "/doktor/takip"]);
    expect(hrefs("COORDINATOR")).not.toContain("/doktor/doctorium");
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
