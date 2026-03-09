/**
 * rain-gauge — Type-safe rainfall measurement logger with drought detection,
 * temporal analytics, and optional persistence (file/SQLite).
 * @packageDocumentation
 */

// Type definitions
export type {
  Millimeters,
  Days,
  RainfallIntensity,
  PeriodType,
  DroughtSeverity,
  RainfallEntry,
  DateRangeQuery,
  PeriodTotals,
  RollingAverage,
  DroughtReport,
  RainfallLogger,
} from "./types.js";

// Persistence
export type { RainfallStore, SerializedEntry } from "./store.js";
export { FileStore, SqliteStore } from "./store.js";

// Logger implementation
export { RainGaugeLogger } from "./logger.js";
export type { RainGaugeLoggerOptions } from "./logger.js";

// Utility functions
export {
  calculateTotals,
  calculateRollingAverage,
  classifyIntensity,
  detectDrought,
} from "./utils.js";
