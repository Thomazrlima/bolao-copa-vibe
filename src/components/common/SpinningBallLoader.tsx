import bola from "@/app/bola.svg";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  sm: "h-8 w-12",
  md: "h-11 w-16",
  lg: "h-16 w-24",
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
          "relative grid place-items-center drop-shadow-[0_12px_24px_rgba(0,0,0,0.3)]",
        )}
        aria-hidden="true"
      >
        <img
          src={src}
          alt=""
          className="brazil-loader-default h-full w-auto animate-spin object-contain motion-reduce:animate-none"
        />
        <span className="brazil-flag-loader hidden h-full w-full">
          <span className="brazil-flag-loader-diamond" />
          <span className="brazil-flag-loader-circle" />
        </span>
      </span>
    </div>
  );
}
