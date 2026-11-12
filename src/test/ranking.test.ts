import { describe, expect, it } from "vitest";
import { RANK, calcular } from "@/lib/ranking";

describe("Ranking de equipe", () => {
  const eq = RANK.equipes[0]!;
  it("% geral é a média das cinco categorias na meta mínima", () => {
    const elen = calcular(eq, RANK.cats, 0).find((l) => l.nome === "ELEN")!;
    // 307.85/900, 55/220, 94/250, 48/100, 3/20
    const esperado = ((307.85 / 900 + 55 / 220 + 94 / 250 + 48 / 100 + 3 / 20) / 5) * 100;
    expect(elen.geral).toBeCloseTo(esperado, 5);
  });
  it("comissão usa o R$/unidade do nível escolhido", () => {
    const elen = calcular(eq, RANK.cats, 0).find((l) => l.nome === "ELEN")!;
    expect(elen.comissao).toBeCloseTo(307.85 * 1.25 + 55 * 5 + 94 * 1 + 48 * 5 + 3 * 7, 5);
  });
  it("ordena do maior para o menor % geral", () => {
    const r = calcular(eq, RANK.cats, 0);
    expect(r[0]!.nome).toBe("ELEN");
    expect(r.at(-1)!.nome).toBe("LUCAS_HENRIQ");
  });
});
