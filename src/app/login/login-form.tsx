"use client";

import { login } from "@/app/actions";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

export function LoginForm({
  userId,
  children,
}: {
  userId: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    await login(userId);
    // Navigate client-side after cookie is confirmed set
    router.push("/swipe");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="group flex w-48 flex-col items-center gap-3 rounded-2xl border border-white/10 bg-card/60 px-6 py-8 transition-all duration-200 hover:scale-105 hover:border-brand/50 hover:bg-card/90 hover:shadow-lg hover:shadow-brand/20 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
