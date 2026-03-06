import { describe, it, expect } from "bun:test";
import {
  RainGaugeLogger,
  calculateTotals,
  classifyIntensity,
  detectDrought,
  type Millimeters,
  type Days,
  type RainfallEntry,
  type DateRangeQuery,
} from "../src/index.js";

describe("rain-gauge public API", () => {
  it("calculates accurate daily and monthly totals from known dataset using utility function", () => {
    const entries: readonly RainfallEntry[] = [
      { timestamp: new Date("2024-03-15T10:00:00Z"), amount: 10.0 as Millimeters },
      { timestamp: new Date("2024-03-15T11:00:00Z"), amount: 5.0 as Millimeters },
      { timestamp: new Date("2024-03-22T08:00:00Z"), amount: 20.0 as Millimeters },
    ];

    const dailyTotals = calculateTotals(entries, "daily");
    const monthlyTotals = calculateTotals(entries, "monthly");

    expect(dailyTotals.find((t) => t.period === "2024-03-15")?.total).toBe(15.0);
    expect(dailyTotals.find((t) => t.period === "2024-03-22")?.total).toBe(20.0);
    expect(monthlyTotals[0].total).toBe(35.0);
  });

  it("classifies 2.5mm/h as moderate intensity using utility function", () => {
    const result = classifyIntensity(2.5 as Millimeters, 1);
    expect(result).toBe("moderate");
  });

  it("detects drought after consecutive dry days using utility function", () => {
    const entries: readonly RainfallEntry[] = [
      { timestamp: new Date("2024-01-01T12:00:00Z"), amount: 0.0 as Millimeters },
      { timestamp: new Date("2024-01-02T12:00:00Z"), amount: 0.1 as Millimeters },
      { timestamp: new Date("2024-01-03T12:00:00Z"), amount: 0.0 as Millimeters },
      { timestamp: new Date("2024-01-04T12:00:00Z"), amount: 0.0 as Millimeters },
    ];

    const report = detectDrought(entries, 3 as Days);
    expect(report.isDrought).toBe(true);
    expect(report.consecutiveDryDays).toBe(4);
  });

  it("RainGaugeLogger records and retrieves data correctly", () => {
    const logger = new RainGaugeLogger();
    const entry1: RainfallEntry = { timestamp: new Date("2024-01-01T10:00:00Z"), amount: 5.0 as Millimeters };
    const entry2: RainfallEntry = { timestamp: new Date("2024-01-01T11:00:00Z"), amount: 3.0 as Millimeters };
    const entry3: RainfallEntry = { timestamp: new Date("2024-01-02T09:00:00Z"), amount: 10.0 as Millimeters };

    logger.record(entry1);
    logger.record(entry2);
    logger.record(entry3);

    const query: DateRangeQuery = {
      startDate: new Date("2024-01-01T00:00:00Z"),
      endDate: new Date("2024-01-02T23:59:59Z"),
    };

    const dailyTotals = logger.getTotals(query, "daily");
    expect(dailyTotals.length).toBe(2);
    expect(dailyTotals.find((t) => t.period === "2024-01-01")?.total).toBe(8.0);
    expect(dailyTotals.find((t) => t.period === "2024-01-02")?.total).toBe(10.0);
  });

  it("RainGaugeLogger detects drought correctly", () => {
    const logger = new RainGaugeLogger();
    logger.record({ timestamp: new Date("2024-02-01T12:00:00Z"), amount: 0.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-02-02T12:00:00Z"), amount: 0.1 as Millimeters });
    logger.record({ timestamp: new Date("2024-02-03T12:00:00Z"), amount: 0.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-02-04T12:00:00Z"), amount: 0.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-02-05T12:00:00Z"), amount: 5.0 as Millimeters }); // Breaks streak

    const query: DateRangeQuery = {
      startDate: new Date("2024-02-01T00:00:00Z"),
      endDate: new Date("2024-02-05T23:59:59Z"),
    };

    const report = logger.detectDrought(query, 3 as Days);
    expect(report.isDrought).toBe(true);
    expect(report.consecutiveDryDays).toBe(4);
    expect(report.severity).toBe("mild"); // 4 days dry, threshold 3, 4 < 3*1.5
  });

  it("RainGaugeLogger calculates rolling average correctly", () => {
    const logger = new RainGaugeLogger();
    logger.record({ timestamp: new Date("2024-03-01T12:00:00Z"), amount: 10.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-03-02T12:00:00Z"), amount: 20.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-03-03T12:00:00Z"), amount: 15.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-03-04T12:00:00Z"), amount: 5.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-03-05T12:00:00Z"), amount: 0.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-03-06T12:00:00Z"), amount: 10.0 as Millimeters });
    logger.record({ timestamp: new Date("2024-03-07T12:00:00Z"), amount: 20.0 as Millimeters });

    const query: DateRangeQuery = {
      startDate: new Date("2024-03-01T00:00:00Z"),
      endDate: new Date("2024-03-07T23:59:59Z"),
    };

    const rollingAverage = logger.getRollingAverage(query, 7 as Days);
    expect(rollingAverage.windowDays).toBe(7);
    expect(rollingAverage.averagePerDay).toBeCloseTo((10 + 20 + 15 + 5 + 0 + 10 + 20) / 7);
    expect(rollingAverage.windowStart.toISOString().slice(0, 10)).toBe("2024-03-01");
    expect(rollingAverage.windowEnd.toISOString().slice(0, 10)).toBe("2024-03-07");
  });
});