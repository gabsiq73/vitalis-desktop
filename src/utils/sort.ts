import type { SortState } from '../components/SortableHeader';

export function applySortInMemory<T>(data: T[], sort: SortState | null): T[] {
  if (!sort) return data;
  return [...data].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sort.field];
    const bv = (b as Record<string, unknown>)[sort.field];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    let cmp: number;
    if (typeof av === 'string' && typeof bv === 'string') {
      cmp = av.localeCompare(bv, 'pt-BR');
    } else {
      cmp = av < bv ? -1 : av > bv ? 1 : 0;
    }
    return sort.dir === 'asc' ? cmp : -cmp;
  });
}
