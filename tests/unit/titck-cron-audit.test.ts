import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ ingest: vi.fn(), audit: vi.fn(), gate: vi.fn(), alert: vi.fn() }));
vi.mock("@/lib/doctorium-ingest", () => ({ ingestDoctorium: m.ingest }));
vi.mock("@/lib/audit", () => ({ recordAccess: m.audit }));
vi.mock("@/lib/alerts", () => ({ sendAlert: m.alert }));
vi.mock("@/lib/cron-guard", () => ({ cronGate: m.gate, errText: () => "failure" }));
import { GET } from "@/app/api/cron/ingest-doctorium/route";
beforeEach(() => { vi.clearAllMocks(); m.gate.mockReturnValue(null); });
describe("TİTCK cron source audit", () => {
  it.each([
    [{ "titck-recalls": [20, 3] }, [], "titck=3/20"],
    [{ "titck-recalls": [0, 0] }, ["titck-recalls: unavailable"], "titck=failed"],
    [{}, [], "titck=not-run"],
  ])("keeps successful, failed and absent source runs distinct", async (sources, errors, expected) => {
    m.ingest.mockResolvedValue({ pubmedNew: 0, pubmedFetched: 0, gazetteNew: 0, gazetteFetched: 0, sources, errors });
    const response = await GET(new Request("https://example.test/api/cron/ingest-doctorium"));
    expect(response.status).toBe(200);
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ detail: expect.stringContaining(expected as string) }));
  });
});
