const {DatabaseSync}=require('node:sqlite');
function createSearchIndex({file,fetchPage,normalize,identities,emit=()=>{}}){
  const db=new DatabaseSync(file);db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS messages(source TEXT NOT NULL,id TEXT NOT NULL,jid TEXT NOT NULL,stamp INTEGER NOT NULL,body TEXT NOT NULL,filename TEXT NOT NULL,sender TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,UNIQUE(source,id));
    CREATE INDEX IF NOT EXISTS conversation_time ON messages(jid,stamp DESC);
    CREATE VIRTUAL TABLE IF NOT EXISTS words USING fts5(body,filename,sender,content='messages',content_rowid='rowid',tokenize='unicode61 remove_diacritics 2');
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN INSERT INTO words(rowid,body,filename,sender) VALUES(new.rowid,new.body,new.filename,new.sender);END;
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN INSERT INTO words(words,rowid,body,filename,sender) VALUES('delete',old.rowid,old.body,old.filename,old.sender);END;
    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE OF body,filename,sender ON messages BEGIN INSERT INTO words(words,rowid,body,filename,sender) VALUES('delete',old.rowid,old.body,old.filename,old.sender);INSERT INTO words(rowid,body,filename,sender) VALUES(new.rowid,new.body,new.filename,new.sender);END;`);
  const upsert=db.prepare(`INSERT INTO messages(source,id,jid,stamp,body,filename,sender,kind,payload) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(source,id) DO UPDATE SET jid=excluded.jid,stamp=excluded.stamp,body=excluded.body,filename=excluded.filename,sender=excluded.sender,kind=excluded.kind,payload=excluded.payload WHERE messages.payload<>excluded.payload OR messages.jid<>excluded.jid`);
  let ready=false,running=false,completeOnce=false,lastEmit=0,indexed=Number(db.prepare('SELECT count(*) AS n FROM messages').get().n),total=0,error=null,identityVersion=-1;
  function status(){return {ready,indexed,total,running,error};}
  function rekey(){if(identityVersion===identities.version)return;db.exec('BEGIN');try{const stmt=db.prepare('UPDATE messages SET jid=? WHERE source=? AND jid<>?');for(const row of db.prepare('SELECT DISTINCT source FROM messages').all()){const primary=identities.canonical(row.source);stmt.run(primary,row.source,primary);}db.exec('COMMIT');identityVersion=identities.version;}catch(e){db.exec('ROLLBACK');throw e;}}
  function ingest(rows){if(!Array.isArray(rows))rows=[rows];for(const row of rows)identities.observe(row);identities.flush();db.exec('BEGIN');try{for(const row of rows){if(!row?.key?.id||!row.message||!/^\w[\w.:-]*@(s\.whatsapp\.net|g\.us|lid)$/.test(row.key.remoteJid||''))continue;const m=normalize(row);upsert.run(row.key.remoteJid,String(m.id),m.jid,m.timestamp||0,m.text||'',m.fileName||'',m.sender||'',m.kind||'text',JSON.stringify(m));}db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}rekey();indexed=Number(db.prepare('SELECT count(*) AS n FROM messages').get().n);}
  function decode(row){const m=JSON.parse(row.payload);return {...m,jid:identities.canonical(row.source),sourceJid:row.source};}
  function expression(query){return (String(query||'').match(/[\p{L}\p{N}_]+/gu)||[]).slice(0,20).map(t=>'"'+t+'"*').join(' AND ');}
  function query({query='',jid,page=1,limit=30,kind='all',from,to}={}){
    rekey();limit=Math.min(100,Math.max(1,Number(limit)||30));page=Math.max(1,Math.floor(Number(page)||1));
    const fts=expression(query),where=[],params=[];let source='messages m';if(fts){source+=' JOIN words ON words.rowid=m.rowid';where.push('words MATCH ?');params.push('{body filename}: ('+fts+')');}else if(String(query).trim())return {records:[],total:0,page,pages:0,...{index:status()}};
    if(jid){where.push('m.jid=?');params.push(identities.canonical(jid));}
    if(kind==='media')where.push("m.kind IN ('image','audio','video','document')");else if(kind==='links')where.push("(m.body LIKE '%https://%' OR m.body LIKE '%http://%')");else if(kind!=='all'){where.push('m.kind=?');params.push(kind);}
    if(from){const n=Date.parse(from+'T00:00:00-03:00');if(!Number.isFinite(n))throw Error('Data inicial inválida.');where.push('m.stamp>=?');params.push(Math.floor(n/1000));}
    if(to){const n=Date.parse(to+'T23:59:59-03:00');if(!Number.isFinite(n))throw Error('Data final inválida.');where.push('m.stamp<=?');params.push(Math.floor(n/1000));}
    const base=`SELECT m.*,ROW_NUMBER() OVER(PARTITION BY m.jid,m.id ORDER BY m.stamp DESC,m.source DESC) AS rn FROM ${source}${where.length?' WHERE '+where.join(' AND '):''}`;
    const count=Number(db.prepare(`WITH hits AS (${base}) SELECT count(*) AS n FROM hits WHERE rn=1`).get(...params).n);
    const records=db.prepare(`WITH hits AS (${base}) SELECT * FROM hits WHERE rn=1 ORDER BY stamp DESC,id DESC LIMIT ? OFFSET ?`).all(...params,limit,(page-1)*limit).map(decode);
    return {records,total:count,page,pages:Math.ceil(count/limit),index:status()};
  }
  function notify(force=false){if(force||Date.now()-lastEmit>2500){lastEmit=Date.now();emit({event:'search.index',index:status()});}}
  async function sync(full=false){if(running)return;running=true;error=null;try{
    // Re-scan an overlapping first page at the end so messages arriving during a rebuild aren't skipped.
    let page=1,pages=1;do{const result=await fetchPage(page,500);total=result.messages?.total||0;pages=result.messages?.pages||0;ingest(result.messages?.records||[]);notify();page++;if(!full&&completeOnce)break;}while(page<=pages);
    if(full||!completeOnce){const head=await fetchPage(1,500);ingest(head.messages?.records||[]);total=head.messages?.total||total;completeOnce=true;ready=true;}
  }catch(e){error='Não foi possível atualizar o índice. Os dados já preparados continuam disponíveis.';}finally{running=false;notify(true);}}
  function updates(data){for(const item of Array.isArray(data)?data:[data]){const id=item?.keyId||item?.key?.id||item?.id;const status=item?.status??item?.update?.status;if(!id||status===undefined)continue;for(const row of db.prepare('SELECT rowid,payload FROM messages WHERE id=?').all(String(id))){const m=JSON.parse(row.payload);m.status=typeof status==='number'?({0:'ERROR',1:'PENDING',2:'SERVER_ACK',3:'DELIVERY_ACK',4:'READ',5:'PLAYED'}[status]||m.status):status;db.prepare('UPDATE messages SET payload=? WHERE rowid=?').run(JSON.stringify(m),row.rowid);}}}
  return {ingest,updates,query,status,sync,close:()=>db.close()};
}
module.exports={createSearchIndex};
