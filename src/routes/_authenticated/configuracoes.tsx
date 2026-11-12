import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Card, PageHead, Seg, Toggle, meta } from "@/components/pw";
import { aplicarTema, temaAtual, type Tema } from "@/lib/tema";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => meta("Configurações e perfil", "Seu perfil, tema e preferências de notificação no CRM Ômega."),
  component: Config,
});

function Config() {
  const [tema, setTema] = useState<Tema>("dark");
  const [notif, setNotif] = useState({ som: true, email: false, resumo: true });
  useEffect(() => setTema(temaAtual()), []);
  return (
    <AppShell crumb="Configurações" section="Rede">
      <PageHead eyebrow="Conta" title="Configurações e perfil" />
      <div className="grid">
        <Card title="Perfil" className="c6">
          <div className="stack" style={{ gap: 14 }}>
            <div className="hstack">
              <span className="avatar is-lg is-ink">AR</span>
              <div><div className="t-h3">Ana Ribeiro</div><span className="t-meta">Supervisora · Loja Moema</span></div>
            </div>
            <div className="field"><label htmlFor="nome">Nome</label><input id="nome" className="input" defaultValue="Ana Ribeiro" /></div>
            <div className="field"><label htmlFor="email">E-mail</label><input id="email" className="input" defaultValue="ana.ribeiro@grupoomega.com.br" /></div>
            <div className="field"><label htmlFor="tel">Telefone</label><input id="tel" className="input is-mono" defaultValue="+55 11 98102-4471" /></div>
            <div><button className="btn btn-primary">Salvar perfil</button></div>
          </div>
        </Card>
        <Card title="Preferências" className="c6">
          <div className="stack" style={{ gap: 4 }}>
            <div className="pw-kv">
              <span className="t-label">Tema</span>
              <Seg value={tema} label="Tema" onChange={(t) => { aplicarTema(t); setTema(t); }} options={[{ id: "dark", label: "Escuro" }, { id: "light", label: "Claro" }]} />
            </div>
            {([
              ["som", "Som ao chegar mensagem"],
              ["email", "Alertas por e-mail"],
              ["resumo", "Resumo diário às 18h"],
            ] as const).map(([k, label]) => (
              <div key={k} className="pw-kv">
                <span className="t-label">{label}</span>
                <Toggle on={notif[k]} label={label} onChange={(v) => setNotif((n) => ({ ...n, [k]: v }))} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
