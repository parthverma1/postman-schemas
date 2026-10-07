#!/usr/bin/env node
/**
 * Compiles every JSON schema into a single dereferenced schema and emits it,
 * along with a manifest, into `src/generated/` so the TanStack Start app can load
 * them for the Stoplight JSON Schema Viewer.
 *
 * Schemas all live under the local `schemas/` tree. Two layouts are supported:
 *   - Legacy: `collection.json` references sibling definition files that are
 *     merged into `definitions` by `tools.compile` (e.g. v1/v2).
 *   - Self-contained: `collection.json` already carries its own `definitions`
 *     (e.g. v3), so it is emitted verbatim.
 *
 * Output layout (per resource kind, e.g. "collection"):
 *   src/generated/schemas/{resource}/{draft}/{version}.json   (viewer bundle)
 *   public/{resource}/json/{version}/{draft}/{resource}.json  (raw download)
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const semver = require('semver');
const tools = require('../lib'); // { compile, validate, versions }

const DEFAULT_DRAFT = 'draft-07';

// Only these JSON Schema drafts are surfaced in the viewer.
const INCLUDED_DRAFTS = ['draft-07'];

// Human-readable labels and ordering for the resource kinds we surface.
const RESOURCE_LABELS = { collection: 'Collection' };
const RESOURCE_ORDER = ['collection'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'schemas');
const OUT_DIR = path.join(ROOT, 'src', 'generated');
const SCHEMA_OUT_DIR = path.join(OUT_DIR, 'schemas');
const PUBLIC_DIR = path.join(ROOT, 'public');

/** @param {string} p */
const isDir = (p) => fs.statSync(p).isDirectory();

function statusForVersion(version) {
  const sv = new semver.SemVer(version);

  return Array.isArray(sv.prerelease) && sv.prerelease.length ? String(sv.prerelease[0]) : 'stable';
}

function isStable(version) {
  return /v\d+\.\d+\.\d+$/i.test(version);
}

/**
 * Writes a schema to both the viewer bundle and the public download path, and
 * records a manifest entry.
 *
 * @param {{resource: string, draft: string, version: string, status: string}} meta
 * @param {object} schema
 * @param {Array} entries
 */
function emitSchema(meta, schema, entries) {
  const { resource, draft, version, status } = meta;
  const serialized = JSON.stringify(schema, null, 2);

  // Bundled copy consumed by the viewer via the manifest.
  const outFile = path.join(SCHEMA_OUT_DIR, resource, draft, `${version}.json`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, serialized);

  // Static copy at the hosted URL: /{resource}/json/{version}/{draft}/{resource}.json
  const publicFile = path.join(PUBLIC_DIR, resource, 'json', version, draft, `${resource}.json`);
  fs.mkdirSync(path.dirname(publicFile), { recursive: true });
  fs.writeFileSync(publicFile, serialized);

  entries.push({
    resource,
    label: RESOURCE_LABELS[resource] || resource,
    draft,
    version,
    status,
    id: `${resource}/${draft}/${version}`
  });
}

function main() {
  // Clean previous output.
  fs.rmSync(SCHEMA_OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(SCHEMA_OUT_DIR, { recursive: true });
  for (const resource of RESOURCE_ORDER) {
    fs.rmSync(path.join(PUBLIC_DIR, resource, 'json'), { recursive: true, force: true });
  }

  /** @type {{resource: string, label: string, draft: string, version: string, status: string, id: string}[]} */
  const entries = [];

  // Collection schemas from the local `schemas/` tree.
  const drafts = fs
    .readdirSync(SCHEMA_DIR)
    .filter((d) => isDir(path.join(SCHEMA_DIR, d)))
    .filter((d) => INCLUDED_DRAFTS.includes(d));

  for (const draft of drafts) {
    const draftPath = path.join(SCHEMA_DIR, draft);
    const versions = fs
      .readdirSync(draftPath)
      .filter((v) => isDir(path.join(draftPath, v)))
      .sort(semver.rcompare); // newest first

    for (const version of versions) {
      const versionSchemaDir = path.join(draftPath, version);
      const schemaFile = path.join(versionSchemaDir, 'collection.json');

      if (!fs.existsSync(schemaFile)) {
        console.warn('Skipping %s/%s (no collection.json)', draft, version);
        continue;
      }

      const raw = JSON.parse(fs.readFileSync(schemaFile, 'utf8'));
      let schema;

      if (raw.definitions && Object.keys(raw.definitions).length > 0) {
        // Self-contained: `definitions` are already inline, emit as-is.
        console.info('Bundling collection %s/%s (self-contained) ...', draft, version);
        schema = raw;
      } else {
        // Legacy: `definitions` live in sibling files, merged by compile().
        console.info('Compiling collection %s/%s ...', draft, version);
        schema = tools.compile(schemaFile, versionSchemaDir, draft);
      }

      emitSchema({ resource: 'collection', draft, version, status: statusForVersion(version) }, schema, entries);
    }
  }

  // Order by resource kind, then newest version first.
  entries.sort((a, b) => {
    const ra = RESOURCE_ORDER.indexOf(a.resource);
    const rb = RESOURCE_ORDER.indexOf(b.resource);

    if (ra !== rb) {
      return ra - rb;
    }

    return semver.rcompare(a.version, b.version);
  });

  // Pick a sensible default: latest stable collection, else first entry.
  const defaultEntry =
    entries.find((e) => e.resource === 'collection' && e.draft === DEFAULT_DRAFT && isStable(e.version)) ||
    entries.find((e) => isStable(e.version)) ||
    entries[0];

  writeManifest(entries, defaultEntry);

  console.info('\nGenerated %d schema(s) into %s', entries.length, path.relative(ROOT, SCHEMA_OUT_DIR));
  console.info('Default schema: %s', defaultEntry ? defaultEntry.id : '(none)');
}

function writeManifest(entries, defaultEntry) {
  const lines = [];

  lines.push('// AUTO-GENERATED by scripts/generate-schemas.mjs — do not edit by hand.');
  lines.push('');
  lines.push('export interface SchemaEntry {');
  lines.push('  /** Resource kind, e.g. "collection" or "environment". */');
  lines.push('  resource: string;');
  lines.push('  /** Human-readable resource label, e.g. "Collection". */');
  lines.push('  label: string;');
  lines.push('  /** JSON Schema draft directory, e.g. "draft-07". */');
  lines.push('  draft: string;');
  lines.push('  /** Schema version, e.g. "v2.1.0". */');
  lines.push('  version: string;');
  lines.push('  /** Release status derived from the semver pre-release tag. */');
  lines.push("  status: 'stable' | 'rc' | 'draft' | string;");
  lines.push('  /** Stable identifier: `${resource}/${draft}/${version}`. */');
  lines.push('  id: string;');
  lines.push('  /** Lazily loads the compiled, dereferenced schema JSON. */');
  lines.push('  load: () => Promise<Record<string, unknown>>;');
  lines.push('}');
  lines.push('');
  lines.push('export const schemas: SchemaEntry[] = [');

  for (const e of entries) {
    const importPath = `./schemas/${e.resource}/${e.draft}/${e.version}.json`;

    lines.push('  {');
    lines.push(`    resource: ${JSON.stringify(e.resource)},`);
    lines.push(`    label: ${JSON.stringify(e.label)},`);
    lines.push(`    draft: ${JSON.stringify(e.draft)},`);
    lines.push(`    version: ${JSON.stringify(e.version)},`);
    lines.push(`    status: ${JSON.stringify(e.status)},`);
    lines.push(`    id: ${JSON.stringify(e.id)},`);
    lines.push(`    load: () => import(${JSON.stringify(importPath)}).then((m) => m.default as Record<string, unknown>),`);
    lines.push('  },');
  }

  lines.push('];');
  lines.push('');
  lines.push(`export const defaultSchemaId = ${JSON.stringify(defaultEntry ? defaultEntry.id : '')};`);
  lines.push('');
  lines.push('export function findSchema(');
  lines.push('  resource: string,');
  lines.push('  draft: string,');
  lines.push('  version: string,');
  lines.push('): SchemaEntry | undefined {');
  lines.push('  return schemas.find(');
  lines.push('    (s) => s.resource === resource && s.draft === draft && s.version === version,');
  lines.push('  );');
  lines.push('}');
  lines.push('');
  lines.push('/** Schemas grouped by resource kind, preserving ordering. */');
  lines.push('export function schemasByResource(): { resource: string; label: string; entries: SchemaEntry[] }[] {');
  lines.push('  const groups: { resource: string; label: string; entries: SchemaEntry[] }[] = [];');
  lines.push('');
  lines.push('  for (const s of schemas) {');
  lines.push('    let group = groups.find((g) => g.resource === s.resource);');
  lines.push('');
  lines.push('    if (!group) {');
  lines.push('      group = { resource: s.resource, label: s.label, entries: [] };');
  lines.push('      groups.push(group);');
  lines.push('    }');
  lines.push('');
  lines.push('    group.entries.push(s);');
  lines.push('  }');
  lines.push('');
  lines.push('  return groups;');
  lines.push('}');
  lines.push('');

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.ts'), lines.join('\n'));
}

main();
