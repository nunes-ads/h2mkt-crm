---
tags: [crm, api, integracoes]
---
# API e integrações

## Capacidades

APIs para contatos, leads, conversas, mensagens, atendimentos, oportunidades, atividades, usuários conforme permissão e eventos de webhook. Integrações de anúncios, formulários, telefonia, e-mail, calendário, pagamento e armazenamento de mídia podem ser adicionadas por adaptadores.

## Regras

- Autenticar por mecanismo seguro; escopos mínimos por organização e finalidade.
- Autorizar cada operação no tenant e objeto correspondente.
- Paginar, filtrar e limitar taxa; erros padronizados, sem vazar dados ou segredos.
- Comandos de criação/envio aceitam chave de idempotência quando podem ser repetidos.
- Webhooks são assinados/verificáveis, versionados, redelivery-safe e enviados com retry limitado.
- Consumidor registra cursor/estado de sincronização; eventos podem chegar duplicados ou fora de ordem.
- Mudanças incompatíveis são versionadas e anunciadas; campos desconhecidos são tratados de forma resiliente quando possível.
- Segredos são armazenados em cofre seguro, mascarados em UI/log e revogáveis.
- Importações e exportações produzem status, relatório de erros e trilha auditável.
- Integração não confiável não pode contornar política de canal, consentimento ou permissões internas.

## Observabilidade

Correlation ID, timestamp, tenant, sistema de origem, tentativa e resultado, sem registrar tokens nem conteúdo excessivo. Painel mostra estado, último sucesso, falhas, fila pendente e ação segura de reconectar/reprocessar.
