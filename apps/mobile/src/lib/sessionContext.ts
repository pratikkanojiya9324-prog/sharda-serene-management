import type { Session } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

// The current auth session, provided by the root layout.
export const SessionContext = createContext<Session | null>(null);

export const useSession = () => useContext(SessionContext);
