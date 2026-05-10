// ZoePlane Sidecar — Structured log helper

type Level = "INFO" | "WARN" | "ERROR";

/**
 * Emit a structured JSON log line on stderr.
 *
 * Always includes `pid: process.pid` so every log line emitted by the sidecar
 * identifies the emitting process, enabling correlation across sidecar restarts.
 *
 * Spread order: `pid` is set before `...extra` so call sites cannot accidentally
 * override it.
 *
 * @param level   Severity — one of "INFO" | "WARN" | "ERROR".
 * @param message Human-readable description of the event.
 * @param extra   Optional contextual fields merged into the emitted JSON object.
 */
export function log(level: Level, message: string, extra?: Record<string, unknown>): void {
  console.error(JSON.stringify({ level, message, pid: process.pid, ...extra }));
}
