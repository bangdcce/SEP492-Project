/**
 * Calendar Module - Shared Utilities
 * Các helper functions dùng chung giữa calendar.service, availability.service, auto-schedule.service
 */

import { EventStatus } from 'src/database/entities';
import { AvailabilityType } from 'src/database/entities/user-availability.entity';

// =============================================================================
// SHARED CONSTANTS
// =============================================================================

/**
 * Calendar event statuses considered "active" (blocking availability)
 */
export const ACTIVE_EVENT_STATUSES = [
  EventStatus.SCHEDULED,
  EventStatus.PENDING_CONFIRMATION,
  EventStatus.IN_PROGRESS,
  EventStatus.RESCHEDULING,
] as const;

/**
 * Availability types that block scheduling
 */
export const BUSY_AVAILABILITY_TYPES = [
  AvailabilityType.BUSY,
  AvailabilityType.OUT_OF_OFFICE,
  AvailabilityType.DO_NOT_DISTURB,
] as const;

/**
 * Default scheduling constraints
 */
export const DEFAULT_SCHEDULING_CONSTRAINTS = {
  workingHoursStart: '08:00',
  workingHoursEnd: '18:00',
  workingDays: [1, 2, 3, 4, 5] as number[], // Mon-Fri
  bufferMinutes: 15,
  lunchStart: '11:30',
  lunchEnd: '13:00',
  avoidLunchHours: true,
  maxEventsPerStaffPerDay: 5,
} as const;

export const DEFAULT_SLOT_STEP_MINUTES = 15;
export const DEFAULT_MAX_SLOTS = 30;
export const DEFAULT_RESPONSE_DEADLINE_HOURS = 24;
export const DEFAULT_RESCHEDULE_WINDOW_DAYS = 7;
export const DEFAULT_MIN_RESCHEDULE_NOTICE_HOURS = 2;
export const AUTO_RESCHEDULE_LIMIT = 2;

// =============================================================================
// TIME UTILITIES
// =============================================================================

/**
 * Parse time string (HH:MM or HH:MM:SS) to total minutes from midnight
 * @param time - Time string in format "HH:MM" or "HH:MM:SS"
 * @returns Total minutes from midnight
 * @example parseTimeToMinutes("08:30") // returns 510
 * @example parseTimeToMinutes("14:00:30") // returns 840
 */
export function parseTimeToMinutes(time: string): number {
  const parts = time.split(':').map((value) => Number(value));
  const hour = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minute = Number.isFinite(parts[1]) ? parts[1] : 0;
  const second = Number.isFinite(parts[2]) ? parts[2] : 0;
  return hour * 60 + minute + Math.floor(second / 60);
}

/**
 * Add minutes to a Date object
 * @param date - Base date
 * @param minutes - Minutes to add (can be negative)
 * @returns New Date object
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Add days to a Date object
 * @param date - Base date
 * @param days - Days to add (can be negative)
 * @returns New Date object
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get start of day (00:00:00:000)
 * @param date - Input date
 * @returns New Date at start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day (23:59:59:999)
 * @param date - Input date
 * @returns New Date at end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Build Date from base date and time string
 * @param baseDate - Base date to use for year/month/day
 * @param time - Time string in format "HH:MM" or "HH:MM:SS"
 * @returns New Date with combined date and time
 */
export function buildDateTime(baseDate: Date, time: string): Date {
  const parts = time.split(':').map((value) => Number(value));
  const hour = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minute = Number.isFinite(parts[1]) ? parts[1] : 0;
  const second = Number.isFinite(parts[2]) ? parts[2] : 0;

  const result = new Date(baseDate);
  result.setHours(hour, minute, second, 0);
  return result;
}

/**
 * Calculate duration between two dates in minutes
 * @param start - Start date
 * @param end - End date
 * @returns Duration in minutes
 */
export function calculateDurationMinutes(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Align date to step boundary (round up)
 * @param date - Input date
 * @param stepMinutes - Step size in minutes
 * @returns Aligned date
 */
export function alignToStep(date: Date, stepMinutes: number): Date {
  const stepMs = stepMinutes * 60 * 1000;
  const aligned = Math.ceil(date.getTime() / stepMs) * stepMs;
  return new Date(aligned);
}

// =============================================================================
// RANGE UTILITIES
// =============================================================================

export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Check if two time ranges overlap
 * @param rangeA - First time range
 * @param rangeB - Second time range
 * @returns True if ranges overlap
 */
export function rangesOverlap(rangeA: TimeRange, rangeB: TimeRange): boolean {
  return rangeA.start < rangeB.end && rangeA.end > rangeB.start;
}

/**
 * Check if a time slot is within any of the given ranges
 * @param ranges - Array of time ranges
 * @param slotStart - Slot start time
 * @param slotEnd - Slot end time
 * @returns True if slot is fully within at least one range
 */
export function isWithinAnyRange(ranges: TimeRange[], slotStart: Date, slotEnd: Date): boolean {
  return ranges.some((range) => range.start <= slotStart && range.end >= slotEnd);
}

/**
 * Check if a time slot has overlap with any of the given ranges
 * @param ranges - Array of time ranges
 * @param slotStart - Slot start time
 * @param slotEnd - Slot end time
 * @returns True if slot overlaps with any range
 */
export function hasOverlapWithRanges(ranges: TimeRange[], slotStart: Date, slotEnd: Date): boolean {
  return ranges.some((range) => range.start < slotEnd && range.end > slotStart);
}

// =============================================================================
// LOCAL TIME UTILITIES
// =============================================================================

export interface LocalTimeInfo {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ...
  minutesOfDay: number; // 0-1439
}

/**
 * Get local time info for a date in a specific timezone
 * @param date - UTC date
 * @param timeZone - IANA timezone string (e.g., 'Asia/Ho_Chi_Minh')
 * @returns Local time info
 */
export function getLocalTimeInfo(date: Date, timeZone: string): LocalTimeInfo {
  const localized = new Date(date.toLocaleString('en-US', { timeZone }));
  return {
    dayOfWeek: localized.getDay(),
    minutesOfDay: localized.getHours() * 60 + localized.getMinutes(),
  };
}

/**
 * Build UTC date from local date and time in a timezone
 * @param localDate - Local date (used for year/month/day)
 * @param time - Time string in format "HH:MM" or "HH:MM:SS"
 * @param timeZone - IANA timezone string
 * @returns UTC Date
 */
export function buildUtcDateFromLocalTime(localDate: Date, time: string, timeZone: string): Date {
  const parts = time.split(':').map((value) => Number(value));
  const hour = Number.isFinite(parts[0]) ? parts[0] : 0;
  const minute = Number.isFinite(parts[1]) ? parts[1] : 0;
  const second = Number.isFinite(parts[2]) ? parts[2] : 0;

  const local = new Date(localDate);
  local.setHours(hour, minute, second, 0);
  const localized = new Date(local.toLocaleString('en-US', { timeZone }));
  const offset = local.getTime() - localized.getTime();
  return new Date(local.getTime() + offset);
}
