import {
  DEFAULT_SCHEDULING_CONSTRAINTS,
  parseTimeToMinutes,
} from '../calendar/calendar.utils';

export interface LeaveDaySlot {
  dateKey: string; // YYYY-MM-DD (local)
  monthKey: string; // YYYY-MM (local)
  startTime: string; // HH:mm (local)
  endTime: string; // HH:mm (local)
  minutes: number;
}

const WORKING_START_MINUTES = parseTimeToMinutes(
  DEFAULT_SCHEDULING_CONSTRAINTS.workingHoursStart,
);
const WORKING_END_MINUTES = parseTimeToMinutes(
  DEFAULT_SCHEDULING_CONSTRAINTS.workingHoursEnd,
);
const WORKING_DAYS = new Set(DEFAULT_SCHEDULING_CONSTRAINTS.workingDays);

const pad2 = (value: number): string => value.toString().padStart(2, '0');

export const DEFAULT_MONTHLY_ALLOWANCE_MINUTES = 480;

export function getLocalDateKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

export function getLocalMonthKey(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  return `${year}-${month}`;
}

export function getLocalTimeMinutes(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  const second = Number(parts.find((part) => part.type === 'second')?.value ?? '0');
  return hour * 60 + minute + second / 60;
}

export function minutesToTime(minutes: number): string {
  const safeMinutes = Math.max(0, minutes);
  const hours = Math.floor(safeMinutes / 60);
  const mins = Math.floor(safeMinutes % 60);
  return `${pad2(hours)}:${pad2(mins)}`;
}

export function buildLeaveDaySlots(
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): LeaveDaySlot[] {
  const slots: LeaveDaySlot[] = [];
  const startDateKey = getLocalDateKey(rangeStart, timeZone);
  const endDateKey = getLocalDateKey(rangeEnd, timeZone);

  const localStart = new Date(rangeStart.toLocaleString('en-US', { timeZone }));
  localStart.setHours(0, 0, 0, 0);
  const localEnd = new Date(rangeEnd.toLocaleString('en-US', { timeZone }));
  localEnd.setHours(0, 0, 0, 0);

  for (
    let cursor = new Date(localStart);
    cursor <= localEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    if (!WORKING_DAYS.has(cursor.getDay())) {
      continue;
    }

    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const day = cursor.getDate();
    const dateKey = `${year}-${pad2(month)}-${pad2(day)}`;
    const monthKey = `${year}-${pad2(month)}`;

    const startMinutes =
      dateKey === startDateKey ? getLocalTimeMinutes(rangeStart, timeZone) : WORKING_START_MINUTES;
    const endMinutes =
      dateKey === endDateKey ? getLocalTimeMinutes(rangeEnd, timeZone) : WORKING_END_MINUTES;

    const slotStart = Math.max(WORKING_START_MINUTES, startMinutes);
    const slotEnd = Math.min(WORKING_END_MINUTES, endMinutes);

    if (slotEnd <= slotStart) {
      continue;
    }

    slots.push({
      dateKey,
      monthKey,
      startTime: minutesToTime(slotStart),
      endTime: minutesToTime(slotEnd),
      minutes: slotEnd - slotStart,
    });
  }

  return slots;
}

export function calculateLeaveMinutes(rangeStart: Date, rangeEnd: Date, timeZone: string): number {
  return buildLeaveDaySlots(rangeStart, rangeEnd, timeZone).reduce(
    (sum, slot) => sum + slot.minutes,
    0,
  );
}

export function calculateLeaveMinutesByMonth(
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): Map<string, number> {
  const map = new Map<string, number>();
  const slots = buildLeaveDaySlots(rangeStart, rangeEnd, timeZone);

  for (const slot of slots) {
    const current = map.get(slot.monthKey) ?? 0;
    map.set(slot.monthKey, current + slot.minutes);
  }

  return map;
}
