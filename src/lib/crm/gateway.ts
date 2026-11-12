import type { z } from "zod";

export type RpcClient = {
  rpc: (
    name: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
};
export class CrmError extends Error {
  constructor(
    public code: "setup" | "denied" | "conflict" | "validation" | "unavailable",
    message: string,
  ) {
    super(message);
    this.name = "CrmError";
  }
}
const errorMessages: Record<string, string> = {
  CRM_DUPLICATE:
    "Já existe um contato com este telefone ou e-mail. Localize-o ou revise uma mesclagem.",
  CRM_CONFLICT:
    "Este registro foi alterado por outra pessoa. Atualize a lista antes de tentar novamente.",
  CRM_FORBIDDEN: "Seu vínculo ou permissão não permite esta operação.",
  CRM_LIMIT: "O limite da organização foi atingido.",
  CRM_VALIDATION: "Revise os campos e requisitos configurados para esta organização.",
  CRM_IDEMPOTENCY_CONFLICT: "Esta tentativa já foi usada para outra alteração. Atualize a página.",
};

/** Use the signed-in Supabase client, NEVER a service-role client. RPC enforces RLS and auth.uid(). */
export async function crmRpc<T extends z.ZodTypeAny>(
  client: RpcClient,
  operation: string,
  payload: Record<string, unknown>,
  schema: T,
): Promise<z.output<T>> {
  const { data, error } = await client.rpc("crm_api_v1", {
    p_operation: operation,
    p_payload: payload,
  });
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883")
      throw new CrmError(
        "setup",
        "A base operacional do CRM ainda precisa ser provisionada pelo administrador.",
      );
    const known = Object.keys(errorMessages).find((code) => error.message === code);
    if (known)
      throw new CrmError(
        known === "CRM_CONFLICT" ? "conflict" : known === "CRM_FORBIDDEN" ? "denied" : "validation",
        errorMessages[known]!,
      );
    if (error.code === "42501")
      throw new CrmError("denied", "Acesso não autorizado a esta organização.");
    // Provider/database messages may contain identifiers, SQL or credentials.
    throw new CrmError(
      "unavailable",
      "Não foi possível concluir a operação. Tente novamente sem alterar os dados.",
    );
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success)
    throw new CrmError(
      "unavailable",
      "O servidor retornou um contrato incompatível. Peça a atualização da base do CRM.",
    );
  return parsed.data;
}
