"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

interface MatchModalProps {
  movie: {
    title: string;
    posterUrl: string;
    providers: string[];
  };
  onClose: () => void;
}

export default function MatchModal({ movie, onClose }: MatchModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    previouslyFocused.current = document.activeElement as HTMLElement;
    const focusables = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Tab") {
        const active = document.activeElement;
        if (e.shiftKey && active === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && active === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Match notification"
    >
      {/* Backdrop blur */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div ref={dialogRef} className="relative z-10 w-full max-w-sm rounded-2xl bg-gradient-to-b from-white/15 to-white/5 backdrop-blur-xl border border-white/20 shadow-2xl p-6 sm:p-8 pb-safe animate-scale-in">
        {/* Hearts decoration */}
        <div className="text-center mb-4">
          <span className="text-4xl">💕</span>
        </div>

        {/* Heading */}
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-2">
          It&apos;s a Match!
        </h2>
        <p className="text-center text-white/60 text-sm mb-6">
          You both liked this movie!
        </p>

        {/* Movie Info */}
        <div className="flex items-center gap-4 mb-6">
          {movie.posterUrl && (
            <div className="flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border border-white/10 shadow-lg">
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white truncate">
              {movie.title}
            </h3>
            {movie.providers && movie.providers.length > 0 && (
              <p className="text-sm text-white/60 mt-1">
                Available on:{" "}
                <span className="text-white/80 font-medium">
                  {movie.providers.join(", ")}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/matches"
            className="w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand/80 text-white font-semibold text-center transition-all duration-300 hover:shadow-lg hover:shadow-brand/30"
          >
            💕 View Matches
          </Link>
          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-medium transition-all duration-300"
          >
            Keep Swiping
          </button>
        </div>
      </div>
    </div>
  );
}
