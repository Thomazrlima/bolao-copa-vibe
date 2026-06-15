const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NON_SLUG_CHARS = /[^a-z0-9]+/g;

export function selectionSlugFromName(name: string) {
  return name
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/&/g, " e ")
    .replace(NON_SLUG_CHARS, "-")
    .replace(/^-+|-+$/g, "");
}

export function selectionPath(name: string) {
  return `/selecoes/${selectionSlugFromName(name)}`;
}

export function resolveSelectionNameFromSlug(slug: string, names: string[]) {
  const normalizedSlug = decodeURIComponent(slug).toLowerCase();
  return names.find((name) => selectionSlugFromName(name) === normalizedSlug) ?? null;
}
