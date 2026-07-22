import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { logout, getCurrentUser } from "@/app/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "Couple's Choice — Movie Matchmaker",
  description: "Swipe on movies together and find your perfect match.",
};

async function NavBar() {
  const cookieStore = await cookies();
  const userId = cookieStore.get("current-user")?.value;

  if (!userId) {
    return (
      <nav className="w-full px-4 py-3 border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-lg font-semibold text-white/80">
            Couple&apos;s Choice
          </span>
        </div>
      </nav>
    );
  }

  const user = await getCurrentUser();
  const emoji = user?.emoji ?? "👤";
  const name = user?.name ?? "User";

  return (
    <nav className="w-full px-4 py-3 border-b border-white/10 backdrop-blur-md bg-white/5">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/swipe"
            className="text-lg font-semibold text-white/90 hover:text-white transition-colors"
          >
            Couple&apos;s Choice
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/swipe"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-medium transition-all duration-300"
            >
              Swipe
            </Link>
            <Link
              href="/matches"
              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-medium transition-all duration-300"
            >
              💕 Matches
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/70">
            {emoji} {name}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="text-white/50 hover:text-white/80 underline transition-colors"
            >
              Not {name}?
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}

// Initialize DB on first request

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
