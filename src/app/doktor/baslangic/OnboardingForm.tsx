"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HeartHandshake, Stethoscope, Inbox, Loader2, ArrowRight, Check, BadgeCheck, Lock, ShieldAlert, Award, LayoutGrid, Luggage } from "lucide-react";
import { DoctorDocuments, type DocMeta, type MmssInitial } from "@/components/DoctorDocuments";
import ProcedureSelector, { type Proc } from "@/components/ProcedureSelector";
import { AcademicEducationBox, CertificatesBox } from "@/components/AcademicEditor";
import { Stage1Doctorium, type Stage1Props } from "@/components/Stage1Doctorium";
import { AuraWordmark } from "@/components/AuraLogo";

interface Pub { title: string; venue: string; year: number }

// İki aşamalı giriş — AŞAMA 1 blok prop'ları artık Stage1Doctorium'un kendi modülünden gelir
// (v6.124: kapı e-Devlet doğrulamalı diploma; tip TEK yerde yaşasın diye buradaki kopya silindi;
// yukarıdaki import'la kullanılır). (v6.95: öğrenci yolu AYRI huniye taşındı — /ogrenci +
// StudentStage1Card; bu form yalnız doktor onboarding'idir, öğrenci hesabı buraya hiç düşmez.)

// M5 — İlk-giriş onboarding kapısı (client). v6.87'den beri İKİ AŞAMALI: Aşama 1 = tabip odası
// yazısı → yalnız Doctorium (anında, "finish" beklemez); Aşama 2 = klinik havuz — hesap
// aktifleşmesi için ZORUNLU: (1) FHIR uzmanlık & işlemler — diploma/tescil no + uzmanlık belgesi +
// branş işlemleri (≥1); (2) mesleki belgeler — diploma (MMSS v6.105'ten beri ihtiyari). Sonra
// Ücretsiz Sağlık Hizmeti + Partner Konsültasyon opt-in toplanır. Kaydedince /doktor'a geçer.
export function OnboardingForm({
  doctorName,
  branchKey,
  branchLabel,
  branchItems,
  initialProc,
  extraItems,
  qualification,
  soOpen,
  initialFreeCare,
  initialConsult,
  initialSo,
  initialTourism,
  initialDocs,
  initialMmss,
  stage1,
  theme,
}: {
  doctorName: string;
  branchKey: string;
  branchLabel: string;
  branchItems: Proc[];
  initialProc: Record<string, number>;
  extraItems: Proc[];
  qualification: {
    licenseNo: string | null; eduSchool: string | null; eduYear: number | null;
    specBoard: string | null; specYear: number | null; certifications: string[]; publications: Pub[];
  };
  soOpen: boolean; // ünvan kapısı (Doç./Prof.) — İkinci Görüş kartının seçilebilirliği
  initialFreeCare: boolean;
  initialConsult: boolean;
  initialSo: boolean;
  initialTourism: boolean;
  initialDocs: DocMeta[];
  initialMmss: MmssInitial;
  stage1: Stage1Props;
  // Sayfanın aktif teması (aura_theme cookie) — Aşama 2 bandı bunun TERSİNE boyanır.
  theme: "dark" | "light";
}) {
  const router = useRouter();
  const [freeCare, setFreeCare] = useState(initialFreeCare);
  const [consult, setConsult] = useState(initialConsult);
  // v6.105 — İkinci Görüş + Sağlık Turizmi de tercih oldu (kullanıcı kararı 2026-08-17).
  const [so, setSo] = useState(initialSo);
  const [tourism, setTourism] = useState(initialTourism);
  const [docsReady, setDocsReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState<string[]>([]);

  // v6.124: v6.119'un diplomaState türetimi KALDIRILDI — diploma kartı ve durum anlatımı artık
  // Aşama 1'de (Stage1Doctorium → DoctorDocuments rozet + e-Devlet mesajı + reviewNote).

  async function finish() {
    setSaving(true);
    setErr("");
    setMissing([]);
    try {
      const r = await fetch("/api/doctor/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // soOptIn ünvansız doktorda DAİMA false gönderilir (kart zaten devre dışı) — sunucu da
        // ayrıca soEligible arar, yani bu yalnız temizlik, kapı değil.
        body: JSON.stringify({ freeCareOptIn: freeCare, consultOptIn: consult, soOptIn: so && soOpen, tourismOptIn: tourism }),
      });
      const d = await r.json();
      if (!r.ok) {
        // 409: eksik zorunlu adımlar (işlem · diploma no · uzmanlık belgesi · belgeler) → listele
        if (Array.isArray(d.missing)) setMissing(d.missing as string[]);
        throw new Error(d.error || "Kaydedilemedi.");
      }
      router.push("/doktor");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
      setSaving(false);
    }
  }

  // ── ALMAŞIK RİTİM: AÇIK → KOYU → AÇIK (kullanıcı kararı 2026-08-17, 2. tur) ────────────────
  // "Beyazla başla; Aşama 2 (AURA) siyah olsun." Ritim artık sayfa temasından BAĞIMSIZ sabittir
  // (landing deseni): Aşama 1 açık · Aşama 2 koyu · Aşama 3 açık. Sabitleme, tema sınıfını
  // yalnızca GEREKTİĞİNDE basarak yapılır — sayfa zaten istenen temadaysa sınıf eklenmez, böylece
  // gereksiz kalıtım katmanı oluşmaz. `theme-*` sınıfı seçilmesinin nedeni: --c-* token'ları
  // kalıtsaldır → bant içindeki TÜM bileşenler (panel/hairline/ink/rozet) kendiliğinden uyar,
  // tek tek renk ezmek gerekmez. ⚠️ Bu sayfada tema toggle'ı ritmi DEĞİŞTİRMEZ (bilinçli).
  const LIGHT_BAND = theme === "dark" ? "theme-light" : "";
  const DARK_BAND = theme === "light" ? "theme-dark" : "";

  return (
    <div>
      {/* ══ BANT 1 — AÇIK: karşılama + Aşama 1 (Doctorium) ══ */}
      <div className={`${LIGHT_BAND} bg-[var(--c-bg)]`}>
        <div className="mx-auto max-w-2xl px-5 py-10">
          <div className="text-center">
            <h1 className="aura-display text-3xl font-medium tracking-tight text-[var(--c-ink)]">Hoş geldiniz, {doctorName}</h1>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-[var(--c-ink-2)]">
              <span>Üyeliğiniz iki aşamalıdır:</span>
              <strong>Doctor<span className="doctorium-ium">ium</span></strong>
              <span>üyeliği için e-Devlet barkodlu diplomanız yeterli;</span>
              {/* AURA yazıyla değil LOGOYLA (marka turkuazı) — kullanıcı kararı 2026-08-17.
                  1.35em: 0.78em "çok küçük kaldı" (kullanıcı, 2. tur) — logo çevresindeki
                  metinden belirgin büyük durmalı ki marka olarak okunsun, sözcük gibi değil. */}
              <AuraWordmark height="1.35em" />
              <span>üyeliği için mesleki belgelerinizi tamamlarsınız.</span>
            </p>
            <p className="mt-1.5 text-sm text-[var(--c-ink-2)]">
              Tercihlerinizi dilediğiniz zaman profilinizden değiştirebilirsiniz.
            </p>
          </div>

          {/* ── AŞAMA 1 — Doctorium üyeliği (v6.124): e-Devlet doğrulamalı diploma + kılavuz +
                 isteğe bağlı rızalar. onDiplomaChange → finish kapısı (diploma artık burada
                 yüklendiği için docsReady'nin kaynağı bu blok). ── */}
          <Stage1Doctorium {...stage1} onDiplomaChange={setDocsReady} />
        </div>
      </div>

      {/* ══ BANT 2 — KOYU: Aşama 2 (AURA) ══ */}
      {/* id="asama-2": baslangic sayfasındaki aura-gecis uyarı kutusunun "Aşama 2'ye geç"
          butonunun çapası (scroll-mt: kayınca bant üstü ekran kenarına yapışmasın). */}
      <div id="asama-2" className={`${DARK_BAND} scroll-mt-6 bg-[var(--c-bg)]`}>
        <div className="mx-auto max-w-2xl px-5 py-10">
      {/* ── AŞAMA 2 — AURA üyeliği: mevcut aktivasyon gereksinimleri AYNEN (v6.105 ad değişimi:
          "Klinik Havuz Üyeliği" → "AURA Üyeliği"; kullanıcı kararı 2026-08-17 — iki aşama iki
          MARKAYA karşılık gelir: Aşama 1 = Doctorium, Aşama 2 = AURA. Kapı/koşullar DEĞİŞMEDİ) ── */}
      <div>
        {/* Başlık kalıbı Aşama 1 ile BİREBİR: "Aşama N — <marka> Üyeliği" (marka AURA'da logo,
            Doctorium'da lockup). Sıra bozulursa iki aşama kardeş görünmez. */}
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-[var(--c-ink)]">
          <span>Aşama 2 —</span>
          <AuraWordmark height="1.05em" />
          <span>Üyeliği</span>
        </div>
        <p className="mt-1.5 text-xs text-[var(--c-ink-2)]">
          {/* Beş kulvar — Aşama 3'teki beş panelle BİREBİR aynı sıra: uzaktan sağlık · ikinci
              görüş · sağlık turizmi · ücretsiz sağlık hizmeti · konsültasyon. Panel listesi
              değişirse bu cümle de güncellenmeli (iki yer aynı kulvar kümesini anlatır). */}
          Uzaktan sağlık, ikinci görüş, sağlık turizmi, ücretsiz sağlık hizmeti ve konsültasyon
          taleplerinin bulunduğu doktor havuzlarına katılmak için aşağıdaki belgeleri ve
          tanımları tamamlayın. Bu aşamayı
          dilediğiniz zaman tamamlayabilirsiniz; Doctor<span className="doctorium-ium">ium</span>{" "}
          erişiminiz beklemez.
        </p>
      </div>

      {/* v6.124 — Diploma bekleme/ret kutuları KALDIRILDI: diploma kartı artık Aşama 1'de yaşar
          ve DoctorDocuments oradaki rozet + e-Devlet mesajı + reviewNote ile durumu zaten anlatır.
          (v6.119 kutularının "tabip odası yazısı" yönlendirmesi de bu tasarımla süpersede oldu.) */}

      {/* ── 1. Klinik tanımlar — hesap aktivasyon kapısı. İLK SIRADA (kullanıcı kararı
             2026-08-17: "ilk yapılması gereken o"). v6.124: diploma YÜKLEME kartı Aşama 1'e
             taşındı — burada diploma tekrar İSTENMEZ (kullanıcı kararı 2026-08-19); bu bölüm
             yalnız tescil no + uzmanlık + MMSS(ihtiyari) toplar. ── */}
      <div className="mt-6">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
          <ShieldAlert size={16} className="text-amber-500" /> Mesleki Tanımlar
        </div>
        <p className="mt-1 text-xs text-[var(--c-ink-2)]">
          Diplomanız Aşama 1&apos;de doğrulandı — burada yeniden istenmez.{" "}
          <strong>Akademik &amp; Eğitim</strong> kutusundaki{" "}
          <strong>diploma/tescil numarası</strong> ile <strong>uzmanlık belgesi</strong>{" "}
          alanlarını doldurun — bunlar olmadan hesabınız aktifleşmez ve <strong>FHIR</strong>{" "}
          standardında (Practitioner.identifier / qualification) saklanır. MMSS poliçesi
          ihtiyaridir; yüklerseniz teminat limitiniz hastaya sunulan sigorta paketine yansır.
        </p>

        <div className="mt-4">
          <AcademicEducationBox
            licenseNo={qualification.licenseNo}
            eduSchool={qualification.eduSchool}
            eduYear={qualification.eduYear}
            specBoard={qualification.specBoard}
            specYear={qualification.specYear}
          />
        </div>

        {/* MMSS — ihtiyari; poliçe bilgileri formu bu örnekte render edilir (yalnız MMSS kartında). */}
        <div className="mt-4">
          <DoctorDocuments
            types={["MMSS"]}
            initialDocs={initialDocs.filter((d) => d.type === "MMSS")}
            initialMmss={initialMmss}
          />
        </div>
      </div>

      {/* ── 3. Sertifikalar ve Akademik Çalışmalar — tamamı ihtiyari; dosya kartları + listeler
             tek kutuda (kullanıcı kararı 2026-08-17: eski "Akademik ve Eğitim" başlığı bu ada
             döndü, çünkü akademik künye artık Mesleki Belgeler'in içinde yaşıyor). ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
          <Award size={16} className="text-[var(--c-accent-strong)]" /> Sertifikalar ve Akademik Çalışmalar
        </div>
        <p className="mt-1 text-xs text-[var(--c-ink-2)]">
          Mesleki sertifikalarınızı, üyeliklerinizi ve yayınlarınızı ekleyin. Bu bölümün tamamı{" "}
          <strong>ihtiyaridir</strong> — hesabınızın aktifleşmesini etkilemez. Eklediğiniz kayıtlar
          doktor profilinizde ve dizin sayfalarında görünür; hasta ve kurumlar için uzmanlık
          alanınızın kanıtıdır. Her belgeyi <strong>hem dosya olarak yükleyin hem de alttaki
          listeye yazın</strong>.
        </p>
        <div className="mt-3">
          <CertificatesBox
            certifications={qualification.certifications}
            publications={qualification.publications}
            initialDocs={initialDocs.filter((d) => d.type === "CERTIFICATE" || d.type === "ACADEMIC")}
          />
        </div>
      </div>

      {/* ── 4. Yaptığım İşlemler — branş işlemleri (≥1 zorunlu; ücret tedavi kararında) ── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
          <Stethoscope size={16} className="text-[var(--c-accent-strong)]" /> Yaptığım İşlemler
        </div>
        <p className="mt-1 text-xs text-[var(--c-ink-2)]">
          <strong>{branchLabel}</strong> branşında yaptığınız işlemleri tanımlayın —{" "}
          <strong>en az bir işlem</strong> seçmeden hesabınız aktifleşmez (FHIR ServiceRequest).
          İşlem ücreti burada sorulmaz; hasta görüşmesi sonrasında <strong>tedavi kararı</strong>{" "}
          ekranında taban–tavan aralığında belirlersiniz.
        </p>
        <div className="mt-3">
          <ProcedureSelector
            branchKey={branchKey}
            branchLabel={branchLabel}
            branchItems={branchItems}
            initial={initialProc}
            extraItems={extraItems}
          />
        </div>
      </div>
        </div>
      </div>

      {/* ══ BANT 3 — AÇIK: Aşama 3 (Tercihler / Paneller) ══
          Kullanıcı kararı 2026-08-17: dört çalışma yolu AYRI bir aşamaya çıkarıldı (önce
          Aşama 2'nin kuyruğundaydı). Yeknesak adlandırma ŞART — hepsi "… Paneli" (kullanıcı:
          "ikinci görüş paneli diyorsan ücretsiz sağlık hizmeti paneli, konsültasyon talepleri
          paneli de olmalı"). İki tür kart var ve ayrım bilinçli: DURUM kartları (İkinci Görüş,
          Sağlık Turizmi) sistemin verdiği erişimi BİLDİRİR — tıklanmaz; TERCİH kartları
          (Ücretsiz Sağlık, Konsültasyon) opt-in'dir — açılıp kapanır. */}
      <div className={`${LIGHT_BAND} bg-[var(--c-bg)]`}>
        <div className="mx-auto max-w-2xl px-5 py-10">
          <div>
            <div className="flex items-center gap-2 text-sm font-bold text-[var(--c-ink)]">
              <LayoutGrid size={16} className="text-[var(--c-accent-strong)]" /> Aşama 3 — Tercihler
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 text-xs leading-relaxed text-[var(--c-ink-2)]">
              {/* AURA geçen HER yerde yazı değil logo (kullanıcı kuralı 2026-08-17) */}
              <AuraWordmark height="1.5em" />
              <span>
                üyeliğiniz tamamlandığında <strong>beş ayrı yolla</strong> çalışabilirsiniz ve her
                yolun kendi paneli vardır.
              </span>
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
              <strong>Uzaktan Sağlık Paneli</strong> ana kulvarınızdır; her doktora{" "}
              <strong>otomatik</strong> açılır, diğer dördü <strong>tercihinize</strong>{" "}
              bağlıdır: <strong>İkinci Görüş</strong>,{" "}
              <strong>Sağlık Turizmi</strong>, <strong>Ücretsiz Sağlık Hizmeti</strong> ve{" "}
              <strong>Konsültasyon Talepleri</strong> panellerini aşağıdan açıp kapatabilirsiniz.
              {/* ⚠️ İDDİA DÜRÜSTLÜĞÜ: /doktor/profil YALNIZ freeCare + consult tercihlerini
                  düzenletir (DoctorPreferences + preferences API). soOptIn/tourismOptIn için
                  profil yüzeyi HENÜZ YOK → "hepsini profilden değiştirebilirsiniz" YAZILAMAZ.
                  Yüzey eklenince bu cümle genişletilmeli (vault todo'da kalem var). */}
              Ücretsiz Sağlık Hizmeti ve Konsültasyon tercihlerinizi sonradan{" "}
              <strong>profilinizden</strong> de değiştirebilirsiniz. İkinci Görüş'te ayrıca{" "}
              <strong>Doçent / Profesör</strong> ünvanı aranır — ünvanınız uygun değilse o panel
              seçime kapalıdır. Paneller Aşama 2 tamamlandığında ana sayfanızda görünür.
            </p>
          </div>

          <div className="mt-6 space-y-4">
        {/* 1. Uzaktan Sağlık Paneli — ana kulvar; panelVisibility.duty DAİMA true (kapatılamaz),
               bu yüzden tercih kartı değil DURUM kartıdır. */}
        <StatusCard
          open
          icon={<Stethoscope size={18} />}
          title="Uzaktan Sağlık Paneli"
          openDesc={<>Ana kulvarınız — her doktora <strong>otomatik açık</strong>. Branşınıza düşen hastalarla uzaktan görüşür, tanı ve tedavi kararınızı verirsiniz.</>}
          closedDesc={null}
        />

        {/* 2. İkinci Görüş Paneli — TERCİH + ünvan kapısı (v6.105). Ünvan uygun değilse kart
               "ölü" gösterilir: tıklanamaz, kilit ikonlu (kullanıcı kararı 2026-08-17). Kapı
               yalnız burada değil panelVisibility'de de aranır — arayüz tek savunma değildir. */}
        <OptCard
          active={so && soOpen}
          onToggle={() => setSo((v) => !v)}
          disabled={!soOpen}
          icon={<BadgeCheck size={18} />}
          title="İkinci Görüş Paneli"
          desc={soOpen
            ? "Tanı konmuş hastaların belgelerini inceleyip yazılı görüş ve video görüşme sunun."
            : "Yalnız Doçent / Profesör ünvanlı doktorlara açılır — ünvanınız uygun olmadığı için seçime kapalıdır."}
          benefit="Ünvan şartı sistemce ayrıca doğrulanır; ünvanınız değiştiğinde panel kendiliğinden seçilebilir olur."
        />

        {/* 3. Sağlık Turizmi Paneli — TERCİH (v6.105 öncesi koşulsuz açıktı). ⚠️ Sağlık turizmi
               kulvarı ÖDEMESİZ (escrow/split yok — CLAUDE.md v6.34): ücret/escrow dili KULLANILMAZ. */}
        <OptCard
          active={tourism}
          onToggle={() => setTourism((v) => !v)}
          icon={<Luggage size={18} />}
          title="Sağlık Turizmi Paneli"
          desc="Yurt dışından gelen hastaların branşınıza düşen tedavi taleplerini karşılayın."
          benefit="Tanıtım mesajı ve video randevu teklifi gönderebilir, tedavi planınızı sunabilirsiniz. Her branşa açıktır; ünvan şartı yoktur."
        />

        {/* 4. Ücretsiz Sağlık Hizmeti Paneli — tercih (opt-in) */}
        <OptCard
          active={freeCare}
          onToggle={() => setFreeCare((v) => !v)}
          icon={<HeartHandshake size={18} />}
          title="Ücretsiz Sağlık Hizmeti Paneli"
          desc="Sağlığa erişimi kısıtlı hastalarla gönüllü, ücretsiz video görüşmesinde buluşun."
          benefit="Avantaj: profil itibar rozeti (“Ücretsiz Hizmet Gönüllüsü”), dizinlerde öne çıkma ve etik katkı görünürlüğü. Haftalık kontenjanı kendiniz belirlersiniz."
        />

        {/* 5. Konsültasyon Talepleri Paneli — tercih (opt-in) */}
        <OptCard
          active={consult}
          onToggle={() => setConsult((v) => !v)}
          icon={<Inbox size={18} />}
          title="Konsültasyon Talepleri Paneli"
          desc="Partner (yurtdışı) doktorlardan gelen, anonimleştirilmiş hasta dosyalarına görüş verin."
          benefit="Yanıtladığınız her konsültasyon talebi için ödeme alırsınız (yanıt başına; demo ortamında simüledir). Talepleri kendi branşınızla sınırlı veya genel havuzdan görebilirsiniz."
        />
          </div>

      {err && <p className="mt-4 text-center text-sm text-red-300">{err}</p>}

      {/* Sunucudan dönen eksik zorunlu adımlar (409) */}
      {missing.length > 0 && (
        <div className="mt-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-300 ring-1 ring-red-400/25">
          <div className="flex items-center gap-1.5 font-semibold"><ShieldAlert size={15} /> Eksik zorunlu adımlar</div>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-xs">
            {missing.map((m) => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}

      {!docsReady && (
        <p className="mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2.5 text-center text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
          <ShieldAlert size={14} /> Hesabınızı aktifleştirmek için tıp diplomanızı yükleyin; diploma/tescil no, uzmanlık belgesi ve en az bir işlem seçimini tamamlayın.
        </p>
      )}

      <button
        onClick={finish}
        disabled={saving || !docsReady}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--c-accent)] px-4 py-3 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60"
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
        Ana Sayfama geç
      </button>
      <p className="mt-3 text-center text-xs text-[var(--c-ink-3)]">
        Klinik Nöbet ve Haberler pencereleri her doktorun ana sayfasında bulunur.
      </p>
        </div>
      </div>
    </div>
  );
}

// DURUM kartı — sistemin verdiği panel erişimini BİLDİRİR (tıklanmaz, seçim değil).
// OptCard'ın (tercih kartı) görsel kardeşi: aynı yuvarlaklık/ikon kutusu/tipografi, farkı
// sağdaki onay dairesinin OLMAMASI — kullanıcı "burada bir şey seçiyorum" sanmasın diye.
// `open=false` + `closedDesc=null` = kart hiç çizilmez (koşulsuz açık paneller için gereksiz
// bir "kapalı" hâli uydurmamak adına; ör. Sağlık Turizmi daima açıktır).
function StatusCard({
  open,
  icon,
  title,
  openDesc,
  closedDesc,
}: {
  open: boolean;
  icon: React.ReactNode;
  title: string;
  openDesc: React.ReactNode;
  closedDesc: React.ReactNode;
}) {
  if (!open && !closedDesc) return null;
  return (
    <div className={`rounded-3xl border p-5 ${open ? "border-[var(--c-accent)]/40 bg-[var(--c-accent)]/[0.06]" : "border-[var(--c-hairline)] bg-[var(--c-surface)]"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${open ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/20 text-[var(--c-ink-3)]"}`}>
          {open ? icon : <Lock size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--c-ink)]">
            {title} {open && <BadgeCheck size={15} className="text-[var(--c-accent)]" />}
          </div>
          <p className="mt-1 text-xs text-[var(--c-ink-2)]">{open ? openDesc : closedDesc}</p>
        </div>
      </div>
    </div>
  );
}

// TERCİH kartı — opt-in panel seçimi. `disabled=true` = "ölü kart" (v6.105): şart sağlanmadığı
// için seçilemez (ör. ünvansız doktorda İkinci Görüş). Ölü kart GİZLENMEZ, gösterilir ama
// tıklanamaz + kilit ikonlu — doktor panelin varlığını ve neden kapalı olduğunu görsün
// (kullanıcı kararı: "açılamayacak şekilde sıralanacak", yani listeden çıkmasın).
// ⚠️ `disabled` görsel/etkileşim kapısıdır; gerçek kapı panelVisibility + API'dedir.
function OptCard({
  active,
  onToggle,
  icon,
  title,
  desc,
  benefit,
  disabled = false,
}: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  benefit: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      aria-pressed={disabled ? undefined : active}
      className={`w-full rounded-3xl border p-5 text-left transition ${
        disabled
          ? "cursor-not-allowed border-[var(--c-hairline)] bg-[var(--c-surface)] opacity-60"
          : active
            ? "border-[var(--c-accent)] bg-[var(--c-accent)]/[0.06]"
            : "border-[var(--c-hairline)] bg-[var(--c-panel)] hover:border-[var(--c-accent)]/40"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${active && !disabled ? "bg-[var(--c-accent)] text-[var(--c-bg)]" : "bg-[var(--c-ink)]/10 text-[var(--c-ink-3)]"}`}>
          {disabled ? <Lock size={18} /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--c-ink)]">{title}</span>
            {/* Ölü kartta onay dairesi hiç çizilmez — kapalı bir kutuyu işaretleyebilirmiş izlenimi vermesin */}
            {!disabled && (
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${active ? "border-[var(--c-accent)] bg-[var(--c-accent)] text-[var(--c-bg)]" : "border-[var(--c-hairline)] bg-[var(--c-panel)] text-transparent"}`}>
                <Check size={14} />
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[var(--c-ink-2)]">{desc}</p>
          <p className="mt-2 rounded-xl bg-[var(--c-surface)] px-3 py-2 text-[11px] leading-relaxed text-[var(--c-ink-2)]">{benefit}</p>
        </div>
      </div>
    </button>
  );
}
