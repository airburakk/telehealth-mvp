import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, Landmark, ShieldCheck, Stethoscope } from "lucide-react";

// İki aşamalı doktor üyeliği açıklama sayfası (v6.87). Public (proxy matcher dışı — /kayit gibi).
// Metinler kullanıcı onaylı (2026-08-11); iddia disiplini: "anında" = mimari gerçek (otomatik
// damga), ölçülmemiş oran/hız iddiası YOK; dizin görünürlüğünün admin doğrulaması AÇIKÇA yazılır.
export const metadata = { title: "Doktor üyeliği nasıl çalışır?" };

export default function SignupStagesPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <Link href="/kayit" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--c-ink-3)] hover:text-[var(--c-ink-2)]">
        <ArrowLeft size={14} /> Kayıt sayfasına dön
      </Link>

      <h1 className="aura-display mt-4 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
        Doktor üyeliği nasıl çalışır?
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[var(--c-ink-2)]">
        AURA&apos;da doktor üyeliği iki aşamalıdır. İlk aşama dakikalar içinde tamamlanır; ikinciyi
        dilediğiniz zaman, kendi hızınızda tamamlarsınız.
      </p>

      {/* Aşama 1 */}
      <div className="mt-8 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--c-accent)] text-[var(--c-bg)]">
            <BookOpenCheck size={18} />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-accent-stronger)]">Aşama 1</div>
            <div className="text-base font-semibold text-[var(--c-ink)]">Doctorium Üyeliği</div>
          </div>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
              <Landmark size={13} /> Gereken
            </dt>
            <dd className="mt-1 text-[var(--c-ink-2)]">
              Bağlı olduğunuz tabip odasından alınmış <strong>Protokol Numaralı üye yazısı</strong> (PDF/JPG/PNG).
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">Açılan</dt>
            <dd className="mt-1 text-[var(--c-ink-2)]">
              Doctorium&apos;un tamamı — branşınıza göre haber akışı, akademik yayın takibi, sektör
              gündemi, kongre takvimi ve ücretsiz araçlar.
            </dd>
          </div>
        </dl>
        <p className="mt-4 rounded-xl bg-[var(--c-surface)] px-3 py-2.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          Yazı yüklendiğinde erişiminiz otomatik açılır. Bu aşamada ayrıca iki tercih sorulur —
          ikisi de <strong>isteğe bağlıdır</strong> ve istediğiniz an değiştirilebilir: sponsorlu
          içeriğin mesleki profilinize göre kişiselleştirilmesi ile insan kaynakları uzmanlarının
          sizinle iletişime geçebilmesi.
        </p>
      </div>

      {/* Aşama 2 */}
      <div className="mt-4 rounded-3xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--c-ink)]/15 text-[var(--c-ink)]">
            <Stethoscope size={18} />
          </span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-ink-3)]">Aşama 2</div>
            <div className="text-base font-semibold text-[var(--c-ink)]">Klinik Havuz Üyeliği</div>
          </div>
        </div>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">
              <ShieldCheck size={13} /> Gereken
            </dt>
            <dd className="mt-1 text-[var(--c-ink-2)]">
              Tıp diploması, MMSS poliçesi (poliçe bilgileriyle), diploma/tescil ve uzmanlık
              bilgileri, en az bir işlem tanımı.
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--c-ink-3)]">Açılan</dt>
            <dd className="mt-1 text-[var(--c-ink-2)]">
              Uzaktan sağlık vaka havuzu, ikinci görüş paneli (ünvana bağlı), sağlık turizmi
              kulvarı, konsültasyon ve ücretsiz sağlık hizmeti pencereleri.
            </dd>
          </div>
        </dl>
        <p className="mt-4 rounded-xl bg-[var(--c-surface)] px-3 py-2.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          Belgeler tamamlandığında hesabınız klinik havuza katılır; kamuya açık doktor dizininde
          görünmek yönetici doğrulamasından sonradır.
        </p>
      </div>

      <Link
        href="/kayit"
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)]"
      >
        Kayda başla <ArrowRight size={16} />
      </Link>
    </div>
  );
}
