[![CI](https://github.com/AdametherzLab/rain-gauge/actions/workflows/ci.yml/badge.svg)](https://github.com/AdametherzLab/rain-gauge/actions) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# rain-gauge

Type-safe rainfall measurement logger with drought detection and temporal analytics.

## Features

- **Branded types** — `Millimeters` and `Days` prevent unit mix-ups at compile time
- **Drought detection** — Configurable severity thresholds (mild/moderate/severe)
- **Temporal analytics** — Daily, weekly, or monthly totals with rolling averages
- **Intensity classification** — Light/moderate/heavy/violent per WMO guidelines
- **Zero dependencies** — Pure TypeScript, strict mode, Bun or Node.js 20+

## Installation

bash
npm install @adametherzlab/rain-gauge
# or
bun add @adametherzlab/rain-gauge


## Quick Start


import { RainGaugeLogger, type Millimeters, type Days, type DateRangeQuery } from '@adametherzlab/rain-gauge';

const logger = new RainGaugeLogger();

// Record measurements
logger.record({ timestamp: new Date('2024-03-15T10:00:00Z'), amount: 10.0 as Millimeters });
logger.record({ timestamp: new Date('2024-03-15T14:00:00Z'), amount: 5.5 as Millimeters });
logger.record({ timestamp: new Date('2024-03-16T09:00:00Z'), amount: 0.0 as Millimeters });

// Query totals
const query: DateRangeQuery = {
  startDate: new Date('2024-03-15T00:00:00Z'),
  endDate: new Date('2024-03-16T23:59:59Z'),
};
const daily = logger.getTotals(query, 'daily');
// [{ period: '2024-03-15', total: 15.5, count: 2, ... }, { period: '2024-03-16', total: 0, count: 1, ... }]

// Detect drought
const drought = logger.detectDrought(query, 2 as Days);
// { isDrought: false, consecutiveDryDays: 1, severity: 'none', ... }

// Classify intensity
const intensity = logger.classifyIntensity(25 as Millimeters, 2);
// 'heavy'


## API

### `RainGaugeLogger`

| Method | Description |
|--------|-------------|
| `record(entry)` | Record a rainfall measurement |
| `getTotals(query, periodType)` | Aggregate totals by day/week/month |
| `getRollingAverage(query, windowDays)` | Rolling average over N days |
| `detectDrought(query, thresholdDays)` | Detect drought conditions |
| `classifyIntensity(amount, hours)` | Classify rainfall intensity |
| `size` | Number of recorded entries |
| `clear()` | Remove all recorded entries |

### Standalone Functions

| Function | Description |
|----------|-------------|
| `calculateTotals(entries, periodType)` | Aggregate entries into period totals |
| `calculateRollingAverage(entries, windowDays)` | Compute rolling average |
| `classifyIntensity(amount, hours)` | Classify intensity by rate |
| `detectDrought(entries, thresholdDays)` | Detect drought from entries |

### Types

- `Millimeters` — Branded number type for rainfall amounts
- `Days` — Branded number type for day counts
- `RainfallEntry` — Timestamped measurement record
- `DateRangeQuery` — Start/end date range filter
- `PeriodTotals` — Aggregated period result
- `RollingAverage` — Rolling average result
- `DroughtReport` — Drought analysis result
- `RainfallIntensity` — `'light' | 'moderate' | 'heavy' | 'violent'`
- `DroughtSeverity` — `'none' | 'mild' | 'moderate' | 'severe'`
- `PeriodType` — `'daily' | 'weekly' | 'monthly'`

## License

MIT
