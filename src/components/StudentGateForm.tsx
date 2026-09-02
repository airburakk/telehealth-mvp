"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GraduationCap, MailCheck, UserPlus, Loader2 } from "lucide-react";
import { AuraMark } from "@/components/AuraLogo";
import { CitySelect } from "@/components/CitySelect";
import { universitiesFor, domainMatches, type StudentDepartment } from "@/lib/universities";

// v6.95 — Tıp/Diş Hekimliği öğrencisi kaydı (/ogrenci): doktor kaydından AYRI huni (kullanıcı
// kararı 2026-08-14). Kayıt /api/auth/signup-student'a gider (ünvan/telefon/dil yok). OAuth butonu
// BİLİNÇLİ YOK: sosyal kayıt intent=doctor açar (studentTrack'siz) — öğrenci hunisi e-posta kaydı.
// 2026-08-17 (kullanıcı kararı): sayfa SALT KAYIT oldu — Giriş/Hesap oluştur sekmeleri ve
// gömülü giriş formu kaldırıldı. Öğrenci hesabı DOCTOR rollüdür, girişi ortak /kurumsal-giris
// kapısından yapar (aşağıdaki metin linki); ayrı bir öğrenci giriş yüzeyi ARTIK YOK.
//
// v6.147 (kullanıcı kararı 2026-08-23) — GÜVENLİK KONTROLÜ DEĞİŞTİ: eskiden kayıt sonrası bir
// belge yüklenirdi (STUDENT_CERT — hiç gerçek doğrulama yapmıyordu). Artık Bölüm+Üniversite
// BURADA seçilir, girilen e-posta lib/universities.ts UNIVERSITIES'teki bilinen uzantıyla
// eşleşmezse sunucu kaydı reddeder — eşleşmeyen üniversite/e-posta kombinasyonuyla hesap hiç
// AÇILMAZ. lib/universities.ts client-safe (db bağımlılığı yok) — doğrudan import edilir.

// brand="doctorium" (ayrışma 2026-08-24, Faz B): /doctorium/ogrenci sarmalayıcısı aynı formu
// Doctorium markasıyla kullanır — zümrüt küre, giriş/doktor-kaydı linkleri Doctorium rotalarına.
// Vurgu renkleri sarmalayıcı sayfanın --c-accent* ezmesinden gelir; API/akış birebir aynı.
export function StudentGateForm({ branches, brand }: { branches: string[]; brand?: "doctorium" }) {
  const doctorium = brand === "doctorium";
  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[var(--c-panel)] ring-1 ring-[var(--c-hairline)]"><AuraMark size={26} tone={doctorium ? "emerald" : undefined} /></span>
        <h1 className="mt-3 flex items-center gap-1.5 font-serif text-xl font-bold tracking-tight text-[var(--c-ink)]">
          <GraduationCap size={20} className="text-[var(--c-accent)]" /> Tıp Öğrencisi Kaydı
        </h1>
        <p className="text-sm text-[var(--c-ink-2)]">Doctorium&apos;un bilgi akışına öğrenciyken katılın</p>
      </div>

      <div className="rounded-[22px] border border-[var(--c-hairline)] bg-[var(--c-panel)] p-6">
        <StudentSignup branches={branches} />
      </div>

      <p className="mt-4 text-center text-sm text-[var(--c-ink-2)]">
        Zaten hesabınız var mı? <Link href={doctorium ? "/doctorium/giris" : "/kurumsal-giris"} className="font-semibold text-[var(--c-accent)] hover:underline">Giriş yapın</Link>
      </p>
      <p className="mt-1.5 text-center text-sm text-[var(--c-ink-2)]">
        Doktor musunuz? <Link href={doctorium ? "/doctorium/kayit" : "/kayit"} className="font-semibold text-[var(--c-accent)] hover:underline">Doktor kaydına gidin</Link>
      </p>
    </div>
  );
}

function StudentSignup({ branches }: { branches: string[] }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState<StudentDepartment | "">("");
  const [university, setUniversity] = useState("");
  const [branch, setBranch] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifySent, setVerifySent] = useState(false);

  // Üniversite seçenekleri bölüme göre süzülür — dişçilik seçiliyse yalnız Diş Hekimliği olan
  // üniversiteler görünür (yanlış bölüm+üniversite kombinasyonu formda hiç kurulamaz).
  const universities = useMemo(() => (department ? universitiesFor(department) : []), [department]);
  // İstemci ön-doğrulaması (v6.203, QA ISSUE-005): sunucu kuralının (signup-student → domainMatches)
  // AYNI fonksiyonu; kullanıcı alan adını yazar yazmaz uyarı görür, gereksiz round-trip yok. Sunucu
  // kontrolü KALIR (savunma derinliği) — burası yalnız anlık geri bildirim. Uyarı, "@" sonrası bir
  // nokta yazıldığında başlar (yarım adreste titremesin).
  const selectedUni = useMemo(() => universities.find((u) => u.name === university) ?? null, [universities, university]);
  const typedDomain = email.includes("@") && email.slice(email.lastIndexOf("@") + 1).includes(".");
  const emailDomainMismatch = Boolean(selectedUni && typedDomain && !domainMatches(email, university));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== password2) { setError("Parolalar eşleşmiyor."); return; }
    if (selectedUni && !domainMatches(email, university)) {
      setError(`Girdiğiniz e-posta "${university}" için beklenen öğrenci uzantısıyla eşleşmiyor (beklenen: ${selectedUni.domains.map((d) => `@${d}`).join(", ")}).`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, department, university, branch, city, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Kayıt başarısız.");
      if (data.needsStudentVerification) { setVerifySent(true); return; }
      window.location.assign(data.home || "/doktor/baslangic");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız.");
      setLoading(false);
    }
  }

  if (verifySent) {
    return (
      <div className="py-2 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-300"><MailCheck size={28} /></span>
        <h2 className="mt-4 font-serif text-lg font-bold text-[var(--c-ink)]">Doğrulama bağlantısı gönderildi</h2>
        <p className="mt-2 text-sm text-[var(--c-ink-2)]">
          <span className="font-medium text-[var(--c-ink)]">{email}</span> adresine bir doğrulama
          bağlantısı gönderdik. Tıkladığınız anda Doctorium erişiminiz açılır; bu sayfadan giriş
          yapabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Labeled label="Ad soyad">
        {/* autoComplete (v6.203, QA ISSUE-004): giriş formuyla tutarlı. */}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ayşe Yılmaz" className={INPUT} required autoComplete="name" />
      </Labeled>

      <Labeled label="Bölüm">
        <div className="grid grid-cols-2 gap-2">
          {(
            [["tip", "Tıp"], ["dis-hekimligi", "Diş Hekimliği"]] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={department === key}
              onClick={() => { setDepartment(key); setUniversity(""); }}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                department === key
                  ? "border-[var(--c-accent)] bg-[var(--c-accent)]/10 text-[var(--c-accent-stronger)]"
                  : "border-[var(--c-hairline)] bg-[var(--c-surface)] text-[var(--c-ink-2)] hover:border-[var(--c-accent)]/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Labeled>

      <Labeled label="Üniversite">
        <select value={university} onChange={(e) => setUniversity(e.target.value)} className={INPUT} required disabled={!department}>
          <option value="" disabled>{department ? "Seçin…" : "Önce bölümünüzü seçin"}</option>
          {universities.map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
        </select>
      </Labeled>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="İlgilendiğiniz branş">
          <select value={branch} onChange={(e) => setBranch(e.target.value)} className={INPUT} required>
            <option value="" disabled>Seçin…</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </Labeled>
        <Labeled label="Üniversite şehri">
          <CitySelect value={city} onChange={setCity} className={INPUT} />
        </Labeled>
      </div>

      <Labeled label="Üniversite e-postanız">
        <input
          type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@universite.edu.tr"
          className={INPUT} required autoComplete="email" aria-invalid={emailDomainMismatch || undefined}
        />
        {emailDomainMismatch && selectedUni ? (
          <span className="mt-1 block text-[11px] text-red-300" role="alert">
            Bu adres &ldquo;{selectedUni.name}&rdquo; için beklenen öğrenci uzantısıyla eşleşmiyor — beklenen:{" "}
            <strong>{selectedUni.domains.map((d) => `@${d}`).join(" · ")}</strong>. Alt alan adları da kabul edilir.
          </span>
        ) : (
          <span className="mt-1 block text-[11px] text-[var(--c-ink-3)]">
            Seçtiğiniz üniversitenin size verdiği kurumsal (...edu.tr) e-postayla kaydolun — kayıt
            bunu kontrol eder, doğrulama bağlantısı da buraya gider.
          </span>
        )}
      </Labeled>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Parola">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="en az 8 karakter" className={INPUT} required minLength={8} autoComplete="new-password" />
        </Labeled>
        <Labeled label="Parola (tekrar)">
          <input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" className={INPUT} required minLength={8} autoComplete="new-password" />
        </Labeled>
      </div>

      {error && <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300 ring-1 ring-red-400/25">{error}</div>}

      <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--c-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--c-bg)] hover:bg-[var(--c-accent-strong)] disabled:opacity-60">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Hesap oluştur
      </button>

      <p className="text-[11px] leading-relaxed text-[var(--c-ink-3)]">
        Kayıt, üniversite e-postanızın seçtiğiniz kuruma ait olduğunu kontrol eder; Doctorium
        erişiminiz e-postanızdaki bağlantıyı tıkladığınız anda açılır. Diploma, MMSS poliçesi gibi
        doktor belgeleri öğrenci üyelikte İSTENMEZ.
      </p>
    </form>
  );
}

const INPUT = "w-full rounded-lg border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3 py-2 text-sm text-[var(--c-ink)] outline-none placeholder:text-[var(--c-ink-3)] focus:border-[var(--c-accent)]";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-[var(--c-ink-2)]">{label}</span>
      {children}
    </label>
  );
}
