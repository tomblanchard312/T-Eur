import { test, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateDailyManifest, LocalSigner } from '../src/services/ecbManifest.js';

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