import { JsonSchemaViewer } from '../vendor/json-schema-viewer';
import type { JSONSchema7 } from 'json-schema';
// Mosaic ships utility classes (styles.css) and the theme tokens they reference
// (themes/default.css) separately. Both are required or the viewer renders unstyled.
import '@stoplight/mosaic/themes/default.css';
import '@stoplight/mosaic/styles.css';

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
      expanded
      defaultExpandedDepth={1}
      emptyText="No schema defined"
    />
  );
}
