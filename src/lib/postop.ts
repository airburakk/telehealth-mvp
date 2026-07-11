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
  if (s === "RED") return { label: "Kırmızı bayrak", badge: "bg-red-500/15 text-red-300 ring-red-400/25", dot: "bg-red-500" };
  if (s === "WATCH") return { label: "İzlemde", badge: "bg-amber-500/15 text-amber-200 ring-amber-400/25", dot: "bg-amber-500" };
  return { label: "Normal", badge: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/25", dot: "bg-emerald-500" };
}

export function worstSeverity(...arr: Severity[]): Severity {
  return arr.reduce((a, b) => max(a, b), "NONE" as Severity);
}

// ── Branşa özel GÜNLÜK post-op checklist (genel ağrı/ateş/ilaç'a EK; her seçenek bir severity taşır) ──
export interface ChecklistOption { v: string; sev: Severity }
export interface ChecklistItem { id: string; label: string; options: ChecklistOption[] }

const CHECKLISTS: { match: string; items: ChecklistItem[] }[] = [
  { match: "Saç Ekimi", items: [
    { id: "kabuk", label: "Ekim bölgesinde kabuklanma", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "NONE" }, { v: "Yoğun", sev: "WATCH" }] },
    { id: "kizariklik", label: "Kızarıklık / şişlik", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "NONE" }, { v: "Belirgin", sev: "WATCH" }] },
    { id: "kasinti", label: "Kaşıntı", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "NONE" }, { v: "Şiddetli", sev: "WATCH" }] },
    { id: "akinti", label: "Donör/ekim bölgesi akıntı", options: [{ v: "Yok", sev: "NONE" }, { v: "Berrak", sev: "WATCH" }, { v: "İrinli", sev: "RED" }] },
  ] },
  { match: "Estetik", items: [
    { id: "sislik", label: "Şişlik / ödem", options: [{ v: "Azalıyor", sev: "NONE" }, { v: "Aynı", sev: "NONE" }, { v: "Artıyor", sev: "WATCH" }] },
    { id: "morarma", label: "Morarma", options: [{ v: "Azalıyor", sev: "NONE" }, { v: "Aynı", sev: "NONE" }, { v: "Yayılıyor", sev: "WATCH" }] },
    { id: "dikis", label: "Dikiş bölgesi akıntı", options: [{ v: "Yok", sev: "NONE" }, { v: "Berrak", sev: "WATCH" }, { v: "İrinli", sev: "RED" }] },
  ] },
  { match: "Ortopedi", items: [
    { id: "hareket", label: "Eklem hareketi", options: [{ v: "İyi", sev: "NONE" }, { v: "Sınırlı", sev: "NONE" }, { v: "Çok ağrılı", sev: "WATCH" }] },
    { id: "sislik", label: "Bölgede şişlik", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "NONE" }, { v: "Belirgin", sev: "WATCH" }] },
    { id: "dolasim", label: "Parmaklarda renk değişimi / his kaybı", options: [{ v: "Yok", sev: "NONE" }, { v: "Var", sev: "RED" }] },
  ] },
  { match: "Onkoloji", items: [
    { id: "bulanti", label: "Bulantı / kusma", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "NONE" }, { v: "Şiddetli", sev: "WATCH" }] },
    { id: "istah", label: "İştah", options: [{ v: "Normal", sev: "NONE" }, { v: "Azalmış", sev: "NONE" }, { v: "Yok", sev: "WATCH" }] },
    { id: "titreme", label: "Ateşle birlikte titreme", options: [{ v: "Yok", sev: "NONE" }, { v: "Var", sev: "RED" }] },
  ] },
  { match: "Tüp Bebek", items: [
    { id: "kanama", label: "Vajinal kanama", options: [{ v: "Yok", sev: "NONE" }, { v: "Lekelenme", sev: "WATCH" }, { v: "Bol", sev: "RED" }] },
    { id: "ohss", label: "Şiddetli karın ağrısı / şişkinlik (OHSS)", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "WATCH" }, { v: "Şiddetli", sev: "RED" }] },
  ] },
  { match: "Kardiyoloji", items: [
    { id: "gogusagri", label: "Göğüs ağrısı", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "WATCH" }, { v: "Belirgin", sev: "RED" }] },
    { id: "nefes", label: "Nefes darlığı", options: [{ v: "Yok", sev: "NONE" }, { v: "Eforla", sev: "WATCH" }, { v: "İstirahatte", sev: "RED" }] },
    { id: "odem", label: "Bacaklarda şişme", options: [{ v: "Yok", sev: "NONE" }, { v: "Var", sev: "WATCH" }] },
  ] },
  { match: "Genel Cerrahi", items: [
    { id: "yara", label: "Yara akıntısı", options: [{ v: "Yok", sev: "NONE" }, { v: "Berrak", sev: "WATCH" }, { v: "İrinli/kanlı", sev: "RED" }] },
    { id: "karin", label: "Karın ağrısı", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "NONE" }, { v: "Şiddetli", sev: "WATCH" }] },
    { id: "bagirsak", label: "Gaz / dışkı çıkışı", options: [{ v: "Var", sev: "NONE" }, { v: "Yok", sev: "WATCH" }] },
  ] },
  { match: "Organ Nakli", items: [
    { id: "idrar", label: "İdrar miktarı", options: [{ v: "Normal", sev: "NONE" }, { v: "Azaldı", sev: "RED" }] },
    { id: "enfeksiyon", label: "Ateş / enfeksiyon belirtisi", options: [{ v: "Yok", sev: "NONE" }, { v: "Var", sev: "RED" }] },
    { id: "greft", label: "Nakil bölgesi ağrı / hassasiyet", options: [{ v: "Yok", sev: "NONE" }, { v: "Hafif", sev: "WATCH" }, { v: "Belirgin", sev: "RED" }] },
  ] },
];

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "yara", label: "Yara / işlem bölgesi", options: [{ v: "İyi", sev: "NONE" }, { v: "Kızarık", sev: "WATCH" }, { v: "Akıntılı", sev: "RED" }] },
  { id: "genel", label: "Genel hâl", options: [{ v: "İyi", sev: "NONE" }, { v: "Halsiz", sev: "WATCH" }, { v: "Kötü", sev: "RED" }] },
];

export function postopChecklist(branch: string): ChecklistItem[] {
  return CHECKLISTS.find((c) => branch.includes(c.match))?.items ?? DEFAULT_CHECKLIST;
}

// Checklist yanıtlarını (id→seçilen değer) değerlendir: en kötü severity + gerekçeler + okunabilir özet
export function assessChecklist(branch: string, answers: Record<string, string>): { severity: Severity; reasons: string[]; summary: string } {
  const items = postopChecklist(branch);
  let severity: Severity = "NONE";
  const reasons: string[] = [];
  const parts: string[] = [];
  for (const it of items) {
    const ans = answers?.[it.id];
    if (!ans) continue;
    parts.push(`${it.label}: ${ans}`);
    const sev = it.options.find((o) => o.v === ans)?.sev ?? "NONE";
    if (sev !== "NONE") { severity = max(severity, sev); reasons.push(`${it.label}: ${ans}`); }
  }
  return { severity, reasons, summary: parts.join(" · ") };
}
