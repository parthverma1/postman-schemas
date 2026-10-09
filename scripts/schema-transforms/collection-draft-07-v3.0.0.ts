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

/** Value at an RFC 6901 JSON pointer, or undefined. */
export function resolvePointer(root: unknown, pointer: string): unknown {
  return pointer
    .split('/')
    .slice(1)
    .map((token) => token.replace(/~1/g, '/').replace(/~0/g, '~'))
    .reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as JsonObject)[key] : undefined), root);
}

/**
 * `{$ref}` when `node` is exactly `{title, allOf: [{$ref: '#/definitions/x'}]}`
 * and `title` equals `definitions.x.title` (so dropping the wrapper loses
 * nothing), else undefined.
 */
export function unwrappedRef(node: JsonObject, definitions: JsonObject): JsonObject | undefined {
  const keys = Object.keys(node);

  if (keys.length !== 2 || !('title' in node) || !Array.isArray(node.allOf) || node.allOf.length !== 1) {
    return undefined;
  }

  const [only] = node.allOf;

  if (!isObject(only) || Object.keys(only).length !== 1 || typeof only.$ref !== 'string') {
    return undefined;
  }

  const name = DEFINITION_REF.exec(only.$ref)?.[1];
  const target = name === undefined ? undefined : definitions[name];

  return isObject(target) && target.title === node.title ? { $ref: only.$ref } : undefined;
}

/** Replaces every matching `{title, allOf: [{$ref}]}` wrapper in place (see unwrappedRef). */
export function unwrapTitledRefs(schema: JsonObject): JsonObject {
  const definitions = isObject(schema.definitions) ? schema.definitions : {};

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(visit);
    }

    if (!isObject(value)) {
      return value;
    }

    const ref = unwrappedRef(value, definitions);

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

export interface DescriptionOverride {
  /** JSON pointer to the schema object whose `description` is replaced. */
  pointer: string;
  /** Expected source text; the transform throws if it differs. */
  from: string;
  to: string;
}

const SCRIPTS = 'Scripts that run on events in the request execution lifecycle.';
const SCRIPT_TYPE_FROM = 'Lifecycle point the script runs at, such as `beforeRequest` or `afterResponse`.';
const SCRIPT_TYPE = 'Lifecycle point the script runs at.';
const VAULT_TYPE_FROM = 'Whether the vault is local or in the cloud.';
const VAULT_TYPE = 'Whether the Postman vault is stored locally or in the cloud.';

export const DESCRIPTION_OVERRIDES: DescriptionOverride[] = [
  {
    pointer: '/properties/scripts',
    from: 'Scripts that run around every request in the collection.',
    to: SCRIPTS,
  },
  {
    pointer: '/definitions/v3-folder/properties/scripts',
    from: 'Scripts that run around every request in the folder.',
    to: SCRIPTS,
  },
  {
    pointer: '/definitions/v3-graphql-request/properties/scripts',
    from: 'Scripts that run around the request.',
    to: SCRIPTS,
  },
  {
    pointer: '/definitions/v3-grpc-request/properties/scripts',
    from: 'Scripts that run around the call.',
    to: SCRIPTS,
  },
  {
    pointer: '/definitions/v3-http-request/properties/scripts',
    from: 'Scripts that run around the request.',
    to: SCRIPTS,
  },
  {
    pointer: '/definitions/v3-collection-scripts/items/properties/type',
    from: SCRIPT_TYPE_FROM,
    to: SCRIPT_TYPE,
  },
  {
    pointer: '/definitions/v3-folder-scripts/items/properties/type',
    from: SCRIPT_TYPE_FROM,
    to: SCRIPT_TYPE,
  },
  {
    pointer: '/definitions/v3-graphql-scripts/items/properties/type',
    from: SCRIPT_TYPE_FROM,
    to: SCRIPT_TYPE,
  },
  {
    pointer: '/definitions/v3-grpc-scripts/items/properties/type',
    from: SCRIPT_TYPE_FROM,
    to: SCRIPT_TYPE,
  },
  {
    pointer: '/definitions/v3-http-scripts/items/properties/type',
    from: SCRIPT_TYPE_FROM,
    to: SCRIPT_TYPE,
  },
  {
    pointer: '/definitions/secret-source/oneOf/0/properties/postman/oneOf/0/properties/type',
    from: VAULT_TYPE_FROM,
    to: VAULT_TYPE,
  },
  {
    pointer: '/definitions/secret-source/oneOf/0/properties/postman/oneOf/1/properties/type',
    from: VAULT_TYPE_FROM,
    to: VAULT_TYPE,
  },
  {
    pointer: '/definitions/secret-source/oneOf/1/properties/azure/properties/secretId',
    from: 'Identifier of the secret in Azure Key Vault.',
    to: 'Identifier of the secret.',
  },
];

/** Applies DESCRIPTION_OVERRIDES in place; throws if a source description isn't the expected `from`. */
export function overrideDescriptions(schema: JsonObject): JsonObject {
  for (const { pointer, from, to } of DESCRIPTION_OVERRIDES) {
    const target = resolvePointer(schema, pointer);

    if (!isObject(target) || target.description !== from) {
      throw new Error(
        `collection/draft-07/v3.0.0: description at ${pointer} is ${JSON.stringify(
          isObject(target) ? target.description : target,
        )}, expected ${JSON.stringify(from)}. Update DESCRIPTION_OVERRIDES.`,
      );
    }

    target.description = to;
  }

  return schema;
}

export const transforms: SchemaTransform[] = [unwrapTitledRefs, overrideDescriptions];
