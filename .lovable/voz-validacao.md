# Atualização da central de Voz

## Referência
plataforma_omega_final_1.zip foi inspecionado sem executar scripts: React/Vite, 679 arquivos, migrações e funções dos provedores; nenhum registro exportado. O link Claude #voz abriu nesta etapa e forneceu texto e imagem da central.

## Reaproveitado
Pitwall DS intocado, tokens do app, controles omega-ui, treinamento integral do Hudson, contatos locais, mecanismo de tema e login obrigatório.

## Novo
- Central compartilhada em /ligacoes e /voz com sete abas.
- Histórico com dois exemplos literais do protótipo, busca, direção, sentimento, score, briefing, transcrição e exportação. Sempre identificados como exemplos; não incluídos como chamadas reais.
- Estado vazio de chamadas ao vivo; nenhuma chamada simulada apresentada como real.
- Campanha em seis etapas, contatos e limites, salva somente como rascunho local. Iniciar permanece desabilitado.
- Voz, modelo de referência, comportamento, palavras-chave, conversa e sincronização pendente. Modelos citados no protótipo não foram tratados como serviços disponíveis ou conectados.
- Números locais e janela de discagem. Compra, importação, clonagem e webhooks não ativos; nenhuma URL fictícia de produção fornecida.

## Verificação
- Quatro testes de regras de campanha e quatro testes existentes de login/navegação passaram.
- Capturas e navegação em 1440/400, dark/light, sem overflow nem erros de execução.
- Fixture isolada de interface: criar número, criar campanha em seis passos, salvar e reler após recarregar; botão de iniciar desabilitado.
- Visitante real sem sessão em /voz redirecionado ao login.
- Não há contas de autenticação no destino; sessão real não pôde ser obtida. A fixture de interface não comprova login real, autorização, isolamento ou persistência no backend.

## Limites
Atualização entregue nesta etapa é a central de Voz. O ZIP também contém ampliações de Agenda e Follow-up não portadas nesta entrega; não há alegação de paridade integral de todas as telas. Integrações por API foram adiadas pelo usuário. Nenhuma ligação ou mensagem real enviada, nenhuma conta vinculada e nenhuma publicação feita.