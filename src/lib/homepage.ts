/**
 * Pure helpers for the homepage version tables (no manifest import, so tests can
 * use a fixture list).
 */

export interface HomepageEntry {
  resource: string;
  label: string;
  draft: string;
  version: string;
}

export interface ResourceGroup<T extends HomepageEntry = HomepageEntry> {
  resource: string;
  label: string;
  entries: T[];
}

/** The homepage table links open in a new tab. */
export const NEW_TAB = { target: '_blank', rel: 'noopener' } as const;

/** The viewer page for a version (e.g. /collection/v3.0.0), as the `to` + `params` (+ new tab) that the homepage's `<Link>` renders. */
export const docsLink = (e: HomepageEntry) => ({
  to: '/$resource/$version' as const,
  params: { resource: e.resource, version: e.version },
  ...NEW_TAB,
});

/** The raw compiled (draft-07) schema next to the viewer page, e.g. /collection/v3.0.0/collection.json. */
export const rawPath = (e: HomepageEntry): string => `/${e.resource}/${e.version}/${e.resource}.json`;

// Curated, not derived: the homepage lists only these versions (newest first); a new release needs a line here.
export const HOMEPAGE_VERSIONS: readonly string[] = ['v3.0.0', 'v2.1.0'];

/** The homepage tables: only HOMEPAGE_VERSIONS (missing ones are skipped), grouped by resource. */
export const homepageGroups = <T extends HomepageEntry>(entries: T[]): ResourceGroup<T>[] =>
  groupByResource(entries.filter((e) => HOMEPAGE_VERSIONS.includes(e.version)));

/** Groups entries by resource, keeping the input order (the manifest is newest first). */
export function groupByResource<T extends HomepageEntry>(entries: T[]): ResourceGroup<T>[] {
  const groups = new Map<string, ResourceGroup<T>>();

  for (const e of entries) {
    let group = groups.get(e.resource);

    if (!group) {
      group = { resource: e.resource, label: e.label, entries: [] };
      groups.set(e.resource, group);
    }

    group.entries.push(e);
  }

  return [...groups.values()];
}
