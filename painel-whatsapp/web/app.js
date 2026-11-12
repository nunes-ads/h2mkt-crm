'use strict';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function textHTML(value){return String(value||'').split(/(https?:\/\/[^\s<>"']+)/g).map(part=>/^https?:\/\//i.test(part)?`<a href="${esc(part)}" target="_blank" rel="noopener noreferrer">${esc(part)}</a>`:esc(part)).join('');}
const state = { chats: [], active: null, messages: [], page: 1, pages: 0, filter: 'all', search: '', drafts: new Map(), sending: false, attachment: null, stream: false, loadingChats: false, loadingMessages: false, selection: 0 };
let toastTimer, updateTimer, chatsAgain = false, visibleContacts = 150, chatRenderKey = '';
async function call(action, body = {}) {
  const r = await fetch('/action/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Local-Test': '1' }, body: JSON.stringify(body) });
  const d = await r.json(); if (!r.ok) throw Error(d.error || 'Não foi possível concluir a operação.'); return d;
}
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5000); }
function error(text) { $('error-banner').textContent = text; $('error-banner').hidden = !text; }
function contactName(c) { return c.name || (c.isGroup ? 'Grupo ' : '') + c.jid.split('@')[0]; }
function safeImage(url) { try { return ['https:', 'http:'].includes(new URL(url).protocol) ? url : ''; } catch { return ''; } }
function avatar(c) { const name = contactName(c), initials = name.split(/\s+/).slice(0,2).map(v => v[0] || '').join('').toUpperCase(); const image = safeImage(c.avatar); return `<div class="avatar" aria-hidden="true">${esc(c.isGroup ? '◉' : initials.slice(0,2))}${image ? `<img src="${esc(image)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}</div>`; }
function preview(m) { if (!m) return 'Iniciar uma conversa'; const labels = { image: '📷 Imagem', video: '🎞 Vídeo', audio: '🎧 Áudio', document: '📄 Documento', sticker: 'Figurinha' }; return (m.fromMe ? 'Você: ' : '') + (labels[m.kind] ? labels[m.kind] + (m.text ? ' · ' + m.text : '') : m.text || 'Mensagem'); }
function chatTime(t) { if (!t) return ''; const d = new Date(t*1000), today = new Date(); return d.toDateString() === today.toDateString() ? d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}); }
function renderChats() {
  const fold=value=>String(value||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('pt-BR');
  const query=fold(state.search),phoneQuery=/^[+\d()\s.-]+$/.test(query)?query.replace(/\D/g,''):'';
  let chats = state.chats.filter(c => (!query || fold(contactName(c)+' '+c.jid).includes(query) || phoneQuery&&(c.aliases||[c.jid]).some(j=>j.split('@')[0].replace(/\D/g,'').includes(phoneQuery))) && (state.filter !== 'unread' || c.unread > 0) && (state.filter !== 'groups' || c.isGroup));
  if(window.businessUI)chats=businessUI.filterChats(chats);
  $('chat-count').textContent = state.chats.length || '';
  const visible = chats.slice(0, visibleContacts);
  const signature = JSON.stringify([visible, state.active?.jid, Math.floor(Date.now()/60000), chats.length]);
  if (signature === chatRenderKey) {window.chatSearch?.render();return;}
  chatRenderKey = signature;
  $('chat-list').innerHTML = chats.length ? visible.map(c => `<button class="chat-row${state.active?.jid === c.jid ? ' selected' : ''}" data-jid="${esc(c.jid)}" aria-label="Abrir conversa com ${esc(contactName(c))}">${avatar(c)}<div class="chat-copy"><div class="row-top"><span class="row-name">${esc(contactName(c))}</span><time class="row-time">${chatTime(c.timestamp)}</time></div><div class="row-bottom"><span class="preview">${esc(preview(c.last))}</span>${c.unread ? `<span class="unread">${c.unread > 99 ? '99+' : c.unread}</span>` : ''}</div></div></button>`).join('') + (chats.length>visible.length ? '<button class="load-older" data-more="true">Mostrar mais contatos</button>' : '') : '<div class="list-message">' + (state.chats.length ? 'Nenhuma conversa para este filtro.' : 'Nenhuma conversa sincronizada ainda.<br>Use + para iniciar uma conversa.') + '</div>';
  if(window.businessUI)businessUI.decorateChats();
  $('chat-list').querySelectorAll('img').forEach(img => img.addEventListener('error', () => img.remove(), { once:true }));
  window.chatSearch?.render();
}
async function loadChats(quiet = false) {
  if (state.loadingChats) { chatsAgain = true; return; }
  state.loadingChats = true;
  if (!quiet) $('sync-state').textContent = 'Atualizando conversas…';
  try {
    const data = await call('chats');
    if(state.active){const match=data.find(c=>c.jid===state.active.jid||c.aliases?.includes(state.active.jid));if(match){if(match.jid!==state.active.jid)state.drafts.set(match.jid,$('draft').value);state.active=match;}else data.unshift(state.active);}
    state.chats = data;
    if (state.active) { state.active = state.chats.find(c=>c.jid === state.active.jid) || state.active; renderHeader(); }
    renderChats(); $('sync-state').textContent = state.stream ? 'Atualização ao vivo' : 'Sincronização periódica'; error('');
  } catch(e) { $('sync-state').textContent = 'Falha na sincronização'; error(e.message); if (!state.chats.length) $('chat-list').innerHTML = '<div class="list-message">Não foi possível carregar as conversas.<br>Use o botão de atualizar para tentar novamente.</div>'; }
  finally { state.loadingChats = false; if (chatsAgain) { chatsAgain = false; setTimeout(()=>loadChats(true),1000); } }
}
function renderHeader() {
  const c = state.active; if(!c) return;
  $('contact-name').textContent = contactName(c); $('contact-subtitle').textContent = c.isGroup ? 'Conversa em grupo' : 'Conversa individual'; $('header-avatar').innerHTML = avatar(c);
  $('header-avatar').querySelector('img')?.addEventListener('error',e=>e.target.remove(),{once:true});
  window.businessUI?.header();
}
async function selectChat(c) {
  if(state.recording){toast('Pare a gravação antes de trocar de conversa.');return;}
  if (state.active?.jid === c.jid) { document.querySelector('.app').classList.add('chat-open'); return; }
  if (state.active) state.drafts.set(state.active.jid, $('draft').value);
  delete $('message-list').dataset.renderKey; state.active = c; state.selection++; state.messages=[]; state.page=1; state.pages=0; state.loadingMessages=false;
  removeAttachment(); $('draft').value = state.drafts.get(c.jid) || ''; resizeDraft(); $('active-chat').hidden=false; $('welcome').hidden=true; document.querySelector('.app').classList.add('chat-open');
  $('emoji-picker').hidden=true; $('emoji-toggle').setAttribute('aria-expanded','false');
  $('message-list').innerHTML='<div class="message-empty">Carregando conversa…</div>'; $('message-empty').hidden=true; $('load-older').hidden=true;
  renderHeader(); renderChats(); await loadMessages(true);
  window.chatSearch?.selected(c);
  window.businessUI?.selected(c);
  if(window.innerWidth>720) $('draft').focus();
}
function mediaURL(m) { return '/media?jid=' + encodeURIComponent(m.sourceJid||m.jid||state.active.jid) + '&id=' + encodeURIComponent(m.id); }
function bubble(m) {
  let media = '';
  if (['image','sticker'].includes(m.kind)) media = `<img class="media-image" src="${esc(mediaURL(m))}" alt="${m.kind === 'sticker' ? 'Figurinha' : 'Imagem da conversa'}" loading="lazy" data-media="image">`;
  if (m.kind === 'audio') media = `<audio controls preload="none" src="${esc(mediaURL(m))}"></audio>`;
  if (m.kind === 'video') media = `<video controls preload="none" src="${esc(mediaURL(m))}"></video>`;
  if (m.kind === 'document') media = `<div class="media-label">📄 ${esc(m.fileName || 'Documento')}</div><a class="media-button" href="${esc(mediaURL(m))}" download>Baixar arquivo</a>`;
  const checks = m.fromMe ? `<span class="checks${['READ','PLAYED'].includes(m.status) ? ' read' : ''}" title="${esc(m.status || 'Aceita pela API')}">${['READ','PLAYED','DELIVERY_ACK','DELIVERED'].includes(m.status)?'✓✓':'✓'}</span>` : '';
  return `<div class="message-row${m.fromMe ? ' me' : ''}" data-message-id="${esc(m.id)}"><div class="bubble">${state.active.isGroup && !m.fromMe && m.sender ? `<div class="sender">${esc(m.sender)}</div>` : ''}${m.reply?`<div class="quoted-message"><strong>Em resposta</strong><span>${esc(m.reply.text)}</span></div>`:''}${media}${m.text ? `<div class="bubble-text">${textHTML(m.text)}</div>` : ''}<div class="bubble-meta"><time>${new Date(m.timestamp*1000).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time>${checks}</div>${window.businessUI?.messageTools(m)||''}</div></div>`;
}
function renderMessages(scrollBottom=false, older=false) {
  const area=$('messages'), beforeHeight=area.scrollHeight, beforeTop=area.scrollTop, nearBottom=area.scrollHeight-area.clientHeight-area.scrollTop<150;
  let lastDay=''; let html='';
  for (const m of state.messages) {
    const date=new Date(m.timestamp*1000), day=date.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
    if(day!==lastDay){html+=`<div class="day">${esc(day)}</div>`;lastDay=day;} html+=bubble(m);
  }
  // Preserve the DOM when no message data changed, so media playback isn't interrupted.
  if ($('message-list').dataset.renderKey === html) return;
  $('message-list').dataset.renderKey=html; $('message-list').innerHTML=html;
  $('message-empty').hidden=state.messages.length>0; $('load-older').hidden=state.page>=state.pages;
  const settle=()=>{if(scrollBottom||(!older&&nearBottom)) area.scrollTop=area.scrollHeight;};
  $('message-list').querySelectorAll('img').forEach(img=>{ img.addEventListener('load',settle,{once:true}); img.addEventListener('error',()=>{ const b=document.createElement('button');b.className='media-button';b.textContent='Imagem indisponível · tentar novamente';b.onclick=()=>{img.src=img.src+'&retry='+Date.now();img.hidden=false;b.remove();};img.hidden=true;img.after(b); },{once:true}); });
  if(older) area.scrollTop=beforeTop+area.scrollHeight-beforeHeight; else settle();
}
async function loadMessages(reset=false, older=false) {
  if(!state.active || state.loadingMessages) return;
  state.loadingMessages=true; const token=state.selection, remoteJid=state.active.jid;
  try {
    const d=await call('messages',{jid:remoteJid,page:older?state.page+1:1});
    if(token!==state.selection) return;
    const byId=new Map((reset?[]:state.messages).map(m=>[m.id,m])); d.records.forEach(m=>byId.set(m.id,m));
    state.messages=[...byId.values()].sort((a,b)=>a.timestamp-b.timestamp);
    state.page=older?d.page:Math.max(state.page,d.page);state.pages=d.pages;renderMessages(reset,older);error('');
  }catch(e){if(token===state.selection){error(e.message);if(reset)$('message-list').innerHTML='<div class="message-empty">Histórico indisponível. Tente atualizar.</div>';}}
  finally{if(token===state.selection)state.loadingMessages=false;}
}
function resizeDraft(){const d=$('draft');d.style.height='auto';d.style.height=Math.min(d.scrollHeight,120)+'px';}
function removeAttachment(){if(state.attachment?.url) URL.revokeObjectURL(state.attachment.url);state.attachment=null;$('attachment-preview').hidden=true;$('file-input').value='';$('attachment-preview').querySelector('.attachment-player')?.remove();}
function showAttachment(a){const type=a.file?.type||a.asset?.mimetype||'';const name=a.file?.name||a.asset?.fileName||'Arquivo';$('attachment-img').hidden=!type.startsWith('image/');$('attachment-img').src=a.url;$('attachment-name').textContent=name;$('attachment-preview').querySelector('.attachment-player')?.remove();if(type.startsWith('audio/')||type.startsWith('video/')){const player=document.createElement(type.startsWith('audio/')?'audio':'video');player.controls=true;player.src=a.url;player.className='attachment-player';$('attachment-name').after(player);}$('attachment-preview').hidden=false;}
function setAttachment(file){
  if(!file)return;if(file.size>8*1024*1024)return toast('O arquivo deve ter até 8 MB.');
  removeAttachment(); state.attachment={file,url:URL.createObjectURL(file)};showAttachment(state.attachment);$('draft').focus();
}
async function prepareAttachment(){const a=state.attachment;if(!a)return null;if(a.asset)return a.asset;const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(a.file);});a.asset=await call('upload',{base64,mimetype:a.file.type||'application/octet-stream',fileName:a.file.name});return a.asset;}
async function send(event){
  event.preventDefault(); if(state.recording)return toast('Pare a gravação antes de enviar.');if(state.sending||!state.active)return;const text=$('draft').value, attachment=state.attachment;if(!text.trim()&&!attachment)return;
  const remoteJid=state.active.jid;state.sending=true;$('send').disabled=true;$('draft').disabled=true;$('attach').disabled=true;$('emoji-toggle').disabled=true;$('remove-attachment').disabled=true;
  try{
    let sent;
    const asset=attachment?await prepareAttachment():null;
    sent=await call('send',{jid:remoteJid,text,assetId:asset?.id,voice:!!attachment?.voice,replyId:window.businessUI?.quotedId()});
    state.drafts.set(remoteJid,'');window.businessUI?.clearQuote();
    if(state.active?.jid===remoteJid){$('draft').value='';resizeDraft();removeAttachment(); if(sent.id){state.messages=state.messages.filter(m=>m.id!==sent.id);state.messages.push(sent);state.messages.sort((a,b)=>a.timestamp-b.timestamp);renderMessages(true);} }
    const c=state.chats.find(c=>c.jid===remoteJid);if(c){c.last=sent;c.timestamp=sent.timestamp||Math.floor(Date.now()/1000);state.chats.sort((a,b)=>b.timestamp-a.timestamp);renderChats();}
    setTimeout(()=>{loadChats(true);if(state.active?.jid===remoteJid)loadMessages();},800);
  }catch(e){toast(e.message);}
  finally{state.sending=false;$('send').disabled=false;$('draft').disabled=false;$('attach').disabled=false;$('emoji-toggle').disabled=false;$('remove-attachment').disabled=false;$('draft').focus();}
}
let lastQRRevision=0,qrExpiryTimer,qrRequestPending=false,connectionLifecycle=0;
function clearConnectionQR(){clearTimeout(qrExpiryTimer);$('qr').replaceChildren();$('qr-help').hidden=true;}
function showConnectionQR(qr){
  if(!$('connection-dialog').open||!qr?.base64||qr.revision<lastQRRevision||Date.now()-qr.updatedAt>=60000)return false;
  lastQRRevision=qr.revision;clearConnectionQR();
  const img=document.createElement('img');img.alt='QR code para conectar o WhatsApp';img.src=qr.base64;
  $('qr').replaceChildren(img);$('qr-help').hidden=false;$('get-qr').hidden=false;
  $('connection-state').textContent='Escaneie o QR code no celular. O código é atualizado automaticamente.';
  qrExpiryTimer=setTimeout(()=>{clearConnectionQR();$('connection-state').textContent='QR code expirado. Gere um novo código para conectar.';},Math.max(0,60000-(Date.now()-qr.updatedAt)));
  return true;
}
async function connectionStatus(){try{const d=await call('status');const connected=d.instance?.state==='open';$('status-dot').classList.toggle('online',connected);$('connection-state').textContent=connected?'Seu WhatsApp está conectado.':d.instance?.state==='connecting'?'Aguardando a conexão pelo celular.':'WhatsApp desconectado. Gere um QR code para conectar.';$('get-qr').hidden=connected;if(['open','close'].includes(d.instance?.state)){connectionLifecycle++;clearConnectionQR();}return connected;}catch(e){$('status-dot').classList.remove('online');clearConnectionQR();$('connection-state').textContent=e.message;return false;}}
function showNew(){if(state.sending)return;$('new-error').textContent='';$('new-dialog').showModal();$('new-number').focus();}
$('new-chat').onclick=showNew;$('welcome-new').onclick=showNew;
$('new-form').onsubmit=e=>{e.preventDefault();const number=$('new-number').value.replace(/\D/g,'');if(number.length<10||number.length>15){$('new-error').textContent='Informe entre 10 e 15 dígitos, com o código do país.';return;}const remoteJid=number+'@s.whatsapp.net';let c=state.chats.find(c=>c.jid===remoteJid);if(!c){c={jid:remoteJid,name:'',timestamp:0,unread:0,isGroup:false};state.chats.unshift(c);}$('new-dialog').close();selectChat(c);};
$('chat-list').onclick=e=>{if(state.sending)return;if(e.target.closest('[data-more]')){visibleContacts+=150;renderChats();return;}const row=e.target.closest('[data-jid]');if(row){const c=state.chats.find(c=>c.jid===row.dataset.jid);if(c)selectChat(c);}};
$('search').oninput=e=>{state.search=e.target.value;visibleContacts=150;renderChats();};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(c=>c.classList.toggle('selected',c===b));renderChats();});
$('refresh').onclick=()=>{loadChats();loadMessages();connectionStatus();};
$('composer').onsubmit=send;$('draft').oninput=resizeDraft;
$('draft').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();$('composer').requestSubmit();}};
$('draft').addEventListener('paste',e=>{const image=[...e.clipboardData.items].find(i=>i.kind==='file'&&i.type.startsWith('image/'));if(image){e.preventDefault();setAttachment(image.getAsFile());}});
const fileInput=document.createElement('input');fileInput.type='file';fileInput.id='file-input';fileInput.hidden=true;document.body.appendChild(fileInput);fileInput.onchange=()=>setAttachment(fileInput.files[0]);$('attach').onclick=()=>fileInput.click();$('remove-attachment').onclick=removeAttachment;
const emojis='😀 😃 😄 😁 😆 😅 😂 🤣 😊 🙂 😉 😍 🥰 😘 😎 🤩 🥳 🤔 🤗 🙏 👍 👎 👏 🙌 💪 👋 🤝 ❤️ 💚 💙 💛 🧡 💜 🤍 🖤 💔 ✨ 🎉 🎊 🎈 🎂 🎁 🥂 ☕ 🍕 🍔 🌞 🌻 🌹 🌈 🔥 💡 📌 📅 📞 💬 📷 📄 📦 🛒 💰 ✅ ❌ ⚠️ ❓ ❗ 🚀 ⭐ 💯'.split(' ');
for(const emoji of emojis){const b=document.createElement('button');b.type='button';b.textContent=emoji;b.setAttribute('aria-label','Inserir '+emoji);b.onclick=()=>{const d=$('draft');d.focus();d.setRangeText(emoji,d.selectionStart,d.selectionEnd,'end');resizeDraft();};$('emoji-grid').appendChild(b);}
$('emoji-toggle').onclick=()=>{$('emoji-picker').hidden=!$('emoji-picker').hidden;$('emoji-toggle').setAttribute('aria-expanded',String(!$('emoji-picker').hidden));};
document.addEventListener('click',e=>{if(!e.target.closest('#emoji-picker')&&!e.target.closest('#emoji-toggle')){$('emoji-picker').hidden=true;$('emoji-toggle').setAttribute('aria-expanded','false');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('emoji-picker').hidden=true;$('emoji-toggle').setAttribute('aria-expanded','false');}});
$('load-older').onclick=()=>loadMessages(false,true);
$('message-list').addEventListener('click',e=>{const img=e.target.closest('[data-media="image"]');if(img){$('full-image').src=img.src;$('image-dialog').showModal();}});
$('back').onclick=()=>document.querySelector('.app').classList.remove('chat-open');$('rail-chats').onclick=()=>document.querySelector('.app').classList.remove('chat-open');
function details(){if(!state.active)return;const c=state.active;$('detail-content').innerHTML=avatar(c)+`<h3 class="detail-name">${esc(contactName(c))}</h3><p class="detail-number">${esc(c.jid.split('@')[0])}</p><p>${c.isGroup?'Conversa em grupo':'Conversa individual'}</p>`;$('details-dialog').showModal();}
$('details').onclick=details;$('contact-details').onclick=details;
document.querySelectorAll('.close-dialog').forEach(b=>b.onclick=()=>b.closest('dialog').close());
$('connection').onclick=()=>{$('connection-dialog').showModal();connectionStatus();};$('check-state').onclick=connectionStatus;
$('connection-dialog').addEventListener('close',()=>{connectionLifecycle++;clearConnectionQR();});
$('get-qr').onclick=async()=>{
  if(qrRequestPending)return;
  qrRequestPending=true;$('get-qr').disabled=true;const lifecycle=connectionLifecycle;
  try{clearConnectionQR();$('connection-state').textContent='Gerando QR code…';const d=await call('connect');if(lifecycle!==connectionLifecycle)return;if(!showConnectionQR(d.qr))await connectionStatus();}
  catch(e){if(lifecycle===connectionLifecycle)$('connection-state').textContent=e.message;}
  finally{qrRequestPending=false;$('get-qr').disabled=false;}
};
function startEvents(){const source=new EventSource('/events');source.addEventListener('ready',()=>{state.stream=true;lastQRRevision=0;$('sync-state').textContent='Atualização ao vivo';window.businessUI?.reload();});source.onerror=()=>{state.stream=false;$('sync-state').textContent='Reconectando atualizações…';if($('qr').childElementCount){clearConnectionQR();$('connection-state').textContent='Atualizações interrompidas. Aguarde e gere um novo QR code.';}};source.addEventListener('update',e=>{const data=JSON.parse(e.data);if(data.event==='qrcode.updated'){if(data.qr)showConnectionQR(data.qr);else{clearConnectionQR();$('connection-state').textContent='QR code indisponível. Gere um novo código para conectar.';}return;}if(data.event==='connection.update'){if(['open','close'].includes(data.state)){connectionLifecycle++;clearConnectionQR();}connectionStatus();return;}window.businessUI?.event(data);window.chatSearch?.event(data);if(data.event==='search.index')return;clearTimeout(updateTimer);updateTimer=setTimeout(()=>{loadChats(true);loadMessages();},450);});}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){loadChats(true);loadMessages();connectionStatus();}});
loadChats();connectionStatus();startEvents();
setInterval(()=>{if(!document.hidden){loadChats(true);loadMessages();}},15000);
setInterval(()=>{if(!document.hidden)connectionStatus();},30000);
