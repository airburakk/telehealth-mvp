// Tıp/Diş Hekimliği fakültesi olan üniversiteler + öğrenci e-posta uzantıları (v6.147).
//
// Doctorium öğrenci girişinin (/ogrenci) TEK güvenlik kontrolü: öğrenci kayıtta bu listeden bir
// üniversite + bölüm seçer, girdiği e-postanın uzantısı o üniversite için burada kayıtlı bir
// domain'le eşleşmezse kayıt REDDEDİLİR (bkz. api/auth/signup-student/route.ts domainMatches
// çağrısı). Eşleşirse doğrulama bağlantısı gönderilir (api/auth/verify-student-email) — yalnız
// TIKLANINCA Doctor.studentVerifiedAt damgalanır.
//
// Kapsam (kullanıcı kararı 2026-08-23): Türkiye devlet+vakıf + KKTC + YÖK-tanınırlıklı yurt dışı
// kampüsler (Azerbaycan/Kırgızistan/Kuzey Makedonya) — dışlama YOK, ama KAPSAM ≠ TAMLIK (aşağıya bkz.).
//
// ⚠️ Domain kalıpları TEK tip DEĞİL: bazı üniversitelerde öğrenciler genel kurumsal uzantıyı
// kullanır (@hacettepe.edu.tr — personel de aynı domain), bazılarında ÖĞRENCİ-ÖZEL alt-alan-adı
// vardır (@ogr.ktu.edu.tr, @ogr.iu.edu.tr — personel/öğretim üyesi bu adresi KULLANMAZ, daha güçlü
// sinyal). `domains` dizisi ikisini de taşıyabilir; bir üniversite için BİRDEN FAZLA geçerli
// uzantı olabilir (ör. eski+yeni sistem geçiş dönemi — Karadeniz Teknik, Kırıkkale, İzmir Ekonomi).
//
// ⚠️ YENİ ÜNİVERSİTE EKLERKEN: emin olmadığın domain'i UYDURMA — kaynaksız satır eklemek, o
// üniversitenin öğrencisini YANLIŞLIKLA reddeder (fail-closed zaten güvenli tarafta) AMA yanlış
// domain YANLIŞLIKLA KABUL ederse (başka bir kurumun/genel bir sağlayıcının domain'i) güvenlik
// kontrolünü anlamsızlaştırır — ikinci hata çok daha ağırdır. tests/unit/universities.test.ts
// SÖZLEŞMESİ: her satırda ≥1 domain + domain'ler üniversiteler arası ÇAKIŞMAZ.
//
// 📊 KAPSAM DURUMU (2026-08-23, ilk tur 9 + hedefli yeniden-araştırma turu 4 = 13 paralel ajan —
// YÖK/tabanpuanlari.tr rosteri [140 üniversite: 126 TR + 9 KKTC + 2 AZ + 2 diğer (KZ/MK)] + her
// üniversitenin resmî "Bilgi İşlem Daire Başkanlığı"/"Öğrenci İşleri" sayfasından tek tek domain
// doğrulaması. İlk turda 9 ajanın paylaştığı tek oturumluk WebSearch kotası bazı grupları erken
// kesmişti — yeniden-araştırma turu bunu DNS MX kaydı sorgusu + resmî PDF/Wayback arşiv taraması +
// proxy okuma gibi ek yöntemlerle kapattı; 22 üniversite daha kesin kaynakla doğrulandı):
//   ✅ 124 üniversite — resmî kaynakla doğrulanmış domain (aşağıdaki liste)
//   ⛔ 16 üniversite — güvenilir kaynakla domain DOĞRULANAMADI (çoğu artık DNS MX taramasıyla da
//      çift teyitli GERÇEK yokluk, bütçe kısıtı değil), bilerek DIŞARIDA bırakıldı. Bu
//      üniversitelerin öğrencileri BUGÜN kayıt olamaz — kapsam dışı, güvensiz tahmin değil:
//      Batman · Dicle (kaynak metni "öğrenci.dicle.edu.tr" diyor; DNS Türkçe karakter taşımaz,
//      ASCII karşılığı muhtemelen "ogrenci.dicle.edu.tr" ama bağımsız teyit edilmedi — allowlist'e
//      girmeden önce doğrulanmalı, tahmin edip eklenmedi) · Erzincan Binali Yıldırım · Gaziantep
//      İslam Bilim ve Teknoloji · İstanbul Sağlık ve Teknoloji (İSTÜN) · İstanbul Yeni Yüzyıl ·
//      Sanko · Siirt · Yüksek İhtisas (TR) — Ada Kent · Kıbrıs Sağlık ve Toplum Bilimleri ·
//      Uluslararası Final (KKTC; ⚠️ bu üniversitede Tıp Fakültesi YOK — yalnız Sağlık Bilimleri
//      Fakültesi var, ileride "tip:true" ile eklenmemeli) · Azerbaycan Tıp (AZ; öğrenci portalı
//      e-posta değil öğrenci NUMARASI istiyor — bireysel kurumsal e-posta hiç atanmıyor olabilir)
//      · Nahçıvan Devlet (AZ) — Hoca Ahmet Yesevi (KZ) — Uluslararası Balkan (MK).
//   🔜 Genişletme: yukarıdaki 16'nın araştırma notu/kaynağı scratchpad'te arşivli. Dicle'nin ASCII
//      teyidi tek sorguluk küçük bir iş; geri kalan 15'i (art arda iki turda da BULUNAMADI) kapatmak
//      muhtemelen üniversiteyle doğrudan iletişim gerektirir — mekanizma değişmez, yalnız satır eklenir.

export interface University {
  /** Resmî ad — kayıt formunda ve Doctor.studentUniversity'de AYNEN bu değer kullanılır. */
  name: string;
  tip: boolean;
  disHekimligi: boolean;
  /** Geçerli öğrenci e-posta uzantı(lar)ı — "@" OLMADAN (ör. "hacettepe.edu.tr"). */
  domains: string[];
}

export const UNIVERSITIES: University[] = [
  { name: "Acıbadem Mehmet Ali Aydınlar Üniversitesi", tip: true, disHekimligi: false, domains: ["live.acibadem.edu.tr"] },
  { name: "Adıyaman Üniversitesi", tip: true, disHekimligi: true, domains: ["adiyaman.edu.tr"] },
  { name: "Afyonkarahisar Sağlık Bilimleri Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.afsu.edu.tr"] },
  { name: "Ağrı İbrahim Çeçen Üniversitesi", tip: true, disHekimligi: false, domains: ["ogr.agri.edu.tr"] },
  { name: "Akdeniz Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.akdeniz.edu.tr"] },
  { name: "Aksaray Üniversitesi", tip: true, disHekimligi: true, domains: ["asu.edu.tr"] },
  { name: "Alanya Alaaddin Keykubat Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.alanya.edu.tr"] },
  { name: "Altınbaş Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.altinbas.edu.tr"] },
  { name: "Amasya Üniversitesi", tip: true, disHekimligi: false, domains: ["ogrenci.amasya.edu.tr"] },
  { name: "Ankara Medipol Üniversitesi", tip: true, disHekimligi: true, domains: ["std.ankaramedipol.edu.tr"] },
  { name: "Ankara Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.ankara.edu.tr"] },
  { name: "Ankara Yıldırım Beyazıt Üniversitesi", tip: true, disHekimligi: true, domains: ["aybu.edu.tr"] },
  { name: "Antalya Bilim Üniversitesi", tip: false, disHekimligi: true, domains: ["std.antalya.edu.tr"] },
  { name: "Atatürk Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.atauni.edu.tr"] },
  { name: "Atılım Üniversitesi", tip: true, disHekimligi: false, domains: ["student.atilim.edu.tr"] },
  { name: "Aydın Adnan Menderes Üniversitesi", tip: true, disHekimligi: true, domains: ["stu.adu.edu.tr"] },
  { name: "Bahçeşehir Üniversitesi", tip: true, disHekimligi: true, domains: ["bahcesehir.edu.tr"] },
  { name: "Balıkesir Üniversitesi", tip: true, disHekimligi: false, domains: ["baun.edu.tr"] },
  { name: "Bandırma Onyedi Eylül Üniversitesi", tip: true, disHekimligi: false, domains: ["bandirma.edu.tr"] },
  { name: "Başkent Üniversitesi", tip: true, disHekimligi: true, domains: ["mail.baskent.edu.tr"] },
  { name: "Bezmialem Vakıf Üniversitesi", tip: true, disHekimligi: true, domains: ["bavu.edu.tr"] },
  { name: "Bilecik Şeyh Edebali Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.bilecik.edu.tr"] },
  { name: "Bingöl Üniversitesi", tip: false, disHekimligi: true, domains: ["bingol.edu.tr"] },
  { name: "Biruni Üniversitesi", tip: true, disHekimligi: true, domains: ["st.biruni.edu.tr"] },
  { name: "Bitlis Eren Üniversitesi", tip: true, disHekimligi: false, domains: ["beu.edu.tr"] },
  { name: "Bolu Abant İzzet Baysal Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.ibu.edu.tr"] },
  { name: "Burdur Mehmet Akif Ersoy Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.mehmetakif.edu.tr"] },
  { name: "Bursa Uludağ Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.uludag.edu.tr"] },
  { name: "Çanakkale Onsekiz Mart Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.comu.edu.tr"] },
  { name: "Çankırı Karatekin Üniversitesi", tip: false, disHekimligi: true, domains: ["ogrenci.karatekin.edu.tr"] },
  { name: "Çukurova Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.cu.edu.tr"] },
  { name: "Demiroğlu Bilim Üniversitesi", tip: true, disHekimligi: false, domains: ["ogr.demiroglu.bilim.edu.tr"] },
  { name: "Dokuz Eylül Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.deu.edu.tr"] },
  { name: "Düzce Üniversitesi", tip: true, disHekimligi: false, domains: ["ogr.duzce.edu.tr"] },
  { name: "Ege Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.ege.edu.tr"] },
  { name: "Erciyes Üniversitesi", tip: true, disHekimligi: true, domains: ["erciyes.edu.tr"] },
  { name: "Eskişehir Osmangazi Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.ogu.edu.tr"] },
  { name: "Fırat Üniversitesi", tip: true, disHekimligi: true, domains: ["firat.edu.tr"] },
  { name: "Gazi Üniversitesi", tip: true, disHekimligi: true, domains: ["gazi.edu.tr"] },
  { name: "Gaziantep Üniversitesi", tip: true, disHekimligi: true, domains: ["mail2.gantep.edu.tr"] },
  { name: "Giresun Üniversitesi", tip: true, disHekimligi: true, domains: ["giresun.edu.tr"] },
  { name: "Hacettepe Üniversitesi", tip: true, disHekimligi: true, domains: ["hacettepe.edu.tr"] },
  { name: "Haliç Üniversitesi", tip: true, disHekimligi: false, domains: ["halic.edu.tr"] },
  { name: "Harran Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.harran.edu.tr"] },
  { name: "Hatay Mustafa Kemal Üniversitesi", tip: true, disHekimligi: true, domains: ["mku.edu.tr"] },
  { name: "Hitit Üniversitesi", tip: true, disHekimligi: false, domains: ["ogrenci.hitit.edu.tr"] },
  { name: "Iğdır Üniversitesi", tip: false, disHekimligi: true, domains: ["ogr.igdir.edu.tr"] },
  { name: "İnönü Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.inonu.edu.tr"] },
  { name: "İstanbul Arel Üniversitesi", tip: true, disHekimligi: false, domains: ["arel.edu.tr"] },
  { name: "İstanbul Atlas Üniversitesi", tip: true, disHekimligi: true, domains: ["atlas.edu.tr"] },
  { name: "İstanbul Aydın Üniversitesi", tip: true, disHekimligi: true, domains: ["stu.aydin.edu.tr"] },
  { name: "İstanbul Beykent Üniversitesi", tip: true, disHekimligi: true, domains: ["student.beykent.edu.tr"] },
  { name: "İstanbul Galata Üniversitesi", tip: false, disHekimligi: true, domains: ["galata.edu.tr"] },
  { name: "İstanbul Gelişim Üniversitesi", tip: false, disHekimligi: true, domains: ["ogr.gelisim.edu.tr"] },
  { name: "İstanbul Kent Üniversitesi", tip: false, disHekimligi: true, domains: ["kent.edu.tr"] },
  { name: "İstanbul Medeniyet Üniversitesi", tip: true, disHekimligi: true, domains: ["ismu.edu.tr"] },
  { name: "İstanbul Medipol Üniversitesi", tip: true, disHekimligi: true, domains: ["std.medipol.edu.tr"] },
  { name: "İstanbul Nişantaşı Üniversitesi", tip: true, disHekimligi: true, domains: ["std.nisantasi.edu.tr"] },
  { name: "İstanbul Okan Üniversitesi", tip: true, disHekimligi: true, domains: ["stu.okan.edu.tr"] },
  { name: "İstanbul Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.iu.edu.tr"] },
  { name: "İstanbul Üniversitesi-Cerrahpaşa", tip: true, disHekimligi: true, domains: ["ogr.iuc.edu.tr"] },
  { name: "İstinye Üniversitesi", tip: true, disHekimligi: true, domains: ["stu.istinye.edu.tr"] },
  { name: "İzmir Bakırçay Üniversitesi", tip: true, disHekimligi: false, domains: ["bakircay.edu.tr"] },
  { name: "İzmir Demokrasi Üniversitesi", tip: true, disHekimligi: true, domains: ["std.idu.edu.tr"] },
  { name: "İzmir Ekonomi Üniversitesi", tip: true, disHekimligi: false, domains: ["izmirekonomi.edu.tr", "ieu.edu.tr", "iue.edu.tr"] },
  { name: "İzmir Katip Çelebi Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.ikc.edu.tr"] },
  { name: "İzmir Tınaztepe Üniversitesi", tip: true, disHekimligi: true, domains: ["stu.tinaztepe.edu.tr"] },
  { name: "Kafkas Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.kafkas.edu.tr"] },
  { name: "Kahramanmaraş Sütçü İmam Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.ksu.edu.tr"] },
  { name: "Kapadokya Üniversitesi", tip: false, disHekimligi: true, domains: ["kun.edu.tr"] },
  { name: "Karabük Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.karabuk.edu.tr"] },
  { name: "Karadeniz Teknik Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.ktu.edu.tr", "ktu.edu.tr"] },
  { name: "Karamanoğlu Mehmetbey Üniversitesi", tip: true, disHekimligi: true, domains: ["stu.kmu.edu.tr"] },
  { name: "Kastamonu Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.kastamonu.edu.tr"] },
  { name: "Kırıkkale Üniversitesi", tip: true, disHekimligi: true, domains: ["kku.edu.tr", "ogr.kku.edu.tr"] },
  { name: "Kırklareli Üniversitesi", tip: true, disHekimligi: false, domains: ["klu.edu.tr"] },
  { name: "Kırşehir Ahi Evran Üniversitesi", tip: true, disHekimligi: false, domains: ["ogr.ahievran.edu.tr"] },
  { name: "Koç Üniversitesi", tip: true, disHekimligi: false, domains: ["ku.edu.tr"] },
  { name: "Kocaeli Sağlık ve Teknoloji Üniversitesi", tip: false, disHekimligi: true, domains: ["kostu.edu.tr"] },
  { name: "Kocaeli Üniversitesi", tip: true, disHekimligi: true, domains: ["kocaeli.edu.tr"] },
  { name: "KTO Karatay Üniversitesi", tip: true, disHekimligi: false, domains: ["ogrenci.karatay.edu.tr"] },
  { name: "Kütahya Sağlık Bilimleri Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.ksbu.edu.tr"] },
  { name: "Lokman Hekim Üniversitesi", tip: true, disHekimligi: true, domains: ["lhu.edu.tr"] },
  { name: "Malatya Turgut Özal Üniversitesi", tip: true, disHekimligi: false, domains: ["ozal.edu.tr"] },
  { name: "Maltepe Üniversitesi", tip: true, disHekimligi: false, domains: ["maltepe.edu.tr"] },
  { name: "Manisa Celal Bayar Üniversitesi", tip: true, disHekimligi: false, domains: ["ogr.cbu.edu.tr"] },
  { name: "Mardin Artuklu Üniversitesi", tip: true, disHekimligi: false, domains: ["ogrenci.artuklu.edu.tr"] },
  { name: "Marmara Üniversitesi", tip: true, disHekimligi: true, domains: ["marun.edu.tr"] },
  { name: "Mersin Üniversitesi", tip: true, disHekimligi: true, domains: ["mersin.edu.tr"] },
  { name: "Muğla Sıtkı Koçman Üniversitesi", tip: true, disHekimligi: true, domains: ["posta.mu.edu.tr"] },
  { name: "Necmettin Erbakan Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.erbakan.edu.tr"] },
  { name: "Nevşehir Hacı Bektaş Veli Üniversitesi", tip: false, disHekimligi: true, domains: ["nevsehir.edu.tr"] },
  { name: "Niğde Ömer Halisdemir Üniversitesi", tip: true, disHekimligi: true, domains: ["mail.ohu.edu.tr"] },
  { name: "Nuh Naci Yazgan Üniversitesi", tip: false, disHekimligi: true, domains: ["ogrenci.nny.edu.tr"] },
  { name: "Ondokuz Mayıs Üniversitesi", tip: true, disHekimligi: true, domains: ["stu.omu.edu.tr"] },
  { name: "Ordu Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.odu.edu.tr"] },
  { name: "Pamukkale Üniversitesi", tip: true, disHekimligi: true, domains: ["posta.pau.edu.tr"] },
  { name: "Recep Tayyip Erdoğan Üniversitesi", tip: true, disHekimligi: true, domains: ["erdogan.edu.tr"] },
  { name: "Sağlık Bilimleri Üniversitesi", tip: true, disHekimligi: true, domains: ["ogrenci.sbu.edu.tr"] },
  { name: "Sakarya Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.sakarya.edu.tr"] },
  { name: "Samsun Üniversitesi", tip: true, disHekimligi: false, domains: ["samsun.edu.tr"] },
  { name: "Selçuk Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.selcuk.edu.tr"] },
  { name: "Sivas Cumhuriyet Üniversitesi", tip: true, disHekimligi: true, domains: ["cumhuriyet.edu.tr"] },
  { name: "Süleyman Demirel Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.sdu.edu.tr"] },
  { name: "Tekirdağ Namık Kemal Üniversitesi", tip: true, disHekimligi: false, domains: ["nku.edu.tr"] },
  { name: "TOBB Ekonomi ve Teknoloji Üniversitesi", tip: true, disHekimligi: false, domains: ["etu.edu.tr"] },
  { name: "Tokat Gaziosmanpaşa Üniversitesi", tip: true, disHekimligi: true, domains: ["gop.edu.tr"] },
  { name: "Trabzon Üniversitesi", tip: true, disHekimligi: false, domains: ["trabzon.edu.tr"] },
  { name: "Trakya Üniversitesi", tip: true, disHekimligi: true, domains: ["trakya.edu.tr"] },
  { name: "Ufuk Üniversitesi", tip: true, disHekimligi: false, domains: ["ufuk.edu.tr"] },
  { name: "Uşak Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.usak.edu.tr"] },
  { name: "Üsküdar Üniversitesi", tip: true, disHekimligi: true, domains: ["st.uskudar.edu.tr"] },
  { name: "Van Yüzüncü Yıl Üniversitesi", tip: true, disHekimligi: true, domains: ["yyu.edu.tr"] },
  { name: "Yalova Üniversitesi", tip: true, disHekimligi: false, domains: ["ogrenci.yalova.edu.tr"] },
  { name: "Yeditepe Üniversitesi", tip: true, disHekimligi: true, domains: ["std.yeditepe.edu.tr"] },
  { name: "Yozgat Bozok Üniversitesi", tip: true, disHekimligi: true, domains: ["ogr.bozok.edu.tr"] },
  { name: "Zonguldak Bülent Ecevit Üniversitesi", tip: true, disHekimligi: true, domains: ["karaelmas.edu.tr"] },
  { name: "Doğu Akdeniz Üniversitesi", tip: true, disHekimligi: true, domains: ["emu.edu.tr"] },
  { name: "Girne Amerikan Üniversitesi", tip: true, disHekimligi: false, domains: ["std.gau.edu.tr"] },
  { name: "Girne Üniversitesi", tip: true, disHekimligi: true, domains: ["std.kyrenia.edu.tr"] },
  { name: "Lefke Avrupa Üniversitesi", tip: false, disHekimligi: true, domains: ["std.eul.edu.tr", "eul.edu.tr"] },
  { name: "Uluslararası Kıbrıs Üniversitesi", tip: true, disHekimligi: true, domains: ["student.ciu.edu.tr"] },
  { name: "Yakın Doğu Üniversitesi", tip: true, disHekimligi: true, domains: ["std.neu.edu.tr"] },
  { name: "Kırgızistan-Türkiye Manas Üniversitesi", tip: true, disHekimligi: false, domains: ["manas.edu.kg"] },
];

export type StudentDepartment = "tip" | "dis-hekimligi";

export function universitiesFor(dept: StudentDepartment): University[] {
  return UNIVERSITIES.filter((u) => (dept === "tip" ? u.tip : u.disHekimligi));
}

/** Seçilen üniversitenin (resmî ad) bilinen uzantılarından biriyle e-posta eşleşiyor mu?
 *  Alt-alan-adı da kabul edilir (ör. "tip.hacettepe.edu.tr" → "hacettepe.edu.tr" ile eşleşir). */
export function domainMatches(email: string, universityName: string): boolean {
  const uni = UNIVERSITIES.find((u) => u.name === universityName);
  if (!uni) return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const emailDomain = email.slice(at + 1).toLowerCase().trim();
  return uni.domains.some((d) => {
    const dl = d.toLowerCase();
    return emailDomain === dl || emailDomain.endsWith(`.${dl}`);
  });
}

/** E-posta, listedeki HERHANGİ bir üniversitenin uzantısıyla eşleşiyor mu? Deneme kayıt formunda
 *  YUMUŞAK ipucu (öğrenci yolunu hatırlatır) — kapı DEĞİL (👤 2026-09-05); saf, client-güvenli. */
export function isKnownUniversityEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const emailDomain = email.slice(at + 1).toLowerCase().trim();
  if (!emailDomain) return false;
  return UNIVERSITIES.some((u) =>
    u.domains.some((d) => {
      const dl = d.toLowerCase();
      return emailDomain === dl || emailDomain.endsWith(`.${dl}`);
    }),
  );
}
