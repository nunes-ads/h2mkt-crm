const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {createBusiness}=require('./business.cjs');
function setup(){
 const directory=path.join(__dirname,'test-data',crypto.randomUUID());fs.mkdirSync(directory,{recursive:true});
 let clock=Date.UTC(2026,10,6,18),fail=false;const calls=[],events=[];
 const jid='5511999999999@s.whatsapp.net';
 const row=(id='inbound',fromMe=false,t=clock/1000)=>({key:{id,remoteJid:jid,fromMe},message:{conversation:'Proposta https://example.com'},messageTimestamp:t,pushName:'Contato de teste'});
 const normalize=r=>({id:r.key.id,jid:r.key.remoteJid,fromMe:r.key.fromMe,timestamp:Number(r.messageTimestamp),text:r.message.conversation||'',kind:'text',sender:r.pushName||'',fileName:''});
 const api=async(route,body)=>{calls.push({route,body});if(fail&&!route.includes('findMessages'))throw Error('Falha simulada');if(route.includes('findMessages'))return {messages:{records:[row()],pages:1,total:1}};return row('sent',true);};
 const options={directory,api,instance:'test',emit:e=>events.push(e),normalize,validJid:j=>{if(!/^\d+@(s\.whatsapp\.net|g\.us)$/.test(j))throw Error('JID inválido');return j;},now:()=>clock};
 const b=createBusiness(options);
 return {b,directory,options,calls,events,jid,row,now:()=>clock,advance:n=>clock+=n,fail:()=>fail=true};
}
test('organização, etiquetas, notas e favoritos persistem ao reiniciar',async()=>{
 const s=setup();await s.b.handle('tags',{name:'Orçamento',color:'#16845b'});const tag=s.b.state().tags[0];
 await s.b.handle('chat-meta',{jid:s.jid,patch:{pinned:true,tags:[tag.id],notes:'Retornar amanhã',stage:'waiting'}});
 await s.b.handle('favorite',{jid:s.jid,id:'inbound'});
 const restored=createBusiness(s.options).state();assert.equal(restored.chats[s.jid].notes,'Retornar amanhã');assert.equal(restored.chats[s.jid].pinned,true);assert.deepEqual(restored.chats[s.jid].tags,[tag.id]);assert.equal(restored.favorites.length,1);
 await s.b.handle('tags',{remove:tag.id});assert.equal(s.b.state().chats[s.jid].tags.length,0);
});
test('lida, não lida e arquivada utilizam os recursos nativos',async()=>{
 const s=setup();await s.b.handle('chat-meta',{jid:s.jid,patch:{unread:false}});assert(s.calls.some(c=>c.route.includes('markMessageAsRead')));
 assert.equal(s.b.enrich({jid:s.jid,unread:9,last:{timestamp:s.now()/1000-1}}).unread,0);
 await s.b.handle('chat-meta',{jid:s.jid,patch:{unread:true,archived:true}});assert(s.calls.some(c=>c.route.includes('markChatUnread')));assert(s.calls.some(c=>c.route.includes('archiveChat')&&c.body.archive));
 assert.equal(s.b.enrich({jid:s.jid,unread:0}).unread,1);
});
test('falha de sincronização preserva organização local e informa limitação',async()=>{
 const s=setup();s.fail();const result=await s.b.handle('chat-meta',{jid:s.jid,patch:{archived:true}});assert.equal(result.meta.archived,true);assert.match(result.warning,/sincronização/);
});
test('entrada inválida é rejeitada antes de alterar o WhatsApp',async()=>{const s=setup();await assert.rejects(()=>s.b.handle('chat-meta',{jid:s.jid,patch:{archived:'true'}}),/inválida/);assert.equal(s.calls.length,0);});
test('anexos e respostas rápidas são guardados sem enviar mensagem',async()=>{
 const s=setup();const a=await s.b.handle('upload',{mimetype:'text/plain',fileName:'teste.txt',base64:Buffer.from('Anexo de teste').toString('base64')});
 await s.b.handle('quick-replies',{shortcut:'orcamento',text:'Segue a proposta',assetId:a.id});assert.equal(s.b.state().replies[0].assetId,a.id);assert.equal(s.calls.length,0);
 const info=await s.b.handle('asset-info',{id:a.id});assert.equal(info.fileName,'teste.txt');assert.equal(info.buffer,undefined);
 await assert.rejects(()=>s.b.handle('quick-replies',{shortcut:'orcamento',text:'duplicada'}),/já existe/);
});
test('responder com anexo usa o conteúdo original da mensagem citada',async()=>{
 const s=setup();const a=await s.b.handle('upload',{mimetype:'image/png',fileName:'teste.png',base64:Buffer.from('test').toString('base64')});
 await s.b.handle('send',{jid:s.jid,text:'Legenda',assetId:a.id,replyId:'inbound'});const sent=s.calls.find(c=>c.route.includes('sendMedia'));assert.equal(sent.body.quoted.key.id,'inbound');assert.equal(sent.body.caption,'Legenda');assert.equal(sent.body.mediatype,'image');
});
test('áudio gravado utiliza o endpoint de voz e não descarta texto de legenda',async()=>{const s=setup();const a=await s.b.handle('upload',{mimetype:'audio/webm',fileName:'audio.webm',base64:Buffer.from('audio').toString('base64')});await assert.rejects(()=>s.b.handle('send',{jid:s.jid,assetId:a.id,text:'Não perder este texto',voice:true}),/separadamente/);assert.equal(s.calls.length,0);await s.b.handle('send',{jid:s.jid,assetId:a.id,voice:true});assert(s.calls[0].route.includes('sendWhatsAppAudio'));});
test('reação preserva a chave da mensagem original',async()=>{const s=setup();await s.b.handle('reaction',{jid:s.jid,id:'inbound',reaction:'👍'});const sent=s.calls.find(c=>c.route.includes('sendReaction'));assert.equal(sent.body.key.id,'inbound');assert.equal(sent.body.reaction,'👍');});
test('agendamento envia uma única vez mesmo com processamento repetido',async()=>{
 const s=setup();await s.b.handle('jobs',{jid:s.jid,text:'Mensagem agendada',kind:'message',at:s.now()+6000});s.advance(7000);await Promise.all([s.b.tick(),s.b.tick()]);await s.b.tick();assert.equal(s.calls.filter(c=>c.route.includes('sendText')).length,1);assert.equal(s.b.state().jobs[0].status,'done');
});
test('lembrete e cancelamento não enviam mensagens',async()=>{
 const s=setup();await s.b.handle('jobs',{jid:s.jid,text:'Ligar',kind:'reminder',at:s.now()+6000});await s.b.handle('jobs',{jid:s.jid,text:'Cancelar',kind:'message',at:s.now()+6000});await s.b.handle('jobs',{cancel:s.b.state().jobs[1].id});s.advance(7000);await s.b.tick();assert.equal(s.calls.length,0);assert.equal(s.b.state().alerts[0].text,'Ligar');assert.equal(s.b.state().jobs[1].status,'cancelled');
});
test('agendamento com atraso longo é sinalizado sem envio inesperado',async()=>{
 const s=setup();await s.b.handle('jobs',{jid:s.jid,text:'Teste',kind:'message',at:s.now()+6000});s.advance(3600000);await s.b.tick();assert.equal(s.calls.length,0);assert.equal(s.b.state().jobs[0].status,'missed');
});
test('falha de envio não provoca nova tentativa automática',async()=>{
 const s=setup();await s.b.handle('jobs',{jid:s.jid,text:'Teste',kind:'message',at:s.now()+6000});s.fail();s.advance(7000);await s.b.tick();await s.b.tick();assert.equal(s.calls.length,1);assert.equal(s.b.state().jobs[0].status,'failed');
});
test('reinício durante envio marca estado incerto sem reenviar',async()=>{
 const s=setup();const file=path.join(s.directory,'business-state.json');const db=JSON.parse(fs.readFileSync(file));db.jobs=[{id:'job',jid:s.jid,text:'Teste',kind:'message',status:'sending',at:s.now()-1000}];fs.writeFileSync(file,JSON.stringify(db));const b=createBusiness(s.options);await b.tick();assert.equal(s.calls.length,0);assert.equal(b.state().jobs[0].status,'uncertain');
});
test('notificações ignoram histórico, próprias, duplicadas e eventos append',async()=>{
 const s=setup();const ev=(r,type)=>({event:'messages.upsert',data:type?{messages:[r],type}:r});
 await s.b.inbound(ev(s.row('old',false,s.now()/1000-600)));await s.b.inbound(ev(s.row('self',true)));await s.b.inbound(ev(s.row('append'), 'append'));await s.b.inbound(ev(s.row()));await s.b.inbound(ev(s.row()));
 assert.equal(s.events.filter(e=>e.event==='incoming.message').length,1);assert.equal(s.calls.length,0);
});
test('saudação é opt-in e respeita intervalo por contato',async()=>{
 const s=setup();await s.b.handle('automation',{greeting:{enabled:true,text:'Olá!'}});await s.b.inbound({event:'messages.upsert',data:s.row('one')});await s.b.inbound({event:'messages.upsert',data:s.row('two')});assert.equal(s.calls.filter(c=>c.route.includes('sendText')).length,1);
});
test('ausência tem prioridade e automações não respondem grupos',async()=>{
 const s=setup();await s.b.handle('automation',{greeting:{enabled:true,text:'Olá'},away:{enabled:true,text:'Estamos ausentes',start:'09:00',end:'12:00',days:[5]}});await s.b.inbound({event:'messages.upsert',data:s.row('one')});const group=s.row('group');group.key.remoteJid='12345@g.us';await s.b.inbound({event:'messages.upsert',data:group});assert.equal(s.calls.length,1);assert.equal(s.calls[0].body.text,'Estamos ausentes');
});
test('busca encontra texto e links no histórico armazenado',async()=>{
 const s=setup();const found=await s.b.handle('history',{query:'proposta',kind:'links'});assert.equal(found.records.length,1);assert.equal(found.nextPage,null);const none=await s.b.handle('history',{from:'2027-01-01'});assert.equal(none.records.length,0);
});
