---
tags: [crm, anuncios, marketing, atribuicao]
---
# Anúncios e atribuição

## Dados de origem

Persistir primeiro toque e eventos de toque subsequentes: plataforma, conta, campanha, conjunto/grupo, anúncio, formulário, click ID, UTM source/medium/campaign/content/term, página, horário e identificador externo. Guardar nível de confiança e origem do dado. Não substituir origem inicial pelo último clique.

## Regras de negócio

- Vincular lead recebido de formulário ou canal de mensagem ao anúncio quando houver identificador confiável.
- Deduplicar eventos de conversão pelo ID externo e evento.
- Registrar consentimento e finalidade antes de sincronizar identificadores com plataformas.
- Aplicar política de retenção e minimização aos click IDs e dados de campanha.
- Separar métricas reportadas pela plataforma de métricas calculadas pelo CRM.
- Atribuição first-touch, last-touch, linear ou outra é configurável e indicada em cada relatório.
- Envio offline de conversão requer permissão, mapeamento e tratamento apropriado de dados.
- Falha/limite de API vai para fila de retry com diagnóstico e não elimina lead local.

## Indicadores

Investimento, leads, custo por lead, contatos alcançados, qualificação, oportunidades, vendas, receita, CAC e ROAS. Informar janela, fuso, moeda, modelo de atribuição, estágio de conversão e origem de custo. Não comparar valores de períodos incompatíveis sem contextualizar.
