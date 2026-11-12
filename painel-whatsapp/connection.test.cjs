const { test }=require('node:test');
const assert=require('node:assert/strict');
const { createConnectionQR }=require('./connection-qr.cjs');
const pairing=import('./connection-fix/pairing-refresh.mjs');
const logger={warn(){},info(){}};
const notification=child=>({tag:'notification',attrs:{type:'companion_reg_refresh'},content:[{tag:child,attrs:{}}]});

for(const child of ['companion_reg_refresh','pair-device-rotate-qr'])test('servidor renova o segredo sem consumir outra referência: '+child,async()=>{
  const {makePairingQRRenderer,handleCompanionRegRefresh}=await pairing;
  const creds={advSecretKey:'old'},rendered=[],saved=[];
  const renderer=makePairingQRRenderer(['first','second'],ref=>rendered.push([ref,creds.advSecretKey]));
  assert.equal(renderer.next(),true);
  assert.equal(handleCompanionRegRefresh(notification(child),{creds,logger,emitCredsUpdate:update=>saved.push(update),refreshQR:()=>renderer.refresh()}),'rotated');
  assert.equal(Buffer.from(creds.advSecretKey,'base64').length,32);
  assert.deepEqual(saved,[{advSecretKey:creds.advSecretKey}]);
  assert.deepEqual(rendered,[['first','old'],['first',creds.advSecretKey]]);
  assert.equal(renderer.next(),true);
  assert.deepEqual(rendered.at(-1),['second',creds.advSecretKey]);
  assert.equal(renderer.next(),false);
});
test('notificações inválidas e sessões registradas preservam o segredo',async()=>{
  const {handleCompanionRegRefresh}=await pairing;
  for(const node of [notification('unknown'),{...notification('companion_reg_refresh'),tag:'message'}]){
    const creds={advSecretKey:'keep'};
    assert.equal(handleCompanionRegRefresh(node,{creds,logger}),'ignored_malformed');
    assert.equal(creds.advSecretKey,'keep');
  }
  const creds={advSecretKey:'paired-secret',me:{id:'test'}};
  assert.equal(handleCompanionRegRefresh(notification('companion_reg_refresh'),{creds,logger}),'ignored_registered');
  assert.equal(creds.advSecretKey,'paired-secret');
});
test('renovação anterior ao primeiro QR usa o novo segredo ao iniciar',async()=>{
  const {handleCompanionRegRefresh,makePairingQRRenderer}=await pairing;
  const creds={advSecretKey:'old'},seen=[];
  const renderer=makePairingQRRenderer(['one'],ref=>seen.push([ref,creds.advSecretKey]));
  assert.equal(renderer.refresh(),false);
  handleCompanionRegRefresh(notification('companion_reg_refresh'),{creds,logger,emitCredsUpdate(){},refreshQR:()=>renderer.refresh()});
  assert.equal(renderer.next(),true);assert.deepEqual(seen,[['one',creds.advSecretKey]]);
});
test('painel aceita PNG, substitui código antigo, expira e limpa ao conectar',()=>{
  let clock=1000;const q=createConnectionQR({now:()=>clock});
  const first=q.update({qrcode:{base64:'data:image/png;base64,b25l'}});
  const second=q.update({base64:'dHdv'});
  assert(second.revision>first.revision);assert.match(q.current().base64,/dHdv$/);
  assert.equal(q.update({base64:'data:image/svg+xml;base64,abc'}),null);
  assert.equal(q.update({base64:'https://example.com/qr.png'}),null);
  clock+=60000;assert.equal(q.current(),null);
  q.update({base64:'dHdv'});q.clear();assert.equal(q.current(),null);
});
