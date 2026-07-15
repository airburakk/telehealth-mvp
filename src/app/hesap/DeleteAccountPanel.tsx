"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useT } from "@/components/useT";

// Hesap ve veri silme paneli (v6.11) — hastanın kendi hesabını sildiği tek yer.
//
// TASARIM İLKESİ: hasta NE OLACAĞINI silmeden ÖNCE bilmeli. Bu ekranın asıl işi düğme değil, METİN:
// klinik kaydın YASAL SAKLAMA gereği durduğunu ama HERKESE (hastanın kendisine de) kapandığını, süre
// sonunda imha edileceğini ve belge indirmek isterse ŞİMDİ indirmesi gerektiğini açıkça söyler.
// Silme sonrası "keşke indirseydim" durumu geri alınamaz.
//
// Onay: serbest metne "SİL" yazma (tek tıkla kaza engeli). API de aynı onayı ister (istemciye güvenilmez).
const TEXTS = [
  "Hesabımı ve verilerimi sil",
  "Bu işlem geri alınamaz. Ne olacağını açıkça yazıyoruz.",
  "Gerçekten silinir",
  "E-posta adresiniz, adınız, telefonunuz ve profil tercihleriniz; bildirimleriniz. Oluşturduğunuz tüm paylaşım linkleri iptal edilir. Tüm cihazlardaki oturumlarınız kapanır ve bir daha giriş yapamazsınız.",
  "Hemen silinmez — yasal saklama",
  "Sağlık kayıtlarınız (vakalarınız, raporlarınız, görüşme notlarınız) yasal saklama süresi boyunca tutulmak zorundadır. Ancak bu kayıtlar erişime kapanır — doktorlar, koordinatörler ve yöneticiler dahil hiç kimse açamaz. Süre dolduğunda otomatik olarak imha edilir.",
  "Siz de erişemezsiniz — silmeden önce saklamak istediğiniz belge varsa şimdi indirin.",
  "Bilerek saklanan iki şey",
  "Onay kayıtlarınız: sakladığımız kayıtların hukuki dayanağını ispatlar; kayıtlarla birlikte imha edilir. Erişim geçmişi: değiştirilemez denetim zinciri — kimlik verisi taşımaz, silinmesi zinciri kırar.",
  "Onaylamak için aşağıya SİL yazın",
  "Siliniyor…",
  "Hesabınız silindi. Kişisel verileriniz kaldırıldı; klinik kayıtlarınız erişime kapatıldı.",
  "İşlem başarısız. Lütfen tekrar deneyin.",
  "yıl",
];

export function DeleteAccountPanel({ lang, retentionYears }: { lang: string; retentionYears: number }) {
  const texts = useMemo(() => TEXTS, []); // sabit referans — useT yarış dersi (v3.5)
  const { t } = useT(lang, texts);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/account/delete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "SİL" }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setErr(t("İşlem başarısız. Lütfen tekrar deneyin."));
      return;
    }
    setDone(true);
    // Oturum düştü → ana sayfaya. router.push yerine tam yeniden yükleme: sunucu bileşenleri
    // silinmiş oturumla yeniden çizilsin (LoginForm'daki önbellek/zamanlama dersi).
    setTimeout(() => { window.location.href = "/"; }, 2500);
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] p-5 text-sm text-[var(--c-ink)]">
        {t("Hesabınız silindi. Kişisel verileriniz kaldırıldı; klinik kayıtlarınız erişime kapatıldı.")}
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-red-500/25 bg-red-500/5 p-5">
      <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--c-ink)]">
        <AlertTriangle size={17} className="text-red-400" /> {t("Hesabımı ve verilerimi sil")}
      </h2>
      <p className="mt-2 text-sm font-medium text-[var(--c-ink)]">{t("Bu işlem geri alınamaz. Ne olacağını açıkça yazıyoruz.")}</p>

      <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">{t("Gerçekten silinir")}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--c-ink-2)]">
        {t("E-posta adresiniz, adınız, telefonunuz ve profil tercihleriniz; bildirimleriniz. Oluşturduğunuz tüm paylaşım linkleri iptal edilir. Tüm cihazlardaki oturumlarınız kapanır ve bir daha giriş yapamazsınız.")}
      </p>

      <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">
        {t("Hemen silinmez — yasal saklama")} ({retentionYears} {t("yıl")})
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--c-ink-2)]">
        {t("Sağlık kayıtlarınız (vakalarınız, raporlarınız, görüşme notlarınız) yasal saklama süresi boyunca tutulmak zorundadır. Ancak bu kayıtlar erişime kapanır — doktorlar, koordinatörler ve yöneticiler dahil hiç kimse açamaz. Süre dolduğunda otomatik olarak imha edilir.")}
      </p>
      {/* Kritik uyarı — kilit hastayı da kapsar; bunu silmeden ÖNCE bilmeli. Vurgulu. */}
      <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium leading-relaxed text-amber-300 ring-1 ring-amber-400/25">
        {t("Siz de erişemezsiniz — silmeden önce saklamak istediğiniz belge varsa şimdi indirin.")}
      </p>

      <h3 className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--c-ink-2)]">{t("Bilerek saklanan iki şey")}</h3>
      <p className="mt-1 text-sm leading-relaxed text-[var(--c-ink-2)]">
        {t("Onay kayıtlarınız: sakladığımız kayıtların hukuki dayanağını ispatlar; kayıtlarla birlikte imha edilir. Erişim geçmişi: değiştirilemez denetim zinciri — kimlik verisi taşımaz, silinmesi zinciri kırar.")}
      </p>

      <label className="mt-6 block text-sm font-medium text-[var(--c-ink)]" htmlFor="confirm-delete">
        {t("Onaylamak için aşağıya SİL yazın")}
      </label>
      <input
        id="confirm-delete"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        autoComplete="off"
        className="inp mt-2 max-w-[220px]"
      />

      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={confirm.trim() !== "SİL" || busy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
        {busy ? t("Siliniyor…") : t("Hesabımı ve verilerimi sil")}
      </button>
    </section>
  );
}
