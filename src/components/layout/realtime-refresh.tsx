"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Periodically refreshes the current route's server components so that
 * stock, sales, expenses and cash session data stay in sync (near realtime)
 * across devices and tabs without a manual page reload.
 */
export function RealtimeRefresh({ intervalMs = 15000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return null;
}
