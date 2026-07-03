// Birim testleri — lib/auth.ts createSession preserveSv (consent-TOCTOU Seçenek A).
// preserveSv=true → sv token'daki (getCurrentUser'ın doğruladığı) değerden korunur, DB'den İKİNCİ okuma
// YAPILMAZ → eşzamanlı logout-all ile TOCTOU iptal-kaçışı kapanır. Varsayılan yol taze DB sv'siyle imzalar.
import { describe, it, expect, vi, beforeEach } from "vitest";

const setCookie = vi.fn();
vi.mock("next/headers", () => ({ cookies: async () => ({ set: setCookie }) }));
vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn() } } }));

import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/session";

const USER = { id: "u1", email: "a@b.c", name: "T", role: "PATIENT" as const };

describe("createSession preserveSv (consent TOCTOU)", () => {
  beforeEach(() => {
    setCookie.mockReset();
    vi.mocked(db.user.findUnique).mockReset();
  });

  it("varsayılan: sv DB'den TAZE okunur (login/signup/OAuth mint noktaları)", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ sessionVersion: 5 } as never);
    await createSession({ ...USER, sv: 0 }); // token'daki sv=0 olsa da DB'deki 5 kazanır
    expect(db.user.findUnique).toHaveBeenCalledOnce();
    const token = setCookie.mock.calls[0][1] as string;
    expect((await verifyToken(token))?.sv).toBe(5);
  });

  it("preserveSv: DB OKUNMAZ, sv token'dan korunur (iptal-kaçışı penceresi kapalı)", async () => {
    await createSession({ ...USER, sv: 3 }, { preserveSv: true });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    const token = setCookie.mock.calls[0][1] as string;
    expect((await verifyToken(token))?.sv).toBe(3);
  });

  it("preserveSv + user.sv undefined → 0 imzalanır (güvenli varsayılan)", async () => {
    await createSession({ ...USER }, { preserveSv: true });
    expect(db.user.findUnique).not.toHaveBeenCalled();
    const token = setCookie.mock.calls[0][1] as string;
    expect((await verifyToken(token))?.sv).toBe(0);
  });
});
