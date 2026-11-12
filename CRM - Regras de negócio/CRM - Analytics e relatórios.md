---
tags: [crm, analytics, indicadores]
---
# Analytics e relatórios

## Indicadores de atendimento

Volume por canal; primeira resposta; tempo até resolução; backlog; reaberturas; abandono; cumprimento de SLA; CSAT e avaliação; transferências; produtividade com contexto de carga e complexidade.

## Indicadores de vendas

Leads por origem; conversão por etapa; velocidade do funil; oportunidades abertas; taxa de ganho/perda e motivos; receita; previsão; ticket; ciclo de vendas e conversão por equipe/canal.

## Regras de definição

- Cada métrica tem fórmula, unidade, eventos incluídos, exclusões, fuso, período e denominador documentados.
- Filtrar por tenant e permissões do solicitante.
- Distinguir horário útil de corrido e data do evento de data de ingestão.
- Paginar e agregar com consistência; declarar atraso de atualização.
- Valores de moedas diferentes só são agregados após conversão definida.
- Exportações são auditadas, limitadas por permissão e minimizam dados pessoais.
- Mudanças em definição versionam o relatório para comparação histórica coerente.

## Qualidade e diagnóstico

Exibir fonte do dado e lacunas de integração; evitar precisão falsa em atribuição. Dar drill-down autorizado até os registros de origem, sem ampliar acesso. Monitorar eventos atrasados, duplicados e não associados.
