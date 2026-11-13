import { z } from "zod";
export const aiSuggestionInput = z
  .object({
    messages: z
      .array(
        z
          .object({
            role: z.enum(["user", "assistant"]),
            content: z.string().trim().min(1).max(6000),
          })
          .strict(),
      )
      .min(1)
      .max(30),
    contactName: z.string().max(160).optional(),
    contactPhone: z.string().max(40).optional(),
    carro: z.string().max(200).optional(),
    etapa: z.string().max(100).optional(),
    apiKey: z.string().max(300).optional(),
  })
  .strict()
  .refine(
    (data) => data.messages.reduce((sum, message) => sum + message.content.length, 0) <= 24000,
    "Histórico muito longo para uma sugestão.",
  );
