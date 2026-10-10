// Regresyon nöbeti (2026-10-10) — giriş yapmış doktor, oturum yanıtı gelene kadar "○ Giriş yap" GÖRMEMELİ.
//
// Neden: P0-3'ten beri oturum istemcide /api/auth/me'den gelir. AppChrome'un ilk durumu `user: null` idi ve
// Header bunu "misafir" sayıyordu → her tam sayfa yüklemesinde yanıt dönene kadar (yerelde ~600 ms) giriş
// bağlantısı + tema anahtarı çiziliyordu. İçtihat aramasının GET form gönderiminden sonra fark edildi
// (yerelde Playwright ile ölçüldü: load'dan ~40 ms sonra "Giriş yap" görünür, /api/auth/me 200 + kullanıcı
// döndükten sonra avatar). Düzeltme: üç durumlu yuva (lib/header-auth-slot) + AppChrome'da "yanıt geldi" bayrağı.
// vitest ortamı "node" (DOM yok) → mantık saf fonksiyonla, kablolama kaynak sözleşmesiyle kilitlenir.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { headerAuthSlot } from "@/lib/header-auth-slot";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("headerAuthSlot — oturum bilinmiyorken misafir sayılmaz", () => {
  const user = { name: "Dr. Demo", role: "DOCTOR" };

  it("yanıt gelmeden ve kullanıcı yokken 'pending' (giriş bağlantısı çizilmez)", () => {
    expect(headerAuthSlot(null, false)).toBe("pending");
  });

  it("yanıt geldi, kullanıcı yok → 'guest'", () => {
    expect(headerAuthSlot(null, true)).toBe("guest");
  });

  it("kullanıcı varsa çözülme durumundan bağımsız 'account'", () => {
    expect(headerAuthSlot(user, true)).toBe("account");
    expect(headerAuthSlot(user, false)).toBe("account");
  });
});

describe("AppChrome ↔ Header kablolaması", () => {
  const chrome = read("src/components/AppChrome.tsx");
  const header = read("src/components/Header.tsx");

  it("AppChrome çözülmemiş başlar ve istek düşse de çözülür (finally)", () => {
    expect(chrome).toMatch(/useState\(false\)/);
    expect(chrome).toMatch(/\.finally\(\(\) => setMeResolved\(true\)\)/);
    expect(chrome).toMatch(/authPending=\{!meResolved\}/);
  });

  it("Header 'pending' dalını giriş bağlantısından ÖNCE değerlendirir", () => {
    const pending = header.indexOf('authSlot === "pending"');
    const login = header.indexOf('t("Giriş yap")}</span>');
    expect(pending, "pending dalı bulunamadı").toBeGreaterThan(-1);
    expect(login, "giriş bağlantısı bulunamadı").toBeGreaterThan(-1);
    expect(pending).toBeLessThan(login);
  });
});
