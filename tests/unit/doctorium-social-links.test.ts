// Doctorium sosyal hesap listesi — 2026-10-09: Facebook + YouTube eklendi, footer resmî logolara geçti,
// /doctorium JSON-LD'sine Organization.sameAs girdi. Nöbet: liste tek kaynak; sameAs ondan türer, kopmaz.
import { describe, it, expect } from "vitest";
import { DOCTORIUM_SOCIAL_LINKS, doctoriumSameAs } from "@/components/aura/doctorium-social-links";

describe("DOCTORIUM_SOCIAL_LINKS", () => {
  it("beş resmî hesap, sabit sırada", () => {
    expect(DOCTORIUM_SOCIAL_LINKS.map((s) => s.key)).toEqual(["instagram", "x", "linkedin", "facebook", "youtube"]);
  });

  it("her adres https ve marka kullanıcı adı doctoriumtr", () => {
    for (const s of DOCTORIUM_SOCIAL_LINKS) {
      const url = new URL(s.href);
      expect(url.protocol).toBe("https:");
      expect(s.href.toLowerCase()).toContain("doctoriumtr");
    }
  });

  it("Facebook kişisel profil biçimli /people/ adresi KULLANMAZ", () => {
    const fb = DOCTORIUM_SOCIAL_LINKS.find((s) => s.key === "facebook");
    expect(fb?.href).not.toContain("/people/");
  });

  it("sameAs = footer listesi (aynı sıra, tekrar yok)", () => {
    const same = doctoriumSameAs();
    expect(same).toEqual(DOCTORIUM_SOCIAL_LINKS.map((s) => s.href));
    expect(new Set(same).size).toBe(same.length);
  });
});
