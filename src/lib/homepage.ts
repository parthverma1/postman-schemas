/**
 * Pure helpers for the homepage version tables (no manifest import, so tests can
 * use a fixture list).
 */

export interface HomepageEntry {
  resource: string;
  label: string;
  draft: string;
  version: string;
  status: string;
}

export interface ResourceGroup<T extends HomepageEntry = HomepageEntry> {
  resource: string;
  label: string;
  entries: T[];
}

/** The viewer page for a version. */
export const docsPath = (e: HomepageEntry): string =>
  `/${e.resource}/json/${e.version}/${e.draft}/docs/index.html`;

/** The raw compiled schema for a version. */
export const rawPath = (e: HomepageEntry): string =>
  `/${e.resource}/json/${e.version}/${e.draft}/${e.resource}.json`;

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

/** Status → the `--badge-*` token family used for its badge. */
export function badgeTone(status: string): 'success' | 'info' | 'warning' | 'neutral' {
  switch (status) {
    case 'stable':
      return 'success';
    case 'rc':
      return 'info';
    case 'draft':
      return 'warning';
    default:
      return 'neutral';
  }
}

/** The legend, in production's wording. */
export const LEGEND: { status: string; description: string }[] = [
  { status: 'draft', description: 'Draft - unstable and liable to be changed anytime' },
  { status: 'rc', description: 'Release Candidate - Only minor changes possible in the future' },
  {
    status: 'stable',
    description:
      'Stable - No changes likely. In exceptional cases, changes may occur, but they will be backwards compatible',
  },
];
