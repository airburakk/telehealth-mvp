// Doktor profili zenginleştirme — render-zamanı deterministik üretim (şema/DB yok).
// Mevcut gerçek bio korunur, üstüne detay eklenir. Akreditasyon (diploma + uzmanlık + sertifika),
// dummy hasta yorumları ve akademik not branş + deneyim + isimden TÜRETİLİR (her render aynı).
// Dummy içerik (demo); gerçek belge yükleme + moderasyonlu yorum üretimde.

export interface DoctorLike {
  id: string;
  name: string;
  title: string;
  branch: string;
  city: string;
  languages: string;
  experienceYears: number;
  rating: number;
  jci: boolean;
  verified: boolean;
  // M6 Akademik & Eğitim — kalıcı DB değerleri (varsa kullanılır, yoksa deterministik üretim fallback)
  eduSchool?: string | null;
  eduYear?: number | null;
  specBoard?: string | null;
  specYear?: number | null;
  certifications?: string | null; // JSON string[]
  publications?: string | null; // JSON [{title,venue,year}]
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
function pick<T>(arr: T[], seed: number): T { return arr[seed % arr.length]; }

// ── İllüstre avatar (telifsiz, kod üretimi) için çeşitleme + isimden cinsiyet ──
const FEMALE_NAMES = new Set([
  "ayşe", "elif", "selin", "pelin", "gül", "aslı", "nazlı", "ece", "derya", "canan", "sema", "leyla",
  "filiz", "zeynep", "fatma", "emine", "hatice", "zehra", "merve", "esra", "büşra", "ayça", "ceren",
  "melis", "özge", "sibel", "gamze", "seda", "yasemin", "dilek", "irem", "aysu", "duygu", "tuğçe", "ebru",
]);
export function isFemaleName(name: string): boolean {
  const first = (name.trim().split(/\s+/)[0] || "").toLocaleLowerCase("tr-TR");
  return FEMALE_NAMES.has(first);
}
export function avatarVariant(name: string): number { return hash(name + "av") % 6; }

const MED_SCHOOLS = [
  "İstanbul Üniversitesi İstanbul Tıp Fakültesi",
  "Hacettepe Üniversitesi Tıp Fakültesi",
  "Ankara Üniversitesi Tıp Fakültesi",
  "Ege Üniversitesi Tıp Fakültesi",
  "İstanbul Üniversitesi-Cerrahpaşa Cerrahpaşa Tıp Fakültesi",
  "Gazi Üniversitesi Tıp Fakültesi",
  "Dokuz Eylül Üniversitesi Tıp Fakültesi",
  "Marmara Üniversitesi Tıp Fakültesi",
];

// Branşa özel: uzmanlık dal adı + mesleki sertifika/üyelikler + akademik odak cümlesi
const BRANCH_INFO: Record<string, { board: string; certs: string[]; focus: string }> = {
  "Onkoloji": { board: "Tıbbi Onkoloji Yan Dal Uzmanlığı", certs: ["ESMO (Avrupa Tıbbi Onkoloji Derneği) üyeliği", "Türk Tıbbi Onkoloji Derneği üyeliği", "İyi Klinik Uygulamalar (GCP) sertifikası"], focus: "Solid tümörlerde multidisipliner tümör konseyi ve kişiye özel tedavi planlamasında deneyimlidir." },
  "Kardiyoloji": { board: "Kardiyoloji Uzmanlık Belgesi", certs: ["ESC (Avrupa Kardiyoloji Derneği) üyeliği", "Girişimsel Kardiyoloji yeterlilik belgesi", "İleri Kardiyak Yaşam Desteği (ACLS)"], focus: "Koroner anjiyografi ve girişimsel kardiyoloji işlemlerinde yüksek hacimli deneyime sahiptir." },
  "Ortopedi": { board: "Ortopedi ve Travmatoloji Uzmanlık Belgesi", certs: ["EFORT (Avrupa Ortopedi) üyeliği", "Artroskopik Cerrahi sertifikası", "Eklem Protezi ileri eğitim sertifikası"], focus: "Diz/kalça protezi ve artroskopik spor yaralanması cerrahisinde uzmanlaşmıştır." },
  "Nöroşirürji": { board: "Beyin ve Sinir Cerrahisi Uzmanlık Belgesi", certs: ["EANS (Avrupa Nöroşirürji) üyeliği", "Spinal Cerrahi ileri sertifikası", "Mikrocerrahi eğitim sertifikası"], focus: "Omurga ve kafa tabanı mikrocerrahisinde ileri deneyime sahiptir." },
  "Saç Ekimi": { board: "Dermatoloji / Saç Restorasyonu yeterliliği", certs: ["ISHRS (Uluslararası Saç Restorasyon Cerrahisi Derneği) üyeliği", "FUE/DHT ileri teknik sertifikası", "Medikal Estetik sertifikası"], focus: "FUE ve DHT tekniklerinde binlerce başarılı greft transferi deneyimi vardır." },
  "Estetik Cerrahi": { board: "Plastik, Rekonstrüktif ve Estetik Cerrahi Uzmanlık Belgesi", certs: ["ISAPS (Uluslararası Estetik Cerrahi Derneği) üyeliği", "Rinoplasti ileri eğitim sertifikası", "Türk Plastik Cerrahi Derneği üyeliği"], focus: "Yüz ve vücut estetiğinde doğal sonuç odaklı cerrahi yaklaşımı benimser." },
  "Tüp Bebek (IVF)": { board: "Kadın Hastalıkları ve Doğum + Üreme Endokrinolojisi", certs: ["ESHRE (Avrupa İnsan Üremesi Derneği) üyeliği", "Klinik Embriyoloji sertifikası", "Üremeye Yardımcı Tedavi (ÜYTE) sertifikası"], focus: "Üreme endokrinolojisi ve yüksek başarılı IVF laboratuvar süreçlerinde deneyimlidir." },
  "Diş Tedavisi": { board: "Diş Hekimliği Diploması + İmplantoloji", certs: ["ITI (Uluslararası İmplantoloji) üyeliği", "Dijital Gülüş Tasarımı (DSD) sertifikası", "İleri İmplantoloji sertifikası"], focus: "Dijital diş hekimliği ve implant destekli gülüş tasarımında uzmanlaşmıştır." },
  "Göz Cerrahisi": { board: "Göz Hastalıkları Uzmanlık Belgesi", certs: ["ESCRS (Avrupa Katarakt & Refraktif Cerrahi) üyeliği", "LASIK/SMILE refraktif cerrahi sertifikası", "Katarakt & akıllı lens sertifikası"], focus: "Refraktif lazer ve akıllı lens cerrahisinde geniş vaka deneyimine sahiptir." },
  "Genel Cerrahi": { board: "Genel Cerrahi Uzmanlık Belgesi", certs: ["Laparoskopik Cerrahi yeterlilik belgesi", "Bariatrik (Obezite) Cerrahi sertifikası", "Türk Cerrahi Derneği üyeliği"], focus: "Minimal invaziv (laparoskopik) karın ve obezite cerrahisinde uzmandır." },
  "Üroloji": { board: "Üroloji Uzmanlık Belgesi", certs: ["EAU (Avrupa Üroloji Derneği) üyeliği", "Endoüroloji & taş cerrahisi sertifikası", "Androloji yeterlilik belgesi"], focus: "Prostat, böbrek taşı ve androloji alanlarında ileri deneyime sahiptir." },
  "Kadın Hastalıkları ve Doğum": { board: "Kadın Hastalıkları ve Doğum Uzmanlık Belgesi", certs: ["Jinekolojik Laparoskopi sertifikası", "Perinatoloji (riskli gebelik) eğitimi", "Türk Jinekoloji ve Obstetrik Derneği üyeliği"], focus: "Laparoskopik jinekolojik cerrahi ve yüksek riskli gebelik takibinde deneyimlidir." },
  "Kalp ve Damar Cerrahisi": { board: "Kalp ve Damar Cerrahisi Uzmanlık Belgesi", certs: ["EACTS (Avrupa Kardiyotorasik Cerrahi) üyeliği", "Koroner Bypass & kapak cerrahisi sertifikası", "Aort cerrahisi ileri eğitimi"], focus: "Koroner bypass, kalp kapağı ve aort cerrahisinde yüksek hacimli deneyime sahiptir." },
  "Organ Nakli": { board: "Genel Cerrahi + Organ Nakli yan dal", certs: ["ESOT (Avrupa Organ Nakli Derneği) üyeliği", "Canlı vericiden nakil sertifikası", "Transplantasyon İmmünolojisi eğitimi"], focus: "Böbrek ve karaciğer nakli ile canlı verici programlarında deneyimlidir." },
  "Kulak Burun Boğaz (KBB)": { board: "Kulak Burun Boğaz Uzmanlık Belgesi", certs: ["Endoskopik Sinüs Cerrahisi sertifikası", "Fonksiyonel & estetik rinoplasti eğitimi", "Türk KBB Derneği üyeliği"], focus: "Endoskopik sinüs cerrahisi ve fonksiyonel rinoplastide uzmanlaşmıştır." },
  "Radyasyon Onkolojisi": { board: "Radyasyon Onkolojisi Uzmanlık Belgesi", certs: ["ESTRO (Avrupa Radyoterapi & Onkoloji) üyeliği", "IMRT/SBRT ileri planlama sertifikası", "Türk Radyasyon Onkolojisi Derneği üyeliği"], focus: "Modern radyoterapi tekniklerinde (IMRT/SBRT) deneyime sahiptir." },
};

function genericInfo(branch: string): { board: string; certs: string[]; focus: string } {
  return {
    board: `${branch} Uzmanlık Belgesi`,
    certs: [`Türk ${branch} alanında ulusal dernek üyeliği`, "İyi Klinik Uygulamalar (GCP) sertifikası", "Temel & İleri Yaşam Desteği (BLS/ACLS)"],
    focus: `${branch} alanında güncel kılavuzlara dayalı, hasta odaklı bir yaklaşım benimser.`,
  };
}

export interface Credentials {
  diploma: { school: string; year: number };
  uzmanlik: { board: string; year: number };
  certs: string[];
}

// DB değeri (kalıcı) öncelikli; yoksa branş/deneyim/isimden deterministik üretim (geriye uyumlu fallback).
export function doctorCredentials(d: DoctorLike): Credentials {
  const seed = hash(d.name);
  const info = BRANCH_INFO[d.branch] ?? genericInfo(d.branch);
  const uzmanlikYear = d.specYear ?? Math.max(1995, 2026 - Math.max(1, d.experienceYears));
  const diplomaYear = d.eduYear ?? uzmanlikYear - 5;
  let certs = info.certs;
  if (d.certifications) {
    try { const p = JSON.parse(d.certifications); if (Array.isArray(p) && p.length) certs = p as string[]; } catch { /* bozuk JSON → üretim */ }
  }
  return {
    diploma: { school: d.eduSchool || pick(MED_SCHOOLS, seed), year: diplomaYear },
    uzmanlik: { board: d.specBoard || info.board, year: uzmanlikYear },
    certs,
  };
}

export function richBio(d: DoctorLike, baseBio: string | null): string {
  const info = BRANCH_INFO[d.branch] ?? genericInfo(d.branch);
  const langs = d.languages.split(",").map((s) => s.trim()).filter(Boolean).join(", ");
  const base = (baseBio ?? "").trim();
  return [
    base,
    `${d.title} ${d.name}, ${d.experienceYears} yılı aşkın klinik deneyimiyle ${d.city}'de ${d.branch} alanında hizmet vermektedir.`,
    info.focus,
    `Kanıta dayalı ve hasta odaklı bir yaklaşım benimser; uluslararası hastalara ${langs} dillerinde hizmet sunar${d.jci ? " ve JCI akrediteli bir merkezde çalışır" : ""}.`,
  ].filter(Boolean).join(" ");
}

export function academicNote(d: DoctorLike): string {
  const c = doctorCredentials(d);
  let pubLine = "Ulusal ve uluslararası kongrelerde sunum ve bilimsel yayın deneyimi bulunmaktadır.";
  if (d.publications) {
    try {
      const pubs = JSON.parse(d.publications) as { title: string; venue: string; year: number }[];
      if (Array.isArray(pubs) && pubs.length) {
        pubLine = "Seçilmiş yayınlar: " + pubs.map((p) => `“${p.title}” (${p.venue}, ${p.year})`).join("; ") + ".";
      }
    } catch { /* bozuk JSON → üretim cümlesi */ }
  }
  return `${c.diploma.school} mezunu (${c.diploma.year}). ${d.branch} alanında uzmanlığını ${c.uzmanlik.year} yılında tamamlamıştır. ${pubLine}`;
}

// ── Dummy hasta yorumları (deterministik) ──
const REVIEWERS = [
  { author: "Karim B.", country: "DZ" }, { author: "Olga P.", country: "RU" },
  { author: "Hans M.", country: "DE" }, { author: "James W.", country: "GB" },
  { author: "Marie L.", country: "FR" }, { author: "Aybek T.", country: "KZ" },
  { author: "Leyla A.", country: "AZ" }, { author: "Mohammed S.", country: "LY" },
  { author: "Aida K.", country: "KG" }, { author: "Ahmet Y.", country: "TR" },
];
const REVIEW_TEXTS = [
  "Süreç baştan sona çok profesyoneldi; her adımda bilgilendirildim ve kendimi güvende hissettim.",
  "Doktorun ilgisi ve sabrı için minnettarım. Sorularımı eksiksiz, anlaşılır şekilde yanıtladı.",
  "Uzaktan görüşme beklediğimden çok daha verimliydi; tedavi planı net biçimde anlatıldı.",
  "Operasyon ve sonrası takip kusursuzdu. Sonuçtan çok memnunum, herkese gönül rahatlığıyla öneririm.",
  "Dil bariyeri olmadan kendi dilimde rahatça konuşabildim; ekip çok ilgiliydi.",
  "Tanı ve yönlendirme çok hızlı oldu. Türkiye'ye gelmeden önce her şey planlanmıştı.",
  "İkinci görüş için başvurmuştum; alanında gerçekten uzman olduğu ilk dakikada belliydi.",
  "Ameliyat sonrası dijital takip sayesinde kendi ülkemde de sürekli destek aldım.",
];

export interface GenReview { author: string; country: string; stars: number; text: string; daysAgo: number; }

export function generatedReviews(d: DoctorLike): GenReview[] {
  const seed = hash(d.name + d.branch);
  const count = 3 + (seed % 3); // 3-5 yorum
  const out: GenReview[] = [];
  for (let i = 0; i < count; i++) {
    const s = hash(d.name + ":" + i);
    out.push({
      author: pick(REVIEWERS, s).author,
      country: pick(REVIEWERS, s).country,
      stars: d.rating >= 4.8 ? 5 : (s % 4 === 0 ? 4 : 5), // çoğunlukla 5, ara sıra 4
      text: pick(REVIEW_TEXTS, s + i),
      daysAgo: 4 + ((s % 90)),
    });
  }
  return out;
}
