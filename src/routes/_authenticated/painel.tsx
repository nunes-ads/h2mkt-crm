import { createFileRoute } from '@tanstack/react-router';
import { Download } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHead, meta } from '@/components/pw';
import { Metrics, PwButton } from '@/components/omega-ui';
import { ETAPAS, brl, semRespostaCliente } from '@/components/inbox/dados';
import { useDeals } from '@/lib/omega-demo';
export const Route = createFileRoute('/_authenticated/painel')({head:()=>meta('Painel','Operação Ômega: leads, atendimento, perdas e agendamentos por loja.'),component:Painel});
function Bars({title,rows}:{title:string;rows:[string,number][]}) {
 const max=Math.max(1,...rows.map(r=>r[1]));
 return <section className="om-section"><h2 className="t-h3">{title}</h2><div className="om-stack">{rows.length ? rows.map(([k,v])=><div className="om-bar" key={k}><span>{k}</span><div className="bar"><i style={{width:`${v/max*100}%`}} /></div><b className="num">{v}</b></div>):<p className="t-caption">—</p>}</div></section>;
}
function Painel(){
 const [ds]=useDeals(); const ag=ds.filter(d=>d.ag || ['Agendamento','Pós-venda'].includes(d.etapa));
 const count=(f:(d:typeof ds[number])=>string)=>Object.entries(ds.reduce<Record<string,number>>((a,d)=>{const k=f(d);if(k)a[k]=(a[k]??0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]);
 const activity=ds.flatMap(d=>d.log.map(l=>({...l,nome:d.nome}))).sort((a,b)=>b.t.localeCompare(a.t)).slice(0,8);
 const exportar=()=>{const csv='Nome;Etapa;Status;Loja;Valor\n'+ds.map(d=>[d.nome,d.etapa,d.status,d.loja,d.valor].join(';')).join('\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='painel-omega.csv';a.click();URL.revokeObjectURL(url);};
 return <AppShell crumb="Painel"><PageHead eyebrow="Visão geral" title="Painel" actions={<PwButton onClick={exportar}><Download/>Exportar</PwButton>}/><Metrics items={[{label:'Leads',value:ds.length,sub:'no período'},{label:'Em atendimento',value:ds.filter(d=>['IA ativa','Em atendimento humano'].includes(d.status)).length,sub:'IA ou humano'},{label:'Agendados',value:ag.length,sub:`${ds.length?Math.round(ag.length/ds.length*100):0}% de conversão`},{label:'Perdidos',value:ds.filter(d=>d.perda || d.status==='Perdido').length,warning:true},{label:'Fechados só pela IA',value:ds.filter(d=>d.ag && d.msgs.every(m=>m.kind!=='vendedor')).length,sub:'sem intervenção humana'},{label:'Ligações',value:0,sub:'entrada e saída'},{label:'Aguardando follow-up',value:ds.filter(semRespostaCliente).length,warning:true},{label:'Valor agendado',value:brl(ds.filter(d=>d.ag).reduce((s,d)=>s+d.valor,0))}]}/><div className="om-grid"><Bars title="Leads por origem" rows={count(d=>d.origem.replace(/ \(.*\)/,''))}/><section className="om-section"><h2 className="t-h3">Atividade recente</h2><ul className="timeline">{activity.map((a,i)=><li key={i}><span className="when">{a.t}</span><div className="t-label">{a.nome}: {a.text}</div></li>)}</ul></section><Bars title="Funil" rows={ETAPAS.map(e=>[e,ds.filter(d=>d.etapa===e).length])}/><Bars title="Motivos de perda" rows={count(d=>d.perda??'')}/><Bars title="Agendamentos por loja" rows={Object.entries(ag.reduce<Record<string,number>>((a,d)=>{if(d.loja)a[d.loja]=(a[d.loja]??0)+1;return a;},{}))}/></div></AppShell>;
}
