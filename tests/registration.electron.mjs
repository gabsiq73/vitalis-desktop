// Execute com npm run dev e API local em execução. Usa apenas contas temporárias.
// PLAYWRIGHT_MODULE pode apontar para uma instalação existente de playwright.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const profile = await mkdtemp(join(tmpdir(), 'vitalis-issue22-'));
const app = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: ['.', `--user-data-dir=${profile}`], env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' } });
const page = await app.firstWindow();
page.setDefaultTimeout(10000);
// Opcional: encaminha o HTTP real a uma API isolada com banco vazio.
const apiTarget = process.env.REGISTRATION_TEST_API || 'http://localhost:8080';
if (apiTarget !== 'http://localhost:8080') {
  await page.route('http://localhost:8080/**', route => route.continue({ url: route.request().url().replace('http://localhost:8080', apiTarget) }));
}
const created = [];
const prefix = `qa22${Date.now()}`;
const password = randomUUID();
let operator;
async function fill(username, role = 'ADMIN', email = `${username}@example.com`) {
  await page.getByLabel('Nome *', { exact: true }).fill('Teste');
  await page.getByLabel('Username *', { exact: true }).fill(username);
  await page.getByLabel('Email *', { exact: true }).fill(email);
  await page.getByLabel('Senha *', { exact: true }).fill(password);
  await page.getByLabel('Confirmação de senha *', { exact: true }).fill(password);
  await page.getByRole('button', { name: role === 'ADMIN' ? 'Administrador' : 'Vendedor', exact: true }).click();
}
async function create(username, role, authenticated = false) {
  console.log(`Verificando cadastro ${authenticated ? 'autenticado' : 'público'} ${role}`);
  await fill(username, role);
  const [req, res] = await Promise.all([
    page.waitForRequest(r => r.method() === 'POST' && r.url().endsWith('/users')),
    page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/users')),
    page.getByRole('button', { name: authenticated ? 'Criar Usuário' : 'Criar conta', exact: true }).click(),
  ]);
  assert.equal(res.status(), 201);
  created.push(await res.json());
  assert.equal(req.postDataJSON().userRole, role);
  assert.equal('confirmation' in req.postDataJSON(), false);
  if (!authenticated) {
    assert.equal(req.headers().authorization, undefined);
    await page.waitForURL('**/#/login');
    assert.equal(await page.locator('#username').inputValue(), username);
    assert.equal(await page.locator('#password').inputValue(), '');
    assert.equal(await page.evaluate(() => localStorage.getItem('vitalis_auth')), null);
  }
}
try {
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/#/login');
  await page.getByRole('link', { name: 'Criar conta', exact: true }).click();
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  assert.match(await page.getByRole('alert').innerText(), /Nome/);
  await fill(prefix);
  await page.getByLabel('Confirmação de senha *', { exact: true }).fill('divergente');
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  assert.match(await page.getByRole('alert').innerText(), /confirmação/);
  let release;
  let reached;
  let posts = 0;
  const held = new Promise(resolve => { release = resolve; });
  const pending = new Promise(resolve => { reached = resolve; });
  const countPost = request => { if (request.method() === 'POST' && request.url().endsWith('/users')) posts++; };
  page.on('request', countPost);
  await page.route('**/users', async route => { reached(); await held; await route.fallback(); }, { times: 1 });
  const creating = create(prefix, 'ADMIN');
  await pending;
  assert.equal(await page.getByRole('button', { name: 'Salvando...', exact: true }).isDisabled(), true);
  await page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  release();
  await creating;
  assert.equal(posts, 1, 'envios simultâneos bloqueados');
  page.off('request', countPost);
  operator = prefix;
  if (process.env.REGISTRATION_EXPECT_EMPTY === '1') {
    const firstUsers = await fetch(`${apiTarget}/users`, { headers: { Authorization: `Basic ${Buffer.from(`${operator}:${password}`).toString('base64')}` } });
    assert.equal(firstUsers.status, 200);
    assert.equal((await firstUsers.json()).length, 1, 'primeira conta em banco vazio');
  }
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  const session = await page.evaluate(() => localStorage.getItem('vitalis_auth'));
  await page.goto('http://localhost:5173/#/users');
  await page.getByRole('button', { name: 'Novo Usuário', exact: true }).click();
  await create(`${prefix}b`, 'ADMIN', true);
  await page.getByText(`${prefix}b`, { exact: true }).waitFor();
  assert.ok(await page.evaluate(() => localStorage.getItem('vitalis_auth')) === session, 'sessão do operador preservada');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/#/register');
  await page.reload();
  await create(`${prefix}s`, 'SELLER');
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/#/register');
  await page.reload();
  for (const [username, email, expected] of [[prefix, `${prefix}new@example.com`, /usuário já cadastrado/], [`${prefix}new`, `${prefix}@example.com`, /Email já cadastrado/]]) {
    await fill(username, 'ADMIN', email);
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await page.getByRole('alert').waitFor();
    await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
    assert.match(await page.getByRole('alert').innerText(), expected);
    assert.equal(await page.getByLabel('Username *', { exact: true }).inputValue(), username);
    assert.match(page.url(), /register/);
  }
  await fill(`${prefix}invalid`);
  // Força uma rejeição real do backend para conferir o tratamento do 422.
  await page.route('**/users', async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    await route.fallback({ postData: JSON.stringify({ ...route.request().postDataJSON(), firstName: 'a' }) });
  }, { times: 1 });
  const invalidResponse = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/users'));
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  assert.equal((await invalidResponse).status(), 422);
  await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
  assert.ok((await page.getByRole('alert').innerText()).length > 0);
  assert.match(page.url(), /register/);
  await create(`${prefix}public`, 'ADMIN');
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL('**/#/dashboard');
  await page.evaluate(() => localStorage.clear());
  await page.goto('http://localhost:5173/#/register');
  await page.reload();
  await page.context().setOffline(true);
  await fill(`${prefix}offline`);
  await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[role=alert]')?.textContent.includes('API indisponível'));
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Voltar para login', exact: true }).click();
  await page.waitForURL('**/#/login');
  console.log('PASS Electron: validação, ADMIN público, ADMIN autenticado, SELLER, login, payload sem Authorization/confirmação, envio único, sessão preservada, duplicidades, 422, indisponibilidade e navegação.');
} catch (error) {
  console.error('Falha na rota:', page.url(), 'Mensagem:', await page.getByRole('alert').allTextContents());
  await page.screenshot({ path: '.issue22-error.local.png' });
  throw error;
} finally {
  await page.context().setOffline(false).catch(() => {});
  if (operator) {
    for (const user of [...created].reverse()) {
      const response = await fetch(`${apiTarget}/users/${user.id}`, { method: 'DELETE', headers: { Authorization: `Basic ${Buffer.from(`${operator}:${password}`).toString('base64')}` } });
      assert.equal(response.status, 204, 'limpeza da conta temporária');
    }
  }
  await app.close();
}
