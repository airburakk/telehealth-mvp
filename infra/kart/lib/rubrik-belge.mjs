// Doctorium İÇERİK TAKVİMİ — rubrik LINKEDIN BELGE (PDF carousel) (v6.342, 2026-10-09).
//
// 👤 Karar (09.10): rubrik slaytları LinkedIn'de "belge carousel'i" (PDF, yana kaydırılan) olarak paylaşılır — Buffer `document` varlığı
// (url + başlık + küçük resim). Bu modül ONAYLI slayt PNG'lerinden sayfa başına bir slayt olan PDF üretir.
//
// Değişmezler:
//   · Belge = onaylı PNG'ler. Metin YENİDEN ÇİZİLMEZ: her sayfa tek bir <img> (data URI), sayfa boyutu slaytın kendisi (1080×1350 px), kenar boşluğu 0
//     → onay mührünün (`approvedHash`) kapsadığı içerik dışında hiçbir metin belgeye girmez. Başlık (`baslik`) yalnız PDF meta verisi/Buffer alanıdır.
//   · Sayfa sayısı = slayt sayısı (çağıran doğrular); çıktı `%PDF-` ile başlamalı.
//   · Hata öğeyi DÜŞÜRMEZ: çağıran (rubrik-yayin) yalnız LinkedIn'i başarısız sayar; görseller diğer mecralara gider.
// 🪤 Kaynakta \uXXXX YAZMA. 🪤 Emoji YOK.
import fs from "node:fs";
import { esc, sayfada } from "./social-video.mjs";

export const BELGE = { w: 1080, h: 1350 };

/** Sayfa başına bir görsel; @page boyutu slayt boyutu. SAF (test edilir). */
export function belgeHtml(pngBase64ler, baslik, o = BELGE) {
  const sayfalar = pngBase64ler
    .map((b64, i) => `<div class="s"><img alt="${i + 1}" src="data:image/png;base64,${b64}"></div>`)
    .join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(baslik)}</title><style>
@page { size: ${o.w}px ${o.h}px; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
.s { width: ${o.w}px; height: ${o.h}px; overflow: hidden; break-after: page; page-break-after: always; }
.s:last-child { break-after: auto; page-break-after: auto; }
img { display: block; width: ${o.w}px; height: ${o.h}px; }
</style></head><body>${sayfalar}</body></html>`;
}

/** PDF'teki sayfa sayısı (Chromium çıktısındaki `/Type /Page` nesneleri; `/Pages` hariç). */
export function pdfSayfaSayisi(buf) {
  const m = buf.toString("latin1").match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return m ? m.length : 0;
}

/**
 * Onaylı slayt PNG'lerinden PDF belge üretir ve `outPath`'e yazar.
 * @param {{ pngYollari:string[], outPath:string, browser:any, baslik:string }} a
 * @returns {Promise<{ sayfa:number, boyut:number }>}
 */
export async function renderRubrikBelge({ pngYollari, outPath, browser, baslik }) {
  if (!pngYollari.length) throw new Error("belge için en az bir slayt gerekir");
  const html = belgeHtml(pngYollari.map((p) => fs.readFileSync(p).toString("base64")), baslik);
  const pdf = await sayfada(browser, { viewport: { width: BELGE.w, height: BELGE.h } }, async (page) => {
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => Promise.all([...document.images].map((im) => (im.complete ? null : new Promise((r) => { im.onload = r; im.onerror = r; })))));
    return page.pdf({ width: `${BELGE.w}px`, height: `${BELGE.h}px`, printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" }, preferCSSPageSize: true });
  });
  const buf = Buffer.from(pdf);
  if (buf.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error("PDF imzası yok");
  const sayfa = pdfSayfaSayisi(buf);
  if (sayfa !== pngYollari.length) throw new Error(`PDF sayfa sayısı (${sayfa}) slayt sayısıyla (${pngYollari.length}) uyuşmuyor`);
  fs.writeFileSync(outPath, buf);
  return { sayfa, boyut: buf.length };
}
