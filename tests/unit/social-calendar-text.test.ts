// İçerik takvimi — metin yardımcıları + kimlik tarayıcısı sözleşmeleri (v6.328). Fixture'lar GERÇEK Yargıtay metinlerinde görülen
// biçimlerden (garip boşluk, ''çift kesme'', "..." yer tutucu, doktrin atfı, sızan ad) kısaltılarak alındı.
import { describe, expect, it } from "vitest";
import { describeHits, scanIdentity } from "@/lib/social-calendar/identity";
import { ELLIPSIS, cleanText, excerptParagraph, normText, quoteFragments, splitSentences, verifyQuote } from "@/lib/social-calendar/text";

describe("normText / cleanText", () => {
  it("görünmez karakterleri atar, garip boşlukları tek boşluğa indirir", () => {
    expect(cleanText("a b c​d﻿e")).toBe("a b cde");
    expect(normText("Dava   konusu tazminat\n\n istemi")).toBe("Dava konusu tazminat istemi");
  });
  it("tırnak/kesme/tire varyantlarını eşitler; büyük-küçük harfi KORUR", () => {
    expect(normText("Kanun’un “49” – maddesi")).toBe(`Kanun'un "49" - maddesi`);
    expect(normText("''1 adet embriyo''")).toBe('"1 adet embriyo"');
    expect(normText("Onam")).not.toBe(normText("onam"));
  });
});

describe("quoteFragments / verifyQuote", () => {
  const SOURCE = `Mahkemece hükme esas alınan raporlarda; tedavinin uygun olduğu, komplikasyonlardan olduğu belirtilmiştir.
İkinci paragraf: davacı vekilinin temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.`;

  it("[…], … ve boş satırdan parçalar; üç nokta (anonimleştirme yer tutucusu) ayırıcı DEĞİL", () => {
    expect(quoteFragments(`baş ${ELLIPSIS} son`)).toEqual(["baş", "son"]);
    expect(quoteFragments("baş … son")).toEqual(["baş", "son"]);
    expect(quoteFragments("birinci\n\nikinci")).toEqual(["birinci", "ikinci"]);
    expect(quoteFragments("davacı ...'in talebi")).toEqual(["davacı ...'in talebi"]);
  });
  it("birebir alıntı geçer (boşluk/tipografi farkı affedilir)", () => {
    expect(verifyQuote("tedavinin   uygun olduğu, komplikasyonlardan olduğu", SOURCE).ok).toBe(true);
    expect(verifyQuote(`Mahkemece hükme esas alınan raporlarda; ${ELLIPSIS} onanmasına karar verilmiştir.`, SOURCE).ok).toBe(true);
  });
  it("değiştirilmiş ya da uydurma parça yakalanır ve gösterilir", () => {
    const v = verifyQuote(`Mahkemece hükme esas alınan raporlarda; ${ELLIPSIS} kararın BOZULMASINA karar verilmiştir.`, SOURCE);
    expect(v.ok).toBe(false);
    expect(v.missing[0]).toContain("BOZULMASINA");
  });
  it("boş alıntı geçmez", () => {
    expect(verifyQuote("", SOURCE).ok).toBe(false);
    expect(verifyQuote(` ${ELLIPSIS} `, SOURCE).ok).toBe(false);
  });
});

describe("splitSentences", () => {
  it("unvan kısaltması, sıra numarası ve tarihte bölmez", () => {
    const t = "Dr. Ayşe, 3. Hukuk Dairesi'nde 13.05.2026 tarihinde görüşüldü. İkinci cümle burada. Üçüncüsü de md. 49 uyarınca.";
    expect(splitSentences(t)).toEqual(["Dr. Ayşe, 3. Hukuk Dairesi'nde 13.05.2026 tarihinde görüşüldü.", "İkinci cümle burada.", "Üçüncüsü de md. 49 uyarınca."]);
  });
  it("tek cümleyi aynen verir; boş metin boş dizi", () => {
    expect(splitSentences("Tek cümle.")).toEqual(["Tek cümle."]);
    expect(splitSentences("")).toEqual([]);
  });
});

describe("excerptParagraph", () => {
  it("sığıyorsa aynen döner", () => {
    expect(excerptParagraph("Kısa paragraf.", 100)).toBe("Kısa paragraf.");
  });
  it("sığmayan çok cümleli paragraf: baş [...] son — her parça kaynakta birebir geçer, hüküm cümlesi korunur", () => {
    const p = [
      "Birinci cümle olayın özetini veren oldukça uzun bir cümledir ve ayrıntı içerir.",
      "İkinci cümle bilirkişi raporunun içeriğini aktarır ve değerlendirme yapar.",
      "Üçüncü cümle araya giren gereksiz bir ayrıntıdır ve alıntıya girmemelidir ama uzundur.",
      "Dördüncü cümle de benzer biçimde uzundur ve gereksizdir, uzunluk doldurmak için yazıldı.",
      "Son cümle: temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.",
    ].join(" ");
    const ex = excerptParagraph(p, 260);
    expect(ex.length).toBeLessThanOrEqual(260);
    expect(ex).toContain(ELLIPSIS);
    expect(ex.startsWith("Birinci cümle")).toBe(true);
    expect(ex.endsWith("onanmasına karar verilmiştir.")).toBe(true);
    expect(verifyQuote(ex, p).ok).toBe(true);
  });
  it("tek dev cümle: virgül sınırından kesilir, parçalar kaynakta birebir geçer", () => {
    const p = `${"Mahkemece hükme esas alınan raporlarda; ".repeat(1)}${"hastanın muayenesinde hasar saptanmadığı, ".repeat(30)}davacılar vekilinin temyiz itirazlarının reddi ile kararın onanmasına karar verilmiştir.`;
    const ex = excerptParagraph(p, 400);
    expect(ex.length).toBeLessThanOrEqual(400);
    expect(ex).toContain(ELLIPSIS);
    expect(verifyQuote(ex, p).ok).toBe(true);
    expect(ex.endsWith("karar verilmiştir.")).toBe(true);
  });
});

describe("scanIdentity — yakalanması GEREKENLER", () => {
  it("T.C. kimlik numarası biçimi (11 hane)", () => {
    expect(scanIdentity("TC No: 12345678901 olan davacı").map((h) => h.kind)).toContain("tckn");
  });
  it("telefon (cep + sabit hat) ve e-posta", () => {
    expect(scanIdentity("0532 123 45 67 numarasından").map((h) => h.kind)).toContain("telefon");
    expect(scanIdentity("+90 (532) 123-45-67").map((h) => h.kind)).toContain("telefon");
    expect(scanIdentity("0212 555 12 34 hattı").map((h) => h.kind)).toContain("telefon");
    expect(scanIdentity("yazışma için ali.veli@ornek.com adresi").map((h) => h.kind)).toContain("eposta");
  });
  it("unvanlı kişi adı", () => {
    expect(scanIdentity("davalı Dr. Mehmet Yılmaz tarafından").map((h) => h.kind)).toContain("unvanli-ad");
    expect(scanIdentity("vekili Av. Ahmet Kaya").map((h) => h.kind)).toContain("unvanli-ad");
    expect(scanIdentity("Prof. Dr. Ali Veli raporunda").map((h) => h.kind)).toContain("unvanli-ad");
  });
  it("taraf sıfatından sonra sızan özel ad — gerçek metinde görülen 'davacının Mina'nın' biçimi", () => {
    const hits = scanIdentity("uyuşmazlık; davacının Mina'nın erken taburcu edilip komplikasyonun tespitinde");
    expect(hits.map((h) => h.kind)).toContain("taraf-adi");
    expect(describeHits(hits)).toContain("taraf adı");
  });
});

describe("scanIdentity — YAKALANMAMASI gerekenler (yanlış engel editörü küstürür)", () => {
  it("'...' yer tutucular (anonimleştirme) ve unvan + yer tutucu", () => {
    expect(scanIdentity("davacı ...'in talebi; davalı Dr. ...'ün işlemi; sanık ...'ın savunması")).toEqual([]);
  });
  it("doktrin atfı (ad = eser künyesi)", () => {
    expect(scanIdentity("(Eren, Fikret: Borçlar Hukuku Genel Hükümler, 22. Baskı, Ankara 2017, s. 594)")).toEqual([]);
  });
  it("kurum adları, para tutarı, tarih, esas/karar numarası, madde numarası", () => {
    expect(scanIdentity("davalı Hastane ile davacı Vekili; 500.000,00 TL manevi tazminat; 13.05.2026; E. 2025/6022, K. 2026/3076; TBK m.49")).toEqual([]);
    expect(scanIdentity("Hasta Hakları Yönetmeliği'nin 15. maddesi; davalı Sağlık Bakanlığı")).toEqual([]);
  });
  it("unvan 'Dr. Öğr. Üyesi' kalıbı ve küçük harfli 'doktor'", () => {
    expect(scanIdentity("Prof. Dr. Öğr. Üyesi unvanlı bilirkişi; davalı doktor ve hasta")).toEqual([]);
  });
  it("aynı bulgu bir kez sayılır", () => {
    const hits = scanIdentity("a@b.co ve yine a@b.co");
    expect(hits.filter((h) => h.kind === "eposta")).toHaveLength(1);
  });
});
