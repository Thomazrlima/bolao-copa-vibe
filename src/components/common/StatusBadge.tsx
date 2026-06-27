import { cn } from "@/lib/utils";

type Props = {
  status: "live" | "finished" | "scheduled";
  liveLabel?: string | null;
  className?: string;
};

export function StatusBadge({ status, liveLabel, className }: Props) {
  if (status === "live") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-[color:var(--live)]/60 bg-[color:var(--live)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--live)]",
          className,
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--live)] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--live)]" />
        </span>
        {liveLabel ?? "AO VIVO"}
      </span>
    );
  }
  if (status === "finished") {
    return (
      <span
        className={cn(
          "rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
          className,
        )}
      >
        Encerrado
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      Não iniciado
    </span>
  );
}
