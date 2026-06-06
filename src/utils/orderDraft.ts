export const ORDER_DRAFT_KEY = 'vitalis_order_draft';

export function hasOrderDraft(): boolean {
  try { return !!localStorage.getItem(ORDER_DRAFT_KEY); } catch { return false; }
}

export function clearOrderDraft(): void {
  try { localStorage.removeItem(ORDER_DRAFT_KEY); } catch { /* noop */ }
}
