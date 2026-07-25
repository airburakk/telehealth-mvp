// pending-docs-reminder — DOCS_PENDING hatırlatma karar mantığı (2026-07-24, kullanıcı kararı:
// günde 1 × en fazla 3). shouldRemind saf fonksiyonunu kilitler; DB'li remindPendingDocs akışı
// dev uçtan uca doğrulamayla kanıtlanır (birim testte DB yok — t10 deseni).
import { describe, it, expect } from "vitest";
import { shouldRemind, REMINDER_CAP, REMINDER_INTERVAL_MS } from "@/lib/pending-docs-reminder";

const now = new Date("2026-07-24T12:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

describe("shouldRemind", () => {
  it("son bildirim 24 saatten yeni → hatırlatma YOK (günde 1 penceresi)", () => {
    expect(shouldRemind(1, hoursAgo(23), now)).toBe(false);
  });

  it("son bildirim 24 saat+ eski → hatırlatılır", () => {
    expect(shouldRemind(1, hoursAgo(25), now)).toBe(true);
    expect(shouldRemind(1, new Date(now.getTime() - REMINDER_INTERVAL_MS), now)).toBe(true); // tam sınır dahil
  });

  it("tavan: ilk bildirim + CAP hatırlatma dolunca susar", () => {
    // count = ilk bildirim dahil toplam → 1 + REMINDER_CAP'e kadar gönderilir, üstü susar
    expect(shouldRemind(REMINDER_CAP, hoursAgo(48), now)).toBe(true); // son hatırlatma hakkı
    expect(shouldRemind(REMINDER_CAP + 1, hoursAgo(48), now)).toBe(false); // tavan doldu
  });

  it("hiç bildirim yoksa (beklenmez ama) gönderilir", () => {
    expect(shouldRemind(0, null, now)).toBe(true);
  });
});
