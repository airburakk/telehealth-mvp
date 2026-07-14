// Yapay zeka işleme AÇIK RIZASI (AI_TRIAGE) — hastayı karşılayan AI, semptom/tanı girişinden ÖNCE
// bu kapıyı gösterir (4 kulvar: triyaj/telehealth · ikinci görüş · sağlık turizmi · ücretsiz sağlık).
// GENERAL_KVKK onamından AYRI, DAR kapsamlı kova: yalnız (1) doğru branş doktoruna yönlendirme ve
// (2) yüklenen belgelerin çevirisi. Aynı ConsentRecord tablosu + ispat katmanı kullanılır (metin hash'i
// + append-only hash-zinciri + zaman damgası) — kayıtları scope alanı ("AI_TRIAGE") ayırır; ayrı
// migration GEREKMEZ (@@unique([userId, scope, version]) zaten kompozit).
//
// ⚖️ HUKUKİ TASLAK — bu açık rıza metni veri sorumlusu + hukuk müşaviri tarafından nihaileştirilmelidir.
// Metin ESASLI değişince AI_CONSENT_VERSION artır → hash değişir → hastalar bir kez yeniden onaylar.
// db importsuz (edge-safe sabitler — gerekirse proxy/Node her ikisinden okunur), consent-config deseni.

export const AI_CONSENT_SCOPE = "AI_TRIAGE";
export const AI_CONSENT_VERSION = 1;

// Kanonik (TR) açık rıza metni — veri sorumlusunca verildi (2026-07-14). Bu metnin SHA-256 hash'i
// her rıza kaydına "textHash" olarak mühürlenir → hangi metnin hangi sürümünü onayladığı ispatlanabilir.
export const AI_CONSENT_TEXT = `Birazdan vereceğiniz bilgiler yapay zeka tarafından YALNIZCA sizi doğru branş doktoruna yönlendirmek için analiz edilecektir, herhangi bir tanı, teşhis, tedavi ya da tıbbi bir karar için kullanılmayacaktır. Sisteme eklediğiniz tıbbi belge, rapor, görüntüleme, tahlil, epikriz ve/veya benzeri belgeler ise yapay zeka tarafından YALNIZCA çeviri yapılarak doktorunuza sunulması için analiz edilecektir. Kişisel Verilerimin yukarıda sayılan nedenlerle yapay zeka tarafından işlenmesine AÇIK RIZAM vardır.`;

// ── Simültane tercüme AÇIK RIZASI (AI_INTERPRET) ────────────────────────────────────────────────
// Dijital bekleme odasında (PreConsultLobby), doktorla CANLI görüşmeden ÖNCE gösterilir (4 kulvar).
// AI_TRIAGE'dan (semptom yönlendirme + belge çevirisi) AYRI kova/amaç: canlı görüşme sesinin YALNIZCA
// simültane tercümesi. Aynı ConsentRecord tablosu + ispat katmanı; kayıtları scope ("AI_INTERPRET")
// ayırır → ayrı migration GEREKMEZ (@@unique([userId, scope, version]) kompozit). "Süreci Sonlandır"
// hastayı ana sekmesine (/vakalarim) döndürür; "Açık Rızam Vardır" rızayı mühürler + görüşmeye geçer.
export const AI_INTERPRET_SCOPE = "AI_INTERPRET";
export const AI_INTERPRET_VERSION = 1;

// Kanonik (TR) metin — veri sorumlusunca verildi (2026-07-14). Metin ESASLI değişince AI_INTERPRET_VERSION
// artır → hash değişir → hastalar bir kez yeniden onaylar. ⚖️ HUKUKİ TASLAK — hukuk müşaviri nihaileştirmeli.
export const AI_INTERPRET_TEXT = `Birazdan doktorunuzla yapacağınız görüşme yapay zeka tarafından YALNIZCA simultane tercüme yapmak için analiz edilecektir. Kişisel Verilerimin yukarıda sayılan nedenle yapay zeka tarafından işlenmesine AÇIK RIZAM vardır.`;
