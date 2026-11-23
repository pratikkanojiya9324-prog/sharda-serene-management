export type ScreenState = 'loading' | 'no_flat' | 'error' | 'ready';

/**
 * What a list screen should show. `loaded` means a load has succeeded; an error
 * after a successful load keeps the content visible (the screen shows a Banner).
 */
export function screenState(i: {
  loaded: boolean;
  error: string | null;
  needsFlat?: boolean;
  flatLoading?: boolean;
  hasFlat?: boolean;
}): ScreenState {
  if (i.needsFlat && !i.flatLoading && !i.hasFlat) return 'no_flat';
  if (i.error && !i.loaded) return 'error';
  if (!i.loaded) return 'loading';
  return 'ready';
}
