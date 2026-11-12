---
tags: [crm, workflow, automacao]
---
# Workflows e automações

Formato: **gatilho → condições → ações → resultado**, com estado de execução e histórico.

## Gatilhos

Mensagem recebida; contato/lead criado; tag ou campo alterado; atendimento criado, transferido ou perto do SLA; oportunidade movimentada; ausência de resposta; atividade vencida; agendamento próximo; venda registrada; webhook recebido.

## Ações

Enviar mensagem; atribuir/transferir; adicionar/remover tag; atualizar campo; criar atividade/oportunidade; mover etapa; notificar; iniciar bot/IA; esperar prazo/condição; chamar API/webhook; encerrar ou marcar para revisão humana.

## Regras de negócio

- **RN-069:** automação e recursos referenciados ficam no escopo do tenant.
- **RN-070:** estados incluem rascunho, ativa, pausada e desativada.
- **RN-071:** condições suportam grupos E/OU/NÃO e valores ausentes de modo explícito.
- **RN-072:** execução segue ordem e dependências definidas.
- **RN-073:** prevenir ciclos infinitos, repetição causada por própria alteração e concorrência conflitante.
- **RN-074:** deduplicar por evento, tornar ação repetível com segurança e tratar falha por ação.
- **RN-075:** mensagem respeita canal, janela, consentimento, limites e frequência.
- **RN-076:** execução mantém logs consultáveis, resultados e erros sem registrar segredos.
- **RN-077:** pausar cancela ou marca esperas pendentes conforme política claramente exibida.
- **RN-078:** resolver conflitos de workflows concorrentes por prioridade, escopo e regra previsível.

## Execução confiável

Usar fila durável, chave de idempotência, tentativas limitadas e backoff, timeouts, dead-letter queue e reprocessamento auditado. Separar falha transitória de inválida. Condição é avaliada com versão do dado e instante explícitos. Mudança de workflow não altera silenciosamente execuções antigas.

## Exemplo: acompanhamento de proposta

Quando oportunidade entra em “Proposta enviada”, criar tarefa ao responsável para revisar em um dia útil. Se permanecer aberta e houver base legal/consentimento, agendar mensagem compatível com a política vigente do canal; cancelar se oportunidade ganhar/perder ou contato pedir interrupção. Toda execução registra condição avaliada e ação efetuada.
