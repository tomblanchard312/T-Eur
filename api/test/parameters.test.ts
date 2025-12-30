import { test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';

test('parameters.json validates against parameters-manifest.json', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const paramsPath = path.join(repoRoot, 'envs', 'lab', 'ecb-core', 'parameters.json');
  const schemaPath = path.join(repoRoot, 'docs', 'parameters-manifest.json');

  const paramsRaw = fs.readFileSync(paramsPath, 'utf8');
  const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
  const params = JSON.parse(paramsRaw);
  const schema = JSON.parse(schemaRaw);

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as object);
  const valid = validate(params);
  if (!valid) {
    // include errors in test failure output
    // eslint-disable-next-line no-console
    console.error('Schema validation errors:', validate.errors);
  }
  expect(valid).toBe(true);
});
