const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function createBusiness({ directory, api, instance, emit, normalize, validJid, now = Date.now,identityVersion=()=>0,searchHistory=null }) {
  const file = path.join(directory, 'business-state.json');
  const assetsDir = path.join(directory, 'attachments');
  fs.mkdirSync(assetsDir, { recursive: true });
  const defaults = { chats: {}, tags: [], replies: [], favorites: [], jobs: [], seen: [], autoSent: {}, alerts: [], automation: { greeting: { enabled: false, text: '' }, away: { enabled: false, text: '', start: '09:00', end: '18:00', days: [1,2,3,4,5] } } };
  const db = fs.existsSync(file) ? { ...defaults, ...JSON.parse(fs.readFileSync(file, 'utf8')) } : defaults;
  const startedAt = now();
  let busy = false;
  let lastIdentityVersion=-1;
  function save() { fs.writeFileSync(file + '.tmp', JSON.stringify(db)); fs.renameSync(file + '.tmp', file); }
  for (const job of db.jobs) if (job.status === 'sending') { job.status = 'uncertain'; job.error = 'O serviço reiniciou durante o envio. Confira no WhatsApp antes de reagendar.'; }
  save();
  function text(value, max = 16000) { if (typeof value !== 'string' || value.length > max) throw Error('Texto inválido ou muito longo.'); return value; }
  function canonical(jid){try{return validJid(jid);}catch{return jid;}}
  function reconcile(){
    if(lastIdentityVersion===identityVersion())return;lastIdentityVersion=identityVersion();let changed=false;
    for(const [old,m]of Object.entries(db.chats)){const primary=canonical(old);if(primary===old)continue;const current=db.chats[primary]||{},notes=[current.notes,m.notes].filter(Boolean);db.chats[primary]={...m,...current,tags:[...new Set([...(m.tags||[]),...(current.tags||[])])],notes:[...new Set(notes)].join('\n\n'),pinned:!!(m.pinned||current.pinned),mutedUntil:Math.max(m.mutedUntil||0,current.mutedUntil||0),stage:current.stage&&current.stage!=='new'?current.stage:m.stage||'new',readThrough:Math.max(current.readThrough||0,m.readThrough||0)};delete db.chats[old];changed=true;}
    for(const item of [...db.jobs,...db.alerts,...db.favorites])if(item.jid){const old=item.jid;item.jid=canonical(old);if(old!==item.jid){changed=true;if(item.message)item.message={...item.message,jid:item.jid,sourceJid:item.message.sourceJid||old};}}
    const favorites=new Map(db.favorites.map(f=>[f.jid+'/'+f.message.id,f]));if(favorites.size!==db.favorites.length){db.favorites=[...favorites.values()];changed=true;}
    for(const [key,value]of Object.entries(db.autoSent)){const i=key.indexOf(':'),next=key.slice(0,i+1)+canonical(key.slice(i+1));if(next!==key){db.autoSent[next]=Math.max(db.autoSent[next]||0,value);delete db.autoSent[key];changed=true;}}
    db.seen=[...new Set(db.seen.map(key=>{const i=key.indexOf('/');return i<0?key:canonical(key.slice(0,i))+key.slice(i);} ))];
    if(changed)save();
  }
  function chatMeta(jid) {reconcile();return db.chats[canonical(jid)] || {}; }
  function meta(jid) {reconcile();return db.chats[canonical(jid)] ||= { tags: [], notes: '', stage: 'new', pinned: false, archived: false, mutedUntil: 0 }; }
  function state() {reconcile();return { ...db, seen: undefined, autoSent: undefined }; }
  function changed() { save(); emit({ event: 'panel.state' }); }
  function enrich(chat) {
    const m = chatMeta(chat.jid);
    const unread = m.unread === true ? Math.max(1, chat.unread || 0) : m.unread === false && (!chat.last || chat.last.fromMe || chat.last.timestamp <= (m.readThrough || 0)) ? 0 : chat.unread;
    return { ...chat, unread, meta: m };
  }
  async function records(jid, page = 1, offset = 50) { return api(`/chat/findMessages/${instance}`, { where: { key: { remoteJid: validJid(jid) } }, page, offset }); }
  async function record(jid, id) {
    const result = await api(`/chat/findMessages/${instance}`, { where: { key: { remoteJid: validJid(jid), id: text(id, 200) } }, page: 1, offset: 1 });
    const row = result.messages?.records?.find(r => r.key?.id === id && canonical(r.key.remoteJid) === jid);
    if (!row) throw Error('A mensagem não está mais disponível no histórico.');
    return row;
  }
  function asset(id) {
    if (typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id)) throw Error('Anexo inválido.');
    const info = JSON.parse(fs.readFileSync(path.join(assetsDir, id + '.json'), 'utf8'));
    return { ...info, buffer: fs.readFileSync(path.join(assetsDir, id)) };
  }
  function upload(body) {
    const mime = text(body.mimetype, 150).toLowerCase();
    if (!/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mime) || typeof body.base64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.base64)) throw Error('Arquivo inválido.');
    const buffer = Buffer.from(body.base64, 'base64');
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) throw Error('O arquivo deve ter até 8 MB.');
    const name = text(body.fileName || 'arquivo', 200).replace(/[\r\n\\/]/g, '_');
    const mediatype = mime.startsWith('image/') && !['image/svg+xml','image/gif'].includes(mime) ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'document';
    const id = crypto.createHash('sha256').update(mime).update(buffer).digest('hex');
    const info = { id, mimetype: mime, fileName: name, mediatype, size: buffer.length };
    fs.writeFileSync(path.join(assetsDir, id), buffer); fs.writeFileSync(path.join(assetsDir, id + '.json'), JSON.stringify(info));
    return info;
  }
  function attachmentText(id,value){const a=asset(id);if(a.mediatype==='audio'&&value.trim())throw Error('Áudio não aceita legenda. Envie o texto separadamente, para não perder o conteúdo.');if(value.length>1024)throw Error('A legenda de um anexo deve ter até 1.024 caracteres.');return a;}
  async function send(body) {
    const jid = validJid(body.jid); const value = text(body.text || '');
    let quoted;
    if (body.replyId) { const row = await record(jid, body.replyId); quoted = { key: row.key, message: row.message }; }
    let sent;
    if (body.assetId) {
      const a = attachmentText(body.assetId,value);
      if (a.mediatype === 'audio' && body.voice) sent = await api(`/message/sendWhatsAppAudio/${instance}`, { number: jid, audio: a.buffer.toString('base64'), ...(quoted ? { quoted } : {}) });
      else sent = await api(`/message/sendMedia/${instance}`, { number: jid, mediatype: a.mediatype, mimetype: a.mimetype, fileName: a.fileName, caption: value.slice(0,1024), media: a.buffer.toString('base64'), ...(quoted ? { quoted } : {}) });
    } else {
      if (!value.trim()) throw Error('Digite uma mensagem.');
      sent = await api(`/message/sendText/${instance}`, { number: jid, text: value, ...(quoted ? { quoted } : {}) });
    }
    const message = normalize(sent); emit({ event: 'send.message', jid }); return message;
  }
  function addAlert(alert) { db.alerts.unshift({ id: crypto.randomUUID(), timestamp: now(), read: false, ...alert }); db.alerts = db.alerts.slice(0,100); }
  async function tick() {
    reconcile();
    if (busy) return; busy = true;
    try {
      for (const job of db.jobs.filter(j => j.status === 'queued' && j.at <= now())) {
        if (job.kind === 'message' && now() - job.at > 15*60000) { job.status = 'missed'; job.error = 'O horário passou enquanto o serviço estava desligado. Reagende para enviar.'; changed(); continue; }
        if (job.kind === 'reminder') { job.status = 'done'; addAlert({ title: 'Lembrete de atendimento', text: job.text, jid: job.jid, kind: 'reminder' }); changed(); emit({ event: 'reminder', id: job.id, jid: job.jid, text: job.text }); continue; }
        job.status = 'sending'; save();
        try { await send(job); job.status = 'done'; job.completedAt = now(); }
        catch (e) { job.status = 'failed'; job.error = String(e.message).slice(0,500) + ' Confira a conversa antes de tentar novamente.'; }
        changed();
      }
    } finally { busy = false; }
  }
  function outsideHours(settings) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', weekday:'short',hour:'2-digit',minute:'2-digit',hourCycle:'h23' }).formatToParts(new Date(now())).map(p=>[p.type,p.value]));
    const day = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(parts.weekday);
    const time = parts.hour + ':' + parts.minute;
    const inside = settings.start <= settings.end ? time >= settings.start && time < settings.end : time >= settings.start || time < settings.end;
    return !settings.days.includes(day) || !inside;
  }
  async function inbound(event) {
    reconcile();
    if (!/^messages[._]upsert$/i.test(event.event || '')) return;
    const rows = Array.isArray(event.data) ? event.data : Array.isArray(event.data?.messages) ? event.data.messages : [event.data];
    for (const row of rows) {
      if (!row?.key?.id || !row.key.remoteJid || row.key.fromMe) continue;
      const m = normalize(row);
      if (m.timestamp * 1000 < startedAt - 5000 || m.timestamp * 1000 > now()+300000 || !/@(s\.whatsapp\.net|lid|g\.us)$/.test(m.jid) || db.seen.includes(m.jid+'/'+m.id)) continue;
      if (row.message?.protocolMessage || row.message?.reactionMessage || event.data?.type === 'append') continue;
      db.seen.push(m.jid+'/'+m.id); db.seen = db.seen.slice(-2000);
      meta(m.jid).unread = true;
      save();
      emit({ event:'incoming.message', id:m.id, jid:m.jid, timestamp:m.timestamp, sender:m.sender, text:m.text, kind:m.kind, at:now() });
      if (m.jid.endsWith('@g.us')) continue;
      const away = db.automation.away, greeting = db.automation.greeting;
      const mode = away.enabled && outsideHours(away) ? 'away' : greeting.enabled ? 'greeting' : null;
      if (!mode || !db.automation[mode].text.trim()) continue;
      const autoKey = mode + ':' + m.jid;
      if (db.autoSent[autoKey] && now()-db.autoSent[autoKey]<24*3600000) continue;
      db.autoSent[autoKey] = now(); save();
      try { await send({ jid:m.jid, text:db.automation[mode].text }); }
      catch(e) { addAlert({title:'Resposta automática não enviada',text:String(e.message).slice(0,300),jid:m.jid,kind:'error'}); changed(); }
    }
  }
  const actions = new Set(['business','chat-meta','reorder-pins','tags','quick-replies','favorite','upload','asset-info','send','send-media','reaction','history','jobs','automation','read-alerts']);
  async function handle(action, body) {
    reconcile();
    switch(action) {
      case 'business': return state();
      case 'chat-meta': {
        const jid = validJid(body.jid), m = meta(jid), patch = body.patch || {}; let warning = '';
        for(const field of ['pinned','archived','unread'])if(field in patch&&typeof patch[field]!=='boolean')throw Error('Opção inválida.');
        if ('archived' in patch || 'unread' in patch) {
          try {
            const data = await records(jid,1,50); const rows = data.messages?.records || []; const last = rows[0];
            if ('archived' in patch) await api(`/chat/archiveChat/${instance}`, { chat:last?.key?.remoteJid||jid, archive:!!patch.archived, ...(last ? { lastMessage:{key:last.key,messageTimestamp:Number(last.messageTimestamp)} } : {}) });
            if (patch.unread === true) await api(`/chat/markChatUnread/${instance}`, { chat:last?.key?.remoteJid||jid, ...(last ? {lastMessage:{key:last.key,messageTimestamp:Number(last.messageTimestamp)}} : {}) });
            if (patch.unread === false) { const incoming=rows.filter(r=>!r.key.fromMe); if(incoming.length) await api(`/chat/markMessageAsRead/${instance}`,{readMessages:incoming.map(r=>r.key)}); m.readThrough = Math.max(Math.floor(now()/1000),...rows.map(r=>Number(r.messageTimestamp)||0)); }
          } catch(e) { warning = 'Salvo no painel. A sincronização com o WhatsApp falhou: '+e.message; if(patch.unread===false)m.readThrough=Math.floor(now()/1000); }
        }
        for(const field of ['pinned','archived','unread']) if(field in patch) { if(typeof patch[field]!=='boolean')throw Error('Opção inválida.'); m[field]=patch[field]; }
        if ('pinned' in patch && patch.pinned) m.pinOrder = Math.min(0,...Object.values(db.chats).map(c=>c.pinOrder||0))-1;
        if ('mutedUntil' in patch) { const n=Number(patch.mutedUntil);if(!Number.isFinite(n)||n<0)throw Error('Prazo inválido.');m.mutedUntil=n; }
        if ('tags' in patch) { if(!Array.isArray(patch.tags))throw Error('Etiquetas inválidas.');m.tags=patch.tags.filter(id=>db.tags.some(t=>t.id===id)); }
        if ('notes' in patch) m.notes=text(patch.notes,10000);
        if ('stage' in patch) { if(!['new','progress','waiting','done'].includes(patch.stage))throw Error('Etapa inválida.');m.stage=patch.stage; }
        changed(); return {meta:m,warning};
      }
      case 'reorder-pins': { if(!Array.isArray(body.jids))throw Error('Ordem inválida.');body.jids.forEach((j,i)=>{validJid(j);if(meta(j).pinned)meta(j).pinOrder=i;});changed();return {ok:true}; }
      case 'tags': {
        if(body.remove){db.tags=db.tags.filter(t=>t.id!==body.remove);for(const m of Object.values(db.chats))m.tags=(m.tags||[]).filter(id=>id!==body.remove);}
        else {const name=text(body.name,50).trim();if(!name)throw Error('Digite o nome da etiqueta.');if(!/^#[0-9a-f]{6}$/i.test(body.color))throw Error('Cor inválida.');const t=db.tags.find(t=>t.id===body.id);if(t)Object.assign(t,{name,color:body.color});else db.tags.push({id:crypto.randomUUID(),name,color:body.color});}
        changed();return db.tags;
      }
      case 'quick-replies': {
        if(body.remove)db.replies=db.replies.filter(r=>r.id!==body.remove);
        else {const shortcut=text(body.shortcut,30).trim().replace(/^\//,'');if(!/^[\p{L}\p{N}_-]+$/u.test(shortcut))throw Error('Use letras, números, _ ou - no atalho.');const value=text(body.text||'');if(!value.trim()&&!body.assetId)throw Error('Informe uma resposta ou anexo.');if(body.assetId)attachmentText(body.assetId,value);if(db.replies.some(r=>r.shortcut===shortcut&&r.id!==body.id))throw Error('Este atalho já existe.');const reply={id:body.id||crypto.randomUUID(),shortcut,text:value,assetId:body.assetId||null};const i=db.replies.findIndex(r=>r.id===reply.id);if(i<0)db.replies.push(reply);else db.replies[i]=reply;}
        changed();return db.replies;
      }
      case 'favorite': {const jid=validJid(body.jid);if(body.remove)db.favorites=db.favorites.filter(f=>!(f.jid===jid&&f.message.id===body.id));else{const row=await record(jid,body.id);if(!db.favorites.some(f=>f.jid===jid&&f.message.id===body.id))db.favorites.push({jid,message:normalize(row),savedAt:now()});}changed();return db.favorites;}
      case 'upload': return upload(body);
      case 'asset-info': {const {buffer,...info}=asset(body.id);return info;}
      case 'send': case 'send-media': return send(body);
      case 'reaction': {const row=await record(validJid(body.jid),body.id);const reaction=text(body.reaction||'',16);await api(`/message/sendReaction/${instance}`,{key:row.key,reaction});emit({event:'message.reaction',jid:body.jid});return {ok:true};}
      case 'history': {
        if(searchHistory){const d=await searchHistory(body);return {...d,nextPage:d.page<d.pages?d.page+1:null,scanned:d.index?.indexed||d.total};}
        const query=text(body.query||'',200).toLocaleLowerCase('pt-BR');let p=Math.max(1,Math.floor(Number(body.page)||1)),matches=[],scanned=0,pages=1;
        const from=body.from?new Date(body.from+'T00:00:00-03:00').getTime()/1000:0,to=body.to?new Date(body.to+'T23:59:59-03:00').getTime()/1000:Infinity;
        for(let batch=0;batch<5;batch++){
          const d=await api(`/chat/findMessages/${instance}`,{where:body.jid?{key:{remoteJid:validJid(body.jid)}}:{},page:p,offset:100});pages=d.messages?.pages||0;
          for(const row of d.messages?.records||[]){const m=normalize(row);scanned++;const type=body.kind||'all';if(m.timestamp>=from&&m.timestamp<=to&&(!query||(m.text+' '+m.fileName).toLocaleLowerCase('pt-BR').includes(query))&&(type==='all'||type===m.kind||type==='media'&&['image','video','audio','document'].includes(m.kind)||type==='links'&&/https?:\/\//i.test(m.text)))matches.push(m);}
          p++;if(matches.length>=30||p>pages)break;
        }
        return {records:matches,nextPage:p<=pages?p:null,scanned,pages};
      }
      case 'jobs': {
        if(body.cancel){const j=db.jobs.find(j=>j.id===body.cancel);if(j?.status==='queued')j.status='cancelled';}
        else{const jid=validJid(body.jid),at=Number(body.at);if(!Number.isFinite(at)||at<now()+5000)throw Error('Escolha um horário futuro.');const value=text(body.text||'');if(!value.trim()&&!body.assetId)throw Error('Digite o conteúdo.');if(body.assetId)attachmentText(body.assetId,value);if(!['message','reminder'].includes(body.kind))throw Error('Tipo inválido.');db.jobs.push({id:crypto.randomUUID(),jid,at,text:value,assetId:body.assetId||null,voice:!!body.voice,kind:body.kind,status:'queued',createdAt:now()});}
        changed();return db.jobs;
      }
      case 'automation': {
        for(const mode of ['greeting','away']){const s=body[mode];if(!s)continue;const next={...db.automation[mode],enabled:!!s.enabled,text:text(s.text||'',4000)};if(next.enabled&&!next.text.trim())throw Error('Preencha a mensagem automática.');if(mode==='away'){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s.end)||s.start===s.end)throw Error('Informe um intervalo de atendimento válido.');if(!Array.isArray(s.days)||!s.days.length||s.days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Selecione os dias de atendimento.');Object.assign(next,{start:s.start,end:s.end,days:s.days});}db.automation[mode]=next;}
        changed();return db.automation;
      }
      case 'read-alerts': db.alerts.forEach(a=>a.read=true);changed();return {ok:true};
    }
  }
  return { has: action=>actions.has(action), handle, state, enrich, asset, inbound, tick, outsideHours };
}
module.exports = { createBusiness };
