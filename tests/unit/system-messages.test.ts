// Sistem mesajları + etik kurul savunma talebi (v6.79) — saf çekirdek birim testleri.
// DB'li yollar (sendSystemMessage, tek-yanıt atomik kilidi, GET süzmesi) dev tarayıcı turu +
// API sözleşmesiyle doğrulanır; burada yönlendirme matrisi ve zaman-bazlı kilit sınanır.
import { describe, expect, it } from "vitest";
import { resolveDefenseTargetPure, computeDefenseLock } from "@/lib/system-messages";
import { RESPONDENT_TYPES, DEFENSE_LOCK_DAYS } from "@/lib/ethics";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("resolveDefenseTargetPure — savunma talebi yönlendirme matrisi", () => {
  it("DOCTOR + atanmış doktorun kullanıcı hesabı → KİŞİSEL hedef", () => {
    expect(resolveDefenseTargetPure("DOCTOR", "user-1")).toEqual({ userId: "user-1" });
  });

  it("DOCTOR ama doktor hesabı yok (atanmamış vaka) → koordinatöre düşer, doktorlara yayın YOK", () => {
    expect(resolveDefenseTargetPure("DOCTOR", null)).toEqual({ role: "COORDINATOR" });
  });

  it("AGENCY → rol yayını (vakaya bağlı acente hesabı yok — MVP sınırı)", () => {
    expect(resolveDefenseTargetPure("AGENCY", null)).toEqual({ role: "AGENCY" });
  });

  it("HOSPITAL ve OTHER → koordinatör (platformda hesabı olmayan taraflar; kullanıcı kararı)", () => {
    expect(resolveDefenseTargetPure("HOSPITAL", null)).toEqual({ role: "COORDINATOR" });
    expect(resolveDefenseTargetPure("OTHER", null)).toEqual({ role: "COORDINATOR" });
  });

  it("respondentType yok (v6.79 öncesi eski başvuru) → koordinatör, talep boşluğa düşmez", () => {
    expect(resolveDefenseTargetPure(null, null)).toEqual({ role: "COORDINATOR" });
  });
});

describe("computeDefenseLock — karar kilidi: yanıt VEYA 3 gün (cron'suz, zaman-bazlı)", () => {
  const now = new Date("2026-08-05T12:00:00Z");

  it("yanıtsız + süre içinde → KİLİTLİ, until = talep + 3 gün", () => {
    const createdAt = new Date(now.getTime() - 1 * DAY_MS);
    const r = computeDefenseLock([{ createdAt, repliedAt: null }], now);
    expect(r.locked).toBe(true);
    expect(r.until?.getTime()).toBe(createdAt.getTime() + DEFENSE_LOCK_DAYS * DAY_MS);
  });

  it("yanıt gelmiş → AÇIK (süre dolmasa bile)", () => {
    const createdAt = new Date(now.getTime() - 1 * DAY_MS);
    const r = computeDefenseLock([{ createdAt, repliedAt: now }], now);
    expect(r.locked).toBe(false);
    expect(r.until).toBeNull();
  });

  it("süre dolmuş (3 günden eski, yanıtsız) → kendiliğinden AÇIK", () => {
    const createdAt = new Date(now.getTime() - (DEFENSE_LOCK_DAYS + 1) * DAY_MS);
    const r = computeDefenseLock([{ createdAt, repliedAt: null }], now);
    expect(r.locked).toBe(false);
  });

  it("tam sınırda (deadline == now) → açık (kilit '>' ile tanımlı)", () => {
    const createdAt = new Date(now.getTime() - DEFENSE_LOCK_DAYS * DAY_MS);
    const r = computeDefenseLock([{ createdAt, repliedAt: null }], now);
    expect(r.locked).toBe(false);
  });

  it("birden çok açık talep → EN GEÇ deadline kazanır (yeni talep kilidi uzatır)", () => {
    const old = new Date(now.getTime() - 2 * DAY_MS);
    const fresh = new Date(now.getTime() - 0.5 * DAY_MS);
    const r = computeDefenseLock(
      [{ createdAt: old, repliedAt: null }, { createdAt: fresh, repliedAt: null }],
      now
    );
    expect(r.locked).toBe(true);
    expect(r.until?.getTime()).toBe(fresh.getTime() + DEFENSE_LOCK_DAYS * DAY_MS);
  });

  it("talep yok → açık", () => {
    expect(computeDefenseLock([], now)).toEqual({ locked: false, until: null });
  });
});

describe("RESPONDENT_TYPES sözleşmesi (API allowlist bu anahtarlara bağlı)", () => {
  it("tam 4 tip: DOCTOR / AGENCY / HOSPITAL / OTHER", () => {
    expect(Object.keys(RESPONDENT_TYPES).sort()).toEqual(["AGENCY", "DOCTOR", "HOSPITAL", "OTHER"]);
  });

  it("kilit süresi 3 gün (kullanıcı kararı 2026-08-05) — değiştiren bu testi bilinçli güncellesin", () => {
    expect(DEFENSE_LOCK_DAYS).toBe(3);
  });
});
