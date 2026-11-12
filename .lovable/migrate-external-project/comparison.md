# Nova versão Ômega e projetos Nina

## Referências inspecionadas
- plataforma_omega_completa_1.zip: React 18/Vite, 14 migrações SQL, CRM FlowCRM completo e funcionalidades Ômega.
- Três projetos Nina: FlowCRM base, SDR com catálogo/orçamento e atendimento Evolution/RAG. Todos usam banco gerenciado; nenhum contém Cloudfy.
- Treinamento completo ZIP e DOCX: regras, oito ferramentas, catálogo, lojas, material de estudo. Conversas de clientes não foram copiadas para o projeto.
- Link Claude: a página de segurança impediu inspecionar a versão renderizada. O HTML do protótipo anexado é a referência disponível; não há comprovação de igualdade com a versão ao vivo.

## Treinamento
O texto REGRAS_HUDSON_system_prompt.txt recebido tem 386 linhas e 87.310 caracteres. Comparação direta confirmou igualdade com o treinamento já presente no projeto. Nenhuma regra ou nome do agente foi substituído.

## Integrações preservadas no escopo
- Twilio: origem usa ConversationRelay, Deepgram e ElevenLabs com Claude em streaming. O relay requer uma solução de voz compatível com o ambiente publicado; portar uma conexão longa sem verificar a infraestrutura seria incompleto. A integração nativa ElevenLabs/Twilio é uma alternativa investigada, não aplicada nem apresentada como equivalente.
- Evolution: API v2, envio /message/sendText/{instance}, configuração /webhook/set/{instance}, recepção autenticada, escopo por organização e registros duráveis. Nenhuma conta está vinculada, nem instância informada. Envio e recepção não estão ativos.
- Meta/Zernio/Google/Mercado Livre/ERP: contratos originais mantidos como referência; credenciais e verificação pendentes.
- Cloudfy: escolhido pelo usuário; não identificado em nenhum ZIP. Não criar esquema de dados comerciais em outro serviço como substituição silenciosa.

## Implementado nesta etapa
- Login da equipe por e-mail/senha, recuperação pública de senha e proteção de todas as telas.
- Perfis pessoais no serviço de identidade já existente, com políticas somente do próprio usuário; funções em tabela separada sem edição pelo usuário.
- Perfil real, alteração de senha real e saída com limpeza do cache.
- Estado de credenciais lido no servidor, sem valores expostos; removidas falsas conexões e geração fictícia de chaves da tela Integrações.
- Campos públicos da Evolution em Canais; estes continuam configurações locais, não conexões.

## Verificação
- Login e recuperação visual em 1440/400, dark/light, sem overflow e sem erros de execução.
- Visitante sem sessão abre / ou /canais e é direcionado ao login antes de ver o CRM.
- Testes de navegação e acesso passam.
- Nenhum usuário de autenticação existe no destino. A tentativa de obter sessão de teste confirmou essa ausência. Login bem-sucedido, persistência do perfil, mudança de senha e isolamento entre dois usuários ainda não foram verificados.
- Nenhuma ligação ou mensagem real foi enviada, nenhuma conexão de provedor foi vinculada e o projeto não está publicado.

## Próximas ações externas
1. Identificar Cloudfy com URL/documentação e acesso seguro.
2. Criar/convidar a primeira conta da equipe no serviço de identidade; não conceder privilégios automaticamente ao primeiro visitante.
3. Vincular Twilio e ElevenLabs e informar a instância Evolution pelo fluxo seguro. A tentativa de abrir a conexão Twilio foi interrompida por nova mensagem; não houve vínculo.
4. Exportar registros e identidades originais em CSV/JSON para migração; os ZIPs contêm código, não registros do banco.
5. Publicar os receptores concluídos, configurar retornos e verificar atendimento real com Hudson e suas ferramentas.