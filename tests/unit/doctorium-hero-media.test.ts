import { describe, expect, it } from "vitest";
import { heroMotionAllowed, heroVideoEligible } from "@/lib/doctorium-hero-media";

describe("decorative hero media policy", () => {
  it("honors reduced motion and data/network preferences even on explicit play", () => {
    for (const [reduce, connection] of [[true, undefined], [false, { saveData: true }], [false, { effectiveType: "slow-2g" }], [false, { effectiveType: "2g" }], [false, { effectiveType: "3g" }]] as const) {
      const allowed = heroMotionAllowed(reduce, connection);
      expect(allowed).toBe(false);
      expect(heroVideoEligible({motionAllowed: allowed, desktop:true, requested:true, inView:true, tabVisible:true})).toBe(false);
    }
  });
  it("does not attach a mobile video until requested", () => {
    const policy={motionAllowed:true,desktop:false,requested:false,inView:true,tabVisible:true};
    expect(heroVideoEligible(policy)).toBe(false);
    expect(heroVideoEligible({...policy,requested:true})).toBe(true);
  });
  it("does not load in a hidden tab or out of view", () => {
    const policy={motionAllowed:true,desktop:true,requested:false,inView:true,tabVisible:true};
    expect(heroVideoEligible(policy)).toBe(true);
    expect(heroVideoEligible({...policy,inView:false})).toBe(false);
    expect(heroVideoEligible({...policy,tabVisible:false})).toBe(false);
    expect(heroMotionAllowed(false)).toBe(true);
  });
});
