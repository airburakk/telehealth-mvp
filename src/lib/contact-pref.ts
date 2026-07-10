// Hasta iletişim alanları — API tarafı ortak ayrıştırma (FAZ 8, 2026-07-10).
// 4 intake API'si (cases · free-care/apply · tourism-request · second-opinion/cases) aynı
// normalizasyonu kullanır: telefon gevşek temizlenir (7-20 karakter), tercih APP|SMS|EMAIL.
// Telefon KİMLİK verisidir → çağıran taraf encryptField ile şifreleyerek saklar.

const PREFS = new Set(["APP", "SMS", "EMAIL"]);

export function parseContactFields(body: Record<string, unknown>): { phone: string | null; contactPreference: string | null } {
  const raw = String(body.patientPhone ?? "").replace(/[^\d+ ]/g, "").replace(/\s+/g, " ").trim().slice(0, 20);
  const phone = raw.length >= 7 ? raw : null;
  const prefRaw = String(body.contactPreference ?? "").toUpperCase();
  const contactPreference = PREFS.has(prefRaw) ? prefRaw : null;
  return { phone, contactPreference };
}
