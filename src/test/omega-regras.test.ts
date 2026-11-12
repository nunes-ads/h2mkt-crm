import { describe, expect, it } from 'vitest';
import { recruitmentRules, dueDate, type Customer } from '@/lib/omega-recrutamento';
import { importCatalog, decodeCatalog } from '@/lib/omega-catalogo';
import { ETAPAS } from '@/components/inbox/dados';
import catalog from '@/data/catalogo.json';
import { setMembership, queues } from '@/lib/omega-demo';

const customer:Customer={id:'c',nome:'Cliente',tel:'',carro:'',placa:'',loja:'',servico:'Troca de óleo',data:'2026-05-09',status:''};
describe('Regras originais Ômega',()=>{
 it('retorno de óleo após seis meses',()=>{
  expect(recruitmentRules.oleo.meses).toBe(6);
  expect(dueDate(customer,recruitmentRules)?.getMonth()).toBe(10);
 });
 it('retorno de show de serviço após quatro meses',()=>{
  expect(recruitmentRules.show.meses).toBe(4);
  expect(dueDate({...customer,servico:'Show de serviço'},recruitmentRules)?.getMonth()).toBe(8);
 });
 it('preserva as seis etapas da referência',()=>{
  expect(ETAPAS).toEqual(['Abordagem','Descoberta da necessidade','Proposta','Negociação','Agendamento','Pós-venda']);
 });
 it('preserva preço e totais de cartão do catálogo',()=>{
  const first=decodeCatalog(catalog)[0];
  expect(first?.av).toBe(109.34);
  expect(first?.parcelas[9]).toBe(129.93);
  expect(first?.parcelas[11]).toBe(132.52);
 });
 it('exclui centros inativos, brindes e serviços, e zera produtos ausentes',()=>{
  const rows=[
   {Referencia:'P1',Nome:'Pneu 185/60 R15',Grupo:'PNEUS',nomeCE:'Asa Sul',TipoNegociacao:'CONSUMIDOR',PrecoVenda:100,QTD:4},
   {Referencia:'P2',Nome:'Pneu',Grupo:'PNEUS',nomeCE:'INATIVO',PrecoVenda:100,QTD:8},
   {Referencia:'P3',Nome:'Camiseta brinde',Grupo:'BRINDES',PrecoVenda:100,QTD:8},
   {Referencia:'P4',Nome:'Alinhamento',Grupo:'SERVIÇO ALINHAMENTO',PrecoVenda:100,QTD:8},
  ];
  const result=importCatalog(rows,[{ref:'OLD',desc:'Antigo',grupo:'PNEUS',estoque:3,av:50,parcelas:[],litro:null}]);
  expect(result.products.map(p=>p.ref)).toEqual(['P1','OLD']);
  expect(result.products.find(p=>p.ref==='P1')?.av).toBe(81.31);
  expect(result.products.find(p=>p.ref==='OLD')?.estoque).toBe(0);
 });
 it('edição de filas adiciona e remove sem duplicar membros',()=>{
  const assigned=setMembership(queues,'u3',['f1','f2']);
  expect(assigned.find(q=>q.id==='f1')?.agentes.filter(id=>id==='u3')).toHaveLength(1);
  expect(assigned.find(q=>q.id==='f2')?.agentes).toContain('u3');
  expect(setMembership(assigned,'u3',[]).every(q=>!q.agentes.includes('u3'))).toBe(true);
 });
});