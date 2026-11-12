# Ligações · igualar ao link (aba Números e topo)

## O que muda na tela

1. **Topo da página**: subtítulo original ("Ligações recebidas e feitas pelo Hudson: histórico com transcrição e briefing, central de campanhas de voz, gatilhos automáticos e números"). As abas ficam numa barra única, com "Ligar p/ leads sem resposta" e "Nova ligação" à direita, na mesma linha.
2. **Setup das ligações**: barra de progresso com contador (ex.: 7/8) e botão para recolher, no lugar do selo "Integrações pendentes".
3. **Faixa de estado**: aviso "Tudo ligado" ou "Faltam configurações", com resumo de chaves, agentes sincronizados e números com IA ativa, mais o botão de atualizar.
4. **Integrações externas da telefonia**: 4 cartões (ElevenLabs, Twilio, Evolution/WhatsApp, Anthropic · cérebro do Hudson), cada um com estado, texto explicativo, botão Editar (ou Abrir Canais) e Abrir.
5. **Seu setup dentro da plataforma**: 3 indicadores (Agentes IA 0/2, Números com IA ativa, Canais de mensagem).
6. **Números de telefone** em duas colunas:
   - Esquerda: "Números conectados", com cartões por número (agente que atende, entrada, gravação, local e custo; botões Testar entrada, Configurar e Pausar). Abaixo, "Voice clones por agente" com o cartão do Hudson e o botão Clonar voz.
   - Direita: "Chamadas recentes" (nome, telefone, data, duração, resultado) e o quadro "Como conectar um número", com Comprar, Importar e Manual.
7. **Webhooks da Twilio**: 3 linhas com endereço e botão Copiar (entrada de chamada, status e gravação), já apontando para os endereços do próprio CRM.

## Revisão completa do link

Depois de Ligações, comparo tela por tela o link com o CRM: Painel, Inbox, Funil, Agenda, Follow-up, Campanhas, Canais, Orçamentos, Estoque, Contatos, Lojas, Recrutamento, Filas, Usuários, Ranking, Agentes IA, Integrações, Perfil e Subcontas.

- Faço uma lista do que falta em cada tela: seções, botões, abas, textos e configurações.
- Completo tudo o que faltar, na mesma ordem e com os mesmos textos do link.
- No fim, entrego a lista do que foi corrigido e capturas de cada tela.

## Regras mantidas

- Só cores do Pitwall (lime para ações e âmbar para sinais do sistema), em dark e light, a 1440px e 400px.
- Os estados dos cartões vêm da verificação real das chaves já feita no servidor. Sem chave, o cartão mostra "Não configurado", nunca um falso "Configurado".
- Os números e chamadas do protótipo aparecem com o selo "Dados de demonstração" até a Twilio ser conectada.

## Detalhes técnicos

- Arquivos: `VoiceWorkspace.tsx` (topo e aba Números, separados em `VoiceNumbers.tsx`), `omega-voz.ts` (números e chamadas recentes do protótipo, passos do setup) e `pitwall.css` (classes `om-vz-*`).
- O estado das integrações reaproveita `integrationStatus`.
- Verificação com Playwright nas 4 combinações de tema e largura, sem rolagem horizontal; os testes atuais devem continuar passando.
