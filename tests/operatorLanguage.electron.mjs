// Requer npm run dev em 5173, Playwright e uma API real descartável em
// OPERATOR_LANGUAGE_TEST_API. Não executa sobre o banco operacional em 8080.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api = process.env.OPERATOR_LANGUAGE_TEST_API;
if (!api || api === 'http://localhost:8080') throw Error('Informe uma API descartável em OPERATOR_LANGUAGE_TEST_API.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username = `language${Date.now()}`;
const password = randomUUID();
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? undefined : response.json();
}
await request('POST', '/users', { firstName: 'Teste', username, email: `${username}@example.com`, password, userRole: 'ADMIN' });
headers = { ...headers, Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` };
await request('POST', '/users', { firstName: 'Teste', username: `${username}s`, email: `${username}s@example.com`, password, userRole: 'SELLER' });
const profile = await mkdtemp(join(tmpdir(), 'vitalis-operator-language-'));
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${profile}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow();
page.setDefaultTimeout(10000);
await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', api) }));
async function importFile(csv, entity) {
  await page.getByRole('button', { name: new RegExp(entity) }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'cadastros.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  const button = page.getByRole('button', { name: /Importar 2 Linha/ });
  await button.click();
  await page.getByText('2 registro(s) importado(s) com sucesso', { exact: true }).waitFor();
}
try {
  await page.goto('http://localhost:5173/#/login');
  await page.getByLabel('Usuário', { exact: true }).fill(username);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  await page.goto('http://localhost:5173/#/clients');
  await page.getByRole('button', { name: /Novo Cliente/ }).click();
  assert.equal(await page.locator('option[value=RETAIL]').innerText(), 'Varejo');
  assert.equal(await page.locator('option[value=RESELLER]').innerText(), 'Revenda');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.goto('http://localhost:5173/#/users');
  await page.getByText('Vendedor', { exact: true }).first().waitFor();
  assert.equal(await page.getByText('SELLER', { exact: true }).count(), 0);
  await page.goto('http://localhost:5173/#/cash-register');
  await page.getByRole('button', { name: 'Ajustar caixa', exact: true }).click();
  await page.getByText('Saldo do dia:', { exact: false }).waitFor();
  assert.equal(/\bAPI\b|finalBalance|CLIENT_CREDIT/.test(await page.locator('body').innerText()), false);
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.goto('http://localhost:5173/#/settings');
  await page.getByRole('button', { name: /Exportar \/ Importar/ }).click();
  await importFile(`nome,telefone,endereco,notas,tipo\n${username} varejo,11999999999,Rua de teste,Teste,Varejo\n${username} revenda,11988888888,Rua de teste,Teste,Revenda`, 'Clientes');
  const clients = (await request('GET', '/clients?size=100')).content;
  assert.equal(clients.find(c => c.name === `${username} varejo`).clientType, 'RETAIL');
  assert.equal(clients.find(c => c.name === `${username} revenda`).clientType, 'RESELLER');
  await importFile(`nome,preco_base,preco_custo,tipo\n${username} agua,12,,Água\n${username} gas,100,80,Gás`, 'Produtos');
  const products = (await request('GET', '/products?size=100')).content;
  assert.equal(products.find(p => p.name === `${username} agua`).type, 'WATER');
  assert.equal(products.find(p => p.name === `${username} gas`).type, 'GAS');
  const exportPath = join(profile, 'export.csv');
  await app.evaluate(({ session }, target) => {
    session.defaultSession.on('will-download', (_event, item) => item.setSavePath(target));
  }, exportPath);
  await page.getByRole('button', { name: /Exportar Tudo/ }).click();
  let csv = '';
  for (let attempt = 0; attempt < 100; attempt++) {
    try { csv = await readFile(exportPath, 'utf8'); if (csv) break; } catch { /* aguarda gravação pelo Electron */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(csv.includes('Varejo') && csv.includes('Revenda') && csv.includes('Água') && csv.includes('Gás'));
  assert.equal(/RETAIL|RESELLER|WATER/.test(csv), false);
  console.log('PASS Electron/API real: rótulos em português no login/clientes/usuários/caixa, importação de Varejo/Revenda/Água/Gás com contratos internos preservados e exportação em português.');
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'vitalis-operator-language-error.png') });
  throw error;
} finally {
  await app.close();
}
