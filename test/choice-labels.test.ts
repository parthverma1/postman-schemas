import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { writeSchemas } from '../scripts/generate-schemas.mjs';
import { buildSerializedTree, deserializeTree } from '../packages/json-schema-viewer/src/worker';
import { buildChoices } from '../packages/json-schema-viewer/src/components/SchemaRow/useChoices';
import type { JSONSchema } from '../packages/json-schema-viewer/src/types';

type SchemaNode = Parameters<typeof buildChoices>[0];

const VERSIONS = ['v1.0.0', 'v2.0.0', 'v2.1.0', 'v3.0.0'];
// The schemas are recursive (item → item-group → item ...); mirrored nodes are
// skipped and the depth is capped so the walk always ends.
const MAX_DEPTH = 40;

type ChoiceSet = { path: string; node: SchemaNode; titles: string[]; types: SchemaNode[] };

let tmp: string;
const trees: Record<string, SchemaNode> = {};

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'choice-labels-'));
  const schemaOutDir = path.join(tmp, 'schemas');
  writeSchemas({ publicDir: path.join(tmp, 'public'), schemaOutDir });

  for (const version of VERSIONS) {
    const file = path.join(schemaOutDir, 'collection', 'draft-07', `${version}.json`);
    const schema = JSON.parse(fs.readFileSync(file, 'utf8')) as JSONSchema;
    trees[version] = deserializeTree(buildSerializedTree(schema).tree);
  }
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function nodes(root: SchemaNode): SchemaNode[] {
  const seen = new Set<SchemaNode>();
  const out: SchemaNode[] = [];
  const visit = (node: SchemaNode, depth: number) => {
    if (seen.has(node) || 'mirroredNode' in node || depth > MAX_DEPTH) return;
    seen.add(node);
    out.push(node);
    for (const child of ('children' in node && node.children) || []) visit(child, depth + 1);
  };
  visit(root, 0);
  return out;
}

function choiceSets(version: string): ChoiceSet[] {
  return nodes(trees[version])
    .map(node => ({ node, choices: buildChoices(node) }))
    .filter(({ choices }) => choices.length > 1)
    .map(({ node, choices }) => ({
      path: node.path.join('/'),
      node,
      titles: choices.map(c => c.title),
      types: choices.map(c => c.type),
    }));
}

/** Choice titles of every choice set whose node path ends with `suffix`. */
function titlesAt(version: string, suffix: string): string[][] {
  const sets = choiceSets(version).filter(set => set.path.endsWith(suffix));
  expect(sets.length, `${version} ${suffix}`).toBeGreaterThan(0);
  return sets.map(set => set.titles);
}

/** Every regular node whose path ends with `suffix`. */
function nodesAt(version: string, suffix: string): SchemaNode[] {
  const found = nodes(trees[version]).filter(node => node.path.join('/').endsWith(suffix));
  expect(found.length, `${version} ${suffix}`).toBeGreaterThan(0);
  return found;
}

describe.each(VERSIONS)('%s', version => {
  it('has choice sets to check', () => {
    expect(choiceSets(version).length).toBeGreaterThan(5);
  });

  it('never repeats a label within a dropdown', () => {
    for (const { path: at, titles } of choiceSets(version)) {
      expect(new Set(titles).size, `${at}: ${JSON.stringify(titles)}`).toBe(titles.length);
    }
  });

  it('only offers combiner branches as choices', () => {
    for (const { path: at, types } of choiceSets(version)) {
      for (const type of types) {
        expect(['anyOf', 'oneOf'], `${at} → ${type.path.join('/')}`).toContain(type.subpath[0]);
      }
    }
  });
});

describe('constraint-only anyOf (required keys only) is folded into the node', () => {
  const variableCases = [
    ['v1.0.0', 'properties/variables/oneOf/0/items'],
    ['v2.0.0', 'properties/item/items/oneOf/0/properties/variable/items'],
    ['v2.1.0', 'properties/item/items/oneOf/0/properties/variable/items'],
  ];

  it.each(variableCases)('%s variable: one choice, "Requires id or key"', (version, at) => {
    for (const node of nodesAt(version, at)) {
      expect(buildChoices(node)).toHaveLength(1);
      expect(buildChoices(node.parent!)).toHaveLength(1);
      expect(node.fragment).toMatchObject({ required: [], requiredAnyOf: [['id'], ['key']] });
      expect(node.fragment).not.toHaveProperty('anyOf');
    }
  });

  it('v1.0.0 requests: one choice, shared keys required, "Requires collectionId or collection"', () => {
    for (const node of nodesAt('v1.0.0', 'properties/requests/items')) {
      expect(buildChoices(node)).toHaveLength(1);
      expect(buildChoices(node.parent!)).toHaveLength(1);
      expect(node.fragment).toMatchObject({
        required: ['id', 'method', 'url', 'headers', 'name'],
        requiredAnyOf: [['collectionId'], ['collection']],
      });
    }
  });

  it('leaves no requiredAnyOf on v3.0.0 (it has no constraint-only anyOf)', () => {
    expect(nodes(trees['v3.0.0']).some(node => 'requiredAnyOf' in (node.fragment as object))).toBe(false);
  });
});

describe('colliding labels get distinct, meaningful names', () => {
  it.each([
    // A title that repeats the parent's → the type name.
    ['v1.0.0', 'properties/script/properties/src', ['object', 'string']],
    ['v2.0.0', 'properties/info/properties/version', ['object', 'string']],
    ['v2.1.0', 'properties/info/properties/version', ['object', 'string']],
    ['v2.1.0', 'properties/script/properties/src', ['object', 'string']],
    ['v2.1.0', 'oneOf/0/properties/request', ['object', 'string']],
    ['v2.1.0', 'request/oneOf/0/properties/url', ['object', 'string']],
    ['v2.1.0', 'properties/originalRequest', ['object', 'string']],
    ['v2.0.0', 'response/items/properties/header', ['array[oneOf]', 'string', 'null']],
    ['v2.1.0', 'response/items/properties/header/oneOf/0', ['objects', 'strings']],
    // const → its value; enum → "<type> (enum)".
    ['v1.0.0', 'properties/requests/items/properties/method', ['string (enum)', 'string']],
    ['v2.1.0', 'request/oneOf/0/properties/method', ['string (enum)', 'string']],
    ['v3.0.0', 'properties/settings/properties/maxResponseSize', ['number', 'null']],
    ['v3.0.0', 'properties/settings/properties/maxHeaderSize', ['number', 'null']],
    // Objects told apart by a const property.
    ['v1.0.0', 'properties/requests/items/properties/data/oneOf/0', ['type: text', 'type: file']],
    ['v2.0.0', 'properties/body/oneOf/0/properties/formdata', ['type: text', 'type: file']],
    ['v2.1.0', 'properties/body/oneOf/0/properties/formdata', ['type: text', 'type: file']],
  ] as const)('%s …%s', (version, at, expected) => {
    for (const titles of titlesAt(version, at)) {
      expect(titles).toEqual(expected);
    }
  });

  it('keeps labels that do not collide, e.g. v2.1.0 item and auth', () => {
    for (const titles of titlesAt('v2.1.0', 'properties/item')) expect(titles).toEqual(['Folder', 'Item']);
    for (const titles of titlesAt('v2.1.0', 'oneOf/0/properties/auth')) expect(titles).toEqual(['null', 'Auth']);
  });
});
