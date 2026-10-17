import { describe, expect, it } from "vitest";
import { verifyEventPage } from "@/lib/social-calendar/event-evidence";
import { publicAddress, readPrimaryPage } from "@/lib/social-calendar/primary-page";
import type { EtkinlikKaydi } from "@/lib/social-calendar/etkinlik";

const event: EtkinlikKaydi = {
  id: "e1", title: "42. Ulusal Kardiyoloji Kongresi", organizer: "Türk Kardiyoloji Derneği",
  city: "Antalya", country: "TR", venue: "Salon", startDate: new Date("2026-10-30Z"), endDate: new Date("2026-11-03Z"),
  abstractDeadline: new Date("2026-10-25Z"), earlyBirdDeadline: null, eventType: "kongre", scope: "ulusal",
  ttbCode: "K123", url: "https://example.org/kongre", warning: null,
};
const ld = (extra: object = {}) => `<script type="application/ld+json">${JSON.stringify({ "@type": "Event", name: event.title,
  startDate: "2026-10-30T09:00:00+03:00", endDate: "2026-11-03", ...extra })}</script>`;

describe("primary event evidence", () => {
  it("accepts current structured dates and removes claims the page does not confirm", () => {
    const result = verifyEventPage(event, ld());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.event).toMatchObject({ city: null, venue: null, organizer: null, ttbCode: null, abstractDeadline: null });
  });
  it("accepts exact visible name and cross-month Turkish date range", () => {
    const result = verifyEventPage(event, `<h1>${event.title}</h1><p>30 Ekim – 03 Kasım 2026 Antalya</p>`);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.event.city).toBe("Antalya");
  });
  it("does not let an old visible date override a contradictory structured event", () => {
    const oldText = `${event.title} 30 Ekim – 3 Kasım 2026`;
    for (const extra of [{ startDate: "2025-10-30" }, { endDate: "2026-11-04" }, { eventStatus: "https://schema.org/EventCancelled" }]) {
      expect(verifyEventPage(event, ld(extra) + oldText)).toMatchObject({ ok: false, reason: "primary-date-conflict" });
    }
  });
  it("requires identity and both dates on the same structured record", () => {
    expect(verifyEventPage(event, ld({ name: "Other congress" }))).toMatchObject({ ok: false });
    expect(verifyEventPage(event, ld({ endDate: undefined }))).toMatchObject({ ok: false });
    expect(verifyEventPage(event, "2026-10-30 2026-11-03")).toMatchObject({ ok: false });
    expect(verifyEventPage(event, ld({ startDate: "2026-10-30-invalid" }))).toMatchObject({ ok: false });
    expect(verifyEventPage(event, `${event.title} 30 Ekim – 3 Kasım 2026 Etkinlik ertelenmiştir.`)).toMatchObject({ ok: false, reason: "primary-event-status" });
  });
  it("ignores malformed JSON and script-only text; supports JSON-LD graphs", () => {
    expect(verifyEventPage(event, '<script type="application/ld+json">bad</script>')).toMatchObject({ ok: false });
    expect(verifyEventPage(event, `<script>${event.title} 30 Ekim – 3 Kasım 2026</script>`)).toMatchObject({ ok: false });
    const graph = { "@graph": [{ "@type": "Event", name: event.title, startDate: "2026-10-30", endDate: "2026-11-03" }] };
    expect(verifyEventPage(event, `<script type="application/ld+json">${JSON.stringify(graph)}</script>`).ok).toBe(true);
  });
});

describe("bounded public HTTPS reader", () => {
  it("rejects private, special, mapped and transition addresses", () => {
    for (const address of ["127.0.0.1", "10.1.1.1", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "198.18.0.1", "192.0.2.1", "192.88.99.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "::1", "::ffff:127.0.0.1", "fc00::1", "fe80::1", "2001:db8::1", "2002:7f00::1", "3fff::1", "invalid"]) {
      expect(publicAddress(address), address).toBe(false);
    }
    for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2a00:1450:4001::1"]) expect(publicAddress(address)).toBe(true);
  });
  it("rejects unsafe URLs before doing any network operation", async () => {
    for (const url of ["http://example.org", "https://user:password@example.org", "https://example.org:8443", "https://127.0.0.1", "file:///tmp/test"]) {
      await expect(readPrimaryPage(url)).rejects.toThrow("primary-url-rejected");
    }
  });
});
