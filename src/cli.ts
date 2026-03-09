#!/usr/bin/env bun
import { RainGaugeLogger, FileStore, SqliteStore, type Millimeters, type Days, type PeriodType } from "./index.js";
import * as path from "path";
import * as os from "os";

type Command = "log" | "report" | "drought" | "clear" | "help";

interface CliOptions {
  command: Command;
  amount?: number;
  date?: Date;
  period?: PeriodType;
  threshold?: number;
  storePath?: string;
  format?: "table" | "json";
}

/**
 * Parse command line arguments into structured options.
 * @param args - Raw command line arguments
 * @returns Parsed CLI options
 */
function parseArgs(args: string[]): CliOptions {
  const cmd = args[0] as Command | undefined;
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    return { command: "help" };
  }

  const options: CliOptions = { command: cmd, format: "table" };
  
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--store" || arg === "-s") {
      options.storePath = args[++i];
    } else if (arg === "--format" || arg === "-f") {
      options.format = args[++i] as "table" | "json";
    } else if (arg === "--threshold" || arg === "-t") {
      options.threshold = parseInt(args[++i], 10);
    } else if (arg === "--period" || arg === "-p") {
      options.period = args[++i] as PeriodType;
    } else if (arg === "--date" || arg === "-d") {
      options.date = new Date(args[++i]);
    } else if (!options.amount && cmd === "log") {
      options.amount = parseFloat(arg);
    }
  }

  if (cmd === "report" && !options.period) {
    options.period = "daily";
  }
  if (cmd === "drought" && !options.threshold) {
    options.threshold = 3;
  }
  if (cmd === "log" && !options.date) {
    options.date = new Date();
  }

  return options;
}

/**
 * Get the appropriate store instance based on file extension.
 * @param storePath - Path to store file (defaults to ~/.rain-gauge.json)
 * @returns RainfallStore instance
 */
function getStore(storePath?: string): import("./store.js").RainfallStore {
  const sp = storePath || path.join(os.homedir(), ".rain-gauge.json");
  if (sp.endsWith(".db") || sp.endsWith(".sqlite")) {
    return new SqliteStore(sp);
  }
  return new FileStore(sp);
}

/**
 * Print help message to stdout.
 */
function printHelp(): void {
  console.log(`
Rain Gauge CLI - Log and analyze rainfall data

Usage:
  rain-gauge <command> [options]

Commands:
  log <amount> [options]     Log rainfall amount in millimeters
  report [options]           Show rainfall report (daily/weekly/monthly)
  drought [options]          Check for drought conditions
  clear                      Clear all recorded data
  help                       Show this help message

Options:
  -s, --store <path>         Path to data file (.json or .db)
  -d, --date <iso-date>      Date for log entry (default: now)
  -p, --period <type>        Period for report: daily|weekly|monthly (default: daily)
  -t, --threshold <days>     Drought threshold in days (default: 3)
  -f, --format <format>      Output format: table|json (default: table)

Examples:
  rain-gauge log 15.5
  rain-gauge log 20 --date 2024-03-15
  rain-gauge report --period monthly
  rain-gauge drought --threshold 5
`);
}

/**
 * Format data as a text table.
 * @param data - Array of objects to format
 * @returns Formatted table string
 */
function formatTable(data: Record<string, string | number>[]): string {
  if (data.length === 0) return "No data";
  
  const keys = Object.keys(data[0]);
  const widths = keys.map(k => Math.max(k.length, ...data.map(d => String(d[k]).length)));
  
  const header = keys.map((k, i) => k.padEnd(widths[i])).join(" | ");
  const separator = widths.map(w => "-".repeat(w)).join("-+-");
  const rows = data.map(row => 
    keys.map((k, i) => String(row[k]).padEnd(widths[i])).join(" | ")
  );
  
  return [header, separator, ...rows].join("\n");
}

/**
 * Main CLI entry point. Parses arguments and executes commands.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.command === "help") {
    printHelp();
    process.exit(0);
  }

  const store = getStore(options.storePath);
  const logger = new RainGaugeLogger({ store });

  try {
    switch (options.command) {
      case "log": {
        if (options.amount === undefined || isNaN(options.amount)) {
          console.error("Error: Amount is required (number in millimeters)");
          process.exit(1);
        }
        logger.record({
          timestamp: options.date || new Date(),
          amount: options.amount as Millimeters
        });
        console.log(`Logged ${options.amount}mm at ${(options.date || new Date()).toISOString()}`);
        break;
      }
      
      case "report": {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        const totals = logger.getTotals(
          { startDate, endDate },
          options.period || "daily"
        );
        
        if (options.format === "json") {
          console.log(JSON.stringify(totals, null, 2));
        } else {
          if (totals.length === 0) {
            console.log("No rainfall data for the last 30 days");
          } else {
            const tableData = totals.map(t => ({
              Period: t.period,
              Total: `${t.total.toFixed(1)}mm`,
              Count: t.count
            }));
            console.log(formatTable(tableData));
          }
        }
        break;
      }
      
      case "drought": {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 90);
        
        const report = logger.detectDrought(
          { startDate, endDate },
          (options.threshold || 3) as Days
        );
        
        if (options.format === "json") {
          console.log(JSON.stringify(report, null, 2));
        } else {
          console.log(`Drought Status: ${report.isDrought ? "YES" : "NO"}`);
          console.log(`Consecutive Dry Days: ${report.consecutiveDryDays}`);
          console.log(`Severity: ${report.severity}`);
          if (report.droughtStartDate) {
            console.log(`Started: ${report.droughtStartDate.toISOString().split('T')[0]}`);
          }
        }
        break;
      }
      
      case "clear": {
        logger.clear();
        console.log("All rainfall data cleared");
        break;
      }
      
      default:
        console.error(`Unknown command: ${options.command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    if (store instanceof SqliteStore) {
      store.close();
    }
  }
}

main();
