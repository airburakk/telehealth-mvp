// İçerik takvimi — KİMLİK TARAYICISI (v6.328, 2026-10-06). SAF. Hukuk günü kapısının otomatik yarısı.
//
// Neden var: Yargıtay metinleri "..." yer tutucularla anonimleştirilmiştir AMA kusurludur — gerçek metinde ("davacının Mina'nın erken taburcu…")
// gibi sızıntılar görüldü. Halka açık kartta taraf kimliği YAYINLANMAZ (KVKK + meslek sırrı). Bu tarayıcı bariz sızıntıları yakalar;
// yakalayamadıklarının (ör. bağlamsız bir ad) güvencesi ZORUNLU insan onay kutusudur (series.attestIdentity) — ikisi birlikte kapıdır.
// 🪤 Kural dışı bırakılanlar BİLİNÇLİDİR: "Eren, Fikret: Borçlar Hukuku" gibi doktrin atıfları (ad, eser künyesidir) ve "Dr. ...'ün"
// gibi "..." yer tutucular işaretlenmez. Tarayıcı yalnız hukuk-günü kapısında çalışır (etkinlik rubriğinde konuşmacı unvanlı adları meşrudur).

export type IdentityKind = "tckn" | "telefon" | "eposta" | "unvanli-ad" | "taraf-adi";

export interface IdentityHit {
  kind: IdentityKind;
  match: string;
}

export const IDENTITY_KIND_LABEL: Record<IdentityKind, string> = {
  tckn: "T.C. kimlik numarası biçimi",
  telefon: "telefon numarası",
  eposta: "e-posta adresi",
  "unvanli-ad": "unvanlı kişi adı",
  "taraf-adi": "taraf adı",
};

// 11 haneli yalıtılmış sayı (0 ile başlamaz; para tutarları nokta/virgül içerdiğinden yutulmaz).
const RE_TCKN = /(?<![\d.,/])[1-9]\d{10}(?![\d.,/]?\d)/g;
// Cep: 05xx / 5xx · sabit hat: alan kodu + EN AZ BİR ayraç (uzun rakam dizilerini telefon sanmasın).
const RE_MOBILE = /(?<![\d.,/])(?:\+?90[\s.-]?)?0?\(?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?![\d.,/]?\d)/g;
const RE_LANDLINE = /(?<![\d.,/])(?:\+?90[\s.-]?)?0?\(?[2-4]\d{2}\)?[\s.-]\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?![\d.,/]?\d)/g;
const RE_EMAIL = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.\p{L}{2,}/gu;

// "Dr. Mehmet Yılmaz" · "Prof. Dr. Ali Veli" · "Av. Ahmet" — unvan + büyük harfli sözcük. "Dr. ...'ün" (yer tutucu) ve "Dr. Öğr. Üyesi" (unvan) eşleşmez.
const RE_TITLED = /(?<!\p{L})(?:Dr|Doç|Prof|Uzm|Op|Yrd|Av|Ebe|Hemşire|Bay|Bayan|Sayın)\.?\s+(?:(?:Dr|Doç|Prof)\.?\s+)*(?!Öğr)\p{Lu}\p{Ll}{2,}(?:\s+\p{Lu}\p{Ll}{2,})?/gu;

// Taraf sıfatından hemen sonra büyük harfle başlayan özel ad: "davacı Mina", "davacının Mina'nın". Kurum/unvan sözcükleri elenir.
const TARAF_STOP =
  "Hastane|Hastanesi|Hastaneleri|Şirket|Şirketi|Şirketler|Kurum|Kurumu|Kuruluş|Kuruluşu|Bakanlık|Bakanlığı|Belediye|Belediyesi|Vakıf|Vakfı|" +
  "Üniversite|Üniversitesi|İdare|İdaresi|Devlet|Sağlık|Klinik|Kliniği|Özel|Dernek|Derneği|Müdürlüğü|Başkanlığı|Genel|Anonim|Limited|Sigorta|" +
  "Doktor|Doktorlar|Vekili|Vekil|Vekilleri|Hakları|Hakkı|Tıp|Merkezi|Merkez|Eğitim|Araştırma|Tüketici|Asliye|Hukuk|Ceza|Kadın|Çocuk|" +
  "Taraf|Tarafı|Taraflar|İlk|Bölge|Yargıtay|Mahkeme|Mahkemesi|Dairesi|Kanun|Kanunu|Yönetmelik|Yönetmeliği|Türk|Cumhuriyeti";
const RE_TARAF = new RegExp(
  `(?<!\\p{L})(?:[Dd]avac[ıi]|[Dd]aval[ıi]|[Ss]an[ıi]k|[Mm]üşteki|[Mm]ağdur|[Kk]atılan|[Mm]üteveffa|[Hh]asta)\\p{Ll}*\\s+(?!(?:${TARAF_STOP})(?!\\p{L}))\\p{Lu}\\p{Ll}{2,}`,
  "gu",
);

/** Metinde bariz kimlik sızıntısı arar. Aynı (tür, eşleşme) çifti tek sayılır; en çok 12 bulgu. */
export function scanIdentity(text: string): IdentityHit[] {
  const hits: IdentityHit[] = [];
  const seen = new Set<string>();
  const add = (kind: IdentityKind, re: RegExp) => {
    for (const m of text.matchAll(re)) {
      const match = m[0].replace(/\s+/g, " ").trim();
      const key = `${kind}:${match}`;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ kind, match });
    }
  };
  add("tckn", RE_TCKN);
  add("eposta", RE_EMAIL);
  add("telefon", RE_MOBILE);
  add("telefon", RE_LANDLINE);
  add("unvanli-ad", RE_TITLED);
  add("taraf-adi", RE_TARAF);
  return hits.slice(0, 12);
}

/** Bulguları ekranda gösterilecek tek satıra çevirir: "taraf adı: «davacının Mina»; e-posta adresi: «a@b.c»". */
export function describeHits(hits: IdentityHit[]): string {
  return hits.map((h) => `${IDENTITY_KIND_LABEL[h.kind]}: «${h.match}»`).join("; ");
}
