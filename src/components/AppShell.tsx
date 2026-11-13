import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PwButton } from '@/components/omega-ui';
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  Bot,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  FileText,
  LayoutGrid,
  Menu,
  MessageCircle,
  Moon,
  Network,
  PhoneCall,
  Store,
  Sun,
  Users,
  X,
  Filter,
  History,
  Megaphone,
  Plug,
  RefreshCw,
  UserPlus,
  Trophy,
  User,
  LogOut,
} from "lucide-react";
import { alternarTema, temaAtual, type Tema } from "@/lib/tema";
import { useActiveAccount } from "@/lib/omega-accounts";

const grupos = [
  { nome: "Visão geral", itens: [
    { to: "/painel", label: "Painel", icon: LayoutGrid },
    { to: "/funil", label: "Funil", icon: Filter },
    { to: "/agenda", label: "Agenda", icon: CalendarDays },
  ] },
  { nome: "Atendimento", itens: [
    { to: "/", label: "Inbox", icon: MessageCircle },
    { to: "/ligacoes", label: "Ligações", icon: PhoneCall },
    { to: "/followup", label: "Follow-up", icon: History },
    { to: "/campanhas", label: "Campanhas", icon: Megaphone },
    { to: "/canais", label: "Canais", icon: Plug },
  ] },
  { nome: "Vendas", itens: [
    { to: "/orcamentos", label: "Orçamentos", icon: FileText },
    { to: "/estoque", label: "Estoque", icon: Boxes },
    { to: "/contatos", label: "Contatos", icon: Users },
    { to: "/lojas", label: "Lojas", icon: Store },
  ] },
  { nome: "Automação", itens: [
    { to: "/recrutamento", label: "Recrutamento de loja", icon: RefreshCw },
  ] },
  { nome: "Equipe", itens: [
    { to: "/filas", label: "Filas de atendimento", icon: Users },
    { to: "/usuarios", label: "Usuários", icon: UserPlus },
    { to: "/ranking", label: "Ranking de equipe", icon: Trophy },
  ] },
  { nome: "Agentes", itens: [
    { to: "/agentes", label: "Agentes IA", icon: Bot },
  ] },
  { nome: "Plataforma", itens: [
    { to: "/subcontas", label: "Subcontas", icon: Users },
    { to: "/mapa", label: "Mapa de conexões", icon: Network },
  ] },
  { nome: "Configurações", itens: [
    { to: "/integracoes", label: "Integrações", icon: Plug },
    { to: "/perfil", label: "Perfil", icon: User },
    
  ] },
] as const;

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <>
      {grupos.map((g) => (
        <nav key={g.nome} className="nav-group" aria-label={g.nome}>
          <p className="t-meta">{g.nome}</p>
          {g.itens.map((it) => {
            const Icon = it.icon;
            const ativo = path === it.to;
            return (
              <Link
                key={it.to}
                to={it.to}
                onClick={onNavigate}
                className={`nav-item ${ativo ? "is-current" : ""}`}
                aria-current={ativo ? "page" : undefined}
              >
                <Icon aria-hidden="true" />
                {it.label}
              </Link>
            );
          })}
        </nav>
      ))}
    </>
  );
}

function UserBox() {
  const [name, setName] = useState('Equipe Ômega');
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => { if (data.user) setName(data.user.user_metadata['display_name'] || data.user.email?.split('@')[0] || 'Equipe Ômega'); }); }, []);
  return (
    <Link to="/perfil" className="pw-userbox">
      <span className="avatar is-lime-off">{name.split(' ').map(n => n[0]).slice(0,2).join('').toUpperCase()}</span>
      <span className="stack" style={{ gap: 0 }}>
        <span className="t-label">{name}</span>
        <span className="t-meta">Minha conta</span>
      </span>
    </Link>
  );
}

function Brand({ operational = false }: { operational?: boolean }) {
  const { activeAccount, isSubconta } = useActiveAccount();
  return (
    <div className="brand">
      <span
        className="brand-mark"
        aria-hidden="true"
        style={{ backgroundColor: isSubconta && !operational ? "#a855f7" : undefined }}
      />
      <span className="brand-word">
        {operational ? "CRM H2 Marketing" : isSubconta ? activeAccount.nome.replace(" (Franquia)", "") : "Grupo Ômega"}
        <small style={{ color: isSubconta && !operational ? "#c084fc" : undefined }}>
          {operational ? "Contatos e relacionamento" : isSubconta ? "Subconta · Franquia" : "CRM de vendas · Matriz"}
        </small>
      </span>
    </div>
  );
}

function AccountSwitcher() {
  const { activeAccount, isSubconta, switchAccount, accounts } = useActiveAccount();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fechar = () => setOpen(false);
    window.addEventListener("click", fechar);
    return () => window.removeEventListener("click", fechar);
  }, []);

  return (
    <div className="account-switcher" style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-outline btn-sm"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          borderColor: isSubconta ? "#a855f7" : "var(--line)",
          background: isSubconta ? "rgba(168, 85, 247, 0.12)" : "var(--inset)",
          padding: "4px 10px",
          height: 32,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Alternar entre Matriz e Franquias (Subcontas)"
      >
        {isSubconta ? (
          <Store size={14} style={{ color: "#a855f7" }} />
        ) : (
          <Building2 size={14} style={{ color: "var(--lime-text)" }} />
        )}
        <span style={{ fontWeight: 600, fontSize: ".8125rem" }}>{activeAccount.nome}</span>
        <ChevronDown size={13} style={{ color: "var(--fg-3)" }} />
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 100,
            minWidth: 260,
            padding: 6,
            display: "grid",
            gap: 4,
            boxShadow: "0 12px 30px rgba(0,0,0,0.45)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="t-meta" style={{ padding: "4px 8px", fontSize: ".68rem" }}>
            ALTERNAR CONTA / FRANQUIA
          </span>
          {accounts.map((acc) => {
            const isSel = acc.id === activeAccount.id;
            return (
              <button
                key={acc.id}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: isSel ? "var(--inset)" : "transparent",
                }}
                onClick={() => {
                  switchAccount(acc.id);
                  setOpen(false);
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: acc.cor,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <b style={{ fontSize: ".8125rem", display: "block" }}>{acc.nome}</b>
                    <span className="t-caption" style={{ fontSize: ".7rem" }}>
                      {acc.whatsappPhone}
                    </span>
                  </div>
                </div>
                {isSel && <Check size={14} style={{ color: "var(--lime-text)" }} />}
              </button>
            );
          })}
          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "4px 0" }} />
          <Link
            to="/subcontas"
            className="btn btn-outline btn-sm"
            style={{ fontSize: ".75rem", justifyContent: "center" }}
            onClick={() => setOpen(false)}
          >
            Gerenciar Subcontas
          </Link>
        </div>
      )}
    </div>
  );
}

export function AppShell({ crumb, section = "Operação", children, accountControl }: { crumb: string; section?: string; children: ReactNode; accountControl?: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { activeAccount, isSubconta, switchAccount } = useActiveAccount();
  const [tema, setTema] = useState<Tema>("dark");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove("no-js");
    setTema(temaAtual());
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = reduce ? 0 : 1;
    const timers = [
      setTimeout(() => document.querySelectorAll(".boot-eyebrow").forEach((e) => e.classList.add("is-in")), 150 * t),
      setTimeout(() => document.querySelectorAll(".boot-title").forEach((e) => e.classList.add("is-in")), 350 * t),
      ...Array.from(document.querySelectorAll(".reveal, .wipe")).map((el, i) =>
        setTimeout(() => el.classList.add("is-in"), reduce ? 0 : Math.min(i * 90, 540) + 500),
      ),
      setTimeout(() => document.querySelectorAll(".reveal:not(.is-in), .wipe:not(.is-in)").forEach((e) => e.classList.add("is-in")), 2600),
    ];
    const move = (e: PointerEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.(".glow-card") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", move);
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("pointermove", move);
    };
  }, [crumb]);

  return (
    <div className="app">
      <aside className="side" aria-label="Navegação principal">
        <Brand operational={accountControl !== undefined} />
        <Nav />
        <UserBox />
      </aside>
      {menu && (
        <div className="pw-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="pw-drawer-scrim" aria-label="Fechar menu" onClick={() => setMenu(false)} />
          <aside className="side pw-drawer-panel">
            <div className="hstack between">
              <Brand operational={accountControl !== undefined} />
              <button className="btn btn-icon" aria-label="Fechar menu" onClick={() => setMenu(false)}>
                <X />
              </button>
            </div>
            <Nav onNavigate={() => setMenu(false)} />
            <UserBox />
          </aside>
        </div>
      )}
      <div className={`main ${crumb === "Inbox" ? "main-inbox" : ""}`}>
        <header className="top">
          <button className="btn btn-icon pw-menu-btn" aria-label="Abrir menu" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="crumbs">
            <span className="t-meta pw-hide-sm">{section}</span>
            <span className="sep pw-hide-sm">/</span>
            <span className="t-label">{crumb}</span>
          </div>
          <div style={{ marginLeft: 14 }}>
            {accountControl ?? <AccountSwitcher />}
          </div>
          <div className="spacer" />
          <button className="btn-icon btn" aria-label="Notificações">
            <Bell />
          </button>
          <button
            className="btn-icon btn"
            aria-label={tema === "dark" ? "Mudar para tema claro" : "Mudar para tema escuro"}
            onClick={() => setTema(alternarTema())}
          >
            {tema === "dark" ? <Sun /> : <Moon />}
          </button>
          <PwButton tone="icon" title="Sair" aria-label="Sair da plataforma" onClick={async () => { await queryClient.cancelQueries(); queryClient.clear(); await supabase.auth.signOut(); await navigate({ to: '/auth', search: { redirect: '/painel' }, replace: true }); }}><LogOut/></PwButton>
          <Link to="/perfil" className="avatar is-ink" aria-label="Meu perfil">
            <User size={16}/>
          </Link>
        </header>
        {isSubconta && !accountControl && (
          <div
            style={{
              background: "rgba(168, 85, 247, 0.14)",
              borderBottom: "1px solid rgba(168, 85, 247, 0.3)",
              padding: "6px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: ".8125rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="pill" style={{ background: "#a855f7", color: "#fff", fontSize: ".68rem", padding: "1px 6px" }}>
                Subconta Franquia
              </span>
              <span>
                Você está gerenciando o ambiente da franquia: <b>{activeAccount.nome}</b> (Leads e WhatsApp da unidade {activeAccount.loja})
              </span>
            </div>
            <button
              className="btn btn-outline btn-sm"
              style={{ fontSize: ".72rem", height: 26, padding: "0 8px" }}
              onClick={() => switchAccount("matriz")}
            >
              Voltar para Conta Principal (Matriz)
            </button>
          </div>
        )}
        <main className={`page ${crumb === "Inbox" ? "page-inbox" : ""}`}>{children}</main>
      </div>
    </div>
  );
}
