import test from 'node:test';
import assert from 'node:assert/strict';
import { closingTitle, formatClosingPercentage } from '../src/utils/closing.ts';
import { waitForApiReady } from '../src/utils/apiReadiness.ts';
import { buildCashMovement } from '../src/utils/cashMovement.ts';

test('closing formats percentages already computed by the API, including zero and negative margin', () => {
  assert.equal(formatClosingPercentage(null), '—');
  assert.equal(formatClosingPercentage(100), '100,00%');
  assert.equal(formatClosingPercentage(43.661643267), '43,66%');
  assert.equal(formatClosingPercentage(-12.5), '-12,50%');
  assert.equal(formatClosingPercentage(0), '0,00%');
  assert.equal(closingTitle(10, 2), 'Fechamento do mês outubro - 2 dias');
  assert.equal(closingTitle(1, 0), 'Fechamento do mês janeiro - 0 dias');
});
test('purchase/expense preserve selected method while old withdrawal requests remain compatible', () => {
  const input = { type: 'WITHDRAWAL', amount: 20, note: ' Gasolina ', occurredAt: '2026-10-01T10:00', direction: 'OUT' };
  assert.deepEqual(buildCashMovement({ ...input, withdrawalKind: 'DESPESA', paymentMethod: 'PIX' }), {
    type: 'WITHDRAWAL', amount: 20, note: 'Gasolina', occurredAt: input.occurredAt, withdrawalKind: 'DESPESA', paymentMethod: 'PIX',
  });
  assert.equal(buildCashMovement(input).paymentMethod, undefined);
});
test('readiness remains blocked through transient errors and only succeeds on health UP', async () => {
  let calls = 0;
  assert.equal(await waitForApiReady(async () => { if (++calls < 3) throw Error('starting'); return true; },
    { signal: new AbortController().signal, timeoutMs: 300, intervalMs: 1 }), true);
  assert.equal(calls, 3);
});
test('timeout bounds even a hung request and permits a subsequent retry', async () => {
  assert.equal(await waitForApiReady(() => new Promise(() => {}),
    { signal: new AbortController().signal, timeoutMs: 15, intervalMs: 1 }), false);
  assert.equal(await waitForApiReady(async () => true,
    { signal: new AbortController().signal, timeoutMs: 100 }), true);
});
test('unmount aborts readiness and prevents a stale attempt from succeeding', async () => {
  const controller = new AbortController();
  const pending = waitForApiReady(() => new Promise(() => {}), { signal: controller.signal });
  controller.abort();
  assert.equal(await pending, false);
  assert.equal(await waitForApiReady(async () => true, { signal: controller.signal }), false);
});
