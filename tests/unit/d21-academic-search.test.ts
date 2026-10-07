import { describe, expect, it } from "vitest";
import { academicSearchInput, academicWhere, academicHref } from "@/lib/academic-search";

describe("academic search input and query contract", () => {
  it("normalizes whitespace/control characters and permits clearing", () => {
    expect(academicSearchInput("  renal\n  therapy  ", "2")).toEqual({query:"renal therapy",error:null,page:2});
    expect(academicSearchInput(" ", undefined)).toEqual({query:"",error:null,page:1});
  });
  it("rejects repeated, short and oversized query parameters", () => {
    for (const q of [["renal", "other"], "ab", "x".repeat(121)]) expect(academicSearchInput(q, "1").error).toBeTruthy();
  });
  it("bounds pages including repeated/malformed/non-finite parameters", () => {
    for (const p of ["0", "-1", "NaN", "Infinity", "1e3", ["2", "3"]]) expect(academicSearchInput("renal", p).page).toBe(1);
    expect(academicSearchInput("renal", "999").page).toBe(100);
  });
  it("ANDs branch and date access filters with all six searchable fields", () => {
    const since = new Date("2026-10-06");
    const where = academicWhere(["kardiyoloji"], "renal", since);
    expect(where.module).toBe("akademik"); expect(where.createdAt).toEqual({gte:since});
    expect(where.AND).toEqual([{OR:[{branchSlugs:{contains:'"kardiyoloji"'}}]}, {OR:
      ["title","titleOriginal","sourceName","source","summary","summaryOriginal"].map(f=>({[f]:{contains:"renal",mode:"insensitive"}}))}]);
  });
  it("keeps SQL/LIKE metacharacters literal and does not change structural predicates", () => {
    const where = academicWhere(["radyoloji"], "%' OR 1=1 --_\\");
    expect(JSON.stringify(where)).toContain("\\\\%");
    expect(where.module).toBe("akademik"); expect((where.AND as unknown[])).toHaveLength(2);
  });
  it("constructs only local allowlisted query URLs, preserving new filter", () => {
    const u = new URL(academicHref("//evil.test/?next=x&ap=99", 2, true), "https://fixture.test");
    expect(u.origin).toBe("https://fixture.test"); expect([...u.searchParams.keys()]).toEqual(["m","q","n","ap"]);
    expect(u.searchParams.get("q")).toBe("//evil.test/?next=x&ap=99");
    expect(academicHref("",1,true)).toBe("/doktor/doctorium?m=akademik&n=1");
  });
});
