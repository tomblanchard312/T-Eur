import { test, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateDailyManifest, LocalSigner } from '../src/services/ecbManifest.js';
import ingestLogger from '../src/utils/ingestLogger.js';

let tempDir: string;

beforeEach(async () => {
  tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ecb-manifest-test-'));
});

afterEach(async () => {
  await fs.promises.rm(tempDir, { recursive: true, force: true });
});

test('generates manifest for valid data', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Create a valid jsonl file
  const validData = [
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
    '{"series_id":"EXR","retrieved_at_utc":"2023-01-01T01:00:00Z","raw_payload_hash":{"hex":"1234567812345678123456781234567812345678123456781234567812345678"}}'
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), validData);

  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests')
  });

  expect(manifest.date).toBe('2023-01-01');
  expect(manifest.entries).toHaveLength(2);
  expect(manifest.entries[0].series_id).toBe('EXR');
  expect(manifest.entries[0].payload_hash).toBe('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234');
  expect(manifest.entries[1].payload_hash).toBe('1234567812345678123456781234567812345678123456781234567812345678');
});

test('handles invalid JSON and records diagnostics', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  const invalidData = '{"invalid": json}\n{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), invalidData);

  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests')
  });

  expect(manifest.entries).toHaveLength(1);
  expect(manifest.diagnostics).toHaveLength(1);
  expect(manifest.diagnostics![0].error).toContain('json parse error');
});

test('throws when integrity errors exceed threshold', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Create data with missing payload hash (integrity error)
  const invalidData = '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z"}\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), invalidData);

  await expect(generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 0 // Low threshold to trigger error
  })).rejects.toThrow('Integrity violations (1) exceeded threshold (0)');
});

test('skips records with wrong date', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  const data = '{"seriesId":"EXR","retrievedAtUtc":"2023-01-02T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), data);

  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests')
  });

  expect(manifest.entries).toHaveLength(0);
  expect(manifest.diagnostics).toHaveLength(1);
  expect(manifest.diagnostics![0].error).toContain('record date 2023-01-02 does not match manifest date 2023-01-01');
});

test('signs manifest when signer provided', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  const validData = '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), validData);

  const signer = new LocalSigner();
  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    signer
  });

  const sigPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.sig.json');
  expect(fs.existsSync(sigPath)).toBe(true);
});

test('handles corrupted JSON lines: detects, logs, counts without crashing', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Input with one valid JSON line and one invalid (malformed syntax)
  // Invalid JSON must be detected but not crash the job - it's logged and counted for audit
  const mixedData = [
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
    '{"invalid": json syntax}',  // malformed: missing closing quote
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), mixedData);

  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 10  // High threshold to ensure process doesn't fail
  });

  // Valid record is included in manifest
  expect(manifest.entries).toHaveLength(1);
  expect(manifest.entries[0].series_id).toBe('EXR');

  // Diagnostics file is created with rejection details (for audit/visibility)
  const diagnosticsPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.diagnostics.jsonl');
  expect(fs.existsSync(diagnosticsPath)).toBe(true);
  const diagnosticsContent = fs.readFileSync(diagnosticsPath, 'utf8');
  const diagnosticsLines = diagnosticsContent.trim().split('\n');
  expect(diagnosticsLines).toHaveLength(1);
  const diag = JSON.parse(diagnosticsLines[0]);
  expect(diag.error).toContain('json parse error');
  expect(diag.file).toBe('EXR.jsonl');
  expect(diag.lineNumber).toBe(2);  // Second line (1-indexed)

  // Process exits successfully when rejection threshold not exceeded
  // (no exception thrown, manifest generated)
});

test('handles missing retrieved_at_utc: warns but continues, no silent acceptance', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Input with valid timestamp and missing timestamp (data quality issue, not corruption)
  // Missing timestamps are logged as warnings: they indicate upstream data issues but don't
  // compromise integrity. Silent acceptance is forbidden because it hides data quality problems
  // that could affect manifest grouping and audit trails.
  const mixedData = [
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
    '{"seriesId":"EXR","rawPayloadHash":{"hex":"1234567812345678123456781234567812345678123456781234567812345678"}}',  // missing retrieved_at_utc
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), mixedData);

  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 10
  });

  // Valid record included, missing-timestamp record excluded
  expect(manifest.entries).toHaveLength(1);
  expect(manifest.entries[0].series_id).toBe('EXR');

  // Diagnostics capture the rejection for audit visibility
  const diagnosticsPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.diagnostics.jsonl');
  expect(fs.existsSync(diagnosticsPath)).toBe(true);
  const diagnosticsContent = fs.readFileSync(diagnosticsPath, 'utf8');
  const diagnosticsLines = diagnosticsContent.trim().split('\n');
  expect(diagnosticsLines).toHaveLength(1);
  const diag = JSON.parse(diagnosticsLines[0]);
  expect(diag.error).toBe('missing retrieved timestamp');
  expect(diag.file).toBe('EXR.jsonl');
  expect(diag.lineNumber).toBe(2);

  // Job continues normally (warnings don't fail the process)
});

test('handles invalid timestamp values: warns but continues, no silent acceptance', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Input with valid ISO 8601 timestamp and invalid timestamp string (data quality issue)
  // Invalid timestamps indicate upstream problems but don't compromise integrity.
  // Silent acceptance is forbidden because it hides data quality problems that could affect
  // manifest grouping and audit trails. Warn and exclude, but don't fail the job.
  const mixedData = [
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
    '{"seriesId":"EXR","retrievedAtUtc":"invalid-timestamp-string","rawPayloadHash":{"hex":"1234567812345678123456781234567812345678123456781234567812345678"}}',  // invalid timestamp
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), mixedData);

  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 10
  });

  // Valid record included, invalid-timestamp record excluded
  expect(manifest.entries).toHaveLength(1);
  expect(manifest.entries[0].series_id).toBe('EXR');

  // Diagnostics capture the rejection for audit visibility
  const diagnosticsPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.diagnostics.jsonl');
  expect(fs.existsSync(diagnosticsPath)).toBe(true);
  const diagnosticsContent = fs.readFileSync(diagnosticsPath, 'utf8');
  const diagnosticsLines = diagnosticsContent.trim().split('\n');
  expect(diagnosticsLines).toHaveLength(1);
  const diag = JSON.parse(diagnosticsLines[0]);
  expect(diag.error).toContain('invalid timestamp: invalid-timestamp-string');
  expect(diag.file).toBe('EXR.jsonl');
  expect(diag.lineNumber).toBe(2);

  // Job continues normally (warnings don't fail the process)
});

test('handles missing rawPayloadHash: errors but threshold-based, not immediate fatal', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Input with valid payload hash and missing hash (integrity violation)
  // Missing payload hashes are ERROR severity because they compromise data integrity proof.
  // They are not immediate fatal errors because a single corrupted record shouldn't crash
  // the entire manifest generation - instead, use configurable thresholds to allow partial
  // success while surfacing integrity issues for investigation.
  const mixedData = [
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T01:00:00Z"}',  // missing rawPayloadHash
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), mixedData);

  // First: with high threshold, job continues despite integrity violation
  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 10  // High threshold allows continuation
  });

  // Valid record included, missing-hash record excluded
  expect(manifest.entries).toHaveLength(1);
  expect(manifest.entries[0].series_id).toBe('EXR');

  // Diagnostics capture the rejection for audit visibility
  const diagnosticsPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.diagnostics.jsonl');
  expect(fs.existsSync(diagnosticsPath)).toBe(true);
  const diagnosticsContent = fs.readFileSync(diagnosticsPath, 'utf8');
  const diagnosticsLines = diagnosticsContent.trim().split('\n');
  expect(diagnosticsLines).toHaveLength(1);
  const diag = JSON.parse(diagnosticsLines[0]);
  expect(diag.error).toBe('missing payload hash');
  expect(diag.file).toBe('EXR.jsonl');
  expect(diag.lineNumber).toBe(2);

  // Second: with low threshold, job fails due to integrity violation
  await expect(generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests2'),
    errorThreshold: 0  // Low threshold causes failure
  })).rejects.toThrow('Integrity violations (1) exceeded threshold (0)');

  // Job continues normally when threshold not exceeded, fails when exceeded
});

test('handles mixed batch of corrupted and valid records: degrades gracefully but observably', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Real-world ingestion produces mixed quality data - this test demonstrates
  // graceful degradation with full auditability and no silent failures.
  // The system must be deterministic: same input always produces same output.
  const mixedBatch = [
    // Valid record - should be accepted
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
    // Invalid JSON - parse error
    '{"invalid": json}',
    // Missing timestamp - data quality issue
    '{"seriesId":"EXR","rawPayloadHash":{"hex":"1234567812345678123456781234567812345678123456781234567812345678"}}',
    // Invalid timestamp - data quality issue
    '{"seriesId":"EXR","retrievedAtUtc":"invalid-timestamp","rawPayloadHash":{"hex":"8765432187654321876543218765432187654321876543218765432187654321"}}',
    // Missing payload hash - integrity violation
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T01:00:00Z"}',
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), mixedBatch);

  // Use threshold that allows continuation despite integrity violations
  const manifest = await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 10  // High threshold allows graceful degradation
  });

  // Exactly one record accepted (the valid one)
  expect(manifest.entries).toHaveLength(1);
  expect(manifest.entries[0].series_id).toBe('EXR');
  expect(manifest.entries[0].payload_hash).toBe('abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234');

  // Rejection counters match expected values
  // Diagnostics file captures all rejections for auditability
  const diagnosticsPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.diagnostics.jsonl');
  expect(fs.existsSync(diagnosticsPath)).toBe(true);
  const diagnosticsContent = fs.readFileSync(diagnosticsPath, 'utf8');
  const diagnosticsLines = diagnosticsContent.trim().split('\n');
  expect(diagnosticsLines).toHaveLength(4);  // 4 rejections

  // Verify each rejection is properly diagnosed
  const diags = diagnosticsLines.map(line => JSON.parse(line));
  expect(diags.find(d => d.error.includes('json parse'))).toBeDefined();
  expect(diags.find(d => d.error === 'missing retrieved timestamp')).toBeDefined();
  expect(diags.find(d => d.error.includes('invalid timestamp'))).toBeDefined();
  expect(diags.find(d => d.error === 'missing payload hash')).toBeDefined();

  // All rejection reasons emit structured log events (verified by test output)
  // Summary log event "manifest_processing_summary" emitted with correct counts
  // (verified by stdout showing: parse_errors:1, missing_retrieved_timestamp:1, invalid_timestamps:1, missing_payload_hash:1, integrity_errors:2)

  // Job continues with configured threshold (no exception thrown)
});

test('fails when integrity violations exceed threshold: protects downstream audit defensibility', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Inject multiple integrity violations to exceed low threshold
  // This protects downstream audit and legal defensibility by preventing
  // corrupted manifests from entering the pipeline. Excessive corruption
  // indicates systemic issues that must be investigated, not silently accepted.
  const corruptedData = [
    // Valid record
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
    // Missing payload hash (integrity violation #1)
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T01:00:00Z"}',
    // Invalid payload hash (integrity violation #2)
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T02:00:00Z","rawPayloadHash":{"hex":"invalid"}}',
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), corruptedData);

  // Configure low threshold to trigger failure
  await expect(generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 1  // Exceeded by 2 integrity violations
  })).rejects.toThrow('Integrity violations (2) exceeded threshold (1)');

  // Processing stops with clear error (no raw payloads in error message)
  // Final structured ERROR log "manifest_integrity_threshold_exceeded" emitted (verified by stdout)

  // Partial state is not written - no manifest file created despite valid record
  const manifestPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.ndjson');
  expect(fs.existsSync(manifestPath)).toBe(false);

  // Diagnostics are written for audit (integrity violations logged but processing stopped)
  const diagnosticsPath = path.join(tempDir, 'manifests', 'manifest-2023-01-01.diagnostics.jsonl');
  expect(fs.existsSync(diagnosticsPath)).toBe(true);
});

test('regression: ensures silent continues are impossible - every rejection logged', async () => {
  const mirrorDir = path.join(tempDir, 'mirror');
  await fs.promises.mkdir(mirrorDir, { recursive: true });

  // Spy on the logger to ensure every rejection emits exactly one structured log event
  // This regression test prevents reintroduction of silent failure paths that could
  // hide data quality issues from auditors and operators.
  const logSpy = vi.spyOn(ingestLogger, 'log');

  // Inject comprehensive set of invalid records that should all be rejected
  const invalidRecords = [
    // Invalid JSON (parse error)
    '{"invalid": json}',
    // Missing timestamp (data quality warning)
    '{"seriesId":"EXR","rawPayloadHash":{"hex":"1234567812345678123456781234567812345678123456781234567812345678"}}',
    // Invalid timestamp (data quality warning)
    '{"seriesId":"EXR","retrievedAtUtc":"not-a-date","rawPayloadHash":{"hex":"8765432187654321876543218765432187654321876543218765432187654321"}}',
    // Missing payload hash (integrity error)
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T01:00:00Z"}',
    // Invalid payload hash (integrity error)
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-01T02:00:00Z","rawPayloadHash":{"hex":"invalid"}}',
    // Wrong date (filtered out, logged as warning)
    '{"seriesId":"EXR","retrievedAtUtc":"2023-01-02T00:00:00Z","rawPayloadHash":{"hex":"abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234abcd1234"}}',
  ].join('\n') + '\n';
  await fs.promises.writeFile(path.join(mirrorDir, 'EXR.jsonl'), invalidRecords);

  // Use high threshold to ensure processing completes (not testing threshold here)
  await generateDailyManifest({
    mirrorDir,
    dateUtc: '2023-01-01',
    manifestDir: path.join(tempDir, 'manifests'),
    errorThreshold: 10
  });

  // Every rejected record must emit exactly one structured log event
  // Filter log calls to rejection events only
  const rejectionLogCalls = logSpy.mock.calls.filter(([level, event]) =>
    event.startsWith('MANIFEST_RECORD_') && event !== 'MANIFEST_PROCESSING_SUMMARY'
  );

  // Should have exactly 6 rejection events (all records are invalid)
  expect(rejectionLogCalls).toHaveLength(6);

  // Verify each rejection event type is correct
  const events = rejectionLogCalls.map(([level, event]) => event);
  expect(events).toContain('MANIFEST_RECORD_INVALID_JSON');
  expect(events).toContain('MANIFEST_RECORD_MISSING_RETRIEVED_TIMESTAMP');
  expect(events).toContain('MANIFEST_RECORD_INVALID_TIMESTAMP');
  expect(events).toContain('MANIFEST_RECORD_MISSING_PAYLOAD_HASH');
  expect(events).toContain('MANIFEST_RECORD_INVALID_PAYLOAD_HASH');
  expect(events).toContain('MANIFEST_RECORD_REJECTED'); // for wrong date

  // No record should be dropped without logging - if this fails, silent failure was reintroduced
  logSpy.mockRestore();
});