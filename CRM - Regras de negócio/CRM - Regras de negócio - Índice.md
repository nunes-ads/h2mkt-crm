---
tags: [crm, regras-de-negocio, indice]
status: especificacao-base
---
# Regras de negócio de um CRM de Atendimento ao Cliente

> Especificação funcional de referência para um CRM omnichannel, multiempresa e com automação. As regras devem ser ajustadas às políticas dos canais, contratos e legislação aplicáveis antes de entrar em produção.

## Como navegar

- [[CRM - Visão geral e conceitos|Visão geral e conceitos]]
- [[CRM - Organizações, usuários e permissões|Organizações, usuários e permissões]]
- [[CRM - WhatsApp e canais|WhatsApp e canais]]
- [[CRM - Contatos e leads|Contatos e leads]]
- [[CRM - Caixa de entrada e atendimentos|Caixa de entrada e atendimentos]]
- [[CRM - Filas e distribuição|Filas e distribuição]]
- [[CRM - Funis e oportunidades|Funis e oportunidades]]
- [[CRM - Workflows e automações|Workflows e automações]]
- [[CRM - Inteligência artificial|Inteligência artificial]]
- [[CRM - Anúncios e atribuição|Anúncios e atribuição]]
- [[CRM - Tarefas e telefonia|Tarefas e telefonia]]
- [[CRM - Analytics e relatórios|Analytics e relatórios]]
- [[CRM - LGPD, segurança e retenção|LGPD, segurança e retenção]]
- [[CRM - API e integrações|API e integrações]]
- [[CRM - Modelo de dados|Modelo de dados]]
- [[CRM - Roteiro de implementação|Roteiro de implementação]]

## Princípio central

O CRM deve manter separados **contato**, **lead**, **conversa**, **atendimento** e **oportunidade**. Uma pessoa pode ter várias conversas, atendimentos e oportunidades ao longo do tempo sem ser cadastrada novamente. Histórico, permissões, origem e auditoria acompanham cada objeto.

## Escopo coberto

Multi-tenancy; equipes e acesso; WhatsApp; leads e contatos; inbox omnichannel; filas e SLA; funis; workflows; IA; anúncios e atribuição; tarefas e telefonia; indicadores; LGPD; API; modelo de dados; implantação e aceitação.

## Regras transversais

1. Todo dado operacional pertence a uma organização (tenant) e cada operação verifica o escopo autorizado.
2. Ações importantes são auditáveis e os eventos externos são idempotentes.
3. Status de atendimento, status do contato e etapa de oportunidade não se substituem.
4. Falha em uma integração não apaga o histórico local nem interrompe os demais canais.
5. Automação respeita permissões, consentimento, limites do canal e possibilidade de atendimento humano.
6. Métricas definem claramente período, fuso horário, filtros e denominador.

## Convenções

“Deve” indica requisito; “pode” indica capacidade configurável. RN-### identifica regras rastreáveis; os números continuam a sequência da especificação original quando recuperável. Regras de provedores externos são parametrizáveis e devem refletir a política vigente do provedor.
