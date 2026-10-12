/**
 * Folds an `anyOf` whose branches only list `required` keys, e.g.
 * `anyOf: [{required: [id]}, {required: [key]}, {required: [id, key]}]`.
 * That says which properties must be present; it isn't a set of alternative
 * types, but the viewer would render one (identical) choice per branch.
 *
 * The anyOf is dropped: keys every branch requires join `required`, and the
 * remaining minimal key sets go under `requiredAnyOf` (not an `x-` key, so the
 * viewer doesn't list it as a vendor extension), which the row shows as
 * "Requires `id` or `key`". oneOf is never folded: with the same branches it
 * means "exactly one", not "at least one".
 */
import type { JsonObject } from './index';

// Keywords whose value is data, not a schema: never look inside them.
const VALUE_KEYWORDS = new Set(['enum', 'const', 'default', 'examples', 'example']);
// Keywords whose value maps names to schemas: every entry is a schema, whatever
// its name (a property may well be called `examples`).
const SCHEMA_MAP_KEYWORDS = new Set(['properties', 'patternProperties', 'definitions', 'dependencies']);

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRequiredOnly = (branch: unknown): branch is { required: string[] } =>
  isObject(branch) &&
  Object.keys(branch).length === 1 &&
  Array.isArray(branch.required) &&
  branch.required.every((key) => typeof key === 'string');

function foldNode(schema: JsonObject): void {
  const branches = schema.anyOf;
  if (!Array.isArray(branches) || branches.length === 0 || !branches.every(isRequiredOnly)) return;

  const sets = branches.map((branch) => [...new Set(branch.required)]);
  const base = Array.isArray(schema.required) ? (schema.required as string[]) : [];
  const common = sets[0].filter((key) => sets.every((set) => set.includes(key)));
  const required = [...new Set([...base, ...common])];
  const remaining = sets.map((set) => set.filter((key) => !required.includes(key)));
  const isSubset = (a: string[], b: string[]) => a.every((key) => b.includes(key));
  // Drop supersets and repeats of another set; an emptied set means `required`
  // already satisfies the anyOf, so nothing else is needed.
  const alternatives = remaining.some((set) => set.length === 0)
    ? []
    : remaining.filter(
        (set, i) =>
          !remaining.some((other, j) => j !== i && isSubset(other, set) && (other.length < set.length || j < i)),
      );

  delete schema.anyOf;
  if (required.length > 0) schema.required = required;
  if (alternatives.length > 0) schema.requiredAnyOf = alternatives;
}

function walk(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(walk);
    return;
  }
  if (!isObject(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (VALUE_KEYWORDS.has(key)) continue;
    if (SCHEMA_MAP_KEYWORDS.has(key) && isObject(child)) {
      Object.values(child).forEach(walk);
    } else {
      walk(child);
    }
  }
  foldNode(value);
}

/** Folds every required-only anyOf in `schema`, in place, and returns it. */
export function foldRequiredAnyOf(schema: JsonObject): JsonObject {
  walk(schema);
  return schema;
}
