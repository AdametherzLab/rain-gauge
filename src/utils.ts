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
  const date = new Date(d.getTime());
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
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
 * Validates that a value is a valid Date object.
 * @param d - The value to validate.
 * @returns True if the value is a valid Date.
 */
function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN((d as Date).getTime());
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
    if (!isValidDate(e.timestamp)) {
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
    if (!isValidDate(e.timestamp)) {
      throw new Error(`Invalid timestamp in entries for rolling average: ${e.timestamp}`);
    }
    const k = dateKey(e.timestamp);
    daily.set(k, ((daily.get(k) ?? 0) + e.amount) as Millimeters);
  }
  
  const dates = Array.from(daily.keys()).sort();

  if (dates.length === 0) {
    const now = new Date();
    return {
      windowDays,
      averagePerDay: 0 as Millimeters,
      windowStart: new Date(now.getTime() - (windowDays - 1) * MS_PER_DAY),
      windowEnd: now
    };
  }

  let windowStartIdx = 0;
  const windowEndIdx = dates.length - 1;

  if (dates.length > windowDays) {
    windowStartIdx = dates.length - windowDays;
  }

  const effectiveWindowDates = dates.slice(windowStartIdx, windowEndIdx + 1);
  const actualWindowDays = effectiveWindowDates.length as Days;

  if (actualWindowDays === 0) {
    const now = new Date();
    return {
      windowDays,
      averagePerDay: 0 as Millimeters,
      windowStart: new Date(now.getTime() - (windowDays - 1) * MS_PER_DAY),
      windowEnd: now
    };
  }

  const total = effectiveWindowDates.reduce((s, d) => s + (daily.get(d) ?? 0), 0);
  
  return {
    windowDays: actualWindowDays,
    averagePerDay: (total / actualWindowDays) as Millimeters,
    windowStart: new Date(effectiveWindowDates[0]),
    windowEnd: new Date(effectiveWindowDates[effectiveWindowDates.length - 1])
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
 * Detects drought conditions based on consecutive dry days.
 * A day is considered 'dry' if rainfall is less than or equal to TRACE_RAINFALL (0.2mm).
 * @param entries - Rainfall measurements to analyze.
 * @param thresholdDays - The number of consecutive dry days to qualify as a drought.
 * @returns A DroughtReport object.
 * @throws {RangeError} If thresholdDays is less than 1.
 * @example
 * const report = detectDrought(entries, 5 as Days);
 */
export function detectDrought(
  entries: readonly RainfallEntry[],
  thresholdDays: Days
): DroughtReport {
  if (thresholdDays < 1) {
    throw new RangeError('Threshold days must be at least 1');
  }
  
  if (!entries.length) {
    return {
      isDrought: false,
      consecutiveDryDays: 0 as Days,
      droughtStartDate: null,
      severity: 'none',
      droughtThreshold: thresholdDays,
    };
  }

  const dailyRainfall = new Map<string, Millimeters>();
  for (const e of entries) {
    if (!isValidDate(e.timestamp)) {
      continue;
    }
    const k = dateKey(e.timestamp);
    dailyRainfall.set(k, ((dailyRainfall.get(k) ?? 0) + e.amount) as Millimeters);
  }

  const sortedDates = Array.from(dailyRainfall.keys()).sort();
  if (sortedDates.length === 0) {
    return {
      isDrought: false,
      consecutiveDryDays: 0 as Days,
      droughtStartDate: null,
      severity: 'none',
      droughtThreshold: thresholdDays,
    };
  }

  let maxDryStreak = 0;
  let currentDryStreak = 0;
  let droughtStartDate: Date | null = null;
  let currentStreakStartDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const rainfall = dailyRainfall.get(dateStr) ?? (0 as Millimeters);

    if (rainfall <= TRACE_RAINFALL) {
      if (currentDryStreak === 0) {
        currentStreakStartDate = new Date(dateStr);
      }
      currentDryStreak++;
    } else {
      currentDryStreak = 0;
      currentStreakStartDate = null;
    }

    if (currentDryStreak > maxDryStreak) {
      maxDryStreak = currentDryStreak;
      droughtStartDate = currentStreakStartDate;
    }
  }

  const isDrought = maxDryStreak >= thresholdDays;
  let severity: DroughtSeverity = 'none';

  if (isDrought) {
    if (maxDryStreak >= thresholdDays * 3) {
      severity = 'severe';
    } else if (maxDryStreak >= thresholdDays * 2) {
      severity = 'moderate';
    } else {
      severity = 'mild';
    }
  }

  return {
    isDrought,
    consecutiveDryDays: maxDryStreak as Days,
    droughtStartDate,
    severity,
    droughtThreshold: thresholdDays,
  };
}
