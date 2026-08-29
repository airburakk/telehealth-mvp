import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  ArrowRight, BarChart2, CalendarDays, Gift, LayoutDashboard, Megaphone,
  MousePointerClick, TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

// Yönetim dizini (v6.71) — header'daki tek "Yönetim" öğesi buraya gelir; paneller kartlardan
// dağılır (kullanıcı kararı: bant şişmesin, yeni admin aracı buraya kart olarak eklenir).
// /master BİLİNÇLİ listelenmez (env-dormant üç katmanlı kapı — keşfedilebilirlik artırılmaz).
export const metadata = { title: "Yönetim" };

// ── AURA ayıklaması (kullanıcı kararı 2026-08-29) ──────────────────────────────────────────
// Bu dizin artık DOCTORIUM'un yönetim yüzeyidir (app/admin/layout.tsx Doctorium kromunu çizer).
// Kullanıcı bildirimi: "Yönetim ve Operasyon'a tıkladığın anda AURA'ya dönüyor … bunlara
// tıklandığında artık AURA görmek istemiyorum."
//
// Buradan ÇIKARILANLAR — ikisi de AURA yüzeyine götürüyordu:
//   · "Personel Onayı" kartı (/admin/personel-onay) — Partner/Acente/Sağlık Uzmanı başvuruları;
//     Doctorium'un doktor+öğrenci üyeliğiyle ilgisi yok (kullanıcı adıyla işaret etti).
//   · OVERSIGHT bloğu — /doktor · /vakalarim · /triyaj · /acente · /etik-kurul · /partner gibi
//     10 AURA denetim kısayolu; tıklanınca kaçınılmaz olarak AURA kromu açılıyordu.
// ⚠️ ROTALAR SİLİNMEDİ, yalnız bu dizinden düştüler: /admin/personel-onay ve saydığım yüzeyler
// doğrudan URL ile çalışmaya devam eder, erişim kuralları değişmedi. Geri istenirse bu commit'ten
// PANELS kartı + OVERSIGHT dizisi ve ilgili lucide ikonları geri alınır.

const PANELS = [
  {
    href: "/admin/kampanya",
    label: "Sponsorlu Kampanyalar",
    desc: "Doctorium akışındaki sponsorlu kartlar — oluştur, hedefle, durum yönet (ilaç-dışı).",
    icon: Megaphone,
    tone: "#f59e0b",
  },
  {
    href: "/admin/anket",
    label: "Anketler",
    desc: "Topluluk ve sponsorlu anketler — soru/şık kur, yayınla, toplu sonuçları izle.",
    icon: BarChart2,
    tone: "#38bdf8",
  },
  {
    href: "/admin/etkinlik",
    label: "Etkinlik Takvimi",
    desc: "Kongre, sempozyum ve kurs kayıtları — doktor takviminde görünen etkinlikleri yönet.",
    icon: CalendarDays,
    tone: "#34d399",
  },
  {
    href: "/admin/oduller",
    label: "Ödül Kataloğu",
    desc: "Anket puanlarının ödül karşılıkları — kongre/kitap kalemleri + talep onay ve teslim kuyruğu.",
    icon: Gift,
    tone: "#a78bfa",
  },
  {
    href: "/admin/uyeler",
    label: "Üye Analitiği",
    desc: "Doctorium üye tabanı — kaç doktor/öğrenci geldi ve ne zaman; doğrulama durumu, şehir, branş ve üniversite dağılımı.",
    icon: TrendingUp,
    tone: "#818cf8",
  },
  {
    href: "/admin/landing-analitik",
    label: "Landing Analitiği",
    desc: "Doctorium vitrini tıklama/görüntülenme sayaçları — first-party agregat, kimliksiz.",
    icon: MousePointerClick,
    tone: "#2dd4bf",
  },
];

export default async function AdminIndexPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "ADMIN") redirect("/doktor");

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="aura-display flex items-center gap-2.5 text-2xl font-medium tracking-tight text-[var(--c-ink)]">
        <LayoutDashboard size={22} className="text-[var(--c-ink-2)]" /> Yönetim
      </h1>
      <p className="mt-1 text-sm text-[var(--c-ink-2)]">Platform küratör panelleri — yalnız yönetici hesabı.</p>

      <ul className="mt-6 grid gap-3">
        {PANELS.map((p) => (
          <li key={p.href}>
            <Link
              href={p.href}
              className="group flex items-center gap-4 rounded-2xl border border-[var(--c-hairline)] bg-[var(--c-surface)] px-4 py-4 transition hover:border-[var(--c-ink-3)]"
            >
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--c-surface-2)]"
                style={{ boxShadow: `inset 3px 0 0 ${p.tone}` }}
              >
                <p.icon size={20} style={{ color: p.tone }} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--c-ink)]">{p.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--c-ink-2)]">{p.desc}</span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-[var(--c-ink-3)] transition group-hover:translate-x-0.5 group-hover:text-[var(--c-ink)]" />
            </Link>
          </li>
        ))}
      </ul>

      {/* "Denetim görünümleri" bloğu 2026-08-29'da kaldırıldı — dosya başındaki AURA ayıklaması
          notuna bakın. On kısayolun tamamı AURA yüzeylerine gidiyordu; rotalar duruyor, yalnız
          bu dizinden düştüler. Doctorium portalına dönüş için üstteki marka bloğu kullanılır. */}
    </div>
  );
}
