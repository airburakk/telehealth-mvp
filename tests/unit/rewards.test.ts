// Anket ödül puanları (v6.88) — saf mantık sözleşmeleri.
// DB'li yollar (redeemReward advisory lock, transitionRedemption iade satırı, awardSurveyPoints
// idempotency) entegrasyon işidir; burada ledger aritmetiği + durum makinesi + honorarium
// kilidinin puandan BAĞIMSIZLIĞI kilitlenir (puan ≠ nakit: puanlı anket yayınlanabilir).
import { describe, it, expect } from "vitest";
import {
  REWARD_KINDS, REDEMPTION_STATUSES, MAX_SURVEY_POINTS,
  balanceFromEntries, canRedeem, canTransitionRedemption, refundNeeded, REWARD_TERMS_TEXT,
} from "@/lib/rewards";
import { canActivateSurvey } from "@/lib/survey";

describe("Ledger aritmetiği: bakiye = SUM(delta)", () => {
  it("boş ledger = 0", () => {
    expect(balanceFromEntries([])).toBe(0);
  });
  it("kazanç + harcama + iade doğru toplanır", () => {
    // 50 kazanç → 30 harcama → 30 iade → 20 kazanç = 70
    expect(balanceFromEntries([{ delta: 50 }, { delta: -30 }, { delta: 30 }, { delta: 20 }])).toBe(70);
  });
});

describe("Talep ön-kontrolü (canRedeem)", () => {
  const item = { active: true, pointsCost: 100 };
  it("bakiye yeterliyse geçer", () => {
    expect(canRedeem(item, 100).ok).toBe(true);
  });
  it("yetersiz bakiye reddedilir", () => {
    const r = canRedeem(item, 99);
    expect(r.ok).toBe(false);
  });
  it("pasif kalem talep edilemez (bakiye yetse de)", () => {
    expect(canRedeem({ active: false, pointsCost: 100 }, 1000).ok).toBe(false);
  });
  it("sıfır/negatif bedelli kalem talep edilemez (korkuluk)", () => {
    expect(canRedeem({ active: true, pointsCost: 0 }, 1000).ok).toBe(false);
  });
});

describe("Talep durum makinesi (canTransitionRedemption)", () => {
  it("admin: REQUESTED → APPROVED | REJECTED", () => {
    expect(canTransitionRedemption("REQUESTED", "APPROVED", true)).toBe(true);
    expect(canTransitionRedemption("REQUESTED", "REJECTED", true)).toBe(true);
    expect(canTransitionRedemption("REQUESTED", "FULFILLED", true)).toBe(false); // onaysız teslim yok
  });
  it("admin: APPROVED → FULFILLED | REJECTED", () => {
    expect(canTransitionRedemption("APPROVED", "FULFILLED", true)).toBe(true);
    expect(canTransitionRedemption("APPROVED", "REJECTED", true)).toBe(true);
  });
  it("uç durumlar geri sarılmaz (ledger izi korunur)", () => {
    for (const from of ["FULFILLED", "REJECTED", "CANCELLED"]) {
      for (const to of REDEMPTION_STATUSES) {
        expect(canTransitionRedemption(from, to, true)).toBe(false);
      }
    }
  });
  it("doktor: yalnız kendi REQUESTED talebini iptal edebilir", () => {
    expect(canTransitionRedemption("REQUESTED", "CANCELLED", false)).toBe(true);
    expect(canTransitionRedemption("APPROVED", "CANCELLED", false)).toBe(false); // onaylıyı admin yönetir
    expect(canTransitionRedemption("REQUESTED", "APPROVED", false)).toBe(false); // doktor kendini onaylayamaz
  });
});

describe("İade kuralı (refundNeeded)", () => {
  it("ret ve iptal iade üretir; onay ve teslim üretmez", () => {
    expect(refundNeeded("REJECTED")).toBe(true);
    expect(refundNeeded("CANCELLED")).toBe(true);
    expect(refundNeeded("APPROVED")).toBe(false);
    expect(refundNeeded("FULFILLED")).toBe(false);
  });
});

describe("Rejim bağımsızlığı: puan ≠ nakit honorarium", () => {
  it("honorarium kilidi puandan etkilenmez (puanlı ücretsiz anket yayınlanabilir)", () => {
    expect(canActivateSurvey({ honorarium: null })).toBe(true);
    expect(canActivateSurvey({ honorarium: 0 })).toBe(true);
  });
  it("nakit honorarium kilidi AYNEN durur (regresyon)", () => {
    expect(canActivateSurvey({ honorarium: 5000 })).toBe(false);
  });
});

describe("Sabit sözleşmeler", () => {
  it("ödül türleri üç kulvar: yurt içi kongre · uluslararası kongre · kitap", () => {
    expect([...REWARD_KINDS]).toEqual(["KONGRE_TR", "KONGRE_INTL", "KITAP"]);
  });
  it("anket-başı puan tavanı makul aralıkta", () => {
    expect(MAX_SURVEY_POINTS).toBeGreaterThan(0);
  });
  it("koşul metni NİHAİ (v6.210): parasal-değersizlik + puan iadesi + kapalı katalog; TASLAK ibaresi YOK", () => {
    expect(REWARD_TERMS_TEXT).toContain("parasal değer taşımaz");
    expect(REWARD_TERMS_TEXT).toContain("kazanılmış hak doğurmaz");
    expect(REWARD_TERMS_TEXT).toContain("puanlarınız iade edilir"); // kodla uyum: REDEEM_REFUND
    expect(REWARD_TERMS_TEXT).toContain("katalog o güne kadar kapalıdır"); // madde 5 ⏸️ park — yer tutucu değil, dürüst cümle
    expect(REWARD_TERMS_TEXT).not.toContain("(TASLAK)");
    expect(REWARD_TERMS_TEXT).not.toMatch(/\[[A-ZİŞĞÜÖÇ ]+\]/); // "[MALİ MÜŞAVİR …]" gibi yer tutucu canlıya SIZMAZ
  });
});
