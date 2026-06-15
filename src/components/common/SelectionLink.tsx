import Link from "next/link";

import { Flag } from "@/components/common/Flag";
import { teamCodeFromName } from "@/data/iso2";
import { selectionPath } from "@/lib/selections";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  align?: "left" | "right";
  direction?: "row" | "column";
  flagSize?: "sm" | "md" | "lg" | "xl";
  className?: string;
  nameClassName?: string;
  showFlag?: boolean;
  truncateName?: boolean;
};

export function SelectionLink({
  name,
  align = "left",
  direction = "row",
  flagSize = "md",
  className,
  nameClassName,
  showFlag = true,
  truncateName = true,
}: Props) {
  return (
    <Link
      href={selectionPath(name)}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "inline-flex min-w-0 items-center gap-2 rounded-md transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        direction === "column" && "flex-col",
        direction === "row" && align === "right" && "flex-row-reverse text-right",
        direction === "column" && align === "right" && "text-right",
        className,
      )}
    >
      {showFlag ? (
        <Flag code={teamCodeFromName(name)} name={name} size={flagSize} static />
      ) : null}
      <span className={cn("min-w-0", truncateName && "truncate", nameClassName)}>{name}</span>
    </Link>
  );
}
