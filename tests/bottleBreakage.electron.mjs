// API real descartável, sem dados operacionais.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.BOTTLE_BREAKAGE_TEST_API;
if (api !== 'http://127.0.0.1:18090') throw Error('Use somente a API descartável de quebras em 127.0.0.1:18090.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `broken${Date.now()}`, password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const r = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  assert.ok(r.ok, `${method} ${path}: ${r.status} ${r.ok ? '' : await r.text()}`);
  return r.status === 204 ? undefined : r.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const a = await request('POST', '/products', { name: `Água A ${username}`, type: 'WATER', basePrice: 10, lastCostPrice: 5 });
const b = await request('POST', '/products', { name: `Água B ${username}`, type: 'WATER', basePrice: 9, lastCostPrice: 4 });
await request('PATCH', '/stocks/products/' + a.id, 5);
await request('PATCH', '/stocks/products/' + b.id, 2);
await request('PUT', '/bottle-inventory', { validQuantity: 12, expiredQuantity: 4 });
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-breakage-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow(); page.setDefaultTimeout(20000);
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
const inventory = page.getByRole('region', { name: 'Garrafões do depósito', exact: true });
async function total(value) {
  await inventory.getByText('Total de garrafões', { exact: true }).locator('..').getByText(String(value), { exact: true }).waitFor();
}
async function save(notes) {
  await page.getByLabel('Observação (opcional)', { exact: true }).fill(notes);
  const result = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/bottle-inventory/breakages'));
  await page.locator('form').getByRole('button', { name: 'Registrar quebra', exact: true }).click();
  const response = await result; assert.equal(response.status(), 201);
  const record = await response.json();
  await page.getByRole('heading', { name: 'Registrar quebra de garrafão', exact: true }).waitFor({ state: 'hidden' });
  await page.getByRole('cell', { name: notes, exact: true }).waitFor();
  return record;
}
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.waitForURL('**/#/dashboard');
  await page.evaluate(() => { location.hash = '/stock'; });
  await total(16);
  await page.getByRole('button', { name: 'Registrar quebra', exact: true }).click();
  await page.getByLabel('Tipo do garrafão', { exact: true }).selectOption('EXPIRED');
  await page.getByLabel('Quantidade quebrada', { exact: true }).fill('2');
  await save('Quebra de vencidos vazios'); await total(14);
  assert.equal((await request('GET', '/bottle-inventory')).expiredQuantity, 2);
  await page.getByRole('button', { name: 'Registrar quebra', exact: true }).click();
  await page.getByLabel('Quantidade quebrada', { exact: true }).fill('6');
  assert.equal(await page.getByLabel('Quantidade quebrada', { exact: true }).evaluate(el => el.checkValidity()), false);
  await page.getByLabel('Quantidade quebrada', { exact: true }).fill('3');
  await save('Quebra de válidos vazios'); await total(11);
  assert.equal((await request('GET', '/bottle-inventory')).filledQuantity, 7);
  await page.setViewportSize({ width: 1024, height: 640 });
  await page.getByRole('button', { name: 'Registrar quebra', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Garrafão cheio (baixar também a água)', exact: true }).check();
  await page.getByLabel('Água dos garrafões quebrados', { exact: true }).selectOption(a.id);
  await page.getByLabel('Quantidade quebrada', { exact: true }).fill('2');
  await page.screenshot({ path: join(tmpdir(), 'vitalis-breakage-modal-1024.png') });
  const record = await save('Quebra de válidos cheios'); await total(9);
  assert.equal(record.waterProductId, a.id); assert.equal(record.createdBy, username);
  const summary = await request('GET', '/bottle-inventory');
  assert.deepEqual([summary.validQuantity, summary.expiredQuantity, summary.filledQuantity, summary.emptyValidQuantity, summary.brokenValidQuantity, summary.brokenExpiredQuantity], [7, 2, 5, 2, 5, 2]);
  const stock = (await request('GET', '/stocks?size=100')).content;
  assert.equal(stock.find(s => s.productId === a.id).quantityInStock, 3);
  assert.equal(stock.find(s => s.productId === b.id).quantityInStock, 2);
  assert.equal((await request('GET', '/bottle-inventory/breakages')).totalElements, 3);
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const cash = await request('GET', '/reports/performance/daily?date=' + date);
  assert.equal(cash.totalInvoiced, 0); assert.equal(cash.totalReceived, 0);
  assert.equal(cash.cashBalance, 0); assert.equal(cash.pixBalance, 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.reload();
  await total(9); await page.getByRole('cell', { name: 'Quebra de válidos cheios', exact: true }).waitFor();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: join(tmpdir(), 'vitalis-breakage-stock-1440.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS Electron/API real: quebra vencida e válida, vazio/cheio com água escolhida, limites, totais 16 -> 14 -> 11 -> 9, histórico persiste, caixa sem alterações, 1440/1024.');
} catch (error) { await page.screenshot({ path: join(tmpdir(), 'vitalis-breakage-error.png') }); throw error; }
finally { await app.close(); }
