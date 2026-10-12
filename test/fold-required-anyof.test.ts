import { describe, it, expect } from 'vitest';
import { compiledSchema, schemaVersions } from './helpers';
import { foldRequiredAnyOf } from '../scripts/schema-transforms/fold-required-anyof';

const fold = (schema: Record<string, unknown>) => foldRequiredAnyOf(structuredClone(schema));
const draft07 = (version: string) => {
  const v = schemaVersions().find((s) => s.draft === 'draft-07' && s.version === version);

  if (!v) throw new Error(`unknown schema draft-07/${version}`);

  return compiledSchema(v) as Record<string, unknown>;
};
const definition = (schema: Record<string, unknown>, name: string) =>
  (schema.definitions as Record<string, Record<string, unknown>>)[name];

describe('foldRequiredAnyOf', () => {
  it('folds a required-only anyOf into required + requiredAnyOf', () => {
    expect(
      fold({
        type: 'object',
        required: ['a'],
        anyOf: [{ required: ['a', 'b', 'x'] }, { required: ['b', 'y'] }, { required: ['b', 'x', 'y'] }],
      }),
    ).toEqual({ type: 'object', required: ['a', 'b'], requiredAnyOf: [['x'], ['y']] });
  });

  it('drops supersets and repeats of another set', () => {
    expect(fold({ anyOf: [{ required: ['id'] }, { required: ['key'] }, { required: ['id', 'key'] }, { required: ['id'] }] }))
      .toEqual({ requiredAnyOf: [['id'], ['key']] });
  });

  it('needs no note when one branch is already covered by required', () => {
    expect(fold({ required: ['a'], anyOf: [{ required: ['a'] }, { required: ['b'] }] })).toEqual({ required: ['a'] });
  });

  it('leaves oneOf and anyOf with real branches alone', () => {
    const schemas = [
      { oneOf: [{ required: ['id'] }, { required: ['key'] }] },
      { anyOf: [{ required: ['id'] }, { type: 'string' }] },
      { anyOf: [{ required: ['id'], properties: { id: {} } }, { required: ['key'] }] },
      { anyOf: [] },
    ];

    for (const schema of schemas) expect(fold(schema)).toEqual(schema);
  });

  it('descends into every schema map entry, whatever its name, but not into value keywords', () => {
    // A fresh object each time: the fold works in place.
    const foldable = () => ({ anyOf: [{ required: ['id'] }, { required: ['key'] }] });
    const result = fold({
      properties: { examples: foldable(), enum: foldable() },
      patternProperties: { '^x': foldable() },
      definitions: { default: foldable() },
      dependencies: { a: foldable(), b: ['c'] },
      items: [foldable()],
      examples: [foldable()],
      default: foldable(),
      enum: [foldable()],
      const: foldable(),
      example: foldable(),
    });
    const folded = { requiredAnyOf: [['id'], ['key']] };

    expect(result).toEqual({
      properties: { examples: folded, enum: folded },
      patternProperties: { '^x': folded },
      definitions: { default: folded },
      dependencies: { a: folded, b: ['c'] },
      items: [folded],
      examples: [foldable()],
      default: foldable(),
      enum: [foldable()],
      const: foldable(),
      example: foldable(),
    });
  });

  describe('the viewer schemas', () => {
    it.each(['v2.0.0', 'v2.1.0'])('%s: folds /definitions/variable', (version) => {
      const result = fold(draft07(version));

      expect(definition(result, 'variable')).not.toHaveProperty('anyOf');
      expect(definition(result, 'variable')).not.toHaveProperty('required');
      expect(definition(result, 'variable').requiredAnyOf).toEqual([['id'], ['key']]);
    });

    it('v1.0.0: folds /definitions/variable and /definitions/request', () => {
      const result = fold(draft07('v1.0.0'));

      expect(definition(result, 'variable')).not.toHaveProperty('anyOf');
      expect(definition(result, 'variable').requiredAnyOf).toEqual([['id'], ['key']]);
      expect(definition(result, 'request')).not.toHaveProperty('anyOf');
      expect(definition(result, 'request').required).toEqual(['id', 'method', 'url', 'headers', 'name']);
      expect(definition(result, 'request').requiredAnyOf).toEqual([['collectionId'], ['collection']]);
    });

    it.each(['v1.0.0', 'v2.0.0', 'v2.1.0', 'v3.0.0'])('%s: changes nothing else', (version) => {
      const source = draft07(version);
      const result = fold(source);
      const sites: Record<string, string[]> = { 'v1.0.0': ['request', 'variable'], 'v2.0.0': ['variable'], 'v2.1.0': ['variable'] };

      for (const name of sites[version] ?? []) {
        delete definition(source, name).anyOf;
        delete definition(result, name).required;
        delete definition(result, name).requiredAnyOf;
        delete definition(source, name).required;
      }

      expect(result).toEqual(source);
    });
  });
});
