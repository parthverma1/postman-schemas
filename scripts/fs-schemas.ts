// Explicit .ts extensions: Node's type stripping loads this file through the generator and requires them.
import { viewerPage } from './legacy-urls.ts';
import { SCHEMA_BASE_URL } from '../src/lib/site.ts';

/** Vendored because the package is restricted and CI can't install it. */
export const FS_PACKAGE = { name: '@postman/v3.schemas', dir: 'vendor/@postman/v3.schemas' } as const;

export const FS_VERSION = 'v3.0.0';

const DRAFT_07 = 'http://json-schema.org/draft-07/schema#';

interface FsKindSpec {
  /** A yaml-language-server `yaml.schemas` glob, following v3-sdk packages/serialize/src/filePath.ts. */
  glob: string;
  /** Several files are combined with `anyOf`: collection.json and folder.json both accept a minimal `{ $kind: collection, name }`, so `oneOf` would reject it. */
  packageFiles: readonly [string, ...string[]];
}

export const FS_KINDS = {
  definition: {
    glob: '**/.resources/definition.{yaml,yml}',
    packageFiles: ['schemas/collection.json', 'schemas/folder.json'],
  },
  request: {
    glob: '**/*.request.{yaml,yml}',
    packageFiles: ['schemas/generic-request.json'],
  },
  example: {
    glob: '**/.resources/*.resources/examples/*.example.{yaml,yml}',
    packageFiles: ['schemas/generic-example.json'],
  },
  message: {
    glob: '**/.resources/*.resources/messages/*.message.{yaml,yml}',
    packageFiles: ['schemas/generic-message.json'],
  },
} as const satisfies Record<string, FsKindSpec>;

export type FsKind = keyof typeof FS_KINDS;

export const FS_SOURCE_FILES: readonly string[] = [...new Set(Object.values(FS_KINDS).flatMap((k) => k.packageFiles))];

export const fsSchemaPath = (kind: FsKind): string => `${viewerPage(FS_VERSION)}/fs/${kind}.json`;

type JsonObject = Record<string, unknown>;

export interface FsSchemaFile {
  kind: FsKind;
  path: string;
  content: string;
}

function asDraft07Object(file: string, json: unknown): JsonObject {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new Error(`${file}: expected a JSON object, got ${json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json}`);
  }
  const obj = json as JsonObject;
  const schema = obj.$schema;
  if (schema !== DRAFT_07) {
    throw new Error(`${file}: expected draft-07 $schema, got ${schema ?? 'none'}`);
  }
  return obj;
}

function assertInlinable(file: string, obj: JsonObject): void {
  if ('$ref' in obj) {
    throw new Error(`${file}: has $ref, cannot inline under anyOf`);
  }
  if ('definitions' in obj) {
    throw new Error(`${file}: has definitions, cannot inline under anyOf`);
  }
}

export function fsSchemas(read: (packageFile: string) => unknown): FsSchemaFile[] {
  const result: FsSchemaFile[] = [];
  for (const [kind, spec] of Object.entries(FS_KINDS) as [FsKind, FsKindSpec][]) {
    const sources = spec.packageFiles.map((f) => asDraft07Object(f, read(f)));
    if (sources.length > 1) {
      sources.forEach((s, i) => assertInlinable(spec.packageFiles[i], s));
    }

    const path = fsSchemaPath(kind);
    const title = `Postman Collection ${FS_VERSION} ${kind} file`;
    const description = `Postman Collection ${FS_VERSION} filesystem format: files matching ${spec.glob}.`;

    let schema: JsonObject;
    if (sources.length === 1) {
      const { $schema, ...rest } = sources[0];
      schema = { $schema, $id: `${SCHEMA_BASE_URL}${path}`, title, description, ...rest };
    } else {
      schema = {
        $schema: DRAFT_07,
        $id: `${SCHEMA_BASE_URL}${path}`,
        title,
        description,
        anyOf: sources.map(({ $schema, ...s }) => s),
      };
    }

    result.push({ kind, path, content: JSON.stringify(schema, null, 2) + '\n' });
  }
  return result;
}
