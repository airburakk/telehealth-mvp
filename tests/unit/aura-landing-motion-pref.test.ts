import { describe, it, expect, vi } from "vitest";
import { MOTION_KEY, readMotionPref, writeMotionPref } from "@/lib/aura-landing/motion-pref";

// Paket 6 (v6.299): hero hareket tercihi — saf okuma/yazma; depo yok/hatalı → "on"; "off" yalnız açık yazımla.
function fakeStore(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((k: string) => m.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void m.set(k, v)),
    removeItem: vi.fn((k: string) => void m.delete(k)),
    map: m,
  };
}

describe("motion-pref (Paket 6)", () => {
  it("varsayılan on; yalnız 'off' değeri off sayılır", () => {
    expect(readMotionPref(fakeStore())).toBe("on");
    expect(readMotionPref(fakeStore({ [MOTION_KEY]: "off" }))).toBe("off");
    expect(readMotionPref(fakeStore({ [MOTION_KEY]: "garip" }))).toBe("on");
    expect(readMotionPref(null)).toBe("on");
  });
  it("depo hata fırlatırsa on (fail-open) ve yazım sessizce yutulur", () => {
    const bad = { getItem: () => { throw new Error("blocked"); } };
    expect(readMotionPref(bad)).toBe("on");
    const badW = { setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
    expect(() => writeMotionPref("off", badW)).not.toThrow();
    expect(() => writeMotionPref("on", null)).not.toThrow();
  });
  it("off yazımı anahtarı koyar, on yazımı siler (temiz depo)", () => {
    const s = fakeStore();
    writeMotionPref("off", s);
    expect(s.setItem).toHaveBeenCalledWith(MOTION_KEY, "off");
    expect(readMotionPref(s)).toBe("off");
    writeMotionPref("on", s);
    expect(s.removeItem).toHaveBeenCalledWith(MOTION_KEY);
    expect(readMotionPref(s)).toBe("on");
  });
});
