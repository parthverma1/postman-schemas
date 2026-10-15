import { describe, it, expect } from 'vitest';
import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { deserializeTree, JsonSchemaViewer } from '../packages/json-schema-viewer/src';
import { buildSerializedTree } from '../packages/json-schema-viewer/src/worker';
import { choiceTabsFit } from '../packages/json-schema-viewer/src/ui';
import type { JSONSchema } from '../packages/json-schema-viewer/src/types';

const schema = {
  type: 'object',
  properties: {
    pet: {
      description: 'The pet.',
      oneOf: [
        { title: 'Cat', type: 'object', description: 'A cat.', properties: { meow: { type: 'string' } } },
        { title: 'Dog', type: 'object', description: 'A dog.', properties: { bark: { type: 'string' } } },
      ],
    },
    either: { anyOf: [{ type: 'string' }, { type: 'number' }] },
    list: {
      type: 'array',
      items: { oneOf: [{ title: 'A', type: 'object', properties: { a: { type: 'string' } } }, { title: 'B', type: 'string' }] },
    },
  },
} as JSONSchema;

// The server render (also the first client render): fit detection only runs after mount.
function render(defaultExpandedDepth?: number) {
  const { tree, nodeCount } = buildSerializedTree(schema);
  return renderToString(
    React.createElement(JsonSchemaViewer, { tree: { root: deserializeTree(tree), nodeCount }, defaultExpandedDepth }),
  );
}

type Tab = { label: string; selected: boolean; active: boolean };
function tabLists(html: string): Tab[][] {
  return [...html.matchAll(/<div[^>]*role="tablist"[^>]*>(.*?)<\/div>/g)].map(([, list]) =>
    [...list.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map(([, attrs, label]) => {
      expect(attrs).toContain('role="tab"');
      return { label, selected: attrs.includes('aria-selected="true"'), active: attrs.includes('data-active') };
    }),
  );
}

describe('oneOf choice tabs (server render)', () => {
  it('renders oneOf choices as tabs in schema order, with the first one selected', () => {
    const lists = tabLists(render());
    expect(lists.map(list => list.map(tab => tab.label))).toEqual([
      ['Cat', 'Dog'],
      ['A', 'B'],
    ]);
    for (const list of lists) {
      expect(list.map(tab => tab.selected)).toEqual([true, false]);
      expect(list.map(tab => tab.active)).toEqual([true, false]);
    }
  });

  it('keeps the dropdown for anyOf', () => {
    const html = render();
    const either = html.slice(html.indexOf('property-name-either'), html.indexOf('property-name-list'));
    expect(either).not.toContain('role="tablist"');
    expect(either).toContain('jsv-select__control');
    expect(either).toContain('any of: ');
  });

  it('labels the tabs with the combiner, like the dropdown', () => {
    const html = render();
    expect(html).toMatch(/<span class="jsv-select__prefix">one of: <\/span><div[^>]*role="tablist"[^>]*aria-label="pet type, one of"/);
    expect(html).toMatch(
      /<span class="jsv-select__prefix">array one of: <\/span><div[^>]*role="tablist"[^>]*aria-label="list type, array one of"/,
    );
    // A hidden copy of the tabs is measured for the fit check.
    expect(html).toContain('class="jsv-choice-tabs__measure" aria-hidden="true"');
  });

  it('places the tabs between the property description and the variant description', () => {
    const html = render();
    const own = html.indexOf('The pet.');
    const tabs = html.indexOf('role="tablist"');
    const variant = html.indexOf('A cat.');
    expect(own).toBeGreaterThan(-1);
    expect(own).toBeLessThan(tabs);
    expect(tabs).toBeLessThan(variant);
    expect(html).not.toContain('A dog.');
  });

  it('wraps the selected variant’s children in a tab panel', () => {
    const html = render(Infinity);
    const panels = [...html.matchAll(/<div([^>]*role="tabpanel"[^>]*)>/g)].map(([, attrs]) => attrs);
    expect(panels).toHaveLength(2);
    // The rows inside are the tab stops, not the panel.
    for (const attrs of panels) expect(attrs).not.toContain('tabindex');
    const pet = html.slice(html.indexOf('property-name-pet'), html.indexOf('property-name-either'));
    expect(pet).toContain('role="tabpanel"');
    expect(pet).toContain('property-name-meow');
    expect(pet).not.toContain('property-name-bark');
  });
});

describe('choiceTabsFit', () => {
  it('fits when the tabs are no wider than the slot', () => {
    expect(choiceTabsFit(200, 300)).toBe(true);
    expect(choiceTabsFit(300, 300)).toBe(true);
  });

  it('falls back when the tabs are wider, rounding the tabs up and the slot down', () => {
    expect(choiceTabsFit(301, 300)).toBe(false);
    expect(choiceTabsFit(300.2, 300.9)).toBe(false);
    expect(choiceTabsFit(0, 0)).toBe(true);
  });
});
