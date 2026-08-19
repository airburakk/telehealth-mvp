import { Landmark, ChevronRight } from "lucide-react";

// e-Devlet Mezun Belgesi kılavuzu (v6.124) — diploma yükleme kartının altına gömülür; kapalı
// başlar, tıklayınca açılır (taslak HTML kullanıcıya gösterildi ve onaylandı, 2026-08-19).
// Hook'suz saf işaretleme (details/summary) → hem server hem client ağaçta kullanılabilir.
// Metin disiplini: süre/hız iddiası yalnız kullanıcı onaylı "anında doğrulanır" ifadesi
// (deterministik kod davranışı — barkod okunursa beklemesiz ACCEPTED); oran/istatistik YOK.

const ADIMLAR: { baslik: React.ReactNode; aciklama: React.ReactNode; chip?: string }[] = [
  {
    baslik: "e-Devlet Kapısı'na giriş yapın",
    aciklama: (
      <>Tarayıcınızdan <strong>turkiye.gov.tr</strong> adresine gidin; T.C. kimlik numaranız ve
      e-Devlet şifrenizle giriş yapın. Mobil e-Devlet uygulaması da kullanılabilir.</>
    ),
    chip: "turkiye.gov.tr",
  },
  {
    baslik: "Arama kutusuna “Mezun Belgesi” yazın",
    aciklama: (
      <>Üstteki arama çubuğuna <strong>Mezun Belgesi</strong> yazın ve listeden Yükseköğretim
      Kurulu Başkanlığı&apos;nın hizmetini seçin.</>
    ),
    chip: "Yükseköğretim Mezun Belgesi Sorgulama",
  },
  {
    baslik: "Tıp programınızı seçip barkodlu belge oluşturun",
    aciklama: (
      <>Mezuniyet kaydınızın yanındaki <strong>“Barkodlu Belge Oluştur”</strong> düğmesine
      tıklayın. Belge; barkod numarası, karekod ve elektronik imza ile üretilir.</>
    ),
  },
  {
    baslik: "PDF'i indirin",
    aciklama: (
      <>Oluşan belgeyi <strong>PDF olarak</strong> cihazınıza kaydedin. Çıktı almanıza gerek yok —
      dijital dosyanın kendisi gerekiyor.</>
    ),
  },
  {
    baslik: "Bu ekrana yükleyin",
    aciklama: (
      <>İndirdiğiniz PDF&apos;i yukarıdaki <strong>Tıp Diploması</strong> kartına yükleyin. Sistem
      belgedeki barkodu okur ve doğrular; Doctor<span className="doctorium-ium">ium</span>{" "}
      üyeliğiniz <strong>anında</strong> açılır.</>
    ),
  },
];

export function EdevletKilavuz() {
  return (
    <details className="group mt-3 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)]">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--c-accent)]/12 text-[var(--c-accent-stronger)]">
          <Landmark size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-[var(--c-ink)]">
            e-Devlet üzerinden Mezun Belgesi alınması için izlenmesi gereken adımlar
          </span>
          <span className="mt-0.5 block text-[11px] text-[var(--c-ink-3)]">
            Barkodlu belge anında doğrulanır — inceleme beklemezsiniz
          </span>
        </span>
        <ChevronRight size={16} className="shrink-0 text-[var(--c-accent)] transition-transform group-open:rotate-90" aria-hidden />
      </summary>

      <ol className="px-4 pb-2 pt-1">
        {ADIMLAR.map((a, i) => (
          <li key={i} className="relative flex gap-3 pb-4 last:pb-3">
            {/* Adımlar arası dikey bağ çizgisi (son adımda yok) */}
            {i < ADIMLAR.length - 1 && (
              <span aria-hidden className="absolute left-[13px] top-8 h-[calc(100%-28px)] w-px bg-[var(--c-accent)]/25" />
            )}
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--c-accent)]/12 text-[12px] font-bold text-[var(--c-accent-stronger)] ring-1 ring-[var(--c-accent)]/30">
              {i + 1}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-[12.5px] font-semibold text-[var(--c-ink)]">{a.baslik}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-[var(--c-ink-2)]">{a.aciklama}</span>
              {a.chip && (
                <span className="mt-1.5 inline-block rounded-lg bg-[var(--c-ink)]/6 px-2 py-0.5 font-mono text-[10.5px] text-[var(--c-ink-2)] ring-1 ring-[var(--c-hairline)]">
                  {a.chip}
                </span>
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="mx-4 mb-4 rounded-xl bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-600 ring-1 ring-amber-400/25 dark:text-amber-300">
        Diplomanızın fotoğrafı/taraması da kabul edilir; ancak bu durumda belge{" "}
        <strong>insan incelemesine</strong> alınır ve açılış bekleyebilir. e-Devlet&apos;ten alınan
        barkodlu PDF beklemeden doğrulanır.
      </p>
    </details>
  );
}
