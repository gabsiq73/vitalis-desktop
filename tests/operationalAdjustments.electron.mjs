// Requer API real descartável em 18092 e npm run dev. Nunca use dados operacionais.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.OPERATIONAL_ADJUSTMENTS_TEST_API;
if (api !== 'http://127.0.0.1:18092') throw Error('Informe a API descartável em OPERATIONAL_ADJUSTMENTS_TEST_API=http://127.0.0.1:18092.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `adjust${Date.now()}`, password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Validação', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const now = new Date();
const closingPath = `/reports/closing?year=${now.getFullYear()}&month=${now.getMonth() + 1}`;
const beforeClosing = await request('GET', closingPath);
const client = await request('POST', '/clients', { name: username, clientType: 'RETAIL', clientStatus: 'PAID' });
const water = await request('POST', '/products', { name: `Água ${username}`, type: 'WATER', basePrice: 10 });
const wrong = await request('POST', '/products', { name: `Erro ${username}`, type: 'WATER', basePrice: 20 });
const initialFilled = (await request('GET', '/bottle-inventory')).filledQuantity;
await request('PUT', '/bottle-inventory', { validQuantity: initialFilled + 10, expiredQuantity: 2 });
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-adjustments-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow(); page.setDefaultTimeout(20000);
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
const web = 'http://localhost:5173/#';
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${web}/login`);
  await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.waitForURL('**/#/dashboard');
  await page.goto(`${web}/products`);
  const row = page.locator('tbody tr').filter({ hasText: wrong.name });
  await row.getByTitle('Excluir', { exact: true }).click();
  let dialog = page.getByRole('dialog');
  const remove = dialog.getByRole('button', { name: 'Excluir', exact: true });
  assert.equal(await remove.isEnabled(), false);
  await dialog.getByRole('textbox').fill('excluir produto'); assert.equal(await remove.isEnabled(), false);
  await dialog.getByRole('textbox').fill('Excluir produto'); assert.equal(await remove.isEnabled(), true);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await row.getByTitle('Excluir', { exact: true }).click();
  dialog = page.getByRole('dialog'); assert.equal(await dialog.getByRole('button', { name: 'Excluir', exact: true }).isEnabled(), false);
  await dialog.getByRole('textbox').fill('Excluir produto');
  const deleted = page.waitForResponse(r => r.request().method() === 'DELETE' && r.url().endsWith(`/products/${wrong.id}`));
  await dialog.getByRole('button', { name: 'Excluir', exact: true }).click(); assert.equal((await deleted).status(), 204);
  await row.waitFor({ state: 'detached' });

  await page.goto(`${web}/stock`);
  await page.getByRole('button', { name: 'Registrar compra de garrafões', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Quantidade comprada', { exact: true }).fill('3');
  await dialog.getByRole('button', { name: 'Registrar compra', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
  assert.equal((await request('GET', '/bottle-inventory')).validQuantity, initialFilled + 13);
  await page.getByRole('button', { name: 'Registrar compra de garrafões', exact: true }).click();
  dialog = page.getByRole('dialog'); await dialog.getByLabel('Garrafões comprados', { exact: true }).selectOption('FILLED');
  await dialog.getByLabel('Água dos garrafões comprados', { exact: true }).selectOption(water.id);
  await dialog.getByLabel('Quantidade comprada', { exact: true }).fill('4');
  await dialog.getByLabel('Observação (opcional)', { exact: true }).fill('Compra de cheios');
  await dialog.getByRole('button', { name: 'Registrar compra', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
  let inventory = await request('GET', '/bottle-inventory');
  assert.deepEqual([inventory.validQuantity, inventory.filledQuantity, inventory.emptyValidQuantity, inventory.totalQuantity], [initialFilled + 17, initialFilled + 4, 13, initialFilled + 19]);
  await page.getByRole('region', { name: 'Compras de garrafões', exact: true }).getByText('Compra de cheios').first().waitFor();
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: join(tmpdir(), `vitalis-adjustments-stock-${width}.png`) });
  }

  await page.goto(`${web}/debtors`); await page.getByRole('button', { name: 'Registrar fiado', exact: true }).click();
  dialog = page.getByRole('dialog'); await dialog.getByLabel(/^Cliente/).selectOption(client.id);
  await dialog.getByLabel('Valor em aberto (R$) *', { exact: true }).fill('100');
  await dialog.getByLabel('Data do fiado *', { exact: true }).fill('2020-01-01');
  const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/orders/manual-debts'));
  await dialog.getByRole('button', { name: 'Registrar fiado', exact: true }).click(); const debt = await (await created).json();
  await request('POST', `/payments/bulk/${client.id}?amount=40&method=PIX`);
  await page.goto(`${web}/orders/${debt.id}`);
  await page.getByRole('button', { name: 'Editar fiado', exact: true }).click(); dialog = page.getByRole('dialog');
  assert.equal(await dialog.getByLabel(/^Cliente/).isDisabled(), true);
  await dialog.getByLabel('Valor total do fiado (R$) *', { exact: true }).fill('25');
  await dialog.getByRole('button', { name: 'Salvar fiado', exact: true }).click(); await dialog.waitFor({ state: 'detached' });
  assert.equal((await request('GET', `/clients/${client.id}`)).balance, 15);
  assert.equal((await request('GET', `/orders/${debt.id}`)).paymentStatus, 'PAID');
  await page.getByRole('button', { name: 'Editar fiado', exact: true }).waitFor();
  await page.screenshot({ path: join(tmpdir(), 'vitalis-adjustments-debt.png') });

  const [order] = await request('POST', '/orders', { clientId: client.id, isDelivery: true, items: [{ productId: water.id, quantity: 1 }] });
  await request('PATCH', `/orders/${order.id}/confirm-delivery`);
  for (const [withdrawalKind, amount] of [['COMPRA', 2], ['DESPESA', 1], ['RETIRADA', 50]])
    await request('POST', '/cash-movements', { type: 'WITHDRAWAL', withdrawalKind, amount, paymentMethod: 'DINHEIRO', occurredAt: new Date().toLocaleDateString('en-CA') + 'T12:00:00', note: 'Fechamento' });
  const report = await request('GET', closingPath);
  assert.equal(report.totals.withdrawals - beforeClosing.totals.withdrawals, 50);
  assert.equal(report.totals.dailyBalance - beforeClosing.totals.dailyBalance, 7);
  assert.equal(report.totals.accumulatedBalance - beforeClosing.totals.accumulatedBalance, 7);
  await page.goto(`${web}/closing`);
  await page.getByRole('heading', { name: /Fechamento do mês/ }).waitFor();
  const closingRow = page.getByRole('region', { name: 'Movimento diário do fechamento', exact: true }).locator('tbody tr').first();
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value).replace(/\s/g, ' ');
  assert.equal((await closingRow.locator('td').nth(4).innerText()).replace(/\s/g, ' '), money(report.days[0].withdrawals));
  assert.equal((await closingRow.locator('td').nth(5).innerText()).replace(/\s/g, ' '), money(report.days[0].dailyBalance));
  await page.screenshot({ path: join(tmpdir(), 'vitalis-adjustments-closing.png') });
  console.log('PASS Electron + API real H2: exclusão confirmada por texto e cancelamento; compras vazias/cheias e histórico; edição de fiado parcial com excedente; retirada demonstrativa; layouts 1440/1024.');
} catch (error) { await page.screenshot({ path: join(tmpdir(), 'vitalis-adjustments-error.png') }); throw error; }
finally { await app.close(); }
