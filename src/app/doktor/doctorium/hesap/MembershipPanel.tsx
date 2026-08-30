"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, TriangleAlert, X } from "lucide-react";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { AuraButton } from "@/components/ui/AuraButton";

// Üyelik kapatma paneli (v6.187) — İKİ VARYANT, hangisinin çizileceğini SUNUCU söyler:
//
//   · mode="close" → yalnız Doctorium üyeliği olan hesap (Aşama 1 doktoru / tıp öğrencisi).
//     Hesap dahil her şey o anda silinir. Onay kelimesi: KAPAT.
//   · mode="leave" → AURA klinik hesabı da olan (Aşama 2) doktor. Hesap KAPANMAZ; yalnız Doctorium
//     katmanı silinir ve erişim kapanır. Onay kelimesi: ÇIK.
//
// ⚖️ KALANLAR (kullanıcı kararı 2026-08-29): anket yanıtları ve tamamlanmış ödül kullanımları
// SİLİNMEZ — tamamlanmış işlemlerdir, kimlik bağı koparılarak yerinde kalır. Puanlar ise ileriye
// dönük bir haktır: silinir ve geri yüklenmez (aşağıdaki uyarı bandı bunu açıkça söyler).

export type MembershipMode = "close" | "leave";

const COPY: Record<MembershipMode, {
  title: string;
  meta: string;
  lede: React.ReactNode;
  removed: string[];
  warning: string;
  keeps: React.ReactNode;
  word: string;
  cta: string;
}> = {
  close: {
    title: "Üyeliği kapat",
    meta: "GERİ DÖNÜŞÜ YOK",
    lede: (
      <>
        Üyeliğinizi kapattığınızda hesabınız ve Doctorium&rsquo;daki tüm verileriniz{" "}
        <strong className="font-medium text-[var(--c-ink)]">o anda silinir</strong>. Bekleme süresi
        veya onay aşaması yoktur.
      </>
    ),
    removed: [
      "Ad, e-posta, parola",
      "Unvan, branş, şehir, diller",
      "Mezun belgeniz",
      "Kaydettikleriniz",
      "Takip ettiğiniz kongreler",
      "Takviminiz",
      "Puanlarınız",
      "Akış tercihleriniz",
      "Bildirimleriniz",
      "Sponsor içerik rızanız",
    ],
    warning:
      "Hesabı sildiğiniz anda birikmiş puanlarınız da silinecektir. Tekrardan giriş yaptığınızda bu puanlar yüklenmeyecektir.",
    keeps: (
      <>
        <b className="font-medium text-[var(--c-ink-2)]">Kimliğinizle bağı koparılarak kalanlar:</b>
        <ul className="mt-2 space-y-1.5">
          <li>
            <b className="font-medium text-[var(--c-ink-2)]">Anket yanıtlarınız</b> — verdiğiniz oy,
            anketin o tarihteki sonucudur; sonuçtan çıkarılmaz.
          </li>
          <li>
            <b className="font-medium text-[var(--c-ink-2)]">Ödül kullanımlarınız</b> — puan
            karşılığı tamamlanmış işlemlerdir; geriye dönük bir işlem yapılmaz.
          </li>
          <li>
            <b className="font-medium text-[var(--c-ink-2)]">Giriş ve erişim kayıtları</b> — kimlik
            bilgisi taşımaz, değiştirilemez güvenlik zinciri oluşturur.
          </li>
        </ul>
      </>
    ),
    word: "KAPAT",
    cta: "Üyeliğimi kalıcı olarak kapat",
  },
  leave: {
    title: "Doctorium üyeliğinden çık",
    meta: "HESAP KAPANMAZ",
    lede: (
      <>
        <strong className="font-medium text-[var(--c-ink)]">
          Hesabınız AURA klinik hizmetinde de kullanılıyor.
        </strong>{" "}
        Bu nedenle buradan hesabınız kapatılmaz — yalnız Doctorium üyeliğiniz sonlandırılır ve
        Doctorium verileriniz silinir. Klinik hesabınız ve AURA erişiminiz aynen devam eder.
      </>
    ),
    removed: [
      "Kaydettikleriniz",
      "Takip ettiğiniz kongreler",
      "Takviminiz",
      "Puanlarınız",
      "Akış tercihleriniz",
      "Doctorium bildirimleriniz",
      "Sponsor içerik rızanız",
    ],
    warning:
      "Üyeliğinizi sonlandırdığınız anda birikmiş puanlarınız da silinecektir. Tekrar üye olduğunuzda bu puanlar yüklenmeyecektir.",
    keeps: (
      <>
        <b className="font-medium text-[var(--c-ink-2)]">Kalanlar:</b> hesabınız, giriş bilgileriniz,
        mezun belgeniz ve AURA klinik verileriniz. Anket yanıtlarınız ve tamamlanmış ödül
        kullanımlarınız kimlik bağı olmadan yerinde kalır. Doctorium&rsquo;a erişiminiz kapanır;
        dilediğiniz zaman yeniden üye olabilirsiniz.
      </>
    ),
    word: "ÇIK",
    cta: "Doctorium üyeliğimi sonlandır",
  },
};

export function MembershipPanel({ mode }: { mode: MembershipMode }) {
  const router = useRouter();
  const t = COPY[mode];
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = confirm.trim().toLocaleUpperCase("tr-TR") === t.word;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/doctorium/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: mode, confirm: t.word }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(d?.error ?? "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
        setBusy(false);
        return;
      }
      // Kapatmada oturum sunucuda sonlandırıldı → giriş kapısına. Üyelikten çıkışta hesap yaşıyor,
      // ama Doctorium erişimi kapandı → kök yönlendirme kullanıcıyı doğru yüzeye taşır.
      // router.refresh() ŞART: replace tek başına bayat RSC cache'ini kullanabilir.
      router.replace(mode === "close" ? "/doctorium/giris" : "/");
      router.refresh();
    } catch {
      setError("Bağlantı kurulamadı. Lütfen tekrar deneyin.");
      setBusy(false);
    }
  }

  return (
    <AuraPanel title={t.title} meta={t.meta} className="mt-5">
      <p className="max-w-[68ch] text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">{t.lede}</p>

      <div className="mt-4 rounded-2xl border border-[var(--c-danger)]/25 bg-[var(--c-surface)] px-4 py-4">
        <div className="aura-mono text-[11px] uppercase tracking-[0.14em] text-[var(--c-danger)]">
          Silinecekler
        </div>
        <ul className="mt-3 grid gap-x-7 gap-y-1.5 sm:grid-cols-2">
          {t.removed.map((item) => (
            <li key={item} className="flex items-start gap-2 text-[13.5px] text-[var(--c-ink-2)]">
              <X size={13} className="mt-1 shrink-0 text-[var(--c-danger)]/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--c-danger)]/30 bg-[var(--c-danger)]/8 px-4 py-3.5">
        <TriangleAlert size={18} className="mt-0.5 shrink-0 text-[var(--c-danger)]" />
        <p className="text-[13.5px] leading-relaxed text-[var(--c-danger)]">{t.warning}</p>
      </div>

      <div className="mt-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5 text-[12.5px] leading-relaxed text-[var(--c-ink-3)]">
        {t.keeps}
      </div>

      <form onSubmit={submit} className="mt-6 border-t border-[var(--c-hairline)] pt-5">
        <label className="mb-1.5 block text-[13px] text-[var(--c-ink-2)]" htmlFor="mb-confirm">
          Onaylamak için <span className="font-semibold text-[var(--c-ink)]">{t.word}</span> yazın
        </label>
        <input
          id="mb-confirm"
          type="text"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t.word}
          autoComplete="off"
          className="w-full max-w-xs rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-sm text-[var(--c-ink)] placeholder:text-[var(--c-ink-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--c-danger)]"
        />

        {error && (
          <p role="alert" className="mt-3 text-[13px] text-[var(--c-danger)]">{error}</p>
        )}

        <div className="mt-4">
          <AuraButton type="submit" variant="danger" disabled={!ready || busy}>
            <AlertTriangle size={16} />
            {busy ? "İşleniyor…" : t.cta}
          </AuraButton>
        </div>
      </form>
    </AuraPanel>
  );
}
