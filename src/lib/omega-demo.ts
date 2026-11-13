import { conversas, type Conversa } from '@/components/inbox/dados';
import { useLocalDemo, useRuntimeState } from './omega-local';
import { useRouteContext } from '@tanstack/react-router';
import { useActiveAccount } from './omega-accounts';
import type { WhatsAppAccountId } from './whatsapp-connection';
import { useEffect } from 'react';

export const useDeals = (accountId?: WhatsAppAccountId, instance?: string) => {
  const { activeAccount } = useActiveAccount();
  const { user } = useRouteContext({ from: '/_authenticated' });
  const scope = `omega-session:${user!.id}:${accountId ?? activeAccount.id}`;
  const [currentInstance, setCurrentInstance] = useRuntimeState(`${scope}:active-instance`, '');
  useEffect(() => {
    if (instance && instance !== currentInstance) setCurrentInstance(instance);
  }, [instance, currentInstance, setCurrentInstance]);
  return useRuntimeState<Conversa[]>(`${scope}:${instance ?? currentInstance}`, conversas);
};

export type DemoUser = { id: string; nome: string; email: string; tel: string; loja: string; role: string; svcs: string[]; online: boolean; falta: boolean };
export const services = ['Agenda', 'Orçamentos', 'Estoque', 'Ligações', 'Campanhas', 'Recrutamento de loja', 'Canais', 'Follow-up', 'Contatos', 'Lojas', 'Agentes IA', 'Filas', 'Usuários', 'Integrações'];
export const roles = ['Superadministrador', 'Admin da Organização', 'Gestor / Supervisor', 'Atendente / Vendedor', 'Analista (Somente leitura)', 'Usuário + Leads', 'Usuário', 'Admin'];
export const users: DemoUser[] = [
 {id:'u1',nome:'Guilherme Paz',email:'guilherme@grupoomega.com.br',tel:'(61) 9 9999-0001',loja:'',role:'Admin',svcs:services,online:true,falta:false},
 {id:'u2',nome:'Carla Mendes',email:'carla@grupoomega.com.br',tel:'(61) 9 9999-0002',loja:'Asa Sul',role:'Gestor',svcs:services.slice(0,10),online:true,falta:false},
 {id:'u3',nome:'Diego Rocha',email:'diego@grupoomega.com.br',tel:'(61) 9 9999-0003',loja:'Taguatinga',role:'Usuário + Leads',svcs:services.slice(0,3),online:true,falta:false},
 {id:'u4',nome:'Renato Alves',email:'renato@grupoomega.com.br',tel:'(61) 9 9999-0004',loja:'Gama Leste',role:'Usuário',svcs:services.slice(0,2),online:false,falta:true},
 {id:'u5',nome:'Ana Pós-venda',email:'ana@grupoomega.com.br',tel:'(61) 9 9999-0005',loja:'Setor Bueno',role:'Usuário + Leads',svcs:['Agenda','Orçamentos','Follow-up'],online:true,falta:false},
];
export const useUsers = () => useLocalDemo('omega-demo-users', users);
export type Queue = {id:string;num:number;nome:string;agentes:string[];modo:string;dono:boolean;priorizarOnline:boolean;removerOutras:boolean;ociosoOn:boolean;ocioso:number;limiteOn:boolean;limite:number;h24:boolean;hIni:string;hFim:string;dias:number[]};
export const newQueue = (nome: string, num: number): Queue => ({id:`f${num}`,num,nome,agentes:[],modo:'uniforme',dono:true,priorizarOnline:true,removerOutras:true,ociosoOn:false,ocioso:5,limiteOn:false,limite:120,h24:true,hIni:'08:00',hFim:'19:00',dias:[1,2,3,4,5,6]});
export const queues: Queue[] = [ {...newQueue('Vendas — pneus e óleo',13482),id:'f1',agentes:['u3','u4','u5'],ociosoOn:true}, {...newQueue('Pós-venda e reclamações',13483),id:'f2',agentes:['u5','u2'],modo:'transmissao',dono:false,removerOutras:false,ocioso:10,limite:240,h24:false,hFim:'18:00',dias:[1,2,3,4,5]} ];
export const useQueues = () => useLocalDemo('omega-demo-queues', queues);
export function setMembership(queues: Queue[], userId: string, queueIds: string[]) {
 return queues.map(q => ({...q, agentes: queueIds.includes(q.id) ? [...new Set([...q.agentes,userId])] : q.agentes.filter(id=>id!==userId)}));
}
