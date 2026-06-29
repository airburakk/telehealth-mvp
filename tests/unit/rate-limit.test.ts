// Birim testleri — lib/rate-limit.ts (T12 in-memory rate limiter). next/server mock'lanır.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// next/server'ı hafif mock'la (gerçek Next runtime'ı node test ortamına çekmemek için).
vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: ResponseInit) =>
      new Response(JSON.stringify(body), init),
  },
}));

import { rateLimit, clientIp, tooMany } from "@/lib/rate-limit";

describe("rateLimit", () => {
  it("limit içinde ok, limit aşılınca reddeder", () => {
    const key = "test-key-" + Math.random();
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    }
    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("anahtarlar bağımsızdır", () => {
    const a = "key-a-" + Math.random();
    const b = "key-b-" + Math.random();
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false); // a tükendi
    expect(rateLimit(b, 1, 60_000).ok).toBe(true); // b bağımsız
  });

  it("pencere dolunca sayaç sıfırlanır", () => {
    vi.useFakeTimers();
    try {
      const key = "window-" + Math.random();
      expect(rateLimit(key, 1, 1000).ok).toBe(true);
      expect(rateLimit(key, 1, 1000).ok).toBe(false); // pencere içinde
      vi.advanceTimersByTime(1500); // pencereyi geç
      expect(rateLimit(key, 1, 1000).ok).toBe(true); // sıfırlandı
    } finally {
      vi.useRealTimers();
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
