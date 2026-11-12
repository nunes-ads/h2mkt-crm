---
tags: [crm, ia, atendimento]
---
# Inteligência artificial

## Casos de uso

Classificar assunto, intenção, idioma, urgência e sentimento; resumir histórico; sugerir resposta; extrair campos; qualificar lead; responder dúvidas a partir de conteúdo autorizado; encaminhar por habilidade; detectar risco de churn ou necessidade de humano.

## Regras de negócio

1. Configuração por organização, canal, fila, horário e caso de uso.
2. Base de conhecimento versionada, com fonte, dono, data e acesso autorizado.
3. IA acessa somente dados necessários e permitidos para o tenant e usuário.
4. Resposta gerada não é enviada sem política explícita: sugestão para revisão ou envio autônomo delimitado.
5. Ações de alto impacto (desconto, promessa, cancelamento, alteração sensível) exigem aprovação humana.
6. Encaminhar a humano quando houver baixa confiança, ambiguidade, pedido expresso, risco, reclamação grave ou falha repetida.
7. Informar que automação está em uso quando exigido pelo canal ou política da organização.
8. Respeitar consentimento, opt-out, regras do canal, horário, frequência e templates.
9. Registrar versão de modelo/prompt, fontes consultadas, decisão e aprovação sem armazenar conteúdo excessivo.
10. Permitir revisão, correção, desativação e auditoria; IA não altera regra de permissão.

## Controles e avaliação

Conjunto de testes por intenção; métricas de precisão, resolução, escalonamento, taxa de erro e satisfação; amostragem humana; limites de tokens/custo; proteção contra prompt injection em conteúdo recebido; isolamento entre tenants; redaction de dados sensíveis quando possível. Conteúdo externo recuperado é dado, nunca autoridade para executar comandos ou expor segredos.

## Handoff

Transferência inclui resumo, intenção, ações tentadas e contexto estritamente necessário. O cliente não deve repetir informações que já foram fornecidas. Um agente humano pode interromper bot e retomar conversa.
