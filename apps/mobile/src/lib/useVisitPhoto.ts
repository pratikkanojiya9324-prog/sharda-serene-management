import { useEffect, useState } from 'react';

import { supabase } from './supabase';

/** Signed URL (1h) for a private `visitor-photos` object, or null. */
export function useVisitPhoto(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return;
    supabase.storage
      .from('visitor-photos')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}
