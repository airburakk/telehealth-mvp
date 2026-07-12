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

  it("DOCTOR: değişmedi (Doktor, Post-Op, Ücretsiz Sağlık Hizmeti, Profilim); hasta sekmeleri yok", () => {
    expect(hrefs("DOCTOR")).toEqual(["/doktor", "/doktor/takip", "/doktor/ucretsiz-saglik", "/doktor/profil"]);
  });

  it("COORDINATOR: Operasyon + Doktor + Post-Op + Ücretsiz Sağlık Hizmeti", () => {
    expect(hrefs("COORDINATOR")).toEqual(["/operasyon", "/doktor", "/doktor/takip", "/doktor/ucretsiz-saglik"]);
  });

  it("ADMIN: hasta sekmesi kaldırma ADMIN'i etkilemez (Triyaj/Doktorlar ADMIN'de kalır)", () => {
    const h = hrefs("ADMIN");
    expect(h).toContain("/triyaj");
    expect(h).toContain("/hekimler");
    expect(h).toContain("/vakalarim");
    expect(h).toContain("/paylasimlarim");
    expect(h).not.toContain("/takip"); // Post Op hub yalnız PATIENT (personel /doktor/takip kullanır)
  });

  it("ETHICS ve PARTNER: tek sekme; rol yoksa boş", () => {
    expect(hrefs("ETHICS")).toEqual(["/etik-kurul"]);
    expect(hrefs("PARTNER")).toEqual(["/partner"]);
    expect(hrefs(null)).toEqual([]);
  });
});
