// Birim — lib/appointment-window (kontrol raporu 2026-09-17 H03, v6.283): İkinci Görüş randevusunun üç evresi
// (kuruldu / pencere açık / saat geçti), TSİ biçimi ve yerel saat notu (yurtdışı hasta).
import { describe, it, expect } from "vitest";
import { appointmentPhase, formatApptTr, localTimePart, APPT_PHASE_TEXT, APPT_OPEN_BEFORE_MIN, APPT_OPEN_AFTER_MIN, TR_TZ } from "@/lib/appointment-window";

const AT = "2026-09-20T11:30:00.000Z"; // 14:30 TSİ
const t = Date.parse(AT);
const min = 60_000;

describe("appointmentPhase", () => {
  it("15 dk öncesine kadar 'upcoming', −15…+60 dk 'open', sonrası 'past' (sınırlar dahil)", () => {
    expect(appointmentPhase(AT, t - (APPT_OPEN_BEFORE_MIN + 1) * min)).toBe("upcoming");
    expect(appointmentPhase(AT, t - APPT_OPEN_BEFORE_MIN * min)).toBe("open");
    expect(appointmentPhase(AT, t)).toBe("open");
    expect(appointmentPhase(AT, t + APPT_OPEN_AFTER_MIN * min)).toBe("open");
    expect(appointmentPhase(AT, t + (APPT_OPEN_AFTER_MIN + 1) * min)).toBe("past");
    expect(appointmentPhase(new Date(AT), t - 86_400_000)).toBe("upcoming");
  });
  it("her evrenin TR cümlesi var; 'katıl' yalnız açık pencerede", () => {
    expect(APPT_PHASE_TEXT.upcoming).toMatch(/15 dk/);
    expect(APPT_PHASE_TEXT.open).toMatch(/katılın/);
    expect(APPT_PHASE_TEXT.past).toMatch(/geçti/);
  });
});

describe("saat biçimi", () => {
  it("formatApptTr Türkiye saatiyle + (TSİ) eki", () => {
    const s = formatApptTr(AT);
    expect(s).toContain("(TSİ)");
    expect(s).toContain("14:30");
    expect(s).toContain("2026");
    expect(formatApptTr(AT, "en-GB")).toContain("14:30");
  });
  it("localTimePart: Türkiye dilimi/boş → null; Berlin → bir saat geri", () => {
    expect(localTimePart(AT, TR_TZ)).toBeNull();
    expect(localTimePart(AT, null)).toBeNull();
    const b = localTimePart(AT, "Europe/Berlin");
    expect(b?.tz).toBe("Europe/Berlin");
    expect(b?.time).toContain("13:30");
    expect(localTimePart(AT, "Not/AZone")).toBeNull(); // geçersiz dilim patlatmaz
  });
});
