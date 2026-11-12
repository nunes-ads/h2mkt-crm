# Continuação · estrutura e configurações

## Reaproveitado
- Design system Pitwall intacto, temas existentes e navegação principal.
- Seis etapas e registros do Inbox compartilhados entre Funil, Painel, Agenda e Orçamentos.
- Catálogo original: 3.551 produtos, preços e totais de cartão.
- Regras completas do Hudson copiadas do anexo.
- Lista original de canais, equipe e filas; campanhas de retorno de óleo e show de serviço.

## Novo nesta continuação
- Controles Pitwall reutilizáveis e armazenamento local para configurações de demonstração.
- Edição de usuários e filas, disponibilidade, horários, temporizadores e associação de equipe.
- Configuração local de canais, voz e agentes, duplicação de agentes e documentos em texto.
- Importação .xlsx/.csv de catálogo e clientes, busca, filtros e paginação.
- Navegação por contato do Funil/Agenda/Orçamentos para o Inbox.

## Verificação
- 15 testes aprovados.
- 44 capturas: 11 telas × dark/light × 1440/400; sem overflow ou erros de execução.
- Fluxos verificados: alteração de etapa → Inbox → releitura; usuário → fila; criação de fila; edição de agente e abas; configuração de canal; base de recrutamento; importação XLSX com confirmação de R$ 81,31; ligação não executada sem conexão.
- Capturas guardadas em /tmp/browser/omega-continuacao e /tmp/browser/omega-flows; não são arquivos permanentes de entrega.

## Limites desta fase
- Nenhuma chamada ou mensagem real, conta externa conectada, convite enviado ou permissão real alterada.
- Histórico de ligações e disparos reais permanece vazio; configurações estão apenas neste navegador.
- Teste de IA real, indexação RAG, upload de documentos PDF/DOCX, sincronização do catálogo com IA, geração de PDF e persistência no Cloud pertencem à fase de integrações.
- Reprodução da estrutura, não promessa de equivalência pixel a pixel ou de todos os comportamentos do HTML original.