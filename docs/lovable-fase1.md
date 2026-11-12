# CRM H2 Marketing — provisionamento da fase 1

Este documento é uma solicitação pronta para o editor do Lovable. As migrações e os tipos gerados **não foram alterados** nesta implementação. A nova tela `/contatos` usa os contratos abaixo e mostra o estado de ativação pendente enquanto eles não existirem.

## Pedido para o Lovable

Implemente a fundação persistente do CRM H2 Marketing no Supabase já conectado ao projeto, respeitando o AGENTS.md e todos os documentos em `CRM - Regras de negócio`. Preserve os perfis, autenticação, usuários e dados existentes. Não faça reset do banco, não importe dados de demonstração e não atribua papéis administrativos ao cadastro público.

Primeiro inspecione o banco real e as migrações existentes: o código local descreve apenas `profiles` e `user_roles`; pode haver mudanças remotas ainda não sincronizadas. Se houver estrutura operacional remota, adapte e migre com preservação de dados. Não crie outra base em paralelo sem necessidade.

O frontend e as server functions da fase 1 já estão preparados em:

- `src/lib/crm/contracts.ts`: formatos Zod de entradas e respostas.
- `src/lib/crm/contacts.ts`: normalização e validações que devem ser repetidas no banco.
- `src/lib/crm/crm.functions.ts`: funções autenticadas, sem service role.
- `src/lib/crm/gateway.ts`: tratamento de erros e chamada da RPC.
- `src/components/crm/CrmContacts.tsx`: interface do cadastro.

Implemente `public.crm_api_v1(p_operation text, p_payload jsonb) returns jsonb`, exclusivamente para usuários autenticados e confirmados. O nome, os parâmetros e as respostas precisam corresponder exatamente ao contrato. Desconhecer uma operação deve produzir erro, nunca executar SQL arbitrário. SQL dinâmico com entradas concatenadas é proibido.

## Isolamento e autorização obrigatórios

1. Resolva o ator com `auth.uid()`, verificando conta ativa e e-mail confirmado. Nunca receba papel, ator, equipes, concessões ou tenant efetivamente autorizado do navegador.
2. `p_payload.tenant_id` é apenas a organização solicitada. Valide membership ativo no banco em **toda** operação, inclusive repetição idempotente, busca, exportação e leitura de histórico.
3. Separe escopos `own`, `team` e `organization`. Um agente só vê registros próprios; equipe permite os próprios e os de suas equipes autorizadas; organização permite todos no tenant. Escopo deve restringir contagem e busca também.
4. Negue por padrão. Permissões são concessões controladas pelo servidor, não editáveis no perfil. Papéis sugeridos: `admin`, `supervisor`, `agent`, `analyst`, `integration`. O papel por si só não atravessa tenants.
5. Nenhum `INSERT/UPDATE/DELETE` direto do cliente pode contornar as regras da RPC. Aplique RLS também às tabelas; revogue permissões diretas de escrita quando apropriado. Se usar SECURITY DEFINER, fixe `search_path`, verifique ator/tenant/objeto em cada ramo e restrinja EXECUTE. Não dependa de RLS do proprietário da função.
6. FKs compostas com tenant impedem contato, equipe, responsável ou histórico apontando para outra organização. Leituras não revelam existência de objetos sem autorização.
7. Desativar membership preserva a autoria e revoga imediatamente acesso e novas atribuições. O cache da interface nunca autoriza uma ação.
8. Permissões mínimas reconhecidas pelo cliente: `contacts.read`, `contacts.write`, `contacts.import`, `contacts.merge`, `contacts.archive`, `contacts.export`, `contacts.privacy`, `audit.read`, `channels.read`, `channels.send`, `ai.suggest`. Não conceder todas a todos.

## Estrutura persistente

Os nomes físicos podem aproveitar tabelas existentes. O contrato externo permanece abaixo.

| Entidade                        | Requisitos                                                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Organizations                   | UUID, nome, estado, fuso IANA, moeda ISO e limites; padrão proposto America/Sao_Paulo e BRL, ajustável por organização              |
| Memberships                     | tenant, usuário de auth, papel, escopo, estado; unicidade tenant + usuário                                                          |
| Teams / TeamMemberships         | tenant, equipe, usuário; vínculo ativo; referências compostas                                                                       |
| Permission grants               | concessões específicas por membership; alterações administrativas auditadas                                                         |
| Contacts                        | UUID, tenant, owner/team, name, phone/email originais e normalizados, source inicial, status, version, created_at/updated_at em UTC |
| ContactIdentifiers              | telefone/e-mail adicionais, normalizado e original, contato e tenant; necessário preservar identificadores na mesclagem             |
| Tags / ContactTags              | tenant, nome, atribuição com ator/instante/origem manual ou importação                                                              |
| CustomFieldDefinitions / Values | key, label, type, required, options, acesso e retenção; valores validados segundo definição do tenant                               |
| Suppressions / PreferenceEvents | bloqueio de marketing e reversões com ator, instante e referência da evidência; trilha append-only                                  |
| CampaignTouches                 | preservar origem inicial e as origens adicionais absorvidas pela mesclagem                                                          |
| AuditEvents                     | tenant, ator, alvo, ação, instante, campos alterados, motivo; append-only com acesso restrito e minimização                         |
| IdempotencyRequests             | tenant + ator + operação + request_id, hash canônico da entrada, resultado, instante; transacional                                  |
| ImportRuns / ImportRows         | estado, totais, autoria e erros por linha sem despejar todo o arquivo em logs                                                       |

Não use um único JSON por tenant como substituto de todas as entidades. Defina índices de busca por tenant, identificadores normalizados, status, responsável e datas. Valide fuso e moeda. A UI não exibe documentos pessoais nesta fase.

## Normalização, duplicatas e concorrência

- Telefone brasileiro sem + aceita DDD + 8/9 dígitos, inclusive DDD 55. Internacional exige + e 8–15 dígitos; forma comparável E.164. Preserve a grafia original. Nunca complete um número curto por adivinhação.
- E-mail: trim e lowercase apenas para comparação; preserve original. Rejeite inválidos.
- Política inicial: identificador normalizado exclusivo entre contatos não mesclados/anonimizados do mesmo tenant, inclusive arquivados. Não imponha unicidade global. Identificadores legitimamente compartilhados exigem política específica posterior.
- Nome e foto não são prova de identidade. Não mesclar automaticamente por eles.
- Criação concorrente do mesmo identificador deve produzir um cadastro e um conflito, não duas linhas. Use constraints/locks transacionais.
- Edição exige `expected_version`; incremente versão atomicamente. Conflito mantém os dados atuais e não sobrescreve silenciosamente.
- `request_id` é UUID. Repetir a mesma operação com o mesmo conteúdo retorna o resultado original, sem auditoria/contatos duplicados. Chave repetida com conteúdo diferente gera `CRM_IDEMPOTENCY_CONFLICT`. Revalide a autorização antes de retornar resultado previamente armazenado.
- Campos desconhecidos são rejeitados nas entradas de comando. Valores calculados, owner_id, team_id, autor e timestamps nunca são aceitos diretamente do cliente. Nesta fase novas criações pertencem ao usuário que as criou; atribuição administrativa é evolução posterior.
- `source` inicial fica imutável após criação. Nova origem precisa de evento de toque, não overwrite.
- Bloqueio de marketing não equivale a consentimento para todas as finalidades. Não interpretar ausência de bloqueio como autorização universal.

## Contrato RPC v1

Os formatos completos estão em `src/lib/crm/contracts.ts`. Todas as datas são ISO 8601 UTC; UUIDs são strings. Retorne objetos JSON, não uma lista envolvendo o objeto.

### workspace

Entrada `{}`. Resposta `{ "version": 1, "memberships": [...] }`.

Cada membership: `tenant_id`, `name` (nome da organização), `user_id`, `role`, `active`, `scope`, `team_ids`, `permissions`, `timezone`, `currency`. Retornar somente organizações autorizadas do ator; cadastro sem membership retorna lista vazia. Não criar uma organização/membership implicitamente.

### contacts.list

Entrada: `tenant_id`, `query`, `status` (`active` ou `archived`), `page` (>=1), `page_size` (1–100). Exige `contacts.read`.

Busca por nome, telefone normalizado/original e e-mail; consulta parametrizada, escape de curingas quando necessário. Ordenação estável por nome + id. Aplicar o mesmo escopo ao total e à lista. Campos personalizados retornados são somente os visíveis ao solicitante.

Resposta: `{ items: Contact[], total, page, page_size, fields: CustomField[] }`.

Contact contém todos os campos do schema: `id`, `tenant_id`, `owner_id` nullable, `team_id` nullable, `name`, `phone`, `email`, `phone_normalized` nullable, `email_normalized` nullable, `source`, `tags`, `custom_fields`, `status` (`active|archived|merged|anonymized`), `marketing_opt_out`, `version`, `created_at`, `updated_at`.

CustomField: `key`, `label`, `type` (`text|number|boolean|date|select`), `required`, `options` (array). Retornar apenas campos autorizados; nunca remover campos ocultos numa edição feita por quem não pode vê-los.

### contacts.save

Entrada: `tenant_id`, `request_id`, `id` nullable, `expected_version` nullable, `contact` com `name`, `phone`, `email`, `source`, `tags`, `custom_fields`. Os dois null significam criação; ambos preenchidos significam edição. Exige `contacts.write` e acesso ao objeto. Resposta: Contact.

Repetir validação no servidor, incluindo campos customizados tipados, datas reais, opções e obrigatoriedade. Não permitir editar contato mesclado/anonimizado. Arquivar/restaurar tem ação específica. Não aceitar alteração de origem inicial. Auditar valores sensíveis com minimização; nomes dos campos alterados bastam na UI.

### contacts.import

Entrada: `tenant_id`, `request_id`, `rows: [{ row, contact }]` (1–500 linhas). `row` preserva a linha original do arquivo, começando em 2. Exige `contacts.import` **e** `contacts.write`.

Modo inicial exclusivamente criar e ignorar duplicatas, sem atualização silenciosa de existentes. Valide novamente o lote, dedupe dentro da organização, não apenas dentro da planilha. Erros de uma linha não apagam válidas. Cada linha tem savepoint/resultado estável e a execução é idempotente. Uma falha total de infraestrutura não deve ser registrada como importação concluída.

Resposta: `{ created, skipped, errors: [{ row, message }] }`; a soma deve corresponder ao número enviado. Registrar execução, autor e contagens. A interface mostra também as linhas inválidas/repetidas que não foram enviadas.

### contacts.merge

Entrada: `tenant_id`, `request_id`, `primary_id`, `secondary_id`, `primary_version`, `secondary_version`, `reason` (5–500 caracteres). Exige `contacts.merge` e acesso aos **dois** registros.

Lock dos dois contatos em ordem estável; validar versões e tenant. Preservar os dados primários escolhidos, unir tags e identificadores, preservar ambas as origens via histórico de toques. Preferências restritivas prevalecem. Não perder telefones/e-mails alternativos. Reapontar atomicamente relações existentes de leads, conversas, atendimentos, oportunidades, tarefas, consentimentos e atribuições; auditar a escolha. Marcar secundário como merged com referência ao primário, sem apagá-lo fisicamente. Se houver conflito de campo customizado, conservar valor primário e registrar conflito/origem na auditoria restrita. Resposta: Contact principal atualizado.

### contacts.archive

Entrada: `tenant_id`, `request_id`, `id`, `expected_version`, `archived` boolean, `reason`. Exige `contacts.archive`. Apenas active ↔ archived. Preservar história, identificadores e vínculos. Não encerrar atendimento, oportunidade ou tarefa como efeito colateral. Resposta: Contact.

### contacts.privacy

Entrada: `tenant_id`, `request_id`, `id`, `expected_version`, `marketing_opt_out`, `reason` (inclui referência da evidência). Exige `contacts.privacy`. Registrar evento append-only e efetivar a preferência transacionalmente. Não apagar o bloqueio antigo ao revertê-lo. Resposta: Contact. A aplicação dessa preferência a todos os canais será requisito obrigatório da fase 2; não ativar campanhas antes disso.

### contacts.history

Entrada: `tenant_id`, `id`. Exige `audit.read` e acesso ao contato. Resposta array (até 100 eventos recentes, ordem decrescente por timestamp/id): `{ id, action, actor_name, occurred_at, changed_fields: string[], reason: string|null }`. Sem segredos, tokens, corpos completos de mensagens ou valores sensíveis de campos.

### contacts.export

Entrada: mesmos filtros de list + `request_id`. Exige `contacts.export` e `contacts.read`. A UI exporta **a página atual**, não toda a organização. Resposta igual a list; auditar filtro, quantidade e ator, sem copiar o conteúdo completo para logs. Repetição idempotente não duplica evento de exportação. A UI neutraliza fórmulas na saída CSV.

### Erros

Para erros de negócio, `message` deve ser exatamente um destes códigos: `CRM_DUPLICATE`, `CRM_CONFLICT`, `CRM_FORBIDDEN`, `CRM_LIMIT`, `CRM_VALIDATION`, `CRM_IDEMPOTENCY_CONFLICT`. Sem detalhes internos no erro exposto. RPC ausente é reconhecida por PGRST202/42883; acesso SQL negado por 42501. A UI trata falha de infraestrutura separadamente de base não provisionada.

## Conector antigo e ativação

O conector Evolution anterior aceitava a instância enviada pelo navegador, e a função de IA não tinha middleware de autenticação. Foram adicionadas verificações:

- Operações legadas de integração exigem e-mail confirmado e papel global `integration_admin` em `user_roles`, concedido somente pelo servidor a um administrador explicitamente escolhido.
- Somente a instância de `EVOLUTION_INSTANCE_NAME` pode ser acessada por esse conector. Não é autorização multiempresa. A substituição por canais com membership ocorrerá na fase 2.
- Não atribuir esse papel em massa nem por autoinscrição. Solicitar a identidade do administrador antes de concedê-lo; não inferir pelo primeiro usuário cadastrado.
- IA usa somente gateway Lovable, histórico limitado e mensagens user/assistant. Sugestões exigem revisão humana. O fallback para outro projeto Supabase foi removido.
- O envio automático comandado por localStorage foi removido. Não reativar sem política por organização, opt-out, idempotência, outbox durável e auditoria.
- O histórico corrente da Inbox fica em cache de sessão e é limpo no logout; não é mais gravado em localStorage por `useDeals`. Registros locais antigos não foram apagados ou importados automaticamente. Planeje backup/exportação e migração explícita dos campos locais antes de considerar a migração concluída.

## Critérios de aceite antes do piloto

1. Dois tenants e usuários distintos: tentar leitura, busca, contagem, escrita, histórico, importação, mesclagem e exportação de outra organização tanto pela UI quanto pela RPC direta. Tudo deve negar sem revelar dados.
2. Testar usuário multiempresa com papel diferente em cada uma, usuário sem vínculo, membership desativado e troca de equipe.
3. Tentar conceder papel via edição de profile, metadados de auth, payload e chamada direta de tabela. Deve falhar.
4. Repetir uma criação/importação 3 vezes com mesma chave: um único resultado. Reutilizar chave com payload diferente: erro. Desativar usuário e repetir chave: acesso negado.
5. Duas criações concorrentes do mesmo telefone no mesmo tenant: uma criação e um conflito. Mesmo telefone em outro tenant: permitido.
6. Edição com versão antiga: recusar sem perder os campos. Troca de organização não mostra linhas ou rascunhos da anterior.
7. Mesclagem deve conservar conversas, oportunidades simultâneas, autoria antiga, origem inicial e bloqueios. Falha no meio reverte a transação completa.
8. Importar CSV e XLSX com válidas, inválidas e duplicadas. Validar números com DDD 55, e-mail normalizado, campos obrigatórios, relatório por linha e lote repetido.
9. Arquivar/restaurar não ganha/perde oportunidade. Histórico não permite alteração pelo cliente.
10. Testar recuperação de backup e reversão de implantação sem apagar dados. Só depois testar canal real com contatos controlados e ampliar a equipe.

Esta solicitação provisiona a fase 1. Webhooks, outbox, estados de mensagens, mídia, atendimentos, filas/SLA, leads/oportunidades persistentes, workflows, telefonia, atribuição, analytics e políticas de IA continuam no roteiro das próximas fases. Não marcar essas fases como concluídas apenas por existirem telas de demonstração.
