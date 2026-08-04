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

  it("DOCTOR: Doktor + Post-Op + Doctorium; Profilim bant linki hesap menüsüne taşındı (2026-08-01)", () => {
    expect(hrefs("DOCTOR")).toEqual(["/doktor", "/doktor/takip", "/doktor/doctorium"]);
    expect(hrefs("DOCTOR")).not.toContain("/doktor/ucretsiz-saglik");
    expect(hrefs("DOCTOR")).not.toContain("/doktor/profil");
  });

  it("COORDINATOR: Operasyon + Doktor + Post-Op + Doctorium; Ücretsiz Sağlık bant linki kalktı", () => {
    expect(hrefs("COORDINATOR")).toEqual(["/operasyon", "/doktor", "/doktor/takip", "/doktor/doctorium"]);
  });

  it("ADMIN bandı SADE (v6.73, kullanıcı kararı): Yönetim önde + Operasyon/Doktor/Doctorium — TAM liste", () => {
    // 11 öğe geniş ekranda bile taşıyordu; denetim kısayolları /admin "Denetim görünümleri"ne indi.
    expect(hrefs("ADMIN")).toEqual(["/admin", "/operasyon", "/doktor", "/doktor/doctorium"]);
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
});
