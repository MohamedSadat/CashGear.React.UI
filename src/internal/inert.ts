interface InertLease {
  count: number;
  initiallyInert: boolean;
}

const leases = new WeakMap<Element, InertLease>();

export function acquireInert(element: Element): () => void {
  const current = leases.get(element);
  if (current) {
    current.count += 1;
  } else {
    leases.set(element, { count: 1, initiallyInert: element.hasAttribute('inert') });
    element.setAttribute('inert', '');
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const lease = leases.get(element);
    if (!lease) return;
    lease.count -= 1;
    if (lease.count > 0) return;
    if (!lease.initiallyInert) element.removeAttribute('inert');
    leases.delete(element);
  };
}
