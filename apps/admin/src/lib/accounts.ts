// Calls the `accounts` Edge Function (admin-only account management).
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface BulkImportResult {
  results: { row: number; ok: boolean; error?: string; generated_password?: string }[];
}

export interface StaffRow {
  user_id: string;
  name: string;
  role: 'guard' | 'admin';
  username: string | null;
  disabled: boolean;
}

type Actions = {
  create_flat_account: { req: { flat_id: string; password: string }; res: { user_id: string } };
  set_password: { req: { flat_id: string; password: string } | { user_id: string; password: string }; res: { ok: true } };
  create_staff: {
    req: { society_id: string; username: string; name: string; role: 'guard' | 'admin'; password: string };
    res: { user_id: string; username: string };
  };
  list_staff: { req: { society_id: string }; res: StaffRow[] };
  disable_staff: { req: { user_id: string }; res: { ok: true } };
  bulk_import: { req: { society_id: string; rows: Record<string, string>[] }; res: BulkImportResult };
};

/** Throws Error(<error code>) on failure, e.g. "username_taken". */
export async function callAccounts<A extends keyof Actions>(action: A, body: Actions[A]['req']): Promise<Actions[A]['res']> {
  const { data, error } = await supabase.functions.invoke('accounts', { body: { action, ...body } });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await (error.context as Response).json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw new Error(error.message);
  }
  return data as Actions[A]['res'];
}
