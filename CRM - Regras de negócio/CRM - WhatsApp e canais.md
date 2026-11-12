---
tags: [crm, whatsapp, omnichannel]
---
# WhatsApp e canais

O CRM conecta um ou mais números/canais por organização, centraliza mensagens e mantém continuidade do histórico mesmo quando a conexão cai.

## Conexão e configuração

Identificar provedor, conta, número, organização, departamento, permissões, estado e última sincronização. Permitir múltiplos números; desconectar ou substituir integração não apaga dados já armazenados. Priorizar integração oficial e documentada do canal. Credenciais ficam protegidas e nunca aparecem em logs ou notas internas.

## Recebimento: regras de negócio

- **RN-027:** identificar canal e destino comercial para determinar tenant e caixa corretos.
- **RN-028:** localizar contato pelo identificador do canal; se não existir, criar perfil provisório e permitir complementação.
- **RN-029:** associar evento à conversa correspondente e preservar horário original e horário de ingestão.
- **RN-030:** criar ou reabrir atendimento conforme política de reabertura e janela de inatividade configurada.
- **RN-031:** usar ID externo/idempotency key para ignorar redelivery sem duplicar mensagem.
- **RN-032:** suportar tipos de conteúdo oferecidos pelo canal, incluindo texto e mídia; armazenar metadados e controlar acesso ao arquivo.
- **RN-033:** erro de parsing ou mídia gera registro recuperável e não interrompe outros eventos.

## Envio

- **RN-034:** validar usuário, tenant, destinatário, consentimento e disponibilidade do canal.
- **RN-035:** gravar primeiro como pendente/em processamento, com identificador interno.
- **RN-036:** reconciliar estados do provedor (enviada, entregue, lida, falhou) sem assumir que todo canal oferece todos os recibos.
- **RN-037:** mostrar erro acionável e permitir retentativa segura quando aplicável.
- **RN-038:** oferecer respostas rápidas, modelos, anexos e variáveis com pré-visualização.
- **RN-039:** identificar autor como cliente, agente, bot ou integração.
- **RN-040:** tratar eventos duplicados ou fora de ordem sem corromper a linha do tempo.

## Políticas e janelas do canal

O canal define janelas de atendimento, modelos aprovados, categorias, limites, opt-out e elegibilidade para mensagens iniciadas pela empresa. O CRM deve manter configuração versionada e atualizável por provedor; antes de enviar, conferir janela, finalidade, autorização e template requerido. Não codificar preços ou regras temporárias como constantes. Registrar custos e consumo conforme tabela vigente do provedor.

Para automação, informar claramente quando o bot está atendendo e oferecer rota de escalonamento humano quando prevista pela política aplicável.

## Continuidade e falhas

Backoff exponencial com jitter, limite de tentativas, deduplicação, fila de falhas, replay controlado e alertas. Uma interrupção não pode descartar eventos confirmados; guardar estado de sincronização e permitir reconciliação. Histórico local autorizado permanece disponível após desconexão.

## Outros canais

Instagram, Messenger, chat do site, e-mail, SMS, formulário e voz podem usar a mesma inbox, mas devem preservar identidade, capacidades, recibos, limites, consentimentos e políticas específicas de cada canal.
