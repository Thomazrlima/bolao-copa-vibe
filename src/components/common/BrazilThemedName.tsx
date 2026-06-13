import { Flag } from "@/components/common/Flag";
import { teamCodeFromName } from "@/data/iso2";
import { cn } from "@/lib/utils";

export function BrazilThemedName({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("brazil-ranking-name", className)}>
      {children}
      <Flag
        code={teamCodeFromName("Brasil")}
        name="Brasil"
        size="sm"
        className="brazil-themed-name-flag ml-1 hidden align-[-0.15em]"
        static
      />
    </span>
  );
}
