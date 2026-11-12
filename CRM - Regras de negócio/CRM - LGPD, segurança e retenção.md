---
tags: [crm, lgpd, privacidade, seguranca]
---
# LGPD, segurança e retenção

> Requisitos de produto de referência. A organização responsável deve validar bases legais, prazos e procedimentos com assessoria adequada às suas operações.

## Princípios

Finalidade, adequação, necessidade, transparência, livre acesso, qualidade, segurança, prevenção, não discriminação e responsabilização. Registrar finalidade e base legal por tratamento quando requerido; não tratar consentimento como solução universal.

## Requisitos funcionais

- Registrar fonte, finalidade, preferências, consentimentos/retiradas e bloqueios, com instante e evidência necessária.
- Respeitar opt-out em campanhas, workflows, IA e mensagens futuras compatíveis.
- Atender solicitação de acesso, correção, portabilidade, anonimização ou eliminação conforme elegibilidade, prazos e exceções legais.
- Ter política configurável de retenção por categoria, canal e tenant; executar expurgo/anonimização auditável.
- Minimizar campos e controlar acesso a CPF/CNPJ, gravações, documentos e outros dados sensíveis.
- Exportação e acesso de suporte são escopados, registrados e revogáveis.
- Criptografar tráfego e dados armazenados; proteger credenciais de integração e rotacioná-las.
- Planejar backup, restauração, resposta a incidente, segregação de ambientes e revisão de acesso.

## Direitos e ciclo de vida

Receber solicitação autenticada → localizar dados por identificadores → avaliar escopo, terceiros e retenções obrigatórias → executar/encaminhar → informar resultado → auditar. Anonimização deve manter consistência referencial sem preservar identificabilidade desnecessária. A mesclagem de contatos não deve apagar bloqueios ou preferências relevantes.

## Segurança por tenant

Ver [[CRM - Organizações, usuários e permissões]] e [[CRM - API e integrações]]. Testar isolamento em leitura, escrita, busca, arquivos, analytics, filas, webhooks e tarefas assíncronas.
