---
tags: [crm, roadmap, entrega]
---
# Roteiro de implementação

## Fase 1 — Fundação e isolamento

Tenant, identidade, membership/RBAC, auditoria, contatos, campos/tags, importação e deduplicação. Critério de aceite: testes de isolamento em API, busca, fila e relatório; desligar usuário sem perder autoria.

## Fase 2 — Mensageria e inbox

Conector de um canal prioritário, webhooks idempotentes, mensagens e mídia, estado de entrega, linha do tempo, notas internas, atribuição manual e atendimento. Aceite: redelivery/out-of-order não duplica; falha do provedor preserva histórico; nota não sai ao cliente.

## Fase 3 — Filas e SLA

Filas, regras de elegibilidade, disponibilidade, capacidade, transferência, calendário, alertas e métricas de SLA. Aceite: atribuição atômica e atendimento sem agente permanece visível.

## Fase 4 — Leads e funis

Qualificação, origem, oportunidades, Kanban, requisitos por etapa, ganho/perda e atividades. Aceite: status do atendimento independente do funil; motivos e históricos preservados.

## Fase 5 — Workflows e canais adicionais

Designer de automação, execução durável, idempotência, retentativa, logs, pausa, modelos e mais conectores. Aceite: ciclo infinito prevenido; opt-out bloqueia mensagem; falha é observável e recuperável.

## Fase 6 — Campanhas, telefonia e relatórios

Atribuição multi-toque, conversões, telefonia/agenda, dashboards com definições documentadas, exportação controlada. Aceite: moeda, fuso, janela e denominador explícitos.

## Fase 7 — IA e otimização

Sugestão antes de autonomia, base autorizada, handoff, avaliação, limites de custo e revisão humana. Aceite: testes por intenção, fontes e versão registradas, agente pode interromper automação.

## Requisitos transversais de pronto

Privacidade desde o desenho; acessibilidade; monitoramento; backups e restauração; alertas; migrações; documentação de configuração; suporte e rollback. Fazer piloto com dados controlados, validar fluxos reais e só então ampliar equipes/canais.

## Decisões a fechar por organização

Políticas do canal e provedor; estados e transições; horários e feriados; SLA; papéis; regra de dedupe; origem e atribuição; consentimentos; retenção; moeda/fuso; automações permitidas; autonomia da IA; indicadores e critérios de ganho/perda.
