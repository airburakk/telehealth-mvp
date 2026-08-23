// Doctorium landing V2 — CTA hedefleri TEK KAYNAK (2026-08-23). Copy dosyasında rota yazılmaz.
//
// 🔴 Giriş hedefi `/doctorium/giris?next=...`: proxy anonim kullanıcıyı HASTA kapısına (/giris)
// atar (src/proxy.ts:18-22); landing'den gelen doktor/öğrenci yanlış kapıya düşmesin diye
// Doctorium kapısı açıkça hedeflenir. `next` e-posta yolunda (gate-email-form.tsx) VE Google/Apple
// OAuth yolunda (auth-gates.tsx withNext → start rotası cookie'ye yazar → callback okur) korunur.
export const LANDING_ROUTES = {
  /** Ana CTA — doktor kaydı (ayrışma Faz B 2026-08-24: AURA kromlu /kayit yerine Doctorium kabuğu). */
  signup: "/doctorium/kayit",
  /** Tıp öğrencisi kaydı (aynı ayrışma — /ogrenci'nin Doctorium kabuğu). */
  student: "/doctorium/ogrenci",
  /** Giriş — Doctorium kapısı; başarıda portala döner. */
  login: "/doctorium/giris?next=/doktor/doctorium",
  /** İç portal (girişli). */
  portal: "/doktor/doctorium",
  // trust ("/guven-ve-gizlilik") + aura ("/") anahtarları 2026-08-24 ayrışmasında silindi —
  // kullanımları v6.150'de kalkmıştı, AURA'ya işaret eden ölü rota sabiti bırakılmadı.
} as const;

/** Sayfa içi çapalar — header nav + mobil menü + sticky CTA aynı listeyi okur. */
export const LANDING_ANCHORS = [
  { id: "nasil", label: "Nasıl çalışır" },
  { id: "akademik", label: "Akademik" },
  { id: "hukuk", label: "Sağlık Hukuku" },
  { id: "kongre", label: "Kongreler" },
  { id: "guven", label: "Güven" },
] as const;
