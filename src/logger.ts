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
import { calculateRollingAverage, classifyIntensity, detectDrought, calculateTotals } from "./utils.js";
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
    const filteredEntries = this.entries.filter(
      (e) => e.timestamp >= query.startDate && e.timestamp <= query.endDate
    );
    return calculateTotals(filteredEntries, periodType);
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
    const filteredEntries = this.entries.filter(
      (e) => e.timestamp >= query.startDate && e.timestamp <= query.endDate
    );
    return calculateRollingAverage(filteredEntries, windowDays);
  }

  /**
   * Detect drought conditions in the specified period.
   * @param query - Date range to analyze
   * @param thresholdDays - Number of dry days to trigger drought condition
   * @returns Drought analysis report
   * @throws {RangeError} If thresholdDays is less than 1
   */
  detectDrought(query: DateRangeQuery, thresholdDays: Days): DroughtReport {
    const filteredEntries = this.entries.filter(
      (e) => e.timestamp >= query.startDate && e.timestamp <= query.endDate
    );
    return detectDrought(filteredEntries, thresholdDays);
  }

  /**
   * Classify rainfall intensity based on rate.
   * @param amount - Rainfall amount in millimeters
   * @param durationHours - Duration of the rainfall event in hours
   * @returns Intensity classification
   */
  classifyIntensity(amount: Millimeters, durationHours: number): RainfallIntensity {
    return classifyIntensity(amount, durationHours);
  }
}
