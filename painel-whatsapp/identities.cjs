const fs=require('node:fs');
function createIdentities(file){
  const mappings=new Map(fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[]);let version=0,dirty=false;
  function canonical(jid){return mappings.get(jid)||jid;}
  function observe(row){
    const key=row?.key;if(!key)return false;
    const a=key.remoteJid,b=key.remoteJidAlt;
    if(typeof a!=='string'||typeof b!=='string')return false;
    const phone=a.endsWith('@s.whatsapp.net')?a:b.endsWith('@s.whatsapp.net')?b:null;
    const lid=a.endsWith('@lid')?a:b.endsWith('@lid')?b:null;
    if(!phone||!lid||!/^\d+@s\.whatsapp\.net$/.test(phone)||!/^\d+@lid$/.test(lid))return false;
    // Names and profile pictures are never evidence that two accounts are the same.
    if(mappings.has(lid)&&mappings.get(lid)!==phone)return false;
    if(mappings.get(lid)===phone)return false;
    mappings.set(lid,phone);version++;dirty=true;return true;
  }
  function flush(){if(dirty){fs.writeFileSync(file+'.tmp',JSON.stringify([...mappings]));fs.renameSync(file+'.tmp',file);dirty=false;}}
  function aliases(jid){const primary=canonical(jid);return [primary,...[...mappings].filter(([,v])=>v===primary).map(([k])=>k)];}
  function mergeChats(chats){const merged=new Map();for(const chat of chats){const primary=canonical(chat.jid),old=merged.get(primary);const next={...chat,jid:primary,aliases:aliases(primary)};if(!old){merged.set(primary,next);continue;}const latest=(next.last?.timestamp||next.timestamp||0)>(old.last?.timestamp||old.timestamp||0)?next:old;merged.set(primary,{...old,...latest,jid:primary,aliases:aliases(primary),name:old.name||next.name,avatar:latest.avatar||old.avatar||next.avatar,last:latest.last,unread:Math.max(old.unread||0,next.unread||0)});}return [...merged.values()];}
  return {canonical,observe,flush,aliases,mergeChats,get version(){return version;}};
}
module.exports={createIdentities};
