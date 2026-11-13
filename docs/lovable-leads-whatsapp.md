# Ativar captação de leads do WhatsApp no Supabase de teste

## Solicitação para o editor do Lovable

Confira primeiro o projeto Supabase conectado. Preserve Auth, perfis e dados existentes.
Implemente ou complete a base definida em [lovable-fase1.md](lovable-fase1.md) antes
de habilitar a captação. Verifique os vínculos da Matriz e da Asa Sul com as
organizações e equipes corretas. Não conceda acesso global aos usuários do piloto.

### Gravação por evento

Crie `public.crm_capture_whatsapp_lead_v1(p_instance text, p_event jsonb)` com retorno
JSON `{"contact_id":"UUID","lead_id":"UUID ou null"}` (use null JSON quando cabível).
Revogue EXECUTE de PUBLIC, anon e authenticated. Conceda apenas ao service_role
usado no servidor. Use search_path explícito, referências qualificadas e SQL
parametrizado. O navegador não acessa esta função nem recebe a chave do servidor.

Valide campos permitidos: `message_id`, `phone` (E.164 ou null), `lid` (identificador
numérico terminado em @lid ou null), `name` (até 160 caracteres ou null) e
`sent_at` (data UTC ou null). Exija pelo menos um identificador do remetente.
Resolva tenant, canal e equipe somente por um vínculo ativo, no banco, do nome
exato da instância Evolution. Confirme as instâncias em uso no piloto. Uma
instância desconhecida ou desativada deve falhar sem gravar.

Na mesma transação:

1. Reserve o ID externo da mensagem com unicidade por tenant e canal. Se já
   processado, devolva o resultado original sem repetir cadastro ou auditoria.
2. Procure o contato por telefone normalizado ou LID confirmado dentro do
   tenant. Guarde ambos quando o evento confirmar o vínculo. Se os dois
   identificadores apontarem a contatos distintos, registre conflito para
   revisão, sem mescla automática. Use constraints e locks para evitar duplicatas
   em mensagens simultâneas. Permita que o mesmo telefone exista em outra organização.
3. Crie um contato provisório se não existir. Use o nome recebido, o telefone ou
   "Contato WhatsApp". Para LID sem telefone, mantenha telefone nulo/vazio.
   Preserve nome editado, origem inicial, preferências e bloqueios de contatos
   existentes. Não reative automaticamente registros arquivados ou anonimizados.
   Se um caso for inelegível, devolva contact_id com lead_id nulo.
4. Abra um lead com situação Novo, origem WhatsApp, contato e canal de entrada.
   No piloto, no máximo um lead WhatsApp ativo por contato no tenant. Se já
   houver um, devolva seu ID sem reiniciar a qualificação. Use timestamps do
   evento para primeira e última interação, sem fazer a data regredir em
   entregas fora de ordem. Registre separadamente a data de ingestão.
5. Grave a auditoria da integração e associe o resultado ao evento reservado.
   Não armazene o texto das mensagens, mídias, tokens ou o JSON bruto para esta
   etapa. Uma falha transacional precisa permitir reprocessamento.

### Listagem autenticada

Adicione `leads.whatsapp.list` à função `crm_api_v1` com a mesma entrada e resposta
de `contacts.list` (schema em `src/lib/crm/contracts.ts`). Retorne os contatos
vinculados a leads WhatsApp do tenant solicitado, uma linha por contato. Valide
usuário, membership e permissão contacts.read, com o mesmo escopo por responsável
e equipe da listagem de contatos. Conte somente linhas autorizadas. Ordene
primeiro pelos leads mais novos, com ID como desempate estável. Respeite busca,
situação do contato e paginação. A opção **Contatos → Leads do WhatsApp** no CRM
usa essa operação e atualiza a lista periodicamente.

### Painel diário e comparação

Adicione a operação `leads.whatsapp.daily` à mesma função `crm_api_v1`.
Entrada estrita: `{ "tenant_id": "UUID", "start_date": "AAAA-MM-DD", "end_date": "AAAA-MM-DD" }`.
Valide datas reais, intervalo inclusivo de 1 a 92 dias, início a partir de
2000-01-01 e fim até a data corrente em `America/Sao_Paulo`.
Valide o vínculo ativo e a permissão `contacts.read` com o mesmo escopo por
responsável e equipe de `leads.whatsapp.list`, antes de calcular qualquer total.

Retorne `{"days":[{"date":"AAAA-MM-DD","leads":0}]}`, em ordem crescente,
com todos os dias do período imediatamente anterior de mesma duração seguidos
por todos os dias do período solicitado, incluindo dias sem entradas com zero.
Conte uma vez cada lead WhatsApp pela sua **primeira entrada** no CRM, com
horário original válido da primeira mensagem elegível ou horário de ingestão
quando o original não vier, guardados em UTC. Converta para o dia em
`America/Sao_Paulo` e use limites de início inclusivo e fim exclusivo. Não conte
mensagens, atualizações de contato ou repetições de webhook como novos leads.
Preserve as entradas históricas quando um lead mudar de etapa ou for encerrado,
respeitando exclusão/anonimização e política de acesso. Use índice de tenant,
origem e instante de entrada. Persista cada entrada no recebimento e agregue
ao consultar; este relatório não exige um processo diário de cópia dos totais.

Exemplo: seleção de 10 a 11/11 retorna os dias 08, 09, 10 e 11/11, nessa ordem.
Teste dia sem entradas, meia-noite em Brasília, reentrega do evento e isolamento
da Matriz e Asa Sul. Falha de banco/autorização deve retornar erro, não zeros.

### Teste local no Windows

1. Provisione a base no Supabase de teste pelo Lovable, inclusive os vínculos das
   instâncias e as operações de listagem e comparação diária deste documento.
2. Configure no ambiente do processo Node do CRM os segredos do Supabase e do
   webhook. Use os nomes exatos das instâncias abertas. Mantenha as chaves fora
   do navegador, dos logs e do Git. Reinicie o processo local após a configuração.
3. Com o CRM na porta 8081, use o destino
   `http://host.docker.internal:8081/api/webhooks/evolution` na Evolution no Docker.
   Habilite somente MESSAGES_UPSERT, sem sufixo e sem anexos em base64, com o
   Bearer específico da instância. Preserve eventuais destinos já em uso.
4. Com a Inbox fechada, receba uma mensagem de um contato de teste em cada
   número. Abra Contatos → Leads do WhatsApp, selecione a organização correta
   e confira o mesmo lead no Painel, no dia de Brasília correspondente.
   Repita a mensagem do mesmo contato e confirme que o total de leads não sobe.
   Uma mensagem recebida antes da ativação requer reconciliação separada.

### Ativação após teste do banco

1. Configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e
   `EVOLUTION_LEAD_WEBHOOK_SECRETS` somente no ambiente de servidor da Vercel.
   O último é um objeto JSON de nome exato da instância para segredo aleatório
   diferente por instância, com 32 a 200 caracteres URL-safe. Não use a chave
   administrativa da Evolution como segredo do webhook.
2. Publique a aplicação e verifique que a rota
   `https://h2mkt-crm.vercel.app/api/webhooks/evolution` recusa pedidos sem
   credencial. Um evento autenticado só deve receber aceite após gravar.
3. Confira os webhooks que já existem em cada instância. Preserve integrações
   existentes; se houver um destino em uso, combine a entrega em um relay antes
   de trocar a configuração. Envie apenas `MESSAGES_UPSERT` para essa rota,
   com `Authorization: Bearer <segredo-da-instância>`, sem sufixo por evento
   e sem anexos em base64. Configure no servidor onde a Evolution está rodando.
   A Evolution faz a chamada de saída à Vercel, portanto a Vercel não precisa
   alcançar o localhost do computador para captar leads.
4. Com a Inbox fechada, envie uma mensagem de um número de teste para cada
   instância. Confira um único lead em cada organização, repetição do evento,
   mesmo telefone nas duas organizações, evento sem telefone, grupo e mensagem
   própria ignorados, e acesso negado ao usuário da outra unidade.
5. Programe separadamente qualquer importação de histórico. A captação inicia
   com os novos eventos recebidos após ativar o webhook.
