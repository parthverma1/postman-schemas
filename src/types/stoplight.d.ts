// The published `@stoplight/json-schema-viewer` package does not expose its
// type declarations through its `exports` map, so TypeScript (Bundler
// resolution) cannot pick them up automatically. Declare the surface we use.
declare module '@stoplight/json-schema-viewer' {
  import type { FC } from 'react';
  import type { JSONSchema7 } from 'json-schema';

  export interface JsonSchemaViewerProps {
    schema: JSONSchema7;
    name?: string;
    expanded?: boolean;
    hideTopBar?: boolean;
    emptyText?: string;
    defaultExpandedDepth?: number;
    className?: string;
  }

  export const JsonSchemaViewer: FC<JsonSchemaViewerProps>;
}

declare module '@stoplight/mosaic/styles.css';
declare module '@stoplight/mosaic/themes/default.css';
