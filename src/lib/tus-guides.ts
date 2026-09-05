// TUS REHBERLERİ — yalnız RESMÎ KILAVUZ ÖZETLERİ (K3, 👤 karar 2026-09-05: "yalnız resmî kılavuz özetleri").
// SAF modül. Kaynak: ÖSYM 2026-TUS 2. Dönem Başvuru Kılavuzu (PDF). Her bölüm kılavuzun madde numarasına bağlanır (`ref`);
// strateji, yorum, "şöyle yapın" dili YOK — kılavuzun kendi ifadesi aktarıldığında "kılavuz ... der" biçiminde işaretlenir.
// Bağlayıcı olan kılavuz metnidir; UI her rehberin altında bunu ve dönem uyarısını yazar. 👤 `approvedAt` null → hiçbir yüzeyde
// görünmez. Yeni dönem kılavuzu çıkınca `verifiedAt`/`sourceUrl` güncellenir ve fark okunur (özetler sayı/tarih taşımaz; tarihler
// `lib/tus.ts TUS_EXAM_PERIODS`'ta yaşar).
//
// ⚖️ Terim: sistem "doktor" der; kılavuzdaki RESMÎ adlar (yönetmelik adı, "Aile Hekimliği" uzmanlık dalı) olduğu gibi kalır
// (CLAUDE.md istisnası — resmî adlar). Kılavuzun hukuki terimi "tabip" de resmî metinden aktarım olarak korunur.
export interface TusGuideSection {
  heading: string;
  /** Kılavuz madde numarası/numaraları ("2.1", "5.7 · 5.8"). */
  ref: string;
  paragraphs: string[];
  items?: string[];
}

export interface TusGuide {
  slug: string;
  title: string;
  /** Tek cümle — liste kartında. */
  summary: string;
  sections: TusGuideSection[];
  sourceUrl: string;
  sourceLabel: string;
  verifiedAt: string;
  approvedAt: string | null;
}

export const TUS_GUIDE_SOURCE = {
  label: "ÖSYM — 2026-TUS 2. Dönem Başvuru Kılavuzu",
  url: "https://dokuman.osym.gov.tr/web/2026/7/basvuru-kilavuzu-rn15c8-30102957.pdf",
  page: "https://www.osym.gov.tr/2026tus-2-donem-kilavuz-ve-basvuru-bilgileri",
} as const;

/** UI dipnotu — her rehberin altında. */
export const TUS_GUIDE_DISCLAIMER =
  "Bu özet ÖSYM kılavuzundan derlenmiştir; bağlayıcı olan kılavuz metnidir. Kurallar dönemden döneme değişebilir — başvuru öncesi ilgili dönemin kılavuzunu okuyun. Doctorium yorumu ya da tavsiyesi içermez.";

const V = "2026-09-05";
const SRC = { sourceUrl: TUS_GUIDE_SOURCE.url, sourceLabel: TUS_GUIDE_SOURCE.label, verifiedAt: V };

export const TUS_GUIDES: readonly TusGuide[] = [
  {
    slug: "basvuru-kosullari", title: "Başvuru koşulları ve başvuru işlemi",
    summary: "Kim başvurabilir, diploma tescili, Devlet hizmeti yükümlülüğü, elektronik başvuru ve beyan sorumluluğu.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Kim başvurabilir", ref: "2.1", paragraphs: ["Durumları aşağıdaki maddelere uyan adaylar sınava başvurabilir; yabancı uyruklu adaylar da başvurabilir."],
        items: [
          "Sınav tarihi itibarıyla tabip ve eczacı adayların Sağlık Bakanlığınca, veteriner adayların ilgili Bakanlıkça diploma tescil işleminin tamamlanmış olması.",
          "Tabip ya da tıp dışı meslek mensubu olarak eczacı, kimyager veya veteriner olmak ya da bu alanlarda eğitime devam ediyor olmak.",
          "Türk soylu yabancılar için 2527 sayılı Kanun kapsamında bulunmak.",
          "Meslek ve sanatını uygulamasına ve uzman olmak istediği dalda çalışmasına engel teşkil edebilecek bedenî ve ruhî bir hastalığı olmamak.",
          "Burstan doğan mecburi hizmeti sınav gününden itibaren üç ay içinde bitirecek durumda olmak.",
        ] },
      { heading: "Diploma tescili", ref: "1.4 · 2.1", paragraphs: [
          "TUS'a girebilmek için sınav tarihi itibarıyla diplomanın tescil edilmiş olması şarttır. Sınav tarihi itibarıyla tescili bulunmadığı Sağlık Bakanlığınca ÖSYM'ye bildirilen adayların sınavı geçersiz sayılır ve bu adaylar hak iddia edemez.",
        ] },
      { heading: "Devlet hizmeti yükümlülüğü", ref: "2.1", paragraphs: [
          "3359 sayılı Sağlık Hizmetleri Temel Kanunu Ek 5. maddesi (7456 sayılı Kanun ile değişik) uyarınca tabipler, Devlet hizmeti yükümlülüğüne başlamadan veya tamamlamadan uzmanlık eğitimi için asistanlık sınavlarına katılabilir ve uzmanlık eğitimine başlayabilir. Yan dalda veya birden fazla uzmanlık dalında eğitime başlanabilmesi için yükümlülük süresinin en az yarısının tamamlanması şarttır.",
        ] },
      { heading: "Başvuru nasıl yapılır", ref: "2.2", paragraphs: [
          "Başvurular elektronik ortamda alınır. Kılavuz ve Aday Başvuru Formu ÖSYM'nin internet sayfasından edinilir; kılavuz dağıtımı ve satışı yapılmaz.",
          "Fotoğraflı T.C. Kimlik Kartı olan adaylar e-Devlet üzerinden ÖSYM Aday İşlemleri Sistemine kayıt olabilir; YÖKSİS'te eğitim bilgisi bulunuyorsa başvuru merkezine gitmeden ais.osym.gov.tr veya ÖSYM Aday İşlemleri Mobil Uygulaması üzerinden başvurup süresi içinde sınav ücretini ödeyerek başvuruyu tamamlar. İsteyen adaylar başvuru merkezinden de başvurabilir.",
          "Sınav ücreti başvuru süresi içinde ödenmediğinde başvuru tamamlanmış sayılmaz; ücretini süresi içinde yatırmayan aday için Sınava Giriş Belgesi düzenlenmez. Ücret ve son ödeme günü ilgili dönemin kılavuzunda yer alır.",
        ] },
      { heading: "Beyan ve kabul", ref: "1.9 · 1.16", paragraphs: [
          "Aday Başvuru Formuna yazılan bilgilerin sorumluluğu adaya aittir. Yanlış veya yanıltıcı beyanda bulunan adayların sınavı geçersiz sayılır; beyanın gerçeğe uymadığı sonradan tespit edilirse aday, aradan geçen süreye bakılmaksızın bu sınavdan elde ettiği tüm hakları kaybeder. Beyanların kontrolü Sağlık Bakanlığınca yapılabilir.",
          "Başvuru işlemine geçmeden önce kılavuzun okunması ve tüm sınav koşullarının kabul edildiğini belirten kutucuğun işaretlenmesi zorunludur.",
        ] },
      { heading: "Kamu görevlileri ve genel ilke", ref: "1.10 · 1.13", paragraphs: [
          "Hâlen kamu kuruluşlarında görev yapan adaylar, yerleştirilmeleri hâlinde kurumlarından muvafakat alıp alamayacaklarını belirleyip sınava katılma kararını buna göre vermelidir. Bir eğitim programına yerleştirilmiş olmak, uzmanlık öğrencisi kadrosuna atanma konusunda mevzuata uymayan bir hak vermez.",
          "Sınava girmek ve başarılı olmak, kanun, tüzük, yönetmelik ve diğer mevzuatta yer almayan bir hakkı adaylara vermez.",
        ] },
    ],
  },
  {
    slug: "sinav-yapisi-ve-puanlama", title: "Sınav yapısı ve puanlama",
    summary: "İki test, soru sayısı ve süreler; ham puan, standart puan, Ağırlıklı K/T/A puanları; puan düşürme hâlleri.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Testler, saatler ve süreler", ref: "1.3 · 3", paragraphs: [
          "TUS, Temel Tıp Bilimleri Testi (TTBT) ve Klinik Tıp Bilimleri Testi (KTBT) olmak üzere iki alt sınavdan oluşur. Testlerdeki alanların soru sayıları ve yüzdeleri kılavuzun Tablo 1B'sinde gösterilir.",
        ], items: [
          "Temel Tıp Bilimleri Testi: saat 10.15'te başlar, 100 çoktan seçmeli soru, cevaplama süresi 135 dakika.",
          "Klinik Tıp Bilimleri Testi: saat 14.45'te başlar, 100 çoktan seçmeli soru, cevaplama süresi 135 dakika.",
        ] },
      { heading: "Ham puan ve standart puan", ref: "4.1 · 4.2", paragraphs: [
          "Tüm hesaplama, değerlendirme ve yerleştirme işlemleri bilgisayar ortamında yapılır. Her testte doğru cevap sayısından yanlış cevap sayısının dörtte biri çıkarılarak ham puan elde edilir; ham puanlar her test için ayrı olmak üzere ortalaması 50, standart sapması 10 olan standart puanlara dönüştürülür.",
        ] },
      { heading: "Ağırlıklı puanlar", ref: "4.2", paragraphs: [
          "Tıp fakültesi mezunu adaylar için standart puanlardan aşağıdaki katsayılarla Ağırlıklı K, Ağırlıklı T ve (talep edenlere) Ağırlıklı A puanı hesaplanır. Tıp dışı meslek mensubu adaylar için yalnız Ağırlıklı T hesaplanır ve TTBT standart puanı 1,0 katsayıyla alınır.",
          "Ağırlıklı puanlar kılavuzdaki dönüşüm formülüyle en yükseği 85 olan K, T ve A puanlarına çevrilir.",
        ], items: [
          "Ağırlıklı K (Klinik Tıp Bilimleri) puanı: TTBT × 0,4 + KTBT × 0,6.",
          "Ağırlıklı T (Temel Tıp Bilimleri) puanı: TTBT × 0,6 + KTBT × 0,4.",
          "Ağırlıklı A (Sözleşmeli Aile Hekimliği uzmanlık eğitimi başvuru) puanı: KTBT × 1,0.",
        ] },
      { heading: "Hangi puan hangi dalda kullanılır", ref: "1.2 · 5.5", paragraphs: [
          "Her uzmanlık dalına hangi puan türüne göre seçme yapılacağı kılavuzun tablolarında gösterilir. Kontenjan tablolarındaki programlara, ilgili Mesleki Bilgi Sınavı Puanı 45 veya daha yüksek olanlar arasından seçme yapılır; 45'ten düşük puan o puan türüyle öğrenci alan programların yerleştirmesine dâhil edilmez.",
        ] },
      { heading: "İptal edilen sorular ve cevap anahtarı", ref: "4.3 · 4.4", paragraphs: [
          "ÖSYM veya yargı mercilerince iptaline karar verilen sorular değerlendirme dışı bırakılır ve geçerli soruların puan değeri yeniden saptanır. Cevabının değişmesi gerektiği tespit edilen sorularda güncellenen cevap anahtarı esas alınır.",
        ] },
      { heading: "Puanın %5 düşürüldüğü hâller", ref: "1.5", paragraphs: [
          "Aşağıdaki hâllerde yerleştirmeye esas mesleki bilgi puanı %5 oranında düşürülür. Adayların bu durumlarını Aday Başvuru Formunda belirtmeleri zorunludur; doğru beyanda bulunmayanlar durumları sınavdan sonra tespit edildiğinde kazanmış oldukları tüm hakları kaybeder.",
          "Kılavuza göre \"takip eden ilk sınav\", adayın başvuracağı ilk sınav değil; istifayı veya feragati takip eden ya da yerleştiği hâlde eğitime başlanmayan süre içinde ÖSYM'nin uyguladığı ilk sınavdır.",
        ], items: [
          "Uzmanlık eğitimine devam etmekte iken sınava girildiğinde.",
          "Uzmanlık eğitimine devam etmekte iken istifa edenlerin istifayı takip eden ilk sınavında.",
          "Bir uzmanlık programına yerleştirildiği hâlde eğitime başlamayanların takip eden ilk sınavında.",
        ] },
    ],
  },
  {
    slug: "tercih-ve-yerlestirme", title: "Tercih bildirimi ve yerleştirme",
    summary: "Tercih zamanı, 30 tercih sınırı, özel koşullar, kontenjan türleri, eşitlik kuralı ve hakların geçerlilik süresi.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Tercih zamanı ve yöntemi", ref: "5.1 · 5.4 · 5.7", paragraphs: [
          "Tercih işlemlerinin ne zaman ve nasıl yapılacağı ÖSYM'nin internet sayfasından duyurulur; tercih süresince yayımlanan tercih kılavuzundan yararlanılması gerekir. Tercihler aday tarafından bireysel olarak internet aracılığıyla yapılır.",
          "Tercih süresi içinde tercihler değiştirilebilir veya tümüyle iptal edilip yeniden yapılabilir; süre tamamlandıktan sonra değişiklik yapılamaz ve bu yönde dilekçeler işleme alınmaz. Yanlışlıkla girilen program tercih edilen program gibi işlem görür; sorumluluk adaya aittir.",
        ] },
      { heading: "Tercih sayısı ve sıra", ref: "5.7 · 5.2", paragraphs: [
          "Adaylar en fazla 30 tercih yapabilir ve tercih haklarının hepsini kullanmak zorunda değildir. Yerleştirme, puanlar, tercih sıraları ve kontenjanlar göz önünde tutularak bilgisayarla yapılır.",
          "Kılavuz, yeterli puan alınması koşuluyla tercih sırasının da önem kazandığını ve programların en çok istenenden başlayarak sıralanmasının adayın yararına olacağını belirtir.",
        ] },
      { heading: "Özel koşullar", ref: "5.7 · 5.13", paragraphs: [
          "Özel koşullar, ilgili programda eğitim yapabilmek için kurumların belirlediği, yazılı sınavla ölçülemeyen niteliklerdir. İstenen nitelikleri taşımadığı hâlde programı tercih edip yerleşen adaylar ilgili programca kabul edilmez ve yerleştirmeden doğan tüm haklarını yitirir. Tablolarda Sağlık Bakanlığınca uygun görülen koşul ve açıklamalar yer alır.",
        ] },
      { heading: "Kontenjan türleri", ref: "1.2 · 5.7", paragraphs: ["Tercihlerde hangi kontenjan türünün seçilebileceği uyruğa göre belirlenir; birden fazla kontenjan türünden hakkı olan aday hangi kontenjandan yararlanacağını sistemde belirtir."],
        items: [
          "T.C. uyruklular ve T.C. uyruğunun yanında yabancı uyruğu da olanlar yalnız genel kontenjanları tercih eder.",
          "Yabancı uyruklu adaylar yabancı uyruklu kontenjanlarını tercih eder; uyruğundan biri T.C. olanlar bu kontenjanları tercih edemez.",
          "Mavi kartlı adaylar, yabancı uyruklu olarak başvuruyorlarsa yabancı uyruklu kontenjanlarını; Mavi kart sahibi olarak başvuruyorlarsa yalnız vakıf üniversitelerinin genel kontenjanlarını tercih eder.",
          "K.K.T.C. uyruklu adaylar, 20 Aralık 2022 tarihli Protokol kapsamındaki kontenjanları ve protokolün ilgili maddelerine göre genel kontenjanları tercih eder.",
          "Türk soylu yabancı adaylar, 2527 sayılı Kanun hükümlerinden faydalanmak istiyorlarsa genel kontenjanları, istemiyorlarsa yabancı uyruklu kontenjanlarını tercih eder.",
          "Tıp dışı meslek mensupları yalnız kendileri için ayrılmış kontenjanlara yerleştirilir; tıp fakültesi mezunları bu kontenjanlar dışındaki kontenjanlara yerleştirilir.",
          "İçişleri Bakanlığı ve Millî Savunma Bakanlığı nam ve hesabına açılan kontenjanları yalnız kimlik bilgileri sınav öncesinde ÖSYM'ye iletilen askerî personel tercih edebilir.",
        ] },
      { heading: "Puan eşitliği", ref: "5.8", paragraphs: [
          "Mesleki bilgi sınav puanında eşitlik hâlinde, seçimi yapılan uzmanlık dalını daha üst tercihinde gösterene öncelik verilir. Puanı ve tercih sırası aynı olan adaylar programa birlikte yerleştirilir.",
        ] },
      { heading: "Yabancı dil şartı ve önceki dönem puanları", ref: "5.3 · 5.12", paragraphs: [
          "Yerleştirme ve ek yerleştirme için yabancı dil yeterliliği şartı aranır; sağlayamayan adaylar yerleştirilse bile ilgili kurumca atamaları yapılmaz.",
          "Programların önceki dönem yerleştirme sonuçlarındaki en küçük puanlarına ÖSYM'nin internet adresinden ulaşılabilir. Adayların tercih ettikleri dalların özelliklerine uygun sağlık koşullarına sahip olmaları gerekir.",
        ] },
      { heading: "Hakların geçerlilik süresi", ref: "1.6 · 1.7", paragraphs: [
          "Sınav sonuçları ve yerleştirilen adayların hakları yalnız ilgili sınav dönemi için geçerlidir; bir sonraki TUS yerleştirme sonuçları açıklanana kadar atamanın yapılarak uzmanlık eğitimine başlanmış olması gerekir (3359 sayılı Kanun Ek 5 kapsamındaki adayların hakları saklıdır). Yerleşen adaylar, atanma koşullarını taşımaları kaydıyla kurumlardaki uzmanlık öğrencisi kadrolarına atanır.",
        ] },
    ],
  },
  {
    slug: "yabanci-dil-yeterliligi", title: "Yabancı dil yeterliliği",
    summary: "Kabul edilen diller ve sınavlar, en az 50 puan kuralı, beş yıllık geçerlilik ve tercih aşamasındaki kontrol.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Şart ve kabul edilen belgeler", ref: "1.4", paragraphs: [
          "Yerleştirme işleminin yapılabilmesi için yabancı dil yeterliliği şartı aranır. İngilizce, Fransızca veya Almanca dillerinin birinden Bakanlık veya YÖK tarafından yapılan ya da yaptırılan sınavdan veya ÖSYM'nin Yabancı Dil Bilgisi Seviye Tespit Sınavından (YDS) yüz üzerinden en az elli puan almış olmak ya da ÖSYM tarafından bu puana denk kabul edilen uluslararası geçerliliği bulunan bir belgeye sahip olmak şarttır. Eşdeğerlikler ÖSYM'nin Uluslararası Yabancı Dil Sınavları Eşdeğerlikleri Dokümanında yer alır.",
        ] },
      { heading: "Geçerlilik süresi", ref: "1.4", paragraphs: [
          "Yabancı dil sınav sonuçları sınav tarihinden itibaren beş yıl geçerlidir. Beş yıllık sürenin sona erdiği tarihin hesabında, ilgili dönem için mesleki bilgi sınavına başvuru tarihinin ilk günü dikkate alınır.",
        ] },
      { heading: "Tercih aşamasında kontrol", ref: "5.3 · 5.6", paragraphs: [
          "Yabancı dil muafiyet bilgisi tercih aşamasında kontrol edilir. ÖSYM'nin süresi geçerli yabancı dil sınavı sonucu bulunan adaylar kayıtlar üzerinden kontrol edilerek tercih yapar. Uluslararası geçerliliği bulunan belgesi olanlar, belgelerini tercih işlemlerinin son günü saat 12.00'ye kadar dilekçe ekinde ÖSYM'ye ulaştırdıkları takdirde tercih yapabilir.",
          "Bakanlık (TÖMER TIPDİL) veya YÖK (YÖKDİL) tarafından yaptırılan sınav sonuçlarının ilgili kurumca tercih işlemlerinden önce ÖSYM'ye bildirilmesi gerekir; TUS başvurusunda kullanılan T.C. Kimlik / Y.U. numarası ile dil sınavına başvuruda kullanılan numara aynı olmalıdır. Numaraları farklı olan adaylar, eşleştirme için tercih süresinin son günü saat 12.00'ye kadar ÖSYM'ye dilekçeyle başvurmalıdır.",
          "Yabancı dil yeterliliğini sağlayamayan adayların yerleştirmeleri yapılsa bile ilgili kurum tarafından atamaları yapılmaz.",
        ] },
    ],
  },
  {
    slug: "sinav-gunu-belgeler-ve-kurallar", title: "Sınav günü: belgeler ve kurallar",
    summary: "Sınava Giriş Belgesi, geçerli kimlik belgeleri, binaya giriş saatleri ve sınava getirilmesi yasak eşyalar.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Sınava Giriş Belgesi", ref: "3.1-a", paragraphs: [
          "Sınava Giriş Belgesi adreslere gönderilmez; sınav tarihinin yaklaşık 10 gün öncesinden başlamak üzere T.C. Kimlik / Y.U. numarası ve şifreyle ais.osym.gov.tr adresinden, sabah ve öğleden sonra oturumları için ayrı ayrı edinilir. Belgede sınav merkezi, bina, salon bilgileri ve adayın fotoğrafı bulunur; belgede yazılı salondan başka bir yerde sınava giren adayın sınavı geçersiz sayılır.",
          "Belgenin renkli veya siyah-beyaz çıktısı sınavda yanda bulundurulur; fotoğrafın görünür olması zorunludur. Belgenin ön ve arka yüzünde ÖSYM'nin belirlediği bilgiler dışında yazı, resim, işaret bulunması hâlinde sınav geçersiz sayılır.",
        ] },
      { heading: "Geçerli kimlik belgeleri", ref: "3.1-b", paragraphs: [
          "Sınava girebilmek için Sınava Giriş Belgesi ile birlikte fotoğraflı nüfus cüzdanı, fotoğraflı T.C. Kimlik Kartı veya geçerlilik süresi dolmamış fotoğraflı pasaportun aslı zorunludur. Kılavuz ayrıca fotoğraflı Pembe/Mavi Kart ve geçici Mavi Kart kimlik belgesini, pasaportu bulunmayan KKTC vatandaşlarının kimlik numaralı KKTC Kimlik Kartını, fotoğraflı ve barkodlu/karekodlu Geçici Kimlik Belgesini, Göç İdaresince verilen süresi geçerli fotoğraflı Uluslararası Koruma ve Geçici Koruma kimlik belgelerini ve \"insani\" ya da \"uzun dönem\" türündeki İkamet İzni Belgesinin aslını geçerli sayar.",
          "Sürücü belgesi, meslek kimlik kartları, öğrenci kimlik kartı ve diğer belgeler kimlik belgesi olarak kabul edilmez. Nüfus cüzdanında soğuk damga, güncel fotoğraf ve T.C. Kimlik Numarası bulunmalı; pasaportun süresi sınav günü itibarıyla geçerli olmalıdır. Belgeleri eksik olan aday, mazereti ne olursa olsun sınava alınmaz; alınmış olsa bile sınavı geçersiz sayılır.",
        ] },
      { heading: "Binaya giriş saatleri", ref: "3.2", paragraphs: [
          "Adaylar sabah oturumunda saat 10.00'dan, öğleden sonra oturumunda saat 14.30'dan sonra sınav binalarına alınmaz. Kılavuz, sınavın başlama saatinden en az 1 saat önce bina önünde hazır bulunulmasını salonlara zamanında alınabilme açısından \"son derece önemli\" olarak belirtir. Bina girişinde adayların üstleri elle ve/veya dedektörle aranır.",
        ] },
      { heading: "Sınava getirilmesi yasak eşyalar", ref: "3.2", paragraphs: [
          "Sınav binalarında hiçbir eşya emanete alınmaz. Aşağıdaki eşyalarla gelen adaylar binaya alınmaz; bina içinde bu eşyaları taşıdığı tespit edilen adayın sınavı geçersiz sayılır. ÖSYM sinyal karıştırıcı kullanabilir ve binalar kamera ile izlenebilir.",
          "Salonlarda duvar saati, kalem, silgi, kalemtıraş ve peçete ÖSYM tarafından sağlanır; adaylar bandajı çıkarılmış şeffaf pet şişe içinde su getirebilir. Engeli veya sağlık sorunu nedeniyle araç gereçle sınava girmesi gerekenler kılavuzun \"Engeli/Sağlık Sorunu Olan Adaylar\" maddesine tabidir.",
        ], items: [
          "Çanta, cüzdan, cep telefonu, her türlü saat, kablosuz iletişim sağlayan cihazlar, kulaklık, takılar (alyans hariç), anahtarlık ve araç anahtarı, metal ve plastik içerikli eşyalar (kılavuzda sayılan basit istisnalar hariç), her türlü elektronik/mekanik cihaz, güneş gözlüğü dâhil cam eşya (şeffaf/numaralı gözlük hariç), banka/kredi kartı vb. kartlar.",
          "Cep bilgisayarı, hesap makinesi, sözlük işlevi olan cihaz ve bilgisayar özelliği bulunan her türlü cihaz.",
          "Delici ve kesici alet, ateşli silah ve benzeri teçhizat.",
          "Kalem, silgi, kalemtıraş, müsvedde kâğıdı, defter, kitap, ders notu, sözlük, dergi, gazete, pergel, açıölçer, cetvel.",
          "Yiyecek ve içecek (şeffaf pet şişede su hariç) ile kutu veya şişe içinde ilaç.",
        ] },
      { heading: "Kurallara uyma", ref: "1.12 · 3.2", paragraphs: [
          "Sınavın ve sonuçlarının geçerli sayılması için kılavuzdaki tüm kurallara uyulması zorunludur; kurallara uymayan adayların sınavı geçersiz sayılır, sınavdan sonra tespit edilirse sonuçlardan doğan haklar geçersiz olur. Adaylar, sınav binalarına giriş koşullarına ilişkin Yönetmelik hükümlerine ve ÖSYM'nin güvenlik tedbirlerine uymak zorundadır.",
        ] },
    ],
  },
  {
    slug: "kayit-atama-ve-ek-yerlestirme", title: "Kayıt, atama ve ek yerleştirme",
    summary: "Yerleşenlerin 10 iş günü içinde kayıt yükümlülüğü, Sağlık Bakanlığı başvurusu, arşiv araştırması ve ek yerleştirme koşulları.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Kayıt süresi ve yeri", ref: "6", paragraphs: [
          "Yerleştirme sonuçları sonuc.osym.gov.tr adresinden öğrenilir. Sonuçların ilan tarihinden bir iş günü sonra başlamak üzere adayların yerleştirildikleri kurumlara 10 iş günü içinde kayıtlarını yaptırmaları zorunludur.",
          "Üniversite tıp fakültelerindeki programlara yerleşenler üniversitelere; Sağlık Bakanlığı eğitim ve araştırma hastaneleri ile Sağlık Bakanlığı adına üniversite programlarına yerleşenler Sağlık Bakanlığına; Adli Tıp Kurumundaki programa yerleşenler Adli Tıp Kurumu Başkanlığına istenen tüm belgelerle başvurur. Süresinde başvurmayan veya eksik belge ibraz edenlerin başvuruları kabul edilmez ve yerleştirmeden doğan tüm haklar kaybedilir.",
          "ÖSYM'nin kayıt/atama işlemleri ve kurumlar arası geçişle ilgisi yoktur; bu konudaki başvurular doğrudan ilgili kurumlara yapılır.",
        ] },
      { heading: "Sağlık Bakanlığı kontenjanlarında atama", ref: "6 · 1.8", paragraphs: [
          "Sağlık Bakanlığı ve Sağlık Bakanlığı adına üniversite kontenjanlarına yerleşenler, ilanı takip eden 10 iş günü içinde Yönetim Hizmetleri Genel Müdürlüğü sayfasında ilan edilen belge ve formlarla Entegre Kurumsal İşlem Platformu (EKİP) üzerinden elektronik başvuru yapar; T.C. Kimlik Numarası veya 99 ile başlayan numarası bulunmayanlar belgeleri APS veya özel kargo ile gönderir. EKİP'teki iletişim bilgilerinin güncel tutulması zorunludur.",
          "Açıktan ataması yapılacak adaylar hakkında 7315 sayılı Kanun uyarınca arşiv araştırması yapılır; 657 sayılı Kanunun 48. maddesindeki şartları taşımayanların ataması yapılmaz ve adaya yazılı bilgi verilir.",
          "Sağlık Bakanlığı adına üniversite tıp fakültelerine yerleşen adayların atamaları, üniversitenin bulunduğu ildeki (yoksa en yakın ildeki) uzmanlık eğitimi verilen eğitim ve araştırma hastanelerine yapılır; göreve başlamalarını takiben üniversiteye görevlendirilirler.",
          "Sözleşmeli statüde görev yapanların atamalarının yapılabilmesi için sözleşmelerini feshederek 657 sayılı Kanuna göre kadrolu olarak göreve başlamaları gerekir. Sağlık Bakanlığı adına üniversitelere yerleşenler kayıt için üniversiteye değil Sağlık Bakanlığına başvurur.",
        ] },
      { heading: "Görev yeri değişikliği ve bekleme süreleri", ref: "1.10 · 1.14 · 1.15", paragraphs: [
          "Yönetmeliğin 16. maddesi uyarınca uzmanlık eğitiminin kesintisiz sürdürülmesi şart olduğundan, atama yapıldıktan sonra maddede sayılan hâller dışında aynı alanda olsa bile görev yeri değişikliği yapılmaz.",
          "657 sayılı Kanunun 63. maddesine göre ataması iptal edilen veya 94. maddesine göre görevden çekilen ya da çekilmiş sayılanların Sağlık Bakanlığı kontenjanlarında uzmanlık eğitimi yapabilmeleri için, 63. veya 97. maddedeki sürelerin sınav gününden sonraki 3 ay içinde bitecek durumda olması gerekir.",
          "Kontenjanların eğitim süreleri kılavuzun Tablo 7'sinde yer alır; bu süreler Tıpta Uzmanlık Kurulunun yetkisi çerçevesinde değişebilir.",
        ] },
      { heading: "Ek yerleştirme", ref: "7", paragraphs: [
          "Yerleştirme sonunda tercih edilmeme, atanmaya uygun olmama veya süresinde başvurmama nedeniyle boş kalan kontenjanlara ÖSYM merkezî ek yerleştirme yapar. Boş kontenjanlar ve tercih tarihleri ÖSYM'nin internet sitesinden duyurulur. Adaylar ek yerleştirme için tercih ücretini ÖSYM'nin e-İŞLEMLER \"ÖDEMELER\" alanından yatırır; süresi içinde ödenmeyen tercihler geçersiz sayılır. Ek yerleştirme sonuçlarının ilanından bir iş günü sonra başlamak üzere 10 iş günü içinde kayıt zorunludur; ayrıca sonuç belgesi gönderilmez.",
        ], items: [
          "İlgili dönemin sınavına girmiş olmak.",
          "İlgili dönem sonucuyla hiçbir programa yerleşmemiş olmak.",
          "Yerleştirmede esas alınacak Mesleki Bilgi Sınavı Puanı 45 ve üzerinde olmak.",
        ] },
    ],
  },
  {
    slug: "yabanci-uyruklu-adaylar", title: "Yabancı uyruklu adaylar",
    summary: "Aylıksız uzmanlık eğitimi için TUS zorunluluğu, tescil/denklik, Y.U. numarası, ayrı kontenjanlar ve kayıtta istenen ek belgeler.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Kapsam", ref: "8", paragraphs: [
          "Yönetmeliğin 14. maddesine göre üniversite ve Sağlık Bakanlığı eğitim ve araştırma hastanelerinde tıpta uzmanlık eğitimi programlarına aylıksız olarak eğitim görmek isteyen tıp fakültesi mezunu yabancı uyruklu adaylar da TUS'a girmek zorundadır. Türkiye'deki tıp fakültelerinden mezun olanların tescil, yabancı ülkelerdeki tıp fakültelerinden mezun olanların denklik ve tescil işlemlerinin sınav tarihi itibarıyla tamamlanmış olması gerekir.",
          "Yabancı uyruklu adaylar için ayrı bir Aday Başvuru Formu ve kılavuz bulunmaz; bu adaylar, kendilerini ilgilendirmeyen çok özel durumlar hariç kılavuzun tüm hükümlerine tabidir. Türk Cumhuriyetleri ile Asya ve Balkanlardaki Türk ve akraba topluluklarından gelip Türkiye'de tıp fakültesi bitirenler de TUS'a girer; devlet bursu isteyenler YÖK'e başvurabilir.",
        ] },
      { heading: "Y.U. numarası", ref: "8", paragraphs: [
          "MERNİS'ten alınan \"9\" ile başlayan 11 haneli Yabancı Uyruklu (Y.U.) numarası bulunan adayların başvuruda bu numarayı yazmaları zorunludur. 9 ile başlayan numarası olduğu hâlde 0 ile başlayan numarayla başvuranların diploma tescil bilgisi Sağlık Bakanlığınca ÖSYM'ye iletilemediğinden sınavları geçersiz sayılır.",
        ] },
      { heading: "Kontenjan ve tercih", ref: "5.7 · 8", paragraphs: [
          "Yabancı uyruklu adaylar için ayrılan kontenjanlar tablolarda ayrıca gösterilir. Uyruğundan biri T.C. olan adaylar yabancı uyruklu kontenjanlarını tercih edemez; Sağlık Bakanlığı, çift uyruklu adayların tercihlerini T.C. vatandaşı olarak yapmaları gerektiği uyarısını kılavuzda yayımlar. 2527 sayılı Kanun kapsamındaki Türk soylu yabancılardan yerleşenlerin atanması için Kanun kapsamında bulunduklarını T.C. İçişleri Bakanlığından alınan belgeyle belgelendirmeleri istenir; Büyükelçilik veya Konsolosluk belgesi kabul edilmez.",
        ] },
      { heading: "Kayıtta istenen ek belgeler", ref: "6", paragraphs: ["Yabancı uyruklu adaylar kayıt sırasında diğer adaylardan istenen belgelere ek olarak aşağıdaki belgeleri teslim eder. Atamaları, yetkili mercilerce izin verildikten sonra yapılır."],
        items: [
          "Türkiye'deki bir tıp fakültesinden mezuniyeti gösteren diploma ya da yurt dışı mezunları için YÖK denklik belgesinin noter tasdikli örneği.",
          "Tıpta Uzmanlık Kurulunun belirleyeceği kuruluşça yapılan Türkçe dil bilgisi sınavında başarılı olunduğuna dair belge (eğitime başlanan tarihten itibaren en geç bir yıl içinde sunulur; sunulmazsa uzmanlık öğrenciliğiyle ilişik kesilir; Türkiye'deki tıp fakültelerinin Türkçe bölümlerinden mezun olanlarda aranmaz).",
          "Türkiye'de ikamete izin verildiğine dair belgenin noter tasdikli örneği.",
          "Uzmanlık eğitimi süresince burs verileceğini veya Türkiye'deki giderlerin karşılanacağını belirten belge.",
        ] },
    ],
  },
  {
    slug: "sonuclarin-aciklanmasi", title: "Sonuçların açıklanması",
    summary: "Sınav ve yerleştirme sonuçlarının nereden öğrenildiği, tebliğ hükmü ve Sonuç Belgesi Kontrol Sistemi.",
    approvedAt: "2026-09-05", ...SRC,
    sections: [
      { heading: "Sonuçlar", ref: "9", paragraphs: [
          "Adaylar sınav ve yerleştirme sonuçlarını T.C. Kimlik / Y.U. numaraları ve şifreleriyle sonuc.osym.gov.tr adresinden ve ÖSYM mobil uygulamalarından öğrenir. Sınav ve yerleştirme sonuç belgesi basılmaz ve adreslere gönderilmez; ÖSYM'nin internet sayfasındaki duyurular adaylara tebliğ hükmündedir.",
        ] },
      { heading: "Sonuç Belgesi Kontrol Sistemi", ref: "9", paragraphs: [
          "Sınav sonuç belgelerinin en alt kısmında sistem tarafından rastgele üretilen bir \"Sonuç Belgesi Kontrol Kodu\" bulunur; belgeler sonuc.osym.gov.tr üzerindeki Sonuç Belgesi Kontrol Sistemi sayfasından doğrulanır.",
        ] },
      { heading: "Yerleştirme istatistikleri", ref: "5.12", paragraphs: [
          "Programların ilgili dönem yerleştirme sonuçlarındaki en küçük puanlarına ÖSYM'nin internet adresinden ulaşılabilir. Doctorium'daki \"Yerleştirme verisi\" bölümü bu resmî tablolardan üretilir.",
        ] },
    ],
  },
];

export function approvedTusGuides(list: readonly TusGuide[] = TUS_GUIDES): TusGuide[] {
  return list.filter((g) => g.approvedAt !== null);
}
export function findApprovedTusGuide(slug: string, list: readonly TusGuide[] = TUS_GUIDES): TusGuide | null {
  return approvedTusGuides(list).find((g) => g.slug === slug) ?? null;
}
