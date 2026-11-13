import { describe, expect, it } from "vitest";
import { compareLeadPeriods, leadPeriodSchema, recentLeadPeriod } from "@/lib/crm/lead-period";

describe("Períodos de entrada dos leads", () => {
  it("usa o dia de Brasília, mesmo após a meia-noite UTC", () => {
    expect(recentLeadPeriod(2, Date.parse("2025-01-02T02:30:00Z"))).toEqual({
      start_date: "2024-12-31", end_date: "2025-01-01",
    });
  });

  it("recusa datas inexistentes, inversões e intervalos longos", () => {
    for (const [start_date, end_date] of [
      ["2025-02-29", "2025-03-01"],
      ["2025-01-02", "2025-01-01"],
      ["2025-01-01", "2025-08-01"],
    ]) expect(leadPeriodSchema.safeParse({ start_date, end_date }).success).toBe(false);
  });

  it("compara períodos completos e diferencia zero de dia ausente", () => {
    const period = { start_date: "2025-01-01", end_date: "2025-01-02" };
    const days = [
      { date: "2024-12-30", leads: 2 }, { date: "2024-12-31", leads: 0 },
      { date: "2025-01-01", leads: 3 }, { date: "2025-01-02", leads: 1 },
    ];
    expect(compareLeadPeriods(period, { days })).toEqual({ current: days.slice(2), previous: days.slice(0, 2) });
    expect(() => compareLeadPeriods(period, { days: days.slice(1) })).toThrow(/incompletos/);
  });
});
