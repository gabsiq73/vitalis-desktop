// API real descartável e npm run dev. Não use a base operacional.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.ORDERS_DEBTS_TEST_API;
if (!api || api === 'http://localhost:8080') throw Error('Informe uma API descartável em ORDERS_DEBTS_TEST_API.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `lote${Date.now()}`;
const password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const client = await request('POST', '/clients', { name: username, clientType: 'RETAIL', clientStatus: 'PAID' });
const legacyClient = await request('POST', '/clients', { name: `${username} Caderno`, clientType: 'RETAIL', clientStatus: 'PAID' });
const product = await request('POST', '/products', { name: username, type: 'WATER', basePrice: 10 });
await request('PATCH', `/stocks/products/${product.id}`, 50);
const noteSearch = `Portão azul ${username}`;
const longNote = `${noteSearch} ${'Observação longa '.repeat(100)}`;
let target;
for (let index = 0; index < 18; index++) {
  const [order] = await request('POST', '/orders', { clientId: client.id, isDelivery: true, notes: index === 0 ? longNote : `Entrega ${index}`, items: [{ productId: product.id, quantity: 1 }] });
  if (!index) target = order;
}
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${await mkdtemp(join(tmpdir(), 'vitalis-orders-debts-'))}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow();
page.setDefaultTimeout(15000);
await page.setViewportSize({ width: 1440, height: 1000 });
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
try {
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(username);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  await page.goto('http://localhost:5173/#/orders');
  const search = page.getByRole('searchbox', { name: 'Pesquisar pedidos' });
  await search.fill(noteSearch);
  const note = page.locator('p[title]').filter({ hasText: noteSearch });
  await note.waitFor();
  assert.equal(await page.locator('tbody tr').count(), 1, 'busca encontra pedido fora da primeira página');
  assert.ok((await note.boundingBox()).height <= 65, 'observação longa mantém linha compacta');
  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok((await note.boundingBox()).width <= 240, 'observação não alarga a tabela');
    assert.ok(await page.getByTitle('Ver detalhes').isVisible());
  }
  await page.screenshot({ path: join(tmpdir(), 'vitalis-orders-observations.png') });
  await search.fill(`#${target.id.replaceAll('-', '').slice(-6).toUpperCase()}`);
  await note.waitFor();
  await page.waitForResponse(r => r.url().includes('/orders?') && r.url().includes('search=') && r.ok());
  assert.equal(await page.locator('tbody tr').count(), 1);
  await search.fill('inexistenteXYZ');
  await page.getByText('Nenhum pedido encontrado.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click();
  await page.locator('tbody tr').first().waitFor();
  await page.goto('http://localhost:5173/#/debtors');
  await page.getByRole('button', { name: 'Registrar fiado', exact: true }).click();
  await page.getByLabel(/^Cliente \*/).selectOption(legacyClient.id);
  await page.getByLabel('Valor em aberto (R$) *', { exact: true }).fill('75.50');
  await page.getByLabel('Data do fiado *', { exact: true }).fill('2020-01-01');
  await page.getByLabel('Observação (opcional)', { exact: true }).fill('Registro do caderno');
  const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/orders/manual-debts'));
  await page.getByRole('button', { name: 'Registrar fiado', exact: true }).last().click();
  const response = await created;
  assert.equal(response.status(), 201);
  const debt = await response.json();
  const debtor = page.locator('tbody tr').filter({ hasText: legacyClient.name });
  await debtor.waitFor();
  assert.ok((await debtor.innerText()).includes('75,50'));
  assert.equal(await request('GET', `/clients/${legacyClient.id}/outstanding-debt`), 75.5);
  assert.equal((await request('GET', `/payments/orders/${debt.id}`)).length, 0);
  assert.equal((await request('GET', `/orders?search=${legacyClient.name}`)).totalElements, 0);
  await page.screenshot({ path: join(tmpdir(), 'vitalis-manual-debt.png') });
  await debtor.getByTitle('Registrar pagamento').click();
  await page.getByText('Registrar Liquidação', { exact: true }).waitFor();
  await page.locator('input[type=number]').first().fill('25.50');
  await page.getByRole('button', { name: /Confirmar Liquidação/ }).click();
  await page.getByText('Pagamento registrado com sucesso!', { exact: true }).waitFor();
  assert.equal(await request('GET', `/clients/${legacyClient.id}/outstanding-debt`), 50);
  await page.goto(`http://localhost:5173/#/orders/${debt.id}`);
  await page.getByRole('heading', { name: 'Fiado antigo', exact: true }).waitFor();
  await page.getByText('Registro do caderno', { exact: true }).waitFor();
  console.log('PASS Electron/API real: busca entre páginas, número, vazio/limpeza, observações longas em 1440/1024, fiado antigo, dívida atualizada, pagamento parcial e detalhe.');
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'vitalis-orders-debts-error.png') });
  throw error;
} finally {
  await app.close();
}
