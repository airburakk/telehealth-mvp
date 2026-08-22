import Link from "next/link";
import { Info, MapPin, CalendarClock, ExternalLink } from "lucide-react";
import { EVENT_TYPE_LABEL, scopeBadge } from "@/lib/doctorium";
import { SourcePlate, formatDate } from "./ArticleCard";
import { SaveButton } from "./SaveButton";
import { FollowButton } from "./CongressControls";

// Etkinlik listesi — page.tsx'ten ÇIKARILDI (2026-08-23; landing V2 "Kongre" bölümü aynı bileşeni
// canFollow=false + savedIds=null ile salt-okunur çizer; kopya = drift). Sunucu bileşeni;
// yalnız FollowButton/SaveButton istemci adası ve ikisi de koşullu (anonimde HİÇ render edilmez).
// `hrefFor`: landing'de kart bağlantısı giriş kapısına (proxy hasta kapısına atmasın).

export interface CongressRow {
  id: string; title: string; organizer: string | null; city: string | null; country: string;
  startDate: Date; endDate: Date | null; abstractDeadline: Date | null; earlyBirdDeadline: Date | null;
  url: string | null; branchSlugs: string;
  scope: string; venue: string | null; warning: string | null; confidence: string;
  eventType: string; ttbCode: string | null;
}

export function CongressList({
  rows, followed, canFollow, savedIds, followedOnly = false, hrefFor,
}: {
  rows: CongressRow[]; followed: Set<string>; canFollow: boolean; savedIds: Set<string> | null;
  followedOnly?: boolean; hrefFor?: (id: string) => string;
}) {
  if (!rows.length) {
    // Takip süzgecinin kendi boş hâli: takipler geçmişte kalmış olabilir (CongressFollow
    // silinmez) — tür/kapsam öğüdü burada yanıltıcı olurdu, süzgeç onlardan bağımsız.
    return followedOnly ? (
      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Takip ettiğiniz yaklaşan etkinlik yok. Bir etkinliği kartındaki{" "}
          <strong className="text-[var(--c-ink)]">Takip et</strong> düğmesiyle izlemeye
          alabilirsiniz — başlangıç, bildiri ve erken kayıt tarihleri yaklaşınca bildirim alırsınız.
        </span>
      </p>
    ) : (
      <p className="mt-5 flex items-start gap-2 rounded-2xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-8 text-sm text-[var(--c-ink-2)]">
        <Info size={16} className="mt-0.5 shrink-0" />
        <span>
          Seçtiğiniz tür, branş ve kapsamda yaklaşan etkinlik yok. Özelleştir&apos;den
          <strong className="text-[var(--c-ink)]"> tür</strong> seçimini genişletmeyi (kurs, eğitim,
          çalıştay), kapsamı <strong className="text-[var(--c-ink)]">Tümü</strong> yapmayı ya da branş
          tercihlerinizi genişletmeyi deneyin.
        </span>
      </p>
    );
  }
  return (
    /* grid-cols-[minmax(0,1fr)]: ana listedeki taşma dersinin eşleniği (grid item min-width:auto). */
    <ul className="mt-5 grid grid-cols-[minmax(0,1fr)]">
      {rows.map((c) => (
        /* Kart standardı (2026-08-14): sol kenarda 3px bölüm şeridi (Etkinlik = tema-duyarlı ink),
           üst satırda sembol+etiket · sağda Kaydet+Takip, altta ÇİZGİLİ aksiyon satırı. */
        /* Kutu KALKTI (sentez, 2026-08-19): ArticleCard ile aynı gramer — plaka + künye,
           display başlık, öğeler arası tek saç çizgi. Etkinliğe özgü bilgi (bildiri/erken
           kayıt tarihleri, TTB kodu) kalır; onlar çip değil, karar veren veridir. */
        <li key={c.id} className="min-w-0 border-t border-[var(--c-hairline)] py-[17px] first:border-t-0 first:pt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <SourcePlate name={c.organizer || "Etkinlik"} />
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-semibold leading-[1.3] text-[var(--c-ink)]">
                  {c.organizer || "Etkinlik"}
                </div>
                <div className="mt-px flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[var(--c-ink-3)]">
                  {/* Tür etiketi: sekme 9 tür taşıyor, "kongre mü sempozyum mu" ilk soru (v6.120). */}
                  <span className="aura-mono text-[11px] font-semibold tracking-[0.06em] text-cyan-300">
                    {(EVENT_TYPE_LABEL[c.eventType] ?? "Etkinlik").toLocaleUpperCase("tr-TR")}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(c.startDate)}{c.endDate ? ` – ${formatDate(c.endDate)}` : ""}</span>
                  <span aria-hidden="true">·</span>
                  <span>{scopeBadge(c.scope)}</span>
                  {(c.city || c.country) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} />{[c.city, c.country].filter(Boolean).join(", ")}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-1">
              {savedIds != null && <SaveButton articleId={c.id} initialSaved={savedIds.has(c.id)} />}
              {canFollow && <FollowButton congressId={c.id} following={followed.has(c.id)} />}
            </span>
          </div>

          <Link
            href={hrefFor ? hrefFor(c.id) : `/doktor/doctorium/etkinlik/${c.id}`}
            className="aura-display mt-2.5 block text-[17px] font-semibold leading-[1.32] tracking-[-0.018em] text-[var(--c-ink)] hover:underline hover:underline-offset-[3px]"
          >
            {c.title}
          </Link>

          {(c.abstractDeadline || c.earlyBirdDeadline) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--c-ink-2)]">
              {c.abstractDeadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={11} /> Bildiri son: <strong>{formatDate(c.abstractDeadline)}</strong>
                </span>
              )}
              {c.earlyBirdDeadline && (
                <span className="inline-flex items-center gap-1">
                  <CalendarClock size={11} /> Erken kayıt: <strong>{formatDate(c.earlyBirdDeadline)}</strong>
                </span>
              )}
            </div>
          )}

          {/* Dış bağlantılar çizgisiz, künye tonunda — aksiyon SATIRI değil, meta kuyruğu. */}
          {(c.url || c.ttbCode) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--c-ink-3)]">
              {c.url && (
                <a href={c.url} target="_blank" rel="noopener noreferrer nofollow"
                  className="inline-flex items-center gap-1 hover:text-[var(--c-ink-2)] hover:underline">
                  <ExternalLink size={11} /> Resmî site
                </a>
              )}
              {/* TTB akreditasyonu: kod VAR demek "akredite" demek — kaç KREDİ vereceğini
                  DEMEZ (puan katılım süresine göre TTB'de oluşur). Sayı yazılmaz, doktor
                  TTB'nin kendi kaydına gönderilir. Bkz. [[public-claim-honesty]]. */}
              {c.ttbCode && (
                <a href="https://kredilendirme.ttb.dr.tr/etkinlik_bul.php" target="_blank"
                  rel="noopener noreferrer nofollow" title="TTB STE/SMG akredite etkinlik — kredi, katıldığınız süreye göre TTB kaydında oluşur"
                  className="inline-flex items-center gap-1 hover:text-[var(--c-ink-2)] hover:underline">
                  <ExternalLink size={11} /> TTB akredite <span className="aura-mono">{c.ttbCode}</span>
                </a>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
