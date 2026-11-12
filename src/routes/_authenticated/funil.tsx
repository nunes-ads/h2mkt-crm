import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHead, meta } from '@/components/pw';
import { Modal, Field, PwButton } from '@/components/omega-ui';
import { ETAPAS, MOTIVOS_PERDA, brl, type Conversa } from '@/components/inbox/dados';
import { useDeals } from '@/lib/omega-demo';

export const Route = createFileRoute('/_authenticated/funil')({
  head: () => meta('Funil', 'As seis etapas do atendimento Ômega, da abordagem ao pós-venda.'),
  component: Funil,
});

function Funil() {
  const [ds, setDs] = useDeals();
  const [dealPerda, setDealPerda] = useState<Conversa | null>(null);
  const [motivoPerda, setMotivoPerda] = useState<string>(MOTIVOS_PERDA[0]);
  const [detalhesPerda, setDetalhesPerda] = useState('');

  const moverEtapa = (id: string, etapa: (typeof ETAPAS)[number]) => {
    setDs((l) =>
      l.map((d) => {
        if (d.id !== id) return d;
        return {
          ...d,
          etapa,
          log: [{ t: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), text: `Etapa alterada para ${etapa}` }, ...d.log],
        };
      })
    );
  };

  const confirmarPerda = () => {
    if (!dealPerda) return;
    const motivoFinal = detalhesPerda.trim() ? `${motivoPerda} (${detalhesPerda.trim()})` : motivoPerda;
    setDs((l) =>
      l.map((d) => {
        if (d.id !== dealPerda.id) return d;
        return {
          ...d,
          status: 'Perdido',
          perda: motivoFinal,
          log: [
            {
              t: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
              text: `Oportunidade marcada como Perdida: ${motivoFinal}`,
            },
            ...d.log,
          ],
        };
      })
    );
    setDealPerda(null);
    setDetalhesPerda('');
  };

  return (
    <AppShell crumb="Funil">
      <PageHead eyebrow="Vendas" title="Funil de Vendas e Oportunidades" />
      <div className="om-kanban">
        {ETAPAS.map((et) => {
          const col = ds.filter((d) => d.etapa === et);
          const totalVal = col.reduce((s, d) => s + (d.valor || 0), 0);
          return (
            <section
              key={et}
              className="om-column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain');
                if (id) moverEtapa(id, et);
              }}
            >
              <header>
                <h2>{et}</h2>
                <span className="t-meta num">
                  {col.length} · {brl(totalVal)}
                </span>
              </header>
              {col.map((d) => (
                <article
                  className="om-deal"
                  key={d.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', d.id)}
                >
                  <Link to="/" search={{ conversa: d.id }} className="t-label">
                    {d.nome}
                  </Link>
                  <p className="t-caption">
                    {d.carro || '—'} · {d.origem ? d.origem.replace(/ \(.*\)/, '') : 'Direto'}
                  </p>

                  <div className="om-between" style={{ marginTop: 4, marginBottom: 6 }}>
                    <span className="num" style={{ fontWeight: 600 }}>
                      {d.valor ? brl(d.valor) : 'Sem valor'}
                    </span>
                    <span
                      className={`pill ${d.status === 'Perdido' ? 'is-warn' : d.status === 'Resolvido' || d.status === 'Encerrado' || d.ag ? 'is-ok' : 'is-wait'}`}
                    >
                      {d.status}
                    </span>
                  </div>

                  {d.status === 'Perdido' && d.perda && (
                    <p className="t-caption" style={{ color: '#ef4444', fontSize: 11, margin: '2px 0 6px' }}>
                      Motivo: {d.perda}
                    </p>
                  )}

                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                    <select
                      className="input select om-stage"
                      aria-label={`Etapa de ${d.nome}`}
                      value={d.etapa}
                      onChange={(e) => {
                        const next = ETAPAS.find((x) => x === e.target.value);
                        if (next) moverEtapa(d.id, next);
                      }}
                      style={{ flex: 1 }}
                    >
                      {ETAPAS.map((e) => (
                        <option key={e}>{e}</option>
                      ))}
                    </select>

                    {d.status !== 'Perdido' ? (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: 11, padding: '3px 7px', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        title="Marcar como Perdido (RN-066)"
                        onClick={() => {
                          setDealPerda(d);
                          setMotivoPerda(MOTIVOS_PERDA[0]);
                          setDetalhesPerda('');
                        }}
                      >
                        Perder
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        style={{ fontSize: 11, padding: '3px 7px', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.3)' }}
                        title="Reabrir Oportunidade (RN-067)"
                        onClick={() => {
                          setDs((prev) =>
                            prev.map((c) =>
                              c.id === d.id
                                ? { ...c, status: 'Em atendimento humano', perda: null, log: [{ t: 'Hoje', text: 'Oportunidade reaberta' }, ...c.log] }
                                : c
                            )
                          );
                        }}
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </section>
          );
        })}
      </div>

      {/* Modal Obrigatório de Motivo de Perda (RN-066) */}
      {dealPerda && (
        <Modal title={`Motivo de Perda — ${dealPerda.nome}`} close={() => setDealPerda(null)}>
          <div className="om-stack">
            <p className="t-caption">
              Conforme a regra RN-066, toda oportunidade perdida exige o registro do motivo para análise de conversão e relatórios.
            </p>
            <Field label="Motivo da Perda">
              <select
                className="input select"
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
              >
                {MOTIVOS_PERDA.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observações adicionais (opcional)">
              <input
                className="input"
                placeholder="Ex: achou caro na concorrência de Taguatinga..."
                value={detalhesPerda}
                onChange={(e) => setDetalhesPerda(e.target.value)}
              />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <PwButton onClick={() => setDealPerda(null)}>Cancelar</PwButton>
              <PwButton tone="primary" onClick={confirmarPerda} style={{ backgroundColor: '#dc2626', borderColor: '#dc2626' }}>
                Confirmar Perda
              </PwButton>
            </div>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}
