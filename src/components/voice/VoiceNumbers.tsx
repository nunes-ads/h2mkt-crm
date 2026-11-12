import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { AudioLines, Bot, Brain, Copy, MessageCircle, Mic, Phone, PhoneCall, Plus, RefreshCw, Info } from 'lucide-react';
import { PwButton } from '@/components/omega-ui';
import { integrationStatus } from '@/lib/omega-integrations.functions';
import { voiceDemoNumbers, voiceRecentCalls, type VoiceNumber } from '@/lib/omega-voz';

const integ = [
 { id:'elevenlabs', nome:'ElevenLabs (voz)', icon:AudioLines, desc:'Pegue a API Key em elevenlabs.io/app/settings/api-keys. As chaves ficam no cofre desta conta, não no código.', open:'https://elevenlabs.io/app/settings/api-keys' },
 { id:'twilio', nome:'Twilio (telefonia)', icon:Phone, desc:'Account SID + Auth Token em console.twilio.com. Salvas criptografadas no cofre desta conta.', open:'https://console.twilio.com' },
 { id:'evolution', nome:'Evolution (WhatsApp)', icon:MessageCircle, desc:'URL + API key do seu servidor Evolution. Configurado por canal em Canais → WhatsApp Extra.', open:'' },
 { id:'anthropic', nome:'Anthropic (cérebro do Hudson)', icon:Brain, desc:'Chave da Anthropic: é o modelo que decide, usa as ferramentas e fala. Sem ela o Hudson não atende.', open:'https://console.anthropic.com' },
];

export function useVoiceStatus(){
 const fn=useServerFn(integrationStatus);
 return useQuery({queryKey:['omega-integration-status'],queryFn:()=>fn()});
}

export function VoiceNumbers({numbers,onNew,onRemove}:{numbers:VoiceNumber[];onNew:()=>void;onRemove:(id:string)=>void}){
 const {data,refetch,isFetching}=useVoiceStatus();
 const ok=(id:string)=>Boolean(data?.find(i=>i.id===id)?.configured);
 const [origin,setOrigin]=useState('');useEffect(()=>setOrigin(window.location.origin),[]);
 const [copied,setCopied]=useState('');
 const list=[...numbers.map(n=>({...n,demo:false})),...voiceDemoNumbers.map(n=>({...n,demo:true}))];
 const ativos=list.filter(n=>n.entrada==='Hudson').length;
 const chaves=integ.filter(i=>ok(i.id)).length;
 const hooks=[
  {label:'A call comes in (voice) · webhook · HTTP POST',url:`${origin}/api/public/twilio/voice?acao=entrada`},
  {label:'Call status changes · webhook · HTTP POST',url:`${origin}/api/public/twilio/status`},
  {label:'Recording status callback',url:`${origin}/api/public/twilio/status?acao=gravacao`},
 ];
 const copy=(u:string)=>{void navigator.clipboard?.writeText(u);setCopied(u);};
 return <div className="om-stack">
  <div className={`om-vz-state ${chaves===integ.length?'is-ok':'is-warn'}`}><div><b>{chaves===integ.length?'✓ Tudo ligado':'Faltam configurações'}</b><p className="t-caption">{chaves}/{integ.length} chaves configuradas, 0 agente(s) sincronizado(s), {ativos} número(s) com IA ativa.</p></div><PwButton tone="icon" aria-label="Atualizar estado" onClick={()=>void refetch()} disabled={isFetching}><RefreshCw/></PwButton></div>
  <h3 className="t-meta">Integrações externas da telefonia</h3>
  <div className="om-vz-integ">{integ.map(i=>{const Icon=i.icon;const on=ok(i.id);return <article className="card om-card" key={i.id}><div className="om-between"><span className="om-vz-integ-h"><span className="om-vz-ico"><Icon size={16}/></span><span><b>{i.nome}</b><small className={on?'om-vz-ok':'om-vz-warn'}>● {on?'Configurado':'Não configurado'}</small></span></span>{on&&<span className="om-vz-ok">✓</span>}</div><p className="om-vz-integ-d">{i.desc}</p><div className="om-between">{i.id==='evolution'?<Link className="btn btn-outline btn-sm" to="/canais">Abrir Canais</Link>:<Link className="btn btn-outline btn-sm" to="/integracoes">Editar</Link>}{i.open?<a className="btn btn-ghost btn-sm" href={i.open} target="_blank" rel="noreferrer">Abrir ›</a>:<Link className="btn btn-ghost btn-sm" to="/canais">Abrir ›</Link>}</div></article>;})}</div>
  <h3 className="t-meta">Seu setup dentro da plataforma</h3>
  <div className="om-vz-kpis">
   <article className="card om-card"><div className="om-between"><span>Agentes IA</span><span className="om-vz-ico is-warn"><Bot size={16}/></span></div><b className="num om-vz-big">0/2</b><span className="t-meta">crie/sincronize em Agente de voz</span></article>
   <article className="card om-card is-on"><div className="om-between"><span>Números com IA ativa</span><span className="om-vz-ico is-ok"><PhoneCall size={16}/></span></div><b className="num om-vz-big">{ativos}/{list.length}</b><span className="t-meta">o Hudson atende</span></article>
   <article className="card om-card"><div className="om-between"><span>Canais de mensagem</span><span className="om-vz-ico"><MessageCircle size={16}/></span></div><b className="num om-vz-big">0</b><span className="t-meta">WhatsApp, Instagram, ML…</span></article>
  </div>
  <div className="om-between"><div><h2 className="t-h3">Números de telefone</h2><p className="t-caption">Números Twilio que o Hudson atende e usa para discar. Cada loja pode ter o seu.</p></div><div className="om-toolbar"><PwButton disabled={!ok('elevenlabs')}><Mic/>Clonar voz</PwButton><PwButton disabled={!ok('twilio')}>Importar existente</PwButton><PwButton disabled={!ok('twilio')}>Comprar número</PwButton><PwButton tone="primary" onClick={onNew}><Plus/>Novo número</PwButton></div></div>
  <div className="om-vz-cols">
   <div className="om-stack">
    <h3 className="t-meta">Números conectados</h3>
    <div className="om-vz-nums">{list.map(n=><article className="card om-card" key={n.id}><div className="om-between"><b className="num om-vz-numero">{n.numero}</b><span className={`pill ${n.demo?'is-wait':'is-ok'}`}>{n.demo?'demonstração':'● ativo'}</span></div><b>{n.nome}</b><dl className="om-vz-dl"><dt>Agente que atende</dt><dd>{n.entrada==='Hudson'?'Hudson':'—'}</dd><dt>Entrada</dt><dd>{n.entrada==='Hudson'?'Hudson atende':n.entrada}</dd><dt>Gravação</dt><dd>{n.gravar?'ligada':'desligada'}</dd><dt>Local</dt><dd>{n.loja||'Central'}</dd></dl><div className="om-toolbar"><PwButton disabled={!ok('twilio')}>Testar entrada</PwButton><PwButton disabled={n.demo}>Configurar</PwButton>{n.demo?<PwButton disabled>Pausar</PwButton>:<PwButton onClick={()=>onRemove(n.id)}>Remover</PwButton>}</div></article>)}</div>
    <div className="om-between"><h3 className="t-meta">Voice clones por agente</h3>{!ok('elevenlabs')&&<span className="pill is-warn">requer ELEVENLABS_API_KEY</span>}</div>
    <div className="om-vz-nums"><article className="card om-card"><b>Hudson</b><p className="t-caption">Voz padrão (ElevenLabs) · Adam (pt-BR, masculina, calma)</p><PwButton disabled={!ok('elevenlabs')}>Clonar voz</PwButton></article></div>
   </div>
   <div className="om-stack">
    <h3 className="t-meta">Chamadas recentes</h3>
    <span className="pill is-wait">Dados de demonstração</span>
    {voiceRecentCalls.map((c,i)=><article className="card om-vz-recent" key={i}><span><b>{c.nome}</b> <small className="num">{c.telefone}</small></span><small className="num t-meta">{c.quando} · {c.duracao} · {c.resultado}</small></article>)}
    <article className="card om-card"><h3 className="t-h3"><Info size={16}/> Como conectar um número</h3><p className="t-caption">Três caminhos, todos self-service.</p><p><b>Comprar número</b> — busca direta no inventário da Twilio (BR/US). O CRM compra, registra e aponta os webhooks de voz automaticamente.</p><p><b>Importar existente</b> — ideal para o número do trial Twilio ou números já comprados. Reaponta os webhooks para cá.</p><p><b>Novo número manual</b> — só cadastra o E.164 (+5561…). Use quando o número está em outra subconta Twilio: aí cole as URLs abaixo no Console.</p><p className="t-caption">✓ A Twilio hospeda o áudio bidirecional via ConversationRelay, com fala→texto e texto→fala pelo ElevenLabs. O cérebro é o Hudson, com as mesmas ferramentas do WhatsApp.</p></article>
   </div>
  </div>
  <section className="card om-card"><h2 className="t-h3">Webhooks da Twilio (configurar no número)</h2><p className="t-caption">Copie e cole no console da Twilio → Phone Numbers → Voice &amp; Fax. Ativos após a publicação da integração de voz.</p>{hooks.map(h=><div className="om-vz-hook" key={h.label}><div><span className="t-meta">{h.label}</span><code className="num">{h.url}</code></div><PwButton onClick={()=>copy(h.url)}><Copy/>{copied===h.url?'Copiado':'Copiar'}</PwButton></div>)}</section>
 </div>;
}
