// Ambient type shims for the vendored json-schema-viewer.
//
// `@stoplight/markdown-viewer` ships an `index.d.ts` but its package.json `exports`
// map has no `types` condition, so under `moduleResolution: "Bundler"` TypeScript
// cannot resolve its declarations and reports TS7016 for the (now-vendored) import in
// `components/shared/Description.tsx`. Previously this was hidden because the viewer was
// consumed as a prebuilt npm package whose `.d.ts` files are ignored via `skipLibCheck`.
// This minimal declaration restores type-checking for the single symbol we use.
declare module '@stoplight/markdown-viewer' {
  import type * as React from 'react';

  export interface MarkdownViewerProps {
    markdown: string;
    [key: string]: unknown;
  }

  export const MarkdownViewer: React.FunctionComponent<MarkdownViewerProps>;
}
