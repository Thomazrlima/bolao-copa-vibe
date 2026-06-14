"use client";

import { useEffect, useMemo, useState } from "react";

import { formatLocalGameDateTime } from "@/lib/local-datetime";

type Props = {
  value: string;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
};

export function LocalDateTime({ value, options, className }: Props) {
  const optionsKey = JSON.stringify(options ?? null);
  const resolvedOptions = useMemo(
    () => (JSON.parse(optionsKey) as Intl.DateTimeFormatOptions | null) ?? undefined,
    [optionsKey],
  );
  const [label, setLabel] = useState(() => formatLocalGameDateTime(value, resolvedOptions));

  useEffect(() => {
    setLabel(formatLocalGameDateTime(value, resolvedOptions));
  }, [resolvedOptions, value]);

  return (
    <time className={className} dateTime={value} suppressHydrationWarning>
      {label}
    </time>
  );
}
