# Código completo do painel de WhatsApp

Este pacote contém a versão atual do painel: a interface, o servidor local,
os recursos de atendimento, os testes e a configuração para montar a Evolution.
Foi exportado em 10/11/2026. Os arquivos ativos do painel são cópias do projeto.
O configurador e os atalhos desta pasta foram preparados para esta exportação.

## Abrir e instalar

1. Extraia o ZIP por completo. Não execute os arquivos dentro do ZIP.
2. Instale o Node.js 24 e o Docker Desktop com suporte a contêineres Linux.
3. Abra o Docker Desktop e aguarde a inicialização.
4. Execute `Configurar-primeiro-uso.cmd`. Na primeira execução, ele monta a
   Evolution, cria credenciais locais novas, prepara a instância e configura
   as atualizações ao vivo. É necessário acesso à internet para baixar as
   dependências. Não é enviada nenhuma mensagem de teste.
5. Acesse http://127.0.0.1:18765/ e conecte seu WhatsApp pelo QR code.
6. Nas próximas vezes, execute `Iniciar-WhatsApp.cmd`.

Use uma instalação por vez neste computador: as portas 18080 e 18765 precisam
estar disponíveis. O painel que já está funcionando continua na pasta original;
esta exportação não altera a instalação atual. As sessões e os dados existentes
não são migrados para uma instalação nova por este pacote.

Os arquivos de configuração já existentes na pasta extraída são preservados
pelo configurador. Ele não apaga instâncias, conversas nem volumes do Docker.
Mantenha o computador e os serviços ligados para receber eventos e executar
agendamentos ou respostas automáticas. A conexão utilizada é não oficial.

## O que está incluído

| Arquivo ou pasta | Função |
|---|---|
| `web/` | HTML, CSS e JavaScript da interface completa |
| `painel.cjs` | Servidor local, acesso à Evolution e atualizações ao vivo |
| `business.cjs` | Etiquetas, notas, favoritos, respostas, agendamentos e alertas |
| `identities.cjs` | Unificação confirmada dos identificadores de contatos |
| `search-index.cjs` | Busca nas mensagens armazenadas, com SQLite |
| `connection-qr.cjs` | Controle de atualização dos QR codes |
| `compose.yaml` | Serviços da Evolution, PostgreSQL e Redis |
| `connection-fix/` | Montagem do conector atualizado e correções de compatibilidade |
| `configurar.cjs` | Preparação de uma instalação nova |
| `iniciar.cjs` | Inicialização normal do ambiente local |
| `*.test.cjs` | Testes dos recursos do painel |
| `exemplos/teste-whatsapp.html` | Primeira página simples de teste, anterior ao painel completo |
| `Como-usar-o-painel.txt` | Guia dos recursos da interface |
| `MANIFESTO-SHA256.json` | Lista de arquivos com tamanho e resumo de integridade |

Em `web/`, edite `index.html` para mudar a estrutura, os arquivos `.css` para
alterar a aparência e os arquivos `.js` para alterar o comportamento.
O painel não precisa de compilação da interface; atualize a página após editar.

## Dependências e testes

O servidor do painel usa recursos nativos do Node.js, incluindo SQLite.
Não é necessário executar npm install na raiz. As dependências da Evolution
e do conector são obtidas durante a montagem do Docker, com versões fixadas.
O ZIP não contém imagens do Docker nem cópias completas dessas dependências.

Para executar os testes, abra um terminal nesta pasta e use:

```powershell
node --test business.test.cjs identity-search.test.cjs connection.test.cjs
```

Os testes criam dados fictícios dentro de `test-data/`. Não conectam o WhatsApp
e não enviam mensagens. O configurador do pacote teve a sintaxe e a geração
local de configurações verificadas; uma instalação nova completa não foi
executada durante a exportação para manter o ambiente em uso intacto.

## Dados pessoais e configurações

Esta é uma exportação de código, não um backup da conta de WhatsApp.
Conversas, contatos sincronizados, anexos, chaves, sessões autenticadas, logs,
notas pessoais, agendamentos existentes e backups do banco foram excluídos.
O configurador cria `.env` e `local-config.json` com novas credenciais locais.
Não compartilhe esses dois arquivos depois de configurá-los.

O banco de dados, as imagens do Docker e a instalação ativa continuam no
computador original. Apenas o histórico que o WhatsApp disponibilizar poderá
ser sincronizado ao conectar uma instalação nova.

## Terceiros

O painel utiliza Evolution API 2.3.7 com o conector Baileys 7.0.0-rc14 e
ajustes locais de compatibilidade. As instruções da montagem estão em
`connection-fix/README.md`. As licenças dos componentes continuam aplicáveis:

- Evolution: https://github.com/evolution-foundation/evolution-api/blob/2.3.7/LICENSE
- Baileys: `licencas/Baileys-MIT.txt`

As correções locais do conector são adaptações de propostas do projeto e
não constituem uma versão oficial da Evolution. Os avisos visíveis sobre o
uso da Evolution fazem parte da versão exportada e devem ser preservados.
