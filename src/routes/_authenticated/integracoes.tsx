import { createFileRoute, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery } from '@tanstack/react-query';
import { RefreshCw, Settings2 } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHead, meta } from '@/components/pw';
import { PwButton } from '@/components/omega-ui';
import { integrationStatus } from '@/lib/omega-integrations.functions';
const options = { queryKey: ['omega-integration-status'], queryFn: () => integrationStatus() };
export const Route = createFileRoute('/_authenticated/integracoes')({ head: () => meta('Integrações', 'Estado real da configuração dos serviços do CRM Grupo Ômega.'), loader: ({ context }) => context.queryClient.ensureQueryData(options), component: Integracoes });
function Integracoes() {
 const status = useServerFn(integrationStatus);
 const { data, refetch, isFetching } = useSuspenseQuery({ ...options, queryFn: () => status() });
 return <AppShell crumb="Integrações" section="Configurações"><PageHead eyebrow="Serviços e contas" title="Integrações" actions={<PwButton onClick={() => void refetch()} disabled={isFetching}><RefreshCw/>{isFetching ? 'Verificando…' : 'Atualizar configurações'}</PwButton>}/><div className="om-strip"><span className="t-meta">{data.filter(i => i.configured).length} de {data.length} com credenciais configuradas</span><span className="pill is-warn">Conectividade não verificada</span></div><div className="itg-list">{data.map(i => <article className="card itg-card" key={i.id}><span className="itg-lg"><Settings2 size={18}/></span><div className="itg-body"><b>{i.name}</b><p className="t-caption">{i.detail}</p><span className="pill is-warn">{i.configured ? 'Credencial configurada · não testada' : i.state === 'Documentação pendente' ? i.state : 'Conexão pendente'}</span></div><div className="itg-acts"><Link to={i.id === 'twilio' || i.id === 'elevenlabs' ? '/ligacoes' : '/canais'} className="btn btn-outline btn-sm">Configurações</Link></div></article>)}</div><section className="om-section"><h2 className="t-h3">Chaves de API do CRM</h2><p className="t-caption">Nenhuma chave de API ativa. Integração externa pendente.</p></section></AppShell>;
}
