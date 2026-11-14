// Requer npm run dev, Playwright e API real descartável, sem dados operacionais.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.CASH_METHODS_TEST_API;
if (!api || api === 'http://localhost:8080') throw Error('Informe uma API descartável em CASH_METHODS_TEST_API.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `cash${Date.now()}`;
const password = randomUUID();
const day = new Date().toLocaleDateString('en-CA');
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const client = await request('POST', '/clients', { name: `João da Conceição ${username}`, clientType: 'RETAIL', clientStatus: 'PAID' });
const supplier = await request('POST', '/suppliers', { name: `Gás ${username}` });
const product = await request('POST', '/products', { name: `Gás ${username}`, type: 'GAS', basePrice: 100, lastCostPrice: 60, defaultSupplierId: supplier.id });
const base = await request('GET', `/reports/performance/daily?date=${day}`);
await request('POST', `/payments/bulk/${client.id}?amount=200&method=PIX`);
await request('POST', `/payments/bulk/${client.id}?amount=100&method=DINHEIRO`);
async function gas(receivedByUs, quantity = 1) {
  const [order] = await request('POST', '/orders', { clientId: client.id, isDelivery: true, items: [{ productId: product.id, quantity, gasCostPrice: 60, receivedByUs, ...(receivedByUs ? { gasPaymentMethod: 'PIX' } : {}) }] });
  await request('PATCH', `/orders/${order.id}/confirm-delivery`);
  return order;
}
const outgoing = await gas(true, 2);
const incoming = await gas(false);
const all = await request('GET', `/gas-settlements?start=${day}&end=${day}`);
const outgoingSettlement = all.find(s => outgoing.items.some(i => i.id === s.orderItemId));
const incomingSettlement = all.find(s => incoming.items.some(i => i.id === s.orderItemId));
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-cash-methods-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow();
page.setDefaultTimeout(15000);
await page.setViewportSize({ width: 1440, height: 1100 });
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
async function checkBalances(cash, pix) {
  const report = await request('GET', `/reports/performance/daily?date=${day}`);
  assert.equal(report.cashBalance - base.cashBalance, cash);
  assert.equal(report.pixBalance - base.pixBalance, pix);
  return report;
}
try {
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(username); await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await page.waitForURL('**/#/dashboard');
  await page.goto('http://localhost:5173/#/clients');
  await page.getByPlaceholder('Buscar por nome...').fill(`joao da conceicao ${username}`);
  await page.locator('tbody tr').filter({ hasText: client.name }).waitFor();
  await page.goto('http://localhost:5173/#/orders');
  await page.getByRole('button', { name: /Novo Pedido/ }).click();
  await page.getByPlaceholder('Buscar cliente...').fill(`JOAO DA CONCEICAO ${username}`);
  await page.getByRole('button', { name: new RegExp(client.name) }).click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.goto('http://localhost:5173/#/gas-settlements');
  async function settle(id, method) {
    const settlement = all.find(s => s.id === id);
    const rows = page.locator('tbody tr');
    const index = all.findIndex(s => s.id === settlement.id);
    await rows.nth(index).getByTitle('Marcar como acertado').click();
    await page.getByRole('heading', { name: 'Confirmar acerto de gás', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Confirmar acerto', exact: true }).isDisabled(), true);
    await page.getByLabel(/^Meio do acerto/).selectOption(method);
    const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes(`/gas-settlements/${id}/settle`));
    await page.getByRole('button', { name: 'Confirmar acerto', exact: true }).click(); assert.equal((await saved).status(), 204);
    await page.getByRole('heading', { name: 'Confirmar acerto de gás', exact: true }).waitFor({ state: 'hidden' });
    await rows.nth(index).getByText(method === 'PIX' ? 'PIX' : 'Dinheiro', { exact: true }).waitFor();
  }
  await checkBalances(100, 400);
  await settle(outgoingSettlement.id, 'PIX'); await checkBalances(100, 280);
  await settle(incomingSettlement.id, 'DINHEIRO'); await checkBalances(140, 280);
  await page.screenshot({ path: join(tmpdir(), 'vitalis-gas-methods.png') });
  await page.goto('http://localhost:5173/#/cash-register');
  await page.getByText('Saldo do PIX', { exact: true }).waitFor();
  const dailySales = await checkBalances(140, 280);
  assert.equal(dailySales.depotDeliveredSales - base.depotDeliveredSales, 200);
  assert.equal(dailySales.totalInvoiced - base.totalInvoiced, 300);
  const salesCard = page.getByText('Vendas entregues (valor bruto)', { exact: true }).locator('..');
  const displayedSales = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dailySales.depotDeliveredSales);
  await salesCard.getByText(displayedSales, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Registrar retirada', exact: true }).click();
  await page.getByLabel(/^Valor \(R\$\)/).fill('10');
  await page.getByLabel(/^Motivo/).fill('Troco para trabalhar');
  const withdrawn = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/cash-movements'));
  await page.getByRole('button', { name: 'Registrar', exact: true }).click();
  assert.equal((await withdrawn).status(), 201);
  await checkBalances(130, 280);
  await page.getByRole('button', { name: 'Ajustar caixa', exact: true }).click();
  const report = await checkBalances(130, 280);
  await page.getByLabel(/^Valor conferido/).fill(String(report.cashBalance));
  await page.getByText(/Sem lançamento necessário/).waitFor();
  await page.getByRole('button', { name: 'Concluir conferência', exact: true }).click();
  await page.getByRole('heading', { name: 'Ajustar caixa', exact: true }).waitFor({ state: 'hidden' });
  await checkBalances(130, 280);
  await page.getByText('Saldo do Caixa', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), 'vitalis-cash-methods.png') });
  await gas(true); await gas(false);
  await page.goto('http://localhost:5173/#/gas-settlements');
  await page.locator('div.flex.items-center.gap-3.p-3').filter({ hasText: supplier.name }).getByRole('button', { name: /Acertar Tudo/ }).click();
  await page.getByLabel(/^Meio do acerto/).selectOption('PIX');
  const bulk = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/gas-settlements/bulk-settle'));
  await page.getByRole('button', { name: 'Confirmar acerto', exact: true }).click();
  assert.equal((await bulk).status(), 204); await checkBalances(130, 360);
  console.log('PASS Electron/API real: busca sem acentos em Clientes e Novo Pedido, escolha obrigatória de meio, repasse PIX, comissão em dinheiro, retirada e conferência apenas de dinheiro e acerto em lote por PIX.');
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'vitalis-cash-methods-error.png') }); throw error;
} finally { await app.close(); }
