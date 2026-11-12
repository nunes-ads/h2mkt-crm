export type Kind = "cliente" | "hudson" | "vendedor" | "sistema" | "nota";
export type Mensagem = {
  id: string;
  kind: Kind;
  text: string;
  t: string;
  nome?: string | undefined;
  mediaType?: "image" | "video" | "audio" | "document" | undefined;
  mediaUrl?: string | undefined;
  caption?: string | undefined;
  fileName?: string | undefined;
  reaction?: string | undefined;
  quotedText?: string | undefined;
  quotedSender?: string | undefined;
  starred?: boolean | undefined;
};

export const ESTADOS_ATENDIMENTO = [
  "Novo",
  "Na fila",
  "Em atendimento",
  "Aguardando cliente",
  "Aguardando interno",
  "Pendente",
  "Resolvido",
  "Encerrado",
] as const;

export type EstadoAtendimento = (typeof ESTADOS_ATENDIMENTO)[number];

export const MOTIVOS_PERDA = [
  "Preço / Valor alto",
  "Comprou no concorrente",
  "Sem contato / Não responde",
  "Sem estoque do produto",
  "Desistiu do serviço",
  "Fora da região de atendimento",
  "Outro motivo",
] as const;

export type Status =
  | EstadoAtendimento
  | "IA ativa"
  | "Em atendimento humano"
  | "Agendado"
  | "Perdido"
  | "Encerrada";

export const ETAPAS = ["Abordagem", "Descoberta da necessidade", "Proposta", "Negociação", "Agendamento", "Pós-venda"] as const;
export const ORIGENS = [
  "Anúncio geral da Omega (Instagram/Facebook)",
  "Anúncio de pneus (Instagram/Facebook)",
  "Anúncio de troca de óleo (Google)",
  "Anúncio de óleo de câmbio (Instagram/Facebook)",
  "Anúncio do Show de Serviços",
  "Site da Omega",
  "Cliente antigo voltando",
] as const;
export const SAMPLE_FIRST: Record<string, string> = {
  "Anúncio geral da Omega (Instagram/Facebook)": "Olá, bom dia, tudo bem? Vim através dos anúncios do Instagram.",
  "Anúncio de pneus (Instagram/Facebook)": "Oi, vi o anúncio dos pneus. Quanto tá o 175/70 aro 13?",
  "Anúncio de troca de óleo (Google)": "Boa tarde, vim pelo anúncio. Quanto fica a troca de óleo?",
  "Anúncio de óleo de câmbio (Instagram/Facebook)": "Olá, vim pelo anúncio e gostaria de mais informações sobre a troca de óleo do câmbio.",
  "Anúncio do Show de Serviços": "Oi, como funciona esse show de serviços?",
  "Site da Omega": "Olá, vim pelo site e gostaria de mais informações.",
  "Cliente antigo voltando": "Bom dia, fiz a troca de óleo com vocês ano passado, tá na hora de novo.",
};
export const AGENTES = ["Hudson (padrão)", "Hudson · Pneus", "Hudson · Recrutamento"];

export type BastidoresData = {
  raw: string;
  etapa?: string | undefined;
  etiqueta?: string | undefined;
  dados?: string | undefined;
  produtos?: string | undefined;
  atencao?: string | undefined;
  nota?: string | undefined;
};

export type Conversa = {
  aliases?: string[] | undefined;
  id: string;
  nome: string;
  tel: string;
  origem: string;
  carro: string;
  canal: string;
  loja: string;
  etapa: (typeof ETAPAS)[number];
  status: Status;
  valor: number;
  perda: string | null;
  agente: string;
  data: string; // dd/mm do último contato
  esperaMin: number | null; // tempo desde a última mensagem
  arquivada: boolean;
  naoLida: number;
  tags: string[];
  msgs: Mensagem[];
  ficha: [string, string][];
  ag: { code: string; kv: [string, string][] } | null;
  log: { t: string; text: string }[];
  fixada?: boolean | undefined;
  silenciada?: boolean | undefined;
  notas?: { id: string; t: string; autor: string; texto: string }[] | undefined;
  lembrete?: { dataHora: string; texto: string } | null | undefined;
  avatar?: string | null | undefined;
  iaAtiva?: boolean | undefined;
  bastidores?: BastidoresData | null | undefined;
};

const novo = (id: string, nome: string, tel: string, origem: string, tags: string[], esperaMin: number): Conversa => ({
  id, nome, tel, origem, carro: "", canal: "WhatsApp", loja: "", etapa: "Abordagem", status: "IA ativa", valor: 0,
  perda: null, agente: AGENTES[0]!, data: "07/11", esperaMin, arquivada: false, naoLida: 0, tags, msgs: [], ficha: [], ag: null, log: [],
});

export const conversas: Conversa[] = [];

export type Filtro = "todas" | "naolidas" | "fixadas" | "resp" | "grupos" | "arq" | "semresp" | "ativas" | "ia" | "hum" | "ag";
export const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todas", label: "Todas" },
  { id: "naolidas", label: "Não lidas" },
  { id: "fixadas", label: "Fixadas" },
  { id: "resp", label: "Aguardando" },
  { id: "grupos", label: "Grupos" },
  { id: "arq", label: "Arquivadas" },
];

const fechada = (c: Conversa) =>
  c.arquivada || c.status === "Encerrada" || c.status === "Encerrado" || c.status === "Resolvido" || c.status === "Perdido";
export const ultimaMsg = (c: Conversa) => [...c.msgs].reverse().find((m) => m.kind !== "sistema") ?? null;

/** Cliente escreveu por último (ou lead novo sem resposta) e a conversa segue aberta. */
export function aguardandoResposta(c: Conversa) {
  if (fechada(c)) return false;
  const u = ultimaMsg(c);
  if (!u) return c.status !== "Agendado";
  return u.kind === "cliente" && c.status !== "Agendado" && !c.ag;
}
/** A loja falou por último e o cliente ainda não respondeu. */
export function semRespostaCliente(c: Conversa) {
  if (fechada(c) || c.status === "Agendado") return false;
  const u = ultimaMsg(c);
  return !!u && (u.kind === "hudson" || u.kind === "vendedor");
}

export function passaFiltro(c: Conversa, f: Filtro | string) {
  switch (f) {
    case "ativas": return !fechada(c);
    case "resp": return aguardandoResposta(c);
    case "semresp": return semRespostaCliente(c);
    case "ia": return !fechada(c) && c.status === "IA ativa";
    case "hum": return !fechada(c) && c.status === "Em atendimento humano";
    case "ag": return c.status === "Agendado" || !!c.ag;
    case "arq": return c.arquivada;
    case "naolidas": return c.naoLida > 0;
    case "fixadas": return Boolean(c.fixada);
    case "grupos": return c.tags?.includes("grupo") || c.id.endsWith("@g.us");
    case "todas": default: return true;
  }
}

export function filtrarConversas(lista: Conversa[], busca: string, filtro: Filtro) {
  const q = busca.trim().toLowerCase();
  const digitos = q.replace(/\D/g, "");
  return lista.filter((c) => {
    if (!passaFiltro(c, filtro)) return false;
    if (!q) return true;
    if (c.nome.toLowerCase().includes(q)) return true;
    if (/^\d{2}\/\d{2}$/.test(q)) return c.data === q;
    if (digitos.length >= 3 && c.tel.replace(/\D/g, "").includes(digitos)) return true;
    return c.msgs.some((m) => m.text.toLowerCase().includes(q));
  });
}

export function tempoCurto(min: number | null) {
  if (min == null) return "";
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.round(min / 60)} h`;
  return `${Math.round(min / 1440)} d`;
}

export const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const iniciais = (nome: string) => nome.split(/\s+/).filter((w) => /\p{L}/u.test(w[0] ?? "")).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || nome.slice(0, 2);
