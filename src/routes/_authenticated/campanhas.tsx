import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHead, meta } from "@/components/pw";
import { conversas } from "@/components/inbox/dados";

export const Route = createFileRoute("/_authenticated/campanhas")({
  head: () => meta("Campanhas", "Por onde os leads entram e como cada campanha converte em agendamento."),
  component: Campanhas,
});

const SOURCES = [
  { nome: "Meta Lead Ads (Instagram/Facebook)", desc: "Formulário do anúncio. Os campos nome, telefone e interesse chegam pelo webhook da Meta.", origem: "Anúncio geral da Omega (Instagram/Facebook)" },
  { nome: "Anúncio de troca de óleo (Google)", desc: "Clique para o WhatsApp a partir do anúncio de pesquisa.", origem: "Anúncio de troca de óleo (Google)" },
  { nome: "Formulário do site", desc: "Formulário público de captura (/f/orcamento), com consentimento LGPD.", origem: "Site da Omega" },
  { nome: "Importação / API", desc: "Planilha de clientes antigos ou integração com o sistema da loja.", origem: "Cliente antigo voltando" },
];

function Campanhas() {
  const [extra, setExtra] = useState<Record<string, number>>({});
  const by: Record<string, { n: number; at: number; ag: number; pd: number }> = {};
  for (const d of conversas) {
    const o = (by[d.origem] ??= { n: 0, at: 0, ag: 0, pd: 0 });
    o.n++;
    if (d.status === "IA ativa" || d.status === "Em atendimento humano") o.at++;
    if (d.ag) o.ag++;
    if (d.status === "Perdido") o.pd++;
  }
  for (const [k, v] of Object.entries(extra)) {
    const o = (by[k] ??= { n: 0, at: 0, ag: 0, pd: 0 });
    o.n += v; o.at += v;
  }
  const rows = Object.entries(by).sort((a, b) => b[1].n - a[1].n);

  return (
    <AppShell crumb="Campanhas" section="Atendimento">
      <PageHead eyebrow="Atendimento" title="Campanhas" />
      <p className="t-caption" style={{ marginBottom: 14 }}>
        Por onde os leads entram. Cada entrada cria o contato e o negócio na etapa Abordagem e o agente abre a conversa sozinho. Clique em "Simular entrada de lead" para ver o fluxo.
      </p>
      <div className="itg-list" style={{ marginTop: 0 }}>
        {SOURCES.map((s) => (
          <div key={s.nome} className="card cp-src reveal">
            <b>{s.nome}</b>
            <p className="t-caption">{s.desc}</p>
            <span className="pill is-ok">conectado (simulação)</span>
            <button className="btn btn-outline btn-sm" onClick={() => setExtra((e) => ({ ...e, [s.origem]: (e[s.origem] ?? 0) + 1 }))}>Simular entrada de lead</button>
          </div>
        ))}
      </div>
      <div className="card pw-table-wrap reveal">
        <table className="table">
          <thead><tr><th>Campanha / origem</th><th>Leads</th><th>Em atendimento</th><th>Agendados</th><th>Perdidos</th><th>Conversão</th></tr></thead>
          <tbody>
            {rows.map(([k, o]) => (
              <tr key={k}><td><b>{k}</b></td><td className="num">{o.n}</td><td className="num">{o.at}</td><td className="num">{o.ag}</td><td className="num">{o.pd}</td>
                <td className="num">{o.n ? Math.round((o.ag / o.n) * 100) : 0}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
