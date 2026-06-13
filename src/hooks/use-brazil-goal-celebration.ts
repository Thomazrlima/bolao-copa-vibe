"use client";

import { useEffect, useRef } from "react";
import {
  celebrateBrazilGoal,
  startBrazilGoalConfettiPreview,
  stopBrazilGoalConfetti,
} from "@/lib/brazil-goal-confetti";

type ScoreSnapshot = {
  gols1: number | null;
  gols2: number | null;
};

type BrazilGoalGame = {
  id: string;
  time1: string;
  time2: string;
  gols1: number | null;
  gols2: number | null;
  encerrado: boolean;
  placar_status: "upcoming" | "live" | "finished" | null;
};

function isBrazilTeam(team: string) {
  const normalizedTeam = team.trim().toLocaleLowerCase("pt-BR");
  return normalizedTeam === "brasil" || normalizedTeam === "brazil";
}

function isBrazilGame(game: BrazilGoalGame) {
  return isBrazilTeam(game.time1) || isBrazilTeam(game.time2);
}

function getBrazilGoals(game: BrazilGoalGame) {
  if (game.gols1 == null || game.gols2 == null) return null;

  if (isBrazilTeam(game.time1)) {
    return game.gols1;
  }

  if (isBrazilTeam(game.time2)) {
    return game.gols2;
  }

  return null;
}

export function useBrazilGoalCelebration(
  games: BrazilGoalGame[],
  {
    enabled = true,
    reduceMotion = false,
    previewConfetti = false,
  }: {
    enabled?: boolean;
    reduceMotion?: boolean | null;
    previewConfetti?: boolean;
  } = {},
) {
  const previousScoresRef = useRef<Map<string, ScoreSnapshot>>(new Map());
  const hasBaselineRef = useRef(false);

  useEffect(() => {
    if (!enabled || reduceMotion || !previewConfetti) return;

    startBrazilGoalConfettiPreview();
    return () => stopBrazilGoalConfetti();
  }, [enabled, previewConfetti, reduceMotion]);

  useEffect(() => {
    if (!enabled || reduceMotion || previewConfetti) return;

    let celebrated = false;

    for (const game of games) {
      if (!isBrazilGame(game)) continue;
      if (game.placar_status !== "live" || game.encerrado) continue;
      if (game.gols1 == null || game.gols2 == null) continue;

      const previous = previousScoresRef.current.get(game.id);
      const currentBrazilGoals = getBrazilGoals(game);

      if (
        hasBaselineRef.current &&
        previous &&
        currentBrazilGoals != null &&
        previous.gols1 != null &&
        previous.gols2 != null
      ) {
        const previousBrazilGoals = getBrazilGoals({
          ...game,
          gols1: previous.gols1,
          gols2: previous.gols2,
        });

        if (previousBrazilGoals != null && currentBrazilGoals > previousBrazilGoals) {
          celebrateBrazilGoal();
          celebrated = true;
        }
      }

      previousScoresRef.current.set(game.id, {
        gols1: game.gols1,
        gols2: game.gols2,
      });
    }

    if (!hasBaselineRef.current && games.length > 0) {
      hasBaselineRef.current = true;
    }

    if (celebrated) {
      return;
    }
  }, [enabled, games, previewConfetti, reduceMotion]);
}
