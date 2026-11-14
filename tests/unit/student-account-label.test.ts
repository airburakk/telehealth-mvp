import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("next/navigation", () => ({ usePathname: () => "/doktor/doctorium" }));
vi.mock("@/components/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/SystemMessagesMenuItem", () => ({ SystemMessagesMenuItem: () => null }));
vi.mock("@/components/useT", () => ({ useT: () => ({ t: (text: string) => text }) }));
import { Header } from "@/components/Header";

function accountLabel(student: boolean, audience: string | null) {
  const html = renderToStaticMarkup(React.createElement(Header, { user: { name: "Synthetic", role: "DOCTOR" }, student, audience }));
  return html.match(/<div class="aura-mono mt-0\.5[^"]*">([^<]*)<\/div>/)?.[1];
}
describe("Student account identity", () => {
  it("uses the canonical Student audience when the legacy student flag is false", () => {
    expect(accountLabel(false, "STUDENT")).toBe("Tıp Öğrencisi");
  });
  it("does not let a stale legacy flag label a verified doctor as a student", () => {
    expect(accountLabel(true, "VERIFIED")).toBe("Doktor");
  });
  it.each(["NONE", "LOCKED"])("preserves unverified student-track identity for %s", audience => {
    expect(accountLabel(true, audience)).not.toBe("Doktor");
  });
  it("preserves the legacy label when no audience was provided", () => {
    expect(accountLabel(true, null)).toBe("Tıp Öğrencisi");
    expect(accountLabel(false, null)).toBe("Doktor");
  });
});
