const roots = new Set<HTMLElement>();
let cleanup: (() => void) | undefined;

function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer ? Array.from(event.dataTransfer.types).includes('Files') : false;
}

export function registerFileDropRoot(root: HTMLElement): () => void {
  roots.add(root);
  if (!cleanup && typeof window !== 'undefined') {
    const preventNavigation = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      if (![...roots].some((candidate) => candidate.contains(event.target as Node))) event.preventDefault();
    };
    window.addEventListener('dragover', preventNavigation);
    window.addEventListener('drop', preventNavigation);
    cleanup = () => {
      window.removeEventListener('dragover', preventNavigation);
      window.removeEventListener('drop', preventNavigation);
    };
  }
  let active = true;
  return () => {
    if (!active) return; active = false; roots.delete(root);
    if (roots.size === 0) { cleanup?.(); cleanup = undefined; }
  };
}
