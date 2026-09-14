/**
 * Interactive controls replacing the Mosaic widgets the viewer used. These favor
 * native, SSR-friendly elements (`<select>`, `<button>`, `title` tooltips) styled
 * with static classes (see styles.css) + Aether tokens — no runtime CSS injection.
 */
import * as React from 'react';
import { resolveStyle } from './styleProps';

/* -------------------------------------------------------------------------- */
/* Provider — Mosaic's theme Provider is a no-op here; tokens come from CSS.   */
/* -------------------------------------------------------------------------- */
export const Provider = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

/* -------------------------------------------------------------------------- */
/* Link                                                                        */
/* -------------------------------------------------------------------------- */
export const Link = React.forwardRef<HTMLAnchorElement, Record<string, unknown>>(function Link(props, ref) {
  const { style, rest } = resolveStyle(props);
  return <a ref={ref} className="jsv-link" style={{ cursor: 'pointer', ...style }} {...(rest as object)} />;
});

/* -------------------------------------------------------------------------- */
/* Pressable — button-like wrapper that spreads trigger props.                 */
/* -------------------------------------------------------------------------- */
export const Pressable = React.forwardRef<HTMLButtonElement, Record<string, unknown>>(function Pressable(
  { children, ...props },
  ref,
) {
  return (
    <button ref={ref} type="button" className="jsv-pressable" {...(props as object)}>
      {children as React.ReactNode}
    </button>
  );
});

/* -------------------------------------------------------------------------- */
/* Select — native select with an optional text prefix.                        */
/* -------------------------------------------------------------------------- */
export interface SelectOption {
  value: string;
  label?: string;
}
export interface SelectProps {
  options: SelectOption[];
  value?: string;
  // Mosaic's Select emitted the option `value` (a string here); typed loosely so
  // callers that index arrays with the result (`value as number`) still type-check.
  onChange?: (value: string | number) => void;
  triggerTextPrefix?: string;
  size?: string;
  'aria-label'?: string;
}
export function Select({ options, value, onChange, triggerTextPrefix, ...rest }: SelectProps) {
  return (
    // Stop propagation so interacting with the select doesn't trigger the row's
    // expand/collapse onClick handler (which wraps this control).
    <span className="jsv-select" onClick={e => e.stopPropagation()}>
      {triggerTextPrefix ? <span className="jsv-select__prefix">{triggerTextPrefix}</span> : null}
      <select
        className="jsv-select__control"
        value={value}
        onChange={e => onChange?.(e.target.value)}
        onClick={e => e.stopPropagation()}
        onMouseDown={e => e.stopPropagation()}
        aria-label={rest['aria-label']}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label ?? opt.value}
          </option>
        ))}
      </select>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Menu — disclosure dropdown.                                                 */
/* -------------------------------------------------------------------------- */
export interface MenuItem {
  id: string | number;
  title: React.ReactNode;
  onPress?: () => void;
}
export interface MenuProps {
  items: MenuItem[];
  renderTrigger: (props: {
    onClick: (e: React.MouseEvent) => void;
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
  }) => React.ReactNode;
  closeOnPress?: boolean;
  'aria-label'?: string;
  placement?: string;
}
export function Menu({ items, renderTrigger, closeOnPress = true }: MenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <span className="jsv-menu" ref={ref}>
      {renderTrigger({
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setOpen(o => !o);
        },
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {open ? (
        <ul className="jsv-menu__list" role="menu">
          {items.map(item => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="jsv-menu__item"
                onClick={() => {
                  item.onPress?.();
                  if (closeOnPress) setOpen(false);
                }}
              >
                {item.title}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip — native title tooltip (SSR-safe, no portal/runtime CSS).           */
/* -------------------------------------------------------------------------- */
export interface TooltipProps {
  renderTrigger: React.ReactNode;
  children?: React.ReactNode;
}
export function Tooltip({ renderTrigger, children }: TooltipProps) {
  const title = typeof children === 'string' ? children : undefined;
  return (
    <span className="jsv-tooltip" title={title}>
      {renderTrigger}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* NodeAnnotation — diff marker; renders nothing without change data.          */
/* -------------------------------------------------------------------------- */
export interface NodeAnnotationProps {
  // Diff metadata from json-schema-tree; `false`/`undefined` when a node is unchanged
  // (viewer's `nodeHasChanged` returns those), so accept them and render nothing.
  change?: { type?: string; [key: string]: unknown } | false | null;
  style?: React.CSSProperties;
}
export function NodeAnnotation({ change, style }: NodeAnnotationProps) {
  if (!change || !change.type) return null;
  const colorByType: Record<string, string> = {
    added: 'var(--content-color-success)',
    removed: 'var(--content-color-error)',
    modified: 'var(--content-color-warning)',
  };
  return (
    <span
      aria-hidden
      style={{
        position: 'absolute',
        width: 3,
        top: 0,
        bottom: 0,
        borderRadius: 2,
        background: colorByType[change.type] ?? 'var(--border-color-strong)',
        ...style,
      }}
    />
  );
}
