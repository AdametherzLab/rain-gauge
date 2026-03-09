import type {
  RainfallEntry,
  DateRangeQuery,
  PeriodType,
  PeriodTotals,
  RollingAverage,
  DroughtReport,
  RainfallIntensity,
  Millimeters,
  Days,
  RainfallLogger,
} from "./types.js";
import type { RainfallStore } from "./store.js";
import { calculateRollingAverage, classifyIntensity, detectDrought, calculateTotals } from "./utils.js";
import * as crypto from "crypto";

interface StoredEntry extends RainfallEntry {
  readonly id: string;
}

/**
 * Options for creating a RainGaugeLogger instance.
 */
export interface RainGaugeLoggerOptions {
  /** Optional persistence store. When provided, entries are automatically persisted. */
  readonly store?: RainfallStore;
  /** If true and a store is provided, load existing data on construction. Defaults to true. */
  readonly autoLoad?: boolean;
}

/**
 * In-memory rainfall data logger with analytics capabilities and optional persistence.
 * Implements the RainfallLogger interface for recording measurements,
 * calculating totals, rolling averages, and detecting drought conditions.
 *
 * @example
 * // In-memory only (original behavior)
 * const logger = new RainGaugeLogger();
 *
 * @example
 * // With file persistence
 * import { FileStore } from '@adametherzlab/rain-gauge';
 * const logger = new RainGaugeLogger({ store: new FileStore('./data.json') });
 *
 * @example
 * // With SQLite persistence
 * import { SqliteStore } from '@adametherzlab/rain-gauge';
 * const logger = new RainGaugeLogger({ store: new SqliteStore('./rain.db') });
 */
export class RainGaugeLogger implements RainfallLogger {
  private readonly entries: StoredEntry[] = [];
  private readonly store?: RainfallStore;

  constructor(options?: RainGaugeLoggerOptions) {
    this.store = options?.store;
    const autoLoad = options?.autoLoad ?? true;
    if (this.store && autoLoad) {
      const loaded = this.store.loadAll();
      for (const entry of loaded) {
        this.entries.push({ ...entry, id: crypto.randomUUID() });
      }
    }
  }

  /**
   * Record a new rainfall measurement.
   * If a store is configured, the entry is also persisted immediately.
   * @param entry - The rainfall entry to record
   * @throws {RangeError} If amount is negative
   * @throws {Error} If timestamp is in the future
   */
  record(entry: RainfallEntry): void {
    if (entry.amount < 0) throw new RangeError("Rainfall amount cannot be negative");
    if (entry.timestamp.getTime() > Date.now()) throw new Error("Timestamp cannot be in the future");
    this.entries.push({ ...entry, id: crypto.randomUUID() });
    if (this.store) {
      this.store.append(entry);
    }
  }

  /**
   * Get the number of recorded entries.
   * @returns The total count of stored rainfall entries.
   */
  get size(): number {
    return this.entries.length;
  }

  /**
   * Clear all recorded entries.
   * If a store is configured, persisted data is also cleared.
   */
  clear(): void {
    this.entries.length = 0;
    if (this.store) {
      this.store.clear();
    }
  }

  /**
   * Save all in-memory entries to the configured store.
   * Useful for manual save operations or when autoLoad is disabled.
   * @throws {Error} If no store is configured.
   */
  save(): void {
    if (!this.store) {
      throw new Error("No persistence store configured. Pass a store in the constructor options.");
    }
    this.store.saveAll(this.entries);
  }

  /**
   * Load entries from the configured store, replacing in-memory data.
   * @throws {Error} If no store is configured.
   */
  load(): void {
    if (!this.store) {
      throw new Error("No persistence store configured. Pass a store in the constructor options.");
    }
    this.entries.length = 0;
    const loaded = this.store.loadAll();
    for (const entry of loaded) {
      this.entries.push({ ...entry, id: crypto.randomUUID() });
    }
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
