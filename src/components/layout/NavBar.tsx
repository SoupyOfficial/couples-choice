import Link from "next/link";
import { logout } from "@/app/actions";

interface NavBarProps {
  className?: string;
  newMatchCount: number;
  user: {
    id: number;
    name: string;
    emoji: string;
    extractedPrefs: boolean;
  } | null;
  name: string;
  emoji: string;
}

export default function NavBar({ className = "", newMatchCount, user, name, emoji }: NavBarProps) {
  return (
    <nav className={`w-full px-4 py-3 border-b border-white/10 backdrop-blur-md bg-white/5 ${className}`}>
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/swipe" className="text-lg font-semibold text-white/90 hover:text-white transition-colors">
            Couple&apos;s Choice
          </Link>
          <div className="flex items-center gap-3">
            {!user?.extractedPrefs && (
              <Link href="/onboarding" className="px-3 py-1.5 rounded-lg bg-brand/20 hover:bg-brand/30 text-brand hover:text-brand/90 text-sm font-medium transition-all duration-300">
                Preferences
              </Link>
            )}
            <Link href="/swipe" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-medium transition-all duration-300">
              Swipe
            </Link>
            <Link href="/pick" className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-medium transition-all duration-300">
              🎬 Pick
            </Link>
            <Link href="/matches" className="relative px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white text-sm font-medium transition-all duration-300">
              💕 Matches
              {newMatchCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-brand rounded-full">
                  {newMatchCount}
                </span>
              )}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-white/70">{emoji} {name}</span>
          <form action={logout}>
            <button type="submit" className="text-white/50 hover:text-white/80 underline transition-colors">
              Not {name}?
            </button>
          </form>
        </div>
      </div>
    </nav>
  );
}
