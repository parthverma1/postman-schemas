/**
 * Viewer-only transforms for collection/draft-07/v3.0.0. The source file under
 * schemas/ stays untouched; these only shape what the viewer renders.
 *
 * Kept free of TS-only runtime syntax so Node can run it with type stripping.
 */
import type { JsonObject, SchemaTransform } from './index.ts';

// Keys whose values are data, not subschemas.
const VALUE_KEYS = new Set(['enum', 'const', 'default', 'examples']);

const DEFINITION_REF = /^#\/definitions\/([^/]+)$/;

const isObject = (v: unknown): v is JsonObject => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * `{$ref}` when `node` is exactly `{title, allOf: [{$ref: '#/definitions/x'}]}`
 * and `title` equals `titles.x`, the title of definition `x` (so dropping the
 * wrapper loses nothing), else undefined.
 */
export function unwrappedRef(node: JsonObject, titles: Record<string, unknown>): JsonObject | undefined {
  const keys = Object.keys(node);

  if (keys.length !== 2 || !('title' in node) || !Array.isArray(node.allOf) || node.allOf.length !== 1) {
    return undefined;
  }

  const [only] = node.allOf;

  if (!isObject(only) || Object.keys(only).length !== 1 || typeof only.$ref !== 'string') {
    return undefined;
  }

  const name = DEFINITION_REF.exec(only.$ref)?.[1];

  return name !== undefined && Object.hasOwn(titles, name) && titles[name] === node.title
    ? { $ref: only.$ref }
    : undefined;
}

/** Replaces every matching `{title, allOf: [{$ref}]}` wrapper in place (see unwrappedRef). */
export function unwrapTitledRefs(schema: JsonObject): JsonObject {
  // Snapshot the titles first, so unwrapping a definition can't change what later wrappers match.
  const titles = Object.fromEntries(
    Object.entries(isObject(schema.definitions) ? schema.definitions : {})
      .filter(([, def]) => isObject(def) && 'title' in def)
      .map(([name, def]) => [name, (def as JsonObject).title]),
  );

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(visit);
    }

    if (!isObject(value)) {
      return value;
    }

    const ref = unwrappedRef(value, titles);

    if (ref) {
      return ref;
    }

    for (const [key, child] of Object.entries(value)) {
      if (!VALUE_KEYS.has(key)) {
        value[key] = visit(child);
      }
    }

    return value;
  };

  return visit(schema) as JsonObject;
}

export const transforms: SchemaTransform[] = [unwrapTitledRefs];
