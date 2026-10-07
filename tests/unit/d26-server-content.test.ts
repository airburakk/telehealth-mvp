import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { FadeInUp } from "@/components/aura/doctorium-v3/motion";
import { SeckiPage } from "@/components/aura/doctorium-secki/SeckiPage";

vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

describe("D26 server content remains usable before hydration", () => {
  it("renders decorative section content without an initial hidden style", () => {
    const html = renderToStaticMarkup(React.createElement(FadeInUp, { delay: 0.2, className: "fixture", children: React.createElement("h2", null, "Server section heading") }));
    expect(html).toContain("Server section heading");
    expect(html).not.toContain("opacity:0");
    expect(html).not.toContain("visibility:hidden");
  });
  it("retains populated secki headings and source/navigation links in HTML", () => {
    const view = {day:"2026-10-06",dateLabel:"6 Ekim 2026",rotationLabel:"Kardiyoloji",items:[{id:"d26-fixture",kicker:"Akademik",branchLabel:null,title:"Fixture seçki başlığı",source:"Fixture Journal",href:"https://example.test/source",host:"example.test"}]};
    const html = renderToStaticMarkup(React.createElement(SeckiPage, { view }));
    expect(html).toContain("<h1");
    expect(html).toContain("Fixture seçki başlığı");
    expect(html).toContain('href="https://example.test/source"');
    expect(html).toContain('href="/doctorium"');
    expect(html).toContain('rel="noopener"');
  });
});
