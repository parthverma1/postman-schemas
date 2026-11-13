/**
 * Interactive controls replacing the Mosaic widgets the viewer used. Select,
 * ChoiceTabs, Menu and Infotip are Base UI primitives (focus, keyboard, aria,
 * outside-dismiss incl. touch handled for us); the rest are plain SSR-friendly elements (`<button>`, `title` tooltips).
 * All are styled with static classes (see styles.css) + Aether tokens — no
 * runtime CSS injection.
 */
import { Menu as MenuPrimitive } from '@base-ui/react/menu';
import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import { Select as SelectPrimitive } from '@base-ui/react/select';
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs';
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
/* Select — Base UI listbox with an optional text prefix.                      */
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
  // Name of the thing being picked (e.g. the property name). Builds the trigger's
  // accessible name "<label> type, <prefix><current>", which contains the visible
  // text. Without it (and without `aria-label`) the visible text is the name.
  label?: string;
  'aria-label'?: string;
}
export function Select({ options, value, onChange, triggerTextPrefix, label, ...rest }: SelectProps) {
  const current = options.find(opt => opt.value === value) ?? options[0];
  const currentText = current ? (current.label ?? current.value) : '';
  const ariaLabel =
    rest['aria-label'] ??
    (label ? `${label} type${triggerTextPrefix ? `, ${triggerTextPrefix}` : ': '}${currentText}` : undefined);

  return (
    // React synthetic events bubble along the React tree, not the DOM, so clicks
    // inside the portaled popup (incl. Base UI's modal backdrop, which takes the
    // dismissing outside press) still reach the row's expand/collapse onClick
    // that wraps this control. Stop them here, around Root + Portal.
    <span className="jsv-select" onClick={e => e.stopPropagation()}>
      {triggerTextPrefix ? <span className="jsv-select__prefix">{triggerTextPrefix}</span> : null}
      <SelectPrimitive.Root value={current?.value ?? null} onValueChange={v => v != null && onChange?.(v)}>
        <SelectPrimitive.Trigger className="jsv-select__control" aria-label={ariaLabel}>
          {/* Explicit children so the label is in the SSR HTML. */}
          <SelectPrimitive.Value>{currentText}</SelectPrimitive.Value>
          <SelectPrimitive.Icon className="jsv-select__icon">
            <Chevron />
          </SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal className="jsv-dropdown-portal">
          <SelectPrimitive.Positioner
            className="jsv-dropdown-positioner"
            alignItemWithTrigger={false}
            side="bottom"
            align="start"
            sideOffset={4}
          >
            <SelectPrimitive.Popup className="jsv-dropdown jsv-dropdown--select">
              <SelectPrimitive.List>
                {options.map(opt => (
                  <SelectPrimitive.Item key={opt.value} value={opt.value} className="jsv-dropdown__item">
                    <SelectPrimitive.ItemIndicator className="jsv-dropdown__indicator">
                      <Check />
                    </SelectPrimitive.ItemIndicator>
                    <SelectPrimitive.ItemText>{opt.label ?? opt.value}</SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* ChoiceTabs — Base UI tabs for picking a variant, falling back to Select.    */
/* -------------------------------------------------------------------------- */
/*
 * ChoiceTabs wraps the whole row (head + children) so the tab list and the panel
 * share one Tabs.Root. ChoiceTabList is the switcher slot: it renders tabs on
 * the server and on the first client render, then measures and swaps to the
 * Select when the tabs don't fit. ChoicePanel wraps the selected variant's
 * children; it stays mounted in both modes, so swapping never remounts them.
 */
const ChoiceTabsContext = React.createContext<{ asTabs: boolean; setAsTabs: (asTabs: boolean) => void }>({
  asTabs: true,
  setAsTabs: () => {},
});

// useLayoutEffect warns during SSR on React 18; nothing is measured there anyway.
const useIsoLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

export interface ChoiceTabsProps {
  value: string;
  onChange: (value: string) => void;
  children?: React.ReactNode;
}
export function ChoiceTabs({ value, onChange, children }: ChoiceTabsProps) {
  const [asTabs, setAsTabs] = React.useState(true);
  const context = React.useMemo(() => ({ asTabs, setAsTabs }), [asTabs]);
  return (
    <TabsPrimitive.Root className="jsv-choice-tabs-root" value={value} onValueChange={v => onChange(v as string)}>
      <ChoiceTabsContext.Provider value={context}>{children}</ChoiceTabsContext.Provider>
    </TabsPrimitive.Root>
  );
}

/** Whether content `required` px wide fits a box `available` px wide (sub-pixel widths). */
export function choiceTabsFit(required: number, available: number) {
  return Math.ceil(required) <= Math.floor(available);
}

export type ChoiceTabListProps = Omit<SelectProps, 'size' | 'aria-label'> & { value: string };
export function ChoiceTabList({ options, value, onChange, triggerTextPrefix, label }: ChoiceTabListProps) {
  const { asTabs, setAsTabs } = React.useContext(ChoiceTabsContext);
  const slotRef = React.useRef<HTMLDivElement>(null);
  const measureRef = React.useRef<HTMLSpanElement>(null);

  // Before paint: compare the tabs' natural width (the hidden measurer) with
  // the slot's, and again whenever either changes (viewport, fonts loading).
  useIsoLayoutEffect(() => {
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;
    const update = () =>
      setAsTabs(choiceTabsFit(measure.getBoundingClientRect().width, slot.getBoundingClientRect().width));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(slot);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [setAsTabs]);

  const prefix = triggerTextPrefix ? <span className="jsv-select__prefix">{triggerTextPrefix}</span> : null;
  const combinerName = triggerTextPrefix?.replace(/:\s*$/, '');
  const listLabel = [label && `${label} type`, combinerName].filter(Boolean).join(', ') || undefined;

  return (
    <div ref={slotRef} className="jsv-choice-tabs">
      {/* Same classes and text as the tabs, at max-content width. */}
      <span ref={measureRef} className="jsv-choice-tabs__measure" aria-hidden="true">
        {prefix}
        <span className="jsv-choice-tabs__list">
          {options.map(opt => (
            <span key={opt.value} className="jsv-choice-tabs__tab">
              {opt.label ?? opt.value}
            </span>
          ))}
        </span>
      </span>
      {asTabs ? (
        <>
          {prefix}
          <TabsPrimitive.List className="jsv-choice-tabs__list" aria-label={listLabel}>
            {options.map(opt => (
              <TabsPrimitive.Tab key={opt.value} value={opt.value} className="jsv-choice-tabs__tab">
                {opt.label ?? opt.value}
              </TabsPrimitive.Tab>
            ))}
          </TabsPrimitive.List>
        </>
      ) : (
        <Select
          options={options}
          value={value}
          onChange={onChange}
          triggerTextPrefix={triggerTextPrefix}
          label={label}
        />
      )}
    </div>
  );
}

export function ChoicePanel({ value, children }: { value: string; children?: React.ReactNode }) {
  const { asTabs } = React.useContext(ChoiceTabsContext);
  return (
    <TabsPrimitive.Panel
      value={value}
      // The rows inside have their own tab stops, so the panel isn't one. With
      // the Select there are no tabs, so it's a plain wrapper.
      tabIndex={undefined}
      {...(asTabs ? null : { role: undefined, id: undefined, 'aria-labelledby': undefined })}
    >
      {children}
    </TabsPrimitive.Panel>
  );
}

const Chevron = () => (
  <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
    <path d="M1 2.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);
const Check = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
    <path d="M1.5 5.25l2.25 2.25 4.75-5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/* Menu — Base UI menu.                                                        */
/* -------------------------------------------------------------------------- */
export interface MenuItem {
  id: string | number;
  title: React.ReactNode;
  onPress?: () => void;
}
export interface MenuProps {
  items: MenuItem[];
  // Must return a single element that forwards its ref and spreads props (e.g.
  // Pressable); Base UI wires up the trigger behaviour and aria attributes.
  renderTrigger: () => React.ReactElement;
  closeOnPress?: boolean;
  // Names the menu itself; the trigger is named by its visible text.
  'aria-label'?: string;
  // "<side> <align>", e.g. "bottom left".
  placement?: string;
}
const ALIGN: Record<string, 'start' | 'end'> = { left: 'start', top: 'start', right: 'end', bottom: 'end' };
export function Menu({ items, renderTrigger, closeOnPress = true, placement = 'bottom left', ...rest }: MenuProps) {
  const [side, align] = placement.split(' ') as ['top' | 'right' | 'bottom' | 'left', string | undefined];

  return (
    // See Select: stops React-tree click bubbling from the portaled popup/backdrop.
    <span className="jsv-menu" onClick={e => e.stopPropagation()}>
      <MenuPrimitive.Root>
        <MenuPrimitive.Trigger render={renderTrigger()} />
        <MenuPrimitive.Portal className="jsv-dropdown-portal">
          <MenuPrimitive.Positioner
            className="jsv-dropdown-positioner"
            side={side}
            align={align ? (ALIGN[align] ?? 'center') : 'start'}
            sideOffset={4}
          >
            <MenuPrimitive.Popup
              className="jsv-dropdown"
              // Base UI names the menu after its trigger (aria-labelledby); an
              // explicit label replaces that.
              {...(rest['aria-label'] ? { 'aria-label': rest['aria-label'], 'aria-labelledby': undefined } : null)}
            >
              {items.map(item => (
                <MenuPrimitive.Item
                  key={item.id}
                  className="jsv-dropdown__item"
                  closeOnClick={closeOnPress}
                  onClick={() => item.onPress?.()}
                >
                  {item.title}
                </MenuPrimitive.Item>
              ))}
            </MenuPrimitive.Popup>
          </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
      </MenuPrimitive.Root>
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
/* Infotip — Base UI Popover that also opens on hover.                        */
/* -------------------------------------------------------------------------- */
export interface InfotipProps {
  // Visible trigger content, e.g. "*".
  trigger: React.ReactNode;
  // Popup text; also the trigger's accessible name, so it's announced once.
  children: string;
  className?: string;
  'data-test'?: string;
}
export function Infotip({ trigger, children, className, ...rest }: InfotipProps) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        className={className}
        aria-label={children}
        // Opens after Base UI's default 300ms hover delay.
        openOnHover
        // Not a tab stop; screen readers still reach it as a button.
        tabIndex={-1}
        {...rest}
      >
        {trigger}
      </PopoverPrimitive.Trigger>
      {/* Nothing is rendered here until it opens, so SSR emits only the trigger. */}
      <PopoverPrimitive.Portal className="jsv-dropdown-portal">
        <PopoverPrimitive.Positioner className="jsv-dropdown-positioner" side="top" sideOffset={4}>
          {/* Keep focus on the trigger; the popup has nothing to interact with. */}
          <PopoverPrimitive.Popup className="jsv-dropdown jsv-infotip" initialFocus={false} finalFocus={false}>
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
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
