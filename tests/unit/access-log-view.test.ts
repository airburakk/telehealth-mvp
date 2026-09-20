// Birim — lib/access-log-view (kontrol raporu 2026-09-17 H12, v6.283): klinik erişim / teknik olay ayrımı, son-30-gün
// özeti ve etiket sözlüğü (bilinmeyen olay ham adıyla kalır, patlamaz).
import { describe, it, expect } from "vitest";
import { splitAccessLog, summarizeAccessLog, actionLabel, isClinicalAction, ACCESS_LOG_LABEL_TEXTS, CLINICAL_ACTION_TR, TECH_ACTION_TR } from "@/lib/access-log-view";
import { ACTION_TR } from "@/lib/audit-labels";

const NOW = Date.parse("2026-09-20T12:00:00.000Z");
const day = 86_400_000;
const e = (action: string, daysAgo: number, actorRole: string | null = "DOCTOR", actorIsYou = false) => ({
  action, actorRole, actorIsYou, createdAt: new Date(NOW - daysAgo * day).toISOString(),
});

describe("bölümleme", () => {
  it("LOGIN/parola/KEK olayları teknik; vaka/belge/görüşme olayları klinik", () => {
    const { clinical, technical } = splitAccessLog([e("CASE_VIEW", 1), e("LOGIN", 1), e("DOCUMENT_VIEW", 2), e("PASSWORD_CHANGE", 3), e("KEK_ROTATION", 4), e("CONSULT_START", 5)]);
    expect(clinical.map((x) => x.action)).toEqual(["CASE_VIEW", "DOCUMENT_VIEW", "CONSULT_START"]);
    expect(technical.map((x) => x.action)).toEqual(["LOGIN", "PASSWORD_CHANGE", "KEK_ROTATION"]);
    expect(isClinicalAction("RECOVERY_COMPLETE")).toBe(true);
    expect(isClinicalAction("LOGIN")).toBe(false);
  });
  it("etiketler: audit-labels sözlüğü korunur, teknik olay okunur ad alır, bilinmeyen ham kalır", () => {
    for (const [k, v] of Object.entries(ACTION_TR)) expect(actionLabel(k)).toBe(v);
    expect(actionLabel("LOGIN")).toBe("Hesaba giriş");
    expect(actionLabel("YENI_OLAY")).toBe("YENI_OLAY");
    for (const v of [...Object.values(CLINICAL_ACTION_TR), ...Object.values(TECH_ACTION_TR)]) expect(ACCESS_LOG_LABEL_TEXTS).toContain(v);
  });
});

describe("özet (son 30 gün, yalnız klinik)", () => {
  it("doktor / siz / diğer kırılımı; pencere dışı ve teknik olaylar sayılmaz", () => {
    const s = summarizeAccessLog([
      e("CASE_VIEW", 1, "DOCTOR"), e("CASE_VIEW", 2, "DOCTOR"), e("CASE_VIEW", 3, "PATIENT", true), e("DOCUMENT_VIEW", 4, "COORDINATOR"),
      e("CASE_VIEW", 31, "DOCTOR"), e("LOGIN", 1, "PATIENT", true),
    ], NOW);
    expect(s).toEqual({ days: 30, total: 4, doctor: 2, you: 1, other: 1 });
    expect(summarizeAccessLog([], NOW).total).toBe(0);
    expect(summarizeAccessLog([e("CASE_VIEW", 8)], NOW, 7).total).toBe(0);
  });
});
