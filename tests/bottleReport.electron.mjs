// Run only against the disposable API on port 18091.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.BOTTLE_REPORT_TEST_API;
if (api !== 'http://127.0.0.1:18091') throw Error('Use disposable API at 127.0.0.1:18091.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `report${Date.now()}`, password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${response.ok ? '' : await response.text()}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const client = await request('POST', '/clients', { name: username, clientType: 'RETAIL', clientStatus: 'PAID' });
const water = await request('POST', '/products', { name: `Água ${username}`, type: 'WATER', basePrice: 10 });
const full = await request('POST', '/products', { name: `Completo ${username}`, type: 'FULL_BOTTLE', basePrice: 40 });
await request('PATCH', '/stocks/products/' + water.id, 20);
await request('PUT', '/bottle-inventory', { validQuantity: 40, expiredQuantity: 10 });
const [order] = await request('POST', '/orders', { clientId: client.id, isDelivery: true, items: [{ productId: full.id, waterProductId: water.id, quantity: 3, unitPrice: 40 }] });
await request('PATCH', `/orders/${order.id}/confirm-delivery`);
await request('POST', '/bottle-inventory/breakages', { validity: 'VALID', quantity: 2 });
await request('POST', '/bottle-inventory/breakages', { validity: 'EXPIRED', quantity: 1 });
const old = new Date(); old.setDate(old.getDate() - 15);
const localDate = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
await request('POST', '/bottle-inventory/breakages', { validity: 'VALID', quantity: 4, occurredAt: `${localDate(old)}T12:00:00` });
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-bottle-report-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow(); page.setDefaultTimeout(20000);
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
const card = page.getByRole('region', { name: 'Garrafões no período', exact: true });
async function numbers(sold, broken) {
  await card.getByText('Garrafões completos vendidos', { exact: true }).locator('..').getByText(String(sold), { exact: true }).waitFor();
  await card.getByText('Garrafões quebrados', { exact: true }).locator('..').getByText(String(broken), { exact: true }).waitFor();
}
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.waitForURL('**/#/dashboard');
  await page.goto('http://localhost:5173/#/reports');
  await numbers(3, 7); await card.getByText('Válidos: 6 · Vencidos: 1', { exact: true }).waitFor();
  await page.screenshot({ path: join(tmpdir(), 'vitalis-bottle-report-1440.png'), fullPage: true });
  await page.getByRole('button', { name: '7 dias', exact: true }).click(); await numbers(3, 3);
  await card.getByText('Válidos: 2 · Vencidos: 1', { exact: true }).waitFor();
  await page.getByRole('button', { name: '90 dias', exact: true }).click(); await numbers(3, 7);
  await request('DELETE', `/orders/${order.id}`);
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click(); await numbers(0, 7);
  await page.setViewportSize({ width: 1024, height: 640 });
  await card.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: join(tmpdir(), 'vitalis-bottle-report-1024.png') });
  await page.route('**/reports/bottles?*', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Falha de teste' }) }));
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await card.getByRole('alert').waitFor(); assert.equal(await card.getByText('Indisponível', { exact: true }).count(), 2);
  await page.unroute('**/reports/bottles?*');
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click(); await numbers(0, 7);
  assert.deepEqual(errors, []);
  console.log('PASS: real API and Electron, quantities, period 7/30/90, cancellation, refresh, error/recovery, 1440/1024 layouts.');
} catch (error) {
  console.error('Page at failure:', page.url());
  await page.screenshot({ path: join(tmpdir(), 'vitalis-bottle-report-error.png') });
  throw error;
} finally { await app.close(); }
