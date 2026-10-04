// Birim — zincir temizliğinin saf kuralı (tests/integration/chain-tail.ts): hash-zincirinden yalnız UÇTAN geriye
// BİTİŞİK kendi satırlar silinebilir; araya yabancı satır girince yürüyüş durur (2026-10-04 yetim-satır olayı).
import { describe, it, expect } from "vitest";
import { ownContiguousTail } from "../integration/chain-tail";

const rows = (...ids: string[]) => ids.map((id) => ({ id }));

describe("ownContiguousTail — uçtan geriye bitişik kendi satırlar", () => {
  it("uç tamamen benimse hepsi silinir (uç-önce sırada)", () => {
    expect(ownContiguousTail(rows("r3", "r2", "r1"), new Set(["r1", "r2", "r3"]))).toEqual(["r3", "r2", "r1"]);
  });

  it("uç yabancıysa HİÇBİRİ silinmez (ortadan silme = yetim)", () => {
    expect(ownContiguousTail(rows("f", "r3", "r2", "r1"), new Set(["r1", "r2", "r3"]))).toEqual([]);
  });

  it("araya giren yabancı satırda durur: ondan sonrakiler (uca yakın) silinir, öncekiler kalır", () => {
    // Zincir (eski→yeni): r1 · f(prev=r1) · r2 · r3 → uç-önce: r3 r2 f r1 → yalnız r3, r2 silinir; r1 kalır (f yetim olmasın).
    expect(ownContiguousTail(rows("r3", "r2", "f", "r1"), new Set(["r1", "r2", "r3"]))).toEqual(["r3", "r2"]);
  });

  it("boş girdi / hiç kendi satırı yok → boş", () => {
    expect(ownContiguousTail([], new Set(["r1"]))).toEqual([]);
    expect(ownContiguousTail(rows("a", "b"), new Set())).toEqual([]);
  });
});
