import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { canEnterPlatform } from '@/lib/auth-rules';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !canEnterPlatform(data.user)) throw redirect({ to: '/auth', search: { redirect: location.href } });
    return { user: data.user };
  },
  component: Outlet,
});