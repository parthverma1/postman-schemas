/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { schemasByResource } from '../generated/manifest';
import { getQueryClient } from '../lib/queryClient';
import { prefetchSchemaTree } from '../lib/schemaTree';

// Served from public/ at its literal root URL.
const postmanLogo = '/assets/postman-logo-orange.svg';

// Postman analytics (pmt) SDK — restored from the legacy hosted docs. The SDK is
// served from public/, then configured for the "schemas" property.
const pmtSdkSrc = '/assets/pmt-sdk.js';
const pmtConfigScript = `if (location.hostname !== 'localhost' && typeof window.pmt === 'function') {
  window.pmt('setScalp', [{ property: 'schemas' }]);
  window.pmt('scalp', ['pm-analytics', 'load', document.location.pathname]);
  window.pmt('trackClicks', []);
}`;

import appCss from '../styles/app.css?url';
import { usePreferredColorScheme } from '@reactuses/core';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Postman Schemas' },
      {
        name: 'description',
        content:
          "Browse Postman's JSON Schemas",
      },
    ],
    links: [
      // Modern browsers prefer the crisp SVG; .ico/.png are fallbacks. Generated
      // from the Postman logo SVG by scripts/generate-favicon.mjs.
      { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
      { rel: 'icon', type: 'image/svg+xml', href: '/assets/postman-logo-orange.svg' },
      { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
      { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  shellComponent: RootDocument,
});

function Sidebar() {
  const queryClient = useQueryClient();
  return (
    <nav className="sidebar">
      <div className="sidebar__head">
        <a
          href="https://www.getpostman.com"
          className="brand"
          target="_blank"
          rel="noopener"
        >
          <img className="brand__logo" src={postmanLogo} alt="Postman" />
          <span>Postman Schemas</span>
        </a>
      </div>

      {schemasByResource().map((group) => (
        <div className="nav-group" key={group.resource}>
          <div className="nav-group__title">{group.label}</div>
          <ul className="nav-list">
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to="/$resource/json/$version/$draft/docs/index.html"
                  params={{
                    resource: entry.resource,
                    version: entry.version,
                    draft: entry.draft,
                  }}
                  className="nav-link"
                  activeProps={{ className: 'nav-link nav-link--active' }}
                  // Build the (expensive) schema tree in a Web Worker as the user is
                  // about to navigate, so the click renders instantly from cache.
                  onMouseEnter={() => prefetchSchemaTree(queryClient, entry)}
                  onFocus={() => prefetchSchemaTree(queryClient, entry)}
                >
                  <span>{entry.version}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
    const theme = usePreferredColorScheme();
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body data-theme={theme}>
        <QueryClientProvider client={getQueryClient()}>
          <div className="layout">
            <aside className="layout__aside">
              <Sidebar />
            </aside>
            <main className="layout__main">{children}</main>
          </div>
        </QueryClientProvider>
        {/* Postman analytics SDK + config (restored from the legacy hosted docs). */}
        <script id="pmtSDK" src={pmtSdkSrc} />
        <script dangerouslySetInnerHTML={{ __html: pmtConfigScript }} />
        <Scripts />
      </body>
    </html>
  );
}
