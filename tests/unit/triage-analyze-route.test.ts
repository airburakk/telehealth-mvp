// Birim — POST /api/triage/analyze (kontrol raporu K04): kapı geçilmeden `runTriage` (LLM) HİÇ çağrılmaz.
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/ai-gate", () => ({ requireAiTriage: vi.fn() }));
vi.mock("@/lib/triage-llm", () => ({ runTriage: vi.fn(async () => ({ branch: "Nöroloji", branchKey: "noroloji", urgency: 2, confidence: 0.8, reasoning: "test" })) }));

import { POST } from "@/app/api/triage/analyze/route";
import { getCurrentUser } from "@/lib/auth";
import { requireAiTriage } from "@/lib/ai-gate";
import { runTriage } from "@/lib/triage-llm";
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/session";

const call = (b: unknown = { symptoms: "baş ağrısı" }) =>
  POST(new Request("http://localhost/api/triage/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }));

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset().mockResolvedValue({ id: "p1", role: "PATIENT" } as SessionUser);
  vi.mocked(requireAiTriage).mockReset();
  vi.mocked(runTriage).mockClear();
});

describe("POST /api/triage/analyze", () => {
  it("kimliksiz → 401, kapı ve LLM çağrılmaz", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(requireAiTriage).not.toHaveBeenCalled();
    expect(runTriage).not.toHaveBeenCalled();
  });

  it("kapı reddetti (403 rıza) → kapının yanıtı aynen döner, runTriage ÇAĞRILMAZ", async () => {
    vi.mocked(requireAiTriage).mockResolvedValue({ ok: false, response: NextResponse.json({ error: "rıza", code: "AI_CONSENT_REQUIRED" }, { status: 403 }) });
    const r = await call();
    expect(r.status).toBe(403);
    expect((await r.json()).code).toBe("AI_CONSENT_REQUIRED");
    expect(runTriage).not.toHaveBeenCalled();
  });

  it("kapı geçti → runTriage kapının NORMALİZE girdisiyle; yanıt soSuggested taşır", async () => {
    vi.mocked(requireAiTriage).mockResolvedValue({ ok: true, input: { symptoms: "baş ağrısı", answers: { q: "a" }, forceBranchKey: "noroloji" } });
    const r = await call();
    expect(r.status).toBe(200);
    expect(vi.mocked(runTriage).mock.calls[0][0]).toEqual({ symptoms: "baş ağrısı", answers: { q: "a" }, forceBranchKey: "noroloji" });
    const j = await r.json();
    expect(j.branch).toBe("Nöroloji");
    expect(typeof j.soSuggested).toBe("boolean");
  });
});
