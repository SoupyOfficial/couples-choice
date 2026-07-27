"use client";

import { markMatchesViewed } from "@/app/actions/mark-matches-viewed";
import { useEffect } from "react";

export function MarkViewed({ count }: { count: number }) {
  useEffect(() => {
    markMatchesViewed(count);
  }, [count]);

  return null;
}
