// Birim testleri — lib/rate-limit.ts (T12; v4.18 Upstash birincil + in-memory yedek).
// Testler env'siz koşar → in-memory yol; Upstash yolu ayrıca mock'lu senaryolarla kapsanır.
import { describe, it, expect, vi, beforeEach } from "vitest";

// next/server'ı hafif mock'la (gerçek Next runtime'ı node test ortamına çekmemek için).
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), init),
  },
}));

import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

describe("rateLimit (in-memory yol — env'siz)", () => {
  it("limit içinde ok, limit aşılınca reddeder", async () => {
    const key = "test-key-" + Math.random();
    for (let i = 0; i < 3; i++) {
      expect((await rateLimit(key, 3, 60_000)).ok).toBe(true);
    }
    const blocked = await rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("anahtarlar bağımsızdır", async () => {
    const a = "key-a-" + Math.random();
    const b = "key-b-" + Math.random();
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(false); // a tükendi
    expect((await rateLimit(b, 1, 60_000)).ok).toBe(true); // b bağımsız
  });

  it("pencere dolunca sayaç sıfırlanır", async () => {
    vi.useFakeTimers();
    try {
      const key = "window-" + Math.random();
      expect((await rateLimit(key, 1, 1000)).ok).toBe(true);
      expect((await rateLimit(key, 1, 1000)).ok).toBe(false); // pencere içinde
      vi.advanceTimersByTime(1500); // pencereyi geç
      expect((await rateLimit(key, 1, 1000)).ok).toBe(true); // sıfırlandı
    } finally {
      vi.useRealTimers();
    }
  });
});

// Upstash yolu — @upstash/redis mock'lu izole modül kopyasıyla (env + eval davranışı kontrol altında).
describe("rateLimit (Upstash yolu — mock)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  async function loadWithEval(evalImpl: (...a: unknown[]) => Promise<unknown>) {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://mock.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "mock-token");
    vi.doMock("@upstash/redis", () => ({ Redis: class { eval = evalImpl; } }));
    const mod = await import("@/lib/rate-limit");
    return mod.rateLimit;
  }

  it("limit içinde ok; sayaç limit üstüne çıkınca 429 + PTTL'den retryAfter", async () => {
    let n = 0;
    const rl = await loadWithEval(async () => [++n, 5000]);
    expect((await rl("k", 2, 60_000)).ok).toBe(true);
    expect((await rl("k", 2, 60_000)).ok).toBe(true);
    const blocked = await rl("k", 2, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBe(5); // 5000ms PTTL → 5 sn
  });

  it("Upstash hatasında fail-open: in-memory yedeğe düşer (istek kilitlenmez)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      const rl = await loadWithEval(async () => { throw new Error("bağlantı yok"); });
      const key = "failopen-" + Math.random();
      expect((await rl(key, 1, 60_000)).ok).toBe(true); // yedek saydı
      expect((await rl(key, 1, 60_000)).ok).toBe(false); // yedek limitledi
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});

describe("clientIp", () => {
  it("x-forwarded-for ilk değerini alır", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" } });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
  it("x-real-ip fallback", () => {
    const req = new Request("http://x", { headers: { "x-real-ip": "9.9.9.9" } });
    expect(clientIp(req)).toBe("9.9.9.9");
  });
  it("başlık yoksa 'unknown'", () => {
    expect(clientIp(new Request("http://x"))).toBe("unknown");
  });
});

describe("tooMany", () => {
  it("429 + Retry-After başlığı döner", () => {
    const res = tooMany(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
  });
});
