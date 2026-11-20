import { clearActorName } from './actor';
import { unregisterPushToken } from './push';
import { supabase } from './supabase';

async function forgetActorName(): Promise<void> {
  try {
    await clearActorName();
  } catch (e) {
    console.warn('[signOut] failed to clear the actor name', e);
  }
}

// Whenever the session ends (sign-out here, a revoked refresh token, sign-out
// elsewhere), forget "who's using this phone" so the next flat is asked again.
// Registered at module load: the root layout imports this module at startup.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') void forgetActorName();
});

/**
 * Signs out after deleting this device's push token, so the next person who
 * uses this phone does not receive the previous user's alerts. Forgetting the
 * actor name runs after sign-out and can never block it.
 */
export async function signOut(): Promise<void> {
  await unregisterPushToken();
  await supabase.auth.signOut();
  await forgetActorName();
}
