import { getCurrentUser } from "@/app/actions";
import { redirect } from "next/navigation";
import SwipeCard from "@/components/SwipeCard";

export default async function SwipePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-2xl">
        <p className="text-center text-sm text-white/50 mb-4">
          Find movies you&apos;ll both love ❤️ Swipe right to like, left to pass.
        </p>
        <SwipeCard />
      </div>
    </main>
  );
}
