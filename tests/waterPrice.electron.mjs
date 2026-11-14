// Requer API real descartável e vazia em WATER_PRICE_TEST_API, npm run dev em 5173
// e Playwright instalado (ou PLAYWRIGHT_MODULE apontando para sua instalação).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const api = process.env.WATER_PRICE_TEST_API;
if (!api || api === 'http://localhost:8080') throw Error('Informe uma API descartável em WATER_PRICE_TEST_API; não use o banco operacional.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `water${Date.now()}`;
const password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers = { ...headers, Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` };
const client = await request('POST', '/clients', { name: `Cliente agua ${username}`, clientType: 'RETAIL', clientStatus: 'PAID' });
const reseller = await request('POST', '/clients', { name: `Revenda agua ${username}`, clientType: 'RESELLER', clientStatus: 'PAID' });
const water = await request('POST', '/products', { name: `Agua ${username}`, type: 'WATER', basePrice: 10, resellerPrice: 8 });
const secondWater = await request('POST', '/products', { name: `Outra agua ${username}`, type: 'WATER', basePrice: 12, resellerPrice: 9 });
await request('PATCH', `/stocks/products/${water.id}`, 100);
await request('PATCH', `/stocks/products/${secondWater.id}`, 100);
await request('POST', `/clients/${client.id}/prices`, { productId: water.id, customPrice: 9 });
const supplier = await request('POST', '/suppliers', { name: `Fornecedor ${username}` });
const gas = await request('POST', '/products', { name: `Gas ${username}`, type: 'GAS', basePrice: 100, lastCostPrice: 80, defaultSupplierId: supplier.id });
const profile = await mkdtemp(join(tmpdir(), 'vitalis-water-price-'));
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${profile}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow();
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
page.setDefaultTimeout(10000);
const price = () => page.getByLabel('Preço unitário da água no item 1', { exact: true });
async function openOrder(customer = client) {
  await page.goto('http://localhost:5173/#/orders');
  await page.getByRole('button', { name: /Novo Pedido/ }).click();
  await page.getByPlaceholder('Buscar cliente...').fill(customer.name);
  await page.getByRole('button').filter({ has: page.getByText(customer.name, { exact: true }) }).click();
  await page.locator('form tbody select').first().selectOption(water.id);
  await page.waitForFunction(expected => document.querySelector('input[aria-label="Preço unitário da água no item 1"]')?.placeholder === expected, customer.id === reseller.id ? '8.00' : '9.00');
}
async function save() {
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/orders'));
  await page.getByRole('button', { name: /Salvar Pedido/ }).click();
  const result = await response;
  assert.equal(result.status(), 201);
  const body = result.request().postDataJSON();
  const orders = await result.json();
  await page.getByRole('heading', { name: 'Novo Pedido', exact: true }).waitFor({ state: 'hidden' });
  return { body, orders };
}
try {
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  await openOrder();
  assert.equal(await price().getAttribute('placeholder'), '9.00');
  await price().fill('0');
  assert.equal(await price().evaluate(input => input.checkValidity()), false);
  await price().fill('-1');
  assert.equal(await price().evaluate(input => input.checkValidity()), false);
  await price().fill('6.50');
  await page.locator('form tbody input[inputmode=numeric]').first().fill('2');
  await page.locator('label').filter({ hasText: 'Registrar agora' }).locator('div').first().click();
  assert.equal(await page.getByPlaceholder('0,00', { exact: true }).inputValue(), '13.00');
  await price().fill('7');
  assert.equal(await page.getByPlaceholder('0,00', { exact: true }).inputValue(), '14.00');
  await page.getByRole('button', { name: 'Usar preço padrão', exact: true }).click();
  assert.equal(await price().inputValue(), '');
  assert.equal(await page.getByPlaceholder('0,00', { exact: true }).inputValue(), '18.00');
  await price().fill('6.50');
  // Fechar pelo cabeçalho salva o rascunho; reabrir deve preservar o combinado.
  await page.getByRole('heading', { name: 'Novo Pedido', exact: true }).locator('..').getByRole('button').click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('vitalis_order_draft')).items[0].waterUnitPrice), '6.50');
  await page.getByRole('button', { name: /Novo Pedido/ }).click();
  assert.equal(await price().inputValue(), '6.50');
  // A troca do produto deve descartar o preço negociado no produto anterior.
  await page.locator('form tbody select').first().selectOption(secondWater.id);
  assert.equal(await price().inputValue(), '');
  await page.locator('form tbody select').first().selectOption(water.id);
  await price().fill('6.50');
  const negotiated = await save();
  assert.equal(negotiated.body.items[0].unitPrice, 6.5);
  assert.equal(negotiated.body.initialPayments[0].amount, 13);
  assert.equal(negotiated.orders[0].items[0].unitPrice, 6.5);
  assert.equal(negotiated.orders[0].totalValue, 13);
  assert.equal((await request('GET', `/products/${water.id}`)).basePrice, 10);
  assert.equal((await request('GET', `/clients/${client.id}/prices`))[0].customPrice, 9);
  console.log('PASS preço combinado, total/pagamento, rascunho, troca de produto e cadastros preservados');

  // Edição no detalhe mantém o preço salvo e permite novo combinado.
  await page.goto(`http://localhost:5173/#/orders/${negotiated.orders[0].id}`);
  await page.getByRole('button', { name: /Editar/ }).click();
  await price().waitFor();
  assert.equal(await price().getAttribute('placeholder'), '6.50');
  await price().fill('5.50');
  const update = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/orders/${negotiated.orders[0].id}`));
  await page.getByRole('button', { name: /Salvar/ }).click();
  assert.equal((await update).status(), 200);
  assert.equal((await request('GET', `/orders/${negotiated.orders[0].id}`)).items[0].unitPrice, 5.5);

  // O outro modal de edição, aberto pela lista, usa o mesmo preço gravado.
  await page.goto('http://localhost:5173/#/orders');
  await page.locator('tbody tr').filter({ hasText: client.name }).getByTitle('Editar pedido', { exact: true }).first().click();
  assert.equal(await price().inputValue(), '5.5');
  await price().fill('4');
  await price().fill('');
  await page.waitForFunction(() => !document.querySelector('form select:invalid'));
  const [savedEdit] = await Promise.all([
    page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/orders/${negotiated.orders[0].id}`)),
    page.getByRole('button', { name: /Salvar Alterações/ }).click(),
  ]);
  assert.equal(savedEdit.status(), 200);
  assert.equal(savedEdit.request().postDataJSON().items[0].unitPrice, 5.5);

  // Sem valor manual, o preço fixo do cliente continua sendo resolvido no servidor.
  await openOrder();
  const automatic = await save();
  assert.equal('unitPrice' in automatic.body.items[0], false);
  assert.equal(automatic.orders[0].items[0].unitPrice, 9);
  await openOrder(reseller);
  assert.equal(await price().getAttribute('placeholder'), '8.00');
  await price().fill('5');
  const resale = await save();
  assert.equal(resale.orders[0].items[0].unitPrice, 5);

  await openOrder();
  await page.locator('form tbody select').first().selectOption(secondWater.id);
  await page.getByRole('button', { name: /Retirada pelo Cliente/ }).click();
  const config = await request('GET', '/config');
  assert.equal(await price().getAttribute('placeholder'), (12 - config.pickupDiscountCents / 100).toFixed(2));
  await price().fill('6.25');
  await page.locator('form').getByRole('button', { name: /Entrega$/ }).click();
  assert.equal(await price().inputValue(), '6.25');
  const pickup = await save();
  assert.equal(pickup.orders[0].items[0].unitPrice, 6.25);

  // Pedido misto continua em lista e o custo do gás permanece separado do preço da água.
  await openOrder();
  await price().fill('6');
  await page.getByRole('button', { name: /Adicionar Item/ }).click();
  await page.locator('form tbody tr').nth(1).locator('select').first().selectOption(gas.id);
  await page.getByPlaceholder('Custo', { exact: true }).fill('80');
  const mixed = await save();
  assert.equal(mixed.orders.length, 2);
  assert.equal(mixed.orders.flatMap(o => o.items).find(i => i.productId === water.id).unitPrice, 6);
  assert.equal(mixed.body.items.find(i => i.productId === gas.id).gasCostPrice, 80);
  console.log('PASS edição no detalhe, preço automático, revenda, pedido misto e custo do gás preservado');
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'vitalis-water-price-error.png') });
  console.error('Falha na rota', page.url());
  throw error;
} finally {
  await app.close();
}
