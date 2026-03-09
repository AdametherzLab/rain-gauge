import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { spawnSync } from "bun";

const tmpDir = path.join(os.tmpdir(), "rain-gauge-cli-test-" + Date.now());

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

function runCli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync({
    cmd: ["bun", "run", "src/cli.ts", ...args],
    cwd: process.cwd(),
  });
  
  return {
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    exitCode: result.exitCode,
  };
}

describe("CLI", () => {
  it("shows help when called with no arguments", () => {
    const result = runCli([]);
    expect(result.stdout).toContain("Rain Gauge CLI");
    expect(result.stdout).toContain("Usage:");
    expect(result.exitCode).toBe(0);
  });

  it("logs rainfall entry to file", () => {
    const storePath = path.join(tmpDir, "test.json");
    const result = runCli(["log", "15.5", "--store", storePath]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Logged 15.5mm");
    
    const data = fs.readFileSync(storePath, "utf-8");
    const parsed = JSON.parse(data);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].amount).toBe(15.5);
  });

  it("generates report from logged data", () => {
    const storePath = path.join(tmpDir, "report.json");
    
    runCli(["log", "10", "--store", storePath, "--date", "2024-03-15"]);
    runCli(["log", "20", "--store", storePath, "--date", "2024-03-16"]);
    
    const result = runCli(["report", "--store", storePath, "--period", "daily"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("2024-03-15");
    expect(result.stdout).toContain("10.0mm");
    expect(result.stdout).toContain("2024-03-16");
    expect(result.stdout).toContain("20.0mm");
  });

  it("outputs JSON format when requested", () => {
    const storePath = path.join(tmpDir, "json.json");
    runCli(["log", "5", "--store", storePath]);
    
    const result = runCli(["report", "--store", storePath, "--format", "json"]);
    expect(result.exitCode).toBe(0);
    const json = JSON.parse(result.stdout);
    expect(Array.isArray(json)).toBe(true);
    expect(json[0]).toHaveProperty("period");
    expect(json[0]).toHaveProperty("total");
  });

  it("detects drought conditions", () => {
    const storePath = path.join(tmpDir, "drought.json");
    
    for (let i = 1; i <= 5; i++) {
      const date = `2024-01-0${i}`;
      runCli(["log", "0", "--store", storePath, "--date", date]);
    }
    
    const result = runCli(["drought", "--store", storePath, "--threshold", "3"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Drought Status: YES");
    expect(result.stdout).toContain("Consecutive Dry Days: 5");
  });

  it("clears data when requested", () => {
    const storePath = path.join(tmpDir, "clear.json");
    runCli(["log", "10", "--store", storePath]);
    expect(fs.existsSync(storePath)).toBe(true);
    
    const result = runCli(["clear", "--store", storePath]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("cleared");
    
    const data = fs.readFileSync(storePath, "utf-8");
    expect(JSON.parse(data)).toHaveLength(0);
  });

  it("handles invalid amount gracefully", () => {
    const storePath = path.join(tmpDir, "error.json");
    const result = runCli(["log", "invalid", "--store", storePath]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Error");
  });
});
