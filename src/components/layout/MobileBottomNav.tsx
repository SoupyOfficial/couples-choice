"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileBottomNavProps {
  className?: string;
  newMatchCount: number;
  showPreferences: boolean;
}

export default function MobileBottomNav({ className = "", newMatchCount, showPreferences }: MobileBottomNavProps) {
  const pathname = usePathname();

  const linkClass = (route: string) =>
    `flex flex-col items-center gap-0.5 px-3 py-1 min-w-[64px] rounded-lg transition-colors ${
      pathname === route ? "text-brand" : "text-white/50 hover:text-white/70"
    }`;

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-white/10 pb-safe ${className}`}>
      <div className="flex items-center justify-around max-w-lg mx-auto h-16">
        <Link href="/swipe" className={linkClass("/swipe")}>
          <span className="text-lg">❤️</span>
          <span className="text-[10px] font-medium">Swipe</span>
        </Link>
        <Link href="/pick" className={linkClass("/pick")}>
          <span className="text-lg">🎬</span>
          <span className="text-[10px] font-medium">Pick</span>
        </Link>
        <Link href="/matches" className={`${linkClass("/matches")} relative`}>
          <span className="text-lg">💕</span>
          <span className="text-[10px] font-medium">Matches</span>
          {newMatchCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-brand rounded-full">{newMatchCount}</span>
          )}
        </Link>
        <Link href="/dev" className={linkClass("/dev")}>
          <span className="text-lg">🛠</span>
          <span className="text-[10px] font-medium">Dev</span>
        </Link>
        {showPreferences && (
          <Link href="/onboarding" className={linkClass("/onboarding")}>
            <span className="text-lg">⚙️</span>
            <span className="text-[10px] font-medium">Prefs</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
