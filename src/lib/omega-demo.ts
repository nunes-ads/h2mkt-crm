import { conversas, type Conversa } from '@/components/inbox/dados';
import { useLocalDemo, useRuntimeState } from './omega-local';
import { useRouteContext } from '@tanstack/react-router';
import { useActiveAccount } from './omega-accounts';

export const subcontaConversasIniciais: Conversa[] = [
  {
    id: "5561991234567@s.whatsapp.net",
    nome: "Rodrigo Mendonça",
    tel: "(61) 9 9123-4567",
    origem: "Anúncio de troca de óleo (Google)",
    carro: "Civic 2.0 2019",
    canal: "WhatsApp Asa Sul",
    loja: "Asa Sul",
    etapa: "Abordagem",
    status: "Em atendimento humano",
    valor: 480,
    perda: null,
    agente: "Ariel Gama",
    data: "Hoje",
    esperaMin: 4,
    arquivada: false,
    naoLida: 1,
    tags: ["óleo", "asa-sul"],
    msgs: [
      { id: "m-sub-1", kind: "cliente", text: "Boa tarde! A unidade da Asa Sul tem óleo sintético 0w20 para o Civic hoje?", t: "10:15" },
      { id: "m-sub-2", kind: "vendedor", text: "Olá Rodrigo! Aqui é o Ariel da Ômega Asa Sul 😊 Temos sim a pronta entrega na 508 Sul. Posso reservar o seu horário hoje?", t: "10:18" }
    ],
    ficha: [["Carro", "Civic 2.0 2019"], ["Óleo", "0w20 Sintético"], ["Unidade", "Asa Sul"]],
    ag: null,
    log: [{ t: "10:15", text: "Lead recebido via WhatsApp Asa Sul" }]
  },
  {
    id: "5561998765432@s.whatsapp.net",
    nome: "Mariana Ferreira",
    tel: "(61) 9 9876-5432",
    origem: "Anúncio de pneus (Instagram/Facebook)",
    carro: "Corolla 2021",
    canal: "WhatsApp Asa Sul",
    loja: "Asa Sul",
    etapa: "Agendamento",
    status: "Agendado",
    valor: 1840,
    perda: null,
    agente: "Ariel Gama",
    data: "Hoje",
    esperaMin: null,
    arquivada: false,
    naoLida: 0,
    tags: ["pneus", "agendado"],
    msgs: [
      { id: "m-sub-3", kind: "cliente", text: "Perfeito, vou levar o carro aí na loja da 508 Sul às 14h.", t: "09:30" },
      { id: "m-sub-4", kind: "vendedor", text: "Combinado Mariana! Agendamento confirmado com montagem grátis na unidade Asa Sul.", t: "09:32" }
    ],
    ficha: [["Carro", "Corolla 2021"], ["Pneus", "205/55 R16 Pirelli Cinturato P1"], ["Unidade", "Asa Sul"]],
    ag: { code: "AG-ASASUL-882", kv: [["Unidade", "Asa Sul"], ["Horário", "14:00"], ["Serviço", "4 Pneus + Montagem"]] },
    log: [{ t: "09:32", text: "Agendamento confirmado pela franquia Asa Sul" }]
  },
  {
    id: "5561981112233@s.whatsapp.net",
    nome: "Eduardo Camargo",
    tel: "(61) 9 8111-2233",
    origem: "Anúncio do Show de Serviços",
    carro: "Jeep Renegade 2020",
    canal: "WhatsApp Asa Sul",
    loja: "Asa Sul",
    etapa: "Proposta",
    status: "Em atendimento humano",
    valor: 489,
    perda: null,
    agente: "Ariel Gama",
    data: "Hoje",
    esperaMin: 12,
    arquivada: false,
    naoLida: 0,
    tags: ["revisão", "show-de-serviços"],
    msgs: [
      { id: "m-sub-5", kind: "cliente", text: "Como funciona esse show de serviços da Asa Sul?", t: "08:45" },
      { id: "m-sub-6", kind: "vendedor", text: "Bom dia Eduardo! Inclui alinhamento 3D, balanceamento das 4 rodas, cambagem e rodízio por 1 ano inteiro com atendimento prioritário aqui na Asa Sul.", t: "08:50" }
    ],
    ficha: [["Carro", "Jeep Renegade"], ["Serviço", "Show de Serviços"]],
    ag: null,
    log: [{ t: "08:45", text: "Proposta enviada" }]
  }
];

export const useDeals = () => {
  const { activeAccount } = useActiveAccount();
  const { user } = useRouteContext({ from: '/_authenticated' });
  const initial = activeAccount.id === 'matriz' ? conversas : subcontaConversasIniciais;
  return useRuntimeState<Conversa[]>(`omega-session:${user!.id}:${activeAccount.id}`, initial);
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
