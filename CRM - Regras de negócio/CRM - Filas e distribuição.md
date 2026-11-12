---
tags: [crm, filas, roteamento, sla]
---
# Filas e distribuição

## Estratégias

Rodízio; menor carga; disponibilidade e capacidade; departamento; idioma/habilidade/produto; responsável anterior; prioridade/VIP; supervisor manual. Combinar condições em uma política explícita e testável.

## Regras de negócio

- **RN-049:** organização define uma ou mais filas.
- **RN-050:** cada fila configura agentes elegíveis, horário, estratégia, prioridade e limites.
- **RN-051:** excluir indisponíveis, inativos ou fora de horário conforme a política.
- **RN-052:** respeitar limite de atendimentos simultâneos por agente e tipo de trabalho.
- **RN-053:** sem agente elegível, manter na fila, avisar responsável e medir espera.
- **RN-054:** retorno pode priorizar o último responsável se ainda elegível e dentro da regra de continuidade.
- **RN-055:** transferência registra origem, destino, solicitante, instante e motivo.
- **RN-056:** atribuição concorrente deve ser atômica; dois agentes não podem ganhar silenciosamente o mesmo caso.
- **RN-057:** SLA vencido gera alerta, escalonamento ou redistribuição conforme configuração.

## SLA

Definir métricas separadas: primeira resposta, próxima resposta e resolução. Relógio considera calendário, feriados, fuso, estado de espera e pausas configuradas. Distinguir tempo corrido de tempo útil. Suspender relógio por espera de cliente somente quando a política declarar isso. Medir violações mesmo quando houve reatribuição.

## Roteamento de referência

Mensagem recebida → identificar canal/tenant/contato → classificar necessidade e prioridade → verificar duplicata e atendimento ativo → localizar fila e agentes elegíveis → atribuir atomicamente ou deixar aguardando → notificar e iniciar SLA.

## Supervisão

Exibir idade da fila, carga por agente, conversas perto do SLA e motivo de não atribuição. Mudanças automáticas de responsável ficam auditáveis; evitar redistribuições frequentes que prejudiquem continuidade.
