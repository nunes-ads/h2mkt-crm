const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createBusiness } = require('./business.cjs');
const {createIdentities}=require('./identities.cjs');
const {createSearchIndex}=require('./search-index.cjs');
const {createConnectionQR}=require('./connection-qr.cjs');
const connectionQR=createConnectionQR();
let connectPending=null;
const identities=createIdentities(path.join(__dirname,'chat-identities.json'));
const API = 'http://127.0.0.1:18080';
const PORT = 18765;
const INSTANCE = 'teste-local';
const ORIGIN = `http://127.0.0.1:${PORT}`;
const key = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').match(/^AUTHENTICATION_API_KEY=(.+)$/m)[1].trim();
const configPath = path.join(__dirname, 'local-config.json');
if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify({ webhookSecret: crypto.randomBytes(32).toString('hex') }));
const { webhookSecret } = JSON.parse(fs.readFileSync(configPath));
const clients = new Set();
const mediaCache = new Map();
const groupNamesPath = path.join(__dirname, 'group-names.json');
const groupNames = new Map(fs.existsSync(groupNamesPath) ? JSON.parse(fs.readFileSync(groupNamesPath, 'utf8')).map(g => [g.id, g.subject]) : []);
let groupNamesExpireAt = fs.existsSync(groupNamesPath) ? fs.statSync(groupNamesPath).mtimeMs + 5 * 60 * 1000 : 0;
let groupRefresh = null;
let lastEventAt = null;
function persistGroupNames() { fs.writeFileSync(groupNamesPath, JSON.stringify([...groupNames].map(([id, subject]) => ({ id, subject })))); }
function rememberGroups(data) {
  let changed = false;
  for (const group of Array.isArray(data) ? data : [data]) {
    if (group?.id?.endsWith('@g.us') && typeof group.subject === 'string' && group.subject.trim() && groupNames.get(group.id) !== group.subject) {
      groupNames.set(group.id, group.subject); changed = true;
    }
  }
  if (changed) persistGroupNames();
  return changed;
}
function refreshGroupNames() {
  if (Date.now() < groupNamesExpireAt || groupRefresh) return;
  groupRefresh = api(`/group/fetchAllGroups/${INSTANCE}?getParticipants=false`)
    .then(groups => { const changed = rememberGroups(groups); groupNamesExpireAt = Date.now() + 5 * 60 * 1000; if (changed) emit({ event: 'group.names.update' }); })
    .catch(() => { groupNamesExpireAt = Date.now() + 60000; })
    .finally(() => { groupRefresh = null; });
}
function conversationName(c, contact) {
  if (c.remoteJid.endsWith('@g.us')) return groupNames.get(c.remoteJid) || `Grupo ${c.remoteJid.split('@')[0]}`;
  return contact?.pushName || c.pushName || '';
}
function unwrap(message) {
  let m = message || {};
  for (let i = 0; i < 5; i++) {
    const inner = m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.documentWithCaptionMessage;
    if (!inner?.message) break;
    m = inner.message;
  }
  return m;
}
function content(row) {
  const m = unwrap(row.message);
  const kinds = ['image', 'video', 'audio', 'document', 'sticker'];
  const kind = kinds.find(k => m[k + 'Message']);
  const a = kind ? m[kind + 'Message'] : {};
  return { kind: kind || (m.reactionMessage ? 'reaction' : 'text'), text: m.conversation || m.extendedTextMessage?.text || a.caption || (m.reactionMessage ? 'Reação: ' + m.reactionMessage.text : '') || (!kind ? (m.protocolMessage ? 'Atualização da conversa' : 'Mensagem não suportada neste painel') : ''), fileName: a.fileName || '', mimetype: a.mimetype || '', seconds: a.seconds || 0 };
}
function timestamp(value) { const n = Number(value); return n > 1e12 ? Math.floor(n / 1000) : (n || 0); }
function message(row) { const m=unwrap(row.message), context=m.extendedTextMessage?.contextInfo || m.imageMessage?.contextInfo || m.videoMessage?.contextInfo; return { id: row.key?.id || row.id, jid: identities.canonical(row.key?.remoteJid),sourceJid:row.key?.remoteJid, fromMe: !!row.key?.fromMe, sender: row.pushName || '', timestamp: timestamp(row.messageTimestamp), status: row.status || row.MessageUpdate?.at(-1)?.status || '', reply:context?.stanzaId?{id:context.stanzaId,text:content({message:context.quotedMessage}).text||'Anexo',sender:context.participant||''}:null,...content(row) }; }
async function rawApi(route, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(API + route, { method, headers: { apikey: key, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000) });
  const data = await response.json();
  if (!response.ok) { const e = new Error(data.response?.message?.join?.(' ') || data.message || `A API retornou erro ${response.status}.`); e.status = response.status; throw e; }
  const version=identities.version;
  const rows=data.messages?.records||(data.key?[data]:Array.isArray(data)?data.map(c=>c.lastMessage).filter(Boolean):[]);
  for(const row of rows)identities.observe(row);identities.flush();
  if(version!==identities.version)emit({event:'identities.update'});
  if(route.startsWith('/message/')&&data.key&&data.message){try{searchIndex.ingest([data]);}catch{console.error('A mensagem foi enviada; a atualização da busca será refeita.');}}
  return data;
}
async function api(route,body,method){
  const key=body?.where?.key,aliases=key?.remoteJid?identities.aliases(key.remoteJid):[];
  if(!route.startsWith('/chat/findMessages/')||aliases.length<2)return rawApi(route,body,method);
  const page=Math.max(1,Math.floor(Number(body.page)||1)),offset=Math.max(1,Math.floor(Number(body.offset)||50));
  const results=await Promise.all(aliases.map(remoteJid=>rawApi(route,{...body,page:1,offset:page*offset,where:{...body.where,key:{...key,remoteJid}}},method)));
  const unique=new Map();let observed=0;
  for(const result of results)for(const row of result.messages?.records||[]){if(!aliases.includes(row.key?.remoteJid))continue;observed++;const id=row.key.id,old=unique.get(id);if(!old||timestamp(row.messageTimestamp)>=timestamp(old.messageTimestamp))unique.set(id,row);}
  const all=[...unique.values()].sort((a,b)=>timestamp(b.messageTimestamp)-timestamp(a.messageTimestamp)||String(b.key.id).localeCompare(String(a.key.id)));
  const total=Math.max(all.length,results.reduce((n,r)=>n+(r.messages?.total||0),0)-(observed-all.length));
  return {messages:{total,pages:Math.ceil(total/offset),currentPage:page,records:all.slice((page-1)*offset,page*offset)}};
}
function emit(data) { for (const res of clients) res.write(`event: update\ndata: ${JSON.stringify(data)}\n\n`); }
async function readJSON(req, limit = 12 * 1024 * 1024) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > limit) { const e = new Error('Arquivo muito grande. O limite deste painel é 8 MB.'); e.status = 413; throw e; } chunks.push(chunk); } return JSON.parse(Buffer.concat(chunks).toString() || '{}'); }
function json(res, data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }
function jid(value) { if (typeof value !== 'string' || !/^[\w.:-]+@(s\.whatsapp\.net|g\.us|lid)$/.test(value)) throw new Error('Contato inválido.'); return identities.canonical(value); }
const searchIndex=createSearchIndex({file:path.join(__dirname,'message-search.sqlite'),fetchPage:(page,offset)=>rawApi(`/chat/findMessages/${INSTANCE}`,{page,offset}),normalize:message,identities,emit});
const business = createBusiness({directory:__dirname,api,instance:INSTANCE,emit,normalize:message,validJid:jid,identityVersion:()=>identities.version,searchHistory:body=>searchIndex.query({...body,jid:body.jid?jid(body.jid):undefined,limit:50})});
setImmediate(()=>searchIndex.sync(true));
setInterval(()=>searchIndex.sync(!searchIndex.status().ready),20000).unref();
setInterval(()=>business.tick().catch(()=>console.error('Falha ao processar agendamentos.')),5000).unref();
function serveMedia(req,res,media){
  const safeType=/^(image\/(jpeg|png|webp|gif)|audio\/[\w.+-]+|video\/(mp4|webm))$/.test(media.type||media.mimetype)?(media.type||media.mimetype):'application/octet-stream';
  const headers={'Content-Type':safeType,'Accept-Ranges':'bytes',...(safeType==='application/octet-stream'?{'Content-Disposition':`attachment; filename*=UTF-8''${encodeURIComponent(media.fileName||'arquivo')}`}:{})};
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),media.buffer.length-1):media.buffer.length-1;if(start>end||start>=media.buffer.length){res.writeHead(416,{'Content-Range':`bytes */${media.buffer.length}`});return res.end();}res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${media.buffer.length}`,'Content-Length':end-start+1});return res.end(media.buffer.subarray(start,end+1));}
  res.writeHead(200,{...headers,'Content-Length':media.buffer.length});res.end(media.buffer);
}
const server = http.createServer(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const url = new URL(req.url, ORIGIN);
    if (url.pathname === '/webhook' && req.method === 'POST') {
      if (req.headers['x-webhook-secret'] !== webhookSecret) return json(res, { error: 'Acesso negado.' }, 403);
      const event = await readJSON(req);
      if (event.instance !== INSTANCE) return json(res, { ok: true });
      if(/^messages[._](upsert|set|edited)$/i.test(event.event||'')){const rows=Array.isArray(event.data?.messages)?event.data.messages:Array.isArray(event.data)?event.data:[event.data];searchIndex.ingest(rows);}
      if(/^messages[._]update$/i.test(event.event||''))searchIndex.updates(event.data);
      if (/^groups?[._](update|upsert)$/i.test(event.event || '')) { rememberGroups(event.data); groupNamesExpireAt = 0; }
      lastEventAt = Date.now();
      const eventName=String(event.event||'').toLowerCase().replaceAll('_','.');
      if(eventName==='connection.update'&&['open','close'].includes(event.data?.state))connectionQR.clear();
      let qr;
      if(eventName==='qrcode.updated'){
        qr=connectionQR.update(event.data);
        if(!qr)connectionQR.clear();
      }
      emit({ event: eventName, jid: identities.canonical(event.data?.key?.remoteJid || event.data?.remoteJid || null), at: lastEventAt, ...(eventName==='qrcode.updated'?{qr}:{}), ...(eventName==='connection.update'?{state:event.data?.state}:{}) });
      business.inbound(event).catch(()=>console.error('Falha ao processar evento recebido.'));
      return json(res, { ok: true });
    }
    if (req.headers.host !== `127.0.0.1:${PORT}` || (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site']))) return json(res, { error: 'Acesso local apenas.' }, 403);
    if (req.method === 'GET' && ['/', '/app.js', '/features.js','/search.js', '/style.css', '/business.css','/search.css'].includes(url.pathname)) {
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8');
      res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob: https:; media-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'");
      return res.end(fs.readFileSync(path.join(__dirname, 'web', file)));
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Connection': 'keep-alive' });
      res.write('event: ready\ndata: {}\n\n'); clients.add(res);
      const timer = setInterval(() => res.write(': keepalive\n\n'), 20000);
      req.on('close', () => { clients.delete(res); clearInterval(timer); }); return;
    }
    if(req.method==='GET'&&url.pathname.startsWith('/asset/'))return serveMedia(req,res,business.asset(url.pathname.slice(7)));
    if (req.method === 'GET' && url.pathname === '/media') {
      const remoteJid = jid(url.searchParams.get('jid')); const id = url.searchParams.get('id');
      if (!id || id.length > 200) throw new Error('Mensagem inválida.');
      const cacheKey = remoteJid + '/' + id;
      let media = mediaCache.get(cacheKey);
      if (!media) {
        const records = await api(`/chat/findMessages/${INSTANCE}`, { where: { key: { remoteJid, id } }, page: 1, offset: 1 });
        const row = records.messages?.records?.find(r => r.key?.id === id && identities.canonical(r.key?.remoteJid) === remoteJid);
        if (!row) throw new Error('Mensagem não encontrada.');
        const data = await api(`/chat/getBase64FromMediaMessage/${INSTANCE}`, { message: { key: row.key, message: row.message }, convertToMp4: false });
        const base64 = data.base64?.replace(/^data:[^,]+,/, '');
        if (!base64) throw new Error('Mídia indisponível.');
        media = { buffer: Buffer.from(base64, 'base64'), type: data.mimetype || content(row).mimetype || 'application/octet-stream',fileName:content(row).fileName };
        if (media.buffer.length > 20 * 1024 * 1024) throw new Error('Mídia grande demais para visualizar.');
        if (mediaCache.size >= 20) mediaCache.delete(mediaCache.keys().next().value);
        mediaCache.set(cacheKey, media);
      }
      return serveMedia(req,res,media);
    }
    if (req.method !== 'POST' || req.headers.origin !== ORIGIN || req.headers['x-local-test'] !== '1') return json(res, { error: 'Acesso negado.' }, 403);
    const body = await readJSON(req);
    if(url.pathname.startsWith('/action/')&&business.has(url.pathname.slice(8)))return json(res,await business.handle(url.pathname.slice(8),body));
    switch (url.pathname) {
      case '/action/search': {if(typeof body.query!=='string'||body.query.length>200)throw Error('Digite uma pesquisa de até 200 caracteres.');return json(res,searchIndex.query({query:body.query,jid:body.jid?jid(body.jid):undefined,page:body.page,limit:30}));}
      case '/action/status': { const state = await api(`/instance/connectionState/${INSTANCE}`); return json(res, { ...state, lastEventAt }); }
      case '/action/connect': {
        if(!connectPending){
          const revision=connectionQR.revision;
          connectPending=api(`/instance/connect/${INSTANCE}`).then(data=>({qr:connectionQR.revision===revision?connectionQR.update(data):connectionQR.current()})).finally(()=>{connectPending=null;});
        }
        return json(res,await connectPending);
      }
      case '/action/chats': {
        refreshGroupNames();
        const [chats, contacts] = await Promise.all([api(`/chat/findChats/${INSTANCE}`, {}), api(`/chat/findContacts/${INSTANCE}`, {})]);
        const names = new Map((Array.isArray(contacts) ? contacts : []).map(c => [c.remoteJid, c]));
        const combined = new Map();
        for (const c of Array.isArray(chats) ? chats : []) { const contact = names.get(c.remoteJid); if (!c.remoteJid || c.remoteJid === 'status@broadcast' || c.remoteJid.endsWith('@newsletter')) continue;
          const last = c.lastMessage ? message(c.lastMessage) : null;
          combined.set(c.remoteJid, { jid: c.remoteJid, name: conversationName(c, contact), avatar: contact?.profilePicUrl || c.profilePicUrl || '', last, timestamp: last?.timestamp || Math.floor(new Date(c.updatedAt || 0).getTime() / 1000), unread: c.unreadCount || 0, isGroup: c.remoteJid.endsWith('@g.us') });
        }
        for (const c of Array.isArray(contacts) ? contacts : []) { if (!c.remoteJid || combined.has(c.remoteJid) || !/@(s\.whatsapp\.net|g\.us|lid)$/.test(c.remoteJid)) continue; combined.set(c.remoteJid, { jid: c.remoteJid, name: conversationName(c), avatar: c.profilePicUrl || '', timestamp: 0, unread: 0, isGroup: c.remoteJid.endsWith('@g.us') }); }
        return json(res, identities.mergeChats([...combined.values()]).map(c=>business.enrich(c)).sort((a,b) => b.timestamp - a.timestamp));
      }
      case '/action/messages': {
        const remoteJid = jid(body.jid); const page = Math.min(10000, Math.max(1, Number(body.page) || 1));
        if(searchIndex.status().ready){const result=searchIndex.query({jid:remoteJid,page,limit:50});return json(res,{records:result.records.reverse(),page,pages:result.pages,total:result.total});}
        const data = await api(`/chat/findMessages/${INSTANCE}`, { where: { key: { remoteJid } }, page, offset: 50 });
        return json(res, { records: (data.messages?.records || []).map(message).sort((a,b) => a.timestamp - b.timestamp), page, pages: data.messages?.pages || 0, total: data.messages?.total || 0 });
      }
      case '/action/send': {
        const remoteJid = jid(body.jid);
        if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 16000) throw new Error('Digite uma mensagem de até 16 mil caracteres.');
        const sent = await api(`/message/sendText/${INSTANCE}`, { number: remoteJid, text: body.text });
        emit({ event: 'send.message', jid: remoteJid }); return json(res, message(sent));
      }
      case '/action/send-image': {
        const remoteJid = jid(body.jid);
        if (!['image/jpeg','image/png','image/webp'].includes(body.mimetype) || typeof body.base64 !== 'string') throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
        if (Buffer.byteLength(body.base64, 'base64') > 8 * 1024 * 1024) throw new Error('A imagem deve ter até 8 MB.');
        const sent = await api(`/message/sendMedia/${INSTANCE}`, { number: remoteJid, mediatype: 'image', mimetype: body.mimetype, caption: String(body.caption || '').slice(0, 1024), media: body.base64, fileName: String(body.fileName || 'imagem').slice(0, 200) });
        emit({ event: 'send.message', jid: remoteJid }); return json(res, message(sent));
      }
      default: return json(res, { error: 'Não encontrado.' }, 404);
    }
  } catch (e) { return json(res, { error: e.name === 'TimeoutError' ? 'A API demorou para responder. Tente novamente.' : String(e.message || 'Falha ao acessar a API.') }, e.status || 502); }
});
server.listen(PORT, '127.0.0.1', () => console.log(`Painel local: ${ORIGIN}`));
