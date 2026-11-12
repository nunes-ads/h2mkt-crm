---
tags: [crm, vendas, funil, kanban]
---
# Funis e oportunidades

Funis representam processos comerciais ou de relacionamento, distintos do estado de atendimento. Exemplos: novos clientes, renovação, recuperação, pós-venda e cobrança.

## Regras de negócio

- **RN-058:** organização pode ter vários funis.
- **RN-059:** cada funil possui etapas ordenadas, nomes, critérios e estados terminais configuráveis.
- **RN-060:** oportunidade pertence a um funil e ocupa etapa ativa ou estado terminal.
- **RN-061:** pode ter valor, moeda, previsão, prioridade, origem e responsável.
- **RN-062:** contato pode ter várias oportunidades, inclusive no mesmo funil conforme política.
- **RN-063:** mudança de etapa registra antes/depois, ator, instante e motivo/origem.
- **RN-064:** avançar pode exigir campos, atividade ou aprovação.
- **RN-065:** ganha registra valor realizado e data de fechamento.
- **RN-066:** perdida exige motivo configurável e opcionalmente concorrente.
- **RN-067:** reabertura é autorizada e preserva desfecho anterior.
- **RN-068:** transições podem iniciar automações idempotentes.

## Operação Kanban

Arrastar cartão verifica permissões e campos obrigatórios; transição recusada explica o motivo sem perder edição. Filtros não alteram dados. Alterações em lote têm prévia e registro de autor. Colunas de ganho/perda são estados terminais, não etapas comuns se isso causar ambiguidade.

## Regras comerciais

Definir moeda e conversão para relatórios; não somar valores de moedas diferentes sem regra declarada. Previsão de fechamento, probabilidade e ponderação são configuráveis. Reatribuição não altera autoria de atividades passadas. Perder um negócio não apaga contato nem atendimento.
