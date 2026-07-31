import { getCurrentUser } from "@/app/actions";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, movies, swipes, interestSignals } from "@/db/schema";
import { desc } from "drizzle-orm";
import { DevContent } from "./dev-content";

export default async function DevPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [allUsers, allMovies, allSwipes, allSignals] = await Promise.all([
    db.select().from(users),
    db.select().from(movies).orderBy(desc(movies.createdAt)),
    db
      .select({
        id: swipes.id,
        userId: swipes.userId,
        movieId: swipes.movieId,
        direction: swipes.direction,
        createdAt: swipes.createdAt,
      })
      .from(swipes)
      .orderBy(desc(swipes.createdAt)),
    db.select().from(interestSignals).orderBy(desc(interestSignals.createdAt)),
  ]);

  return (
    <main className="flex min-h-dvh flex-col items-center px-4 py-6 sm:py-8">
      <div className="w-full max-w-4xl mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          🛠 Developer Dashboard
        </h1>
        <p className="text-white/60 text-sm mt-1">
          Movie list, user choices, matches, and more
        </p>
      </div>
      <DevContent
        users={allUsers}
        movies={allMovies}
        swipes={allSwipes}
        signals={allSignals}
      />
    </main>
  );
}
