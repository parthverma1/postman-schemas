import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compiledSchema, schemaVersions } from './helpers';
import { SCHEMA_TRANSFORMS, transformForViewer } from '../scripts/schema-transforms/index';
import { writeSchemas } from '../scripts/generate-schemas.mjs';
import { VIEWER_DRAFT } from '../scripts/legacy-urls';

const versions = schemaVersions();
const idOf = ({ draft, version }: { draft: string; version: string }) => ({ resource: 'collection', draft, version });

describe('transformForViewer', () => {
  it.each(versions.map((v) => ({ ...v, label: `${v.draft}/${v.version}` })))('does not mutate $label', (v) => {
    const source = compiledSchema(v);
    const copy = structuredClone(source);
    const result = transformForViewer(source, idOf(v));

    expect(source).toEqual(copy);
    expect(result).not.toBe(source);
  });

  it('returns an equal copy for a schema with no registered transforms', () => {
    const id = { resource: 'collection', draft: 'draft-07', version: 'v0.0.0-unregistered' };
    // Global transforms still run, so keep this sample free of anything they change
    // (e.g. no required-only anyOf for foldRequiredAnyOf).
    const source = {
      title: 'x',
      definitions: { a: { type: 'string' } },
      properties: { a: { $ref: '#/definitions/a' } },
    };

    expect(SCHEMA_TRANSFORMS[`${id.resource}/${id.draft}/${id.version}`]).toBeUndefined();

    const result = transformForViewer(source, id);

    expect(result).toEqual(source);
    expect(result).not.toBe(source);
    expect(result.definitions).not.toBe(source.definitions);
  });
});

describe('generated output', () => {
  let tmp: string;

  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-transforms-'));
    writeSchemas({ publicDir: path.join(tmp, 'public'), schemaOutDir: path.join(tmp, 'schemas') });
  });

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('covers every schema', () => {
    expect(versions).toHaveLength(12);
  });

  it('applies viewer-only changes to the bundle, not the raw download (v2.1.0 variable fold)', () => {
    const read = (...parts: string[]) => JSON.parse(fs.readFileSync(path.join(tmp, ...parts), 'utf8'));
    const variable = (schema: { definitions: Record<string, Record<string, unknown>> }) => schema.definitions.variable;
    const viewer = read('schemas', 'collection', 'draft-07', 'v2.1.0.json');
    const raw = read('public', 'collection', 'json', 'v2.1.0', 'draft-07', 'collection.json');

    expect(variable(viewer)).not.toHaveProperty('anyOf');
    expect(variable(viewer).requiredAnyOf).toEqual([['id'], ['key']]);
    expect(variable(raw).anyOf).toEqual([{ required: ['id'] }, { required: ['key'] }, { required: ['id', 'key'] }]);
    expect(variable(raw)).not.toHaveProperty('requiredAnyOf');
  });

  describe.each(versions.map((v) => ({ ...v, label: `${v.draft}/${v.version}` })))('$label', (v) => {
    const read = (...parts: string[]) => JSON.parse(fs.readFileSync(path.join(tmp, ...parts), 'utf8'));
    const viewerFile = ['schemas', 'collection', v.draft, `${v.version}.json`];

    it('raw download is the compiled original', () => {
      expect(read('public', 'collection', 'json', v.version, v.draft, 'collection.json')).toEqual(compiledSchema(v));
    });

    it(v.draft === VIEWER_DRAFT ? 'viewer bundle is transformForViewer(original)' : 'has no viewer bundle', () => {
      if (v.draft === VIEWER_DRAFT) {
        expect(read(...viewerFile)).toEqual(transformForViewer(compiledSchema(v), idOf(v)));
      } else {
        expect(fs.existsSync(path.join(tmp, ...viewerFile))).toBe(false);
      }
    });
  });
});
