import { JsonSchemaViewer, type PrebuiltSchemaTree } from '@postman/json-schema-viewer';
import type { JSONSchema7 } from 'json-schema';
import { useQuery } from '@tanstack/react-query';
// Static, Aether-token stylesheet shipped by the fork. It replaces Mosaic's runtime
// styled-components CSS, so the viewer is fully styled in the SSR HTML (no flash /
// unstyled paint on hydration). Layout/color come from inline styles; this file
// covers markdown + interactive controls.
import '@postman/json-schema-viewer/styles.css';
import { schemaTreeQueryOptions } from '../lib/schemaTree';

export default function SchemaViewer({
  name,
  schema,
  schemaId,
  initialData,
}: {
  name: string;
  schema: Record<string, unknown>;
  schemaId: string;
  /** Tree built during SSR and transferred to the client to seed the query cache. */
  initialData?: PrebuiltSchemaTree;
}) {
  // The tree is built off the main thread and shared through React Query. On the first
  // load, `initialData` (built during SSR) seeds the cache, so hydration uses it directly
  // and matches the SSR HTML. On client navigations, the route loader has already built
  // it in the Web Worker. Only if the worker failed is `tree` undefined, and the viewer
  // then builds it synchronously from `schema` as a fallback.
  const { data: tree } = useQuery({
    ...schemaTreeQueryOptions(schemaId, () => schema as unknown as JSONSchema7),
    enabled: typeof window !== 'undefined',
    initialData,
  });

  return (
    <JsonSchemaViewer
      name={name}
      schema={schema as JSONSchema7}
      tree={tree}
      defaultExpandedDepth={0}
      emptyText="No schema defined"
    />
  );
}
