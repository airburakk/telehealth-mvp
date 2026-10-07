import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, afterAll } from "vitest";
import { ictihatSearchInput, ictihatWhere, ictihatHref, literalParts, ictihatExcerpt } from "@/lib/ictihat-search";
import { IctihatMatch } from "@/app/doktor/doctorium/IctihatMatch";
vi.stubGlobal("React", React);
afterAll(() => vi.unstubAllGlobals());

describe("bounded case-law search", () => {
  it("accepts old 2-80 character phrase bounds without silently truncating invalid searches", () => {
    expect(ictihatSearchInput("  E.\n  2020/1  ", "2", "tazminat")).toMatchObject({query:"E. 2020/1",page:2,error:null,keyword:{key:"tazminat"}});
    expect(ictihatSearchInput("",undefined).error).toBeNull();
    for(const q of ["a", "x".repeat(81), ["onam","tazminat"]]) expect(ictihatSearchInput(q,"1").error).toBeTruthy();
  });
  it("bounds page values and allowlists topics", () => {
    for(const p of ["Infinity","-1","1e3",["2","3"]]) expect(ictihatSearchInput("onam",p).page).toBe(1);
    expect(ictihatSearchInput("onam","999","../admin")).toMatchObject({page:100,keyword:null});
  });
  it("ANDs topic and new-only predicates without broadening module/category", () => {
    const since = new Date("2026-10-06");
    const w=ictihatWhere("onam",["tazminat"],since);
    expect(w).toMatchObject({module:"mevzuat",category:"ictihat",createdAt:{gte:since}});
    expect(w.AND).toEqual([{OR:[{title:{contains:"onam",mode:"insensitive"}},{summary:{contains:"onam",mode:"insensitive"}}]}, {OR:[{summary:{contains:"tazminat",mode:"insensitive"}}]}]);
  });
  it("treats LIKE wildcards and SQL-looking query text literally", () => {
    const w=ictihatWhere("%' OR 1=1 --_\\");
    expect(JSON.stringify(w)).toContain("\\\\%"); expect(JSON.stringify(w)).toContain("\\\\_");
    expect(w.category).toBe("ictihat");
  });
  it("generates fixed local URLs retaining only supported search context", () => {
    const u=new URL(ictihatHref("//evil.test?q=x&next=/admin",2,"tazminat",true),"https://fixture.test");
    expect(u.origin).toBe("https://fixture.test"); expect([...u.searchParams.keys()]).toEqual(["m","h","q","k","n","ip"]);
    expect(ictihatHref("",1,"bogus",true)).toBe("/doktor/doctorium?m=mevzuat&h=ictihat&n=1");
  });
});
describe("safe case-law match presentation", () => {
  it("highlights literal regex metacharacters without executing HTML", () => {
    const html=renderToStaticMarkup(React.createElement(IctihatMatch, {text:'<img src=x onerror="alert(1)"> [a.*]',query:"[a.*]"}));
    expect(html).not.toContain("<img"); expect(html).toContain("&lt;img"); expect(html).toContain("[a.*]</mark>");
  });
  it("preserves original Turkish and supplementary Unicode text while matching", () => {
    const text="😀 İÇTİHAT için içtihat ve IĞDIR";
    const parts=literalParts(text,"içtihat");
    expect(parts.filter(p=>p.match).map(p=>p.text)).toEqual(["İÇTİHAT","içtihat"]);
    expect(parts.map(p=>p.text).join("")).toBe(text);
    expect(literalParts(text,"ığdır").filter(p=>p.match).map(p=>p.text)).toEqual(["IĞDIR"]);
  });
  it("caps highlights and centers a bounded excerpt on late matches", () => {
    const text="x".repeat(1000)+" tazminat "+"z".repeat(1000);
    expect(ictihatExcerpt(text,"tazminat")).toContain("tazminat");
    expect(ictihatExcerpt(text,"tazminat").length).toBeLessThanOrEqual(242);
    const repeated="onam ".repeat(100); const p=literalParts(repeated,"onam");
    expect(p.filter(v=>v.match)).toHaveLength(20); expect(p.map(v=>v.text).join("")).toBe(repeated);
    expect(literalParts("abc","")).toEqual([{text:"abc",match:false}]);
  });
});
