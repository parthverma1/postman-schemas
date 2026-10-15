import { createFileRoute, Link } from '@tanstack/react-router';
import { schemas } from '../generated/manifest';
import { badgeTone, docsPath, groupByResource, LEGEND, rawPath } from '../lib/homepage';

export const Route = createFileRoute('/')({
  component: Homepage,
});

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-badge--${badgeTone(status)}`}>{status}</span>;
}

function Homepage() {
  const groups = groupByResource(schemas);

  return (
    <div className="homepage">
      <h1>Documentation for the various versions of Postman Schemas</h1>

      {groups.length === 0 ? (
        <p className="empty-state">No schemas have been generated yet.</p>
      ) : (
        groups.map((group) => (
          <section key={group.resource} aria-labelledby={`${group.resource}-heading`}>
            <h2 id={`${group.resource}-heading`}>{group.label}s</h2>
            {/* Too wide for 320px screens: scroll inside a focusable region. */}
            <div className="table-scroll" tabIndex={0} role="region" aria-label={`${group.label} versions`}>
              <table className="homepage-table">
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Status</th>
                    <th scope="col">Documentation</th>
                    <th scope="col">Raw Schema</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <code>{entry.version}</code>
                      </td>
                      <td>
                        <StatusBadge status={entry.status} />
                      </td>
                      <td>
                        {/* Full load: the docs pages are prerendered HTML (and no preload). */}
                        <Link
                          reloadDocument
                          to="/$resource/json/$version/$draft/docs/index.html"
                          params={{ resource: entry.resource, version: entry.version, draft: entry.draft }}
                        >
                          View documentation
                        </Link>
                      </td>
                      <td>
                        <a href={rawPath(entry)}>JSON Schema</a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}

      <section aria-labelledby="legend-heading">
        <h2 id="legend-heading">Legend</h2>
        <table className="homepage-table">
          <thead>
            <tr>
              <th scope="col">Status</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            {LEGEND.map(({ status, description }) => (
              <tr key={status}>
                <td>
                  <StatusBadge status={status} />
                </td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
