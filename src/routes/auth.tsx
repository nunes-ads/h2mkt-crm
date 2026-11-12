import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, LogIn, Moon, Sun, UserPlus } from 'lucide-react';
import { Field, PwButton } from '@/components/omega-ui';
import { meta } from '@/components/pw';
import { supabase } from '@/integrations/supabase/client';
import { safeReturnPath, canEnterPlatform } from '@/lib/auth-rules';
import { alternarTema, temaAtual } from '@/lib/tema';

export const Route = createFileRoute('/auth')({
  validateSearch: (search: Record<string, unknown>) => ({ redirect: safeReturnPath(search['redirect']) }),
  head: () => meta('Acesso e cadastro', 'Entre ou crie sua conta com confirmação de e-mail no CRM Grupo Ômega.'),
  component: Auth,
});
function Auth() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [show, setShow] = useState(false); const [forgot, setForgot] = useState(false);
  const [signup, setSignup] = useState(false); const [name, setName] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [theme, setTheme] = useState('dark');
  useEffect(() => { setTheme(temaAtual()); void supabase.auth.getUser().then(({ data }) => { if (canEnterPlatform(data.user)) void navigate({ to: redirect }); }); }, [navigate, redirect]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (forgot) {
        const { error: failure } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        if (failure) throw failure;
        setNotice('Se este e-mail tem acesso, você receberá um link para redefinir a senha.');
      } else if (signup) {
        if (password !== confirmation) throw new Error('As senhas não coincidem.');
        const { error: failure } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${window.location.origin}/auth`, data: { display_name: name.trim() } } });
        if (failure) throw failure;
        setPassword(''); setConfirmation('');
        setNotice('Confira seu e-mail e confirme o cadastro antes de entrar. Se já possui conta, use Entrar ou recupere sua senha.');
      } else {
        const { error: failure } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (failure) throw failure;
        const { data, error: verification } = await supabase.auth.getUser();
        if (verification || !canEnterPlatform(data.user)) throw new Error('Confirme seu e-mail antes de entrar.');
        setPassword(''); await navigate({ to: redirect });
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  const switchMode=(create:boolean)=>{setSignup(create);setForgot(false);setError('');setNotice('');setPassword('');setConfirmation('');};
  return <main className="om-auth"><header className="om-auth-top"><div className="brand"><span className="brand-mark" aria-hidden="true"/><span className="brand-word">Grupo Ômega<small>CRM de vendas</small></span></div><PwButton tone="icon" aria-label="Alternar tema" onClick={() => setTheme(alternarTema())}>{theme === 'dark' ? <Sun/> : <Moon/>}</PwButton></header><section className="om-auth-form"><span className="t-eyebrow">Equipe Ômega</span><h1 className="t-h1">{forgot ? 'Recuperar acesso' : signup ? 'Criar conta' : 'Entrar'}</h1>{!forgot&&<div className="om-auth-modes" role="tablist" aria-label="Acesso à plataforma"><PwButton disabled={busy} role="tab" aria-selected={!signup} onClick={()=>switchMode(false)}>Entrar</PwButton><PwButton disabled={busy} role="tab" aria-selected={signup} onClick={()=>switchMode(true)}>Criar conta</PwButton></div>}<form className="om-stack" onSubmit={submit}>{signup&&!forgot&&<Field label="Nome"><input className="input" autoComplete="name" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></Field>}<Field label="E-mail"><input className="input" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></Field>{!forgot && <Field label="Senha"><span className="om-auth-password"><input aria-label="Senha" className="input" type={show ? 'text' : 'password'} autoComplete={signup?'new-password':'current-password'} minLength={signup?8:undefined} required value={password} onChange={e => setPassword(e.target.value)}/><PwButton tone="icon" type="button" aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShow(!show)}>{show ? <EyeOff/> : <Eye/>}</PwButton></span></Field>}{signup&&!forgot&&<Field label="Confirmar senha"><input className="input" type={show?'text':'password'} autoComplete="new-password" required minLength={8} value={confirmation} onChange={e=>setConfirmation(e.target.value)}/></Field>}{error && <p role="alert" className="om-notice">{error}</p>}{notice && <p role="status" className="om-saved">{notice}</p>}<PwButton tone="primary" disabled={busy} type="submit">{signup&&!forgot?<UserPlus/>:<LogIn/>}{busy ? 'Aguarde…' : forgot ? 'Enviar link' : signup?'Cadastrar':'Entrar na plataforma'}</PwButton>{!signup&&<PwButton disabled={busy} tone="ghost" type="button" onClick={() => { setForgot(!forgot); setNotice(''); setError(''); }}>{forgot ? 'Voltar para entrar' : 'Esqueci minha senha'}</PwButton>}</form><span className="t-caption">{signup?'Cadastro com confirmação por e-mail':'Acesso da equipe · Grupo Ômega'}</span></section><footer className="om-auth-footer"><span>Hudson</span><span className="t-meta">Atendimento · Vendas · Agendamentos</span></footer></main>;
}