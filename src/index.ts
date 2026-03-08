/**
 * rain-gauge — Type-safe rainfall measurement logger with drought detection
 * and temporal analytics.
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

// Logger implementation
export { RainGaugeLogger } from "./logger.js";

// Utility functions
export {
  calculateTotals,
  calculateRollingAverage,
  classifyIntensity,
  detectDrought,
} from "./utils.js";
