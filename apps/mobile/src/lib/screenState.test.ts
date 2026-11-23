import { screenState } from './screenState';

describe('screenState', () => {
  it('loading before the first load finishes', () => {
    expect(screenState({ loaded: false, error: null })).toBe('loading');
  });
  it('error when the first load failed', () => {
    expect(screenState({ loaded: false, error: 'No internet connection, try again' })).toBe('error');
  });
  it('ready after a successful load', () => {
    expect(screenState({ loaded: true, error: null })).toBe('ready');
  });
  it('an error after a successful load keeps the content (banner only)', () => {
    expect(screenState({ loaded: true, error: 'x' })).toBe('ready');
  });
  it('no_flat when a flat is needed, lookup finished and none found', () => {
    expect(screenState({ loaded: false, error: null, needsFlat: true, flatLoading: false, hasFlat: false })).toBe('no_flat');
  });
  it('no_flat beats loading and error', () => {
    expect(screenState({ loaded: false, error: 'x', needsFlat: true, flatLoading: false, hasFlat: false })).toBe('no_flat');
  });
  it('loading while the flat lookup is still running', () => {
    expect(screenState({ loaded: false, error: null, needsFlat: true, flatLoading: true, hasFlat: false })).toBe('loading');
  });
  it('ready when the flat exists and data loaded', () => {
    expect(screenState({ loaded: true, error: null, needsFlat: true, flatLoading: false, hasFlat: true })).toBe('ready');
  });
  it('needsFlat unset ignores the flat', () => {
    expect(screenState({ loaded: true, error: null, flatLoading: false, hasFlat: false })).toBe('ready');
  });
});
