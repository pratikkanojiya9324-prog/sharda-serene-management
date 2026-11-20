import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { registerPushToken } from './push';
import { pickHome, type Home } from './session';
import { supabase } from './supabase';

const BATTERY_GUIDE_FLAG = 'batteryGuideShown';

export async function markBatteryGuideShown(): Promise<void> {
  await AsyncStorage.setItem(BATTERY_GUIDE_FLAG, '1');
}

/**
 * Runs once per signed-in user: claim invites, load memberships, register push,
 * and decide where to go. Returns the home route and whether to show the battery guide first.
 */
export async function bootstrapSignedInUser(
  userId: string,
): Promise<{ home: Home; showBatteryGuide: boolean }> {
  const claim = await supabase.rpc('claim_invites');
  if (claim.error) throw claim.error;

  const { data, error } = await supabase.from('memberships').select('role').eq('profile_id', userId);
  if (error) throw error;

  const home = pickHome(data ?? []);
  if (home === '/no-access') return { home, showBatteryGuide: false };

  await registerPushToken(userId).catch((e) => console.warn('[push] registration failed', e));

  const shown = Platform.OS === 'android' ? await AsyncStorage.getItem(BATTERY_GUIDE_FLAG) : '1';
  return { home, showBatteryGuide: shown === null };
}
