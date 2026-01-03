/**
 * ECB reference data staleness evaluation
 *
 * Rules enforced here:
 * - Each series must define a maximum allowed staleness window (in seconds).
 * - If the window is exceeded the series is marked STALE.
 * - When STALE: automated policy changes MUST be blocked; reporting may continue
 *   but must surface an explicit STALE flag to human operators and downstream consumers.
 * - UNAVAILABLE indicates we have no record for the series.
 *
 * Security / policy rationale (important):
 * - Reference data from external sources (ECB) is advisory only. It must never
 *   silently affect monetary behavior, limits, or settlement decisions.
 * - If a series becomes stale, the system must fail-safe by blocking automated
 *   policy changes that depend on that series, and require human review before
 *   any enforcement action.
 */

export enum ReferenceDataState {
  FRESH = 'FRESH',
  STALE = 'STALE',
  UNAVAILABLE = 'UNAVAILABLE',
}

export interface StalenessEvaluation {
  seriesId: string;
  state: ReferenceDataState;
  ageSeconds?: number; // undefined when unavailable
  maxAllowedSeconds?: number; // configured window
  note?: string;
}

/** per-series staleness configuration */
export interface StalenessConfig {
  // maximum allowed age in seconds before the series is considered STALE
  maxAgeSeconds: number;
}

/**
 * Evaluate staleness for a single series.
 *
 * @param seriesId logical series id
 * @param retrievedAtUtc ISO 8601 timestamp string when series was last retrieved (UTC) or undefined
 * @param config staleness config for the series (if undefined, caller must provide default)
 * @param now optional current time override (ISO string or Date); defaults to now
 */
export function evaluateSeriesStaleness(
  seriesId: string,
  retrievedAtUtc: string | undefined | null,
  config: StalenessConfig | undefined,
  now?: string | Date,
): StalenessEvaluation {
  const result: StalenessEvaluation = { seriesId, state: ReferenceDataState.UNAVAILABLE };
  if (!retrievedAtUtc) {
    result.state = ReferenceDataState.UNAVAILABLE;
    result.note = 'No retrieval record';
    return result;
  }

  if (!config) {
    // safe default: mark as stale if older than 24 hours (86400 seconds)
    config = { maxAgeSeconds: 86400 };
  }

  const nowMs = now ? new Date(now).getTime() : Date.now();
  const retrievedMs = new Date(retrievedAtUtc).getTime();
  if (isNaN(retrievedMs)) {
    result.state = ReferenceDataState.UNAVAILABLE;
    result.note = 'Invalid retrievedAtUtc';
    return result;
  }

  const ageSeconds = Math.floor((nowMs - retrievedMs) / 1000);
  result.ageSeconds = ageSeconds;
  result.maxAllowedSeconds = config.maxAgeSeconds;

  if (ageSeconds <= config.maxAgeSeconds) {
    result.state = ReferenceDataState.FRESH;
    result.note = `Age ${ageSeconds}s within allowed ${config.maxAgeSeconds}s`;
  } else {
    result.state = ReferenceDataState.STALE;
    result.note = `Age ${ageSeconds}s exceeds allowed ${config.maxAgeSeconds}s`;
  }

  return result;
}

/**
 * Given a set of evaluations, determine whether automated policy changes that
 * depend on these series should be allowed.
 *
 * Policy: If any series required for a policy is STALE or UNAVAILABLE, block
 * automated changes and require human approval.
 */
export function allowAutomatedPolicyChange(evals: StalenessEvaluation[], requiredSeries: string[] | undefined): { allowed: boolean; blocking: StalenessEvaluation[] } {
  // If requiredSeries is provided, focus on that set; otherwise consider all evals
  const map = new Map(evals.map(e => [e.seriesId, e]));
  const toCheck = requiredSeries ? requiredSeries.map(id => map.get(id)).filter(Boolean) as StalenessEvaluation[] : evals;

  const blocking = toCheck.filter(e => e.state !== ReferenceDataState.FRESH);
  return { allowed: blocking.length === 0, blocking };
}

/**
 * Helper: build per-series evaluation from mirror records map and config map.
 * @param mirrorRecords map seriesId -> retrievedAtUtc (ISO strings)
 * @param configs map seriesId -> StalenessConfig
 */
export function evaluateAllFromMirror(mirrorRecords: Record<string, string | undefined>, configs: Record<string, StalenessConfig>, now?: string | Date): StalenessEvaluation[] {
  const evals: StalenessEvaluation[] = [];
  for (const [seriesId, retrieved] of Object.entries(mirrorRecords)) {
    const cfg = configs[seriesId] ?? configs['__default'];
    evals.push(evaluateSeriesStaleness(seriesId, retrieved, cfg, now));
  }
  // also include configured series that are missing in mirrorRecords
  for (const seriesId of Object.keys(configs)) {
    if (seriesId === '__default') continue;
    if (!(seriesId in mirrorRecords)) {
      evals.push(evaluateSeriesStaleness(seriesId, undefined, configs[seriesId], now));
    }
  }
  return evals;
}

export default {
  ReferenceDataState,
  evaluateSeriesStaleness,
  allowAutomatedPolicyChange,
  evaluateAllFromMirror,
};
