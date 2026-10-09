/**
 * Viewer-only schema pre-processing. scripts/generate-schemas.mjs runs
 * `transformForViewer` on the viewer bundle only; raw downloads keep the
 * compiled original, and files under schemas/ are never edited for display.
 *
 * Order: global transforms (every schema), then the transforms registered for
 * that exact schema id (`${resource}/${draft}/${version}`). Each transform gets
 * a private deep clone, so it may mutate and return it.
 *
 * Kept free of TS-only runtime syntax so Node can run it with type stripping.
 */
import { transforms as collectionDraft07V3 } from './collection-draft-07-v3.0.0.ts';

export type JsonObject = Record<string, unknown>;

export type SchemaTransform = (schema: JsonObject) => JsonObject;

export interface SchemaId {
  resource: string;
  draft: string;
  version: string;
}

/** Applied to every schema, in order. */
export const GLOBAL_TRANSFORMS: SchemaTransform[] = [];

/** Applied only to the schema with this id, after the global transforms. */
export const SCHEMA_TRANSFORMS: Record<string, SchemaTransform[]> = {
  'collection/draft-07/v3.0.0': collectionDraft07V3,
};

/** The schema as the viewer should render it. Never mutates `schema`. */
export function transformForViewer(schema: JsonObject, { resource, draft, version }: SchemaId): JsonObject {
  const own = SCHEMA_TRANSFORMS[`${resource}/${draft}/${version}`] ?? [];

  return [...GLOBAL_TRANSFORMS, ...own].reduce((s, transform) => transform(s), structuredClone(schema));
}
