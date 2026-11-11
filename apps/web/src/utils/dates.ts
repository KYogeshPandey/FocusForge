import {
  format,
  parseISO,
  isBefore,
  startOfDay,
  endOfDay,
  subDays,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
} from 'date-fns';

/**
 * Returns today's date formatted as YYYY-MM-DD in local time
 */
export function getTodayDateString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Formats a Date object or ISO string to YYYY-MM-DD
 */
export function toDateString(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'yyyy-MM-dd');
}

/**
 * Formats date for human display e.g. "Oct 27, 2026" or "Tomorrow"
 */
export function formatDisplayDate(dateInput?: string | Date | null): string {
  if (!dateInput) return 'No due date';
  const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
  const today = new Date();
  
  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, addDays(today, 1))) return 'Tomorrow';
  if (isSameDay(date, subDays(today, 1))) return 'Yesterday';
  
  return format(date, 'MMM d, yyyy');
}

/**
 * Formats minutes into human-readable e.g. "2h 15m" or "45m"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

/**
 * Formats seconds into MM:SS for countdown timer
 */
export function formatSeconds(seconds: number): string {
  const clamped = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Checks if a task is overdue (due date before today and not completed)
 */
export function isOverdue(dueDateStr?: string | null, isDone: boolean = false): boolean {
  if (!dueDateStr || isDone) return false;
  const dueDate = startOfDay(parseISO(dueDateStr));
  const today = startOfDay(new Date());
  return isBefore(dueDate, today);
}

/**
 * Checks if a date string is today
 */
export function isDateToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  return dateStr === getTodayDateString();
}

/**
 * Gets days of the current week (either starting on Monday or Sunday)
 */
export function getDaysOfWeek(referenceDate: Date = new Date(), weekStartsOnMonday: boolean = true): Date[] {
  const start = startOfWeek(referenceDate, { weekStartsOn: weekStartsOnMonday ? 1 : 0 });
  const end = endOfWeek(referenceDate, { weekStartsOn: weekStartsOnMonday ? 1 : 0 });
  return eachDayOfInterval({ start, end });
}

/**
 * Returns date strings for past N days ending at reference date (inclusive)
 */
export function getPastDateStrings(daysCount: number, referenceDate: Date = new Date()): string[] {
  const dates: string[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    dates.push(format(subDays(referenceDate, i), 'yyyy-MM-dd'));
  }
  return dates;
}

/**
 * Returns start and end timestamps for the current week
 */
export function getWeekDateRange(referenceDate: Date = new Date(), weekStartsOnMonday: boolean = true) {
  const start = startOfWeek(referenceDate, { weekStartsOn: weekStartsOnMonday ? 1 : 0 });
  const end = endOfWeek(referenceDate, { weekStartsOn: weekStartsOnMonday ? 1 : 0 });
  return {
    startDate: startOfDay(start),
    endDate: endOfDay(end),
    startDateStr: format(start, 'yyyy-MM-dd'),
    endDateStr: format(end, 'yyyy-MM-dd'),
  };
}
