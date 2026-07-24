// talk-tracker — hasta süreç göstergesi faz eşlemesi (DOCS_PENDING paketi, 2026-07-24).
// Yeni davranışı kilitler: belge-bekleyen başvuruda "Başvuru" fazı AKTİF kalır (done değil) —
// hasta doktor kuyruğundaymış gibi görünmez; NEW'de mevcut davranış (faz 1 aktif) değişmez.
import { describe, it, expect } from "vitest";
import { talkTrackerPhases, TALK_TRACKER_TEXTS } from "@/lib/talk-tracker";

describe("talkTrackerPhases", () => {
  it("DOCS_PENDING: Başvuru fazı aktif — belge alt-durumu; sonraki fazlar pending", () => {
    const phases = talkTrackerPhases({ status: "DOCS_PENDING", bookingStatus: null, hasRecovery: false });
    expect(phases[0].state).toBe("active");
    expect(phases[0].sub).toBe("Belgeleriniz bekleniyor — yüklendiğinde başvurunuz doktora iletilir");
    expect(phases.slice(1).every((p) => p.state === "pending")).toBe(true);
  });

  it("NEW: mevcut davranış — Başvuru done, Görüşme aktif (kuyruk alt-durumu)", () => {
    const phases = talkTrackerPhases({ status: "NEW", bookingStatus: null, hasRecovery: false });
    expect(phases[0].state).toBe("done");
    expect(phases[1].state).toBe("active");
    expect(phases[1].sub).toBe("Uzman doktor kuyruğuna eklendiniz");
  });

  it("DOCS_PENDING alt-durumu çeviri listesinde (TALK_TRACKER_TEXTS)", () => {
    expect(TALK_TRACKER_TEXTS).toContain("Belgeleriniz bekleniyor — yüklendiğinde başvurunuz doktora iletilir");
  });
});
