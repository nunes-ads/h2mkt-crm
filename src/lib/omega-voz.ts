export const voiceTabs = ['Ao vivo','Ligações','Central de Ligações','Gatilhos automáticos','Agente de voz','Números','Configuração'] as const;
export const campaignSteps = ['Identificação','Agente e número','Script','Contatos','Limites','Revisão'];
export type VoiceNumber = { id:string; numero:string; nome:string; loja:string; entrada:string; saida:boolean; gravar:boolean };
export type VoiceCampaign = { id:string; nome:string; descricao:string; agente:string; numero:string; voz:string; modo:string; abertura:string; instrucoes:string; contatos:string[]; simultaneas:number; tentativas:number; inicio:string; fim:string; intervalo:number; gravar:boolean; caixaPostal:boolean; aviso:boolean };
export function newVoiceCampaign():VoiceCampaign { return {id:crypto.randomUUID(),nome:'',descricao:'',agente:'hudson',numero:'',voz:'',modo:'hudson',abertura:'',instrucoes:'',contatos:[],simultaneas:2,tentativas:2,inicio:'09:00',fim:'18:00',intervalo:120,gravar:true,caixaPostal:true,aviso:true}; }
export function campaignError(c:VoiceCampaign, step:number):string {
 if(step===0&&!c.nome.trim())return 'Informe o nome da campanha.';
 if(step===1&&!c.numero)return 'Cadastre e escolha o número de origem.';
 if(step===3&&!c.contatos.length)return 'Escolha pelo menos um contato.';
 if(step===4&&(c.simultaneas<1||c.simultaneas>10||c.tentativas<1||c.tentativas>5||c.intervalo<15||c.inicio>=c.fim))return 'Confira os limites e a janela de discagem.';
 return '';
}
export const voiceDefaults = {voiceId:'',voz:'Hudson · masculina, segura',estabilidade:0.5,similaridade:0.75,velocidade:1,modelo:'Claude Sonnet 5.5',temperatura:0.5,tokens:300,turno:'normal',timeout:7,silencio:20,abertura:'',extras:'',palavras:['Pirelli','Valvoline','diálise','185/60 R15','Grupo Ômega','show de serviços']};
export type VoiceSettings = typeof voiceDefaults;
export const callTriggers = [
 {id:'sem_resposta_wpp',nome:'Sem resposta no WhatsApp',quando:'3 h após a proposta sem resposta',desc:'Retomar o orçamento enviado e fechar o agendamento.'},
 {id:'reengajar',nome:'Reengajar leads frios',quando:'48 h parado, follow-up esgotado',desc:'Retomar o interesse e a necessidade do cliente.'},
 {id:'lembrete_2h',nome:'Lembrete 2 h antes',quando:'2 h antes do agendamento',desc:'Confirmar presença e código; remarcar se necessário.'},
 {id:'lembrete_5m',nome:'Aviso 5 min antes',quando:'5 min antes do horário',desc:'Confirmar se o cliente está a caminho.'},
 {id:'reagendar',nome:'Reagendar quem não veio',quando:'15 min após o horário sem check-in',desc:'Oferecer novo horário mantendo o mesmo código.'},
];
export type DemoCall = { id:string; nome:string; telefone:string; direcao:'Recebida'|'Saída'; quando:string; duracao:string; motivo:string; score:number; resumo:string; resultado:string; sentimento:string; temperatura:string; dor:string; fit:string; proxima:string; objecoes:string[]; transcricao:{agente:boolean;texto:string}[] };
/** Literal reference examples, never a live call record. */
export const voiceDemoCalls:DemoCall[] = [
 {id:'c1',nome:'Rodrigo Santana',telefone:'(61) 9 8555-6677',direcao:'Saída',quando:'07/11, 04:54',duracao:'1m34s',motivo:'Reengajar',score:18,resumo:'Comprou pela internet; pediu contato na próxima troca em ~6 meses.',resultado:'Sem interesse agora',sentimento:'Neutro',temperatura:'Frio',dor:'Pneus da Hilux',fit:'Compra já realizada pela internet.',proxima:'Retomar na próxima troca, em cerca de seis meses.',objecoes:['Comprou pela internet.'],transcricao:[{agente:true,texto:'Rodrigo, aqui é o Hudson, do Grupo Ômega. Tudo bem? Vi que você pediu os pneus da Hilux semana passada e não conseguimos fechar. Posso te ajudar nisso agora?'},{agente:false,texto:'Então, acabei comprando pela internet, já chegou.'},{agente:true,texto:'Entendi, sem problema. Já instalou? Se quiser, a montagem com alinhamento e balanceamento aqui sai em 10 vezes, e você fica com a garantia do serviço.'},{agente:false,texto:'Já instalei. Me liga de novo na próxima troca, daqui uns seis meses.'},{agente:true,texto:'Combinado, Rodrigo. Deixo marcado aqui para te avisar. Obrigado pelo retorno!'}]},
 {id:'c2',nome:'Fernanda Lima',telefone:'(62) 9 8877-3344',direcao:'Recebida',quando:'08/11, 04:54',duracao:'3m32s',motivo:'Recebida',score:88,resumo:'Corolla CVT com tranco leve, 92 mil km; avaliação sem custo marcada na Setor Bueno.',resultado:'Agendou',sentimento:'Positivo',temperatura:'Quente',dor:'Tranco leve no câmbio CVT do Corolla, 92 mil km.',fit:'Interesse em avaliação e troca de óleo de câmbio por diálise.',proxima:'Avaliação às 9 h na Setor Bueno; enviar código pelo WhatsApp.',objecoes:[],transcricao:[{agente:false,texto:'Oi, meu Corolla está dando um tranco leve quando engata. Vocês fazem troca de óleo de câmbio?'},{agente:true,texto:'Grupo Ômega, boa tarde! Aqui é o Hudson. Fazemos sim, com quem eu falo?'},{agente:false,texto:'Fernanda.'},{agente:true,texto:'Fernanda, esse tranco leve costuma ser o óleo do câmbio no fim da vida. O seu é automático CVT, certo? Quantos quilômetros ele tem?'},{agente:false,texto:'É CVT, uns noventa e dois mil.'},{agente:true,texto:'Então é a hora certa. A gente faz a diálise, que é a troca completa na máquina, e antes uma avaliação sem custo. Você prefere amanhã de manhã ou à tarde na Setor Bueno?'},{agente:false,texto:'Amanhã de manhã, pode ser nove horas.'},{agente:true,texto:'Perfeito, nove horas. Vou te mandar o código no WhatsApp. Obrigado, Fernanda!'}]},
];export const voiceDemoNumbers:VoiceNumber[] = [
 {id:'demo-df',numero:'+55 61 4042-0001',nome:'Central Omega (DF)',loja:'Brasília-DF · US$ 1,15/mês',entrada:'Hudson',saida:true,gravar:true},
 {id:'demo-go',numero:'+55 62 4042-0002',nome:'Goiânia · Setor Bueno',loja:'Goiânia-GO · US$ 1,15/mês',entrada:'Hudson',saida:true,gravar:true},
];
export const voiceRecentCalls = [
 {nome:'Junior Morais',telefone:'(61) 9 9361-9482',quando:'09/11, 01:50',duracao:'0m30s',resultado:'Agendado'},
 {nome:'Aline Moraes',telefone:'(61) 9 8396-1688',quando:'09/11, 01:29',duracao:'0m27s',resultado:'Sem conclusão'},
 {nome:'Allycia Paz',telefone:'(61) 9 9912-5814',quando:'07/11, 01:43',duracao:'0m22s',resultado:'Agendado'},
 {nome:'Rodrigo Santana',telefone:'(61) 9 8555-6677',quando:'05/11, 00:02',duracao:'1m34s',resultado:'Sem interesse agora'},
];
export const voiceSetupSteps = ['Hudson treinado','Voz definida','Janela de discagem','Gatilhos','ElevenLabs','Twilio','Evolution','Anthropic'];
