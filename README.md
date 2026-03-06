[![CI](https://github.com/AdametherzLab/rain-gauge/actions/workflows/ci.yml/badge.svg)](https://github.com/AdametherzLab/rain-gauge/actions) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# 🌧️ rain-gauge

## ✨ Features

- ✅ **Type-safe measurements** — Branded `Millimeters` and `Days` types prevent unit mix-ups at compile time
- ✅ **Drought intelligence** — Detect dry spells with configurable severity thresholds (mild to severe)
- ✅ **Temporal analytics** — Calculate daily, weekly, or monthly totals with rolling averages
- ✅ **Meteorological standards** — Classify rainfall intensity (light/moderate/heavy/violent) per WMO guidelines
- ✅ **Zero dependencies** — Pure TypeScript, strict mode, runs on Bun or Node.js 20+

## 📦 Installation

```bash
npm install @adametherzlab/rain-gauge
# or
bun add @adametherzlab/rain-gauge
```

## 🚀 Quick Start

```typescript
// REMOVED external import: import { RainGaugeLogger, classifyIntensity, detectDrought } from '@adametherzlab/rain-gauge';
// REMOVED external import: import type { Millimeters, Days } from '@adametherzlab/rain-gauge';

const gauge = new RainGaugeLogger();
gauge.addEntry(new Date('2024-01-15'), 45.2 as Millimeters);

const report = detectDrought(gauge.getEntriesByDateRange(
  new Date('2024-01-01'), 
  new Date('2024-01-31')
), 14 as Days);

console.log(report.severity); // 'none' (hopefully!)
```

## 📚 API Reference

### `RainGaugeLogger`

In-memory rainfall data logger with analytics capabilities.

#### `addEntry(date: Date, amount: Millimeters): void`
```typescript
gauge.addEntry(new Date(), 12.5 as Millimeters);
```

#### `getEntriesByDateRange(start: Date, end: Date): RainfallEntry[]`
```typescript
const entries = gauge.getEntriesByDateRange(new Date('2024-01-01'), new Date('2024-01-31'));
```

### Utility Functions

#### `calculateTotals(entries: RainfallEntry[], periodType: PeriodType): PeriodTotals[]`
Aggregates rainfall into daily, weekly, or monthly buckets.
- **Params**: `entries` — Array of measurements; `periodType` — `'daily' | 'weekly' | 'monthly'`
- **Returns**: Array of period totals sorted chronologically
- **Throws**: `Error` if entries is empty or contains invalid timestamps
```typescript
const weekly = calculateTotals(entries, 'weekly');
```

#### `calculateRollingAverage(entries: RainfallEntry[], windowDays: Days): RollingAverage`
- **Params**: `entries` — Rainfall data; `windowDays` — Branded number of days (≥1)
- **Returns**: Average amount and window metadata
- **Throws**: `RangeError` if windowDays < 1; `Error` if insufficient data
```typescript
const avg = calculateRollingAverage(entries, 7 as Days);
```

#### `classifyIntensity(amount: Millimeters, durationHours: number): RainfallIntensity`
- **Params**: `amount` — Total mm fallen; `durationHours` — Event duration in hours (>0)
- **Returns**: `'light' | 'moderate' | 'heavy' | 'violent'`
- **Throws**: `RangeError` for negative amounts or non-positive duration
```typescript
const intensity = classifyIntensity(15 as Millimeters, 2); // 'heavy'
```

#### `detectDrought(entries: RainfallEntry[], thresholdDays: Days): DroughtReport`
- **Params**: `entries` — Historical data; `thresholdDays` — Consecutive dry days to trigger drought (≥1)
- **Returns**: Severity level and dry spell statistics
- **Throws**: `RangeError` if thresholdDays < 1; `Error` if entries array is empty
```typescript
const drought = detectDrought(entries, 15 as Days);
```

### Rainfall Intensity Thresholds

| Rate (mm/hour) | Classification |
|----------------|----------------|
| < 2.5 | `light` |
| 2.5 – 7.6 | `moderate` |
| 7.6 – 50 | `heavy` |
| > 50 | `violent` |

### Type Reference

- `Millimeters` — Branded number for rainfall amounts (prevents mixing with other numbers)
- `Days` — Branded number for day durations
- `RainfallIntensity` — Union type: `'light' | 'moderate' | 'heavy' | 'violent'`
- `DroughtSeverity` — Union type: `'none' | 'mild' | 'moderate' | 'severe'`
- `PeriodType` — Aggregation granularity: `'daily' | 'weekly' | 'monthly'`
- `RainfallEntry` — Interface with `timestamp: Date` and `amount: Millimeters`
- `PeriodTotals` — Aggregation result with `periodStart`, `periodEnd`, and `total: Millimeters`
- `RollingAverage` — Statistics including `average: Millimeters` and `windowDays: Days`
- `DroughtReport` — Analysis result with `severity: DroughtSeverity` and `consecutiveDryDays: number`

## 🔧 Advanced Usage

```typescript
// REMOVED external import: import { RainGaugeLogger, calculateRollingAverage, detectDrought, calculateTotals } from '@adametherzlab/rain-gauge';
// REMOVED external import: import type { Millimeters, Days } from '@adametherzlab/rain-gauge';

const fieldGauge = new RainGaugeLogger();

// Simulate 30 days of data
for (let i = 0; i < 30; i++) {
  const date = new Date();
  date.setDate(date.getDate() - i);
  const amount = (Math.random() * 5) as Millimeters;
  fieldGauge.addEntry(date, amount);
}

// Check 7-day rolling average for irrigation scheduling
const recent = fieldGauge.getEntriesByDateRange(
  new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  new Date()
);
const weeklyAvg = calculateRollingAverage(recent, 7 as Days);
console.log(`Weekly average: ${weeklyAvg.average.toFixed(1)}mm`);

// Detect agricultural drought (21+ days without significant rain)
const monthlyData = fieldGauge.getEntriesByDateRange(
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  new Date()
);
const droughtStatus = detectDrought(monthlyData, 21 as Days);

if (droughtStatus.severity !== 'none') {
  console.warn(`Drought detected: ${droughtStatus.severity} severity`);
  console.log(`Dry spell duration: ${droughtStatus.consecutiveDryDays} days`);
}
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 License

MIT (c) [AdametherzLab](https://github.com/AdametherzLab)