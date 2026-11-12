import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, CreditCard, Link2, Search, Store } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageHead, meta } from "@/components/pw";
import { useActiveAccount, SUBCONTA_MVP, CONTA_MATRIZ } from "@/lib/omega-accounts";

export const Route = createFileRoute("/_authenticated/subcontas")({
  head: () => meta("Subcontas", "Gerenciamento de subcontas e franquias Ômega."),
  component: Subcontas,
});

type Plano = "basico" | "pro" | "rede";
const PLANOS: Record<Plano, { nome: string; svcs: number; of: number; ex: number; us: number }> = {
  basico: { nome: "Básico", svcs: 7, of: 1, ex: 1, us: 3 },
  pro: { nome: "Pro", svcs: 15, of: 2, ex: 3, us: 10 },
  rede: { nome: "Rede / Franquia", svcs: 21, of: 5, ex: 10, us: 50 },
};

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Subcontas() {
  const navigate = useNavigate();
  const { activeAccount, isSubconta, switchAccount } = useActiveAccount();
  const [q, setQ] = useState("");

  // Apenas UMA subconta para o MVP conforme solicitado
  const subconta = SUBCONTA_MVP;

  const match = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return `${subconta.nome} ${subconta.email} ${subconta.resp} ${subconta.loja}`.toLowerCase().includes(s);
  }, [subconta, q]);

  const p = PLANOS[subconta.plano];
  const isEstaAtiva = activeAccount.id === subconta.id;

  const entrarSubconta = (id: string) => {
    switchAccount(id);
    void navigate({ to: "/" });
  };

  const voltarMatriz = () => {
    switchAccount("matriz");
    void navigate({ to: "/" });
  };

  return (
    <AppShell crumb="Subcontas" section="Plataforma">
      <PageHead eyebrow="Plataforma" title="Subcontas" />
      <p className="t-caption" style={{ marginBottom: 14 }}>
        Contas vinculadas à matriz: cada franquia ou loja com seu próprio WhatsApp, leads, contatos e equipe — totalmente independentes.
      </p>

      {/* BANNER SE ESTIVER DENTRO DA SUBCONTA */}
      {isSubconta ? (
        <div
          className="card"
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "rgba(168, 85, 247, 0.12)",
            borderColor: "rgba(168, 85, 247, 0.3)",
          }}
        >
          <div>
            <b style={{ color: "#a855f7" }}>Acesso de Subconta Ativo: {activeAccount.nome}</b>
            <p className="t-caption" style={{ margin: "2px 0 0" }}>
              Você está operando no ambiente exclusivo da franquia {activeAccount.loja}. Todas as conversas e leads são separados da matriz.
            </p>
          </div>
          <button className="btn btn-outline btn-sm" onClick={voltarMatriz}>
            <ArrowLeft size={14} /> Voltar para Conta Principal (Matriz)
          </button>
        </div>
      ) : (
        <div
          className="card"
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "rgba(163, 230, 53, 0.08)",
            borderColor: "rgba(163, 230, 53, 0.25)",
          }}
        >
          <div>
            <b style={{ color: "var(--lime-text)" }}>Você está na Conta Principal (Matriz)</b>
            <p className="t-caption" style={{ margin: "2px 0 0" }}>
              Acesso geral a toda a rede. Clique em <b>→ Entrar</b> na subconta abaixo para alternar e gerenciar a franquia individualmente.
            </p>
          </div>
        </div>
      )}

      {/* RESUMO DAS SUBCONTAS (MVP) */}
      <section className="card reveal" style={{ marginBottom: 14 }}>
        <span className="t-eyebrow">Visão geral</span>
        <h3 className="t-h3" style={{ marginTop: 8 }}>Resumo das subcontas</h3>
        <p className="t-caption">Acompanhe as franquias conectadas à matriz.</p>
        <div className="sb-n">
          <span className="sb-big num">1</span>
          <span className="t-caption">subconta vinculada (MVP)</span>
          <span className="itg-spacer" />
          <button className="btn btn-outline btn-sm">
            <CreditCard /> Portal de pagamento
          </button>
        </div>
        <div className="sb-tiles">
          <div className="tile">
            <span className="t-meta">Leads</span>
            <b className="num">3</b>
          </div>
          <div className="tile">
            <span className="t-meta">Agendados</span>
            <b className="num">1</b>
          </div>
          <div className="tile">
            <span className="t-meta">Valor agendado</span>
            <b className="num">{brl(1840)}</b>
          </div>
        </div>
      </section>

      {/* BARRA DE PESQUISA E AÇÕES */}
      <div className="sb-bar">
        <label className="search sb-q">
          <span className="sr-only">Buscar subconta</span>
          <Search aria-hidden="true" />
          <input
            className="input"
            placeholder="Buscar por nome, e-mail ou responsável…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <span className="itg-spacer" />
        <button className="btn btn-outline btn-sm">
          <Link2 /> Vincular conta existente
        </button>
      </div>

      {/* TABELA COM A SUBCONTA MVP */}
      <div className="card pw-table-wrap reveal">
        <table className="table">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Plano</th>
              <th>Equipe</th>
              <th>Leads</th>
              <th>Agendados</th>
              <th>WhatsApp / Instância</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {match ? (
              <tr style={{ background: isEstaAtiva ? "rgba(168, 85, 247, 0.08)" : undefined }}>
                <td>
                  <div className="sb-conta">
                    <span
                      className="avatar sb-av"
                      style={{
                        backgroundColor: subconta.cor,
                        color: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      AS
                      <i className="is-on" />
                    </span>
                    <div>
                      <b>{subconta.nome}</b>
                      {isEstaAtiva && (
                        <span className="pill is-ok" style={{ marginLeft: 6, fontSize: ".65rem" }}>
                          Conta Ativa
                        </span>
                      )}
                      <br />
                      <span className="t-caption">
                        {subconta.email}{" "}
                        <button
                          className="sb-cp"
                          aria-label="Copiar e-mail"
                          onClick={() => void navigator.clipboard?.writeText(subconta.email)}
                        >
                          <Copy size={11} />
                        </button>
                      </span>
                      <br />
                      <span className="t-meta">
                        {subconta.tipo} · Resp: {subconta.resp} · Unidade: {subconta.loja}
                      </span>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`sb-plan is-${subconta.plano}`}>{p.nome}</span>
                  <br />
                  <span className="t-meta">Instância exclusiva</span>
                </td>
                <td className="num">2/{p.us}</td>
                <td className="num">3</td>
                <td className="num">
                  1<br />
                  <span className="t-meta">{brl(1840)}</span>
                </td>
                <td>
                  <span className="pill is-ok" style={{ fontSize: ".72rem" }}>
                    {subconta.whatsappPhone}
                  </span>
                  <br />
                  <span className="t-caption" style={{ fontSize: ".68rem", color: "var(--fg-3)" }}>
                    Instância: {subconta.instanceName}
                  </span>
                </td>
                <td className="sb-acts">
                  {isEstaAtiva ? (
                    <button className="btn btn-outline btn-sm" disabled style={{ opacity: 0.9 }}>
                      <Check size={13} /> Ativa agora
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ background: "#a855f7", borderColor: "#a855f7" }}
                      onClick={() => entrarSubconta(subconta.id)}
                    >
                      → Entrar
                    </button>
                  )}
                  {isEstaAtiva && (
                    <button className="btn btn-outline btn-sm" onClick={voltarMatriz}>
                      Voltar Matriz
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan={7} className="t-caption">
                  Nenhuma subconta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
