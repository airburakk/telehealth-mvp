import { beforeEach, describe, expect, it, vi } from "vitest";
const m=vi.hoisted(()=>({digest:vi.fn(),congress:vi.fn(),edu:vi.fn(),audit:vi.fn(),alert:vi.fn(),gate:vi.fn()}));
vi.mock("@/lib/cron-guard",()=>({cronGate:m.gate,errText:()=>"synthetic error"}));
vi.mock("@/lib/daily-digest",()=>({runDailyDigests:m.digest}));
vi.mock("@/lib/congress-reminder",()=>({remindCongressFollows:m.congress}));
vi.mock("@/lib/edu-reminder",()=>({remindEduFollows:m.edu}));
vi.mock("@/lib/audit",()=>({recordAccess:m.audit}));
vi.mock("@/lib/alerts",()=>({sendAlert:m.alert}));
import { GET } from "@/app/api/cron/daily-digest/route";
beforeEach(()=>{vi.resetAllMocks();m.digest.mockResolvedValue({checked:1,produced:1,emailed:0,emailSimulated:0,skippedEmpty:0,skippedDone:0,failed:0});m.congress.mockResolvedValue({checked:0,start:0,abstract:0,earlybird:0,failed:0});m.edu.mockResolvedValue({checked:0,sent:0,emailed:0,failed:0});});
describe("D20 mocked route result",()=>{
 it("counts returned partial failure without stopping other workers",async()=>{m.digest.mockResolvedValue({checked:1,produced:1,emailed:0,emailSimulated:0,skippedEmpty:0,skippedDone:0,failed:1});const r=await GET(new Request("http://localhost/api/cron/daily-digest"));expect((await r.json()).ok).toBe(false);expect(m.edu).toHaveBeenCalledOnce();expect(m.alert).toHaveBeenCalledOnce()});
 it("success, exception and brand/auth gate are explicit",async()=>{expect((await(await GET(new Request("http://localhost"))).json()).ok).toBe(true);m.edu.mockRejectedValue(new Error("fixture"));expect((await(await GET(new Request("http://localhost"))).json()).ok).toBe(false);m.gate.mockReturnValue(new Response("blocked",{status:401}));m.digest.mockClear();expect((await GET(new Request("http://localhost"))).status).toBe(401);expect(m.digest).not.toHaveBeenCalled()});
});
