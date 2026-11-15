// Requires an empty disposable PostgreSQL API, never the operational database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.LOANS_TEST_API;
const web = 'http://localhost:5175';
if (api !== 'http://127.0.0.1:8084') throw Error('Use the disposable API on 127.0.0.1:8084.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `loan${Date.now()}`, password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Empréstimo', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const client = await request('POST', '/clients', { name: username, clientType: 'RETAIL', clientStatus: 'PAID' });
assert.equal((await request('GET', '/products')).totalElements, 0, 'Use an empty disposable API.');
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-generic-loans-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: web } });
const page = await app.firstWindow(); page.setDefaultTimeout(15000);
await page.waitForURL(`${web}/**`);
await page.waitForLoadState('domcontentloaded');
await page.setViewportSize({ width: 1440, height: 1000 });
await page.route('http://localhost:8080/**', async route => {
  const response = await route.fetch({ url: route.request().url().replace('http://localhost:8080', api), headers: { ...route.request().headers(), origin: 'http://localhost:5173' } });
  await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': web, 'access-control-allow-credentials': 'true' } });
});
const modal = () => page.locator('.fixed').filter({ has: page.locator('form') }).last();
try {
  await page.goto(web + '/#/login');
  await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.waitForURL('**/#/dashboard');
  await page.goto(web + '/#/bottles');
  await page.getByRole('button', { name: /Registrar Empréstimo/ }).click();
  await page.getByRole('heading', { name: 'Registrar Novo Empréstimo', exact: true }).waitFor();
  assert.equal(await modal().locator('select').count(), 1);
  assert.equal(await modal().locator('input[type=date]').count(), 0);
  await page.getByLabel('Cliente *', { exact: true }).selectOption(client.id);
  await page.getByLabel('Quantidade *', { exact: true }).fill('2');
  const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/bottles'));
  await page.getByRole('button', { name: 'Confirmar Empréstimo', exact: true }).click();
  const response = await created; assert.equal(response.status(), 201);
  assert.equal(Object.hasOwn(response.request().postDataJSON(), 'productId'), false);
  const loan = await response.json(); assert.equal(loan.productId, null); assert.ok(loan.loanDate);
  const storedLoanDate = (await request('GET', `/bottles/${loan.id}`)).loanDate;
  const row = page.locator('tbody tr').filter({ hasText: username });
  await row.getByText(/Garrafão$/).waitFor();
  await row.getByTitle('Editar empréstimo').click();
  await page.getByLabel('Quantidade *', { exact: true }).fill('3');
  const edited = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/bottles/${loan.id}`));
  await page.getByRole('button', { name: 'Salvar empréstimo', exact: true }).click(); assert.equal((await edited).status(), 200);
  assert.equal((await request('GET', `/bottles/${loan.id}`)).loanDate, storedLoanDate);
  await row.getByTitle('Registrar Devolução').click();
  await page.getByRole('button', { name: 'Confirmar Devolução', exact: true }).click();
  await row.waitFor({ state: 'hidden' });
  assert.equal((await request('GET', '/products')).totalElements, 0);

  const water = await request('POST', '/products', { name: `Água ${username}`, type: 'WATER', basePrice: 9, lastCostPrice: 5 });
  await request('PATCH', `/stocks/products/${water.id}`, 5);
  await page.goto(web + '/#/orders'); await page.getByRole('button', { name: /Novo Pedido/ }).click();
  await page.getByPlaceholder('Buscar cliente...').fill(username); await page.getByRole('button', { name: new RegExp(username) }).click();
  await modal().locator('tbody select').first().selectOption(water.id);
  await page.getByRole('button', { name: 'Registrar empréstimo', exact: true }).click();
  await page.getByLabel('Quantidade de garrafões emprestados', { exact: true }).fill('1');
  assert.equal(await page.getByText('Selecionar garrafão...', { exact: true }).count(), 0);
  const orderSaved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/orders'));
  const linkedLoan = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/bottles'));
  await page.getByRole('button', { name: /Salvar Pedido/ }).click();
  const ordersResponse = await orderSaved; assert.equal(ordersResponse.status(), 201);
  const loanResponse = await linkedLoan; assert.equal(loanResponse.status(), 201);
  const newLoan = await loanResponse.json(); assert.equal(newLoan.productId, null);
  assert.equal(newLoan.orderId, (await ordersResponse.json())[0].id);
  await page.goto(web + '/#/bottles');
  await page.locator('tbody tr').filter({ hasText: username }).getByText(/Garrafão$/).waitFor();
  await page.screenshot({ path: join(tmpdir(), 'vitalis-generic-loans.png') });
  console.log('PASS Electron + PostgreSQL: loan without any product, client/quantity only, automatic date, edit, return, generic display and loan linked to new order without choosing water.');
} catch (error) { await page.screenshot({ path: join(tmpdir(), 'vitalis-generic-loans-error.png') }).catch(() => undefined); throw error; }
finally { await app.close(); }
