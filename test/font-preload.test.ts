import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { INTER_PRELOAD_HREFS } from '../src/lib/fonts';

const css = fs.readFileSync(path.resolve(__dirname, '../src/styles/app.css'), 'utf8');

// weight -> woff2 URL, from each @font-face block in app.css.
const woff2ByWeight = new Map<string, string>();
for (const [block] of css.matchAll(/@font-face\s*\{[^}]*\}/g)) {
  const weight = block.match(/font-weight:\s*(\d+)/)?.[1];
  const url = block.match(/url\(['"]?([^'")]+\.woff2)['"]?\)/)?.[1];
  if (weight && url) woff2ByWeight.set(weight, url);
}

describe('Inter font preload', () => {
  it('preloads the 400 and 700 woff2 URLs declared in app.css', () => {
    expect(woff2ByWeight.get('400')).toBeDefined();
    expect(woff2ByWeight.get('700')).toBeDefined();
    expect([...INTER_PRELOAD_HREFS]).toEqual([woff2ByWeight.get('400'), woff2ByWeight.get('700')]);
  });
});
