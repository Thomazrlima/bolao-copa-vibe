type DateInput = string | number | Date;

const GAME_SOURCE_TIME_ZONE = "America/Sao_Paulo";

const DATE_KEY_FORMAT = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function toInstantDate(value: DateInput) {
  return value instanceof Date ? value : new Date(value);
}

function getTimeZoneOffsetMs(timeZone: string, date: Date) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );

  return asUtc - date.getTime();
}

function storedBrasiliaGameDateToInstant(value: DateInput) {
  if (value instanceof Date || typeof value === "number") return new Date(value);

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/,
  );
  if (!match) return new Date(value);

  const [, year, month, day, hour, minute, second = "00"] = match;
  const wallTimeAsUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const firstPassOffset = getTimeZoneOffsetMs(GAME_SOURCE_TIME_ZONE, new Date(wallTimeAsUtc));
  const firstPassInstant = wallTimeAsUtc - firstPassOffset;
  const finalOffset = getTimeZoneOffsetMs(GAME_SOURCE_TIME_ZONE, new Date(firstPassInstant));

  return new Date(wallTimeAsUtc - finalOffset);
}

export function localDateKey(value: DateInput) {
  const parts = DATE_KEY_FORMAT.formatToParts(storedBrasiliaGameDateToInstant(value)).reduce<
    Record<string, string>
  >((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localTodayKey() {
  const parts = DATE_KEY_FORMAT.formatToParts(new Date()).reduce<Record<string, string>>(
    (acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    },
    {},
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function localCalendarDate(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatLocalDateKey(
  key: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "2-digit",
    month: "long",
  },
) {
  return localCalendarDate(key).toLocaleDateString(undefined, options);
}

export function formatLocalGameDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  return storedBrasiliaGameDateToInstant(value).toLocaleString(undefined, options);
}

export function formatLocalGameTime(value: DateInput) {
  return storedBrasiliaGameDateToInstant(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatLocalShortDate(value: DateInput) {
  return storedBrasiliaGameDateToInstant(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
}

export function formatLocalDateTime(
  value: DateInput,
  options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  },
) {
  return toInstantDate(value).toLocaleString(undefined, options);
}

export function formatLocalTime(value: DateInput) {
  return toInstantDate(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
