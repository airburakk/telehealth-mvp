// Synthetic adapter fixtures, not stored official HTML/PDF content.
export const programHtml = (year = "2026", hour = "17.30") => `<h1>2209-A</h1><p>2209-A Üniversite Öğrencileri Araştırma Projeleri Destekleme Programı ${year} yılı çağrısı başvuruya açılmıştır. Başvurular 11 Kasım ${year} günü saat ${hour}'a kadar TYBS üzerinden yapılabilecektir.</p><a href="/sites/default/files/${year}-10/2209-A_${year}_Yili_Cagri_Duyurusu.pdf">Çağrı</a>`;
export const callRules = (year = "2026", hour = "17.30") => `${year} YILI ÇAĞRI DUYURUSU 2209-A
Türkiye’de lisans veya ön lisans derecesi veren bir programda* kayıtlı olmak.
Açık Öğretim ve Hazırlık Sınıfı öğrencileri projede yürütücü ya da proje ortağı olarak yer alamaz.
Projenin bir akademik danışman rehberliğinde yapılıyor olması.
Araştırmacı Bilgi Sistemi’ne (ARBİS) kaydolunması.
Akademik danışmanın güncel YÖK kaydının olması zorunludur.
Sistem son başvuru günü mesai bitiminde (${hour}) başvuruya kapatılır.
Danışman onayı gerekir. Son başvuru tarihine kadar sisteme girilen bilgileri onaylanmayan başvurular elenir.
Kuruluş yetkilisinin imzası sonrasında başvuru geçerlidir.`;
