export type IngestContext = {
  seriesId?: string;
  http_status?: number;
  error_category?: string;
  retryable?: boolean;
  line_number?: number;
  diagnostics_path?: string;
  diagnostics_count?: number;
  [k: string]: any;
};

const ingestLogger = {
  log(level: 'error' | 'warn' | 'info' | 'debug', event: string, context: IngestContext = {}) {
    const out = {
      timestamp: new Date().toISOString(),
      level,
      event,
      ...context,
    } as Record<string, unknown>;
    // Ensure deterministic key ordering for downstream systems
    const ordered: Record<string, unknown> = {};
    Object.keys(out).sort().forEach(k => { ordered[k] = (out as any)[k]; });
    // Emit single-line JSON
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(ordered));
  }
};

export default ingestLogger;
