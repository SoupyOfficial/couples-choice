"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseMoodAction } from "@/app/actions/mood";

const GENRE_CHIPS = [
  "Thriller",
  "Comedy",
  "Romance",
  "Sci-Fi",
  "Drama",
  "Horror",
  "Action",
  "Documentary",
  "Animation",
];

const VIBE_CHIPS = ["Cozy", "Intense", "Feel-Good", "Dark", "Nostalgic", "Mind-Bending"];

const ALL_CHIPS = [...GENRE_CHIPS, ...VIBE_CHIPS];

const VIEW_MODE_CHIPS = [
  { label: "🆕 New", value: "new" },
  { label: "🔄 Rewatch", value: "rewatch" },
];

function syncToUrl(
  mood: Set<string>,
  avoid: Set<string>,
  viewMode: string,
  hidden: boolean,
  router: ReturnType<typeof useRouter>
) {
  const params = new URLSearchParams(window.location.search);

  if (hidden) {
    params.set("mood-hidden", "true");
    params.delete("mood");
    params.delete("avoid");
    params.delete("view-mode");
  } else {
    params.delete("mood-hidden");
    if (mood.size > 0) {
      params.set("mood", Array.from(mood).join(","));
    } else {
      params.delete("mood");
    }
    if (avoid.size > 0) {
      params.set("avoid", Array.from(avoid).join(","));
    } else {
      params.delete("avoid");
    }
    if (viewMode) {
      params.set("view-mode", viewMode);
    } else {
      params.delete("view-mode");
    }
  }

  const query = params.toString();
  router.replace(query ? `${window.location.pathname}?${query}` : window.location.pathname, {
    scroll: false,
  });
}

export default function MoodSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mood, setMood] = useState<Set<string>>(new Set());
  const [avoid, setAvoid] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<string>("");
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [freeTextOpen, setFreeTextOpen] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const moodParam = searchParams.get("mood");
    const avoidParam = searchParams.get("avoid");
    const hiddenParam = searchParams.get("mood-hidden");
    const viewModeParam = searchParams.get("view-mode");

    if (hiddenParam === "true") {
      setHidden(true);
    } else {
      setMood(new Set(moodParam ? moodParam.split(",").filter(Boolean) : []));
      setAvoid(new Set(avoidParam ? avoidParam.split(",").filter(Boolean) : []));
      setViewMode(viewModeParam === "new" || viewModeParam === "rewatch" ? viewModeParam : "");
    }
    setInitialized(true);
  }, [searchParams]);

  if (!initialized) return null;

  if (hidden) {
    return (
      <div className="w-full mb-4">
        <button
          onClick={() => {
            setHidden(false);
            setCollapsed(false);
            syncToUrl(mood, avoid, viewMode, false, router);
          }}
          className="text-sm text-white/50 hover:text-white/80 underline transition-colors"
        >
          Show mood filters
        </button>
      </div>
    );
  }

  const activeCount = mood.size + avoid.size;

  const toggleMood = (chip: string) => {
    const newMood = new Set(mood);
    const newAvoid = new Set(avoid);
    if (newMood.has(chip)) {
      newMood.delete(chip);
    } else {
      newMood.add(chip);
      newAvoid.delete(chip);
    }
    setMood(newMood);
    setAvoid(newAvoid);
    syncToUrl(newMood, newAvoid, viewMode, false, router);
  };

  const toggleAvoid = (chip: string) => {
    const newMood = new Set(mood);
    const newAvoid = new Set(avoid);
    if (newAvoid.has(chip)) {
      newAvoid.delete(chip);
    } else {
      newAvoid.add(chip);
      newMood.delete(chip);
    }
    setMood(newMood);
    setAvoid(newAvoid);
    syncToUrl(newMood, newAvoid, viewMode, false, router);
  };

  const toggleViewMode = (value: string) => {
    const newViewMode = viewMode === value ? "" : value;
    setViewMode(newViewMode);
    syncToUrl(mood, avoid, newViewMode, false, router);
  };

  const handleFreeText = async () => {
    if (!freeText.trim()) return;
    setParsing(true);
    try {
      const filters = await parseMoodAction(freeText.trim());
      if (filters) {
        const newMood = new Set(mood);
        const newAvoid = new Set(avoid);
        filters.preferredGenres.forEach((g) => newMood.add(g));
        filters.preferredVibes.forEach((v) => newMood.add(v));
        filters.avoidVibes.forEach((v) => {
          newAvoid.add(v);
          newMood.delete(v);
        });
        setMood(newMood);
        setAvoid(newAvoid);
        syncToUrl(newMood, newAvoid, viewMode, false, router);
      }
    } finally {
      setParsing(false);
      setFreeText("");
    }
  };

  const handleSurpriseMe = () => {
    const empty = new Set<string>();
    setMood(empty);
    setAvoid(empty);
    setViewMode("");
    syncToUrl(empty, empty, "", false, router);
  };

  const handleSkip = () => {
    setHidden(true);
    syncToUrl(new Set(), new Set(), "", true, router);
  };

  // Collapsed single-line view
  if (collapsed) {
    return (
      <div className="w-full mb-4">
        <div className="flex items-center justify-between bg-white/10 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-white/50 mr-1">Mood:</span>
            {Array.from(mood).map((chip) => (
              <span
                key={chip}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-600 text-white"
              >
                {chip}
              </span>
            ))}
            {Array.from(avoid).map((chip) => (
              <span
                key={chip}
                className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900/50 text-red-300 line-through border border-red-500/30"
              >
                {chip}
              </span>
            ))}
            {activeCount === 0 && (
              <span className="text-xs text-white/30">No filters set</span>
            )}
          </div>
          <button
            onClick={() => setCollapsed(false)}
            className="text-xs text-white/50 hover:text-white/80 transition-colors ml-2 shrink-0"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  // Expanded view
  return (
    <div className="w-full mb-4">
      <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-4 space-y-4 max-h-[50vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white/90">
            What&apos;s your mood?
          </h3>
          {activeCount > 0 && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              Collapse
            </button>
          )}
        </div>

        <div>
          <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">
            Viewing mode
          </p>
          <div className="flex flex-wrap gap-2">
            {VIEW_MODE_CHIPS.map((chip) => (
              <button
                key={`view-${chip.value}`}
                onClick={() => toggleViewMode(chip.value)}
                className={`px-3 py-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-xs font-medium transition-all duration-200 ${
                  viewMode === chip.value
                    ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                    : "bg-white/5 text-white/60 border border-white/20 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* In the mood for */}
        <div>
          <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">
            In the mood for
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_CHIPS.map((chip) => (
              <button
                key={`mood-${chip}`}
                onClick={() => toggleMood(chip)}
                className={`px-3 py-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-xs font-medium transition-all duration-200 ${
                  mood.has(chip)
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30"
                    : "bg-white/5 text-white/60 border border-white/20 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* NOT in the mood for */}
        <div>
          <p className="text-xs text-white/50 mb-2 font-medium uppercase tracking-wide">
            Not in the mood for
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_CHIPS.map((chip) => (
              <button
                key={`avoid-${chip}`}
                onClick={() => toggleAvoid(chip)}
                className={`px-3 py-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-full text-xs font-medium transition-all duration-200 ${
                  avoid.has(chip)
                    ? "bg-red-900/60 text-red-300 border border-red-500/40 line-through"
                    : "bg-white/5 text-white/60 border border-white/20 hover:bg-white/10 hover:text-white/80"
                }`}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Free text input */}
        {!freeTextOpen ? (
          <button
            onClick={() => setFreeTextOpen(true)}
            className="text-sm text-white/50 hover:text-white/80 underline transition-colors"
          >
            Or describe your mood...
          </button>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="e.g., something light with a twist ending"
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-rose-600/50 transition-colors"
              onKeyDown={(e) => e.key === "Enter" && handleFreeText()}
            />
            <button
              onClick={handleFreeText}
              disabled={parsing || !freeText.trim()}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {parsing ? "..." : "Apply"}
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={handleSurpriseMe}
            className="text-sm text-white/60 hover:text-white font-medium transition-colors"
          >
            Surprise Me!
          </button>
          <button
            onClick={handleSkip}
            className="text-sm text-white/40 hover:text-white/70 underline transition-colors"
          >
            Skip, show me everything
          </button>
        </div>
      </div>
    </div>
  );
}
