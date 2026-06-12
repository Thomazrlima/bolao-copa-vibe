import { Input } from "@/components/ui/input";
import { useBolaoStore } from "@/lib/store";
import type { Score } from "@/data/fixtures";

type Props = {
  fixtureId: string;
  compact?: boolean;
};

export function ScoreEditor({ fixtureId, compact }: Props) {
  const result = useBolaoStore((s) => s.results[fixtureId]);
  const setResult = useBolaoStore((s) => s.setResult);

  const update = (key: keyof Score, val: string) => {
    const n = Math.max(0, Math.min(20, parseInt(val || "0", 10) || 0));
    const base = result ?? { home: 0, away: 0 };
    setResult(fixtureId, { ...base, [key]: n });
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Input
        type="number"
        min={0}
        value={result?.home ?? ""}
        onChange={(e) => update("home", e.target.value)}
        aria-label="Placar do time da casa"
        inputMode="numeric"
        className={`num text-center font-display font-bold ${compact ? "h-9 w-10 px-1 text-base" : "h-10 w-12"}`}
      />
      <span className="text-muted-foreground">×</span>
      <Input
        type="number"
        min={0}
        value={result?.away ?? ""}
        onChange={(e) => update("away", e.target.value)}
        aria-label="Placar do time visitante"
        inputMode="numeric"
        className={`num text-center font-display font-bold ${compact ? "h-9 w-10 px-1 text-base" : "h-10 w-12"}`}
      />
    </div>
  );
}
