import { createFileRoute } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyRound, Pencil, ShieldCheck } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Field, Modal, PwButton } from '@/components/omega-ui';
import { meta } from '@/components/pw';
import { getProfile, saveProfile } from '@/lib/omega-profile.functions';
import { supabase } from '@/integrations/supabase/client';
import { temaAtual } from '@/lib/tema';
const options = {
  queryKey: ['omega-profile'],
  queryFn: async () => {
    try {
      return await getProfile();
    } catch (err) {
      const { data: verified } = await supabase.auth.getUser();
      const user = verified?.user;
      if (!user) throw err;
      let profile = null;
      let roles: string[] = [];
      try {
        const [p, r] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', user.id),
        ]);
        if (!p.error && p.data) profile = p.data;
        if (!r.error && Array.isArray(r.data)) roles = r.data.map((x: { role: string }) => x.role);
      } catch { }
      return {
        profile,
        roles,
        email: user.email ?? '',
        createdAt: user.created_at ?? new Date().toISOString(),
      };
    }
  },
};

export const Route = createFileRoute('/_authenticated/perfil')({
  head: () => meta('Perfil', 'Dados pessoais e segurança da sua conta no CRM Grupo Ômega.'),
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(options);
    } catch {
      return null;
    }
  },
  component: Perfil,
});

function Perfil() {
  const read = useServerFn(getProfile);
  const save = useServerFn(saveProfile);
  const { data, refetch } = useSuspenseQuery({
    ...options,
    queryFn: async () => {
      try {
        return await read();
      } catch {
        return await options.queryFn();
      }
    },
  });
  const [edit, setEdit] = useState(false);
  const [change, setChange] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const name = data.profile?.display_name || data.email.split('@')[0] || 'Minha conta';

  return (
    <AppShell crumb="Perfil" section="Configurações">
      <section className="pf-head om-section">
        <div className="pf-av">{name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}</div>
        <div className="pf-who">
          <span className="t-eyebrow">Informações gerais</span>
          <h1 className="t-h1">{name}</h1>
          <span className="t-caption">{data.email}</span>
          <div className="pf-chips">
            {data.roles.length > 0 ? (
              data.roles.map(r => <span className="chip" key={r}>{r}</span>)
            ) : (
              <span className="chip">Usuário</span>
            )}
          </div>
        </div>
        <div className="pf-acts">
          <PwButton tone="primary" onClick={() => setEdit(true)}><Pencil />Editar perfil</PwButton>
          <PwButton onClick={() => setChange(true)}><KeyRound />Alterar senha</PwButton>
        </div>
      </section>
      <section className="om-section">
        <h2 className="t-h3">Informações gerais</h2>
        <div className="pf-grid">
          {[
            ['Nome', name],
            ['E-mail', data.email],
            ['Telefone', data.profile?.phone || '—'],
            ['Membro desde', new Date(data.createdAt).toLocaleDateString('pt-BR')],
          ].map(([label, value]) => (
            <div key={label} className="pf-f"><small>{label}</small><b>{value}</b></div>
          ))}
        </div>
      </section>
      <section className="om-section">
        <h2 className="t-h3">Segurança</h2>
        <div className="pf-sec">
          <ShieldCheck /><b>E-mail confirmado</b>
          <PwButton onClick={() => setChange(true)}>Alterar senha</PwButton>
        </div>
      </section>
      {notice && <p role="status" className="om-notice">{notice}</p>}
      {edit && (
        <Modal title="Editar perfil" close={() => setEdit(false)}>
          <form
            className="om-stack"
            onSubmit={async e => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              const displayName = String(f.get('name'));
              const phone = String(f.get('phone'));
              try {
                try {
                  await save({
                    data: {
                      display_name: displayName,
                      phone,
                      avatar_url: data.profile?.avatar_url ?? null,
                      preferences: { theme: temaAtual(), sound: false },
                    },
                  });
                } catch {
                  const { data: verified } = await supabase.auth.getUser();
                  if (verified?.user?.id) {
                    await supabase.from('profiles').update({
                      display_name: displayName,
                      phone,
                    }).eq('id', verified.user.id);
                  }
                }
                await refetch();
                setEdit(false);
                setNotice('Perfil salvo.');
              } catch (err) {
                setNotice(err instanceof Error ? err.message : 'Não foi possível salvar.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Nome completo">
              <input name="name" className="input" required defaultValue={name} />
            </Field>
            <Field label="Telefone">
              <input name="phone" className="input" type="tel" defaultValue={data.profile?.phone || ''} />
            </Field>
            <PwButton tone="primary" disabled={busy}>Salvar perfil</PwButton>
          </form>
        </Modal>
      )}
      {change && (
        <Modal title="Alterar senha" close={() => setChange(false)}>
          <form
            className="om-stack"
            onSubmit={async e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              const { error } = await supabase.auth.updateUser({
                password: String(f.get('new')),
                current_password: String(f.get('current')),
              });
              setBusy(false);
              if (error) {
                setNotice(error.message);
                return;
              }
              setChange(false);
              setNotice('Senha atualizada.');
            }}
          >
            <Field label="Senha atual">
              <input className="input" type="password" name="current" autoComplete="current-password" required />
            </Field>
            <Field label="Nova senha">
              <input className="input" type="password" name="new" autoComplete="new-password" minLength={8} required />
            </Field>
            <PwButton tone="primary" disabled={busy}>Salvar senha</PwButton>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
