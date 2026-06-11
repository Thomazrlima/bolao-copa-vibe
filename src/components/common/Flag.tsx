import { cn } from "@/lib/utils";
import { flagUrl } from "@/data/iso2";

type Props = {
  code?: string;
  name?: string;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Desabilita a animação de tremulação (CSS). */
  static?: boolean;
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "h-4 w-6",
  md: "h-5 w-8",
  lg: "h-7 w-11",
  xl: "h-11 w-16",
};

const PX_FOR_SIZE: Record<NonNullable<Props["size"]>, 40 | 80 | 160> = {
  sm: 40,
  md: 40,
  lg: 80,
  xl: 160,
};

export function Flag({ code, name, size = "md", className, static: isStatic }: Props) {
  const url = flagUrl(code, PX_FOR_SIZE[size]);
  if (!url) {
    return (
      <span
        className={cn(
          "inline-block rounded-md bg-muted text-center text-[10px] text-muted-foreground",
          SIZE_CLASS[size],
          className,
        )}
      >
        ?
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flag-wrap relative inline-block shrink-0 overflow-hidden rounded-md ring-1 ring-black/40",
        SIZE_CLASS[size],
        className,
      )}
      aria-label={name ?? code}
    >
      <img
        src={url}
        alt={name ? `Bandeira de ${name}` : `Bandeira ${code}`}
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", !isStatic && "flag-wave")}
      />
    </span>
  );
}
