// Gemini Live canlı tercüme modeli — TEK KAYNAK (v6.305, 2026-09-30).
//
// Neden ayrı modül: Next.js rota dosyası (`app/**/route.ts`) YALNIZ HTTP handler'ları (GET/POST…) ve segment
// yapılandırmasını (runtime · maxDuration · dynamic …) dışa aktarabilir. Fazladan bir `export const` webpack
// `NextTypesPlugin`'in ürettiği tip denetimini kırar (`next build --webpack`, 2026-09-22 — `.next/types` koruma
// dosyası `Omit<typeof import('./route'), izinli>`'nin boş olmasını ister). Turbopack build'i ve CI geçtiği için
// hata GİZLİYDİ. Sabit önce `api/realtime/token/route.ts`'te export'luydu; buraya taşındı
// (nöbet: tests/unit/route-module-exports.test.ts).
//
// Sırsız ve bağımlılıksız tutulur: istemci bileşeni (`LiveInterpreter`, "use client") de buradan okur —
// client/server sınırı nöbeti (client-server-boundary.test) için güvenli.
//
// Sözleşme: token rotası ephemeral token'ın `liveConnectConstraints.model`'ini bu değere KİLİTLER; istemci
// `ai.live.connect`'i aynı modelle açmalıdır (token başka modele geçersiz). İki uç aynı sabiti okuduğu için
// uyumsuzluk yapısal olarak imkânsızdır — model adı değişecekse yalnız burası değişir.
export const LIVE_TRANSLATE_MODEL = "gemini-3.5-live-translate-preview";
