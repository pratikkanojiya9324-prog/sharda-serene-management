import { clearActorName } from './actor';
import { unregisterPushToken } from './push';
import { supabase } from './supabase';

/**
 * Signs out after deleting this device's push token, so the next person who
 * uses this phone does not receive the previous user's alerts, and forgets the
 * "who's using this phone" name so the next flat is asked again.
 */
export async function signOut(): Promise<void> {
  await unregisterPushToken();
  await clearActorName();
  await supabase.auth.signOut();
}
