import bola from "@/app/bola.svg";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-20 w-20",
} as const;

type SpinningBallLoaderProps = {
  label?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

export function SpinningBallLoader({
  label = "Carregando",
  size = "lg",
  className,
}: SpinningBallLoaderProps) {
  const src = typeof bola === "string" ? bola : bola.src;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("grid min-h-[260px] place-items-center", className)}
    >
      <span className="sr-only">{label}</span>
      <span
        className={cn(
          SIZE_CLASS[size],
          "grid origin-center animate-spin place-items-center drop-shadow-[0_12px_24px_rgba(0,0,0,0.28)] motion-reduce:animate-none",
        )}
        aria-hidden="true"
      >
        <img src={src} alt="" className="block h-full w-full object-contain" />
      </span>
    </div>
  );
}
