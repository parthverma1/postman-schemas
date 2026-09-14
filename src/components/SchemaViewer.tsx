import { JsonSchemaViewer } from '@postman/json-schema-viewer';
import type { JSONSchema7 } from 'json-schema';
// Static, Aether-token stylesheet shipped by the fork. It replaces Mosaic's runtime
// styled-components CSS, so the viewer is fully styled in the SSR HTML (no flash /
// unstyled paint on hydration). Layout/color come from inline styles; this file
// covers markdown + interactive controls.
import '@postman/json-schema-viewer/styles.css';

export default function SchemaViewer({
  name,
  schema,
}: {
  name: string;
  schema: Record<string, unknown>;
}) {
  return (
    <JsonSchemaViewer
      name={name}
      schema={schema as JSONSchema7}
      defaultExpandedDepth={1}
      emptyText="No schema defined"
    />
  );
}
