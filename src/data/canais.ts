export type Canal = {id:string;nome:string;desc:string;grupo:string;fields:{label:string;type?:string;options?:string[]}[]};
export const canais: Canal[] = [
{id:'wa_oficial',nome:'WhatsApp Oficial',grupo:'Mensagens',desc:'Número verificado pela API oficial da Meta.',fields:[{label:'Número (com DDD)',type:'tel'},{label:'Nome exibido'}]},
{id:'wa_extra',nome:'WhatsApp Extraoficial',grupo:'Mensagens',desc:'Conexão direta via QR Code com a Evolution API para cada loja ou atendente.',fields:[{label:'Nome da conexão'},{label:'Loja'},{label:'URL da Evolution API',type:'url'},{label:'Nome da instância Evolution'}]},
{id:'instagram',nome:'Instagram',grupo:'Mensagens',desc:'Directs, respostas a stories e anúncios.',fields:[{label:'Conta'}]},
{id:'messenger',nome:'Facebook Messenger',grupo:'Mensagens',desc:'Mensagens da página e anúncios Enviar mensagem.',fields:[{label:'Página'}]},
{id:'olx',nome:'OLX',grupo:'Marketplaces',desc:'Chats e leads dos anúncios de pneus e serviços.',fields:[{label:'E-mail da conta OLX',type:'email'},{label:'Encaminhar leads para',type:'email'}]},
{id:'mercadolivre',nome:'Mercado Livre',grupo:'Marketplaces',desc:'Perguntas e mensagens pós-venda dos anúncios.',fields:[{label:'Conta vendedora'}]},
{id:'telefone',nome:'Telefone (ligações)',grupo:'Voz e site',desc:'Número para o Hudson atender e fazer ligações com a voz do ElevenLabs.',fields:[{label:'Número Twilio',type:'tel'},{label:'Voz (ElevenLabs)',options:['Hudson · voz padrão','Ana Clara · voz feminina','Personalizada']},{label:'ID da voz (ElevenLabs)'},{label:'ID do agente (ElevenLabs)'}]},
{id:'site',nome:'Site e formulários',grupo:'Voz e site',desc:'Formulário, botão WhatsApp e entrada de outros sistemas.',fields:[{label:'Domínio'}]},
{id:'leadads',nome:'Meta Lead Ads',grupo:'Anúncios',desc:'Formulários de anúncios do Instagram e Facebook.',fields:[{label:'Página'},{label:'Formulários'}]},
{id:'google',nome:'Google Ads (clique para WhatsApp)',grupo:'Anúncios',desc:'Anúncios de pesquisa e extensões de lead.',fields:[{label:'ID da conta Google Ads'}]},
{id:'email',nome:'E-mail',grupo:'Voz e site',desc:'Caixa de vendas do Google Workspace ou Microsoft 365.',fields:[{label:'E-mail',type:'email'}]},
{id:'tiktok',nome:'TikTok',grupo:'Em breve',desc:'Mensagens e leads do TikTok.',fields:[]},
];
