import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { MessagesList } from "@/components/MessagesList";

export const dynamic = "force-dynamic";

// Sistem Mesajları sayfası (v6.79) — girişli TÜM rollere açık (rol kapısı YOK; herkes yalnız
// KENDİ hedefli mesajlarını görür — süzme /api/system-messages'ta, Notification sözleşmesiyle).
// İçerik client'ta auth'lu fetch ile gelir; bu sunucu kabuğu yalnız oturum kapısıdır.
export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/giris");
  return <MessagesList />;
}
