import seed from "@/data/ranking.json";

export type Cat = { id: string; nome: string; un: string; rs: number[] };
export type Vend = { nome: string; cats: Record<string, { real: number; meta: number[] }> };
export type Equipe = { nome: string; arquivo: string; periodo: string; vend: Vend[] };
export const RANK = seed as { cats: Cat[]; equipes: Equipe[] };

export type Linha = {
  nome: string;
  geral: number; // média dos % das categorias
  pct: Record<string, number>;
  comissao: number;
  falta: { cat: Cat; f: number }[];
};

/** % = realizado ÷ meta do nível; % geral = média das categorias; comissão = realizado × R$/un do nível. */
export function calcular(eq: Equipe, cats: Cat[], nivel: number): Linha[] {
  return eq.vend
    .map((v) => {
      const pct: Record<string, number> = {};
      let com = 0;
      const falta: Linha["falta"] = [];
      for (const c of cats) {
        const x = v.cats[c.id];
        const meta = x?.meta[nivel] ?? 0;
        const real = x?.real ?? 0;
        pct[c.id] = meta ? (real / meta) * 100 : 0;
        com += real * (c.rs[nivel] ?? 0);
        if (real < meta) falta.push({ cat: c, f: meta - real });
      }
      const vals = Object.values(pct);
      return { nome: v.nome, pct, comissao: com, falta, geral: vals.reduce((a, b) => a + b, 0) / (vals.length || 1) };
    })
    .sort((a, b) => b.geral - a.geral);
}

export const nomeBonito = (n: string) =>
  n.split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
