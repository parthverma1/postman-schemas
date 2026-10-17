/**
 * Legacy schema URLs served by the old docson site (schema.getpostman.com /
 * schema.postman.com), restored so existing links and `info.schema` URLs keep
 * working. Pure (no I/O): shared by scripts/generate-schemas.mjs (writes the raw
 * copies and the `_redirects` file), vite.config.ts and test/legacy-urls.test.ts.
 *
 * Scope matches what production serves today (v{major} aliases, index.json and
 * directory URLs 403 there, so they are not recreated):
 *   raw JSON (static copies, 200):
 *     draft-04: /json/collection/{v}/collection.json, /collection/json/{v}/draft-04/collection.json
 *     draft-07: /json/draft-07/collection/{v}/collection.json, /collection/json/{v}/draft-07/collection.json
 *     "latest" variants of all of the above, plus the current
 *     /collection/{v}/collection.json (draft-07, viewer versions only).
 *   docs HTML (301, single hop): every old .../docs/index.html URL (and the bare
 *     /collection/json/{v}/{draft}/docs{,/} forms) → the viewer page
 *     /collection/{v} for that version, or the version's raw JSON when no
 *     viewer page exists. /index.html → / and /collection/{v}{/,/index.html} →
 *     /collection/{v} (explicit 301s instead of html_handling's native 307s).
 *   `/` and `/collection/{v}` are served from the prerendered index.html files
 *   by `html_handling: "drop-trailing-slash"` (wrangler.jsonc), not by a rule here.
 *
 * Kept free of TS-only runtime syntax so Node can run it with type stripping.
 */

/** The only draft rendered by the viewer (see INCLUDED_DRAFTS in generate-schemas.mjs). */
export const VIEWER_DRAFT = 'draft-07';

/** The only resource kind served (URL segment and file name). */
export const RESOURCE = 'collection';

export interface RawFile {
  /** URL path, e.g. "/json/collection/v2.1.0/collection.json". */
  path: string;
  draft: string;
  /** Concrete version whose content is served (aliases resolved). */
  version: string;
}

export interface LegacyUrls {
  raw: RawFile[];
  /** Exact source path → target path, all 301. */
  redirects: Record<string, string>;
}

const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/;

/** The single "latest" rule: highest semver-stable version (pre-releases never win). */
export function latestStable(versions: string[]): string | undefined {
  const key = (v: string): number[] => (STABLE.exec(v) ?? []).slice(1).map(Number);
  const cmp = (a: string, b: string): number => {
    const [x, y] = [key(a), key(b)];

    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  };

  return versions.filter((v) => STABLE.test(v)).sort(cmp).at(-1);
}

/** Old docson layout: draft-04 was the unprefixed default. */
const legacyBase = (draft: string, v: string): string =>
  draft === 'draft-04' ? `/json/${RESOURCE}/${v}` : `/json/${draft}/${RESOURCE}/${v}`;

/** The /collection/json layout: raw files still served; its docs pages (the old viewer URLs) now 301. */
const newBase = (draft: string, v: string): string => `/${RESOURCE}/json/${v}/${draft}`;

/** The viewer page for a VIEWER_DRAFT version, e.g. /collection/v3.0.0. */
export const viewerPage = (version: string): string => `/${RESOURCE}/${version}`;

/** The draft-07 raw schema next to the viewer page, e.g. /collection/v3.0.0/collection.json. */
export const viewerRawPath = (version: string): string => `${viewerPage(version)}/${RESOURCE}.json`;

/**
 * @param versionsByDraft every schemas/{draft}/{version} directory, e.g. { "draft-04": ["v2.1.0", ...] }.
 */
export function legacyUrls(versionsByDraft: Record<string, string[]>): LegacyUrls {
  const viewerVersions = new Set(versionsByDraft[VIEWER_DRAFT] ?? []);
  const raw: RawFile[] = [];
  const redirects: Record<string, string> = { '/index.html': '/' };

  for (const version of viewerVersions) {
    const page = viewerPage(version);

    raw.push({ path: viewerRawPath(version), draft: VIEWER_DRAFT, version });
    redirects[`${page}/`] = page;
    redirects[`${page}/index.html`] = page;
  }

  for (const [draft, versions] of Object.entries(versionsByDraft)) {
    const latest = latestStable(versions);
    const aliases: [string, string][] = versions.map((v) => [v, v]);

    if (latest) {
      aliases.push(['latest', latest]);
    }

    for (const [alias, version] of aliases) {
      const target = viewerVersions.has(version)
        ? viewerPage(version)
        : `${newBase(draft, version)}/${RESOURCE}.json`;

      for (const base of [legacyBase(draft, alias), newBase(draft, alias)]) {
        raw.push({ path: `${base}/${RESOURCE}.json`, draft, version });
        redirects[`${base}/docs/index.html`] = target;
      }

      // The old Worker route also served the bare forms (via 307s); /json/... never did.
      const base = newBase(draft, alias);

      redirects[`${base}/docs`] = target;
      redirects[`${base}/docs/`] = target;
    }
  }

  return { raw, redirects };
}

/**
 * Workers static-assets `_redirects` file for the legacy docs redirects: one
 * exact-path `source destination 301` line each. Cloudflare applies it before
 * both the static assets and the Worker.
 */
export function legacyRedirectsFile(versionsByDraft: Record<string, string[]>): string {
  return Object.entries(legacyUrls(versionsByDraft).redirects)
    .map(([from, to]) => `${from} ${to} 301\n`)
    .join('');
}

