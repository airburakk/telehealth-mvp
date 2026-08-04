// Doctorium sponsorlu içerik katmanı (v6.68 Faz 1) — YALNIZ İLAÇ-DIŞI reklamverenler.
// Modül D (beşeri tıbbi ürün tanıtımı / e-mümessil) PARK'ı SÜRÜYOR: TİTCK tanıtım yönetmeliği +
// aracı sıfatı hukuki görüş ister (lib/doctorium.ts başlık notu). Bu katman o parka DOKUNMAZ.
//
// KVKK ilkeleri (dayanak: vault output/doctorium-reklam-monetizasyon-2026-08-04.md §5):
//  - Kişi-bazlı gösterim logu YOK — yalnız kampanya-düzeyi agregat sayaç (impressions/clicks).
//  - Hedefleme (branş/şehir) YALNIZ açık rızalı doktorda (Doctor.sponsorPersonalizationAt dolu).
//    Rızasız/geri almış doktor reklamsız kalmaz: hedefsiz (bağlamsal) kampanyaları görür.
//  - Reklamverene kullanıcı verisi gitmez; sponsor kimliği kartta AÇIKÇA görünür ("Sponsorlu · X").
import { db } from "./db";
import { recordConsent, consentedVersion } from "./consent";

// ── Açık rıza sabitleri (ai-consent.ts deseni) ──────────────────────────────────────────────────
// Aynı ConsentRecord tablosu + ispat katmanı; kayıtları scope ayırır → migration GEREKMEZ
// (@@unique([userId, scope, version]) kompozit). Grant ve revoke AYRI scope'ta ayrı satırlar:
// aç-kapa-aç döngüsünün her adımı zincirde ayrı mühürle iz bırakır (version = kova içinde artan sayaç;
// recordConsent idempotent olduğundan sabit version yeniden-grant'ı sessizce yutardı).
export const SPONSOR_CONSENT_SCOPE = "SPONSOR_TARGETING";
export const SPONSOR_REVOKE_SCOPE = "SPONSOR_TARGETING_REVOKE";

// ⚖️ HUKUKİ TASLAK — kanonik metin: vault output/doctorium-hukuki-taslaklar-2026-08-04.md Belge 1B.
// Nihai metin kullanıcı (avukat) kontrolünden geçecek; ESASLI değişiklikte metin güncellenir
// (version kova-içi satır sayacı olduğundan metin sürümü textHash ile ispatlanır, sabitle değil).
export const SPONSOR_CONSENT_TEXT = `Doctorium'da bana gösterilen sponsorlu içeriğin mesleki profilime (branş, şehir, pazar, akış tercihlerim) göre kişiselleştirilmesi amacıyla bu verilerimin işlenmesine AÇIK RIZA veriyorum. Rızamı Özelleştir panelinden her an geri alabileceğimi, geri aldığımda sponsorlu içeriğin kişiselleştirmesiz (herkese aynı) biçimde gösterilmeye devam edeceğini, profil verilerimin reklamverenlere aktarılmayacağını anladım. (TASLAK)`;
export const SPONSOR_REVOKE_TEXT = `Kişiselleştirilmiş sponsorlu içerik için verdiğim açık rızayı geri alıyorum. (TASLAK)`;

// ── Kampanya sabitleri ──────────────────────────────────────────────────────────────────────────
// İLAÇ kategorisi BİLİNÇLİ YOK (Faz 4 parkı). CIHAZ ✅ kullanıcı kararı 2026-08-04 (uyum beyanı
// reklamverende — çerçeve sözleşme taslağı Belge 2 madde 4).
export const CATEGORY_LABEL: Record<string, string> = {
  KONGRE: "Kongre",
  SIGORTA: "Sigorta",
  YAZILIM: "Yazılım",
  CIHAZ: "Tıbbi Cihaz",
  ISE_ALIM: "İşe Alım",
  DIGER: "Diğer",
};
export const CAMPAIGN_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ENDED"] as const;

// Akışa aynı anda girecek en fazla sponsorlu kart (frekans tavanı — akış reklam panosuna dönmesin).
export const MAX_FEED_CARDS = 2;

export interface SponsorCard {
  id: string;
  sponsor: string;
  category: string;
  title: string;
  body: string;
  linkUrl: string | null;
  linkLabel: string | null;
}

interface TargetableCampaign extends SponsorCard {
  targetBranches: string | null;
  targetCities: string | null;
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Saf hedefleme süzmesi (birim test edilebilir — DB'siz).
 * personalized=false → YALNIZ hedefsiz kampanyalar (branş VE şehir listesi boş olanlar).
 * personalized=true  → hedefsizler + branş/şehir kesişenler (hedef listesi boş = o eksende herkese).
 */
export function filterCampaigns<T extends { targetBranches: string | null; targetCities: string | null }>(
  campaigns: T[],
  opts: { personalized: boolean; branches: string[]; city: string | null },
): T[] {
  return campaigns.filter((c) => {
    const tb = parseList(c.targetBranches);
    const tc = parseList(c.targetCities);
    if (!opts.personalized) return tb.length === 0 && tc.length === 0; // bağlamsal-only
    const branchOk = tb.length === 0 || tb.some((s) => opts.branches.includes(s));
    const cityOk = tc.length === 0 || (!!opts.city && tc.includes(opts.city));
    return branchOk && cityOk;
  });
}

/**
 * Akışa girecek kampanyalar: ACTIVE + tarih penceresi içinde; hedefleme filterCampaigns ile.
 * Aktif kampanya sayısı küçük kalacağı için (onlarca) tümü çekilip JS'te süzülür — JSON kolonda
 * SQL süzme kurmaya değmez. En yeni kampanya önce; tavan MAX_FEED_CARDS.
 */
export async function activeCampaignsFor(opts: {
  personalized: boolean;
  branches: string[];
  city: string | null;
}): Promise<SponsorCard[]> {
  const now = new Date();
  const rows: TargetableCampaign[] = await db.sponsorCampaign.findMany({
    where: { status: "ACTIVE", startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, sponsor: true, category: true, title: true, body: true,
      linkUrl: true, linkLabel: true, targetBranches: true, targetCities: true,
    },
  });
  return filterCampaigns(rows, opts)
    .slice(0, MAX_FEED_CARDS)
    .map(({ targetBranches: _tb, targetCities: _tc, ...card }) => card);
}

/**
 * Agregat gösterim sayacı (kişisiz, tek updateMany). Sayaç artışı klinik/yasal iddia üretmez;
 * kaybı kabul edilebilir, akışın düşmesi edilemez → hata loglanır ama YUTULUR (bilinçli istisna —
 * "hata yutan yardımcı" dersi iddia-üreten kod içindir).
 */
export async function countImpressions(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await db.sponsorCampaign.updateMany({
      where: { id: { in: ids } },
      data: { impressions: { increment: 1 } },
    });
  } catch (e) {
    console.error("[sponsor] impression sayacı yazılamadı:", e);
  }
}

/**
 * Kişiselleştirme rızasını aç/kapat — durum Doctor.sponsorPersonalizationAt, ispat ConsentRecord.
 *
 * GRANT fail-closed: ÖNCE zincir izi yazılır (recordConsent throw ederse damga atılmaz →
 * ispatsız kişiselleştirme AÇILMAZ; consent-yazımı-fail-closed ilkesi).
 * REVOKE'ta sıra TERSİNE bilinçli: geri alma iradesi DERHAL uygulanır (önce damga null),
 * iz yazımı sonra — iz hatası kullanıcının geri almasını bloke edemez (KVKK).
 */
export async function setSponsorPersonalization(
  userId: string,
  doctorId: string,
  enable: boolean,
  ip?: string | null,
  userAgent?: string | null,
): Promise<void> {
  if (enable) {
    const next = (await consentedVersion(userId, SPONSOR_CONSENT_SCOPE)) + 1;
    await recordConsent(userId, ip, userAgent, {
      scope: SPONSOR_CONSENT_SCOPE, version: next, text: SPONSOR_CONSENT_TEXT,
    });
    await db.doctor.update({ where: { id: doctorId }, data: { sponsorPersonalizationAt: new Date() } });
  } else {
    await db.doctor.update({ where: { id: doctorId }, data: { sponsorPersonalizationAt: null } });
    const next = (await consentedVersion(userId, SPONSOR_REVOKE_SCOPE)) + 1;
    await recordConsent(userId, ip, userAgent, {
      scope: SPONSOR_REVOKE_SCOPE, version: next, text: SPONSOR_REVOKE_TEXT,
    });
  }
}
