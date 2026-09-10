// Terk edilmiş hesap süpürmesi — saf sözleşmeler (05 madde 3.1b, Paket 2, 2026-09-09). DB-bağlı
// sweepAbandonedAccounts burada koşmaz (vitest DB-siz — trial-sweep.test.ts deseni); yalnız SAF
// karar fonksiyonu (abandonedActionFor) + bağlantı/allow-list sözleşmeleri test edilir.
import { describe, it, expect } from "vitest";
import {
  abandonedActionFor, abandonedPurgeDateFor, ABANDONED_LOGIN_URL, ABANDONED_MS, NOTICE_THRESHOLD_MS,
} from "@/lib/abandoned-sweep";
import { DOCTORIUM_CANONICAL_URL } from "@/lib/brand";
import { DOCTORIUM_NOTIFICATION_TYPES } from "@/lib/notify";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-09T00:00:00.000Z");

describe("abandonedActionFor — bugün gönderilen bildirim bugün imhaya yol açmaz", () => {
  it("eşiğin altında: aksiyon yok", () => {
    const lastActivity = new Date(NOW.getTime() - (NOTICE_THRESHOLD_MS - DAY_MS));
    expect(abandonedActionFor({ lastActivity, alreadyNoticed: false, now: NOW })).toBeNull();
  });

  it("bildirim eşiğine gelmiş + henüz bildirilmemiş: notice", () => {
    const lastActivity = new Date(NOW.getTime() - NOTICE_THRESHOLD_MS);
    expect(abandonedActionFor({ lastActivity, alreadyNoticed: false, now: NOW })).toBe("notice");
  });

  it("bildirim eşiğini geçmiş ama zaten bildirilmiş + silme eşiğine henüz gelmemiş: aksiyon yok", () => {
    const lastActivity = new Date(NOW.getTime() - (NOTICE_THRESHOLD_MS + DAY_MS));
    expect(abandonedActionFor({ lastActivity, alreadyNoticed: true, now: NOW })).toBeNull();
  });

  it("silme eşiğine gelmiş + zaten bildirilmiş: purge", () => {
    const lastActivity = new Date(NOW.getTime() - ABANDONED_MS);
    expect(abandonedActionFor({ lastActivity, alreadyNoticed: true, now: NOW })).toBe("purge");
  });

  it("silme eşiğine gelmiş AMA henüz bildirilmemiş (cron hiç koşmadıysa): purge DEĞİL, önce notice", () => {
    const lastActivity = new Date(NOW.getTime() - ABANDONED_MS - 10 * DAY_MS);
    expect(abandonedActionFor({ lastActivity, alreadyNoticed: false, now: NOW })).toBe("notice");
  });
});

describe("abandonedPurgeDateFor", () => {
  it("son aktiviteden tam 3 yıl sonrası", () => {
    const lastActivity = new Date("2026-09-09T00:00:00.000Z");
    expect(abandonedPurgeDateFor(lastActivity).getTime()).toBe(lastActivity.getTime() + ABANDONED_MS);
  });
});

describe("bağlantılar + allow-list", () => {
  it("giriş bağlantısı Doctorium kanonik kökünden", () => {
    expect(ABANDONED_LOGIN_URL).toBe(`${DOCTORIUM_CANONICAL_URL}/doctorium/giris`);
  });

  it("ABANDONED_NOTICE Doctorium zilinde görünür (fail-closed allow-list)", () => {
    const types: readonly string[] = DOCTORIUM_NOTIFICATION_TYPES;
    expect(types).toContain("ABANDONED_NOTICE");
  });
});
