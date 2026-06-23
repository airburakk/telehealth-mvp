import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Clock, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getAccessLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

// Erişim Kaydım — hasta-yüzü şeffaflık sayfası: "verime kim, ne zaman, neye erişti".
// Değiştirilemez (append-only hash-zinciri) + (test) RFC 3161 zaman damgalı denetim kaydı (lib/audit).
// NOT: i18n + RTL increment 2'ye bırakıldı (şimdilik TR).

const ACTION_TR: Record<string, string> = {
  CASE_VIEW: "Vaka görüntülendi",
  CONSULT_WRITE: "Klinik not yazıldı",
  CONSULT_END: "Görüşme kapatıldı",
  FHIR_EXPORT: "FHIR dışa aktarım",
  DOCUMENT_VIEW: "Belge görüntülendi",
};
const RES_TR: Record<string, string> = {
  CASE: "Vaka",
  CONSULTATION: "Görüşme",
  FHIR_COMPOSITION: "Epikriz (FHIR)",
  FHIR_CONSENT: "Paylaşım izni (FHIR)",
  CASE_DOCUMENT: "Belge",
};
const ROLE_TR: Record<string, string> = {
  DOCTOR: "Doktor",
  COORDINATOR: "Koordinatör",
  ADMIN: "Yönetici",
  PATIENT: "Hasta",
  ETHICS: "Etik Kurul",
};

export default async function AccessLogPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/erisim-kaydi");
  const entries = await getAccessLog(user.id, user.id);

  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <div className="flex items-center gap-2.5 mb-1.5">
        <Lock size={20} className="text-[#0E8A95]" />
        <h1 className="text-2xl font-semibold text-slate-900">Erişim Kaydım</h1>
      </div>
      <p className="text-sm text-slate-600 max-w-2xl">
        Verinize <strong>kim, ne zaman, neye</strong> eriştiğinin değiştirilemez kaydı. Her satır bir
        hash-zincirine bağlanır ve zaman damgalanır — sonradan silinemez veya değiştirilemez.
      </p>

      {entries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
          Verinize henüz kayıtlı bir erişim yok. Bir doktor vakanızı görüntülediğinde burada görünür.
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-4 py-2.5 font-medium">Tarih</th>
                <th className="px-4 py-2.5 font-medium">Kim</th>
                <th className="px-4 py-2.5 font-medium">İşlem</th>
                <th className="px-4 py-2.5 font-medium">Kaynak</th>
                <th className="px-4 py-2.5 font-medium">Doğrulama</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e) => {
                const verified = e.verification.entryHashValid === true && e.verification.timestampValid === true;
                return (
                  <tr key={e.id} className="text-slate-700">
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                      {new Date(e.createdAt).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}
                    </td>
                    <td className="px-4 py-2.5">
                      {e.actorIsYou ? (
                        <span className="inline-flex items-center rounded-full bg-[#0E8A95]/10 px-2 py-0.5 text-xs font-medium text-[#0E8A95]">Siz</span>
                      ) : (
                        <span className="font-medium">{e.actorRole ? ROLE_TR[e.actorRole] ?? e.actorRole : "Sistem"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{ACTION_TR[e.action] ?? e.action}</td>
                    <td className="px-4 py-2.5 text-slate-500">{RES_TR[e.resourceType] ?? e.resourceType}</td>
                    <td className="px-4 py-2.5">
                      {verified ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <ShieldCheck size={15} /> Doğrulandı
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-6 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <Clock size={15} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          <strong className="text-slate-600">Mühür &amp; zaman damgası:</strong> her kayıt bir önceki kaydın
          mührüne (hash) bağlanır → araya ekleme/silme tespit edilebilir. Zaman damgası şu an mekanizma-doğrulama
          amaçlı <em>simüle</em> (SIMULATED-LOCAL); üretimde bağımsız RFC 3161 otoritesine takılacak. Yüksek-frekanslı
          teknik olaylar (sinyal/poll, arayüz çevirisi) kasıtlı olarak kaydedilmez. Onam ispatınız için{" "}
          <Link href="/onam/kanit" className="text-[#0E8A95] hover:underline">Onay Kanıtım</Link>.
        </p>
      </div>
    </main>
  );
}
