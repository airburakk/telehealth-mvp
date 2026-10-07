import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import { afterAll, expect, it, vi } from "vitest";
import { ArticleCard } from "@/app/doktor/doctorium/ArticleCard";
import { AcademicSummaryBlock } from "@/app/doktor/doctorium/AcademicSummaryBlock";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());
it("preserves content labels, links and the clinical disclaimer", () => {
  const cards = ["makale", "lansman", "ictihat", "mevzuat"].map(kind => React.createElement(ArticleCard, {
    key: kind, saved: null, item: {id: `fixture-${kind}`, module: kind === "makale" ? "akademik" : kind === "lansman" ? "ilac" : "mevzuat", kind, source: "fixture", title: "Kontrast ölçümü için sentetik içerik", titleOriginal: null, summary: "Sentetik görünüm verisi", sourceName: "Sentetik kaynak", authors: null, url: null, doi: null, publishedAt: new Date("2026-10-06T00:00:00Z"), branchSlugs: [], category: null, hasAiSummary: false, imageUrl: null}
  }));
  const html = renderToStaticMarkup(React.createElement("main", {className: "doctorium-scope", style: {background: "var(--c-bg)", padding: "24px", maxWidth: "900px", margin: "auto"}},
    React.createElement("ul", null, cards), React.createElement(AcademicSummaryBlock, {summary: {takeaways: ["Sentetik görünüm: klinik öneri içermez."], design: "Sentetik test", limits: "Yalnız görsel kontrast doğrulaması"}})));
  for (const label of ["MAKALE", "KLİNİK FAZ", "İÇTİHAT", "MEVZUAT", "Ana çıkarımlar", "KLİNİK KARAR ARACI DEĞİLDİR"]) expect(html).toContain(label);
  for (const kind of ["makale", "lansman", "ictihat", "mevzuat"]) expect(html).toContain(`href="/doktor/doctorium/fixture-${kind}"`);
  expect(html).not.toContain("Kaydet");
  if (process.env.D28_FIXTURE_OUT) writeFileSync(process.env.D28_FIXTURE_OUT, html);
});
