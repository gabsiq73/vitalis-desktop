import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const api=process.env.OPERATION_CORRECTIONS_TEST_API;
if (!api || api==='http://localhost:8080') throw Error('Informe uma API descartável em OPERATION_CORRECTIONS_TEST_API.');
const {_electron}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const username=`operation${Date.now()}`, password=randomUUID();
let headers={'Content-Type':'application/json'};
async function request(method,path,body) {
  const r=await fetch(`${api}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  assert.ok(r.ok,`${method} ${path}: ${r.status} ${await r.clone().text()}`); return r.status===204?undefined:r.json();
}
await request('POST','/users',{firstName:'Teste',username,email:`${username}@example.com`,password,userRole:'ADMIN'});
headers.Authorization=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const client=await request('POST','/clients',{name:username,clientType:'RETAIL',clientStatus:'PAID'});
const water=await request('POST','/products',{name:`Água ${username}`,type:'WATER',basePrice:9});
const supplier=await request('POST','/suppliers',{name:username});
const gas=await request('POST','/products',{name:`Gás ${username}`,type:'GAS',basePrice:125,lastCostPrice:110,defaultSupplierId:supplier.id});
// A API informada precisa ser descartável; a configuração é global nesta base.
const initial=await request('GET','/bottle-inventory');
await request('PUT','/bottle-inventory',{validQuantity:Math.max(initial.validQuantity,initial.filledQuantity)+10,expiredQuantity:initial.expiredQuantity+3});
await request('PATCH',`/stocks/products/${water.id}`,5);
const app=await _electron.launch({executablePath:createRequire(import.meta.url)('electron'),args:['.',`--user-data-dir=${await mkdtemp(join(tmpdir(),'vitalis-corrections-'))}`],env:{...process.env,VITE_DEV_SERVER_URL:'http://localhost:5173'}});
const page=await app.firstWindow(); page.setDefaultTimeout(15000); await page.setViewportSize({width:1440,height:1050});
await page.route('http://localhost:8080/**',route=>route.continue({url:route.request().url().replace('http://localhost:8080',api)}));
const modal=()=>page.locator('.fixed').filter({has:page.locator('form')}).last();
try {
  await page.goto('http://localhost:5173/#/login'); await page.locator('#username').fill(username); await page.locator('#password').fill(password); await page.getByRole('button',{name:'Entrar',exact:true}).click(); await page.waitForURL('**/#/dashboard');
  await page.goto('http://localhost:5173/#/stock');
  await page.getByRole('heading',{name:'Garrafões do depósito',exact:true}).waitFor();
  await page.screenshot({path:join(tmpdir(),'vitalis-bottle-inventory.png')});
  async function createWater(mode,price) {
    await page.goto('http://localhost:5173/#/orders'); await page.getByRole('button',{name:/Novo Pedido/}).click();
    await page.getByPlaceholder('Buscar cliente...').fill(username); await page.getByRole('button',{name:new RegExp(username)}).click();
    await modal().locator('tbody select').first().selectOption(water.id);
    await page.getByLabel('Tipo da venda de garrafão').selectOption(mode);
    await modal().locator('tbody input[type=number]').first().fill(String(price));
    const saved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/orders'));
    await page.getByRole('button',{name:/Salvar Pedido/}).click(); const r=await saved; assert.equal(r.status(),201); const [order]=await r.json();
    await request('PATCH',`/orders/${order.id}/confirm-delivery`); return order;
  }
  const before=await request('GET','/bottle-inventory'); const order=await createWater('FULL',40);
  const after=await request('GET','/bottle-inventory'); assert.equal(after.validQuantity,before.validQuantity-1); assert.equal(after.filledQuantity,before.filledQuantity-1);
  await page.goto(`http://localhost:5173/#/orders/${order.id}`); await page.getByRole('button',{name:/Editar/}).first().click();
  await page.getByRole('heading',{name:'Editar pedido concluído',exact:true}).waitFor(); await page.getByLabel(`Preço de ${water.name}`,{exact:true}).fill('38');
  const corrected=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes(`/orders/${order.id}/correction`));
  await page.getByRole('button',{name:'Salvar correção',exact:true}).click(); assert.equal((await corrected).status(),200);
  const changed=await request('GET',`/orders/${order.id}`); assert.equal(changed.id,order.id); assert.equal(changed.items[0].id,order.items[0].id); assert.equal(changed.totalValue,38);
  await page.goto('http://localhost:5173/#/orders'); await page.getByRole('button',{name:'Promoção Gás + água',exact:true}).click();
  await page.getByLabel(/^Cliente/).selectOption(client.id); await page.getByLabel(/^Gás/).selectOption(gas.id); await page.getByLabel(/^Água inclusa/).selectOption(water.id);
  await page.getByLabel(/^Valor da água/).fill('8');
  const promoSaved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/orders'));
  await page.getByRole('button',{name:'Criar promoção',exact:true}).click(); const response=await promoSaved; assert.equal(response.status(),201); const [promotion]=await response.json(); assert.equal(promotion.totalValue,127);
  await request('PATCH',`/orders/${promotion.id}/confirm-delivery`);
  const day=new Date().toLocaleDateString('en-CA');
  let settlements=await request('GET',`/gas-settlements?start=${day}&end=${day}`); const settlement=settlements.find(s=>promotion.items.some(i=>i.id===s.orderItemId)); assert.equal(settlement.amount,17);
  const report=await request('GET',`/reports/performance/daily?date=${day}`); assert.ok(report.gasGrossProfit>=9);
  await page.goto('http://localhost:5173/#/gas-settlements');
  await page.locator('tbody tr').filter({hasText:username}).getByTitle('Editar acerto de gás').click();
  await page.getByLabel(/^Valor unitário do acerto/).fill('18'); await page.getByLabel('Acertado',{exact:true}).check(); await page.getByLabel(/^Meio do acerto/).selectOption('PIX');
  const gasEdited=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(`/gas-settlements/${settlement.id}`));
  await page.getByRole('button',{name:'Salvar acerto',exact:true}).click(); assert.equal((await gasEdited).status(),200);
  const gs=await request('GET',`/gas-settlements/${settlement.id}`); assert.equal(gs.amount,18); assert.equal(gs.paymentMethod,'PIX');
  const loan=await request('POST','/bottles',{clientId:client.id,productId:water.id,quantity:1,loanDate:'2020-01-01T00:00:00'});
  await page.goto('http://localhost:5173/#/bottles'); await page.locator('tbody tr').filter({hasText:username}).getByTitle('Editar empréstimo').click();
  await modal().locator('input[type=number]').fill('3');
  const loanEdited=page.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith(`/bottles/${loan.id}`));
  await page.getByRole('button',{name:'Salvar empréstimo',exact:true}).click(); assert.equal((await loanEdited).status(),200);
  assert.equal((await request('GET',`/bottles/${loan.id}`)).quantity,3);
  const expiredBefore=await request('GET','/bottle-inventory'); await createWater('EXPIRED',3); const expiredAfter=await request('GET','/bottle-inventory'); assert.equal(expiredAfter.expiredQuantity,expiredBefore.expiredQuantity-1); assert.equal(expiredAfter.filledQuantity,expiredBefore.filledQuantity);
  console.log('PASS Electron/API real: totais de garrafões, venda completa, edição de pedido concluído, promoção com água ajustável, edição de acerto liquidado, empréstimo e venda de vencido sem baixa de água.');
} catch(error) { await page.screenshot({path:join(tmpdir(),'vitalis-corrections-error.png')}); throw error; } finally { await app.close(); }
