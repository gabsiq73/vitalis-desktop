// Use uma API descartável e vazia. Nunca use dados operacionais.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const api = process.env.CLOSING_TEST_API;
const web = process.env.CLOSING_TEST_WEB || 'http://localhost:5173';
if (!['http://127.0.0.1:8084', 'http://127.0.0.1:18087'].includes(api)) {
  throw Error('Use somente a API descartável de fechamento em 127.0.0.1:8084 ou 18087.');
}
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `closing${Date.now()}`, password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Fechamento', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
assert.deepEqual((await request('GET', '/reports/closing?year=2026&month=10')).days, [], 'A API deve estar vazia.');
const client = await request('POST', '/clients', { name: username, clientType: 'RETAIL', clientStatus: 'PAID' });
const water = await request('POST', '/products', { name: 'Água teste', type: 'WATER', basePrice: 10, lastCostPrice: 6 });
const supplier = await request('POST', '/suppliers', { name: username });
const gas = await request('POST', '/products', { name: 'Gás teste', type: 'GAS', basePrice: 120, lastCostPrice: 110, defaultSupplierId: supplier.id });
await request('PATCH', `/stocks/products/${water.id}`, 100);
async function sale(product, quantity, day) {
  const line = { productId: product.id, quantity, unitPrice: product.basePrice,
    ...(product.id === gas.id ? { gasCostPrice: 110, receivedByUs: false, supplierId: supplier.id } : {}) };
  const [order] = await request('POST', '/orders', { clientId: client.id, isDelivery: true, items: [line] });
  await request('PATCH', `/orders/${order.id}/confirm-delivery`);
  await request('PUT', `/orders/${order.id}/correction`, {
    clientId: client.id, isDelivery: true, deliveryDate: `2026-10-${String(day).padStart(2, '0')}T12:00:00`,
    items: [{ ...line, itemId: order.items[0].id }],
  });
  return order;
}
const unpaidWater = await sale(water, 10, 1);
await sale(gas, 1, 1);
await sale(water, 25, 2);
for (const [withdrawalKind, amount] of [['COMPRA', 40], ['DESPESA', 15], ['RETIRADA', 20]]) {
  await request('POST', '/cash-movements', { type: 'WITHDRAWAL', withdrawalKind, amount, paymentMethod: 'PIX', note: 'Teste de fechamento', occurredAt: '2026-10-01T12:00:00' });
}
let report = await request('GET', '/reports/closing?year=2026&month=10');
assert.deepEqual(report.days.map(d => [d.waterProfit, d.gasProfit, d.dailyBalance, d.accumulatedBalance]), [[100, 10, 35, 35], [250, 0, 250, 285]]);
await request('POST', '/payments', { orderId: unpaidWater.id, amount: 20, paymentMethod: 'PIX', paymentDate: '2026-10-05 12:00:00' });
assert.deepEqual(await request('GET', '/reports/closing?year=2026&month=10'), report, 'Receber fiado não repete nem redistribui a venda.');

const app = await _electron.launch({
  executablePath: createRequire(import.meta.url)('electron'),
  args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-closing-'))}`],
  env: { ...process.env, VITE_DEV_SERVER_URL: web },
});
const page = await app.firstWindow();
page.setDefaultTimeout(15000);
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
try {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(web + '/#/login');
  await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  await page.getByRole('link', { name: /Fechamento/ }).click();
  await page.getByLabel('Mês', { exact: true }).selectOption('10');
  await page.getByRole('heading', { name: 'Fechamento do mês outubro - 2 dias', exact: true }).waitFor();
  const first = page.locator('tbody tr').filter({ hasText: '01/10/2026' });
  for (const [index, value] of ['R$ 100,00', 'R$ 10,00', 'R$ 40,00', 'R$ 15,00', 'R$ 35,00', 'R$ 35,00', 'R$ 20,00'].entries()) {
    assert.equal((await first.locator('td').nth(index).innerText()).replace(/\s/g, ' '), value);
  }
  assert.match(await page.locator('tbody tr').filter({ hasText: '02/10/2026' }).innerText(), /285,00/);
  await page.getByText('As vendas entram na data da entrega concluída, inclusive fiadas.', { exact: false }).waitFor();
  await page.screenshot({ path: join(tmpdir(), 'vitalis-closing-sales.png') });
  await page.setViewportSize({ width: 1024, height: 640 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(tmpdir(), 'vitalis-closing-sales-1024.png') });
  await page.getByRole('link', { name: /Caixa do Dia/ }).click();
  await page.getByRole('button', { name: 'Registrar retirada', exact: true }).click();
  await page.getByRole('option', { name: 'Compra de água (boleto)', exact: true }).waitFor({ state: 'attached' });
  assert.equal(await page.getByRole('option', { name: /informativa/ }).count(), 0);
  await page.getByLabel('Tipo da saída', { exact: true }).selectOption('COMPRA');
  await page.getByLabel('Forma da saída', { exact: true }).selectOption('PIX');
  await page.getByLabel(/^Valor \(R\$\)/).fill('20');
  await page.getByLabel(/^Motivo/).fill('Boleto de água');
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/cash-movements'));
  await page.getByRole('button', { name: 'Registrar', exact: true }).click();
  assert.equal((await saved).status(), 201);
  report = await request('GET', '/reports/closing?year=2026&month=10');
  assert.equal(report.totals.accumulatedBalance, 285);
  console.log('PASS Electron + API real descartável: água 100, margem gás 10, compras 40, despesas 15, retirada 20, saldo 35, acumulado 285; fiado e recebimento posterior; registro de boleto PIX; layouts 1440/1024.');
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'vitalis-closing-sales-error.png') });
  throw error;
} finally { await app.close(); }
