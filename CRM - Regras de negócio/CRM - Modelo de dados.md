---
tags: [crm, dados, arquitetura]
---
# Modelo de dados

## Entidades principais

| Entidade | Relações e campos essenciais |
|---|---|
| Organization | tenant_id, nome, estado, fuso, moeda, plano/limites |
| User / Membership | identidade; tenant; papel, departamentos, estado, disponibilidade |
| Team / Department | tenant, membros, competências e horários |
| Channel / ProviderAccount | tenant, tipo, credencial referenciada, estado, capabilities |
| Contact | tenant, dados normalizados, preferências, estado, origem principal |
| ContactIdentifier | contato, tipo/canal, valor normalizado, verificação |
| Lead | contato, fonte/campanha, interesse, qualificação, estado |
| Conversation | contato, canal, identidade externa, estado, timestamps |
| Message | conversa, ID externo, direção, autor, tipo, payload/mídia, status |
| Ticket / Atendimento | contato, conversa, fila, estado, responsável, prioridade e SLA |
| AssignmentHistory | atendimento, anterior/novo usuário/fila, ator, motivo, instante |
| Pipeline / Stage | tenant, ordem, requisitos e estado terminal |
| Opportunity | contato, funil/etapa, responsável, valor/moeda, previsão, desfecho |
| Activity / Task | vínculo, responsável, tipo, prazo, estado, resultado |
| Tag / CustomField | tenant, definição e valor tipado por entidade |
| Consent / Suppression | contato, finalidade/canal, estado, fonte e instante |
| Workflow / Execution | versão, gatilho, estado, ações, erros e idempotency key |
| CampaignTouch | contato/lead, plataforma, campanha, UTMs, timestamps |
| AuditEvent | tenant, ator, ação, alvo, timestamp, metadados mínimos |

## Integridade e índices

- Chaves de entidades operacionais incluem tenant_id; restrições compostas impedem referências cruzadas entre tenants.
- Índices por tenant + telefone/e-mail normalizados (com política para identificadores compartilhados), status, responsável, canal e data.
- Mensagens únicas por provedor/conta/ID externo; eventos idempotentes por origem e chave.
- Históricos de estágio/atribuição e auditoria são append-only, salvo retenção/anonimização autorizada.
- Campos customizados usam esquema tipado e validação; evitar um blob sem contrato para dados críticos.
- Arquivos de mídia têm referência, hash/ID, política de expiração, controle de acesso e estado de varredura.

## Consistência e exclusão

Definir cascatas: excluir/anonimizar contato não remove automaticamente registros financeiros, métricas agregadas ou auditoria que devem ser retidos; decisões dependem de política. Mesclar contatos atualiza vínculos de forma transacional e audita. Eventos assíncronos usam outbox/inbox ou mecanismo equivalente.

## Diagrama lógico simplificado

Organization 1—N Contact 1—N Conversation 1—N Message

Contact 1—N Lead; Contact 1—N Ticket; Contact 1—N Opportunity

Ticket N—1 Queue; Ticket N—N User via assignments/participants

Opportunity N—1 Pipeline/Stage; Activity N—1 Contact/Ticket/Opportunity

Organization 1—N Channel, Workflow, Team, UserMembership e AuditEvent
