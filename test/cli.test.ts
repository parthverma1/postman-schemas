import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, SCHEMA_DIR, EXAMPLE_DIR } from './helpers';

const run = (script: string, args: string[]) =>
  spawnSync(process.execPath, [path.join(ROOT, 'bin', script), ...args], { cwd: ROOT, encoding: 'utf8' });

const schemaArgs = (draft: string, version: string) => {
  const schemaDir = path.join(SCHEMA_DIR, draft, version);

  return ['--schema', path.join(schemaDir, 'collection.json'), '--schema-dir', schemaDir];
};

let tmp: string;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('bin/validate.js', () => {
  it('exits 0 for a valid draft-07 example', () => {
    const res = run('validate.js', [
      '--input',
      path.join(EXAMPLE_DIR, 'draft-07', 'v2.1.0', 'collection.json'),
      ...schemaArgs('draft-07', 'v2.1.0'),
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Validation successful');
  });

  it('infers draft-04 from $schema when --draft-version is omitted', () => {
    const res = run('validate.js', [
      '--input',
      path.join(EXAMPLE_DIR, 'draft-04', 'v2.1.0', 'collection.json'),
      ...schemaArgs('draft-04', 'v2.1.0'),
    ]);

    expect(res.status).toBe(0);
    expect(res.stdout).toContain('Validation successful');
  });

  it('exits 1 when validation fails', () => {
    const input = path.join(tmp, 'empty.json');

    fs.writeFileSync(input, '{}');

    const res = run('validate.js', ['--input', input, ...schemaArgs('draft-07', 'v2.1.0')]);

    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Validation failed');
  });

  it('rejects an unknown draft version with a clear message and no stack', () => {
    const res = run('validate.js', [
      '--input',
      path.join(EXAMPLE_DIR, 'draft-07', 'v2.1.0', 'collection.json'),
      ...schemaArgs('draft-07', 'v2.1.0'),
      '--draft-version',
      'draft-99',
    ]);

    expect(res.status).not.toBe(0);
    expect(res.stderr).toContain('Unsupported draft version: draft-99');
    expect(res.stderr).not.toMatch(/\n\s+at /);
  });
});

describe('bin/compile.js', () => {
  it('infers draft-04 from $schema when --draft-version is omitted', () => {
    const output = path.join(tmp, 'compiled.json');
    const res = run('compile.js', ['--output', output, ...schemaArgs('draft-04', 'v2.1.0')]);

    expect(res.status).toBe(0);
    expect(Object.keys(JSON.parse(fs.readFileSync(output, 'utf8')).definitions)).toHaveLength(23);
  });
});
