import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download } from "lucide-react";
import { ETAPAS, brl, semRespostaCliente } from "@/components/inbox/dados";
import { useDeals } from "@/lib/omega-demo";
import { AppShell } from "@/components/AppShell";
import { PageHead, meta } from "@/components/pw";
import { Empty, Metrics, PwButton } from "@/components/omega-ui";
import { canAccess, type Membership } from "@/lib/crm/contracts";
import { getCrmWhatsAppLeadDaily, getCrmWorkspace } from "@/lib/crm/crm.functions";
import { leadPeriodSchema, recentLeadPeriod, shiftDay, type LeadPeriod } from "@/lib/crm/lead-period";

export const Route = createFileRoute("/_authenticated/painel")({
  head: () => meta("Painel", "Entradas de leads do WhatsApp por dia e organização."),
  component: Painel,
});

const displayDate = (value: string) => value.split("-").reverse().join("/");
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível consultar o painel.";

function Painel() {
  const { user } = Route.useRouteContext();
  const loadWorkspace = useServerFn(getCrmWorkspace);
  const workspace = useQuery({
    queryKey: ["crm", user!.id, "workspace"],
    queryFn: () => loadWorkspace(),
    retry: false,
  });
  const [chosen, setChosen] = useState("");
  const memberships = workspace.data?.memberships ?? [];
  const member = memberships.find((item) => item.tenant_id === chosen) ?? memberships[0];

  return (
    <AppShell crumb="Painel" accountControl={member ? (
      <select className="input select" aria-label="Organização do painel" value={member.tenant_id}
        onChange={(event) => setChosen(event.target.value)}>
        {memberships.map((item) => <option key={item.tenant_id} value={item.tenant_id}>{item.name}</option>)}
      </select>
    ) : <span className="t-caption">Organização do painel</span>}>
      <PageHead eyebrow="Visão geral" title="Painel" />
      {workspace.isPending ? <p role="status">Verificando organizações autorizadas…</p>
        : workspace.error || workspace.data?.state === "setup" ? (
          <section className="om-section">
            <p role="alert">{workspace.error ? errorMessage(workspace.error) : workspace.data?.message}</p>
            <PwButton onClick={() => void workspace.refetch()}>Verificar novamente</PwButton>
          </section>
        ) : !member ? <Empty>Seu usuário ainda não tem uma organização vinculada.</Empty>
        : !canAccess(member, "contacts.read") ? <Empty>Seu vínculo não permite consultar os leads.</Empty>
        : <LeadDashboard key={`${member.user_id}:${member.tenant_id}`} member={member} />}
      <OperationsPreview />
    </AppShell>
  );
}

const presets = [
  { label: "Hoje", days: 1, offset: 0 },
  { label: "Ontem", days: 1, offset: -1 },
  { label: "Últimos 7 dias", days: 7, offset: 0 },
  { label: "Últimos 30 dias", days: 30, offset: 0 },
] as const;

function LeadDashboard({ member }: { member: Membership }) {
  const loadDaily = useServerFn(getCrmWhatsAppLeadDaily);
  const [period, setPeriod] = useState(() => recentLeadPeriod(7));
  const [draft, setDraft] = useState<LeadPeriod>(period);
  const [invalid, setInvalid] = useState("");
  const result = useQuery({
    queryKey: ["crm", member.user_id, member.tenant_id, "lead-daily", period],
    queryFn: () => loadDaily({ data: { tenant_id: member.tenant_id, ...period } }),
    retry: false,
    refetchInterval: 15000,
  });

  function apply(next: LeadPeriod) {
    setDraft(next);
    const checked = leadPeriodSchema.safeParse(next);
    if (!checked.success) {
      setInvalid("Informe datas válidas e selecione de 1 a 92 dias, sem datas futuras.");
      return;
    }
    setInvalid("");
    setPeriod(checked.data);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    apply(draft);
  }

  return (
    <>
      <section className="om-section" aria-label="Período dos leads">
        <div className="om-toolbar">
          {presets.map(({ label, days, offset }) => (
            <PwButton key={label} onClick={() => {
              const range = recentLeadPeriod(days);
              apply({ start_date: shiftDay(range.start_date, offset), end_date: shiftDay(range.end_date, offset) });
            }}>{label}</PwButton>
          ))}
        </div>
        <form className="om-toolbar" onSubmit={submit}>
          <label className="om-inline">De
            <input className="input" type="date" value={draft.start_date} required
              max={recentLeadPeriod(1).end_date}
              onChange={(event) => setDraft({ ...draft, start_date: event.target.value })} />
          </label>
          <label className="om-inline">Até
            <input className="input" type="date" value={draft.end_date} required
              max={recentLeadPeriod(1).end_date}
              onChange={(event) => setDraft({ ...draft, end_date: event.target.value })} />
          </label>
          <PwButton type="submit" tone="primary">Aplicar período</PwButton>
        </form>
        {invalid && <p role="alert">{invalid}</p>}
        <p className="t-caption">Fuso de Brasília · comparação com os dias imediatamente anteriores</p>
      </section>
      {result.isPending ? <p role="status">Consultando entradas de leads…</p>
        : result.error ? <section className="om-section">
          <p role="alert">{errorMessage(result.error)}</p>
          <PwButton onClick={() => void result.refetch()}>Tentar novamente</PwButton>
        </section>
        : <LeadComparison current={result.data.current} previous={result.data.previous} />}
    </>
  );
}

type Day = { date: string; leads: number };
function LeadComparison({ current, previous }: { current: Day[]; previous: Day[] }) {
  const sum = (days: Day[]) => days.reduce((total, day) => total + day.leads, 0);
  const total = sum(current);
  const prior = sum(previous);
  const diff = total - prior;
  const signed = new Intl.NumberFormat("pt-BR", { signDisplay: "exceptZero" }).format(diff);
  const percent = prior ? new Intl.NumberFormat("pt-BR", {
    style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero",
  }).format(diff / prior) : "Sem base para percentual";
  const range = (days: Day[]) => days.length === 1 ? displayDate(days[0]!.date)
    : `${displayDate(days[0]!.date)} a ${displayDate(days.at(-1)!.date)}`;
  const scale = Math.max(1, ...current.map((day) => day.leads), ...previous.map((day) => day.leads));

  return (
    <>
      <Metrics items={[
        { label: "Leads do WhatsApp", value: total, sub: range(current) },
        { label: "Período anterior", value: prior, sub: range(previous) },
        { label: "Variação de leads", value: signed, sub: percent },
      ]} />
      <section className="om-section">
        <div className="om-toolbar">
          <h2 className="t-h3">Entradas por dia</h2>
          <Link to="/contatos" className="btn btn-outline btn-sm">Abrir contatos</Link>
        </div>
        {!total && <p className="t-caption">Nenhum lead do WhatsApp registrado no período selecionado.</p>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Dia</th><th scope="col">Leads</th>
              <th scope="col">Dia comparado</th><th scope="col">Leads anteriores</th></tr></thead>
            <tbody>{current.map((day, i) => {
              const comparison = previous[i]!;
              return <tr key={day.date}>
                <th scope="row"><time dateTime={day.date}>{displayDate(day.date)}</time></th>
                <td className="num"><div className="om-bar"><div className="bar" aria-hidden="true">
                  <i style={{ width: `${day.leads / scale * 100}%` }} />
                </div><b>{day.leads}</b></div></td>
                <td><time dateTime={comparison.date}>{displayDate(comparison.date)}</time></td>
                <td className="num">{comparison.leads}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Bars({title,rows}:{title:string;rows:[string,number][]}) {
 const max=Math.max(1,...rows.map(r=>r[1]));
 return <section className="om-section"><h2 className="t-h3">{title}</h2><div className="om-stack">{rows.length ? rows.map(([k,v])=><div className="om-bar" key={k}><span>{k}</span><div className="bar"><i style={{width:`${v/max*100}%`}} /></div><b className="num">{v}</b></div>):<p className="t-caption">—</p>}</div></section>;
}
function OperationsPreview(){
 const [ds]=useDeals(); const ag=ds.filter(d=>d.ag || ['Agendamento','Pós-venda'].includes(d.etapa));
 const count=(f:(d:typeof ds[number])=>string)=>Object.entries(ds.reduce<Record<string,number>>((a,d)=>{const k=f(d);if(k)a[k]=(a[k]??0)+1;return a;},{})).sort((a,b)=>b[1]-a[1]);
 const activity=ds.flatMap(d=>d.log.map(l=>({...l,nome:d.nome}))).sort((a,b)=>b.t.localeCompare(a.t)).slice(0,8);
 const exportar=()=>{const csv='Nome;Etapa;Status;Loja;Valor\n'+ds.map(d=>[d.nome,d.etapa,d.status,d.loja,d.valor].join(';')).join('\n');const url=URL.createObjectURL(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='painel-omega.csv';a.click();URL.revokeObjectURL(url);};
 return <details className="om-section"><summary className="t-h3">Outros indicadores da operação</summary><p className="t-caption">Dados da sessão local. O filtro de período se aplica às entradas de leads do WhatsApp.</p><PwButton onClick={exportar}><Download/>Exportar operação local</PwButton><Metrics items={[{label:'Em atendimento',value:ds.filter(d=>['IA ativa','Em atendimento humano'].includes(d.status)).length,sub:'IA ou humano'},{label:'Agendados',value:ag.length,sub:`${ds.length?Math.round(ag.length/ds.length*100):0}% de conversão`},{label:'Perdidos',value:ds.filter(d=>d.perda || d.status==='Perdido').length,warning:true},{label:'Fechados só pela IA',value:ds.filter(d=>d.ag && d.msgs.every(m=>m.kind!=='vendedor')).length,sub:'sem intervenção humana'},{label:'Ligações',value:0,sub:'entrada e saída'},{label:'Aguardando follow-up',value:ds.filter(semRespostaCliente).length,warning:true},{label:'Valor agendado',value:brl(ds.filter(d=>d.ag).reduce((s,d)=>s+d.valor,0))}]}/><div className="om-grid"><Bars title="Leads por origem" rows={count(d=>d.origem.replace(/ \(.*\)/,''))}/><section className="om-section"><h2 className="t-h3">Atividade recente</h2><ul className="timeline">{activity.map((a,i)=><li key={i}><span className="when">{a.t}</span><div className="t-label">{a.nome}: {a.text}</div></li>)}</ul></section><Bars title="Funil" rows={ETAPAS.map(e=>[e,ds.filter(d=>d.etapa===e).length])}/><Bars title="Motivos de perda" rows={count(d=>d.perda??'')}/><Bars title="Agendamentos por loja" rows={Object.entries(ag.reduce<Record<string,number>>((a,d)=>{if(d.loja)a[d.loja]=(a[d.loja]??0)+1;return a;},{}))}/></div></details>;
}
