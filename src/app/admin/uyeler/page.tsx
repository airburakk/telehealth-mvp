import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/PageHeader";
import { DoctoriumInline, DOCTORIUM_PALETTE } from "@/components/aura/doctorium-brand";
import { ArrowLeft, Info, Inbox, GraduationCap, Stethoscope } from "lucide-react";

export const dynamic = "force-dynamic";
// Sekme başlığı app/admin/layout.tsx şablonundan gelir ("%s · Doctorium") — AURA adı geçmez.
// Footer da orada çizilir; buraya DoctoriumFooter EKLEME, çift footer olur.
export const metadata = { title: "Üye Analitiği" };

// Üye analitiği (2026-08-29, kullanıcı isteği) — "kaç üye var, ne zaman geldi, kim, nereden".
// /admin/landing-analitik deseni: sunucu bileşeni doğrudan agregat sorgular, client JS yok.
//
// ⚠️ ÜÇ TASARIM NOTU (değiştirmeden önce oku — üçü de sayıların DOĞRULUĞUNU belirler):
//
// 1. Doctor ile User arasında Prisma RELATION YOK (User.doctorId düz bir String alan) → include ile
//    join edilemez; iki sorgu + Map ile birleştirilir. Buradaki "üye" tanımı = User satırı OLAN
//    profil. Seed/havuzdan gelen kullanıcısız Doctor profilleri üye DEĞİLDİR ve bu panoya girmez;
//    doğrudan db.doctor.count() yazmak sayıyı sessizce şişirir.
//
// 2. Tıp öğrencisi de Doctor tablosunda yaşar (rolü de DOCTOR'dır) → ayırmazsan doktor sayısına
//    karışır. Ayrım studentTrack (kayıt yolu) iledir; studentVerifiedAt yalnız üniversite
//    e-postası damgasıdır — henüz doğrulamamış öğrenci de öğrencidir. lib/doctor-activation
//    içindeki isStudentOnly() bir ERİŞİM süzgecidir (pazarlama yüzeyi), nüfus sayımı değil.
//
// 3. Öğrencinin branch alanı UZMANLIK DEĞİL, "ilgilendiği branş"tır; city alanı da çalıştığı yer
//    değil ÜNİVERSİTESİNİN şehridir (bkz. api/auth/signup-student). Doktorunkiyle aynı tabloya
//    koymak veriyi yalan söyletir → bu panoda ikisi ayrı bölümde, ayrı başlıkla durur.
//
// Ölçek notu: profiller belleğe çekilip JS'de sayılıyor (bugün birkaç yüz satır). Üye sayısı on
// binlere çıkarsa şehir/branş dağılımları ham SQL GROUP BY'a taşınmalı.

const HOUR = 3600_000;

const ROLE_LABEL: Record<string, string> = {
  PATIENT: "Hasta",
  DOCTOR: "Doktor / Öğrenci",
  COORDINATOR: "Koordinatör",
  ETHICS: "Etik Kurul",
  ADMIN: "Yönetici",
  PARTNER: "Partner Doktor",
  AGENCY: "Acente",
  HEALTH_PRO: "Sağlık Uzmanı",
};

const DEPT_LABEL: Record<string, string> = { MED: "Tıp", DENT: "Diş Hekimliği" };

// Şehir/branş serbest metin olarak giriliyor (kayıt formlarında kapalı seçim listesi yok) → aynı
// şehir "İstanbul", "Istanbul", "izmir" gibi ayrı satırlara düşer ve dağılımı YANILTIR. Sayarken
// büyük-küçük ve aksan farkını katlıyor, ekranda grubun EN SIK kullanılan yazımını gösteriyoruz
// (kanonik bir ad UYDURMADAN — veriyi düzeltmek kayıt formunun işi, panonun değil).
// ⚠️ toLocaleLowerCase("tr") burada KULLANILAMAZ: ASCII "I" harfini noktasız "ı"ya çevirir, yani
// "Istanbul" ile "İstanbul" yine ayrı gruplara düşerdi. Harf-harf katlama tablosu bu yüzden var.
const FOLD: Record<string, string> = {
  "İ": "i", I: "i", "ı": "i", "Ş": "s", "ş": "s", "Ğ": "g", "ğ": "g",
  "Ü": "u", "ü": "u", "Ö": "o", "ö": "o", "Ç": "c", "ç": "c",
};
const foldKey = (s: string) =>
  s.split("").map((ch) => FOLD[ch] ?? ch).join("").toLowerCase().replace(/\s+/g, " ").trim();

// Zaman pencereleri bileşen gövdesinde DEĞİL burada hesaplanır: React Compiler'ın purity kuralı
// render sırasında Date.now() çağrısını reddeder (kural client re-render'ını korur — orada saat
// her render'da kayar). Bu async Server Component'te çağrı istek başına bir kez koşar ve sayfa
// force-dynamic olduğu için önbelleğe de girmez, yani davranış zaten doğruydu; hesabı dışarı
// almak hem kuralı sağlar hem zaman mantığını tek yerde toplar.
function timeWindows() {
  const now = Date.now();
  return {
    w24: new Date(now - 24 * HOUR),
    w7: new Date(now - 7 * 24 * HOUR),
    w30: new Date(now - 30 * 24 * HOUR),
  };
}

export default async function MemberAnalyticsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor/doctorium");

  const { w24, w7, w30 } = timeWindows();

  // deletedAt: null her sorguda — silinmiş hesap (KVKK kabuğu) üye sayılmaz.
  const [roleGroups, doctorUsers, patientCountries, win24, win7, win30] = await Promise.all([
    db.user.groupBy({ by: ["role"], where: { deletedAt: null }, _count: { _all: true } }),
    db.user.findMany({
      where: { role: "DOCTOR", deletedAt: null, doctorId: { not: null } },
      select: { doctorId: true, createdAt: true },
    }),
    db.user.groupBy({
      by: ["patientCountry"],
      where: { role: "PATIENT", deletedAt: null },
      _count: { _all: true },
    }),
    db.user.groupBy({ by: ["role"], where: { deletedAt: null, createdAt: { gte: w24 } }, _count: { _all: true } }),
    db.user.groupBy({ by: ["role"], where: { deletedAt: null, createdAt: { gte: w7 } }, _count: { _all: true } }),
    db.user.groupBy({ by: ["role"], where: { deletedAt: null, createdAt: { gte: w30 } }, _count: { _all: true } }),
  ]);

  const doctorIds = doctorUsers.map((u) => u.doctorId).filter((id): id is string => !!id);
  const profiles = doctorIds.length
    ? await db.doctor.findMany({
        where: { id: { in: doctorIds } },
        select: {
          id: true, city: true, branch: true, title: true, verified: true,
          diplomaVerifiedAt: true, activatedAt: true,
          studentTrack: true, studentVerifiedAt: true,
          studentUniversity: true, studentDepartment: true,
        },
      })
    : [];

  // Manuel join (tasarım notu 1): profili bulunamayan User satırı sayıma girmez — öyle bir satır
  // varsa veri tutarsızlığıdır ve aşağıda ayrıca uyarı olarak gösterilir, sessizce yutulmaz.
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const members = doctorUsers.flatMap((u) => {
    const p = u.doctorId ? byId.get(u.doctorId) : undefined;
    return p ? [{ createdAt: u.createdAt, p }] : [];
  });
  const orphanCount = doctorUsers.length - members.length;

  const students = members.filter((m) => m.p.studentTrack);
  const doctors = members.filter((m) => !m.p.studentTrack);

  const since = (list: typeof members, from: Date) => list.filter((m) => m.createdAt >= from).length;
  const roleCount = (groups: typeof roleGroups, role: string) =>
    groups.find((g) => g.role === role)?._count._all ?? 0;
  const totalOf = (groups: typeof roleGroups) => groups.reduce((s, g) => s + g._count._all, 0);

  const totalMembers = totalOf(roleGroups);
  const patients = roleCount(roleGroups, "PATIENT");

  const windows = [
    { label: "Son 24 saat", from: w24, groups: win24 },
    { label: "Son 7 gün", from: w7, groups: win7 },
    { label: "Son 30 gün", from: w30, groups: win30 },
  ].map((w) => {
    const d = since(doctors, w.from);
    const s = since(students, w.from);
    return {
      label: w.label,
      doctorium: d + s, // panonun ana ekseni: Doctorium üye tabanı
      doctors: d,
      students: s,
      all: totalOf(w.groups), // tüm roller — yalnız "AURA tarafı" bölümünde kullanılır
      patients: roleCount(w.groups, "PATIENT"),
    };
  });
  const doctoriumTotal = doctors.length + students.length;

  // Doktor doğrulama ölçüleri — "kaç doktor üye" sorusunun dürüst cevabı tek sayı değildir:
  // kayıt olmak ≠ diploması doğrulanmış ≠ klinik olarak aktif ≠ admin onaylı.
  // ⚠️ Bunlar İÇ İÇE AŞAMA DEĞİL, BAĞIMSIZ EKSENLERDİR: verified'ı admin elle işaretler ve
  // diplomaVerifiedAt'ten ayrı işler → alttaki sayı üsttekinden BÜYÜK olabilir (dev verisinde
  // öyle: 1 diploma damgası, 2 admin onayı). Bunu "huni" diye sunmak veriyi yalan söyletirdi.
  const verification = [
    { label: "Kayıtlı doktor hesabı", value: doctors.length, note: "hesap açıldı" },
    { label: "Diploması doğrulanmış", value: doctors.filter((m) => m.p.diplomaVerifiedAt).length, note: "Aşama 1 — Doctorium erişimi" },
    { label: "Klinik olarak aktif", value: doctors.filter((m) => m.p.activatedAt).length, note: "Aşama 2 — zorunlu belgeler tamam" },
    { label: "Admin onaylı", value: doctors.filter((m) => m.p.verified).length, note: "hasta havuzuna çıkabilir" },
  ];

  // Katlanmış anahtara göre grupla, ekranda grubun EN SIK yazımını göster (bkz. foldKey notu):
  // "İstanbul" + "Istanbul" tek satırda toplanır, etiket olarak çoğunluğun yazımı kullanılır.
  const tally = (list: typeof members, pick: (m: (typeof members)[number]) => string | null) => {
    const groups = new Map<string, Map<string, number>>();
    for (const m of list) {
      const raw = (pick(m) ?? "").trim();
      const display = raw.length > 0 ? raw : "— belirtilmemiş";
      const key = raw.length > 0 ? foldKey(raw) : " bos";
      const labels = groups.get(key) ?? new Map<string, number>();
      labels.set(display, (labels.get(display) ?? 0) + 1);
      groups.set(key, labels);
    }
    return [...groups.values()]
      .map((labels) => {
        const total = [...labels.values()].reduce((s, n) => s + n, 0);
        const label = [...labels.entries()].sort(
          (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"),
        )[0][0];
        return [label, total] as [string, number];
      })
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
  };

  const doctorCities = tally(doctors, (m) => m.p.city);
  const studentCities = tally(students, (m) => m.p.city);
  const doctorBranches = tally(doctors, (m) => m.p.branch);
  const studentBranches = tally(students, (m) => m.p.branch);
  const studentUnis = tally(students, (m) => m.p.studentUniversity);
  const studentDepts = tally(students, (m) =>
    m.p.studentDepartment ? DEPT_LABEL[m.p.studentDepartment] ?? m.p.studentDepartment : null,
  );
  const doctorTitles = tally(doctors, (m) => m.p.title);
  const countries = patientCountries
    .map((c) => [(c.patientCountry ?? "").trim() || "— belirtilmemiş", c._count._all] as [string, number])
    .sort((a, b) => b[1] - a[1]);

  const studentVerified = students.filter((m) => m.p.studentVerifiedAt).length;
  const studentGraduated = students.filter((m) => m.p.activatedAt).length;
  const otherRoles = roleGroups
    .filter((g) => g.role !== "PATIENT" && g.role !== "DOCTOR")
    .sort((a, b) => b._count._all - a._count._all);

  return (
    <>
      {/* DOCTORIUM_PALETTE kökte: marka lockup'ının (--dl-ink / --dl-emerald) bu sayfada da
          doğru renklenmesi için — palet landing dışında tanımlı değildir, DoctoriumFooter de
          aynı sebeple kendi köküne uygular. Sayfanın --c-* tema renklerine dokunmaz. */}
      <div style={DOCTORIUM_PALETTE} className="mx-auto max-w-4xl px-5 py-10">
        <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]">
          <ArrowLeft size={15} /> Yönetim
        </Link>

        <PageHeader
          className="mt-3"
          title="Üye Analitiği"
          sub={
            <>
              <DoctoriumInline /> üye tabanı: kim üye oldu, ne zaman geldi, hangi şehirden ve hangi
              branştan. Sayılar canlı veritabanından, her sayfa açılışında yeniden hesaplanır.
            </>
          }
        />

        <p className="mt-5 flex items-start gap-2 rounded-xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-3.5 py-2.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
          <Info size={14} className="mt-0.5 shrink-0" />
          <span>
            Şehir ve branş bilgisi <strong>üyenin kayıt sırasında kendi beyan ettiği</strong> veridir — IP,
            çerez ya da konum takibi kullanılmaz. Silinmiş hesaplar hiçbir sayıya girmez. Anonim ziyaretçi
            sayaçları ayrı yerdedir:{" "}
            <Link href="/admin/landing-analitik" className="underline">Landing Analitiği</Link>.
          </span>
        </p>

      {totalMembers === 0 ? (
        <div className="mt-8 rounded-3xl border border-dashed border-[var(--c-hairline)] bg-[var(--c-panel)] py-12 text-center text-[var(--c-ink-3)]">
          <Inbox className="mx-auto mb-2" /> Henüz üye yok.
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MiniStat label="Doctorium üyesi" value={doctoriumTotal} />
            <MiniStat label="Doktor" value={doctors.length} icon={<Stethoscope size={14} />} />
            <MiniStat label="Tıp / Diş öğrencisi" value={students.length} icon={<GraduationCap size={14} />} />
            <MiniStat label="Son 30 günde yeni" value={windows[2].doctorium} />
          </div>

          {orphanCount > 0 && (
            <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed text-[var(--c-ink-2)]">
              ⚠️ {orphanCount} doktor hesabının profil kaydı bulunamadı (User.doctorId bir Doctor satırına
              işaret etmiyor) — bu hesaplar aşağıdaki dağılımlara girmedi. Veri tutarsızlığı, incelenmeli.
            </p>
          )}

          <Section title="Yeni üyeler — zaman penceresi">
            <div className="overflow-x-auto rounded-2xl border border-[var(--c-hairline)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--c-surface)] text-[11px] uppercase tracking-wide text-[var(--c-ink-3)]">
                  <tr>
                    <th className="px-3.5 py-2 text-left font-medium">Dönem</th>
                    <th className="px-3.5 py-2 text-right font-medium">Doctorium</th>
                    <th className="px-3.5 py-2 text-right font-medium">Doktor</th>
                    <th className="px-3.5 py-2 text-right font-medium">Öğrenci</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--c-hairline)]">
                  {windows.map((w) => (
                    <tr key={w.label}>
                      <td className="px-3.5 py-2 text-[var(--c-ink)]">{w.label}</td>
                      <td className="px-3.5 py-2 text-right font-semibold text-[var(--c-ink)]">{w.doctorium.toLocaleString("tr-TR")}</td>
                      <td className="px-3.5 py-2 text-right text-[var(--c-ink-2)]">{w.doctors.toLocaleString("tr-TR")}</td>
                      <td className="px-3.5 py-2 text-right text-[var(--c-ink-2)]">{w.students.toLocaleString("tr-TR")}</td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--c-surface)]">
                    <td className="px-3.5 py-2 font-medium text-[var(--c-ink)]">Tüm zamanlar</td>
                    <td className="px-3.5 py-2 text-right font-semibold text-[var(--c-ink)]">{doctoriumTotal.toLocaleString("tr-TR")}</td>
                    <td className="px-3.5 py-2 text-right text-[var(--c-ink-2)]">{doctors.length.toLocaleString("tr-TR")}</td>
                    <td className="px-3.5 py-2 text-right text-[var(--c-ink-2)]">{students.length.toLocaleString("tr-TR")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section
            title="Doktorların doğrulama durumu"
            hint="Kayıt olmak, doğrulanmış olmak demek değildir. Bu dört ölçü bağımsız eksenlerdir — iç içe geçmiş aşamalar değil: admin onayı, diploma doğrulamasından ayrı işler, bu yüzden alttaki sayı üsttekinden büyük olabilir. Yüzdeler kayıtlı doktor hesabı toplamına göredir."
          >
            <div className="space-y-2">
              {verification.map((f) => (
                <BarRow key={f.label} label={f.label} value={f.value} max={doctors.length} note={f.note} />
              ))}
            </div>
          </Section>

          {doctors.length > 0 && (
            <>
              <Section title="Doktorlar — şehir" hint="Doktorun kayıtta beyan ettiği çalışma şehri.">
                <TwoCol rows={doctorCities} total={doctors.length} />
              </Section>

              <Section title="Doktorlar — uzmanlık branşı">
                <TwoCol rows={doctorBranches} total={doctors.length} />
              </Section>

              <Section title="Doktorlar — ünvan">
                <TwoCol rows={doctorTitles} total={doctors.length} />
              </Section>
            </>
          )}

          {students.length > 0 && (
            <>
              <Section
                title="Öğrenciler — durum"
                hint="Öğrenci sayısı kayıt yoluna göre belirlenir; üniversite e-postası doğrulaması ayrı bir aşamadır."
              >
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Toplam öğrenci" value={students.length} />
                  <MiniStat label="E-postası doğrulanmış" value={studentVerified} />
                  <MiniStat label="Klinik olarak aktifleşmiş" value={studentGraduated} />
                </div>
              </Section>

              <Section
                title="Öğrenciler — üniversite şehri"
                hint="Öğrencinin beyanı üniversitesinin bulunduğu şehirdir, ikamet ettiği yer değil."
              >
                <TwoCol rows={studentCities} total={students.length} />
              </Section>

              <Section title="Öğrenciler — üniversite">
                <TwoCol rows={studentUnis} total={students.length} />
              </Section>

              <Section title="Öğrenciler — bölüm">
                <TwoCol rows={studentDepts} total={students.length} />
              </Section>

              <Section
                title="Öğrenciler — ilgilendiği branş"
                hint="Bu bir uzmanlık değil, öğrencinin kayıtta seçtiği ilgi alanıdır."
              >
                <TwoCol rows={studentBranches} total={students.length} />
              </Section>
            </>
          )}

          {/* AURA tarafı — bilinçli olarak EN ALTTA, ayrı çerçevede ve "referans" etiketiyle.
              Veritabanı iki marka arasında ORTAKTIR (2026-08-24 ayrışma kararı), ama bu pano
              Doctorium üye tabanını raporlar; hasta/acente/etik satırlarını yukarıdaki akışa
              karıştırmak "kaç üyemiz var" sorusunu yanıltırdı. */}
          {(patients > 0 || otherRoles.length > 0) && (
            <section className="mt-12 rounded-3xl border border-dashed border-[var(--c-hairline)] p-5">
              <h2 className="aura-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-ink-3)]">
                AURA tarafı — referans
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-3)]">
                Veritabanı iki marka arasında ortaktır. Bu sayılar <strong>Doctorium üye tabanına dâhil
                değildir</strong>; aynı kurulumda duran AURA hesaplarını gösterir — kurulumdaki toplam
                hesap {totalMembers.toLocaleString("tr-TR")}.
              </p>

              {patients > 0 && (
                <>
                  <h3 className="aura-mono mt-5 text-[11px] uppercase tracking-[0.18em] text-[var(--c-ink-3)]">
                    Hastalar — ülke ({patients.toLocaleString("tr-TR")})
                  </h3>
                  <p className="mt-1 text-xs text-[var(--c-ink-3)]">Hasta tarafında şehir sorulmaz; yalnız ülke beyanı tutulur.</p>
                  <div className="mt-3">
                    <TwoCol rows={countries} total={patients} />
                  </div>
                </>
              )}

              {otherRoles.length > 0 && (
                <>
                  <h3 className="aura-mono mt-5 text-[11px] uppercase tracking-[0.18em] text-[var(--c-ink-3)]">
                    Diğer roller
                  </h3>
                  <div className="mt-3">
                    <TwoCol
                      rows={otherRoles.map((g) => [ROLE_LABEL[g.role] ?? g.role, g._count._all] as [string, number])}
                      total={totalMembers}
                    />
                  </div>
                </>
              )}
            </section>
          )}
        </>
      )}
      </div>
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="aura-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--c-ink-3)]">{title}</h2>
      {hint && <p className="mt-1 text-xs leading-relaxed text-[var(--c-ink-3)]">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-panel)] p-3.5">
      <div className="text-2xl font-bold text-[var(--c-ink)]">{value.toLocaleString("tr-TR")}</div>
      <div className="flex items-center gap-1.5 text-xs text-[var(--c-ink-2)]">
        {icon}
        {label}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, note }: { label: string; value: number; max: number; note?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="truncate text-[var(--c-ink)]">{label}</span>
        <span className="shrink-0 font-semibold text-[var(--c-ink)]">
          {value.toLocaleString("tr-TR")}
          {max > 0 && <span className="ml-1.5 text-xs font-normal text-[var(--c-ink-3)]">%{pct}</span>}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--c-surface)]">
        <div className="h-full rounded-full bg-[var(--c-accent)]" style={{ width: `${pct}%` }} />
      </div>
      {note && <div className="mt-1 text-[11px] text-[var(--c-ink-3)]">{note}</div>}
    </div>
  );
}

function TwoCol({ rows, total }: { rows: [string, number][]; total: number }) {
  const max = rows[0]?.[1] ?? 0;
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {rows.map(([label, value]) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        const bar = max > 0 ? Math.round((value / max) * 100) : 0;
        return (
          <div key={label} className="rounded-xl border border-[var(--c-hairline)] bg-[var(--c-panel)] px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 truncate text-[var(--c-ink)]" title={label}>{label}</span>
              <span className="shrink-0 font-semibold text-[var(--c-ink)]">
                {value.toLocaleString("tr-TR")}
                <span className="ml-1.5 text-xs font-normal text-[var(--c-ink-3)]">%{pct}</span>
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--c-surface)]">
              <div className="h-full rounded-full bg-[var(--c-accent)]" style={{ width: `${bar}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
