import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
export const getProfile = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: verified, error: authError } = await context.supabase.auth.getUser();
  if (authError || !verified.user?.email_confirmed_at) throw new Error('Acesso não autorizado.');

  let profileData = null;
  let rolesData: string[] = [];

  try {
    const [profile, roles] = await Promise.all([
      context.supabase.from('profiles').select('*').eq('id', context.userId).maybeSingle(),
      context.supabase.from('user_roles').select('role').eq('user_id', context.userId)
    ]);
    if (!profile.error && profile.data) profileData = profile.data;
    if (!roles.error && Array.isArray(roles.data)) {
      rolesData = roles.data.map((r: { role: string }) => r.role);
    }
  } catch (err) {
    console.warn('[getProfile] Erro ao consultar perfil ou papéis:', err);
  }

  return {
    profile: profileData,
    roles: rolesData,
    email: verified.user.email ?? '',
    createdAt: verified.user.created_at ?? new Date().toISOString(),
  };
});
export const saveProfile = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).validator(z.object({ display_name: z.string().trim().min(1).max(100), phone: z.string().max(30), avatar_url: z.string().url().startsWith('https://').nullable(), preferences: z.object({ theme: z.enum(['dark', 'light']), sound: z.boolean() }) })).handler(async ({ data, context }) => {
  const { error } = await context.supabase.from('profiles').update(data).eq('id', context.userId);
  if (error) throw new Error(error.message);
  return { saved: true };
});