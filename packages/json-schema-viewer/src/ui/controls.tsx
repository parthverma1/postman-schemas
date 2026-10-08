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
/* Outside-click dismissal                                                     */
/* -------------------------------------------------------------------------- */
// A press outside an open dropdown should only close it. Without this, the click
// that ends that press still reaches whatever is underneath (e.g. a row's
// expand/collapse handler), so closing a dropdown toggles a row. Call this from
// the dismissing primary-button `mousedown`: it swallows the matching `click` in
// the capture phase on window, before React's root listener sees it. It disarms
// right after that press's `mouseup` (or on the next `mousedown`), so a press
// that produces no click (scrollbar, drag-out) can't eat a later one, and it
// never touches keyboard/programmatic clicks (`detail === 0`).
function swallowNextClick() {
  const swallow = (e: MouseEvent) => {
    cleanup();
    if (e.detail === 0) return;
    e.stopPropagation();
    e.preventDefault();
  };
  // `click` is dispatched right after `mouseup` in the same task, so a 0ms timeout
  // runs after it.
  const onMouseUp = () => setTimeout(cleanup, 0);
  const cleanup = () => {
    window.removeEventListener('click', swallow, true);
    window.removeEventListener('mousedown', cleanup, true);
    window.removeEventListener('mouseup', onMouseUp, true);
  };
  window.addEventListener('click', swallow, true);
  window.addEventListener('mousedown', cleanup, true);
  window.addEventListener('mouseup', onMouseUp, true);
}

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
  const ref = React.useRef<HTMLSelectElement>(null);

  // Chrome and Safari on macOS eat the press that closes a native picker, but
  // other engines (e.g. Firefox) pass it to the page. A press outside while the
  // picker is `:open` is a dismissal, so drop its click.
  React.useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const el = ref.current;
      if (e.button === 0 && el && !el.contains(e.target as Node) && isOpen(el)) swallowNextClick();
    };
    window.addEventListener('mousedown', onMouseDown, true);
    return () => window.removeEventListener('mousedown', onMouseDown, true);
  }, []);

  return (
    // Stop propagation so interacting with the select doesn't trigger the row's
    // expand/collapse onClick handler (which wraps this control).
    <span className="jsv-select" onClick={e => e.stopPropagation()}>
      {triggerTextPrefix ? <span className="jsv-select__prefix">{triggerTextPrefix}</span> : null}
      <select
        ref={ref}
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

// `:open` matches a select whose picker is showing. Browsers without it get no
// swallowing (old behaviour). Support is checked once, lazily (not at module
// scope, which also runs during SSR).
let supportsOpen: boolean | undefined;
function isOpen(el: Element) {
  supportsOpen ??= typeof CSS !== 'undefined' && !!CSS.supports?.('selector(:open)');
  if (!supportsOpen) return false;
  try {
    return el.matches(':open');
  } catch {
    return false;
  }
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        if (e.button === 0) swallowNextClick();
      }
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
