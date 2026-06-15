# Canlı Tercüme POC — Gemini Live (gerçek zamanlı ses→ses)

Görüşmede hasta kendi dilinde konuşur, doktor anında **Türkçe sesli + altyazı** duyar (ve tersi).
Seçilen sağlayıcı: **Google Gemini Live API** — `gemini-3.5-live-translate-preview`
("düşük gecikmeli, gerçek zamanlı ses→ses çeviri", 70+ dil).

## Neden Gemini (C seçeneği)
Claude'un ses API'si yok. Gemini, **tam bu iş için** özel bir model çıkarmış (live-translate),
elle STT→çeviri→TTS zincirine gerek yok. OpenAI Realtime / Azure Speech Translation alternatifti;
Gemini live-translate fiyat + turnkey çeviri açısından öne çıktı.

## Fiyat (resmi, 2026-06)
| | Ses girişi | Ses çıkışı |
|---|---|---|
| 1M token | $3.50 | $21.00 |
| dakika | $0.0053 | $0.0315 |

- Tek yön ≈ **$0.037/dk**, çift yön ≈ **$0.074/dk** (25 token/sn)
- 20 dk görüşme: tek yön **~$0.74**, çift yön **~$1.47** (gerçekte daha düşük — kişi hep konuşmaz)
- İnsan tercüman $30-80/saat → AI ~50-100× ucuz. Pakette "tıbbi tercüman" kalemi = sağlıklı marj.
- ⚠️ Ücretsiz katman yok; `*-preview` model.

## Mimari (Vercel-uyumlu)
Vercel serverless kalıcı WebSocket tutamaz → **client-to-server + ephemeral token**:
1. Tarayıcı → `POST /api/realtime/token` (sunucu, GEMINI_API_KEY ile kısa ömürlü token üretir)
2. Tarayıcı → token'la doğrudan Gemini Live WebSocket'e bağlanır (ham anahtar tarayıcıya GİTMEZ)
3. Mic PCM **16kHz** gönderilir → çeviri sesi PCM **24kHz** + altyazı gelir
- Ephemeral token: `ai.authTokens.create({ config: { uses, expireTime, newSessionExpireTime, liveConnectConstraints } })`

## Durum
- ✅ **İskelet + token yolu:** `/api/realtime/token` (GET durum + POST mint, `apiVersion: v1alpha`). **Canlıda token mint doğrulandı** (anahtar geçerli).
- ✅ **Aktivasyon tamam:** `GEMINI_API_KEY` Vercel'de (Production), `enabled:true`.
- ✅ **İki yönlü gerçek ses (commit `e63e994`):** `LiveInterpreter` — `ai.live.connect`, `translationConfig{targetLanguageCode, echoTargetLanguage:false}`, input/output transkript. Her taraf karşı tarafın gelen sesini kendi diline çevirip yerel oynatır (ScriptProcessor 16kHz giriş → 24kHz kuyruklu çıkış); orijinal yabancı ses kısılır.
- ✅ **GERÇEK SES TESTİ KULLANICI TARAFINDAN DOĞRULANDI (2026-06-15):** kulaklıkla **çevrilmiş ses + altyazı birlikte duyuldu** (RU→TR). 1. testte altyazı vardı ama ses yoktu → kök sebep: oynatma `AudioContext` token/import/connect `await`'lerinden sonra oluşunca **askıda (suspended)** başlıyordu. Düzeltme (`f233c7f`): playCtx tıklama anında (gesture içinde) oluştur + `resume()`; `playChunk`'ta suspended guard; ses baytları her formatta (base64/binary) sağlam çıkar; tanı sayaçları (🔊 chunk · 📝 altyazı). 2. testte 🔊 arttı + ses duyuldu → **POC uçtan uca tamam.**

## Bilinen sınırlar (canlı testte izlenecek)
- **Yankı:** hoparlörde mic, çeviri sesini geri alır → kulaklık şart. (İleride VAD/echo bastırma.)
- **Gecikme + kalite:** kullanıcı canlı testte **akıcı / çok iyi** buldu (2026-06-15, RU→TR; görüşmede kullanılabilir). Preview model; formal sayısal gecikme ölçümü yapılmadı.
- `translationConfig` SDK tipinde yoksa `any` ile geçildi; mesaj şekli (`serverContent.modelTurn.parts.inlineData` ses + `outputTranscription` altyazı) **canlı testte teyit edildi**.

## Açık konular
- KVKK/GDPR: C'de hastanın **ham sesi** Google'a akar → DPA + aydınlatma metni (üretim öncesi)
- Kesin gecikme/kalite ölçümü gerçek anahtarla yapılacak (preview model)
