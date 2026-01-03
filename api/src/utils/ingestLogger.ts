import { logger, LogSeverity, LogEvent, LogContext } from './logger.js';

/**
 * IngestLogger: Specialized logger for data ingestion pipelines.
 * 
 * This logger wraps the central secure logger to provide a consistent
 * interface for ingestion-specific events while enforcing all security
 * and structural requirements.
 */

export type IngestContext = LogContext & {
  seriesId?: string;
  http_status?: number;
  error_category?: string;
  retryable?: boolean;
  line_number?: number;
  diagnostics_path?: string;
  diagnostics_count?: number;
};

const ingestLogger = {
  log(level: LogSeverity, event: LogEvent, context: IngestContext = {}) {
    logger.log(level, 'INGEST_SERVICE', event, context);
  }
};

export default ingestLogger;

