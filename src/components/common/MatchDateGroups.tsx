import { Fragment, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { formatLocalDateKey, localDateKey, localTodayKey } from "@/lib/local-datetime";

type DatedItem = {
  data: string;
};

export function MatchDateGroups<T extends DatedItem>({
  items,
  direction = "asc",
  getKey,
  isLive = () => false,
  layout = "stacked",
  renderItem,
}: {
  items: T[];
  direction?: "asc" | "desc";
  getKey: (item: T) => string;
  isLive?: (item: T) => boolean;
  layout?: "stacked" | "responsive-row";
  renderItem: (item: T) => ReactNode;
}) {
  const multiplier = direction === "asc" ? 1 : -1;
  const groups = new Map<string, T[]>();

  items.forEach((item) => {
    const date = localDateKey(item.data);
    const current = groups.get(date) ?? [];
    current.push(item);
    groups.set(date, current);
  });

  const dates = [...groups.entries()]
    .sort(([dateA], [dateB]) => multiplier * dateA.localeCompare(dateB))
    .map(([date, dateItems]) => ({
      date,
      items: dateItems.sort((itemA, itemB) => multiplier * itemA.data.localeCompare(itemB.data)),
    }));

  return (
    <div
      className={cn(
        "space-y-8",
        layout === "responsive-row" &&
          "lg:grid lg:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] lg:gap-4 lg:space-y-0",
      )}
    >
      {dates.map(({ date, items: dateItems }) => {
        const isToday = date === localTodayKey();
        const liveCount = dateItems.filter(isLive).length;

        return (
          <section key={date} className={cn(layout === "responsive-row" && "lg:min-w-0")}>
            <div className="mb-3 flex items-center gap-3">
              <span
                className={cn(
                  "grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-xs font-black",
                  liveCount
                    ? "border-live/50 bg-live/15 text-live"
                    : isToday
                      ? "border-primary/50 bg-primary text-primary-foreground"
                      : "border-border bg-card text-primary",
                )}
              >
                {date.slice(-2)}
              </span>
              <div>
                <h3 className="font-display text-base font-black capitalize sm:text-lg">
                  {formatLocalDateKey(date)}
                </h3>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {liveCount ? `${liveCount} ao vivo · ` : ""}
                  {dateItems.length} jogo{dateItems.length === 1 ? "" : "s"}
                </p>
              </div>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className={cn("grid gap-3", layout === "stacked" && "lg:grid-cols-2")}>
              {dateItems.map((item) => (
                <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
