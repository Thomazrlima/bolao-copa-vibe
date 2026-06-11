import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GROUP_FIXTURES, KO_FIXTURES, type Score } from "@/data/fixtures";

type ResultsMap = Record<string, Score | null>;

type State = {
  results: ResultsMap; // overrides for fixture results
  setResult: (id: string, score: Score | null) => void;
  reset: () => void;
};

const initialResults: ResultsMap = {};
[...GROUP_FIXTURES, ...KO_FIXTURES].forEach((f) => {
  initialResults[f.id] = f.result ?? null;
});

export const useBolaoStore = create<State>()(
  persist(
    (set) => ({
      results: initialResults,
      setResult: (id, score) =>
        set((s) => ({ results: { ...s.results, [id]: score } })),
      reset: () => set({ results: initialResults }),
    }),
    {
      name: "bolao-dos-vdevers-v1",
      version: 1,
    },
  ),
);

export function useResult(id: string) {
  return useBolaoStore((s) => s.results[id] ?? null);
}
