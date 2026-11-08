import { FamilyMedicineSourceStatus } from "@/components/FamilyMedicineSourceStatus";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { EditorialPanel } from "./EditorialPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aile Hekimliği İncelemesi" };

export default async function FamilyMedicineEditorialPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris?next=/admin/aile-hekimligi");
  if (user.role !== "ADMIN") redirect("/");
  return (
    <div className="mx-auto max-w-5xl px-5 py-8 text-[var(--c-ink)]">
      <Link href="/admin" className="text-sm text-[var(--c-accent)] hover:underline">Yönetime dön</Link>
      <p className="mt-6 text-xs font-semibold tracking-wider text-[var(--c-ink-3)]">EDİTORYAL İNCELEME</p>
      <h1 className="aura-display mt-2 text-3xl font-medium">Aile Hekimliği inceleme masası</h1>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[var(--c-ink-2)]">Kaynak ve madde kanıtlarını sürümleyin; hekim ve hukuk incelemelerini ayrı izleyin. Yönetici olmak uzman inceleme yetkisi vermez. Bu panel kayıtları çalışma alanını veya klinik içeriği otomatik yayımlamaz.</p>
      <EditorialPanel />
      <FamilyMedicineSourceStatus />
    </div>
  );
}
