---
tags: [crm, inbox, atendimento]
---
# Caixa de entrada e atendimentos

## Inbox

Lista pesquisável e filtrável de conversas; mensagens ao vivo; anexos; não lidas; canal e identidade usados; responsável e equipe; notas internas; respostas salvas; perfil e histórico; tarefas e oportunidades relacionadas; transferir, resolver, arquivar e reabrir.

## Estados do atendimento

| Estado | Uso |
|---|---|
| Novo | Criado sem tratamento |
| Na fila | Espera por atribuição |
| Em atendimento | Responsável ativo |
| Aguardando cliente | Empresa respondeu e espera retorno |
| Aguardando interno | Depende de outra equipe |
| Pendente | Suspenso com acompanhamento agendado |
| Resolvido | Solicitação solucionada |
| Encerrado | Finalizado operacionalmente |

Estados são configuráveis com transições válidas e motivo quando necessário.

## Regras de negócio

- **RN-041:** atendimento tem contato, canal de origem, estado, tenant e timestamps.
- **RN-042:** pode ter responsável principal e participantes autorizados.
- **RN-043:** supervisores acessam conforme escopo mesmo sem atribuição direta.
- **RN-044:** nota interna é visualmente distinta e tecnicamente impedida de ser enviada ao cliente como mensagem.
- **RN-045:** encerrado pode reabrir por ação autorizada ou nova mensagem conforme política.
- **RN-046:** registrar por quem, quando e como encerrou e motivo se exigido.
- **RN-047:** encerrar atendimento não perde nem ganha oportunidade automaticamente.
- **RN-048:** eventos durante transferência permanecem ligados ao caso correto.

## Conversa e linha do tempo

Ordenar por horário do evento, distinguindo mensagens, notas, atribuições, mudanças de estado, automações, anexos e atividades. Mostrar origem do evento e atraso de sincronização quando relevante. Reação, edição e exclusão no canal devem refletir as capacidades do provedor e preservar trilha interna adequada.

## Colaboração

Evitar envio concorrente acidental com indicador de composição ou bloqueio leve; suportar assumir/liberar, @menções internas e participantes. Uma mensagem em andamento pode exibir estado “enviando” antes da confirmação externa.
