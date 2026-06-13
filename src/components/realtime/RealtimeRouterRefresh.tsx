"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export function RealtimeRouterRefresh({
  channelName,
  signals,
}: {
  channelName: string;
  signals: readonly string[];
}) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  useRealtimeRefresh({ channelName, signals, onRefresh: refresh });

  return null;
}
