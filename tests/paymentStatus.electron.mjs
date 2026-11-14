// Requer npm run dev em 5173, Playwright (ou PLAYWRIGHT_MODULE) e uma API real
// descartável em PAYMENT_STATUS_TEST_API. Cria dados somente nessa API.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.PAYMENT_STATUS_TEST_API;
if (!api || api === 'http://localhost:8080') throw Error('Informe uma API descartável em PAYMENT_STATUS_TEST_API.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `payment${Date.now()}`;
const password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers = { ...headers, Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` };
const client = await request('POST', '/clients', { name: username, clientType: 'RETAIL', clientStatus: 'PAID' });
const product = await request('POST', '/products', { name: username, type: 'WATER', basePrice: 10 });
await request('PATCH', `/stocks/products/${product.id}`, 20);
const [order] = await request('POST', '/orders', { clientId: client.id, isDelivery: true, items: [{ productId: product.id, quantity: 1 }] });
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-payment-status-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow();
page.setDefaultTimeout(10000);
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
async function checkRoute(route, label) {
  await page.goto(`http://localhost:5173/#${route}`);
  await page.getByText(label, { exact: true }).first().waitFor();
  const wrong = label === 'Fiado' ? 'Aguardando' : 'Fiado';
  if (route.startsWith('/orders/')) assert.equal(await page.getByText(wrong, { exact: true }).count(), 0, `${route}: sem ${wrong}`);
}
try {
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  for (const route of ['/dashboard', '/orders', '/reports', `/orders/${order.id}`]) await checkRoute(route, 'Aguardando');
  await page.getByRole('button', { name: /Mover para Entregue/ }).click();
  await page.getByRole('button', { name: 'Registrar fiado', exact: true }).click();
  await page.getByRole('heading', { name: 'Confirmar entrega', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByText('Aguardando', { exact: true }).waitFor();
  assert.equal((await request('GET', `/orders/${order.id}`)).status, 'PENDING');
  // A escolha de fiado sozinha não muda o rótulo nem registra recebimento.
  assert.equal((await request('GET', `/payments/orders/${order.id}/balance`)).totalPaid, 0);
  await page.getByRole('button', { name: /Mover para Entregue/ }).click();
  await page.getByRole('button', { name: 'Registrar fiado', exact: true }).click();
  const delivery = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith(`/orders/${order.id}/confirm-delivery`));
  await page.getByRole('button', { name: 'Confirmar entrega', exact: true }).click();
  assert.equal((await delivery).status(), 204);
  await page.getByText('Fiado', { exact: true }).waitFor();
  for (const route of ['/dashboard', '/orders', '/reports', `/orders/${order.id}`]) await checkRoute(route, 'Fiado');
  const balance = await request('GET', `/payments/orders/${order.id}/balance`);
  assert.equal(balance.totalPaid, 0);
  assert.equal(balance.remainingBalance, 10);
  console.log('PASS Electron/API real: Aguardando antes da entrega; cancelar após Registrar fiado mantém Aguardando; confirmar entrega muda para Fiado no detalhe, lista, Dashboard e Relatórios, sem entrada financeira.');
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'vitalis-payment-status-error.png') });
  throw error;
} finally {
  await app.close();
}
