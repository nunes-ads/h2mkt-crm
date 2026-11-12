import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
import { useServerFn } from '@tanstack/react-start';
import {
  Plus,
  Phone,
  MessageCircle,
  Mail,
  Globe,
  Instagram,
  Settings2,
  CheckCircle2,
  QrCode,
  RefreshCw,
  LogOut,
  ExternalLink,
  AlertCircle,
  Smartphone,
  Store,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageHead, meta } from '@/components/pw';
import { Field, Modal, PwButton } from '@/components/omega-ui';
import { canais, type Canal } from '@/data/canais';
import { useLocalDemo } from '@/lib/omega-local';
import { useActiveAccount } from '@/lib/omega-accounts';
import {
  getEvolutionStatus,
  getEvolutionConnectQr,
  logoutEvolutionInstance,
  type EvolutionStatusResponse,
  type EvolutionConnectResponse,
} from '@/lib/evolution.functions';

export const Route = createFileRoute('/_authenticated/canais')({
  head: () => meta('Canais', 'Canais Ômega: mensagens, marketplaces, voz, site e anúncios.'),
  component: Canais,
});

function Canais() {
  const { activeAccount, isSubconta } = useActiveAccount();
  const [configs, setConfigs] = useLocalDemo<Record<string, Record<string, string>>>(
    `omega-demo-canais-${activeAccount.id}`,
    {}
  );
  const [edit, setEdit] = useState<Canal | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState(false);
  const [saved, setSaved] = useState('');

  // Estados da Evolution API / QR Code da conta/subconta ativa
  const [evoStatus, setEvoStatus] = useState<EvolutionStatusResponse | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrInstance, setQrInstance] = useState(activeAccount.instanceName);
  const [qrData, setQrData] = useState<EvolutionConnectResponse | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [desconectando, setDesconectando] = useState(false);
  const [erroQr, setErroQr] = useState<string | null>(null);

  const fetchEvoStatus = useServerFn(getEvolutionStatus);
  const fetchEvoConnect = useServerFn(getEvolutionConnectQr);
  const fetchEvoLogout = useServerFn(logoutEvolutionInstance);

  const carregarStatus = useCallback(
    async (inst?: string) => {
      const target = inst || activeAccount.instanceName;
      try {
        const st = await fetchEvoStatus({ data: { instance: target } });
        setEvoStatus(st);
        return st;
      } catch (err: any) {
        setEvoStatus({
          configured: false,
          state: 'close',
          instance: target,
          phone: null,
          profilePicUrl: null,
          count: 0,
          contactsCount: 0,
          chatsCount: 0,
          error: err?.message,
        });
        return null;
      }
    },
    [fetchEvoStatus, activeAccount.instanceName]
  );

  // Recarrega status e instância sempre que a conta ativa mudar
  useEffect(() => {
    setQrInstance(activeAccount.instanceName);
    setEvoStatus(null);
    setQrData(null);
    setErroQr(null);
    void carregarStatus(activeAccount.instanceName);
  }, [activeAccount.id, activeAccount.instanceName, carregarStatus]);

  const carregarQr = useCallback(
    async (instName?: string, forceNew = false) => {
      setLoadingQr(true);
      setErroQr(null);
      const targetInst = instName || activeAccount.instanceName;
      try {
        // Primeiro checa status atual da instância
        const st = await fetchEvoStatus({ data: { instance: targetInst } });
        setEvoStatus(st);

        if (st.state === 'open' && !forceNew) {
          setQrData({ state: 'open', instance: targetInst });
          setLoadingQr(false);
          return;
        }

        const res = await fetchEvoConnect({ data: { instance: targetInst, forceNew } });
        setQrData(res);
        if (res.error) setErroQr(res.error);
      } catch (err: any) {
        setErroQr(err?.message || 'Falha ao obter QR Code da Evolution API');
      } finally {
        setLoadingQr(false);
      }
    },
    [fetchEvoStatus, fetchEvoConnect, activeAccount.instanceName]
  );

  const desconectarEGerarQr = async (instName?: string) => {
    setDesconectando(true);
    setErroQr(null);
    const targetInst = instName || activeAccount.instanceName;
    try {
      await fetchEvoLogout({ data: { instance: targetInst } });
      setEvoStatus(null);
      await carregarQr(targetInst, true);
    } catch (err: any) {
      setErroQr(err?.message || 'Erro ao desconectar instância');
    } finally {
      setDesconectando(false);
    }
  };

  // Polling automático enquanto o modal de QR Code estiver aberto e aguardando conexão
  useEffect(() => {
    if (!qrModalOpen) return;
    if (evoStatus?.state === 'open') return;

    const target = qrInstance || activeAccount.instanceName;
    const timer = setInterval(async () => {
      try {
        const st = await fetchEvoStatus({ data: { instance: target } });
        setEvoStatus(st);
        if (st.state === 'open') {
          setQrData({ state: 'open', instance: target });
          clearInterval(timer);
        }
      } catch {}
    }, 3500);

    return () => clearInterval(timer);
  }, [qrModalOpen, evoStatus?.state, qrInstance, activeAccount.instanceName, fetchEvoStatus]);

  const abrir = (c: Canal) => {
    if (c.id === 'wa_extra') {
      setQrInstance(activeAccount.instanceName);
      setQrModalOpen(true);
      void carregarQr(activeAccount.instanceName, false);
      setPicker(false);
      return;
    }
    setValues(configs[c.id] ?? {});
    setEdit(c);
    setPicker(false);
  };

  const evoAtivo = evoStatus?.configured && evoStatus?.state === 'open';

  return (
    <AppShell crumb="Canais" section="Automação">
      <PageHead
        eyebrow={`Canais de Atendimento · ${activeAccount.nome}`}
        title="Canais"
        actions={
          <PwButton tone="primary" onClick={() => setPicker(true)}>
            <Plus /> Conectar canal
          </PwButton>
        }
      />

      {/* STRIP DE STATUS COM IDENTIFICAÇÃO DA CONTA */}
      <div className="om-strip">
        <span className="t-meta">{canais.length} canais</span>
        <span className="t-meta">{Object.keys(configs).length + (evoAtivo ? 1 : 0)} configurados</span>
        {evoAtivo ? (
          <span className="pill is-ok">
            <CheckCircle2 size={13} /> WhatsApp {activeAccount.tipo} Ativo ({evoStatus?.instance})
          </span>
        ) : (
          <span className="pill is-warn">
            WhatsApp {activeAccount.nome} Pendente ({activeAccount.instanceName})
          </span>
        )}
      </div>

      <div className="pw-grid-3">
        {canais.map((c) => {
          const Icon =
            c.id === 'telefone'
              ? Phone
              : c.id === 'instagram'
              ? Instagram
              : c.id === 'email'
              ? Mail
              : c.grupo === 'Mensagens'
              ? MessageCircle
              : Globe;

          const isEvo = c.id === 'wa_extra';
          const nomeExibicao = isEvo
            ? `WhatsApp Extraoficial (${activeAccount.tipo === 'Matriz' ? 'Matriz' : activeAccount.loja})`
            : c.nome;

          const pillClass = isEvo && evoAtivo ? 'is-ok' : isEvo ? 'is-warn' : configs[c.id] ? 'is-wait' : 'is-warn';
          const statusLabel =
            isEvo && evoAtivo
              ? `Conectado · ${evoStatus?.instance}`
              : isEvo
              ? `Desconectado · QR Code (${activeAccount.instanceName})`
              : c.id === 'tiktok'
              ? 'Em breve'
              : configs[c.id]
              ? 'Configuração local'
              : 'Não conectado';

          const descExibicao =
            isEvo && evoAtivo
              ? `Conexão direta com a Evolution API (${activeAccount.instanceName}). ${evoStatus?.count?.toLocaleString('pt-BR')} mensagens registradas.`
              : isEvo
              ? `Conexão exclusiva via QR Code para ${activeAccount.nome} (instância: ${activeAccount.instanceName}).`
              : c.desc;

          return (
            <article className="card om-card" key={c.id}>
              <div className="om-card-head">
                <span className="om-channel-icon">
                  <Icon />
                </span>
                <div>
                  <h2>{nomeExibicao}</h2>
                  <span className="t-meta">{c.grupo}</span>
                </div>
              </div>

              <p className="t-caption">{descExibicao}</p>

              <span className={`pill ${pillClass}`}>{statusLabel}</span>

              {isEvo && evoAtivo && evoStatus?.phone && (
                <span className="t-caption font-semibold">Número: {evoStatus.phone}</span>
              )}
              {isEvo && !evoAtivo && (
                <span className="t-caption" style={{ color: 'var(--fg-3)' }}>
                  Instância: <strong>{activeAccount.instanceName}</strong> (aguardando QR Code)
                </span>
              )}
              {!isEvo && configs[c.id] && <span className="t-caption">{Object.values(configs[c.id] ?? {})[0]}</span>}

              <div className="om-toolbar">
                {isEvo ? (
                  <>
                    <PwButton
                      tone={evoAtivo ? 'outline' : 'primary'}
                      onClick={() => {
                        setQrInstance(activeAccount.instanceName);
                        setQrModalOpen(true);
                        void carregarQr(activeAccount.instanceName, false);
                      }}
                    >
                      <QrCode size={14} />
                      {evoAtivo ? 'Conexão & QR Code' : 'Conectar via QR Code'}
                    </PwButton>
                    {evoAtivo && (
                      <PwButton
                        onClick={() => {
                          window.location.href = '/';
                        }}
                      >
                        <ExternalLink size={14} /> Inbox
                      </PwButton>
                    )}
                  </>
                ) : (
                  <>
                    <PwButton disabled={c.id === 'tiktok'} onClick={() => abrir(c)}>
                      <Settings2 /> {configs[c.id] ? 'Configurar' : 'Conectar'}
                    </PwButton>
                    {configs[c.id] && (
                      <PwButton
                        onClick={() => {
                          setConfigs((v) => {
                            const copy = { ...v };
                            delete copy[c.id];
                            return copy;
                          });
                        }}
                      >
                        Limpar
                      </PwButton>
                    )}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* MODAL CONECTAR WHATSAPP DA CONTA / SUBCONTA ATIVA */}
      {qrModalOpen && (
        <Modal
          title={`Conectar WhatsApp · ${activeAccount.nome}`}
          close={() => setQrModalOpen(false)}
        >
          <div className="om-stack" style={{ gap: 14 }}>
            {/* Indicador de Subconta / Ambiente */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                borderRadius: 6,
                backgroundColor: isSubconta ? 'rgba(168, 85, 247, 0.12)' : 'rgba(163, 230, 53, 0.1)',
                border: `1px solid ${isSubconta ? 'rgba(168, 85, 247, 0.3)' : 'rgba(163, 230, 53, 0.25)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Store size={16} color={isSubconta ? '#a855f7' : '#84cc16'} />
                <span style={{ fontSize: 12, fontWeight: 700, color: isSubconta ? '#a855f7' : 'var(--lime-text)' }}>
                  Ambiente: {activeAccount.nome} ({activeAccount.tipo})
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                Instância: <strong>{qrInstance}</strong>
              </span>
            </div>

            {/* Seletor / Campo da Instância */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <Field label="Nome da Instância Evolution para esta conta">
                  <input
                    className="input"
                    value={qrInstance}
                    onChange={(e) => setQrInstance(e.target.value)}
                    placeholder={activeAccount.instanceName}
                  />
                </Field>
              </div>
              <PwButton
                type="button"
                onClick={() => void carregarQr(qrInstance, false)}
                disabled={loadingQr}
                title="Atualizar status ou gerar QR"
              >
                <RefreshCw size={14} />
                {loadingQr ? 'Carregando…' : 'Atualizar'}
              </PwButton>
            </div>

            {/* Mensagem de Erro (se houver) */}
            {erroQr && (
              <div className="om-notice om-warning" style={{ margin: 0 }}>
                <AlertCircle size={15} /> {erroQr}
              </div>
            )}

            {/* CENÁRIO 1: CONECTADO E OPERANDO */}
            {evoStatus?.state === 'open' ? (
              <div
                style={{
                  padding: '20px',
                  borderRadius: 8,
                  backgroundColor: 'rgba(34, 197, 94, 0.08)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: '50%',
                    backgroundColor: '#dcfce7',
                    color: '#16a34a',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <CheckCircle2 size={30} />
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 6px' }}>
                  WhatsApp Conectado com Sucesso!
                </h3>
                <p style={{ fontSize: 13, color: 'var(--fg-2)', margin: '0 0 14px' }}>
                  A instância <strong>{evoStatus.instance}</strong> vinculada à unidade{' '}
                  <strong>{activeAccount.nome}</strong> está online.
                </p>

                <div className="om-strip" style={{ justifyContent: 'center', marginBottom: 16 }}>
                  {evoStatus.phone && <span className="pill is-ok">Número: {evoStatus.phone}</span>}
                  <span className="t-meta">Mensagens: <b>{evoStatus.count?.toLocaleString('pt-BR')}</b></span>
                  <span className="t-meta">Contatos: <b>{evoStatus.contactsCount?.toLocaleString('pt-BR')}</b></span>
                  <span className="t-meta">Conversas: <b>{evoStatus.chatsCount?.toLocaleString('pt-BR')}</b></span>
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <PwButton
                    tone="primary"
                    type="button"
                    onClick={() => {
                      setQrModalOpen(false);
                      window.location.href = '/';
                    }}
                  >
                    <ExternalLink size={14} /> Abrir Inbox de {activeAccount.nome}
                  </PwButton>
                  <PwButton
                    type="button"
                    disabled={desconectando}
                    onClick={() => void desconectarEGerarQr(qrInstance)}
                    style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                  >
                    <LogOut size={14} />
                    {desconectando ? 'Desconectando…' : 'Desconectar e Ler Novo QR'}
                  </PwButton>
                </div>
              </div>
            ) : (
              /* CENÁRIO 2: AGUARDANDO ESCANEAMENTO DO QR CODE */
              <div style={{ textAlign: 'center' }}>
                {loadingQr ? (
                  <div style={{ padding: '40px 20px', color: 'var(--fg-3)' }}>
                    <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 10px' }} />
                    <p style={{ margin: 0, fontSize: 13 }}>
                      Iniciando instância <strong>{qrInstance}</strong> e gerando QR Code…
                    </p>
                  </div>
                ) : qrData?.base64 ? (
                  <>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: 14,
                        backgroundColor: '#ffffff',
                        borderRadius: 12,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                        border: '1px solid var(--border-subtle, #e2e8e4)',
                        marginBottom: 14,
                      }}
                    >
                      <img
                        src={qrData.base64}
                        alt="QR Code WhatsApp"
                        style={{ width: 240, height: 240, display: 'block', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Instruções */}
                    <div
                      style={{
                        textAlign: 'left',
                        fontSize: 12,
                        lineHeight: 1.6,
                        color: 'var(--fg-2)',
                        backgroundColor: 'var(--bg-2, rgba(0,0,0,0.02))',
                        padding: '10px 14px',
                        borderRadius: 8,
                        marginBottom: 14,
                        border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
                      }}
                    >
                      <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Smartphone size={15} /> Como conectar o WhatsApp da franquia {activeAccount.nome}:
                      </div>
                      <ol style={{ margin: 0, paddingLeft: 18 }}>
                        <li>Abra o <strong>WhatsApp</strong> no celular comercial da unidade</li>
                        <li>Toque em <strong>Configurações</strong> (iOS) ou <strong>Menu ⋮</strong> (Android)</li>
                        <li>Selecione <strong>Aparelhos conectados</strong></li>
                        <li>Toque em <strong>Conectar um aparelho</strong> e aponte para o QR Code acima</li>
                      </ol>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        color: '#16a34a',
                        fontSize: 12,
                        fontWeight: 600,
                        marginBottom: 14,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: '#16a34a',
                          display: 'inline-block',
                        }}
                      />
                      Aguardando leitura do QR Code em tempo real…
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <PwButton
                        type="button"
                        onClick={() => void carregarQr(qrInstance, true)}
                        disabled={loadingQr}
                      >
                        <RefreshCw size={14} /> Atualizar QR Code
                      </PwButton>
                      <PwButton type="button" onClick={() => setQrModalOpen(false)}>
                        Fechar
                      </PwButton>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '30px 10px' }}>
                    <p style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 14 }}>
                      Nenhum QR Code ativo para a instância <strong>{qrInstance}</strong> ({activeAccount.nome}).
                    </p>
                    <PwButton
                      tone="primary"
                      type="button"
                      onClick={() => void carregarQr(qrInstance, true)}
                      disabled={loadingQr}
                    >
                      <QrCode size={14} /> Gerar QR Code para {activeAccount.nome}
                    </PwButton>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {picker && (
        <Modal title="Conectar canal" close={() => setPicker(false)}>
          <div className="om-checks">
            {canais
              .filter((c) => c.id !== 'tiktok')
              .map((c) => (
                <PwButton key={c.id} onClick={() => abrir(c)}>
                  {c.nome}
                </PwButton>
              ))}
          </div>
        </Modal>
      )}

      {edit && (
        <Modal title={edit.nome} close={() => setEdit(null)}>
          <p className="om-notice">
            Configuração local para {activeAccount.nome}, sem conexão ativa. Credenciais devem ser adicionadas pela
            conexão segura do serviço, nunca neste formulário.
          </p>
          <form
            className="om-stack"
            onSubmit={(e) => {
              e.preventDefault();
              setConfigs((c) => ({ ...c, [edit.id]: values }));
              setSaved(edit.nome);
              setEdit(null);
            }}
          >
            {edit.fields.map((f) => (
              <Field key={f.label} label={f.label}>
                {f.options ? (
                  <select
                    className="input select"
                    value={values[f.label] ?? f.options[0]}
                    onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                  >
                    {f.options.map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input"
                    type={f.type ?? 'text'}
                    value={values[f.label] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [f.label]: e.target.value }))}
                  />
                )}
              </Field>
            ))}
            <div className="om-between">
              <PwButton type="button" onClick={() => setEdit(null)}>
                Cancelar
              </PwButton>
              <PwButton tone="primary" type="submit">
                Salvar configuração local
              </PwButton>
            </div>
          </form>
        </Modal>
      )}

      {saved && <p role="status" className="om-saved">Configuração de {saved} salva neste navegador.</p>}
    </AppShell>
  );
}
