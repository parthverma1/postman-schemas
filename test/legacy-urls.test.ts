import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lib, ROOT, schemaVersions } from './helpers';
import {
  legacyRedirectsFile,
  legacyUrls,
  latestStable,
  RESOURCE,
  viewerPage,
  viewerRawPath,
  VIEWER_DRAFT,
} from '../scripts/legacy-urls';
import { writeSchemas } from '../scripts/generate-schemas.mjs';

const versions = schemaVersions();
const versionsByDraft: Record<string, string[]> = {};

for (const { draft, version } of versions) {
  (versionsByDraft[draft] ??= []).push(version);
}

const { raw, redirects } = legacyUrls(versionsByDraft);
// The prerendered docs pages (dist/client/collection/{v}/index.html).
const viewerPages = new Set(versionsByDraft[VIEWER_DRAFT].map(viewerPage));

/** Same as generate-schemas.mjs: lib.compile. */
function expectedSchema(draft: string, version: string): unknown {
  const v = versions.find((s) => s.draft === draft && s.version === version);

  if (!v) {
    throw new Error(`unknown schema ${draft}/${version}`);
  }

  return lib.compile(v.schemaPath, v.schemaDir, v.draft);
}

let tmp: string;
let written: string[];

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-urls-'));
  written = writeSchemas({ publicDir: path.join(tmp, 'public'), schemaOutDir: path.join(tmp, 'schemas') }).rawPaths;
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

it('writes every redirect into public/_redirects as an exact-path 301', () => {
  const file = fs.readFileSync(path.join(tmp, 'public', '_redirects'), 'utf8');

  const lines = file.trimEnd().split('\n').sort();

  // Exact paths, so the order (newest-first in the generator) doesn't matter.
  expect(lines).toEqual(legacyRedirectsFile(versionsByDraft).trimEnd().split('\n').sort());
  expect(lines).toEqual(Object.entries(redirects).map(([from, to]) => `${from} ${to} 301`).sort());
  // No splats/placeholders: every source must be matched literally.
  expect(file).not.toMatch(/[*:]/);
});

// Guards so a discovery bug can't pass vacuously. Aliases: (8 draft-04 + latest)
// + (4 draft-07 + latest) = 14. Raw: 14 × 2 layouts + 4 /collection/{v}/collection.json.
// Redirects: 14 × 2 docs/index.html + 14 × 2 bare /collection/json/.../docs{,/}
// + 4 × 2 /collection/{v}{/,/index.html} + /index.html.
it('covers every legacy URL', () => {
  expect(raw).toHaveLength(32);
  expect(Object.keys(redirects)).toHaveLength(65);
  expect(new Set(raw.map((f) => f.path)).size).toBe(raw.length);
});

it('resolves latest to the highest semver-stable version per draft', () => {
  expect(latestStable(versionsByDraft['draft-07'])).toBe('v3.0.0');
  expect(latestStable(versionsByDraft['draft-04'])).toBe('v2.1.0');
  expect(latestStable(['v2.0.0', 'v10.0.0', 'v11.0.0-rc.1', 'v9.9.9'])).toBe('v10.0.0');
  expect(raw.find((f) => f.path === '/json/collection/latest/collection.json')?.version).toBe('v2.1.0');
  expect(raw.find((f) => f.path === '/json/draft-07/collection/latest/collection.json')?.version).toBe('v3.0.0');
});

it("includes the legacy URLs that 404'd after the rebuild", () => {
  const paths = raw.map((f) => f.path);

  for (const p of [
    '/json/collection/v2.1.0/collection.json',
    '/json/collection/v2.0.0/collection.json',
    '/json/collection/v1.0.0/collection.json',
    '/json/collection/v2.0.0-rc.1/collection.json',
    '/json/collection/v1.1.0-draft.1/collection.json',
    '/json/collection/latest/collection.json',
    '/json/draft-07/collection/v2.1.0/collection.json',
    '/collection/json/latest/draft-07/collection.json',
    '/collection/json/v2.1.0/draft-04/collection.json',
  ]) {
    expect(paths).toContain(p);
  }

  expect(redirects['/json/collection/v2.1.0/docs/index.html']).toBe(viewerPage('v2.1.0'));
  expect(redirects['/index.html']).toBe('/');
});

it('serves the viewer pages at /collection/{v} with a raw schema next to them', () => {
  expect(viewerPage('v3.0.0')).toBe(`/${RESOURCE}/v3.0.0`);
  expect(viewerPage('v3.0.0')).toBe('/collection/v3.0.0');

  for (const v of versionsByDraft[VIEWER_DRAFT]) {
    expect(raw).toContainEqual({ path: viewerRawPath(v), draft: VIEWER_DRAFT, version: v });
    // The old viewer page and its variants now 301 straight to the new page.
    expect(redirects[`/collection/json/${v}/draft-07/docs/index.html`]).toBe(viewerPage(v));
    expect(redirects[`${viewerPage(v)}/`]).toBe(viewerPage(v));
    expect(redirects[`${viewerPage(v)}/index.html`]).toBe(viewerPage(v));
    // Served by html_handling, never a redirect source.
    expect(redirects[viewerPage(v)]).toBeUndefined();
  }

  expect(redirects['/']).toBeUndefined();
});

it('301s the bare /collection/json/{v}/{draft}/docs forms in one hop', () => {
  for (const [draft, versions] of Object.entries(versionsByDraft)) {
    for (const v of [...versions, 'latest']) {
      const base = `/collection/json/${v}/${draft}/docs`;

      expect(redirects[`${base}`]).toBe(redirects[`${base}/index.html`]);
      expect(redirects[`${base}/`]).toBe(redirects[`${base}/index.html`]);
    }
  }

  expect(redirects['/collection/json/latest/draft-07/docs/']).toBe(viewerPage('v3.0.0'));
  expect(redirects['/collection/json/v1.1.0-draft.1/draft-04/docs']).toBe(
    '/collection/json/v1.1.0-draft.1/draft-04/collection.json',
  );
});

it('serves pages via html_handling, with no rewrite (200) lines in _redirects', () => {
  const file = fs.readFileSync(path.join(tmp, 'public', '_redirects'), 'utf8');
  const wrangler = fs.readFileSync(path.join(ROOT, 'wrangler.jsonc'), 'utf8');

  expect(wrangler).toMatch(/"html_handling":\s*"drop-trailing-slash"/);
  expect(file.trimEnd().split('\n').every((line) => line.endsWith(' 301'))).toBe(true);
  expect(file).not.toMatch(/ 200$/m);
});

it('writes exactly the listed raw files', () => {
  expect([...written].sort()).toEqual(raw.map((f) => f.path).sort());
});

describe.each(raw.map((f) => ({ ...f, label: `${f.path} = ${f.draft}/${f.version}` })))(
  '$label',
  ({ path: urlPath, draft, version }) => {
    it('is served with the compiled schema', () => {
      const content = JSON.parse(fs.readFileSync(path.join(tmp, 'public', urlPath), 'utf8'));

      expect(content).toEqual(expectedSchema(draft, version));
    });
  },
);

describe.each(Object.entries(redirects).map(([from, to]) => ({ from, to })))('$from → $to', ({ from, to }) => {
  it('is a single-hop redirect to an existing target', () => {
    const exists = to === '/' || viewerPages.has(to) || fs.existsSync(path.join(tmp, 'public', to));

    expect(exists).toBe(true);
    expect(redirects[to]).toBeUndefined();
    expect(viewerPages.has(from)).toBe(false);
    expect(to).not.toMatch(/\/docs\/index\.html$/);
  });
});
