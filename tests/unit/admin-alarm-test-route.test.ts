// Birim testleri — POST /api/admin/alarm-test (alarm kanalı tatbikatı, 2026-09-12).
// Sözleşme: yalnız ADMIN (self-auth — proxy /api'yi korumaz) · sendAlert "alarm-test" anahtarıyla ve
// yalnız İÇ ID'li detayla çağrılır (e-posta/PHI alarm detayına girmez) · yanıt alıcıyı MASKELİ döner
// (tam adres client'a gitmez) · ALERT_EMAIL boşsa recipient=null (arayüz "yalnız log" der).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/alerts", () => ({
  sendAlert: vi.fn(async () => ({ logged: true, emailed: true, suppressed: null })),
}));

import { POST } from "@/app/api/admin/alarm-test/route";
import { getCurrentUser } from "@/lib/auth";
import { sendAlert } from "@/lib/alerts";
import type { SessionUser } from "@/lib/session";

const user = (role: string, id = "admin-1") => ({ id, role, email: "kisi@example.test", name: "X" } as SessionUser);

beforeEach(() => {
  vi.mocked(getCurrentUser).mockReset();
  vi.mocked(sendAlert).mockClear();
  vi.stubEnv("ALERT_EMAIL", "ops@example.test");
  vi.stubEnv("RESEND_API_KEY", "re_test");
});

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/admin/alarm-test", () => {
  it("oturum yoksa 401 ve alarm tetiklenmez", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it("ADMIN dışı roller 401 — tatbikat düğmesi yalnız yöneticide (COORDINATOR/ETHICS gözetimi bile geçmez)", async () => {
    for (const role of ["DOCTOR", "COORDINATOR", "ETHICS", "PATIENT", "PARTNER"]) {
      vi.mocked(getCurrentUser).mockResolvedValue(user(role));
      expect((await POST()).status).toBe(401);
    }
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it("ADMIN: sendAlert 'alarm-test' anahtarı + yalnız iç ID'li detayla çağrılır; yanıt alıcıyı maskeler", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN", "u-admin"));
    const res = await POST();
    expect(res.status).toBe(200);
    expect(sendAlert).toHaveBeenCalledTimes(1);
    const [key, title, detail] = vi.mocked(sendAlert).mock.calls[0];
    expect(key).toBe("alarm-test");
    expect(title).toBeTruthy();
    expect(detail).toContain("u-admin");
    expect(detail).not.toContain("example.test"); // asla-loglama: e-posta/ad alarm detayına girmez
    const body = await res.json();
    expect(body.result).toEqual({ logged: true, emailed: true, suppressed: null });
    expect(body.recipient).toBe("op***@example.test");
    expect(body.providerConfigured).toBe(true);
  });

  it("ALERT_EMAIL boşsa recipient=null döner (arayüz 'yalnız günlük' uyarısı verir)", async () => {
    vi.stubEnv("ALERT_EMAIL", "");
    vi.mocked(getCurrentUser).mockResolvedValue(user("ADMIN"));
    const body = await (await POST()).json();
    expect(body.recipient).toBeNull();
    expect(sendAlert).toHaveBeenCalledTimes(1); // günlük kanalı yine tetiklenir
  });
});
