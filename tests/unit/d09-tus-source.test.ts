import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { approvedTusSummaries, tusRowsFor } from "@/lib/tus-data";
import { TusSourceNote } from "@/app/doktor/doctorium/tus/TusSourceNote";

describe("D09 official placement scope", () => {
  it("retains the official totals and over-quota row", async () => {
    const last = approvedTusSummaries().find((p) => p.year === 2026 && p.term === 1)!;
    expect(last.totals.general).toMatchObject({ quota: 9855, placed: 8106, vacant: 1752 });
    const rows = await tusRowsFor("2026-1");
    const gazi = rows.find((r) => r.code === "104100234")!;
    expect(gazi).toMatchObject({ quota: 1, placed: 2, vacant: 0 });
  });
  it("shows exact-period PDF, scope, import date and matching-score AND preference note", () => {
    const p = approvedTusSummaries().find((p) => p.year === 2026 && p.term === 1)!;
    const html = renderToStaticMarkup(React.createElement(TusSourceNote, { period: p }));
    expect(html).toContain(p.sourcePdf);
    expect(html).toContain("GENEL kontenjan");
    expect(html).toContain("tercih sırası aynı");
    expect(html).toContain("ÖSYM yayın tarihi değildir");
    expect(html).toContain("104100234");
    expect(html).toContain('dateTime="2026-09-05"');
    writeFileSync("../d09-browser-fixture.html", `<!doctype html><html lang="tr"><title>TUS kaynak</title><body><main>${html}</main></body></html>`);
  });
  it("uses the selected historical source without attaching a different period's evidence", () => {
    const p = approvedTusSummaries()[0];
    const html = renderToStaticMarkup(React.createElement(TusSourceNote, { period: p }));
    expect(html).toContain(p.sourcePdf);
    expect(html).not.toContain("104100234");
    expect(html).toContain("Geçmiş dönem verisidir");
  });
});
