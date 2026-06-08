export function normalizeListItemName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function formatListItemName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ');
}
