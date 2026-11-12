# Conector incluído na exportação

Base: Evolution API 2.3.7, fixada pelo resumo da imagem em Dockerfile.rc14.
Conector: pacote oficial npm baileys 7.0.0-rc14, com dependências isoladas em
/opt/local-pairing-fix e versões travadas em package-lock.json.
Os scripts de instalação de dependências são desativados na montagem.

O conector atualizado usa o formato novo do QR code. patch-rc14.cjs aplica
ajustes locais de renovação do registro, confirmações antes do login e
proteção contra notificações incompletas de pareamento por código. O script
confere os resumos dos arquivos originais e o contexto de cada edição.

Estas propostas de correção ainda não eram versões oficiais incorporadas ao
projeto na revisão utilizada. O resultado é uma montagem local da Evolution.
O projeto original foi conectado com sucesso após a atualização do conector.

Fontes e atribuição das adaptações:

- https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc10
- https://github.com/WhiskeySockets/Baileys/releases/tag/v7.0.0-rc14
- https://github.com/WhiskeySockets/Baileys/pull/2765 (doryani-ai e colaboradores)
- https://github.com/WhiskeySockets/Baileys/pull/2602
- https://github.com/evolution-foundation/evolution-api/pull/2727

Linhas LOCAL_PAIRING registram apenas etapas, horários, contagens, flags e
códigos numéricos. Não incluem conteúdo dos QR codes ou credenciais.
A licença MIT do Baileys está em ../licencas/Baileys-MIT.txt.
