import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Info } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isStudentOnly } from "@/lib/doctor-activation";
import { countClinicalTies, hasClinicalTies } from "@/lib/doctorium-membership";
import { recentLogins, describeUserAgent } from "@/lib/login-activity";
import { AuraPanel } from "@/components/ui/AuraPanel";
import { SectionLabel } from "@/components/ui/InfoField";
import { DoctoriumShell } from "../DoctoriumSidebar";
import { PasswordPanel } from "./PasswordPanel";
import { MembershipPanel } from "./MembershipPanel";
import { LogoutAllButton } from "./LogoutAllButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hesabım" };

/**
 * HESABIM — Doctorium üyelik ve güvenlik sayfası (v6.184, kullanıcı kararı 2026-08-29).
 *
 * ⚖️ KAPSAM: Doctorium'da klinik katman YOKTUR (hasta/vaka/görüş yok). Bu sayfa yalnız ÜYELİK
 * verisini yönetir. AURA'daki /hesap sayfası HASTAYA özeldir (KVKK silme akışı) ve Doctorium
 * deploy'unda AURA'ya 307'lenir — doktorun hiçbir hesap yüzeyi yoktu, bu sayfa o boşluğu kapatır.
 *
 * Rafta durak YOK: kişisel eşya Header hesap menüsünde yaşıyor (Takvimim/Kaydettiklerim/Puanlarım
 * deseni) — Shell active={null} ile çizilir.
 *
 * 🔴 "Giriş etkinliği" AÇIK OTURUM LİSTESİ DEĞİLDİR ve olamaz: oturum bu sistemde JWT claim'idir,
 * DB'de Session tablosu yok (lib/login-activity başlığındaki gerekçe). Panel bunu kullanıcıya
 * açıkça söyler — elimizde olmayan veriyi varmış gibi göstermeyiz.
 */
export default async function DoctoriumAccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const me = await db.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, passwordSetAt: true, appleSub: true, doctorId: true },
  });
  // Personel (COORDINATOR/ADMIN) gözetim için portala girebilir ama Doctorium ÜYELİĞİ yoktur →
  // yönetilecek bir hesap yüzeyi de yok (koşullu-href ilkesinin sayfa düzeyindeki karşılığı).
  if (!me?.doctorId) redirect("/doktor/doctorium");

  const doctor = await db.doctor.findUnique({
    where: { id: me.doctorId },
    select: {
      title: true, branch: true, city: true, languages: true,
      diplomaVerifiedAt: true, studentVerifiedAt: true, activatedAt: true,
      studentTrack: true, studentUniversity: true, studentDepartment: true,
    },
  });
  if (!doctor) redirect("/doktor/doctorium");

  const student = isStudentOnly(doctor);
  // Kapatma varyantı: klinik bağ varsa hesap Doctorium'un tek başına kapatabileceği bir hesap
  // değildir → yalnız üyelikten çıkış sunulur. Sunucu tarafında ÖLÇÜLÜR, varsayılmaz.
  const ties = await countClinicalTies(me.doctorId);
  const mode = hasClinicalTies(ties) ? "leave" : "close";

  const logins = await recentLogins(user.id, 10);

  // "Bu tarayıcı" işareti DOĞRULANABİLİR olmalı: hangi kaydın hangi oturuma ait olduğunu bilmiyoruz
  // (oturumun kimliği yok), ama isteğin IP + User-Agent'ıyla EŞLEŞEN en yeni kaydı işaretleyebiliriz.
  // Bu yüzden etiket "bu oturum" değil "bu tarayıcı"dır — söylediğimiz kadarını iddia ederiz.
  const h = await headers();
  const hereIp = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const hereDevice = describeUserAgent(h.get("user-agent"));
  const hereId = logins.find((l) => l.device === hereDevice && l.ip === hereIp)?.id ?? null;

  const methodLabel = (m: string) =>
    m === "google" ? "Google" : m === "apple" ? "Apple" : "Parola";
  const fmt = (d: Date) =>
    d.toLocaleString("tr-TR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <DoctoriumShell active={null}>
      <div className="mx-auto max-w-4xl px-5 py-8">
        <Link
          href="/doktor/doctorium"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--c-ink-2)] hover:text-[var(--c-ink)]"
        >
          <ArrowLeft size={15} /> Akışıma dön
        </Link>

        <div className="mt-5">
          <div className="aura-mono text-[11px] font-bold tracking-[0.16em] text-emerald-300">
            HESABIM
          </div>
          <h1 className="aura-display mt-1 text-3xl font-medium tracking-tight text-[var(--c-ink)]">
            Hesap ve güvenlik
          </h1>
          <p className="mt-2.5 max-w-[68ch] text-[14px] leading-relaxed text-[var(--c-ink-2)]">
            Üyelik bilgileriniz, giriş güvenliğiniz ve üyeliğinizin geleceği bu sayfada yönetilir.
            Akış tercihleriniz ayrı sayfada — her bölümün başındaki{" "}
            <span className="text-[var(--c-ink)]">Özelleştir</span> düğmesinden ulaşırsınız.
          </p>
        </div>

        {/* 1 — ÜYELİK BİLGİLERİ */}
        <AuraPanel title="Üyelik bilgilerim" meta="SALT OKUNUR" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field k="Ad Soyad" v={me.name} />
            <Field k="E-posta" v={me.email} />
            {student ? (
              <>
                <Field k="Üniversite" v={doctor.studentUniversity ?? "—"} />
                <Field
                  k="Bölüm"
                  v={doctor.studentDepartment === "dis-hekimligi" ? "Diş Hekimliği" : doctor.studentDepartment === "tip" ? "Tıp" : "—"}
                />
                <Field
                  k="Üniversite e-postası"
                  v={
                    doctor.studentVerifiedAt ? (
                      <Verified at={doctor.studentVerifiedAt} />
                    ) : (
                      <span className="text-[var(--c-ink-3)]">Doğrulanmadı</span>
                    )
                  }
                />
                <Field k="Üyelik türü" v="Tıp Öğrencisi" />
              </>
            ) : (
              <>
                <Field k="Unvan" v={doctor.title || "—"} />
                <Field k="Branş" v={doctor.branch || "—"} />
                <Field k="Şehir" v={doctor.city || "—"} />
                <Field k="Diller" v={doctor.languages?.split(",").join(", ") || "—"} />
                <Field
                  k="Mezun belgesi"
                  v={
                    doctor.diplomaVerifiedAt ? (
                      <Verified at={doctor.diplomaVerifiedAt} />
                    ) : (
                      <span className="text-[var(--c-ink-3)]">Doğrulanmadı</span>
                    )
                  }
                />
                <Field k="Üyelik türü" v="Doktor" />
              </>
            )}
          </div>
          <p className="mt-5 max-w-[68ch] text-[13px] leading-relaxed text-[var(--c-ink-3)]">
            {student
              ? "Öğrenci üyeliğinde belge istenmez; kimliğiniz üniversitenizin verdiği kurumsal e-postanın doğrulanmasıyla teyit edilir."
              : "Bu bilgiler kayıt sırasında verdiğiniz bilgilerdir. Mezun belgeniz şifreli saklanır ve yalnız doğrulama incelemesinde görülür."}
          </p>
        </AuraPanel>

        {/* 2 — ŞİFRE */}
        <PasswordPanel
          hasPassword={me.passwordSetAt !== null}
          provider={me.appleSub ? "Apple" : "Google"}
        />

        {/* 3 — GİRİŞ ETKİNLİĞİ */}
        <AuraPanel title="Giriş etkinliği" meta={logins.length ? "SON 10 KAYIT" : undefined} className="mt-5">
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3.5">
            <Info size={18} className="mt-0.5 shrink-0 text-[var(--c-ink-3)]" />
            <p className="text-[13.5px] leading-relaxed text-[var(--c-ink-2)]">
              Bu liste <strong className="font-semibold text-[var(--c-ink)]">açık oturumları değil</strong>,
              hesabınıza yapılan giriş kayıtlarını gösterir. Tanımadığınız bir giriş görürseniz
              şifrenizi değiştirin ve tüm cihazlardan çıkın.
            </p>
          </div>

          {logins.length === 0 ? (
            <p className="mt-5 text-[13.5px] text-[var(--c-ink-3)]">
              Henüz giriş kaydı yok. Kayıtlar bu özellik açıldıktan sonraki girişlerden itibaren tutulur.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="text-left">
                    <Th>Tarih</Th>
                    <Th>IP adresi</Th>
                    <Th>Tarayıcı / cihaz</Th>
                    <Th>Yöntem</Th>
                  </tr>
                </thead>
                <tbody>
                  {logins.map((l) => (
                    <tr key={l.id} className="border-t border-[var(--c-hairline)]">
                      <td className="whitespace-nowrap py-2.5 pe-3 tabular-nums text-[var(--c-ink)]">{fmt(l.at)}</td>
                      <td className="py-2.5 pe-3 tabular-nums text-[var(--c-ink-2)]">{l.ip ?? "—"}</td>
                      <td className="py-2.5 pe-3 text-[var(--c-ink-2)]">
                        {l.device}
                        {l.id === hereId && (
                          <span className="ms-2 inline-flex rounded-full border border-[var(--c-accent)]/30 bg-[var(--c-accent)]/10 px-2 py-px align-middle aura-mono text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-accent)]">
                            bu tarayıcı
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 text-[var(--c-ink-2)]">{methodLabel(l.method)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 border-t border-[var(--c-hairline)] pt-5">
            <LogoutAllButton target="/doctorium/giris" />
            <p className="mt-3 text-[13px] text-[var(--c-ink-3)]">
              Bütün cihazlardaki oturumlar anında kapanır; her cihazda yeniden giriş gerekir.
            </p>
          </div>
        </AuraPanel>

        {/* 4 — ÜYELİĞİ KAPAT / ÜYELİKTEN ÇIK */}
        <MembershipPanel mode={mode} />
      </div>
    </DoctoriumShell>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-3">
      <SectionLabel className="text-[10px] tracking-[0.14em]">{k}</SectionLabel>
      <div className="mt-1.5 text-[14px] text-[var(--c-ink)]">{v}</div>
    </div>
  );
}

function Verified({ at }: { at: Date }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-px aura-mono text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-300">
        <BadgeCheck size={11} /> Doğrulandı
      </span>
      <span className="aura-mono text-[12px] text-[var(--c-ink-3)]">
        {at.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" })}
      </span>
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2.5 pe-3 aura-mono text-[10px] font-normal uppercase tracking-[0.14em] text-[var(--c-ink-3)]">
      {children}
    </th>
  );
}
