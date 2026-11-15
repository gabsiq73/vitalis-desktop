// Requer desktop em 5173 e API real descartável em GAS_OPERATIONS_TEST_API.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const api = process.env.GAS_OPERATIONS_TEST_API;
if (!api || api === 'http://localhost:8080') throw Error('Informe uma API descartável em GAS_OPERATIONS_TEST_API.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `gas${Date.now()}`, password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function response(method, path, body) {
  return fetch(`${api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function request(method, path, body) {
  const result = await response(method, path, body);
  assert.ok(result.ok, `${method} ${path}: ${result.status} ${result.ok ? '' : await result.text()}`);
  return result.status === 204 ? undefined : result.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const client = await request('POST', '/clients', { name: `Cliente ${username}`, clientType: 'RETAIL', clientStatus: 'PAID' });
const supplier = await request('POST', '/suppliers', { name: `Distribuidora ${username}` });
const gas = await request('POST', '/products', { name: `Gas correcao ${username}`, type: 'GAS', basePrice: 125, lastCostPrice: 110, defaultSupplierId: supplier.id });
const otherGas = await request('POST', '/products', { name: `Gas apagar ${username}`, type: 'GAS', basePrice: 125, lastCostPrice: 110, defaultSupplierId: supplier.id });
const water = await request('POST', '/products', { name: `Agua ${username}`, type: 'WATER', basePrice: 9 });
await request('PATCH', `/stocks/products/${water.id}`, 5);
async function order(product, receivedByUs = false, quantity = 1) {
  return (await request('POST', '/orders', { clientId: client.id, isDelivery: true, items: [{ productId: product.id, quantity, ...(product.type === 'GAS' ? { receivedByUs, ...(receivedByUs ? { gasPaymentMethod: 'PIX' } : {}) } : {}) }] }))[0];
}
const depotOrder = await order(gas, true, 2);
await request('PATCH', `/orders/${depotOrder.id}/confirm-delivery`);
const today = new Date().toLocaleDateString('en-CA');
const settlement = (await request('GET', `/gas-settlements?start=${today}&end=${today}`)).find(s => s.orderItemId === depotOrder.items[0].id);
assert.ok(settlement);
await request('PATCH', `/gas-settlements/${settlement.id}/settle?paymentMethod=PIX`);
const pendingOrder = await order(otherGas);
const waterOrder = await order(water);
await request('PATCH', `/orders/${waterOrder.id}/confirm-delivery`);
const initialFilled = (await request('GET', '/bottle-inventory')).filledQuantity;
const profile = await mkdtemp(join(tmpdir(), 'vitalis-gas-operations-'));
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${profile}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow();
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
page.setDefaultTimeout(15000);
try {
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  await page.goto('http://localhost:5173/#/gas-settlements');
  const row = page.getByRole('row').filter({ has: page.getByText(gas.name, { exact: true }) });
  await row.getByTitle('Editar acerto de gás', { exact: true }).click();
  await page.getByLabel('Preço de custo unitário (R$)', { exact: true }).fill('112');
  await page.getByLabel('Preço de venda unitário (R$)', { exact: true }).fill('138');
  assert.equal(await page.getByLabel('Acertado', { exact: true }).isChecked(), true);
  const save = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/gas-settlements/${settlement.id}`));
  await page.getByRole('button', { name: 'Salvar acerto', exact: true }).click();
  assert.equal((await save).status(), 200);
  await page.getByRole('heading', { name: 'Editar acerto de gás', exact: true }).waitFor({ state: 'hidden' });
  const updated = await request('GET', `/orders/${depotOrder.id}`);
  assert.equal(updated.totalValue, 276); assert.equal(updated.items[0].gasCostPrice, 112);
  assert.equal((await request('GET', `/gas-settlements/${settlement.id}`)).salePrice, 138);
  assert.equal((await request('GET', `/payments/orders/${depotOrder.id}`))[0].amount, 276);
  await row.getByTitle('Apagar acerto de gás', { exact: true }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  assert.equal((await response('GET', `/orders/${depotOrder.id}`)).status, 200);
  await row.getByTitle('Apagar acerto de gás', { exact: true }).click();
  await page.getByRole('button', { name: 'Apagar acerto e pedido', exact: true }).click();
  await page.getByRole('heading', { name: 'Apagar acerto de gás', exact: true }).waitFor({ state: 'hidden' });
  assert.equal((await response('GET', `/orders/${depotOrder.id}`)).status, 404);
  assert.equal((await response('GET', `/gas-settlements/${settlement.id}`)).status, 404);
  await page.goto(`http://localhost:5173/#/orders/${pendingOrder.id}`);
  await page.getByRole('button', { name: 'Apagar pedido', exact: true }).click();
  await page.getByRole('button', { name: 'Apagar pedido', exact: true }).last().click();
  await page.waitForURL('**/#/orders');
  assert.equal((await response('GET', `/orders/${pendingOrder.id}`)).status, 404);
  const idLabel = `#${waterOrder.id.replace(/-/g, '').slice(-6).toUpperCase()}`;
  const waterRow = page.getByRole('row').filter({ hasText: idLabel });
  await waterRow.getByTitle('Apagar pedido', { exact: true }).click();
  await page.getByRole('button', { name: 'Apagar pedido', exact: true }).click();
  await page.getByRole('heading', { name: 'Apagar pedido', exact: true }).waitFor({ state: 'hidden' });
  assert.equal((await response('GET', `/orders/${waterOrder.id}`)).status, 404);
  assert.equal((await request('GET', '/bottle-inventory')).filledQuantity, initialFilled + 1);
  console.log('PASS Electron: custo/venda em acerto liquidado, pedido/pagamento atualizados, cancelar exclusão, apagar acerto e pedido, apagar pelo detalhe e lista, recompor água.');
} finally { await app.close(); }
