const timeZone = "America/Sao_Paulo";
const clock = new Intl.DateTimeFormat("pt-BR", {
  timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const date = new Intl.DateTimeFormat("pt-BR", {
  timeZone, day: "2-digit", month: "2-digit", year: "numeric",
});
const dayKey = new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "short" });

export function whatsappTimestamp(value: unknown): number {
  if (typeof value === "object" && value !== null && "low" in value && "high" in value) {
    if (typeof value.low !== "number" || typeof value.high !== "number" ||
        !Number.isInteger(value.low) || !Number.isInteger(value.high) || value.high < 0) return 0;
    value = value.high * 2 ** 32 + (value.low >>> 0);
  }
  if (typeof value === "string") {
    const input = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(input)) value = Number(input);
    else if (/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/i.test(input)) value = Date.parse(input);
    else return 0;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  const millis = Math.trunc(value < 1e11 ? value * 1000 : value);
  return millis <= 8.64e15 ? millis : 0;
}

export function whatsappMessageTime(value: number | undefined) {
  return value && Number.isFinite(value) && value > 0 && value <= 8.64e15 ? value : 0;
}

export function whatsappHour(value: number | undefined) {
  return whatsappMessageTime(value) ? clock.format(value) : "";
}

export function whatsappDate(value: number | undefined) {
  return whatsappMessageTime(value) ? date.format(value) : "";
}

export function whatsappDayKey(value: number | undefined) {
  return whatsappMessageTime(value) ? dayKey.format(value) : "";
}

export function whatsappDayLabel(value: number | undefined, now = Date.now()) {
  const day = whatsappDayKey(value);
  if (!day) return "Data não informada";
  const today = whatsappDayKey(now);
  if (day === today) return "Hoje";
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  return day === yesterday ? "Ontem" : whatsappDate(value);
}

export function whatsappListTime(value: number | undefined, now = Date.now()) {
  if (!whatsappMessageTime(value)) return "";
  const label = whatsappDayLabel(value, now);
  return label === "Hoje" ? whatsappHour(value) : label;
}
