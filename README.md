[![CI](https://github.com/AdametherzLab/rain-gauge/actions/workflows/ci.yml/badge.svg)](https://github.com/AdametherzLab/rain-gauge/actions) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# rain-gauge

Type-safe rainfall measurement logger with drought detection, temporal analytics, and optional persistence.

## Features

- **Branded types** — `Millimeters` and `Days` prevent unit mix-ups at compile time
- **Drought detection** — Configurable severity thresholds (mild/moderate/severe)
- **Temporal analytics** — Daily, weekly, or monthly totals with rolling averages
- **Intensity classification** — Light/moderate/heavy/violent per WMO guidelines
- **Persistence** — Save/load data to JSON files or SQLite databases
- **CLI included** — Log and report from the command line without writing code
- **Zero required dependencies** — Pure TypeScript core, optional `better-sqlite3` for DB storage

## Installation

bash
npm install @adametherzlab/rain-gauge


## Usage

### Library API


import { RainGaugeLogger, FileStore, type Millimeters, type Days } from '@adametherzlab/rain-gauge';

const logger = new RainGaugeLogger({ 
  store: new FileStore('./rainfall.json') 
});

// Record rainfall
logger.record({ 
  timestamp: new Date(), 
  amount: 15.5 as Millimeters 
});

// Get monthly totals
const totals = logger.getTotals(
  { startDate: new Date('2024-01-01'), endDate: new Date() },
  'monthly'
);

// Check for drought
const drought = logger.detectDrought(
  { startDate: new Date('2024-01-01'), endDate: new Date() },
  7 as Days
);


### CLI Usage

Rain Gauge includes a command-line interface for quick manual entry and reports.

bash
# Log rainfall (amount in mm)
npx rain-gauge log 25.4 --date 2024-03-15

# View daily/weekly/monthly report
npx rain-gauge report --period monthly

# Check drought status
npx rain-gauge drought --threshold 5

# Use SQLite storage
npx rain-gauge log 10.5 --store ./rain.db


#### CLI Commands

**log <amount>** - Record rainfall amount
  - `-d, --date <iso-date>` - Date of measurement (default: now)
  - `-s, --store <path>` - Data file (.json or .db)

**report** - Show rainfall totals
  - `-p, --period <daily|weekly|monthly>` - Aggregation period (default: daily)
  - `-f, --format <table|json>` - Output format (default: table)

**drought** - Check drought conditions
  - `-t, --threshold <days>` - Dry days threshold (default: 3)
  - `-f, --format <table|json>` - Output format

**clear** - Remove all data
  - `-s, --store <path>` - Target data file

#### CLI Examples

bash
# Log today's rainfall
rain-gauge log 25.4

# View monthly totals for last 30 days
rain-gauge report --period monthly --format json

# Check for drought (5+ dry days)
rain-gauge drought --threshold 5

# Clear all data
rain-gauge clear --store ./rain.json


## License

MIT
