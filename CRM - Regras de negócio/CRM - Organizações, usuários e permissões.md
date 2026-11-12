---
tags: [crm, multi-tenant, acesso]
---
# Organizações, usuários e permissões

## Estrutura

Plataforma → organização (tenant) → departamentos, equipes, filas, usuários, canais, funis, campos, automações e configurações. Um usuário pode participar de várias organizações, com papel e escopo próprios em cada uma.

## Regras de negócio

- **RN-001 — Isolamento de dados:** cada organização acessa somente seus contatos, conversas, negócios, usuários e configurações.
- **RN-002 — Isolamento de integrações:** credenciais, números e ativos de canal pertencem a uma organização e não são compartilhados implicitamente.
- **RN-003 — Administrador da plataforma:** gerencia somente organizações e operações globais que lhe foram atribuídas.
- **RN-004 — Administrador da organização:** configura apenas o tenant correspondente.
- **RN-005 — Usuário multiempresa:** identidade global pode ter permissões diferentes por organização.
- **RN-006 — Personalização:** cada organização configura funis, campos, tags, horário, equipes e automações.
- **RN-007 — Limites:** cotas de usuários, números, armazenamento, mensagens e IA são aplicadas e observáveis.
- **RN-008 — Auditoria administrativa:** alterações sensíveis registram ator, instante, alvo e valores anterior/novo quando apropriado.
- **RN-009:** usuário operacional precisa de vínculo ativo com organização.
- **RN-010:** usuário pode pertencer a departamentos diferentes.
- **RN-011:** escopo de leitura pode ser próprio, da equipe, do departamento ou da organização, conforme papel.
- **RN-012:** transferência respeita permissão de origem e destino.
- **RN-013:** usuário inativo não recebe nova atribuição automática.
- **RN-014:** desativação preserva históricos, mensagens e resultados.
- **RN-015:** assumir, redistribuir e supervisionar são permissões distintas e auditáveis.
- **RN-016:** exportar, excluir, anonimizar, importar em massa e disparar campanhas exigem permissões específicas.

## RBAC e disponibilidade

Papéis sugeridos: superadministrador, administrador da organização, gestor/supervisor, atendente/vendedor, analista somente leitura e identidade técnica de integração. Autorizações combinam papel, organização, departamento, propriedade e ação. Negar por padrão.

Estados operacionais do atendente são independentes do login: online, disponível, ocupado, ausente e offline. “Online” não significa elegível para receber trabalho; capacidade, horário e pausas também contam.

## Regras de segurança operacional

- Toda consulta e comando é escopado pelo tenant a partir de identidade confiável, não de um identificador enviado pelo cliente.
- Ações delegadas a bot/API têm identidade própria e escopo mínimo.
- Mudança de equipe ou desligamento revoga sessões e redistribui pendências sem apagar autoria passada.
- Acesso excepcional de suporte deve ter motivo, escopo e registro auditável.
