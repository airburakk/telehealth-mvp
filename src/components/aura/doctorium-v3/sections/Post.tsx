import { section } from "@/lib/doctorium-landing/content";
import type { LandingSample } from "@/lib/doctorium-landing/landing-feed";
import { FEED_MODULE_LABEL, type LandingModuleKey } from "@/lib/doctorium-landing/taxonomy";
import { ProductFrame } from "../ProductFrame";
import { FadeInUp } from "../motion";
import { LandingSection, Note } from "../primitives";

// DOCTORIUM POST bölümü (kullanıcı 2026-08-26: "Bugün sizin için" yerine Post tanıtımı) —
// SECTIONS'taki "today" yuvasında yaşar (id/anchor/sıra content.ts'ten; v2 arşivi content'i
// paylaştığı için metin BURADA, v3-lokal — content.ts'e yazılmaz). İddia disiplini korunur,
// her cümlenin kod kanıtı lib/daily-digest.ts: her sabah derlenir (bakım cron'u ingest sonrası
// runDailyDigests) · ilgi alanı başına EN FAZLA 2 başlık (MAX_PER_SECTION — "1 alan seçen 2,
// 6 alan seçen 12") · e-posta İSTEĞE BAĞLI (digestChannel opt-in; dormant'ken simülasyon —
// bu yüzden "tercihlerden açılır" denir, "e-postanıza gelir" GARANTİSİ verilmez) · boş gün
// baskı YOK · sponsorlu içerik/anket GİRMEZ. Saat yazılmaz (cron 06:30 TR ama teslim dakikası
// ölçülmemiş iddia olur). Sağdaki önizleme ürünün gazete görsel dili (masthead çift çizgi,
// /doktor/doctorium/ozet ile aynı ses) + landing örneğinin GERÇEK başlıkları — kişisel bir
// baskının kopyası değil; meta bunu "örnek baskı" olarak söyler.
const POST_COPY = {
  eyebrow: "Doctorium Post",
  title: "Güne kendi gazetenizle başlayın.",
  lead: "Seçtiğiniz ilgi alanlarındaki gelişmeler her sabah tek baskıda derlenir: Doctorium Post.",
  // Kullanıcı metni 2026-08-26 ("alan başına iki başlık" sayı detayı kalktı; kural — MAX_PER_SECTION —
  // üründe aynen sürer, yalnız tanıtım dili sadeleşti).
  body: "Gazetenizin uzunluğu ve içeriği tamamıyla sizin elinizde, size özel.",
  note: "İsteğe bağlı e-posta baskısı tercihlerden açılır; yeni içerik olmayan gün baskı çıkmaz. Sponsorlu içerik ve anketler Post'a girmez.",
} as const;

/** Örnek baskıda gösterilecek bölüm sırası — Post'un ilgi-alanı bölümleriyle aynı adlar. */
const PREVIEW_MODULES: readonly LandingModuleKey[] = ["akademik", "ilac", "hukuk-mevzuat"];

export function PostSection({ sample }: { sample: LandingSample }) {
  const copy = section("today"); // yuva: id/anchor/analytics — metin POST_COPY'den
  const bySection = PREVIEW_MODULES.map((m) => ({
    key: m,
    label: FEED_MODULE_LABEL[m],
    items: sample.items.filter((i) => i.module === m).slice(0, 2), // MAX_PER_SECTION aynası
  })).filter((s) => s.items.length > 0);
  const total = bySection.reduce((n, s) => n + s.items.length, 0);
  return (
    <LandingSection copy={copy}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
        <FadeInUp>
          <div className="max-w-[760px]">
            <div className="text-[13px] font-semibold tracking-[0.02em] text-[var(--dl-emerald)]">{POST_COPY.eyebrow}</div>
            <h2 className="mt-3 text-[clamp(30px,4.4vw,52px)] font-medium leading-[1.08] tracking-[-0.02em]">{POST_COPY.title}</h2>
            <p className="mt-5 text-[19px] leading-relaxed text-[var(--dl-body)]">{POST_COPY.lead}</p>
            <p className="mt-3 max-w-[640px] text-[17px] leading-relaxed text-[var(--dl-body)]">{POST_COPY.body}</p>
          </div>
          <Note text={POST_COPY.note} className="mt-8" />
        </FadeInUp>
        <FadeInUp delay={0.08}>
          <ProductFrame className="theme-light doctorium-scope" title="Doctorium Post" meta="örnek baskı">
            {/* Masthead — /doktor/doctorium/ozet ile aynı gazete sesi (çift alt çizgi, POST zümrüt) */}
            <div className="border-b-[3px] border-double border-[var(--c-ink)] pb-3 text-center">
              <div className="aura-display text-[24px] font-bold tracking-[0.14em] text-[var(--c-ink)]">
                DOCTORIUM.TR <span className="text-emerald-400">POST</span>
              </div>
              <div className="aura-mono mt-1 text-[10px] uppercase tracking-[0.16em] text-[var(--c-ink-3)]">
                Kişisel sabah özetiniz{total > 0 ? ` · ${total} başlık` : ""}
              </div>
            </div>
            {bySection.map((s) => (
              <div key={s.key} className="mt-3">
                <div className="aura-mono border-b border-[var(--c-hairline)] pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-300">
                  {s.label}
                </div>
                <ul>
                  {s.items.map((it) => (
                    <li key={it.id} className="border-b border-[var(--c-hairline)] py-2.5 last:border-b-0">
                      <div className="line-clamp-2 text-[13px] font-medium leading-snug text-[var(--c-ink)]">{it.title}</div>
                      <div className="aura-mono mt-0.5 truncate text-[10px] text-[var(--c-ink-3)]">{it.sourceName}</div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="mt-3 border-t border-[var(--c-hairline)] pt-2.5 text-[11px] leading-relaxed text-[var(--c-ink-3)]">
              Baskı, tercihlerinize göre kişisel akışınızdan derlenir; burada landing örneği görünür.
            </p>
          </ProductFrame>
        </FadeInUp>
      </div>
    </LandingSection>
  );
}
