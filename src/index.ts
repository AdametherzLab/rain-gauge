/**
 * Public API barrel file for rain-gauge.
 * Re-exports all types and functions from the internal modules.
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