export const ORDER_DRAFT_KEY = 'vitalis_order_draft';

export function restoreOrderDraftItems<T extends { unitPrice?: number }>(
  items: (T & { useBonus?: boolean; isBonus?: boolean })[],
): { items: T[]; needsReview: boolean } {
  let needsReview = false;
  const restored = items.map((item) => {
    const result = { ...item };
    if (item.useBonus || item.isBonus) {
      needsReview = true;
      delete result.unitPrice;
    }
    delete result.useBonus;
    delete result.isBonus;
    return result;
  });
  return { items: restored, needsReview };
}

export function hasOrderDraft(): boolean {
  try { return !!localStorage.getItem(ORDER_DRAFT_KEY); } catch { return false; }
}

export function clearOrderDraft(): void {
  try { localStorage.removeItem(ORDER_DRAFT_KEY); } catch { /* noop */ }
}
