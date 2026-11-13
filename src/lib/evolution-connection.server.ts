import {
  defaultWhatsAppInstances,
  type WhatsAppAccountId,
  type WhatsAppConnectionState,
} from "./whatsapp-connection";

export function resolveEvolutionInstance(accountId: WhatsAppAccountId, env: NodeJS.ProcessEnv) {
  const matriz = env["EVOLUTION_INSTANCE_NAME"]?.trim() || defaultWhatsAppInstances.matriz;
  const asaSul =
    env["EVOLUTION_ASA_SUL_INSTANCE_NAME"]?.trim() || defaultWhatsAppInstances["sub-asasul"];
  if (![matriz, asaSul].every((name) => /^[\w-]{1,80}$/.test(name) && !name.includes("--crm-")))
    throw new Error("Nome de instância inválido na configuração do servidor.");
  if (matriz.toLowerCase() === asaSul.toLowerCase())
    throw new Error("Matriz e Asa Sul precisam de instâncias diferentes.");
  if (accountId === "matriz") return matriz;
  if (accountId === "sub-asasul") return asaSul;
  throw new Error("Conta de WhatsApp inválida.");
}

type EvolutionConfig = { url: string; key: string; instance: string };

export type EvolutionInstance = {
  name?: string;
  instance?: { instanceName?: string };
  ownerJid?: string | null;
  profilePicUrl?: string | null;
  _count?: { Message?: number; Contact?: number; Chat?: number };
};

export async function listEvolutionInstances({
  url,
  key,
}: Pick<EvolutionConfig, "url" | "key">): Promise<EvolutionInstance[]> {
  if (!key) return [];
  try {
    const response = await fetch(`${url}/instance/fetchInstances`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error();
    const raw = await response.json();
    const list = Array.isArray(raw) ? raw : raw.value;
    if (Array.isArray(list)) return list.filter((item) => item && typeof item === "object");
  } catch {
    // Provider diagnostics can contain internal details. Give the operator a safe retry message.
  }
  throw new Error(
    "Não foi possível consultar as instâncias na Evolution. Verifique o servidor e tente novamente.",
  );
}

/** Persist the account binding in the provider itself, including after an app restart. */
export function selectEvolutionInstance(base: string, instances: EvolutionInstance[]) {
  let selected: { instance: string; generation: number; metadata?: EvolutionInstance } = {
    instance: base,
    generation: 0,
  };
  const prefix = `${base}--crm-`;
  for (const metadata of instances) {
    const name = metadata.name ?? metadata.instance?.instanceName;
    if (typeof name !== "string") continue;
    if (name === base && selected.generation === 0) selected = { ...selected, metadata };
    if (!name.startsWith(prefix)) continue;
    const suffix = name.slice(prefix.length);
    if (!/^[1-9]\d{0,8}$/.test(suffix)) continue;
    const generation = Number(suffix);
    if (generation > selected.generation) selected = { instance: name, generation, metadata };
  }
  return selected;
}

export function needsFreshPairing(metadata: EvolutionInstance | undefined) {
  if (!metadata) return false;
  return (
    Boolean(metadata.ownerJid) ||
    !metadata._count ||
    Object.values(metadata._count).some((count) => count > 0)
  );
}

export function requireExpectedInstance(current: string, expected: string) {
  if (current !== expected)
    throw new Error("A instância desta conta mudou. Atualize a Inbox antes de continuar.");
}

export async function readEvolutionState({
  url,
  key,
  instance,
}: EvolutionConfig): Promise<WhatsAppConnectionState> {
  if (!key) return "unconfigured";
  try {
    const response = await fetch(`${url}/instance/connectionState/${instance}`, {
      headers: { apikey: key },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (response.status === 404) return "missing";
    if (!response.ok) return "unavailable";
    const data = await response.json();
    const state = data.instance?.state ?? data.state;
    if (state === "open" || state === "connecting" || state === "close") return state;
    return state === "closed" || state === "disconnected" ? "close" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export async function requireEvolutionConnection(config: EvolutionConfig) {
  const state = await readEvolutionState(config);
  if (state === "open") return;
  if (state === "unavailable") throw new Error("Não foi possível verificar a conexão do WhatsApp.");
  throw new Error("WhatsApp desconectado. Conecte o número desta conta em Canais.");
}
