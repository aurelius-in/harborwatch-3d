export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  event: string;
  site_id?: string;
  track_id?: string;
  seq?: number;
  request_id?: string;
  [key: string]: unknown;
}

const counters = new Map<string, number>();
const gauges = new Map<string, number>();

export function inc(name: string, by = 1): void {
  counters.set(name, (counters.get(name) ?? 0) + by);
}

export function gauge(name: string, value: number): void {
  gauges.set(name, value);
}

export function snapshotMetrics(): Record<string, number> {
  return {
    ...Object.fromEntries(counters),
    ...Object.fromEntries(gauges),
  };
}

export function createLogger(service: string, minLevel: LogLevel = "info") {
  const order: LogLevel[] = ["debug", "info", "warn", "error"];
  const min = order.indexOf(minLevel);

  function write(level: LogLevel, fields: LogFields): void {
    if (order.indexOf(level) < min) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      ...fields,
      service,
    };
    const text = JSON.stringify(line);
    if (level === "error") {
      console.error(text);
    } else if (level === "warn") {
      console.warn(text);
    } else {
      console.log(text);
    }
  }

  return {
    debug: (fields: LogFields) => write("debug", fields),
    info: (fields: LogFields) => write("info", fields),
    warn: (fields: LogFields) => write("warn", fields),
    error: (fields: LogFields) => write("error", fields),
  };
}
