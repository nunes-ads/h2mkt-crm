import { z } from "zod";

export const whatsappAccountId = z.enum(["matriz", "sub-asasul"]);
export type WhatsAppAccountId = z.infer<typeof whatsappAccountId>;

export const defaultWhatsAppInstances = {
  matriz: "teste-local",
  "sub-asasul": "franquia-asasul",
} as const;

export type WhatsAppConnectionState =
  "open" | "connecting" | "close" | "missing" | "unconfigured" | "unavailable";

export const whatsappStatusLabel: Record<WhatsAppConnectionState, string> = {
  open: "WhatsApp conectado",
  connecting: "WhatsApp aguardando pareamento",
  close: "WhatsApp desconectado",
  missing: "WhatsApp desconectado",
  unconfigured: "WhatsApp ainda não configurado",
  unavailable: "Não foi possível verificar o WhatsApp",
};

export const WHATSAPP_POLL_INTERVAL = 4000;

export function whatsappErrorMessage(error: Error) {
  if (error.message.trimStart().startsWith("[") || error.message.includes("unrecognized_keys")) {
    return "Atualize a página para carregar a versão mais recente e verifique a conexão novamente.";
  }
  return error.message;
}
