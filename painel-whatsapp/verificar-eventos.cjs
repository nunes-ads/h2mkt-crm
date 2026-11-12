const fs=require('node:fs');
const {webhookSecret}=JSON.parse(fs.readFileSync('local-config.json','utf8'));
(async()=>{
 const controller=new AbortController();
 const timer=setTimeout(()=>{console.error('Eventos: tempo esgotado');process.exitCode=1;controller.abort()},10000);
 const response=await fetch('http://127.0.0.1:18765/events',{signal:controller.signal});
 const reader=response.body.getReader();let buffer='',sent=false;
 try{while(true){const {value,done}=await reader.read();if(done)break;buffer+=new TextDecoder().decode(value);
 if(buffer.includes('event: ready')&&!sent){sent=true;await fetch('http://127.0.0.1:18765/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-webhook-secret':webhookSecret},body:JSON.stringify({instance:'teste-local',event:'interface.healthcheck',data:{}})});}
 if(buffer.includes('interface.healthcheck')){console.log('Eventos: webhook autenticado recebido pelo fluxo ao vivo.');clearTimeout(timer);controller.abort();break;}
 }}catch(e){if(e.name!=='AbortError')throw e;}
 const denied=await fetch('http://127.0.0.1:18765/webhook',{method:'POST',body:'{}'});console.log('Webhook sem autenticação: HTTP '+denied.status);
})();
