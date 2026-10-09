/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '../lib/queryClient';

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
  notFoundComponent: NotFound,
});

// Static (not sticky) so it never stacks over the viewer's dropdown portals.
function TopBar() {
  return (
    <header className="topbar">
      <div className="layout__content topbar__inner">
        <a href="https://www.getpostman.com" className="brand__logo-link" target="_blank" rel="noopener">
          <img className="brand__logo" src={postmanLogo} alt="Postman" />
        </a>
        {/* `/` redirects to the latest schema. */}
        <Link to="/" className="brand">
          Postman Schemas
        </Link>
      </div>
    </header>
  );
}

function NotFound() {
  return (
    <div className="empty-state">
      <h1>Page not found</h1>
      <p>
        <Link to="/" className="schema-link">
          View latest schema
        </Link>
      </p>
    </div>
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
          <TopBar />
          <main className="layout__main">
            <div className="layout__content">{children}</div>
          </main>
        </QueryClientProvider>
        {/* Postman analytics SDK + config (restored from the legacy hosted docs). */}
        <script id="pmtSDK" src={pmtSdkSrc} />
        <script dangerouslySetInnerHTML={{ __html: pmtConfigScript }} />
        <Scripts />
      </body>
    </html>
  );
}
