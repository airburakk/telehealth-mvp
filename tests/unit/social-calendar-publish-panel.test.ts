// İçerik takvimi — "Yayın" paneli (v6.332, 2026-10-06) durum sözleşmeleri: sunucu tarafı render (SSR) ile her durumda NE görünür / NE görünmez.
// Etkileşim (indirme, pano, onay penceresi) tarayıcıda elle/E2E doğrulanır; burada kilitlenen: hangi durumda hangi düğme, mühür bozukken kapalı
// yardımcılar, FAILED hata notunun KAÇIŞLI gösterimi, https dışı bağlantının href OLMAMASI, meşgulken devre dışı düğmeler.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublishPanel } from "@/app/admin/icerik-takvimi/PublishPanel";
import type { PlanItemView } from "@/lib/social-calendar/plan";
import { seriesByKey } from "@/lib/social-calendar/series";

const SERIES = seriesByKey("karar-masasi")!;

const BASE: PlanItemView = {
  id: "p1",
  seriesKey: "karar-masasi",
  slotDay: "2026-10-07",
  status: "APPROVED",
  sourceIds: ["a1"],
  candidates: [],
  payload: { v: 1, slides: [{ role: "kapak", title: "Başlık", body: "Gövde" }], caption: "Bugünün kararı.", hashtags: ["#hukuk"], sources: [] },
  editorNote: "",
  attestIdentity: true,
  gateReport: null,
  approvedAt: "2026-10-07T08:00:00.000Z",
  approvedBy: "Yönetici",
  approvedIntact: true,
  publishedAt: null,
  publication: null,
  version: "v1",
};

const render = (item: Partial<PlanItemView>, extra: { dirty?: boolean; busy?: string } = {}) =>
  renderToStaticMarkup(
    createElement(PublishPanel, {
      item: { ...BASE, ...item },
      series: SERIES,
      dirty: extra.dirty ?? false,
      busy: extra.busy ?? "",
      run: async () => {},
      adopt: () => {},
      notify: () => {},
    }),
  );

describe("PublishPanel — hangi durumda görünür", () => {
  it("PLANNED / DRAFT / SKIPPED: panel HİÇ çizilmez", () => {
    for (const status of ["PLANNED", "DRAFT", "SKIPPED"] as const) expect(render({ status }), status).toBe("");
  });

  it("APPROVED + mühür sağlam: indir · kopyala · 'elle yayınlandı işaretle…' görünür; 'otomatik hat yok' bilgisi var", () => {
    const html = render({});
    expect(html).toContain("Yayın");
    expect(html).toContain("otomatik hat yok");
    expect(html).toContain("PNG’leri indir (ZIP)");
    expect(html).toContain("Altyazıyı + etiketleri kopyala");
    expect(html).toContain("Elle yayınlandı olarak işaretle…");
    expect(html).not.toContain("Yeniden dene");
    expect(html).not.toContain("Hangi kanallara paylaştınız?"); // işaretleme formu tıklanana dek kapalı
  });

  it("APPROVED + mühür BOZUK: uyarı var; indirme/kopyalama/işaretleme YOK", () => {
    const html = render({ approvedIntact: false });
    expect(html).toContain("onay mührüyle eşleşmiyor");
    expect(html).not.toContain("PNG’leri indir");
    expect(html).not.toContain("Altyazıyı + etiketleri kopyala");
    expect(html).not.toContain("Elle yayınlandı olarak işaretle");
    expect(html).not.toContain("<button"); // hiçbir eylem düğmesi çizilmez
  });

  it("APPROVED ama taslak (payload) yoksa yardımcılar çizilmez", () => {
    const html = render({ payload: null });
    expect(html).not.toContain("PNG’leri indir (ZIP)");
    expect(html).not.toContain("Altyazıyı + etiketleri kopyala");
  });

  it("FAILED: hata notu KAÇIŞLI gösterilir (HTML enjekte edilemez); 'Yeniden dene' + yardımcılar var; işaretleme formu YOK", () => {
    const html = render({
      status: "FAILED",
      approvedIntact: false, // FAILED'da bu alan hep false (yalnız APPROVED'da hesaplanır) — mühür uyarısı ÇIKMAMALI
      publication: { v: 1, manual: false, channels: [], at: "2026-10-07T09:00:00.000Z", error: "Instagram 400 <script>alert(1)</script>" },
    });
    expect(html).toContain("Yayın denemesi başarısız");
    expect(html).toContain("Instagram 400 &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("Yeniden dene");
    expect(html).toContain("PNG’leri indir (ZIP)");
    expect(html).not.toContain("onay mührüyle eşleşmiyor");
    expect(html).not.toContain("Elle yayınlandı olarak işaretle");
  });

  it("PUBLISHED (elle): kim/ne zaman + kanal rozetleri; bağlantı güvenli yeni sekme; işaretleme/yeniden deneme YOK; yardımcılar KALIR", () => {
    const html = render({
      status: "PUBLISHED",
      approvedIntact: false,
      publishedAt: "2026-10-07T15:30:00.000Z",
      publication: { v: 1, manual: true, channels: [{ channel: "instagram", url: "https://www.instagram.com/p/ABC/" }, { channel: "linkedin" }], by: "Yönetici", at: "2026-10-07T15:30:00.000Z" },
    });
    expect(html).toContain("Elle yayınlandı");
    expect(html).toContain("Yönetici");
    expect(html).toContain("içerik kilitli");
    expect(html).toContain('href="https://www.instagram.com/p/ABC/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("LinkedIn");
    expect(html).not.toContain('href="https://www.linkedin');
    expect(html).not.toContain("Yeniden dene");
    expect(html).not.toContain("Elle yayınlandı olarak işaretle");
    expect(html).toContain("PNG’leri indir (ZIP)");
  });

  it("PUBLISHED (otomasyon): 'Otomatik yayınlandı'", () => {
    const html = render({ status: "PUBLISHED", publication: { v: 1, manual: false, channels: [{ channel: "x" }], at: "2026-10-07T15:30:00.000Z" } });
    expect(html).toContain("Otomatik yayınlandı");
  });

  it("PUBLISHED: https dışı bağlantı ASLA href olmaz (ikinci kilit — sunucu doğrulaması atlatılsa bile)", () => {
    const html = render({
      status: "PUBLISHED",
      publication: { v: 1, manual: true, channels: [{ channel: "facebook", url: "javascript:alert(1)" }, { channel: "x", url: "http://x.com/1" }], at: "2026-10-07T15:30:00.000Z" },
    });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('href="http://');
    expect(html).toContain("Facebook");
    expect(html).toContain(">X<");
  });
});

describe("PublishPanel — meşgul ve kaydedilmemiş durum", () => {
  it("SlotEditor'da başka işlem sürerken (busy) tüm düğmeler devre dışı", () => {
    const html = render({}, { busy: "save" });
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const b of buttons) expect(b).toContain('disabled=""');
  });
  it("boştayken düğmeler etkin", () => {
    const buttons = render({}).match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(3);
    for (const b of buttons) expect(b).not.toContain('disabled=""');
  });
  it("ekranda kaydedilmemiş değişiklik varsa 'KAYITLI hâl' notu görünür; yoksa görünmez", () => {
    expect(render({}, { dirty: true })).toContain("KAYITLI hâldir");
    expect(render({}, { dirty: false })).not.toContain("KAYITLI hâldir");
  });
});

describe("PublishPanel — YAYINLANIYOR (otomasyon aldı, v6.334)", () => {
  const AT = "2026-10-07T08:05:00.000Z";
  const publishing = (extra: Partial<PlanItemView> = {}) =>
    render({ status: "PUBLISHING", approvedIntact: false, publication: { v: 1, manual: false, channels: [], at: AT }, ...extra });

  it("bilgi + alınma zamanı; İNSAN çözümü: 'elle işaretle…' ve 'Yayınlanmadı — yeniden dene'; yardımcılar KALIR; hata/mühür uyarısı ÇIKMAZ", () => {
    const html = publishing();
    expect(html).toContain("yayınlanıyor (otomasyon)");
    expect(html).toContain("Otomasyon bu içeriği yayına aldı");
    expect(html).toContain("alındı:");
    expect(html).toContain("Elle yayınlandı olarak işaretle…");
    expect(html).toContain("Yayınlanmadı — yeniden dene");
    expect(html).toContain("PNG’leri indir (ZIP)");
    expect(html).toContain("Altyazıyı + etiketleri kopyala");
    expect(html).not.toContain("Yayın denemesi başarısız");
    expect(html).not.toContain("onay mührüyle eşleşmiyor"); // approvedIntact yalnız APPROVED'da hesaplanır
    expect(html).not.toContain("Otomatik yayın hattı henüz kurulu değil"); // APPROVED'a özgü açıklama
  });

  it("FAILED'ın etiketi 'Yeniden dene' kalır (PUBLISHING'e özgü etiket FAILED'da YOK); PUBLISHING'de yalın 'Yeniden dene' düğmesi YOK", () => {
    const failed = render({ status: "FAILED", publication: { v: 1, manual: false, channels: [], at: AT, error: "x" } });
    expect(failed).toContain("Yeniden dene");
    expect(failed).not.toContain("Yayınlanmadı — yeniden dene");
    expect(publishing().replace("Yayınlanmadı — yeniden dene", "")).not.toContain("Yeniden dene");
  });

  it("SlotEditor'da başka işlem sürerken (busy) tüm düğmeler devre dışı", () => {
    const html = render({ status: "PUBLISHING", approvedIntact: false, publication: { v: 1, manual: false, channels: [], at: AT } }, { busy: "retry" });
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons.length).toBeGreaterThanOrEqual(4);
    for (const b of buttons) expect(b).toContain('disabled=""');
  });

  it("PUBLISHED (otomasyon, kısmi başarı): başarısız kanal + hata KAÇIŞLI gösterilir (HTML enjekte edilemez)", () => {
    const html = render({
      status: "PUBLISHED",
      publication: { v: 1, manual: false, channels: [{ channel: "instagram", url: "https://www.instagram.com/p/X/" }], failures: [{ channel: "linkedin", error: "429 <i>oran</i> sınırı" }], by: "otomasyon", at: AT },
    });
    expect(html).toContain("Otomatik yayınlandı");
    expect(html).toContain("LinkedIn: yayınlanamadı");
    expect(html).toContain("429 &lt;i&gt;oran&lt;/i&gt; sınırı");
    expect(html).not.toContain("<i>");
  });
});
