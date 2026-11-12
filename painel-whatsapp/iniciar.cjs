const fs=require('node:fs');const path=require('node:path');const cp=require('node:child_process');const {promisify}=require('node:util');const exec=promisify(cp.execFile);
const root=__dirname;
async function main(){
 console.log('Iniciando o ambiente local de WhatsApp...');
 await exec('docker',['desktop','start'],{windowsHide:true,timeout:120000}).catch(()=>{});
 let ready=false;for(let i=0;i<60;i++){try{await exec('docker',['info','--format','{{.ServerVersion}}'],{windowsHide:true,timeout:5000});ready=true;break;}catch{await new Promise(r=>setTimeout(r,2000));}}
 if(!ready)throw Error('Abra o Docker Desktop e aguarde a inicializacao. Depois tente novamente.');
 await exec('docker',['compose','up','-d'],{cwd:root,windowsHide:true,timeout:180000});
 let running=false;try{const r=await fetch('http://127.0.0.1:18765/',{signal:AbortSignal.timeout(3000)});const html=await r.text();if(!html.includes('SEU ESPAÇO DE ATENDIMENTO'))throw Error('A porta 18765 esta ocupada por outro programa.');running=true;}catch(e){if(e.message.includes('ocupada'))throw e;}
 if(!running){const out=fs.openSync(path.join(root,'painel.log'),'a'),err=fs.openSync(path.join(root,'painel-error.log'),'a');const child=cp.spawn(process.execPath,[path.join(root,'painel.cjs')],{cwd:root,detached:true,windowsHide:true,stdio:['ignore',out,err]});child.unref();fs.closeSync(out);fs.closeSync(err);fs.writeFileSync(path.join(root,'painel.pid'),String(child.pid));}
 let panelReady=false;for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:18765/',{signal:AbortSignal.timeout(2000)});if(r.ok){panelReady=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}if(!panelReady)throw Error('O painel nao iniciou. Confira o arquivo painel-error.log.');
 console.log('Painel: http://127.0.0.1:18765/');
 if(!process.argv.includes('--no-open'))cp.spawn('explorer.exe',['http://127.0.0.1:18765/'],{detached:true,windowsHide:true,stdio:'ignore'}).unref();
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
