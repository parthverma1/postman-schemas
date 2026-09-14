import { createFileRoute, notFound } from '@tanstack/react-router';
import { Suspense, lazy } from 'react';
import { findSchema } from '../generated/manifest';
import { ClientOnly } from '../components/ClientOnly';

// Loaded lazily and client-side only: the Stoplight viewer (and its Mosaic
// dependencies) rely on browser APIs and should not run during SSR.
const SchemaViewer = lazy(() => import('../components/SchemaViewer'));

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

    return {
      schema,
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
  const { schema, resource, label, version, draft } = Route.useLoaderData();

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
        <ClientOnly fallback={<div className="loading">Loading schema viewer…</div>}>
          <Suspense fallback={<div className="loading">Loading schema viewer…</div>}>
            <SchemaViewer name={`${label} ${version}`} schema={schema} />
          </Suspense>
        </ClientOnly>
      </div>
    </div>
  );
}
