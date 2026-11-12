---
tags: [crm, dominio, conceitos]
---
# Visão geral e conceitos

Um CRM de atendimento centraliza clientes, leads, conversas, atendimentos, oportunidades, equipes, automações e resultados. O relacionamento vai do primeiro contato à venda, ao pós-venda e à reativação.

## Entidades que não devem ser confundidas

| Entidade | Significado | Ciclo de vida |
|---|---|---|
| Organização | Empresa cliente da plataforma e seu espaço isolado | Contrato e configuração |
| Contato | Pessoa ou empresa com identidade e histórico | Cadastro, atualização, arquivamento |
| Lead | Contexto de potencial interesse associado a um contato | Qualificação e desqualificação |
| Conversa | Troca de mensagens em um canal e identidade de canal específicos | Aberta, ativa, arquivada |
| Atendimento | Caso de serviço tratado por equipe, com estado e SLA | Novo até resolvido/encerrado |
| Oportunidade | Possibilidade comercial que percorre um funil | Aberta, ganha, perdida ou reaberta |
| Atividade | Acontecimento ou ação registrada no histórico | Criada e eventualmente concluída |

Exemplo: alguém compra em março e volta em novembro com uma dúvida. Reutiliza-se o contato, inicia-se nova conversa/atendimento e só se cria oportunidade quando houver intenção comercial pertinente.

## Jornadas cobertas

1. Captação de um contato por formulário, anúncio, indicação, importação ou canal de mensagens.
2. Identificação, deduplicação, consentimento e enriquecimento do perfil.
3. Triagem e atendimento, com atribuição, transferências e SLA.
4. Qualificação, oportunidade, proposta, negociação e desfecho.
5. Pós-venda, suporte, renovação, cobrança, reativação e análise.

## Estados e histórico

Cada entidade tem seu próprio estado. Uma oportunidade pode estar em “Negociação” enquanto o atendimento está “Aguardando cliente”. Mudanças importantes são eventos imutáveis com ator, instante, origem e valores relevantes; correções são novas alterações auditadas.

## Requisitos não funcionais

- Isolamento entre organizações em armazenamento, busca, API, eventos, automações e relatórios.
- Disponibilidade degradada com reprocessamento e fila de falhas para provedores externos.
- Pesquisa rápida, paginação e exportação com controle de acesso.
- Fuso horário e moeda por organização; armazenamento de instantes em UTC.
- Acessibilidade, interface responsiva e trilha clara para escalar ao humano.
