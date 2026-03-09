[![CI](https://github.com/AdametherzLab/rain-gauge/actions/workflows/ci.yml/badge.svg)](https://github.com/AdametherzLab/rain-gauge/actions) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# rain-gauge

Type-safe rainfall measurement logger with drought detection, temporal analytics, and optional persistence.

## Features

- **Branded types** — `Millimeters` and `Days` prevent unit mix-ups at compile time
- **Drought detection** — Configurable severity thresholds (mild/moderate/severe)
- **Temporal analytics** — Daily, weekly, or monthly totals with rolling averages
- **Intensity classification** — Light/moderate/heavy/violent per WMO guidelines
- **Persistence** — Save/load data to JSON files or SQLite databases
- **Zero required dependencies** — Pure TypeScript core, optional `better-sqlite3` for DB storage

## Installation

bash
npm install @adametherzlab/rain-gauge
# or
bun add @adametherzlab/rain-gauge


## Quick Start


import { RainGaugeLogger, type Millimeters, type Days } from '@adametherzlab/rain-gauge';

const logger = new RainGaugeLogger();
logger.record({ timestamp: new Date(), amount: 12.5 as Millimeters });


## Persistence

rain-gauge supports two persistence backends: JSON files and SQLite.

### File Persistence


import { RainGaugeLogger, FileStore, type Millimeters } from '@adametherzlab/rain-gauge';

const store = new FileStore('./rainfall-data.json');
const logger = new RainGaugeLogger({ store });

// Entries are automatically persisted on record()
logger.record({ timestamp: new Date('2024-06-01T10:00:00Z'), amount: 5.0 as Millimeters });

// Data survives restarts — create a new logger with the same store
const logger2 = new RainGaugeLogger({ store });
console.log(logger2.size); // 1


### SQLite Persistence


import { RainGaugeLogger, SqliteStore, type Millimeters } from '@adametherzlab/rain-gauge';

const store = new SqliteStore('./rainfall.db');
const logger = new RainGaugeLogger({ store });

logger.record({ timestamp: new Date('2024-06-01T10:00:00Z'), amount: 8.0 as Millimeters });

// Don't forget to close the database when done
store.close();


### Manual Save/Load

Disable auto-loading and control persistence manually:


const logger = new RainGaugeLogger({ store, autoLoad: false });

// Record entries...
logger.record({ timestamp: new Date(), amount: 3.0 as Millimeters });

// Manually save all in-memory data
logger.save();

// Manually reload from store
logger.load();


### Custom Store

Implement the `RainfallStore` interface for any backend:


import type { RainfallStore, RainfallEntry } from '@adametherzlab/rain-gauge';

class MyCustomStore implements RainfallStore {
  saveAll(entries: readonly RainfallEntry[]): void { /* ... */ }
  loadAll(): RainfallEntry[] { /* ... */ }
  append(entry: RainfallEntry): void { /* ... */ }
  clear(): void { /* ... */ }
}


## API

### `RainGaugeLogger`

| Method | Description |
|--------|-------------|
| `record(entry)` | Record a rainfall measurement (auto-persists if store configured) |
| `getTotals(query, periodType)` | Aggregate by daily/weekly/monthly |
| `getRollingAverage(query, windowDays)` | Rolling average over N days |
| `detectDrought(query, thresholdDays)` | Detect drought conditions |
| `classifyIntensity(amount, hours)` | Classify rainfall rate |
| `save()` | Manually save all data to store |
| `load()` | Manually load data from store |
| `clear()` | Clear in-memory and persisted data |
| `size` | Number of recorded entries |

### Utility Functions

| Function | Description |
|----------|-------------|
| `calculateTotals(entries, periodType)` | Aggregate entries into period totals |
| `calculateRollingAverage(entries, windowDays)` | Compute rolling average |
| `classifyIntensity(amount, durationHours)` | Classify rainfall intensity |
| `detectDrought(entries, thresholdDays)` | Detect drought from entries |

## License

MIT
