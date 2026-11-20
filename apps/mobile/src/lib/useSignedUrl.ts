import { useEffect, useState } from 'react';

import { supabase } from './supabase';

export type PrivateBucket = 'visitor-photos' | 'complaint-photos' | 'notices';

/** Signed URL (1h) for an object in a private bucket, or null while loading / when there is no path. */
export function useSignedUrl(bucket: PrivateBucket, path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (!path) return;
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [bucket, path]);
  return url;
}
