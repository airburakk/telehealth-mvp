// Doctorium Post — e-posta baskısı (2026-08-24). Tasarım: vault tasarım belgesi §5.
//
// E-POSTA KISITLARI bilinçli tasarım girdisidir (tasarım §5.2):
//  · Görsel YOK — og:image hotlink (telif+IP sızıntısı) ve data URI (Gmail bloklar) ELENDİ;
//    masthead dahil her şey TİPOGRAFİK. Web görünümü (/doktor/doctorium/ozet) zengin hâli taşır.
//  · Inline CSS + tablo düzeni — istemci CSS desteği dar; web-font yok, sistem serif yığını
//    (Georgia/Times) gazete sesine zaten uygun.
//  · 🔴 `text-transform:uppercase` KULLANILMAZ (2026-08-25 görsel provası dersi): CSS büyütme
//    belgenin diline bakar — e-postada lang yoktur → Türkçe metin yanlış büyür ("Cihaz"→"CIHAZ",
//    "Ekim"→"EKIM"); lang="tr" varsa bu kez İngilizce kaynak adları bozulur ("CİRCULATİON").
//    Türkçe sabit metinler sunucuda toLocaleUpperCase("tr") ile büyütülür; kaynak adları (dili
//    karışık: JAMA · Resmî Gazete) HİÇ büyütülmez, olduğu gibi dizilir.
//  · Koyu mod istemciye bırakılır (renkler nötr; zorlamalı dark-hack yok).
//  · Hedef boyut ≪100KB (Gmail ~102KB'de kırpar).
//
// Bu modül SAF'tır (db/env importu yok) — birim testte doğrudan render edilir.
import type { DigestSection } from "./daily-digest";

export interface DigestEmailArgs {
  doctorName: string;
  /** "YYYY-MM-DD" TR günü. */
  day: string;
  sections: DigestSection[];
  overflow: number;
  portalUrl: string;
  unsubUrl: string;
}

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const DAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function dateLine(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DAYS[dt.getUTCDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const INK = "#1a1d1c";
const INK2 = "#4a524f";
const INK3 = "#7a827f";
const HAIR = "#d9dedb";
const EMERALD = "#0c7a5b";

export function renderDigestEmailHtml(a: DigestEmailArgs): string {
  const sectionsHtml = a.sections.map((s) => `
    <tr><td style="padding:26px 0 0;">
      <div style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:2.5px;color:${EMERALD};border-bottom:1px solid ${HAIR};padding-bottom:6px;">${esc(s.label.toLocaleUpperCase("tr"))}</div>
      ${s.items.map((it) => {
        const href = it.url ? esc(it.url) : `${esc(a.portalUrl.replace(/\/ozet$/, ""))}/${esc(it.id)}`;
        return `
      <div style="padding:14px 0 2px;">
        <a href="${href}" style="font-family:${SERIF};font-size:17px;line-height:1.35;font-weight:700;color:${INK};text-decoration:none;">${esc(it.title)}</a>
        <div style="font-family:${SANS};font-size:11px;letter-spacing:0.6px;color:${INK3};padding-top:4px;">${esc(it.sourceName)}</div>
        <div style="font-family:${SERIF};font-size:13.5px;line-height:1.55;color:${INK2};padding-top:5px;">${esc(it.summary)}</div>
      </div>`;
      }).join("")}
    </td></tr>`).join("");

  const overflowHtml = a.overflow > 0 ? `
    <tr><td style="padding:22px 0 0;">
      <a href="${esc(a.portalUrl)}" style="font-family:${SANS};font-size:13px;font-weight:600;color:${EMERALD};text-decoration:none;">Bugünün akışında ${a.overflow} başlık daha var — portalda okuyun →</a>
    </td></tr>` : "";

  // Dış tablo 600px — bülten standardı; body arka planı istemciye bırakılır (koyu mod nötr kalsın).
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:18px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
  <tr><td align="center" style="border-bottom:3px double ${INK};padding-bottom:14px;">
    <div style="font-family:${SERIF};font-size:34px;font-weight:700;letter-spacing:5px;color:${INK};">DOCTORIUM.TR <span style="color:${EMERALD};">POST</span></div>
    <div style="font-family:${SANS};font-size:11px;letter-spacing:1.8px;color:${INK3};padding-top:6px;">${esc(`${dateLine(a.day)} · Kişisel sabah özetiniz`.toLocaleUpperCase("tr"))}</div>
  </td></tr>
  <tr><td style="font-family:${SERIF};font-size:14px;color:${INK2};padding:18px 0 0;">Günaydın ${esc(a.doctorName)}, akış tercihlerinize göre derlenen bugünkü başlıklar:</td></tr>
  ${sectionsHtml}
  ${overflowHtml}
  <tr><td style="border-top:1px solid ${HAIR};margin-top:26px;padding:18px 0 0;">
    <div style="font-family:${SANS};font-size:11.5px;line-height:1.6;color:${INK3};padding-top:8px;">
      Bu e-postayı, ${esc("Doctorium Post")} günlük özetine e-posta kanalıyla abone olduğunuz için alıyorsunuz.
      İçerik seçiminiz <a href="${esc(a.portalUrl.replace(/\/ozet$/, "/tercihler"))}" style="color:${EMERALD};">Akış Tercihleri</a> sayfanızdan yönetilir.<br>
      <a href="${esc(a.unsubUrl)}" style="color:${INK3};">E-posta aboneliğinden çık</a> — tek tıkla işlenir.
    </div>
  </td></tr>
</table>
</td></tr></table>`;
}

export function renderDigestEmailText(a: DigestEmailArgs): string {
  const lines: string[] = [
    `DOCTORIUM.TR POST — ${dateLine(a.day)}`,
    `Günaydın ${a.doctorName}, akış tercihlerinize göre derlenen bugünkü başlıklar:`,
    "",
  ];
  for (const s of a.sections) {
    lines.push(`── ${s.label.toUpperCase()} ──`);
    for (const it of s.items) {
      lines.push(`• ${it.title} (${it.sourceName})`);
      if (it.summary) lines.push(`  ${it.summary}`);
      if (it.url) lines.push(`  ${it.url}`);
    }
    lines.push("");
  }
  if (a.overflow > 0) lines.push(`Bugünün akışında ${a.overflow} başlık daha var: ${a.portalUrl}`);
  lines.push("", "Bu e-postayı Doctorium Post günlük özetine abone olduğunuz için alıyorsunuz.",
    `Abonelikten çıkmak için: ${a.unsubUrl}`);
  return lines.join("\n");
}
