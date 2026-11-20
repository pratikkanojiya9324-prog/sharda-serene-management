/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  /** The society this admin site manages (staff usernames are per society). */
  readonly VITE_SOCIETY_ID: string;
}
