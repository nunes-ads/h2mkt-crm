'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process'),{promisify}=require('node:util');
const exec=promisify(cp.execFile),root=__dirname,instance='teste-local';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function prepararArquivos(){
  if(Number(process.versions.node.split('.')[0])<24)throw Error('Instale o Node.js 24 ou mais recente.');
  const envFile=path.join(root,'.env'),configFile=path.join(root,'local-config.json');
  if(!fs.existsSync(envFile)){
    const template=fs.readFileSync(path.join(root,'.env.example'),'utf8');
    fs.writeFileSync(envFile,template.replaceAll('{{API_KEY}}',crypto.randomBytes(32).toString('hex')).replaceAll('{{DB_PASSWORD}}',crypto.randomBytes(24).toString('hex')),{flag:'wx',mode:0o600});
  }
  if(!fs.existsSync(configFile))fs.writeFileSync(configFile,JSON.stringify({webhookSecret:crypto.randomBytes(32).toString('hex')}),{flag:'wx',mode:0o600});
  const env=Object.fromEntries(fs.readFileSync(envFile,'utf8').split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1).trim()];}));
  if(!env.AUTHENTICATION_API_KEY||env.AUTHENTICATION_API_KEY.includes('{{'))throw Error('A chave local ainda nao foi configurada.');
  const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
  if(!config.webhookSecret)throw Error('O arquivo local-config.json precisa conter webhookSecret.');
  return {env,config};
}

async function main(){
  const {env,config}=prepararArquivos();
  if(process.argv.includes('--preparar-arquivos')){console.log('Arquivos de configuracao preparados, com credenciais locais proprias.');return;}
  console.log('Preparando a Evolution e o painel. A primeira montagem pode demorar alguns minutos.');
  await exec('docker',['desktop','start'],{windowsHide:true,timeout:120000}).catch(()=>{});
  let dockerReady=false;
  for(let i=0;i<60;i++){try{await exec('docker',['info','--format','{{.ServerVersion}}'],{windowsHide:true,timeout:5000});dockerReady=true;break;}catch{await delay(2000);}}
  if(!dockerReady)throw Error('Abra o Docker Desktop, aguarde a inicializacao e execute novamente.');
  await exec('docker',['compose','build','api'],{cwd:root,windowsHide:true,timeout:900000,maxBuffer:8*1024*1024});
  await exec('docker',['compose','up','-d'],{cwd:root,windowsHide:true,timeout:180000,maxBuffer:4*1024*1024});
  async function api(route,body){
    const response=await fetch('http://127.0.0.1:18080'+route,{method:body===undefined?'GET':'POST',headers:{apikey:env.AUTHENTICATION_API_KEY,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
    const data=await response.json();
    if(!response.ok){const error=Error('A Evolution retornou HTTP '+response.status+' ao preparar a conexao.');error.status=response.status;throw error;}
    return data;
  }
  let ready=false;
  for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:18080/',{signal:AbortSignal.timeout(3000)});if(r.ok){ready=true;break;}}catch{}await delay(2000);}
  if(!ready)throw Error('A Evolution ainda nao iniciou. Execute novamente depois de conferir o Docker Desktop.');
  try{await api('/instance/connectionState/'+instance);}catch(error){
    if(error.status!==404)throw error;
    await api('/instance/create',{instanceName:instance,integration:'WHATSAPP-BAILEYS',qrcode:false});
  }
  await api('/webhook/set/'+instance,{webhook:{enabled:true,url:'http://host.docker.internal:18765/webhook',headers:{'x-webhook-secret':config.webhookSecret},webhookByEvents:false,webhookBase64:false,events:['QRCODE_UPDATED','MESSAGES_UPSERT','MESSAGES_UPDATE','MESSAGES_SET','SEND_MESSAGE','CHATS_UPSERT','CHATS_UPDATE','CONTACTS_UPDATE','CONTACTS_UPSERT','CONNECTION_UPDATE','GROUP_UPDATE','GROUPS_UPSERT']}});
  await exec(process.execPath,[path.join(root,'iniciar.cjs'),'--no-open'],{cwd:root,windowsHide:true,timeout:360000,maxBuffer:4*1024*1024});
  console.log('Pronto: http://127.0.0.1:18765/');
  console.log('No painel, abra Conexao do WhatsApp, gere o QR code e escaneie pelo celular.');
  if(!process.argv.includes('--no-open'))cp.spawn('explorer.exe',['http://127.0.0.1:18765/'],{windowsHide:true,detached:true,stdio:'ignore'}).unref();
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
