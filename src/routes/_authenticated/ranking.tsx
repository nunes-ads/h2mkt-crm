import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Upload } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHead, meta } from "@/components/pw";
import { RANK, calcular, nomeBonito } from "@/lib/ranking";

export const Route = createFileRoute("/_authenticated/ranking")({
  head: () => meta("Ranking de equipe", "Desempenho dos vendedores por categoria nas metas de 3 níveis, com comissão estimada."),
  component: Ranking,
});

const NIVEIS = ["Mínima", "Média", "Máxima"];
const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Ranking() {
  const [eqI, setEqI] = useState(0);
  const [nivel, setNivel] = useState(0);
  const [ord, setOrd] = useState("geral");
  const eq = RANK.equipes[eqI]!;
  const linhas = useMemo(() => {
    const l = calcular(eq, RANK.cats, nivel);
    return ord === "geral" ? l : [...l].sort((a, b) => (b.pct[ord] ?? 0) - (a.pct[ord] ?? 0));
  }, [eq, nivel, ord]);

  return (
    <AppShell crumb="Ranking de equipe" section="Equipe">
      <PageHead eyebrow="Equipe" title="Ranking de equipe" />
      <div className="rk-bar">
        <div className="seg" role="tablist" aria-label="Equipe">
          {RANK.equipes.map((e, i) => <button key={e.nome} role="tab" aria-selected={i === eqI} className={i === eqI ? "is-active" : ""} onClick={() => setEqI(i)}>{e.nome}</button>)}
        </div>
        <span className="itg-spacer" />
        <div className="seg" role="radiogroup" aria-label="Nível da meta">
          {NIVEIS.map((n, i) => <button key={n} role="radio" aria-checked={i === nivel} className={i === nivel ? "is-active" : ""} onClick={() => setNivel(i)}>{n}</button>)}
        </div>
        <select className="input select rk-ord" aria-label="Ordenar por" value={ord} onChange={(e) => setOrd(e.target.value)}>
          <option value="geral">Geral (média das metas)</option>
          {RANK.cats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <label className="btn btn-outline btn-sm"><Upload /> Importar matriz (.xlsx)<input type="file" accept=".xlsx" hidden /></label>
      </div>
      <p className="t-caption" style={{ margin: "10px 0 14px" }}>
        {eq.nome} · período {eq.periodo} · meta {NIVEIS[nivel]!.toLowerCase()} · arquivo <span className="num">{eq.arquivo}</span>
      </p>

      <div className="rk-podio">
        {linhas.slice(0, 3).map((r, i) => (
          <div key={r.nome} className={`card rk-p is-p${i + 1}`}>
            <span className="rk-pos num">{i + 1}º</span>
            <span className="avatar">{r.nome.slice(0, 2)}</span>
            <b>{nomeBonito(r.nome)}</b>
            <span className="rk-pct num">{fmt(r.geral)}%</span>
            <span className="t-meta">comissão est. {brl(r.comissao)}</span>
          </div>
        ))}
      </div>

      <div className="card pw-table-wrap reveal">
        <table className="table">
          <thead><tr><th>#</th><th>Vendedor(a)</th><th>% geral</th>{RANK.cats.map((c) => <th key={c.id}>{c.nome}</th>)}<th>Comissão est.</th><th>Falta p/ meta</th></tr></thead>
          <tbody>
            {linhas.map((r, i) => {
              const pior = [...r.falta].sort((a, b) => b.f * (b.cat.rs[nivel] ?? 0) - a.f * (a.cat.rs[nivel] ?? 0))[0];
              return (
                <tr key={r.nome}>
                  <td className="num">{i + 1}</td>
                  <td><b>{nomeBonito(r.nome)}</b></td>
                  <td><div className="rk-cell"><div className="bar is-lime"><i style={{ width: `${Math.min(100, r.geral)}%` }} /></div><span className="num">{fmt(r.geral)}%</span></div></td>
                  {RANK.cats.map((c) => {
                    const p = r.pct[c.id] ?? 0;
                    return <td key={c.id} className={`num ${p >= 100 ? "rk-ok" : p < 50 ? "rk-low" : ""}`}>{fmt(p)}%{p >= 100 && <Check size={12} aria-label="meta batida" />}</td>;
                  })}
                  <td className="num">{brl(r.comissao)}</td>
                  <td className="t-caption">{pior ? `${fmt(pior.f)} ${pior.cat.un} de ${pior.cat.nome}` : "Meta batida"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="card reveal" style={{ marginTop: 14 }}>
        <h3 className="t-h3">Como o ranking é calculado</h3>
        <p className="t-caption" style={{ marginTop: 6 }}>
          Mesma lógica da aba <b>Metas 3 Níveis</b> das planilhas: para cada categoria, <span className="num">% = realizado ÷ meta do nível escolhido</span>. O <b>% geral</b> é a média das cinco categorias (lubrificante em litros, pneu, filtros, alinhamento/balanceamento e show de serviços). A comissão estimada usa o R$/unidade do nível. Quem bate 100% em uma categoria ganha o selo ✓; âmbar indica abaixo de 50%.
        </p>
      </section>
    </AppShell>
  );
}
