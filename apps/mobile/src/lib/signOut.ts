import { unregisterPushToken } from './push';
import { supabase } from './supabase';

/**
 * Signs out after deleting this device's push token, so the next person who
 * uses this phone does not receive the previous user's visitor alerts.
 */
export async function signOut(): Promise<void> {
  await unregisterPushToken();
  await supabase.auth.signOut();
}
