/**
 * Tiny inline-SVG icon set replacing Mosaic's FontAwesome-backed `Icon`. Only the
 * handful of glyphs the viewer actually uses are included; they draw with
 * `currentColor` so callers control color via the surrounding text color.
 */
import * as React from 'react';

export type IconName = string | readonly string[];

/** Normalize Mosaic's `icon` prop (string or [prefix, name] tuple) to a glyph key. */
function iconKey(icon: IconName): string {
  return Array.isArray(icon) ? icon[icon.length - 1] : (icon as string);
}

const SIZE: Record<string, string> = {
  xs: '0.625rem',
  sm: '0.75rem',
  base: '0.875rem',
  lg: '1.25em',
  '1x': '1em',
  '2x': '2em',
};

function resolveSize(size: string | number | undefined): string {
  if (size == null) return '1em';
  if (typeof size === 'number') return `${size}px`;
  return SIZE[size] ?? size;
}

/**
 * One chevron for both row states so toggling never shifts anything: a
 * right-pointing chevron whose stroked box is square (6x6 path + 1.5 stroke)
 * and centred on (8, 8), so rotating it 90deg about the centre for the open
 * state keeps the exact same visible box.
 */
const chevron = (rotate: number) => (
  <path
    d="M5 5l6 3-6 3"
    transform={rotate ? `rotate(${rotate} 8 8)` : undefined}
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

const GLYPHS: Record<string, { viewBox: string; node: React.ReactNode }> = {
  'chevron-down': { viewBox: '0 0 16 16', node: chevron(90) },
  'chevron-right': { viewBox: '0 0 16 16', node: chevron(0) },
  'caret-down': {
    viewBox: '0 0 16 16',
    node: <path d="M4 6h8l-4 5z" fill="currentColor" />,
  },
  'exclamation-triangle': {
    viewBox: '0 0 16 16',
    node: (
      <g fill="currentColor">
        <path d="M7.13 2.2a1 1 0 0 1 1.74 0l5.7 10.05A1 1 0 0 1 13.7 13.8H2.3a1 1 0 0 1-.87-1.55L7.13 2.2z" opacity="0.15" />
        <path d="M7.13 2.2a1 1 0 0 1 1.74 0l5.7 10.05A1 1 0 0 1 13.7 13.8H2.3a1 1 0 0 1-.87-1.55L7.13 2.2zm.87 1.3L3.1 12.3h9.8L8 3.5z" />
        <path d="M7.25 6h1.5v3.5h-1.5zM7.25 10.5h1.5V12h-1.5z" />
      </g>
    ),
  },
};

export interface IconProps {
  icon: IconName;
  size?: string | number;
  fixedWidth?: boolean;
  color?: string;
  'aria-label'?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function Icon({ icon, size, fixedWidth, color, className, style, ...rest }: IconProps) {
  const key = iconKey(icon);
  const glyph = GLYPHS[key];
  const dim = resolveSize(size);
  if (!glyph) return null;
  return (
    <svg
      className={className}
      viewBox={glyph.viewBox}
      width={fixedWidth ? '1.25em' : dim}
      height={dim}
      role="img"
      aria-hidden={rest['aria-label'] ? undefined : true}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, color, ...style }}
      {...rest}
    >
      {glyph.node}
    </svg>
  );
}
