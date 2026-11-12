import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { PageHead, meta } from "@/components/pw";
import { semRespostaCliente, ultimaMsg } from "@/components/inbox/dados";
import { useDeals } from "@/lib/omega-demo";

export const Route = createFileRoute("/_authenticated/followup")({
  head: () => meta("Follow-up", "Régua de follow-up do Hudson para quem parou de responder."),
  component: Followup,
});

const PASSOS0 = [
  { apos: "30 min", obj: "Lembrar com leveza e repetir a pergunta pendente" },
  { apos: "24 h", obj: "Reforçar um benefício ligado ao que o cliente disse e oferecer horário" },
  { apos: "3 dias", obj: "Última tentativa: condição de hoje e porta aberta para quando precisar" },
];

function Followup() {
  const [conversas] = useDeals();
  const [passos, setPassos] = useState(PASSOS0);
  const [step, setStep] = useState<Record<string, number>>({});
  const [perdidos, setPerdidos] = useState<string[]>([]);
  const rows = conversas.filter((c) => semRespostaCliente(c) && !perdidos.includes(c.id));

  return (
    <AppShell crumb="Follow-up" section="Atendimento">
      <PageHead eyebrow="Atendimento" title="Follow-up" />
      <p className="t-caption" style={{ marginBottom: 14 }}>
        Régua de follow-up para quem parou de responder. No CRM publicado o disparo é automático pelo relógio; aqui você aciona cada passo com um clique e vê a mensagem que o agente mandaria.
      </p>
      <div className="fu-steps">
        {passos.map((p, i) => (
          <div key={i} className="card fu-step reveal">
            <span className="fu-n num">{i + 1}</span>
            <div className="fu-body">
              <div className="fu-row">
                <span className="t-caption">Após</span>
                <input className="input fu-apos" aria-label={`Tempo do passo ${i + 1}`} value={p.apos} onChange={(e) => setPassos((s) => s.map((x, k) => (k === i ? { ...x, apos: e.target.value } : x)))} />
                <span className="t-caption">sem resposta →</span>
              </div>
              <input className="input" aria-label={`Objetivo do passo ${i + 1}`} value={p.obj} onChange={(e) => setPassos((s) => s.map((x, k) => (k === i ? { ...x, obj: e.target.value } : x)))} />
            </div>
            <span className="t-meta">automático no CRM</span>
          </div>
        ))}
      </div>
      <div className="card pw-table-wrap reveal">
        <table className="table">
          <thead><tr><th>Contato</th><th>Última mensagem do agente</th><th>Aguardando há</th><th>Passo</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => {
              const u = ultimaMsg(c)!;
              const s = step[c.id] ?? 0;
              return (
                <tr key={c.id}>
                  <td><b>{c.nome}</b><br /><span className="t-meta">{c.origem.replace(/ \(.*\)/, "")}</span></td>
                  <td className="t-caption" style={{ maxWidth: 360 }}>{u.text.slice(0, 140)}</td>
                  <td className="num">{u.t}</td>
                  <td className="num">{s}/{passos.length}</td>
                  <td>{s < passos.length
                    ? <button className="btn btn-outline btn-sm" onClick={() => setStep((x) => ({ ...x, [c.id]: s + 1 }))}>Disparar passo {s + 1}</button>
                    : <button className="btn btn-outline btn-sm" onClick={() => setPerdidos((p) => [...p, c.id])}>Marcar "Sem resposta"</button>}</td>
                </tr>
              );
            })}
            {!rows.length && <tr><td colSpan={5} className="t-caption">Ninguém aguardando resposta.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
