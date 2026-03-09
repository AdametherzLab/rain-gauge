import type { RainfallEntry, Millimeters, RainfallIntensity } from "./types.js";
import * as fs from "fs";
import * as path from "path";

/**
 * Serializable representation of a rainfall entry for persistence.
 */
export interface SerializedEntry {
  readonly timestamp: string;
  readonly amount: number;
  readonly intensity?: RainfallIntensity;
}

/**
 * Interface for rainfall data persistence backends.
 */
export interface RainfallStore {
  /** Save all entries, replacing any previously stored data. */
  saveAll(entries: readonly RainfallEntry[]): void;
  /** Load all previously saved entries. Returns empty array if no data. */
  loadAll(): RainfallEntry[];
  /** Append a single entry without rewriting all data. */
  append(entry: RainfallEntry): void;
  /** Remove all persisted data. */
  clear(): void;
}

function serializeEntry(entry: RainfallEntry): SerializedEntry {
  const s: SerializedEntry = {
    timestamp: entry.timestamp.toISOString(),
    amount: entry.amount,
  };
  if (entry.intensity) {
    return { ...s, intensity: entry.intensity };
  }
  return s;
}

function deserializeEntry(s: SerializedEntry): RainfallEntry {
  const e: RainfallEntry = {
    timestamp: new Date(s.timestamp),
    amount: s.amount as Millimeters,
  };
  if (s.intensity) {
    return { ...e, intensity: s.intensity };
  }
  return e;
}

/**
 * Persists rainfall data as a JSON file on disk.
 * @example
 * const store = new FileStore('./rainfall-data.json');
 */
export class FileStore implements RainfallStore {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  saveAll(entries: readonly RainfallEntry[]): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = JSON.stringify(entries.map(serializeEntry), null, 2);
    fs.writeFileSync(this.filePath, data, "utf-8");
  }

  loadAll(): RainfallEntry[] {
    if (!fs.existsSync(this.filePath)) {
      return [];
    }
    const raw = fs.readFileSync(this.filePath, "utf-8");
    const parsed: SerializedEntry[] = JSON.parse(raw);
    return parsed.map(deserializeEntry);
  }

  append(entry: RainfallEntry): void {
    const existing = this.loadAll();
    existing.push(entry);
    this.saveAll(existing);
  }

  clear(): void {
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }
}

/**
 * Persists rainfall data in a SQLite database using better-sqlite3.
 * @example
 * const store = new SqliteStore('./rainfall.db');
 */
export class SqliteStore implements RainfallStore {
  private readonly db: import("better-sqlite3").Database;

  constructor(dbPath: string) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require("better-sqlite3");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rainfall_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        amount REAL NOT NULL,
        intensity TEXT
      )
    `);
  }

  saveAll(entries: readonly RainfallEntry[]): void {
    const insert = this.db.prepare(
      "INSERT INTO rainfall_entries (timestamp, amount, intensity) VALUES (?, ?, ?)"
    );
    const clearAndInsert = this.db.transaction((items: readonly RainfallEntry[]) => {
      this.db.exec("DELETE FROM rainfall_entries");
      for (const e of items) {
        insert.run(e.timestamp.toISOString(), e.amount, e.intensity ?? null);
      }
    });
    clearAndInsert(entries);
  }

  loadAll(): RainfallEntry[] {
    const rows = this.db.prepare(
      "SELECT timestamp, amount, intensity FROM rainfall_entries ORDER BY timestamp ASC"
    ).all() as { timestamp: string; amount: number; intensity: string | null }[];
    return rows.map((row) => {
      const entry: RainfallEntry = {
        timestamp: new Date(row.timestamp),
        amount: row.amount as Millimeters,
      };
      if (row.intensity) {
        return { ...entry, intensity: row.intensity as RainfallIntensity };
      }
      return entry;
    });
  }

  append(entry: RainfallEntry): void {
    this.db.prepare(
      "INSERT INTO rainfall_entries (timestamp, amount, intensity) VALUES (?, ?, ?)"
    ).run(entry.timestamp.toISOString(), entry.amount, entry.intensity ?? null);
  }

  clear(): void {
    this.db.exec("DELETE FROM rainfall_entries");
  }

  /** Close the database connection. */
  close(): void {
    this.db.close();
  }
}
