import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAjv, ROOT } from './helpers';
import { FS_KINDS, FS_PACKAGE, FS_SOURCE_FILES, FS_VERSION, fsSchemaPath, type FsKind } from '../scripts/fs-schemas';
import { SCHEMA_BASE_URL } from '../src/lib/site';
import { writeSchemas } from '../scripts/generate-schemas.mjs';

const yaml: { load(text: string): unknown } = createRequire(import.meta.url)('js-yaml');

const FIXTURES = path.join(ROOT, 'test', 'fixtures', 'fs', FS_VERSION);
const KINDS = Object.keys(FS_KINDS) as FsKind[];
const kindsMatching = (rel: string): FsKind[] => KINDS.filter((k) => path.matchesGlob(rel, FS_KINDS[k].glob));

let tmp: string;
const published = (kind: FsKind) =>
  JSON.parse(fs.readFileSync(path.join(tmp, 'public', fsSchemaPath(kind)), 'utf8')) as Record<string, unknown>;

function vendored(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(ROOT, FS_PACKAGE.dir, file), 'utf8'));
}

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-schemas-'));
  writeSchemas({ publicDir: path.join(tmp, 'public'), schemaOutDir: path.join(tmp, 'schemas') });
});

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

it('publishes exactly the four FS schema URLs', () => {
  expect(KINDS.map(fsSchemaPath)).toEqual([
    '/collection/v3.0.0/fs/definition.json',
    '/collection/v3.0.0/fs/request.json',
    '/collection/v3.0.0/fs/example.json',
    '/collection/v3.0.0/fs/message.json',
  ]);
});

it.each(KINDS)('serves %s.json as draft-07 with its own URL as $id', (kind) => {
  expect(published(kind).$schema).toBe('http://json-schema.org/draft-07/schema#');
  expect(published(kind).$id).toBe(`${SCHEMA_BASE_URL}${fsSchemaPath(kind)}`);
});

it.each(['request', 'example', 'message'] as const)('serves %s.json as the package file plus $id, title and description', (kind) => {
  const { $id, title, description, ...rest } = published(kind);
  expect(rest).toEqual(vendored(FS_KINDS[kind].packageFiles[0]));
});

it('serves definition.json as anyOf [collection.json, folder.json]', () => {
  const collection = vendored(FS_KINDS.definition.packageFiles[0]);
  const folder = vendored(FS_KINDS.definition.packageFiles[1]);
  const { $schema, ...collectionRest } = collection;
  const { $schema: _, ...folderRest } = folder;
  expect(published('definition').anyOf).toEqual([collectionRest, folderRest]);
});

it('vendors exactly the package files the kinds read, plus provenance.json', () => {
  const files = fs.readdirSync(path.join(ROOT, FS_PACKAGE.dir, 'schemas'), { recursive: true });
  const all = [...files].map((f) => `schemas/${f}`).filter((f) => f.endsWith('.json'));
  expect([...all, 'provenance.json'].sort()).toEqual([...FS_SOURCE_FILES, 'provenance.json'].sort());
});

it('records the package name, version and integrity that produced the vendored files', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(ROOT, FS_PACKAGE.dir, 'provenance.json'), 'utf8'));
  expect(provenance.name).toBe('@postman/v3.schemas');
  expect(provenance.version).toMatch(/^\d+\.\d+\.\d+$/);
  expect(provenance.integrity).toMatch(/^sha512-/);
  expect(Object.keys(provenance).sort()).toEqual(['integrity', 'name', 'version']);
});

it('covers every FS_KINDS glob with at least one fixture, each fixture matching exactly one', () => {
  const fixtures = fixtureFiles();
  const matched = new Set<FsKind>();
  for (const rel of fixtures) {
    const kinds = kindsMatching(rel);
    expect(kinds).toHaveLength(1);
    matched.add(kinds[0]);
  }
  expect(matched).toEqual(new Set(KINDS));
});

describe.each(fixtureFiles().map((rel) => ({ rel })))('$rel', ({ rel }) => {
  const kind = kindsMatching(rel)[0];

  it('declares, in its modeline, the schema its file name selects', () => {
    const text = fs.readFileSync(path.join(FIXTURES, rel), 'utf8');
    const firstLine = text.split('\n')[0];
    expect(firstLine).toBe(`# yaml-language-server: $schema=${SCHEMA_BASE_URL}${fsSchemaPath(kind)}`);
  });

  it('validates against that schema with the repo Ajv 6', () => {
    const text = fs.readFileSync(path.join(FIXTURES, rel), 'utf8');
    const validate = createAjv('draft-07').compile(published(kind)) as (data: unknown) => boolean;
    expect(validate(yaml.load(text))).toBe(true);
  });
});

const WRONG: Record<FsKind, object> = {
  definition: { $kind: 'folder', name: 'Users' },
  request: { $kind: 'collection', name: 'Users' },
  example: { $kind: 'http-example', name: 'Created' },
  message: { $kind: 'websocket-message', name: 'Hello' },
};

it.each(KINDS)('%s.json rejects a file of the wrong shape', (kind) => {
  const validate = createAjv('draft-07').compile(published(kind)) as (data: unknown) => boolean;
  expect(validate(WRONG[kind])).toBe(false);
});

it('definition.json accepts a minimal { $kind: collection, name } (anyOf, not oneOf)', () => {
  const validate = createAjv('draft-07').compile(published('definition')) as (data: unknown) => boolean;
  expect(validate({ $kind: 'collection', name: 'Test' })).toBe(true);
});

it('definition.json rejects collection-only variables mixed with folder-only order', () => {
  const validate = createAjv('draft-07').compile(published('definition')) as (data: unknown) => boolean;
  expect(validate({ $kind: 'collection', name: 'X', variables: [], order: 1 })).toBe(false);
});

function fixtureFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string, base: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(base, entry.name);
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
        files.push(rel);
      }
    }
  };
  walk(FIXTURES, '');
  return files.sort();
}
