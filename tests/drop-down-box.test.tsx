import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef, useState } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CgDropDownBox, CgField } from '../src';
import type { CgDropDownBoxActions, CgDropDownBoxContext, CgDropDownBoxProps } from '../src';

interface Customer { id: number; code: string; name: string; }
const acme: Customer = { id: 1, code: 'C-100', name: 'Acme Manufacturing' };
const contoso: Customer = { id: 2, code: 'C-200', name: 'Contoso Retail' };
const displayCustomer = (customer: Customer) => `${customer.code} - ${customer.name}`;

describe('CgDropDownBox', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 20, y: 20, width: 260, height: 96 }));
  });

  afterEach(() => vi.restoreAllMocks());

  it('displays primitive, object, collection, controlled, and custom display values', () => {
    render(<>
      <CgDropDownBox aria-label="Number" value={0}>number</CgDropDownBox>
      <CgDropDownBox aria-label="Boolean" value={false}>boolean</CgDropDownBox>
      <CgDropDownBox aria-label="Customer" value={acme} getDisplayText={displayCustomer}>customer</CgDropDownBox>
      <CgDropDownBox aria-label="Collection" value={['MAIN', 'RETURNS']} getDisplayText={(items) => `${items.length} warehouses`}>collection</CgDropDownBox>
      <CgDropDownBox aria-label="Controlled display" value={acme} getDisplayText={displayCustomer} displayText="Authoritative">display</CgDropDownBox>
    </>);
    expect(screen.getByRole('combobox', { name: 'Number' })).toHaveValue('0');
    expect(screen.getByRole('combobox', { name: 'Boolean' })).toHaveValue('false');
    expect(screen.getByRole('combobox', { name: 'Customer' })).toHaveValue(displayCustomer(acme));
    expect(screen.getByRole('combobox', { name: 'Collection' })).toHaveValue('2 warehouses');
    expect(screen.getByRole('combobox', { name: 'Controlled display' })).toHaveValue('Authoritative');
  });

  it('supports custom empty and equality policies without losing falsey values', () => {
    const equalById = (left: Customer | null, right: Customer | null) => left?.id === right?.id;
    const view = render(<CgDropDownBox value={acme} isValueEqual={equalById} isEmptyValue={(item) => item?.id === -1} getDisplayText={displayCustomer}>body</CgDropDownBox>);
    expect(screen.getByRole('combobox')).toHaveValue(displayCustomer(acme));
    view.rerender(<CgDropDownBox value={{ ...acme, name: 'Replacement object' }} isValueEqual={equalById} isEmptyValue={(item) => item?.id === -1} getDisplayText={displayCustomer}>body</CgDropDownBox>);
    expect(screen.getByRole('combobox')).toHaveValue('C-100 - Replacement object');
  });

  it('commits immediately with deterministic callbacks and restores rejected controlled proposals', async () => {
    const events: string[] = [];
    const changed = vi.fn((_value: Customer | null) => events.push('value'));
    let context: CgDropDownBoxContext<Customer> | undefined;
    render(<CgDropDownBox value={acme} onValueChange={changed} onDisplayTextChange={() => { events.push('display'); }} onValueCommitted={() => { events.push('committed'); }} onAfterClose={() => { events.push('closed'); }} getDisplayText={displayCustomer}>{(next) => { context = next; return <button type="button">Body</button>; }}</CgDropDownBox>);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(context).toBeDefined());
    await act(() => context!.commitValue(contoso));
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue(displayCustomer(acme)));
    expect(changed).toHaveBeenCalledWith(contoso, expect.objectContaining({ reason: 'commit', previousValue: acme }));
    expect(events).toEqual(['value', 'display', 'committed', 'closed']);
  });

  it('applies explicit pending values once and preserves them when closing is cancelled', async () => {
    let context: CgDropDownBoxContext<string> | undefined;
    const changed = vi.fn();
    const beforeClose = vi.fn(() => false as boolean | void);
    const { rerender } = render(<CgDropDownBox defaultValue="MAIN" commitMode="explicit" onBeforeClose={beforeClose} onValueChange={changed}>{(next) => { context = next; return <span>{next.pendingValue}</span>; }}</CgDropDownBox>);
    fireEvent.click(screen.getByRole('combobox'));
    await waitFor(() => expect(context).toBeDefined());
    act(() => context!.setPendingValue('RETURNS'));
    await act(() => context!.cancel());
    expect(context!.pendingValue).toBe('RETURNS');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');

    rerender(<CgDropDownBox defaultValue="MAIN" commitMode="explicit" onValueChange={changed}>{(next) => { context = next; return <span>{next.pendingValue}</span>; }}</CgDropDownBox>);
    await act(() => context!.apply());
    expect(changed).toHaveBeenCalledWith('RETURNS', expect.objectContaining({ reason: 'apply' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'));
  });

  it('treats external values as authoritative while open', async () => {
    let context: CgDropDownBoxContext<Customer> | undefined;
    const props = { getDisplayText: displayCustomer, children: (next: CgDropDownBoxContext<Customer>) => { context = next; return 'body'; } };
    const view = render(<CgDropDownBox value={acme} {...props} />);
    fireEvent.click(screen.getByRole('combobox'));
    act(() => context!.setPendingValue(contoso));
    view.rerender(<CgDropDownBox value={contoso} {...props} />);
    await waitFor(() => expect(context!.pendingValue).toBe(contoso));
    expect(context!.hasPendingChanges).toBe(false);
    expect(screen.getByRole('combobox')).toHaveValue(displayCustomer(contoso));
  });

  it('supports cancellable, abortable, rejection-safe lifecycle transitions', async () => {
    let resolveFirst!: () => void;
    const firstPromise = new Promise<void>((resolve) => { resolveFirst = resolve; });
    const signals: AbortSignal[] = [];
    const errors = vi.fn();
    let calls = 0;
    const beforeOpen = vi.fn(({ signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      calls += 1;
      if (calls === 1) return firstPromise;
      if (calls === 3) return Promise.reject(new Error('open failed'));
      return true;
    });
    const actions = createRef<CgDropDownBoxActions>();
    render(<CgDropDownBox actionsRef={actions} onBeforeOpen={beforeOpen} onTransitionError={errors}>body</CgDropDownBox>);
    const first = actions.current!.open();
    const second = actions.current!.open();
    resolveFirst();
    await act(async () => { await Promise.all([first, second]); });
    expect(signals[0]?.aborted).toBe(true);
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    await act(() => actions.current!.close());
    await act(() => actions.current!.open());
    expect(errors).toHaveBeenCalledWith(expect.objectContaining({ message: 'open failed' }), 'open');
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps controlled open state authoritative when a parent rejects a proposal', () => {
    const changed = vi.fn();
    const view = render(<CgDropDownBox open={false} onOpenChange={changed}>body</CgDropDownBox>);
    fireEvent.click(screen.getByRole('combobox'));
    expect(changed).toHaveBeenCalledWith(true, expect.objectContaining({ reason: 'editorClick' }));
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    view.rerender(<CgDropDownBox open onOpenChange={changed}>body</CgDropDownBox>);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('serializes primitives and explicit object values through nested and external forms', () => {
    render(<>
      <form data-testid="nested"><CgDropDownBox name="quantity" defaultValue={0}>body</CgDropDownBox></form>
      <form id="external" data-testid="external" />
      <CgDropDownBox form="external" name="customerIds" defaultValue={acme} serializeValue={(customer) => [String(customer.id), customer.code]}>body</CgDropDownBox>
    </>);
    expect(new FormData(screen.getByTestId('nested')).get('quantity')).toBe('0');
    expect(new FormData(screen.getByTestId('external')).getAll('customerIds')).toEqual(['1', 'C-100']);
  });

  it('rejects unsafe form and sizing configurations', () => {
    const objectProps = { name: 'customer', defaultValue: acme, children: 'body' } as CgDropDownBoxProps<Customer>;
    expect(() => render(<CgDropDownBox {...objectProps} />)).toThrow(/serializeValue/u);
    expect(() => render(<CgDropDownBox dropDownWidthMode="explicit">body</CgDropDownBox>)).toThrow(/dropDownWidth/u);
    expect(() => render(<CgDropDownBox requiredErrorMessage=" ">body</CgDropDownBox>)).toThrow(/cannot be empty/u);
    expect(() => render(<CgDropDownBox name="value" defaultValue={Number.NaN}>body</CgDropDownBox>)).toThrow(/finite/u);
    expect(() => render(<CgDropDownBox name="value" defaultValue="x" serializeValue={() => []}>body</CgDropDownBox>)).toThrow(/at least one/u);
  });

  it('participates in native required validation, reset, disabled exclusion, and invalid focus', async () => {
    const changed = vi.fn();
    render(<>
      <form id="form" data-testid="form"><CgField label="Customer"><CgDropDownBox form="form" name="customer" defaultValue="C-100" onValueChange={changed} required>body</CgDropDownBox></CgField><button type="reset">Reset</button></form>
      <CgDropDownBox form="form" name="disabled" defaultValue="hidden" disabled>body</CgDropDownBox>
    </>);
    const input = screen.getByRole('combobox', { name: 'Customer' });
    fireEvent.click(input);
    const proxy = document.querySelector<HTMLSelectElement>('[data-cg-dropdownbox-form-proxy]')!;
    fireEvent.invalid(proxy);
    expect(input).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(input).toHaveAttribute('aria-expanded', 'false'));
    expect(new FormData(screen.getByTestId('form')).has('disabled')).toBe(false);
  });

  it('exposes native and action refs, clear behavior, and keyboard commands', async () => {
    const inputRef = createRef<HTMLInputElement>();
    const actions = createRef<CgDropDownBoxActions>();
    const cleared = vi.fn();
    render(<CgDropDownBox ref={inputRef} actionsRef={actions} defaultValue="A" clearable onClear={cleared}>body</CgDropDownBox>);
    expect(inputRef.current).toBeInstanceOf(HTMLInputElement);
    fireEvent.keyDown(inputRef.current!, { key: 'ArrowDown', altKey: true });
    await waitFor(() => expect(inputRef.current).toHaveAttribute('aria-expanded', 'true'));
    fireEvent.keyDown(inputRef.current!, { key: 'Escape' });
    await waitFor(() => expect(inputRef.current).toHaveAttribute('aria-expanded', 'false'));
    await act(() => actions.current!.clear());
    expect(inputRef.current).toHaveValue('');
    expect(cleared).toHaveBeenCalledOnce();
    actions.current!.focus();
    expect(inputRef.current).toHaveFocus();
    expect(actions.current!.getDisplayText()).toBe('');
  });

  it('renders templates, custom buttons, state precedence, and reported state', async () => {
    let context: CgDropDownBoxContext<string> | undefined;
    render(<CgDropDownBox defaultValue="A" renderDisplay={({ displayText }) => <strong>{displayText}</strong>} renderHeader={() => 'Header'} renderFooter={() => 'Footer'} renderLoading={() => 'Custom loading'} buttons={[{ key: 'action', text: 'Action', ariaLabel: 'Action' }]}>{(next) => { context = next; return 'Body'; }}</CgDropDownBox>);
    expect(screen.getByText('A', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
    act(() => context!.reportLoading(true));
    expect(screen.getByText('Custom loading')).toBeInTheDocument();
    act(() => { context!.reportLoading(false); context!.reportError(new Error('failed')); });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load content.');
  });

  it('keeps hosted keyboard events independent and closes only the topmost outside layer', async () => {
    function Fixture() {
      const [nested, setNested] = useState(false);
      return <><CgDropDownBox>{() => <button onClick={() => setNested(true)} onKeyDown={(event) => event.stopPropagation()}>Hosted action</button>}</CgDropDownBox>{nested ? <div role="dialog">Nested</div> : null}<button>Outside</button></>;
    }
    render(<Fixture />);
    fireEvent.click(screen.getByRole('combobox'));
    const hosted = screen.getByRole('button', { name: 'Hosted action' });
    fireEvent.keyDown(hosted, { key: 'ArrowDown' });
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true');
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    await waitFor(() => expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false'));
  });

  it('cleans up in-flight transitions on unmount', async () => {
    let signal: AbortSignal | undefined;
    const view = render(<CgDropDownBox onBeforeOpen={(details) => { signal = details.signal; return new Promise(() => undefined); }}>body</CgDropDownBox>);
    fireEvent.click(screen.getByRole('combobox'));
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('renders without a portal during server rendering', () => {
    expect(() => renderToString(<CgDropDownBox defaultOpen defaultValue="SSR">body</CgDropDownBox>)).not.toThrow();
  });
});
