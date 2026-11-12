---
tags: [crm, contatos, leads]
---
# Contatos e leads

## Perfil do contato

Identidade e nome; documento apenas se necessário; telefones normalizados em E.164; e-mail; empresa; preferências; origem; campanhas e UTMs; interesses; responsável; tags; campos customizados; consentimentos, bloqueios e histórico relacionado.

## Regras de negócio

- **RN-017:** cada contato tem ID interno único e está no tenant correto.
- **RN-018:** normalizar identificadores comparáveis (telefone, e-mail) sem destruir o valor original exibido.
- **RN-019:** verificar possíveis duplicatas antes de criar novo contato, considerando tenant e canal.
- **RN-020:** mesclar duplicatas com escolha auditada do registro principal; preservar conversas, negócios, origem, consentimentos e referências.
- **RN-021:** um contato pode possuir atendimentos e oportunidades múltiplas e simultâneas.
- **RN-022:** preservar origem inicial e registrar cada toque/campanha posterior como atribuição separada.
- **RN-023:** campos customizados têm tipo, validação, visibilidade e política de retenção configuráveis.
- **RN-024:** várias tags por contato; registrar autoria e origem manual/automática.
- **RN-025:** importação CSV/planilha/API oferece mapeamento, prévia, validação, dedupe, resumo e erros por linha.
- **RN-026:** arquivar, anonimizar ou excluir segundo retenção, solicitação e obrigações aplicáveis.

## Ciclo de lead

Lead representa uma intenção/captação qualificada, não uma pessoa diferente. Registrar fonte, momento de entrada, produto/serviço de interesse, campanha, consentimento, responsável, etapa de qualificação, temperatura e histórico de tentativas. Critérios de qualificação (ex.: necessidade, prazo, orçamento, autoridade) são configuráveis por operação.

Estados exemplares: novo, em contato, qualificado, desqualificado, convertido e reativado. Desqualificação registra motivo; reativação preserva o ciclo anterior e registra o novo contexto.

## Regras adicionais

- Não sobrescrever silenciosamente valores informados por cliente; guardar origem e instante de atualização quando relevante.
- Dado sem origem conhecida fica explicitamente desconhecido, não presumido.
- Mudança de responsável, estágio ou prioridade entra na trilha do contato/lead.
- Restrições de contato e opt-out acompanham fusões e novos canais compatíveis.
- Acesso a documento e dados sensíveis é limitado por finalidade e papel.
