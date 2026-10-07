import * as React from 'react';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { findSchema } from '../generated/manifest';
import SchemaViewer from '../components/SchemaViewer';
import { deserializeSchemaTree, type SerializedSchemaTree } from '../lib/schemaTree';

// The Stoplight viewer lives in the workspace package `@postman/json-schema-viewer`,
// an SSR-safe fork (see its hash.ts / lodashLite.ts).
//
// Canonical public host these schemas are served from.
const SCHEMA_BASE_URL = 'https://schema.postman.com';

export const Route = createFileRoute(
  '/$resource/json/$version/$draft/docs/index.html',
)({
  loader: async ({ params }) => {
    const entry = findSchema(params.resource, params.draft, params.version);

    if (!entry) {
      throw notFound();
    }

    const schema = await entry.load();

    // Build the tree once on the server so React Query can hydrate with it on the
    // client instead of rebuilding on the main thread. Skipped on client-side
    // navigations (import.meta.env.SSR === false), which use the worker/prefetch path.
    let initialTree: SerializedSchemaTree | undefined;
    if (import.meta.env.SSR) {
      const { buildSerializedSchemaTree } = await import('../lib/schemaTree.server');
      initialTree = buildSerializedSchemaTree(schema as never);
    }

    return {
      schema,
      id: entry.id,
      initialTree,
      resource: entry.resource,
      label: entry.label,
      draft: entry.draft,
      version: entry.version,
    };
  },
  component: SchemaPage,
  notFoundComponent: () => (
    <div className="empty-state">
      <h1>Schema not found</h1>
      <p>Pick a schema from the sidebar.</p>
    </div>
  ),
});

function SchemaPage() {
  const { schema, id, initialTree, resource, label, version, draft } = Route.useLoaderData();

  // Rebuild the SSR-transferred tree (cheap) to seed React Query as initial data.
  const initialData = React.useMemo(
    () => (initialTree ? deserializeSchemaTree(initialTree) : undefined),
    [initialTree],
  );

  const schemaHref = `${SCHEMA_BASE_URL}/${resource}/json/${version}/${draft}/${resource}.json`;

  return (
    <div className="schema-page">
      <header className="schema-page__header">
        <div className="schema-page__title">
          <h1>
            {label} <code>{version}</code>
          </h1>
          <a
            className="schema-link"
            href={schemaHref}
            target="_blank"
            rel="noopener"
          >
            {schemaHref}
          </a>
        </div>
      </header>

      <div className="schema-page__viewer">
        <SchemaViewer name={`${label} ${version}`} schema={schema} schemaId={id} initialData={initialData} />
      </div>
    </div>
  );
}
