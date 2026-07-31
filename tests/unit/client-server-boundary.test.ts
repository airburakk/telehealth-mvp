// Regresyon nöbeti — sunucu-only modüllerin CLIENT bileşenlerine sızmaması (2026-07-31).
//
// GERÇEK OLAY: `MasterPanel.tsx` ("use client") yalnızca rol etiketleri için `@/lib/session`
// import ediyordu. O modül yüklenirken `resolveSessionSecret()` çalışır ve ÜRETİMDE
// SESSION_SECRET yoksa THROW eder — tarayıcıda o değişken tanımsız olduğundan master paneli
// PRODUCTION'da komple çöktü ("Bir şeyler ters gitti"), DEV'de ise kontrol sadece uyarı
// verdiği için sorun görünmedi. tsc de build de yakalamaz: tip olarak her şey geçerli.
//
// Bu test o sınıfı statik olarak kapatır: bir dosya "use client" ile başlıyorsa, yasak
// sunucu modüllerini import edemez. Rol sabitleri için sırsız `@/lib/roles` vardır.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const SRC = join(process.cwd(), "src");

// Modül yüklenirken sır/DB/sunucu kaynağı isteyen modüller — client'ta çalışamazlar.
const SERVER_ONLY = [
  "@/lib/session", // SESSION_SECRET doğrular (bu olayın kaynağı)
  "@/lib/db", // Prisma istemcisi
  "@/lib/auth", // next/headers + DB
  "@/lib/crypto", // DATA_ENCRYPTION_KEK
  "@/lib/audit", // DB + zincir mührü
];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);

describe("client/server modül sınırı", () => {
  it("kaynak ağacı taranabiliyor (nöbetin kendisi çalışıyor mu)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it('"use client" dosyaları sunucu-only modülleri import etmez', () => {
    const ihlaller: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      // Dosyanın ilk anlamlı satırı "use client" mı?
      if (!/^\s*(\/\/.*\n|\/\*[\s\S]*?\*\/\n|\s)*["']use client["']/.test(src)) continue;
      for (const mod of SERVER_ONLY) {
        const q = mod.replace(/[/@]/g, "\\$&");
        if (!new RegExp(`from\\s+["']${q}["']`).test(src)) continue;
        // `import type { X } from "mod"` DERLEMEDE SİLİNİR → modül runtime'da hiç yüklenmez, güvenli.
        // Karışık form (`import { type X, Y }`) muaf DEĞİL: Y bir değer importudur, modülü yükletir.
        const safTipImport = new RegExp(`import\\s+type\\s[^;]*from\\s+["']${q}["']`).test(src);
        const degerImport = new RegExp(`import\\s+(?!type\\s)[^;]*from\\s+["']${q}["']`).test(src);
        if (safTipImport && !degerImport) continue;
        ihlaller.push(`${f.replace(SRC, "src")} → ${mod}`);
      }
    }
    expect(ihlaller, `Client bileşeni sunucu modülü import ediyor:\n${ihlaller.join("\n")}`).toEqual([]);
  });

  it("lib/roles.ts sırsızdır (client bileşenleri buradan alır)", () => {
    const roles = readFileSync(join(SRC, "lib", "roles.ts"), "utf8");
    expect(roles).not.toMatch(/process\.env/);
    expect(roles).toMatch(/export const ROLES/);
    expect(roles).toMatch(/export const ROLE_LABELS/);
  });

  it("lib/session.ts sırrı modül yüklenirken DEĞİL, ilk kullanımda çözer (savunma derinliği)", () => {
    const session = readFileSync(join(SRC, "lib", "session.ts"), "utf8");
    // Modül gövdesinde doğrudan çağrı olmamalı: `const secret = resolveSessionSecret();`
    expect(session).not.toMatch(/^const\s+secret\s*=\s*resolveSessionSecret\(\)/m);
    expect(session).toMatch(/function secretKey\(\)/);
  });
});
