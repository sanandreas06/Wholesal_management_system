import { BadRequestException } from "@nestjs/common";

export function parseDay(value: string, endOfDay = false): Date {
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  if (isNaN(d.getTime())) throw new BadRequestException(`Invalid date: ${value}`);
  return d;
}

export function assertNotFuture(d: Date, label: string) {
  const endOfToday = new Date(); endOfToday.setUTCHours(23, 59, 59, 999);
  if (d.getTime() > endOfToday.getTime()) throw new BadRequestException(`${label} cannot be in the future`);
}
