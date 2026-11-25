import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, schemaVersions } from './helpers';
import { FS_KINDS, fsSchemaPath, type FsKind } from '../scripts/fs-schemas.ts';
import { viewerPage, viewerRawPath, VIEWER_DRAFT } from '../scripts/legacy-urls.ts';
import { SCHEMA_BASE_URL } from '../src/lib/site';

const llms = fs.readFileSync(path.join(ROOT, 'public', 'llms.txt'), 'utf8');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const KINDS = Object.keys(FS_KINDS) as FsKind[];

const versions = schemaVersions();
const versionsByDraft: Record<string, string[]> = {};
for (const { draft, version } of versions) {
  (versionsByDraft[draft] ??= []).push(version);
}

it('llms.txt links only canonical schema.postman.com URLs', () => {
  const urlPattern = /https:\/\/schema\.postman\.com\/[^\s\)]+/g;
  const urls = llms.match(urlPattern) || [];

  const validPaths = new Set([
    '/',
    ...versionsByDraft[VIEWER_DRAFT].map((v) => viewerPage(v)),
    ...versionsByDraft[VIEWER_DRAFT].map((v) => viewerRawPath(v)),
    ...KINDS.map(fsSchemaPath),
  ]);

  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    expect([...validPaths], url).toContain(url.replace(SCHEMA_BASE_URL, ''));
  }
});

it.each(KINDS)('llms.txt and README name the %s schema URL and its file glob', (kind) => {
  const url = `${SCHEMA_BASE_URL}${fsSchemaPath(kind)}`;
  const glob = FS_KINDS[kind].glob;
  expect(llms).toContain(url);
  expect(llms).toContain(glob);
  expect(readme).toContain(url);
  expect(readme).toContain(glob);
});
