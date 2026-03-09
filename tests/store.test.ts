import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  RainGaugeLogger,
  FileStore,
  SqliteStore,
  type Millimeters,
  type Days,
  type RainfallEntry,
  type DateRangeQuery,
} from "../src/index.js";

const tmpDir = path.join(os.tmpdir(), "rain-gauge-test-" + Date.now());

beforeEach(() => {
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
});

afterEach(() => {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

const sampleEntries: RainfallEntry[] = [
  { timestamp: new Date("2024-01-01T10:00:00Z"), amount: 5.0 as Millimeters },
  { timestamp: new Date("2024-01-02T12:00:00Z"), amount: 12.0 as Millimeters },
  { timestamp: new Date("2024-01-03T08:00:00Z"), amount: 0.0 as Millimeters },
];

describe("FileStore", () => {
  it("saves and loads rainfall entries to/from a JSON file", () => {
    const filePath = path.join(tmpDir, "rain.json");
    const store = new FileStore(filePath);

    store.saveAll(sampleEntries);
    const loaded = store.loadAll();

    expect(loaded.length).toBe(3);
    expect(loaded[0].amount).toBe(5.0);
    expect(loaded[1].amount).toBe(12.0);
    expect(loaded[2].amount).toBe(0.0);
    expect(loaded[0].timestamp.toISOString()).toBe("2024-01-01T10:00:00.000Z");
  });

  it("returns empty array when file does not exist", () => {
    const store = new FileStore(path.join(tmpDir, "nonexistent.json"));
    expect(store.loadAll()).toEqual([]);
  });

  it("appends entries without losing existing data", () => {
    const filePath = path.join(tmpDir, "append.json");
    const store = new FileStore(filePath);

    store.saveAll([sampleEntries[0]]);
    store.append(sampleEntries[1]);

    const loaded = store.loadAll();
    expect(loaded.length).toBe(2);
    expect(loaded[0].amount).toBe(5.0);
    expect(loaded[1].amount).toBe(12.0);
  });

  it("clear removes the file", () => {
    const filePath = path.join(tmpDir, "clear.json");
    const store = new FileStore(filePath);

    store.saveAll(sampleEntries);
    expect(fs.existsSync(filePath)).toBe(true);

    store.clear();
    expect(fs.existsSync(filePath)).toBe(false);
    expect(store.loadAll()).toEqual([]);
  });
});

describe("SqliteStore", () => {
  it("saves and loads rainfall entries to/from SQLite", () => {
    const dbPath = path.join(tmpDir, "rain.db");
    const store = new SqliteStore(dbPath);

    store.saveAll(sampleEntries);
    const loaded = store.loadAll();

    expect(loaded.length).toBe(3);
    expect(loaded[0].amount).toBe(5.0);
    expect(loaded[1].amount).toBe(12.0);
    expect(loaded[0].timestamp.toISOString()).toBe("2024-01-01T10:00:00.000Z");

    store.close();
  });

  it("appends entries incrementally", () => {
    const dbPath = path.join(tmpDir, "append.db");
    const store = new SqliteStore(dbPath);

    store.append(sampleEntries[0]);
    store.append(sampleEntries[1]);

    const loaded = store.loadAll();
    expect(loaded.length).toBe(2);
    expect(loaded[0].amount).toBe(5.0);
    expect(loaded[1].amount).toBe(12.0);

    store.close();
  });

  it("clear removes all rows", () => {
    const dbPath = path.join(tmpDir, "clear.db");
    const store = new SqliteStore(dbPath);

    store.saveAll(sampleEntries);
    expect(store.loadAll().length).toBe(3);

    store.clear();
    expect(store.loadAll().length).toBe(0);

    store.close();
  });
});

describe("RainGaugeLogger with FileStore persistence", () => {
  it("persists entries across logger instances", () => {
    const filePath = path.join(tmpDir, "logger-persist.json");
    const store = new FileStore(filePath);

    const logger1 = new RainGaugeLogger({ store });
    logger1.record({ timestamp: new Date("2024-05-01T10:00:00Z"), amount: 7.5 as Millimeters });
    logger1.record({ timestamp: new Date("2024-05-02T10:00:00Z"), amount: 3.0 as Millimeters });
    expect(logger1.size).toBe(2);

    // Create new logger instance pointing to same file
    const logger2 = new RainGaugeLogger({ store });
    expect(logger2.size).toBe(2);

    const query: DateRangeQuery = {
      startDate: new Date("2024-05-01T00:00:00Z"),
      endDate: new Date("2024-05-02T23:59:59Z"),
    };
    const totals = logger2.getTotals(query, "daily");
    expect(totals.length).toBe(2);
    expect(totals.find((t) => t.period === "2024-05-01")?.total).toBe(7.5);
  });

  it("clear removes persisted data", () => {
    const filePath = path.join(tmpDir, "logger-clear.json");
    const store = new FileStore(filePath);

    const logger = new RainGaugeLogger({ store });
    logger.record({ timestamp: new Date("2024-05-01T10:00:00Z"), amount: 5.0 as Millimeters });
    expect(logger.size).toBe(1);

    logger.clear();
    expect(logger.size).toBe(0);

    // New instance should also be empty
    const logger2 = new RainGaugeLogger({ store });
    expect(logger2.size).toBe(0);
  });

  it("save() and load() work for manual persistence control", () => {
    const filePath = path.join(tmpDir, "manual.json");
    const store = new FileStore(filePath);

    const logger = new RainGaugeLogger({ store, autoLoad: false });
    logger.record({ timestamp: new Date("2024-06-01T10:00:00Z"), amount: 4.0 as Millimeters });
    logger.save();

    const logger2 = new RainGaugeLogger({ store, autoLoad: false });
    expect(logger2.size).toBe(0);
    logger2.load();
    expect(logger2.size).toBe(1);
  });

  it("throws when save/load called without store", () => {
    const logger = new RainGaugeLogger();
    expect(() => logger.save()).toThrow("No persistence store configured");
    expect(() => logger.load()).toThrow("No persistence store configured");
  });
});

describe("RainGaugeLogger with SqliteStore persistence", () => {
  it("persists entries across logger instances with SQLite", () => {
    const dbPath = path.join(tmpDir, "logger.db");
    const store = new SqliteStore(dbPath);

    const logger1 = new RainGaugeLogger({ store });
    logger1.record({ timestamp: new Date("2024-07-01T10:00:00Z"), amount: 15.0 as Millimeters });
    logger1.record({ timestamp: new Date("2024-07-02T10:00:00Z"), amount: 8.0 as Millimeters });

    // New logger instance, same store
    const logger2 = new RainGaugeLogger({ store });
    expect(logger2.size).toBe(2);

    const query: DateRangeQuery = {
      startDate: new Date("2024-07-01T00:00:00Z"),
      endDate: new Date("2024-07-02T23:59:59Z"),
    };
    const totals = logger2.getTotals(query, "monthly");
    expect(totals[0].total).toBe(23.0);

    store.close();
  });
});
