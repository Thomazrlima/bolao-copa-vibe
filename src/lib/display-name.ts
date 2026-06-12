const NAME_CONNECTORS = new Set(["de", "do", "da", "dos", "das", "e"]);

export function getDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 2) return parts.join(" ");

  if (NAME_CONNECTORS.has(parts[1].toLocaleLowerCase("pt-BR"))) {
    return parts.slice(0, 3).join(" ");
  }

  return parts.slice(0, 2).join(" ");
}

export function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((part) => part && !NAME_CONNECTORS.has(part.toLocaleLowerCase("pt-BR")));

  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}
