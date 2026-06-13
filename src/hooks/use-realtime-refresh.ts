"use client";

import { useEffect, useMemo, useRef } from "react";

import { createClient } from "@/lib/supabase/client";

type UseRealtimeRefreshOptions = {
  channelName: string;
  signals: readonly string[];
  onRefresh: () => void | Promise<void>;
  enabled?: boolean;
  debounceMs?: number;
  fallbackIntervalMs?: number;
};

export function useRealtimeRefresh({
  channelName,
  signals,
  onRefresh,
  enabled = true,
  debounceMs = 700,
  fallbackIntervalMs = 5 * 60_000,
}: UseRealtimeRefreshOptions) {
  const supabase = useMemo(() => createClient(), []);
  const refreshRef = useRef(onRefresh);
  const timeoutRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const queuedRef = useRef(false);
  const signalKey = signals.join(",");

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled || signals.length === 0) return;

    let active = true;

    async function runRefresh() {
      if (!active) return;
      if (runningRef.current) {
        queuedRef.current = true;
        return;
      }

      runningRef.current = true;
      try {
        await refreshRef.current();
      } finally {
        runningRef.current = false;
        if (queuedRef.current && active) {
          queuedRef.current = false;
          void runRefresh();
        }
      }
    }

    function scheduleRefresh() {
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => void runRefresh(), debounceMs);
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "realtime_atualizacoes",
          filter: `canal=in.(${signalKey})`,
        },
        scheduleRefresh,
      )
      .subscribe();

    window.addEventListener("online", scheduleRefresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const fallbackInterval = window.setInterval(scheduleRefresh, fallbackIntervalMs);

    return () => {
      active = false;
      if (timeoutRef.current != null) window.clearTimeout(timeoutRef.current);
      window.clearInterval(fallbackInterval);
      window.removeEventListener("online", scheduleRefresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [channelName, debounceMs, enabled, fallbackIntervalMs, signalKey, signals.length, supabase]);
}
