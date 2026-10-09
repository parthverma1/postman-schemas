import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compiledSchema, schemaVersions } from './helpers';
import { transformForViewer, type JsonObject } from '../scripts/schema-transforms/index';
import {
  DESCRIPTION_OVERRIDES,
  overrideDescriptions,
  resolvePointer,
  unwrapTitledRefs,
  unwrappedRef,
} from '../scripts/schema-transforms/collection-draft-07-v3.0.0';
import { writeSchemas } from '../scripts/generate-schemas.mjs';
import { VIEWER_DRAFT } from '../scripts/legacy-urls';

const versions = schemaVersions();
const v3 = versions.find((v) => v.draft === 'draft-07' && v.version === 'v3.0.0');

if (!v3) {
  throw new Error('schemas/draft-07/v3.0.0 not found');
}

const V3_ID = { resource: 'collection', draft: 'draft-07', version: 'v3.0.0' };
const v3Source = (): JsonObject => compiledSchema(v3);

const pointerOf = (keys: string[]): string =>
  keys.map((k) => `/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`).join('');

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Structural diff, classified: an object that became `{$ref}`, a changed description, or anything else. */
interface Changes {
  unwraps: string[];
  descriptions: string[];
  other: string[];
}

function diff(
  before: unknown,
  after: unknown,
  keys: string[] = [],
  out: Changes = { unwraps: [], descriptions: [], other: [] },
): Changes {
  if (JSON.stringify(before) === JSON.stringify(after)) {
    return out;
  }

  if (isObject(before) && 'allOf' in before && isObject(after) && Object.keys(after).join() === '$ref') {
    out.unwraps.push(pointerOf(keys));
  } else if (keys.at(-1) === 'description' && typeof before === 'string' && typeof after === 'string') {
    out.descriptions.push(pointerOf(keys.slice(0, -1)));
  } else if (isObject(before) && isObject(after)) {
    for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
      diff(before[k], after[k], [...keys, k], out);
    }
  } else if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((item, i) => diff(item, after[i], [...keys, String(i)], out));
  } else {
    out.other.push(pointerOf(keys));
  }

  return out;
}

describe('unwrappedRef', () => {
  const definitions = { auth: { title: 'Auth', type: 'object' } };

  it('unwraps {title, allOf: [{$ref}]} when the title matches the referenced definition', () => {
    expect(unwrappedRef({ title: 'Auth', allOf: [{ $ref: '#/definitions/auth' }] }, definitions)).toEqual({
      $ref: '#/definitions/auth',
    });
  });

  it('keeps the wrapper when the title differs', () => {
    const node = { title: 'Request auth', allOf: [{ $ref: '#/definitions/auth' }] };

    expect(unwrappedRef(node, definitions)).toBeUndefined();
  });

  it('keeps the wrapper when there are other keys', () => {
    for (const node of [
      { title: 'Auth', description: 'x', allOf: [{ $ref: '#/definitions/auth' }] },
      { title: 'Auth', allOf: [{ $ref: '#/definitions/auth', description: 'x' }] },
      { title: 'Auth', allOf: [{ $ref: '#/definitions/auth' }, { type: 'object' }] },
      { allOf: [{ $ref: '#/definitions/auth' }], type: 'object' },
    ]) {
      expect(unwrappedRef(node, definitions)).toBeUndefined();
    }
  });

  it('keeps the wrapper when the $ref is missing or not a local definition', () => {
    for (const $ref of ['#/definitions/missing', 'other.json#/definitions/auth']) {
      expect(unwrappedRef({ title: 'Auth', allOf: [{ $ref }] }, definitions)).toBeUndefined();
    }
  });

  it('unwraps nested sites and skips value keys', () => {
    const wrapper = { title: 'Auth', allOf: [{ $ref: '#/definitions/auth' }] };
    const schema = {
      definitions,
      properties: { a: wrapper, b: { items: wrapper }, c: { anyOf: [wrapper] }, d: { default: wrapper } },
    };

    expect(unwrapTitledRefs(structuredClone(schema)).properties).toEqual({
      a: { $ref: '#/definitions/auth' },
      b: { items: { $ref: '#/definitions/auth' } },
      c: { anyOf: [{ $ref: '#/definitions/auth' }] },
      d: { default: wrapper },
    });
  });
});

describe('collection/draft-07/v3.0.0 viewer transform', () => {
  it('makes exactly 35 unwraps and 13 description changes, nothing else', () => {
    const changes = diff(v3Source(), transformForViewer(v3Source(), V3_ID));

    expect(changes.unwraps).toHaveLength(35);
    expect(changes.descriptions.sort()).toEqual(DESCRIPTION_OVERRIDES.map((o) => o.pointer).sort());
    expect(changes.other).toEqual([]);
  });

  it('keeps the 5 wrappers whose title differs from the referenced definition', () => {
    const definitions = transformForViewer(v3Source(), V3_ID).definitions as Record<string, JsonObject>;

    for (const name of ['graphql', 'grpc', 'kafka', 'kafka-message', 'kafka-topic']) {
      expect(definitions[`v3-${name}-schema`].allOf).toEqual([{ $ref: '#/definitions/v3-schema' }]);
    }
  });

  it('has an override `from` matching every source description, and applies `to`', () => {
    const source = v3Source();
    const viewer = transformForViewer(source, V3_ID);
    const at = (root: JsonObject, pointer: string) => resolvePointer(root, pointer) as JsonObject;

    expect(DESCRIPTION_OVERRIDES).toHaveLength(13);

    for (const { pointer, from, to } of DESCRIPTION_OVERRIDES) {
      expect(at(source, pointer).description, pointer).toBe(from);
      expect(at(viewer, pointer).description, pointer).toBe(to);
    }
  });

  it('throws when a source description no longer matches `from`', () => {
    const source = v3Source();
    const [{ pointer }] = DESCRIPTION_OVERRIDES;

    (source.properties as Record<string, JsonObject>)[pointer.split('/')[2]].description = 'Edited upstream.';

    expect(() => overrideDescriptions(source)).toThrow(pointer);
  });

  it('does not mutate its input', () => {
    const source = v3Source();
    const copy = structuredClone(source);

    transformForViewer(source, V3_ID);

    expect(source).toEqual(copy);
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

  describe.each(versions.map((v) => ({ ...v, label: `${v.draft}/${v.version}` })))('$label', (v) => {
    const read = (...parts: string[]) => JSON.parse(fs.readFileSync(path.join(tmp, ...parts), 'utf8'));
    const viewerFile = ['schemas', 'collection', v.draft, `${v.version}.json`];

    it('raw download is the compiled original', () => {
      expect(read('public', 'collection', 'json', v.version, v.draft, 'collection.json')).toEqual(compiledSchema(v));
    });

    it(v.draft === VIEWER_DRAFT ? 'viewer bundle is transformForViewer(original)' : 'has no viewer bundle', () => {
      const id = { resource: 'collection', draft: v.draft, version: v.version };

      if (v.draft === VIEWER_DRAFT) {
        expect(read(...viewerFile)).toEqual(transformForViewer(compiledSchema(v), id));
      } else {
        expect(fs.existsSync(path.join(tmp, ...viewerFile))).toBe(false);
      }
    });
  });
});
