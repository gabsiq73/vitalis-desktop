export function normalizeSearch(value?: string | null): string {
  return (value ?? '').normalize('NFD').replace(/\p{M}+/gu, '').replace(/\s+/g, '').toLowerCase();
}
