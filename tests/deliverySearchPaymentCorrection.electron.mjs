import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const api = process.env.DELIVERY_CHANGES_TEST_API;
if (!api || !/^http:\/\/127\.0\.0\.1:18093$/.test(api)) throw Error('Use a API descartável em DELIVERY_CHANGES_TEST_API=http://127.0.0.1:18093.');
const { _electron } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const name = `delivery${Date.now()}`;
const password = 'delivery-test-only';
let headers = { 'Content-Type': 'application/json' };
async function request(method, path, body) {
  const response = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  assert.ok(response.ok, `${method} ${path}: ${response.status} ${text}`);
  return text ? JSON.parse(text) : undefined;
}
await request('POST','/users',{ firstName:'Teste',username:name,email:`${name}@example.com`,password,userRole:'ADMIN' });
headers = { ...headers, Authorization:`Basic ${Buffer.from(`${name}:${password}`).toString('base64')}` };
const client = await request('POST','/clients',{ name:`João da Conceição ${name}`,clientType:'RETAIL',clientStatus:'PAID' });
const water = await request('POST','/products',{ name:`Água São José ${name}`,type:'WATER',basePrice:10 });
const other = await request('POST','/products',{ name:`Outra Água ${name}`,type:'WATER',basePrice:12 });
await request('PATCH',`/stocks/products/${water.id}`,50);
await request('PATCH',`/stocks/products/${other.id}`,50);
async function sale(product=water, paid=false) {
  return (await request('POST','/orders',{ clientId:client.id,isDelivery:true,items:[{productId:product.id,quantity:1}],
    ...(paid ? {initialPayments:[{amount:product.basePrice,paymentMethod:'PIX'}]} : {}) }))[0];
}
const order = await sale();
const paidOrder = await sale(water,true);
await sale(other);
const evidence = await mkdtemp(join(tmpdir(),'vitalis-delivery-evidence-'));
const app = await _electron.launch({ executablePath:createRequire(import.meta.url)('electron'),
  args:['.',`--user-data-dir=${await mkdtemp(join(tmpdir(),'vitalis-delivery-profile-'))}`],
  env:{...process.env,VITE_DEV_SERVER_URL:'http://localhost:5173'} });
const page = await app.firstWindow();
page.setDefaultTimeout(15000);
await page.setViewportSize({width:1440,height:1000});
await page.route('http://localhost:8080/**', route => route.continue({url:route.request().url().replace('http://localhost:8080',api)}));
async function screenshot(file) { await page.screenshot({path:join(evidence,file)}); }
async function detail(id) { await page.goto(`http://localhost:5173/#/orders/${id}`); await page.getByRole('heading',{name:'Resumo Financeiro'}).waitFor(); }
try {
  await page.goto('http://localhost:5173/#/login');
  await page.locator('#username').fill(name); await page.locator('#password').fill(password);
  await page.getByRole('button',{name:'Entrar',exact:true}).click(); await page.waitForURL('**/#/dashboard');
  await page.getByRole('link',{name:/Contas a receber/}).waitFor();
  await detail(order.id);
  await page.getByRole('button',{name:/Mover para Entregue/}).click();
  await page.getByLabel('Registrar empréstimo de vasilhame').check();
  await page.getByRole('spinbutton',{name:'Quantidade de vasilhames',exact:true}).fill('2');
  await page.getByRole('button',{name:'Registrar fiado',exact:true}).waitFor();
  await screenshot('payment-loan.png');
  await page.getByRole('button',{name:'Registrar fiado',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal((await request('GET',`/bottles/order/${order.id}`)).length,0);
  // Opening again starts a fresh choice; a partial payment keeps the loan selection.
  await page.getByRole('button',{name:/Mover para Entregue/}).click();
  await page.getByLabel('Registrar empréstimo de vasilhame').check();
  await page.getByRole('spinbutton',{name:'Quantidade de vasilhames',exact:true}).fill('2');
  // Pick the payment amount inside the payment fieldset, independently of the loan input.
  await page.locator('fieldset input[type=number]').first().fill('4');
  await page.getByRole('button',{name:'Confirmar Pagamento',exact:true}).click();
  await page.getByText(/Pagamento registrado. Restam/).waitFor();
  await page.getByRole('button',{name:'Registrar fiado',exact:true}).click();
  await screenshot('confirm-loan.png');
  await page.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
  await page.getByRole('heading',{name:'Confirmar entrega',exact:true}).waitFor({state:'hidden'});
  assert.equal((await request('GET',`/bottles/order/${order.id}`))[0].quantity,2);
  const balance = await request('GET',`/payments/orders/${order.id}/balance`);
  assert.equal(balance.totalPaid,4); assert.equal(balance.remainingBalance,6);

  // Paid orders still review the loan in the payment modal and never charge twice.
  await page.setViewportSize({width:1024,height:768});
  await detail(paidOrder.id);
  await page.getByRole('button',{name:/Mover para Entregue/}).click();
  await page.getByRole('heading',{name:'Registrar Pagamento',exact:true}).waitFor();
  await page.getByLabel('Registrar empréstimo de vasilhame').check();
  await page.getByRole('button',{name:'Continuar para entrega',exact:true}).waitFor();
  await screenshot('payment-paid-1024.png');
  await page.getByRole('button',{name:'Continuar para entrega',exact:true}).click();
  await page.getByRole('button',{name:'Confirmar entrega',exact:true}).click();
  await page.getByRole('button',{name:/Alterar forma de pagamento de/}).waitFor();
  assert.equal((await request('GET',`/payments/orders/${paidOrder.id}`)).length,1);
  assert.equal((await request('GET',`/bottles/order/${paidOrder.id}`))[0].quantity,1);
  await page.getByRole('button',{name:/Alterar forma de pagamento de/}).click();
  await page.getByRole('combobox',{name:'Forma de pagamento',exact:true}).selectOption('DINHEIRO');
  await screenshot('edit-paid-method.png');
  const detailCorrection = page.waitForResponse(r => r.request().method()==='PATCH' && r.url().includes('/payment-method'));
  await page.getByRole('button',{name:'Salvar correção',exact:true}).click();
  assert.equal((await detailCorrection).status(),200);
  await page.getByRole('heading',{name:'Alterar forma de pagamento',exact:true}).waitFor({state:'hidden'});
  assert.equal((await request('GET',`/payments/orders/${paidOrder.id}`))[0].paymentMethod,'DINHEIRO');
  assert.equal((await request('GET',`/orders/${paidOrder.id}`)).paymentStatus,'PAID');

  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://localhost:5173/#/cash-register');
  const cashButton = page.getByRole('button',{name:`Alterar forma de pagamento #${paidOrder.id.replaceAll('-','').slice(-6).toUpperCase()}`});
  await cashButton.waitFor(); await cashButton.click();
  await page.getByRole('combobox',{name:'Forma de pagamento',exact:true}).selectOption('PIX');
  const cashCorrection = page.waitForResponse(r => r.request().method()==='PATCH' && r.url().includes('/payment-method'));
  await page.getByRole('button',{name:'Salvar correção',exact:true}).click();
  assert.equal((await cashCorrection).status(),200);
  await page.getByRole('heading',{name:'Alterar forma de pagamento',exact:true}).waitFor({state:'hidden'});
  assert.equal((await request('GET',`/payments/orders/${paidOrder.id}`))[0].paymentMethod,'PIX');
  await screenshot('cash-corrected.png');
  await page.goto('http://localhost:5173/#/clients');
  const clientResponse = page.waitForResponse(r => r.request().method()==='GET' && r.url().includes('/clients?') && r.url().includes('name='));
  await page.getByPlaceholder('Buscar por nome...').fill(`J O A O D A C O N C E I C A O ${name}`);
  assert.equal((await (await clientResponse).json()).totalElements,1);
  await page.getByText(client.name,{exact:true}).waitFor();
  await screenshot('clients-search.png');
  await page.goto('http://localhost:5173/#/orders');
  await page.getByRole('button',{name:/Todos/}).first().click();
  const search = page.getByRole('searchbox',{name:/Pesquisar pedidos/});
  const [filteredResponse] = await Promise.all([
    page.waitForResponse(r => r.request().method()==='GET' && r.url().includes('/orders?') && r.url().includes('size=15') && r.url().includes('search=') && r.url().includes('productId=')),
    (async () => { await search.fill(`J O A O DA CONCEICAO ${name}`); await page.getByRole('combobox',{name:'Filtrar pedidos por produto'}).selectOption(water.id); })(),
  ]);
  const data = await filteredResponse.json();
  assert.equal(data.totalElements,2);
  await screenshot('orders-filter.png');
  await page.setViewportSize({width:1024,height:768}); await screenshot('orders-1024.png');
  await page.goto('http://localhost:5173/#/clients');
  const clientSearch=page.getByPlaceholder('Buscar por nome...');
  await clientSearch.fill(`JOAODACONCEICAO${name}`);
  await page.getByText(client.name,{exact:true}).waitFor();
  await page.goto('http://localhost:5173/#/debtors');
  await page.getByRole('heading',{name:'Contas a receber',exact:true}).waitFor();
  await screenshot('receivables.png');
  await writeFile(join(evidence,'result.json'),JSON.stringify({api,username:name,clientId:client.id,orderId:paidOrder.id,passed:true}));
  console.log(`PASS Electron/API real: empréstimos (parcial, fiado, pago, cancelamento), correção de PIX/Dinheiro no detalhe e no caixa, pesquisa e filtro de produto. Evidências: ${evidence}`);
} catch (error) { await screenshot('failure.png'); console.error(`Evidências: ${evidence}`); throw error; }
finally { await app.close(); }
