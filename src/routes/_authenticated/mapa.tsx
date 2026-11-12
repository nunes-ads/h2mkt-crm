import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, PageHead, meta } from "@/components/pw";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => meta("Mapa de conexões", "Como canais, agentes, filas e sistemas externos se ligam ao CRM Ômega."),
  component: Mapa,
});

const nos = [
  { nome: "WhatsApp", x: 22, y: 30, ok: false, lat: "120 ms" },
  { nome: "Instagram", x: 70, y: 22, ok: false, lat: "180 ms" },
  { nome: "Telefonia", x: 80, y: 66, ok: false, lat: "1,4 s" },
  { nome: "ERP oficina", x: 30, y: 78, ok: false, lat: "240 ms" },
  { nome: "Estoque", x: 56, y: 84, ok: false, lat: "90 ms" },
  { nome: "Agenda lojas", x: 14, y: 56, ok: false, lat: "110 ms" },
];

function Mapa() {
  return (
    <AppShell crumb="Mapa de conexões" section="Automação">
      <PageHead eyebrow="Integrações" title="Mapa de conexões" />
      <div className="grid">
        <Card title="Radar" sub="Centro = CRM Ômega" className="c5">
          <div className="radar mapa-radar" role="img" aria-label="Radar com 6 conexões pendentes">
            <span className="r" /><span className="r" /><span className="r" />
            <span className="sweep" />
            <span className="core" />
            {nos.map((n) => (
              <span key={n.nome} className={`blip ${n.ok ? "" : "is-amber"}`} style={{ left: `${n.x}%`, top: `${n.y}%` }} />
            ))}
          </div>
        </Card>
        <Card title="Conexões" className="c7">
          <ul className="list">
            {nos.map((n) => (
              <li key={n.nome} className="row">
                <span className={`icon-tile ${n.ok ? "" : "is-amber"}`} aria-hidden="true">{n.ok ? "●" : "!"}</span>
                <div className="body"><div className="title">{n.nome}</div><div className="sub">Conexão não verificada</div></div>
                <div className="trail">{n.ok ? <span className="pill is-ok">Estável</span> : <span className="pill is-warn">Pendente</span>}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AppShell>
  );
}
