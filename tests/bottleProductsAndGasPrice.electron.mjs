// UI against the disposable PostgreSQL API used by genericBottleLoans.electron.mjs.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.LOANS_TEST_API, web = 'http://localhost:5175';
if (api !== 'http://127.0.0.1:8084') throw Error('Use the disposable API on 127.0.0.1:8084.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `bottle${Date.now()}`, password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const r = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(r.ok, `${method} ${path}: ${r.status} ${await r.clone().text()}`);
  return r.status === 204 ? undefined : r.json();
}
await request('POST', '/users', { firstName: 'Garrafões', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const client = await request('POST', '/clients', { name: username, clientType: 'RETAIL', clientStatus: 'PAID' });
const water = await request('POST', '/products', { name: `Água ${username}`, type: 'WATER', basePrice: 9, lastCostPrice: 5 });
await request('PATCH', `/stocks/products/${water.id}`, 5);
const baseline = await request('GET', '/bottle-inventory');
await request('PUT', '/bottle-inventory', { validQuantity: Math.max(baseline.filledQuantity, baseline.validQuantity) + 10, expiredQuantity: baseline.expiredQuantity + 3 });
const initial = await request('GET', '/bottle-inventory');
const supplier = await request('POST', '/suppliers', { name: username });
const gas = await request('POST', '/products', { name: `Gás ${username}`, type: 'GAS', basePrice: 125, lastCostPrice: 110, defaultSupplierId: supplier.id });
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-bottle-skus-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: web } });
const page = await app.firstWindow(); page.setDefaultTimeout(15000);
await page.waitForURL(`${web}/**`); await page.waitForLoadState('domcontentloaded');
await page.setViewportSize({ width: 1440, height: 1050 });
await page.route('http://localhost:8080/**', async route => {
  const response = await route.fetch({ url: route.request().url().replace('http://localhost:8080', api), headers: { ...route.request().headers(), origin: 'http://localhost:5173' } });
  await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': web, 'access-control-allow-credentials': 'true' } });
});
const modal = () => page.locator('.fixed').filter({ has: page.locator('form') }).last();
try {
  await page.goto(web + '/#/login'); await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.waitForURL('**/#/dashboard');
  async function createProduct(typeLabel, price) {
    await page.getByRole('link', { name: /Produtos/ }).click(); await page.getByRole('button', { name: /Novo Produto/ }).click();
    await page.getByRole('heading', { name: 'Novo Produto', exact: true }).waitFor();
    await modal().getByRole('button', { name: new RegExp(typeLabel) }).click();
    await modal().getByPlaceholder('Ex: Botijão P13').fill(`${typeLabel} ${username}`);
    await modal().locator('input[type=number]').first().fill(String(price));
    const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/products'));
    await page.getByRole('button', { name: 'Criar Produto', exact: true }).click();
    const r = await saved; assert.equal(r.status(), 201); return r.json();
  }
  const full = await createProduct('Garrafão completo', 40);
  const expired = await createProduct('Garrafão vencido', 3);
  assert.equal(full.type, 'FULL_BOTTLE'); assert.equal(expired.type, 'EXPIRED_BOTTLE');
  async function newOrder(product) {
    await page.getByRole('link', { name: /Pedidos/ }).click(); await page.getByRole('button', { name: /Novo Pedido/ }).click();
    await page.getByPlaceholder('Buscar cliente...').fill(username); await page.getByRole('button', { name: new RegExp(username) }).click();
    await modal().locator('tbody select').first().selectOption(product.id);
  }
  async function saveOrder() {
    const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/orders'));
    await page.getByRole('button', { name: /Salvar Pedido/ }).click();
    const r = await saved; assert.equal(r.status(), 201); return { order: (await r.json())[0], body: r.request().postDataJSON() };
  }
  await newOrder(full);
  await page.getByLabel('Água do garrafão completo no item 1', { exact: true }).selectOption(water.id);
  const complete = await saveOrder(); assert.equal(complete.order.totalValue, 40); assert.equal(complete.order.items.length, 1);
  assert.equal(complete.order.items[0].waterProductId, water.id);
  await request('PATCH', `/orders/${complete.order.id}/confirm-delivery`);
  let inventory = await request('GET', '/bottle-inventory'); assert.equal(inventory.validQuantity, initial.validQuantity - 1); assert.equal(inventory.filledQuantity, initial.filledQuantity - 1);
  await page.goto(`${web}/#/orders/${complete.order.id}`); await page.getByText(new RegExp(`Garrafão completo.*${water.name}`)).waitFor();
  await page.screenshot({ path: join(tmpdir(), 'vitalis-full-bottle-product.png') });

  await newOrder(expired); assert.equal(await page.getByLabel('Água do garrafão completo no item 1', { exact: true }).count(), 0);
  const empty = await saveOrder(); assert.equal(empty.order.totalValue, 3);
  await request('PATCH', `/orders/${empty.order.id}/confirm-delivery`);
  inventory = await request('GET', '/bottle-inventory'); assert.equal(inventory.expiredQuantity, initial.expiredQuantity - 1); assert.equal(inventory.filledQuantity, initial.filledQuantity - 1);

  await newOrder(gas); assert.equal(await modal().getByPlaceholder('Custo', { exact: true }).count(), 0);
  await page.getByLabel('Preço unitário do gás no item 1', { exact: true }).fill('130');
  await page.screenshot({ path: join(tmpdir(), 'vitalis-gas-sale-price.png') });
  const gasSale = await saveOrder(); assert.equal(gasSale.order.totalValue, 130); assert.equal(gasSale.order.items[0].gasCostPrice, 110);
  assert.equal(Object.hasOwn(gasSale.body.items[0], 'gasCostPrice'), false); assert.equal(gasSale.body.items[0].unitPrice, 130);
  await request('PATCH', `/orders/${gasSale.order.id}/confirm-delivery`);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const settlement = (await request('GET', `/gas-settlements?start=${day}&end=${day}`)).find(s => s.orderItemId === gasSale.order.items[0].id);
  assert.equal(settlement.amount, 20);
  const catalog = await request('GET', `/products/${gas.id}`); assert.equal(catalog.basePrice, 125); assert.equal(catalog.lastCostPrice, 110);
  console.log('PASS Electron + PostgreSQL: register full/expired products, select water only for full bottle, correct stock reductions, no duplicate water charge, editable gas sale price, catalog cost unchanged and correct margin.');
} catch (error) { await page.screenshot({ path: join(tmpdir(), 'vitalis-bottle-products-error.png') }).catch(() => undefined); throw error; }
finally { await app.close(); }
