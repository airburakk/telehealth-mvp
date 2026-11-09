import { describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/components/FamilyMedicineSourceStatus", () => ({ FamilyMedicineSourceStatus: () => createElement("section", { "data-source-status": true }) }));
vi.mock("@/app/doktor/doctorium/DoctoriumSidebar", () => ({ DoctoriumShell: ({ children }: { children: ReactNode }) => createElement("main", null, children) }));
import Page from "@/app/doktor/doctorium/aile-hekimligi/page";
import { FAMILY_MEDICINE_ENTRY_POINTS, FAMILY_MEDICINE_RESOURCES } from "@/lib/family-medicine";

describe("family medicine Doctorium presentation", () => {
  it("keeps the shared reading column, controls, source links and clinical safeguards", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("max-w-3xl");
    expect(html).not.toContain("max-w-5xl");
    expect(html).toContain("doctorium-module-eyebrow aura-mono");
    expect(html).toContain("/doktor/doctorium/tercihler");
    expect(html).toContain("aria-pressed=\"true\"");
    expect(html).toContain("bg-[#065f46]");
    expect(html).toContain("Klinik editör incelemesi:");
    expect(html).toContain("Henüz yapılmadı");
    expect(html).toContain("TASLAK · İNCELEME BEKLİYOR");
    expect(html).toContain("Bu ekrandaki işaretler yayın engellerini kaldırmaz.");
    expect(html).toContain("data-source-status");
    for (const item of FAMILY_MEDICINE_ENTRY_POINTS) expect(html).toContain(item.href.replaceAll("&", "&amp;"));
    for (const source of FAMILY_MEDICINE_RESOURCES) expect(html).toContain(source.url.replaceAll("&", "&amp;"));
  });
});
