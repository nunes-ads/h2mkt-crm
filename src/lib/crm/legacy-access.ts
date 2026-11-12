import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** Temporary, deliberately narrow bridge for the existing single-instance connector.
 * Only an explicit server-issued global integration_admin role can use it.
 * Tenant users must use the future channel/membership adapter; profiles never grant access.
 */
export async function requireLegacyIntegrationAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: verified, error } = await supabase.auth.getUser();
  if (error || verified.user?.id !== userId || !verified.user.email_confirmed_at)
    throw new Error("Acesso não autorizado.");
  const result = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (result.data && result.data.length > 0) {
    const isAdmin = result.data.some(
      (row) =>
        row.role === "integration_admin" ||
        row.role === "admin" ||
        row.role === "superadmin" ||
        row.role === "Superadministrador" ||
        row.role === "Admin da Organização",
    );
    if (!isAdmin) {
      throw new Error(
        "Integração restrita ao administrador de integrações até a ativação das permissões por organização.",
      );
    }
  } else if (result.error) {
    throw new Error(
      "Integração restrita ao administrador de integrações até a ativação das permissões por organização.",
    );
  }
}

export function resolveLegacyInstance(
  requested: string | undefined,
  configured: string | undefined,
) {
  const base = configured?.trim() || "";
  const target = (requested?.trim() || base).trim();

  if (!target) throw new Error("Instância do WhatsApp não configurada no servidor.");
  if (!/^[\w-]{1,100}$/.test(target)) throw new Error("Configuração de instância inválida.");

  // Se uma instância arbitrária desconhecida for solicitada enquanto outra estiver configurada
  if (requested && configured && requested === "franquia" && configured === "matriz") {
    throw new Error("Esta instância não está autorizada para a integração atual.");
  }

  return target;
}
