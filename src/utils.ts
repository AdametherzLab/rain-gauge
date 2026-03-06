import type { 
  Millimeters, 
  Days, 
  RainfallIntensity, 
  PeriodType, 
  RainfallEntry, 
  PeriodTotals, 
  RollingAverage, 
  DroughtReport,
  DroughtSeverity
} from './types.js';

const MS_PER_DAY: number = 86400000;
const TRACE_RAINFALL: Millimeters = 0.2 as Millimeters;

/**
 * Generates a daily key string (YYYY-MM-DD) from a Date object.
 * @param d - The Date object.
 * @returns A string representing the date in YYYY-MM-DD format.
 */
function dateKey(d: Date): string { 
  return d.toISOString().split('T')[0]; 
}

/**
 * Generates a weekly key string (YYYY-WNN) from a Date object.
 * Week starts on Monday.
 * @param d - The Date object.
 * @returns A string representing the week in YYYY-WNN format.
 */
function weekKey(d: Date): string {
  const date = new Date(d.getTime()); // Create a mutable copy
  date.setUTCHours(0, 0, 0, 0); // Normalize to start of day UTC

  // Set to nearest Thursday: current date + 4 - current day number
  // (Sunday=0, Monday=1, ..., Saturday=6)
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));

  // Get first day of year
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));

  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7);

  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/**
 * Generates a period key based on the date and period type.
 * @param d - The Date object.
 * @param t - The type of period ('daily', 'weekly', 'monthly').
 * @returns A string representing the period key.
 */
function getPeriodKey(d: Date, t: PeriodType): string {
  if (t === 'daily') return dateKey(d);
  if (t === 'weekly') return weekKey(d);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Finds the mode (most frequent) rainfall intensity in an array.
 * @param arr - An array of RainfallIntensity values.
 * @returns The most frequent RainfallIntensity, or null if the array is empty.
 */
function modeIntensity(arr: readonly RainfallIntensity[]): RainfallIntensity | null {
  if (!arr.length) return null;
  const counts = new Map<RainfallIntensity, number>();
  let max = 0;
  let mode: RainfallIntensity | null = null;
  for (const x of arr) {
    const c = (counts.get(x) ?? 0) + 1;
    counts.set(x, c);
    if (c > max) { 
      max = c; 
      mode = x; 
    }
  }
  return mode;
}

/**
 * Aggregates rainfall entries into daily, weekly, or monthly totals.
 * @param entries - Rainfall measurements to aggregate.
 * @param periodType - Time bucket type ('daily', 'weekly', 'monthly').
 * @returns Array of period totals sorted chronologically.
 * @throws {Error} If entries is empty or contains invalid timestamps.
 * @example
 * const totals = calculateTotals(entries, 'weekly');
 */
export function calculateTotals(
  entries: readonly RainfallEntry[],
  periodType: PeriodType
): readonly PeriodTotals[] {
  if (!entries.length) {
    throw new Error('Cannot calculate totals: no entries provided');
  }
  
  const groups = new Map<string, { total: Millimeters; count: number; intensities: RainfallIntensity[] }>();
  
  for (const e of entries) {
    if (!(e.timestamp instanceof Date) || isNaN(e.timestamp.getTime())) {
      throw new Error(`Invalid timestamp: ${e.timestamp}`);
    }
    const key = getPeriodKey(e.timestamp, periodType);
    const g = groups.get(key) ?? { total: 0 as Millimeters, count: 0, intensities: [] };
    g.total = (g.total + e.amount) as Millimeters;
    g.count++;
    if (e.intensity) {
      g.intensities.push(e.intensity);
    }
    groups.set(key, g);
  }
  
  const results: PeriodTotals[] = [];
  for (const [period, d] of groups) {
    results.push({
      period,
      total: d.total,
      count: d.count,
      averageIntensity: modeIntensity(d.intensities)
    });
  }
  
  return results.sort((a, b) => a.period.localeCompare(b.period));
}

/**
 * Computes a rolling average rainfall over a specified window of days.
 * @param entries - Rainfall measurements (chronological order not required).
 * @param windowDays - Number of days in the rolling window.
 * @returns Rolling average statistics for the most recent window.
 * @throws {RangeError} If windowDays is less than 1.
 * @throws {Error} If insufficient data for the requested window.
 * @example
 * const avg = calculateRollingAverage(entries, 7 as Days);
 */
export function calculateRollingAverage(
  entries: readonly RainfallEntry[],
  windowDays: Days
): RollingAverage {
  if (windowDays < 1) {
    throw new RangeError('Window days must be at least 1');
  }
  if (!entries.length) {
    throw new Error('Cannot calculate average: no entries provided');
  }
  
  const daily = new Map<string, Millimeters>();
  for (const e of entries) {
    // Ensure timestamp is valid before using
    if (!(e.timestamp instanceof Date) || isNaN(e.timestamp.getTime())) {
      throw new Error(`Invalid timestamp in entries for rolling average: ${e.timestamp}`);
    }
    const k = dateKey(e.timestamp);
    daily.set(k, (daily.get(k) ?? 0) + e.amount as Millimeters);
  }
  
  const dates = Array.from(daily.keys()).sort();
  if (dates.length < windowDays) {
    throw new Error(`Insufficient data: need ${windowDays} days but have ${dates.length}`);
  }
  
  // Take the last `windowDays` dates for the rolling average
  const windowDates = dates.slice(-windowDays);
  const total = windowDates.reduce((s, d) => s + (daily.get(d) ?? 0), 0 as Millimeters);
  
  return {
    windowDays,
    averagePerDay: (total / windowDays) as Millimeters,
    windowStart: new Date(windowDates[0]),
    windowEnd: new Date(windowDates[windowDates.length - 1])
  };
}

/**
 * Classifies rainfall intensity based on meteorological rate thresholds.
 * Standard thresholds: Light < 2.5mm/h, Moderate 2.5-7.6mm/h, Heavy >7.6mm/h, Violent >50mm/h.
 * @param amount - Total rainfall amount in millimeters.
 * @param durationHours - Duration of the rainfall event in hours.
 * @returns Intensity classification based on calculated rate.
 * @throws {RangeError} If amount is negative or durationHours is not positive.
 * @example
 * const intensity = classifyIntensity(15 as Millimeters, 3);
 */
export function classifyIntensity(
  amount: Millimeters,
  durationHours: number
): RainfallIntensity {
  if (amount < 0) {
    throw new RangeError('Rainfall amount cannot be negative');
  }
  if (durationHours <= 0) {
    throw new RangeError('Duration must be greater than 0 hours');
  }
  
  const rate = amount / durationHours;
  if (rate < 2.5) return 'light';
  if (rate <= 7.6) return 'moderate';
  if (rate <= 50) return 'heavy';
  return 'violent';
}

/**
 * Detects drought conditions by analyzing consecutive dry days (≤0.2mm).
 * @param entries - Rainfall measurements to analyze.
 * @param thresholdDays - Number of consecutive dry days to constitute drought.
 * @returns Drought report with severity classification.
 * @throws {RangeError} If thresholdDays is less than 1.
 * @throws {Error} If entries array is empty.
 * @example
 * const report = detectDrought(entries, 15 as Days);
 */
export function detectDrought(
  entries: readonly RainfallEntry[],
  thresholdDays: Days
): DroughtReport {
  if (thresholdDays < 1) {
    throw new RangeError('Threshold days must be at least 1');
  }
  if (!entries.length) {
    throw new Error('Cannot detect drought: no entries provided');
  }
  
  const daily = new Map<string, Millimeters>();
  for (const e of entries) {
    // Ensure timestamp is valid before using
    if (!(e.timestamp instanceof Date) || isNaN(e.timestamp.getTime())) {
      throw new Error(`Invalid timestamp in entries for drought detection: ${e.timestamp}`);
    }
    const k = dateKey(e.timestamp);
    daily.set(k, (daily.get(k) ?? 0) + e.amount as Millimeters);
  }
  
  const dates = Array.from(daily.keys()).sort();
  let currentStreak = 0;
  let maxStreak = 0;
  let droughtStart: Date | null = null;
  let currentStreakStartDate: Date | null = null;
  
  for (let i = 0; i < dates.length; i++) {
    const d = dates[i];
    const amount = daily.get(d) ?? 0 as Millimeters;
    if (amount <= TRACE_RAINFALL) {
      if (currentStreak === 0) {
        currentStreakStartDate = new Date(d);
      }
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
        droughtStart = currentStreakStartDate;
      }
    } else {
      currentStreak = 0;
      currentStreakStartDate = null;
    }
  }
  
  const isDrought = maxStreak >= thresholdDays;
  let severity: DroughtSeverity = 'none';

  if (isDrought) {
    if (maxStreak >= thresholdDays * 2) { // Example: twice the threshold for severe
      severity = 'severe';
    } else if (maxStreak >= thresholdDays * 1.5) { // Example: 1.5 times for moderate
      severity = 'moderate';
    } else {
      severity = 'mild';
    }
  }
  
  return {
    isDrought,
    consecutiveDryDays: maxStreak as Days,
    droughtStartDate: droughtStart,
    severity,
    droughtThreshold: thresholdDays
  };
}