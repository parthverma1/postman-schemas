import { isPlainObject } from '@stoplight/json';
import type { SchemaNode } from '@stoplight/json-schema-tree';

// Precomputed hex lookup tables, matching fnv-plus' internal `hl`/`hl16`.
// `hl[i]` is the two-character, zero-padded hex value of the byte `i`.
const hl: string[] = [];
for (let i = 0; i < 256; i++) {
  hl[i] = ((i >> 4) & 15).toString(16) + (i & 15).toString(16);
}
const hl16 = '0123456789abcdef';

/**
 * Pure-JS FNV-1a 52-bit hash returning a 13-char hex string.
 *
 * This is inlined from `fnv-plus`' `fast1a52hex` implementation (which we can no
 * longer import: it is CJS whose methods are not statically detectable, so under
 * SSR/workerd `fnv.fast1a52hex` resolves to `undefined`). The algorithm and its
 * output MUST stay byte-for-byte identical to fnv-plus so that stable node ids
 * remain compatible with whatever consumers have already persisted, and so that
 * server and client render identical ids (avoiding hydration mismatches).
 */
const fast1a52hex = (str: string): string => {
  let i: number;
  const l = str.length - 3;
  let t0 = 0;
  let v0 = 0x2325;
  let t1 = 0;
  let v1 = 0x8422;
  let t2 = 0;
  let v2 = 0x9ce4;
  let t3 = 0;
  let v3 = 0xcbf2;

  const step = () => {
    t0 = v0 * 435;
    t1 = v1 * 435;
    t2 = v2 * 435;
    t3 = v3 * 435;
    t2 += v0 << 8;
    t3 += v1 << 8;
    t1 += t0 >>> 16;
    v0 = t0 & 65535;
    t2 += t1 >>> 16;
    v1 = t1 & 65535;
    v3 = (t3 + (t2 >>> 16)) & 65535;
    v2 = t2 & 65535;
  };

  for (i = 0; i < l; ) {
    v0 ^= str.charCodeAt(i++);
    step();
    v0 ^= str.charCodeAt(i++);
    step();
    v0 ^= str.charCodeAt(i++);
    step();
    v0 ^= str.charCodeAt(i++);
    step();
  }

  while (i < l + 3) {
    v0 ^= str.charCodeAt(i++);
    step();
  }

  return (
    hl16[v3 & 15] +
    hl[v2 >> 8] +
    hl[v2 & 255] +
    hl[v1 >> 8] +
    hl[v1 & 255] +
    hl[(v0 >> 8) ^ (v3 >> 12)] +
    hl[(v0 ^ (v3 >> 4)) & 255]
  );
};

// for easier debugging the values going into hash
let SKIP_HASHING = false;

export const setSkipHashing = (skip: boolean) => {
  SKIP_HASHING = skip;
};

export const hash = (value: string, skipHashing: boolean = SKIP_HASHING): string => {
  // Never change this, as it would affect how the default stable id is generated, and cause mismatches with whatever
  // we already have stored in our DB etc.
  return skipHashing ? value : fast1a52hex(value);
};

export const getNodeId = (node: SchemaNode, parentId?: string): string => {
  const fragment = node.fragment;

  if (isPlainObject(fragment) && isPlainObject(fragment['x-stoplight'])) {
    const nodeId = fragment['x-stoplight'].id;
    if (typeof nodeId === 'string') return nodeId;
  }

  const key = node.path[node.path.length - 1];

  return hash(['schema_property', parentId, String(key)].join('-'));
};

export const getOriginalNodeId = (node: SchemaNode, parentId?: string): string => {
  // @ts-expect-error originalFragment does exist...
  const nodeId = node.originalFragment?.['x-stoplight']?.id;
  if (nodeId) return nodeId;

  const key = node.path[node.path.length - 1];

  return hash(['schema_property', parentId, String(key)].join('-'));
};
