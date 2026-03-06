import type {
  RainfallEntry,
  DateRangeQuery,
  PeriodType,
  PeriodTotals,
  RollingAverage,
  DroughtReport,
  DroughtSeverity,
  RainfallIntensity,
  Millimeters,
  Days,
  RainfallLogger,
} from "./types.js";
import * as crypto from "crypto";

interface StoredEntry extends RainfallEntry {
  readonly id: string;
}

/**
 * In-memory rainfall data logger with analytics capabilities.
 * Implements the RainfallLogger interface for recording measurements,
 * calculating totals, rolling averages, and detecting drought conditions.
 */
export class RainGaugeLogger implements RainfallLogger {
  private readonly entries: StoredEntry[] = [];

  /**
   * Record a new rainfall measurement.
   * @param entry - The rainfall entry to record
   * @throws {RangeError} If amount is negative
   * @throws {Error} If timestamp is in the future
   */
  record(entry: RainfallEntry): void {
    if (entry.amount < 0) throw new RangeError("Rainfall amount cannot be negative");
    if (entry.timestamp.getTime() > Date.now()) throw new Error("Timestamp cannot be in the future");
    this.entries.push({ ...entry, id: crypto.randomUUID() });
  }

  /**
   * Calculate totals for specified periods.
   * @param query - Date range to aggregate
   * @param periodType - Type of period grouping
   * @returns Array of period totals, sorted chronologically
   */
  getTotals(query: DateRangeQuery, periodType: PeriodType): readonly PeriodTotals[] {
    const filtered = this.entries.filter(
      (e) => e.timestamp >= query.startDate && e.timestamp <= query.endDate
    );
    type GroupData = { total: Millimeters; count: number; intensities: RainfallIntensity[] };
    const groups = new Map<string, GroupData>();

    for (const entry of filtered) {
      const key = this.getPeriodKey(entry.timestamp, periodType);
      const curr = groups.get(key) ?? { total: 0 as Millimeters, count: 0, intensities: [] };
      groups.set(key, {
        total: (curr.total + entry.amount) as Millimeters,
        count: curr.count + 1,
        intensities: entry.intensity ? [...curr.intensities, entry.intensity] : curr.intensities,
      });
    }

    const results: PeriodTotals[] = [];
    for (const [period, data] of groups) {
      results.push({
        period,
        total: data.total,
        count: data.count,
        averageIntensity: this.averageIntensity(data.intensities),
      });
    }
    return results.sort((a, b) => a.period.localeCompare(b.period));
  }

  private getPeriodKey(date: Date, type: PeriodType): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    if (type === "daily") return `${y}-${m}-${d}`;
    if (type === "monthly") return `${y}-${m}`;

    // For weekly, use ISO week date calculation
    // Create a new Date object to avoid modifying the original
    const tempDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = tempDate.getUTCDay() || 7; // Make Sunday 7, not 0
    tempDate.setUTCDate(tempDate.getUTCDate() + 4 - dayNum); // Set to nearest Thursday
    const yearStart = new Date(Date.UTC(tempDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((tempDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const week = String(weekNumber).padStart(2, "0");
    return `${tempDate.getUTCFullYear()}-W${week}`;
  }

  private averageIntensity(arr: RainfallIntensity[]): RainfallIntensity | null {
    if (arr.length === 0) return null;
    const val: Record<RainfallIntensity, number> = { light: 1, moderate: 2, heavy: 3, violent: 4 };
    const avg = arr.reduce((s, i) => s + val[i], 0) / arr.length;
    if (avg <= 1.5) return "light";
    if (avg <= 2.5) return "moderate";
    if (avg <= 3.5) return "heavy";
    return "violent";
  }

  /**
   * Calculate rolling average over a window of days.
   * @param query - Date range for calculation
   * @param windowDays - Number of days in the rolling window
   * @returns Rolling average statistics
   * @throws {RangeError} If windowDays is less than 1
   */
  getRollingAverage(query: DateRangeQuery, windowDays: Days): RollingAverage {
    if (windowDays < 1) throw new RangeError("Window days must be at least 1");
    const msPerDay = 86400000; // Milliseconds in a day
    const windowEnd = query.endDate;
    const windowStart = new Date(windowEnd.getTime() - (windowDays - 1) * msPerDay);

    // Ensure the effective start date is not before the query's start date
    const effectiveWindowStart = windowStart < query.startDate ? query.startDate : windowStart;

    const total = this.entries
      .filter((e) => e.timestamp >= effectiveWindowStart && e.timestamp <= windowEnd)
      .reduce((s, e) => s + e.amount, 0) as Millimeters;

    return {
      windowDays,
      averagePerDay: (total / windowDays) as Millimeters,
      windowStart: effectiveWindowStart,
      windowEnd,
    };
  }

  /**
   * Detect drought conditions in the specified period.
   * @param query - Date range to analyze
   * @param thresholdDays - Number of dry days to trigger drought condition
   * @returns Drought analysis report
   * @throws {RangeError} If thresholdDays is less than 1
   */
  detectDrought(query: DateRangeQuery, thresholdDays: Days): DroughtReport {
    if (thresholdDays < 1) throw new RangeError("Threshold days must be at least 1");

    const dailyRainfall = new Map<string, Millimeters>(); // Map<"YYYY-MM-DD", totalRainfall>
    for (const e of this.entries) {
      if (e.timestamp < query.startDate || e.timestamp > query.endDate) continue;
      const dateKey = e.timestamp.toISOString().slice(0, 10);
      dailyRainfall.set(dateKey, (dailyRainfall.get(dateKey) ?? 0) + e.amount as Millimeters);
    }

    let currentDryStreak = 0;
    let maxDryStreak = 0;
    let currentStreakStartDate: Date | null = null;
    let maxStreakStartDate: Date | null = null;

    const currentDate = new Date(query.startDate);
    while (currentDate <= query.endDate) {
      const dateKey = currentDate.toISOString().slice(0, 10);
      const rainfallToday = dailyRainfall.get(dateKey) ?? (0 as Millimeters);

      if (rainfallToday <= 0.2) { // Consider it a dry day (0.2mm or less)
        if (currentDryStreak === 0) {
          currentStreakStartDate = new Date(currentDate); // Start of a new dry streak
        }
        currentDryStreak++;
        if (currentDryStreak > maxDryStreak) {
          maxDryStreak = currentDryStreak;
          maxStreakStartDate = currentStreakStartDate;
        }
      } else {
        // Rainfall detected, reset streak
        currentDryStreak = 0;
        currentStreakStartDate = null;
      }
      currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
    }

    const isDrought = maxDryStreak >= thresholdDays;
    let severity: DroughtSeverity = "none";
    if (isDrought) {
      if (maxDryStreak >= thresholdDays * 3) {
        severity = "severe";
      } else if (maxDryStreak >= thresholdDays * 2) {
        severity = "moderate";
      } else {
        severity = "mild";
      }
    }

    return {
      isDrought,
      consecutiveDryDays: maxDryStreak as Days,
      droughtStartDate: isDrought ? maxStreakStartDate : null,
      severity,
      droughtThreshold: thresholdDays,
    };
  }

  /**
   * Classify rainfall intensity based on rate.
   * @param amount - Rainfall amount in millimeters
   * @param durationHours - Duration of the rainfall event in hours
   * @returns Intensity classification
   * @throws {RangeError} If amount is negative or durationHours is not positive
   */
  classifyIntensity(amount: Millimeters, durationHours: number): RainfallIntensity {
    if (amount < 0) throw new RangeError("Amount cannot be negative");
    if (durationHours <= 0) throw new RangeError("Duration must be positive");
    const rate = amount / durationHours;
    if (rate < 2.5) return "light";
    if (rate < 7.6) return "moderate";
    if (rate < 50) return "heavy";
    return "violent";
  }
}