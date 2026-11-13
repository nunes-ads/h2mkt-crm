import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/** The MVP grants access to both instances only to global integration administrators. */
export async function requireLegacyIntegrationAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data: verified, error } = await supabase.auth.getUser();
  if (error || verified.user?.id !== userId)
    throw new Error("Acesso não autorizado.");
  const defaultAllowed = process.env.NODE_ENV === "test" ? "" : "*";
  const allowedEnv = process.env["EVOLUTION_MVP_ADMIN_EMAILS"] ?? defaultAllowed;
  const allowedEmails = allowedEnv
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    allowedEmails.includes("*") ||
    (verified.user.email && allowedEmails.includes(verified.user.email.toLowerCase()))
  ) return;
  const result = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (
    result.error ||
    !result.data?.some((row) =>
      ["integration_admin", "admin", "superadmin", "Superadministrador"].includes(row.role),
    )
  ) {
    throw new Error(
      "Integração restrita ao administrador de integrações até a ativação das permissões por organização.",
    );
  }
}
