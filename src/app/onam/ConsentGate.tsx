"use client";

// KVKK açık onam kapısı — hasta için lokalize (8+ dil) + RTL; personel için TR.
// ⚖️ HUKUKİ TASLAK — aydınlatma + açık rıza metinleri veri sorumlusu/hukuk müşavirince
// nihai hâline getirilmelidir. Metin esaslı değişince lib/consent-config CONSENT_VERSION artır.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/useT";
import { usePatientLang, PatientLangSelect } from "@/components/PatientLocale";
import { langDir } from "@/lib/constants";
import { ShieldCheck, Loader2, ArrowRight } from "lucide-react";

const PATIENT = {
  title: "Kişisel Verilerin Korunması — Aydınlatma ve Açık Rıza",
  intro: "Sağlık hizmetini sunabilmemiz için aşağıdaki veri işleme faaliyetleri hakkında sizi bilgilendiriyor ve açık rızanızı talep ediyoruz. Bu onay bir kez alınır; her girişte veya her görüşmede yeniden sorulmaz.",
  items: [
    "İşlenen veriler: kimlik ve iletişim bilgileriniz; tıbbi geçmiş, şikâyet, tanı, tetkik ve belgeleriniz dâhil sağlık verileriniz (özel nitelikli kişisel veri); video görüşmelerdeki ses ve görüntünüz.",
    "Amaç: ön değerlendirme (triyaj), uzaktan konsültasyon, ikinci görüş, gönüllü (pro bono) doktor eşleştirmesi, sağlık turizmi organizasyonu ve ameliyat sonrası takip hizmetlerinin sunulması.",
    "Aktarım: verileriniz; sizi değerlendiren yetkili sağlık personeliyle, gerçek zamanlı çeviri için yapay zekâ hizmet sağlayıcısıyla (ses verisi yurt dışına aktarılabilir) ve yalnızca sizin oluşturduğunuz paylaşım bağlantısıyla yetkilendirdiğiniz kişilerle paylaşılır.",
    "Haklarınız: KVKK m.11 kapsamında verilerinize erişme, düzeltme, silme ve işlemeye itiraz haklarına sahipsiniz; onamınızı dilediğiniz zaman geri alabilirsiniz.",
  ],
  consent: "Yukarıdaki aydınlatma metnini okudum; sağlık verilerim dâhil kişisel verilerimin belirtilen amaçlarla işlenmesine ve gerekli hâllerde yurt dışına aktarılmasına açık rıza veriyorum.",
  draft: "(KVKK aydınlatma ve açık rıza metni — taslak)",
  accept: "Onaylıyorum ve devam et",
  errMsg: "Bir hata oluştu, lütfen tekrar deneyin.",
};

const STAFF = {
  title: "KVKK & Gizlilik — Aydınlatma ve Onay (Personel)",
  intro: "Platformu kullanabilmeniz için aşağıdaki bilgilendirmeyi onaylamanız gerekir. Bu onay bir kez alınır; her girişte yeniden sorulmaz.",
  items: [
    "İşlenen veriler: kimlik, iletişim ve mesleki bilgileriniz (unvan, branş, diploma/tescil no) ile platform kullanım kayıtlarınız.",
    "Erişim ve gizlilik: görevlendirildiğiniz hastaların özel nitelikli sağlık verilerine erişirsiniz; bu verileri yalnızca hizmet amacıyla işlemeyi, gizliliğini korumayı ve mevzuata uygun davranmayı taahhüt edersiniz.",
    "Sorumluluk: verdiğiniz klinik görüş ve kayıtların doğruluğundan ve mesleki/etik kurallara uygunluğundan siz sorumlusunuz.",
    "Haklarınız: KVKK m.11 kapsamındaki haklarınız saklıdır.",
  ],
  consent: "Yukarıdaki aydınlatma metnini okudum; kişisel verilerimin işlenmesine ve platform gizlilik/kullanım koşullarına onay veriyorum.",
  draft: "(KVKK aydınlatma ve onay metni — taslak)",
  accept: "Onaylıyorum ve devam et",
  errMsg: "Bir hata oluştu, lütfen tekrar deneyin.",
};

export function ConsentGate({ isPatient, dest }: { isPatient: boolean; dest: string }) {
  const router = useRouter();
  const [patientLang, setPatientLang] = usePatientLang();
  const lang = isPatient ? patientLang : "Türkçe";
  const C = isPatient ? PATIENT : STAFF;

  const texts = useMemo(() => [C.title, C.intro, ...C.items, C.consent, C.draft, C.accept, C.errMsg], [C]);
  const { t } = useT(lang, texts);

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function accept() {
    setSubmitting(true);
    setErr("");
    try {
      const r = await fetch("/api/consent", { method: "POST" });
      if (!r.ok) throw new Error();
      router.push(dest);
      router.refresh();
    } catch {
      setErr(t(C.errMsg));
      setSubmitting(false);
    }
  }

  return (
    <div dir={langDir(lang)} className="mx-auto max-w-2xl px-5 py-10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#14C3D0] text-[#101010]"><ShieldCheck size={22} /></span>
          <h1 className="text-xl font-bold text-[#101010]">{t(C.title)}</h1>
        </div>
        {isPatient && <PatientLangSelect lang={patientLang} onChange={setPatientLang} />}
      </div>

      <p className="mt-5 text-sm leading-relaxed text-slate-600">{t(C.intro)}</p>

      <ul className="mt-4 space-y-2.5">
        {C.items.map((it, i) => (
          <li key={i} className="flex gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5 text-[13px] leading-relaxed text-slate-600">
            <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#14C3D0]/15 text-[11px] font-bold text-[#0E8A95]">{i + 1}</span>
            <span>{t(it)}</span>
          </li>
        ))}
      </ul>

      <label className="mt-5 flex cursor-pointer items-start gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#14C3D0]" />
        <span className="text-[13px] leading-relaxed text-slate-700">
          {t(C.consent)} <span className="text-slate-400">{t(C.draft)}</span>
        </span>
      </label>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}

      <button
        onClick={accept}
        disabled={!agreed || submitting}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#14C3D0] px-5 py-3 text-sm font-semibold text-[#101010] hover:bg-[#0EA5B2] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {t(C.accept)}
      </button>
    </div>
  );
}
