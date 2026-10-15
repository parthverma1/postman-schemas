import { describe, it, expect } from 'vitest';
import { badgeTone, docsLink, groupByResource, LEGEND, rawPath, type HomepageEntry } from '../src/lib/homepage';

// Newest first, like the generated manifest; a second resource interleaved.
const entries: HomepageEntry[] = [
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v3.0.0', status: 'stable' },
  { resource: 'environment', label: 'Environment', draft: 'draft-07', version: 'v1.0.0', status: 'stable' },
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v2.2.0-rc.1', status: 'rc' },
  { resource: 'collection', label: 'Collection', draft: 'draft-07', version: 'v2.1.0', status: 'stable' },
];

describe('groupByResource', () => {
  it('groups by resource in first-seen order, keeping the newest-first order', () => {
    const groups = groupByResource(entries);

    expect(groups.map((g) => [g.resource, g.label])).toEqual([
      ['collection', 'Collection'],
      ['environment', 'Environment'],
    ]);
    expect(groups[0].entries.map((e) => e.version)).toEqual(['v3.0.0', 'v2.2.0-rc.1', 'v2.1.0']);
    expect(groups[1].entries.map((e) => e.version)).toEqual(['v1.0.0']);
  });

  it('returns no groups for an empty manifest', () => {
    expect(groupByResource([])).toEqual([]);
  });
});

describe('links', () => {
  it('points to the draft-07 viewer page and the raw schema', () => {
    // Exactly what index.tsx spreads onto <Link>; filled in, it's the viewer URL.
    const link = docsLink(entries[0]);
    expect(link).toEqual({
      to: '/$resource/json/$version/$draft/docs/index.html',
      params: { resource: 'collection', version: 'v3.0.0', draft: 'draft-07' },
    });
    expect(link.to.replace(/\$(\w+)/g, (_, k: keyof typeof link.params) => link.params[k])).toBe(
      '/collection/json/v3.0.0/draft-07/docs/index.html',
    );
    expect(rawPath(entries[0])).toBe('/collection/json/v3.0.0/draft-07/collection.json');
    expect(rawPath(entries[1])).toBe('/environment/json/v1.0.0/draft-07/environment.json');
  });
});

describe('badgeTone', () => {
  it.each([
    ['stable', 'success'],
    ['rc', 'info'],
    ['draft', 'warning'],
    ['beta', 'neutral'],
  ])('%s → %s', (status, tone) => {
    expect(badgeTone(status)).toBe(tone);
  });

  it('has a legend row for draft, rc and stable', () => {
    expect(LEGEND.map((l) => l.status)).toEqual(['draft', 'rc', 'stable']);
  });
});
