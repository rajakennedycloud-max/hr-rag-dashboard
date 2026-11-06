type LogLevel = "debug" | "info" | "warn" | "error";

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const configured: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) in LEVELS ? (process.env.LOG_LEVEL as LogLevel) : "info";
const isProd = process.env.NODE_ENV === "production";

function log(level: LogLevel, message: string, meta?: unknown) {
  if (LEVELS[level] < LEVELS[configured]) return;
  if (isProd) {
    console[level](JSON.stringify({ ts: new Date().toISOString(), level, message, ...(meta ? { meta } : {}) }));
  } else {
    console[level](`[${level}] ${message}`, meta ?? "");
  }
}

export const logger = {
  debug: (m: string, meta?: unknown) => log("debug", m, meta),
  info: (m: string, meta?: unknown) => log("info", m, meta),
  warn: (m: string, meta?: unknown) => log("warn", m, meta),
  error: (m: string, meta?: unknown) => log("error", m, meta),
};
