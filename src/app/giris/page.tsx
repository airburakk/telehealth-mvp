import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <div className="grid min-h-[calc(100vh-8rem)] place-items-center px-5 py-10">
      <Suspense fallback={<div className="text-sm text-slate-400">Yükleniyor…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
