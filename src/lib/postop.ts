// Post-Op Takip — iyileşme değerlendirme ve protokoller (Modül 4)
// Saf TS; istemci ve sunucuda ortak kullanılır.

export type Severity = "NONE" | "WATCH" | "RED";

export interface CheckInInput {
  pain: number; // 0-10
  feverC: number; // °C
  meds: boolean; // ilaçlar alındı mı
  note?: string;
}

export interface Assessment {
  severity: Severity;
  reasons: string[];
}

const RED_KW = ["kanama", "irin", "nefes", "bilinç", "bayıl", "kötü koku", "akıntı", "dikiş açıl", "aşırı şiş", "mor", "yarıldı"];
const WATCH_KW = ["kızar", "şişlik", "ağrı artt", "sızıntı", "hassas", "kaşıntı", "akın"];

export function assessCheckIn(input: CheckInInput): Assessment {
  const note = (input.note ?? "").toLocaleLowerCase("tr-TR");
  const reasons: string[] = [];
  let severity: Severity = "NONE";

  const redKw = RED_KW.find((k) => note.includes(k));
  const watchKw = WATCH_KW.find((k) => note.includes(k));

  if (input.feverC >= 38.5) { severity = "RED"; reasons.push(`Yüksek ateş (${input.feverC.toFixed(1)}°C)`); }
  else if (input.feverC >= 37.8) { severity = max(severity, "WATCH"); reasons.push(`Hafif ateş (${input.feverC.toFixed(1)}°C)`); }

  if (input.pain >= 8) { severity = "RED"; reasons.push(`Şiddetli ağrı (${input.pain}/10)`); }
  else if (input.pain >= 6) { severity = max(severity, "WATCH"); reasons.push(`Artmış ağrı (${input.pain}/10)`); }

  if (redKw) { severity = "RED"; reasons.push(`Kritik belirti: "${redKw}"`); }
  else if (watchKw) { severity = max(severity, "WATCH"); reasons.push(`Dikkat: "${watchKw}"`); }

  if (!input.meds) { severity = max(severity, "WATCH"); reasons.push("İlaçlar alınmadı"); }

  if (reasons.length === 0) reasons.push("Belirti yok, iyileşme normal seyrediyor.");
  return { severity, reasons };
}

function max(a: Severity, b: Severity): Severity {
  const order: Severity[] = ["NONE", "WATCH", "RED"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}

export interface Milestone { day: string; title: string; desc: string }

const PROTOCOLS: { match: string; items: Milestone[] }[] = [
  { match: "Saç Ekimi", items: [
    { day: "1-3. gün", title: "İlk yıkama", desc: "Klinik talimatına göre nazik yıkama" },
    { day: "10. gün", title: "Kabuk dökülmesi", desc: "Greft bölgesi kontrolü (foto)" },
    { day: "1. ay", title: "Şok dökülme", desc: "Normal süreç, panik yok" },
    { day: "6. ay", title: "Büyüme kontrolü", desc: "Tele-kontrol görüşmesi" },
  ]},
  { match: "Estetik", items: [
    { day: "1. hafta", title: "Dikiş/şişlik kontrolü", desc: "Foto ile değerlendirme" },
    { day: "1. ay", title: "Ödem azalması", desc: "Sonuç ön değerlendirme" },
    { day: "3. ay", title: "Final kontrol", desc: "Tele-kontrol görüşmesi" },
  ]},
  { match: "Ortopedi", items: [
    { day: "1. hafta", title: "Yara & ağrı", desc: "Enfeksiyon taraması" },
    { day: "2. hafta", title: "Fizik tedavi başlangıcı", desc: "Hareket açıklığı" },
    { day: "6. hafta", title: "Yük verme", desc: "Tele-kontrol + plan" },
  ]},
  { match: "Onkoloji", items: [
    { day: "3. gün", title: "İlaç yan etki takibi", desc: "Bulantı, ateş izlemi" },
    { day: "1. hafta", title: "Kan değerleri", desc: "Lokal lab + paylaşım" },
    { day: "1. ay", title: "Yanıt değerlendirme", desc: "Görüntüleme + tele-kontrol" },
  ]},
  { match: "Tüp Bebek", items: [
    { day: "2. hafta", title: "Beta hCG testi", desc: "Gebelik testi sonucu" },
    { day: "4. hafta", title: "İlk ultrason", desc: "Lokal + tele-değerlendirme" },
  ]},
  { match: "Kardiyoloji", items: [
    { day: "1. hafta", title: "Ritim & tansiyon", desc: "Günlük ölçüm takibi" },
    { day: "1. ay", title: "Kontrol EKG", desc: "Lokal + tele-kontrol" },
  ]},
];

const DEFAULT_PROTOCOL: Milestone[] = [
  { day: "1. hafta", title: "İlk kontrol", desc: "Yara/ağrı ve genel durum" },
  { day: "1. ay", title: "Ara kontrol", desc: "İyileşme değerlendirme" },
  { day: "3. ay", title: "Final kontrol", desc: "Tele-kontrol görüşmesi" },
];

export function recoveryProtocol(branch: string): Milestone[] {
  return PROTOCOLS.find((p) => branch.includes(p.match))?.items ?? DEFAULT_PROTOCOL;
}

export function severityMeta(s: Severity): { label: string; badge: string; dot: string } {
  if (s === "RED") return { label: "Kırmızı bayrak", badge: "bg-red-100 text-red-700 ring-red-200", dot: "bg-red-500" };
  if (s === "WATCH") return { label: "İzlemde", badge: "bg-amber-100 text-amber-800 ring-amber-200", dot: "bg-amber-500" };
  return { label: "Normal", badge: "bg-emerald-100 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" };
}
