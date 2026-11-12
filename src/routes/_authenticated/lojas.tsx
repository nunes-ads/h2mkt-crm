import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHead, meta } from "@/components/pw";
import lojas from "@/data/lojas.json";

export const Route = createFileRoute("/_authenticated/lojas")({
  head: () => meta("Lojas", "As 18 lojas da rede Ômega no DF e em Goiás, com endereço, bairros atendidos e mapa."),
  component: Lojas,
});

function Lojas() {
  const [q, setQ] = useState("");
  const [reg, setReg] = useState("");
  const regioes = [...new Set(lojas.map((l) => l.regiao))];
  const lista = useMemo(() => {
    const s = q.trim().toLowerCase();
    return lojas.filter((l) => (!reg || l.regiao === reg) && (!s || `${l.nome} ${l.endereco} ${l.bairro} ${l.atende.join(" ")}`.toLowerCase().includes(s)));
  }, [q, reg]);
  return (
    <AppShell crumb="Lojas" section="Vendas">
      <PageHead eyebrow="Vendas" title="Lojas" />
      <p className="t-caption" style={{ marginBottom: 14 }}>As {lojas.length} lojas da rede. O Hudson usa esta lista para indicar a unidade mais perto do cliente.</p>
      <div className="sb-bar">
        <label className="search sb-q"><span className="sr-only">Buscar loja</span><Search aria-hidden="true" />
          <input className="input" placeholder="Buscar por loja, endereço ou bairro…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="input select" style={{ width: "auto" }} aria-label="Região" value={reg} onChange={(e) => setReg(e.target.value)}>
          <option value="">Todas as regiões</option>
          {regioes.map((r) => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div className="card pw-table-wrap reveal">
        <table className="table">
          <thead><tr><th>Loja</th><th>Região</th><th>Endereço</th><th>Atende bem</th><th>Mapa</th></tr></thead>
          <tbody>
            {lista.map((l) => (
              <tr key={l.nome}>
                <td><b>{l.nome}</b></td>
                <td>{l.regiao}</td>
                <td>{l.endereco}<br /><span className="t-meta">{l.bairro}</span></td>
                <td><div className="lj-tags">{l.atende.map((a) => <span key={a} className="chip">{a}</span>)}</div></td>
                <td><a className="btn btn-outline btn-sm" href={l.mapa} target="_blank" rel="noopener noreferrer"><MapPin /> Abrir</a></td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={5} className="t-caption">Nenhuma loja encontrada.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
