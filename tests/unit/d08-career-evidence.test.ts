import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { EDU_OPPORTUNITIES } from "@/lib/edu-opportunities";
import { CareerEvidenceNote, StudentPlanningGuides } from "@/app/doktor/doctorium/CareerEvidence";

describe("D08 source and audience evidence", () => {
  it("preserves WHO 18-month eligibility and makes support conditional", () => {
    const who = EDU_OPPORTUNITIES.find((o) => o.id === "who-internship")!;
    expect(who.eligibility).toContain("18 ayda");
    expect(who.eligibility).toContain("mali değerlendirmeye bağlıdır");
    expect(who.eligibility).toContain("sağlık ve kaza sigortası");
    expect(who.verifiedAt).toBe("2026-10-06");
  });
  it("retains three professional guides for students as planning links", () => {
    const html = renderToStaticMarkup(React.createElement(StudentPlanningGuides));
    for (const slug of ["uk-gmc", "tr-iyi-hal-belgesi", "tr-docentlik"]) expect(html).toContain(`/kariyer/${slug}`);
    expect(html).toContain("bugün uygun olduğunuz anlamına gelmez");
    writeFileSync("../d08-browser-fixture.html", `<!doctype html><html lang="tr"><title>Kariyer planlama</title><body><main>${html}</main></body></html>`);
  });
  it("explains partial confirmation without downgrading verified records", () => {
    const partial = renderToStaticMarkup(React.createElement(CareerEvidenceNote, { slug: "uk-gmc", confidence: "kismi" }));
    expect(partial).toContain("bazı bilgileri kısmen doğrulanmıştır");
    expect(partial).toContain("garanti etmez");
    const verified = renderToStaticMarkup(React.createElement(CareerEvidenceNote, { slug: "tr-docentlik", confidence: "dogrulandi" }));
    expect(verified).not.toContain("Teyit bekliyor:");
    expect(verified).not.toContain("doktora");
  });
});
