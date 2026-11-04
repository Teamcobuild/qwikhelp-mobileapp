// All QwikHelp dates and times are Nigerian time (WAT, UTC+1, no daylight saving), whatever timezone the
// phone is set to. Customer and provider must see the same wall-clock time for a job, and emulators /
// misconfigured phones are often on UTC. Because WAT is a fixed offset, no timezone library is needed:
// we shift by one hour and read UTC fields.

const WAT_OFFSET_MS = 60 * 60 * 1000;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const MONTH_NAMES = MONTHS;
export const WEEKDAY_SHORT = WEEKDAYS.map((d) => d.slice(0, 3));

// A calendar day with no time or timezone attached. month is 1–12.
export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

interface WatParts extends CalendarDay {
  hour: number;
  minute: number;
  weekday: number;
}

const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));

// Wall-clock parts of an instant in Nigeria.
export function watParts(value: Date | string | number): WatParts {
  const d = new Date(toDate(value).getTime() + WAT_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    weekday: d.getUTCDay(),
  };
}

// The instant for a Nigerian wall-clock time.
export const fromWat = (day: CalendarDay, hour = 0, minute = 0) =>
  new Date(Date.UTC(day.year, day.month - 1, day.day, hour, minute) - WAT_OFFSET_MS);

export const todayWat = (): CalendarDay => {
  const { year, month, day } = watParts(new Date());
  return { year, month, day };
};

export const toCalendarDay = (value: Date | string | number): CalendarDay => {
  const { year, month, day } = watParts(value);
  return { year, month, day };
};

// Day arithmetic in pure calendar terms (no DST, no timezone).
export const addDays = (d: CalendarDay, n: number): CalendarDay => {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
};
export const compareDays = (a: CalendarDay, b: CalendarDay) =>
  a.year - b.year || a.month - b.month || a.day - b.day;
export const sameDay = (a?: CalendarDay | null, b?: CalendarDay | null) => !!a && !!b && compareDays(a, b) === 0;
export const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
export const weekdayOf = (d: CalendarDay) => new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
// Keeps the day-of-month when jumping months/years, clamped (31 Jan → 28/29 Feb).
export const withMonth = (d: CalendarDay, year: number, month: number): CalendarDay => ({
  year,
  month,
  day: Math.min(d.day, daysInMonth(year, month)),
});

// ---------------------------------------------------------------------------
// Formatting (Nigerian convention: day before month, 12-hour clock)

const pad = (n: number) => String(n).padStart(2, '0');

const clock = (hour: number, minute: number) => `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`;

// "9:30 AM"
export const formatTime = (value: Date | string | number) => {
  const p = watParts(value);
  return clock(p.hour, p.minute);
};

// "Tue, 4 Nov"
export const formatShortDate = (value: Date | string | number) => {
  const p = watParts(value);
  return `${WEEKDAYS[p.weekday].slice(0, 3)}, ${p.day} ${MONTHS[p.month - 1].slice(0, 3)}`;
};

// "Tuesday, 4 November 2026"
export const formatDay = (d: CalendarDay) =>
  `${WEEKDAYS[weekdayOf(d)]}, ${d.day} ${MONTHS[d.month - 1]} ${d.year}`;

// "Tue, 4 Nov 2026"
export const formatDayShort = (d: CalendarDay) =>
  `${WEEKDAYS[weekdayOf(d)].slice(0, 3)}, ${d.day} ${MONTHS[d.month - 1].slice(0, 3)} ${d.year}`;

// Chat-list style: time today, "Yesterday", else "4 Nov".
export const formatRelativeShort = (value: Date | string | number) => {
  const d = toCalendarDay(value);
  const today = todayWat();
  if (sameDay(d, today)) return formatTime(value);
  if (sameDay(d, addDays(today, -1))) return 'Yesterday';
  return `${d.day} ${MONTHS[d.month - 1].slice(0, 3)}${d.year === today.year ? '' : ` ${d.year}`}`;
};

// ---------------------------------------------------------------------------
// Date of birth ("DD / MM / YYYY" in the UI, "YYYY-MM-DD" in the database)

export const formatDob = (d: CalendarDay) => `${pad(d.day)} / ${pad(d.month)} / ${d.year}`;
export const dayToIso = (d: CalendarDay) => `${d.year}-${pad(d.month)}-${pad(d.day)}`;
export const isoToDay = (iso: string): CalendarDay | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? { year: +m[1], month: +m[2], day: +m[3] } : null;
};
export const dobToDay = (dob: string): CalendarDay | null => {
  const [d, m, y] = dob.split('/').map((s) => parseInt(s.trim(), 10));
  return d && m && y ? { year: y, month: m, day: d } : null;
};

// ---------------------------------------------------------------------------
// Booking time slots

export const BOOKING = {
  firstHour: 8, // 8:00 AM
  lastHour: 20, // last slot 8:00 PM
  stepMinutes: 30,
  leadMinutes: 60, // earliest bookable slot is at least this far from now
  maxDaysAhead: 30, // matches create_job() on the server
};

export interface TimeSlot {
  at: Date;
  label: string;
  available: boolean;
}

export function bookingSlots(day: CalendarDay, now = new Date()): TimeSlot[] {
  const earliest = now.getTime() + BOOKING.leadMinutes * 60 * 1000;
  const slots: TimeSlot[] = [];
  for (let h = BOOKING.firstHour; h <= BOOKING.lastHour; h++) {
    for (let m = 0; m < 60; m += BOOKING.stepMinutes) {
      if (h === BOOKING.lastHour && m > 0) break;
      const at = fromWat(day, h, m);
      slots.push({ at, label: clock(h, m), available: at.getTime() >= earliest });
    }
  }
  return slots;
}

// First day that still has a bookable slot (today, or tomorrow if today is over).
export const firstBookableDay = (now = new Date()): CalendarDay => {
  const today = todayWat();
  return bookingSlots(today, now).some((s) => s.available) ? today : addDays(today, 1);
};
