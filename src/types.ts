/**
 * Branded type for rainfall measurements in millimeters.
 * Prevents accidental mixing with other numeric values.
 */
export type Millimeters = number & { readonly __brand: 'Millimeters' };

/**
 * Branded type for duration in days.
 */
export type Days = number & { readonly __brand: 'Days' };

/**
 * Classification of rainfall intensity based on meteorological standards.
 * - light: < 2.5 mm/hour
 * - moderate: 2.5 - 7.6 mm/hour
 * - heavy: 7.6 - 50 mm/hour
 * - violent: > 50 mm/hour
 */
export type RainfallIntensity = 'light' | 'moderate' | 'heavy' | 'violent';

/**
 * Period granularity for aggregation queries.
 */
export type PeriodType = 'daily' | 'weekly' | 'monthly';

/**
 * Drought severity levels.
 */
export type DroughtSeverity = 'none' | 'mild' | 'moderate' | 'severe';

/**
 * Timestamped rainfall measurement entry.
 */
export interface RainfallEntry {
  /** ISO 8601 timestamp of the measurement */
  readonly timestamp: Date;
  /** Amount of rainfall in millimeters */
  readonly amount: Millimeters;
  /** Optional intensity classification at time of measurement */
  readonly intensity?: RainfallIntensity;
}

/**
 * Parameters for querying rainfall data within a date range.
 */
export interface DateRangeQuery {
  /** Start of the date range (inclusive) */
  readonly startDate: Date;
  /** End of the date range (inclusive) */
  readonly endDate: Date;
}

/**
 * Aggregation totals for a specific time period.
 */
export interface PeriodTotals {
  /** The period identifier (e.g., "2024-01-15" for daily, "2024-W03" for weekly) */
  readonly period: string;
  /** Total rainfall for the period in millimeters */
  readonly total: Millimeters;
  /** Number of measurements in the period */
  readonly count: number;
  /** Average intensity for the period, null if no intensity data available */
  readonly averageIntensity: RainfallIntensity | null;
}

/**
 * Rolling average calculation result.
 */
export interface RollingAverage {
  /** The window size in days */
  readonly windowDays: Days;
  /** Calculated average rainfall per day over the window */
  readonly averagePerDay: Millimeters;
  /** Start date of the rolling window */
  readonly windowStart: Date;
  /** End date of the rolling window */
  readonly windowEnd: Date;
}

/**
 * Drought condition report.
 */
export interface DroughtReport {
  /** Whether a drought condition is currently detected */
  readonly isDrought: boolean;
  /** Number of consecutive days without significant rainfall (> 0.2mm) */
  readonly consecutiveDryDays: Days;
  /** Date when the current dry period started, null if not in drought */
  readonly droughtStartDate: Date | null;
  /** Severity classification of the drought */
  readonly severity: DroughtSeverity;
  /** Threshold used to determine drought condition */
  readonly droughtThreshold: Days;
}

/**
 * Interface for the rainfall logger implementation.
 * Defines the contract for recording and querying precipitation data.
 */
export interface RainfallLogger {
  /**
   * Record a new rainfall measurement.
   * @param entry - The rainfall entry to record
   * @throws {RangeError} If amount is negative
   * @throws {Error} If timestamp is in the future
   */
  record(entry: RainfallEntry): void;

  /**
   * Calculate totals for specified periods.
   * @param query - Date range to aggregate
   * @param periodType - Type of period grouping
   * @returns Array of period totals, sorted chronologically
   */
  getTotals(query: DateRangeQuery, periodType: PeriodType): readonly PeriodTotals[];

  /**
   * Calculate rolling average over a window of days.
   * @param query - Date range for calculation
   * @param windowDays - Number of days in the rolling window
   * @returns Rolling average statistics
   * @throws {RangeError} If windowDays is less than 1
   */
  getRollingAverage(query: DateRangeQuery, windowDays: Days): RollingAverage;

  /**
   * Detect drought conditions in the specified period.
   * @param query - Date range to analyze
   * @param thresholdDays - Number of dry days to trigger drought condition
   * @returns Drought analysis report
   * @throws {RangeError} If thresholdDays is less than 1
   */
  detectDrought(query: DateRangeQuery, thresholdDays: Days): DroughtReport;

  /**
   * Classify rainfall intensity based on rate.
   * @param amount - Rainfall amount in millimeters
   * @param durationHours - Duration of the rainfall event in hours
   * @returns Intensity classification
   * @throws {RangeError} If amount or durationHours is negative
   */
  classifyIntensity(amount: Millimeters, durationHours: number): RainfallIntensity;
}
