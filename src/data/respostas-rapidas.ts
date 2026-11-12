export type RespostaRapida = {
  id: string;
  atalho: string;
  titulo: string;
  categoria: "Pneus" | "Óleo & Serviços" | "Pagamento" | "Lojas" | "Geral";
  texto: string;
};

export const RESPOSTAS_RAPIDAS: RespostaRapida[] = [
  {
    id: "rr-pneus",
    atalho: "/pneus",
    titulo: "Orçamento de Pneus com Montagem Grátis",
    categoria: "Pneus",
    texto: `Temos ótimas opções a pronta entrega com MONTAGEM GRATUITA em qualquer uma das nossas 28 lojas Ômega no DF e GO:

1. *Comforser CF510* — 10x de R$ 28,90 (ou R$ 245,00 à vista cada)
2. *Pirelli Cinturato P1* — 10x de R$ 38,50 (ou R$ 329,00 à vista cada)

✅ Todos com 5 anos de garantia de fábrica e selo do Inmetro. Qual dessas opções fica melhor para o seu carro?`,
  },
  {
    id: "rr-oleo",
    atalho: "/oleo",
    titulo: "Troca de Óleo e Filtros",
    categoria: "Óleo & Serviços",
    texto: `A troca de óleo na Ômega Supertroca inclui:
- Óleo 100% sintético homologado pela montadora do seu carro
- Filtro de óleo novo incluso
- Check-up gratuito de mais de 15 itens de segurança
- Montagem rápida sem agendamento prévio necessário

Gostaria de agendar para hoje ou amanhã em qual unidade?`,
  },
  {
    id: "rr-cambio",
    atalho: "/cambio",
    titulo: "Troca de Óleo de Câmbio Automático",
    categoria: "Óleo & Serviços",
    texto: `Trabalhamos com máquina de sucção 100% automatizada para troca total do fluido do câmbio automático, garantindo a troca de 100% do óleo velho, sem contaminação.

Inclui:
- Diagnóstico computadorizado do câmbio
- Fluido específico homologado para o seu veículo
- Teste de rodagem e garantia

Qual o modelo e ano do seu carro para passarmos o orçamento exato?`,
  },
  {
    id: "rr-show",
    atalho: "/show",
    titulo: "Show de Serviços Ômega (1 Ano de Revisão)",
    categoria: "Óleo & Serviços",
    texto: `O *Show de Serviços* da Ômega é o pacote mais completo para manter a segurança do seu carro:
- Alinhamento 3D dianteiro e traseiro
- Balanceamento das 4 rodas
- Ajuste de cambagem e cáster
- Rodízio de pneus ilimitado durante 1 ANO inteiro!

Tudo isso por apenas 10x de R$ 48,90 sem juros. Posso incluir esse pacote no seu agendamento?`,
  },
  {
    id: "rr-pix",
    atalho: "/pix",
    titulo: "Chave Pix Oficial do Grupo Ômega",
    categoria: "Pagamento",
    texto: `Aqui estão os nossos dados oficiais para pagamento via Pix:

🔑 *Chave Pix (CNPJ)*: 00.123.456/0001-78
Razão Social: *Grupo Ômega Pneus e Troca de Óleo Ltda*
Banco: *Itaú / Bradesco*

Assim que realizar o pagamento, por favor envie o comprovante aqui nesta conversa para darmos baixa imediata! 😊`,
  },
  {
    id: "rr-lojas",
    atalho: "/lojas",
    titulo: "Lista de Unidades Ômega no DF e GO",
    categoria: "Lojas",
    texto: `O Grupo Ômega conta com mais de 28 lojas prontas para te atender:

📍 *Ceilândia*: QNM 12 / Via Leste
📍 *Taguatinga*: Pistão Sul e Pistão Norte
📍 *Asa Norte*: W3 Norte, Quadra 512
📍 *Asa Sul*: W3 Sul, Quadra 508
📍 *Valparaíso de Goiás*: Ao lado do Shopping Sul
📍 *Águas Claras*: Av. Araucárias
📍 *Goiânia*: Av. 85 / Bueno e Marista

Qual dessas unidades fica mais perto da sua rota?`,
  },
  {
    id: "rr-garantia",
    atalho: "/garantia",
    titulo: "Garantia de 5 Anos e Credibilidade",
    categoria: "Geral",
    texto: `O Grupo Ômega tem mais de 35 anos de tradição no mercado e mais de 472 mil clientes atendidos com nota máxima de satisfação!

Todos os nossos produtos contam com garantia de fábrica de 5 anos, montagem certificada e nota fiscal emitida no ato. Sua segurança e a da sua família estão sempre em primeiro lugar.`,
  },
  {
    id: "rr-saudacao",
    atalho: "/ola",
    titulo: "Saudação Oficial Consultiva",
    categoria: "Geral",
    texto: `Grupo Ômega, olá! Tudo bem? Aqui é da equipe de atendimento Ômega 😊. O Grupo Ômega tem mais de 35 anos de mercado e mais de 472 mil clientes atendidos. Com certeza vamos te ajudar! Como posso te auxiliar hoje: pneus, troca de óleo ou revisão preventiva?`,
  },
];

