import { z } from "zod";
import { whatsappDayKey } from "../whatsapp-time";

const dayMs = 86400000;
const maxDays = 92;
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const time = Date.parse(value + "T00:00:00Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
});
export type LeadPeriod = { start_date: string; end_date: string };

export function shiftDay(day: string, offset: number) {
  return new Date(Date.parse(day + "T00:00:00Z") + offset * dayMs).toISOString().slice(0, 10);
}

export function recentLeadPeriod(days: number, now = Date.now()): LeadPeriod {
  const today = whatsappDayKey(now);
  return { start_date: shiftDay(today, 1 - days), end_date: today };
}

export const leadPeriodSchema = z.object({ start_date: dateKey, end_date: dateKey }).strict()
  .superRefine(({ start_date, end_date }, ctx) => {
    if (!dateKey.safeParse(start_date).success || !dateKey.safeParse(end_date).success) return;
    const length = (Date.parse(end_date) - Date.parse(start_date)) / dayMs + 1;
    if (length < 1 || length > maxDays || start_date < "2000-01-01" || end_date > whatsappDayKey(Date.now())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Selecione de 1 a 92 dias, sem datas futuras." });
    }
  });

export const leadDailyInput = z.object({
  tenant_id: z.string().uuid(),
  start_date: dateKey,
  end_date: dateKey,
}).strict().refine(({ start_date, end_date }) => leadPeriodSchema.safeParse({ start_date, end_date }).success,
  "Selecione um período válido de até 92 dias.");

export const leadDailySchema = z.object({
  days: z.array(z.object({ date: dateKey, leads: z.number().int().nonnegative().safe() }).strict()).min(2).max(184),
}).strict();

export function compareLeadPeriods(period: LeadPeriod, result: z.infer<typeof leadDailySchema>) {
  const length = (Date.parse(period.end_date) - Date.parse(period.start_date)) / dayMs + 1;
  const previousStart = shiftDay(period.start_date, -length);
  if (result.days.length !== length * 2 || result.days.some((day, index) => day.date !== shiftDay(previousStart, index))) {
    throw new Error("A base retornou dias incompletos ou fora do período.");
  }
  return { current: result.days.slice(length), previous: result.days.slice(0, length) };
}
