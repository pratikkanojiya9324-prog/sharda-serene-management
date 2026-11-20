import { createClient } from '@supabase/supabase-js';
import type { Database } from '@society-gate/shared';

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);

/** The society this admin site is configured for (VITE_SOCIETY_ID). Empty when not set. */
export const SOCIETY_ID: string = (import.meta.env.VITE_SOCIETY_ID ?? '').trim();
