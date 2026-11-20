import { useSignedUrl } from './useSignedUrl';

/** Signed URL (1h) for a private `visitor-photos` object, or null. */
export function useVisitPhoto(path: string | null | undefined): string | null {
  return useSignedUrl('visitor-photos', path);
}
