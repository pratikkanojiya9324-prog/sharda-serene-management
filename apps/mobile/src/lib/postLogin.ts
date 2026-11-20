import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { registerPushToken, type PushStatus } from './push';
import { pickHome, type Home, type Role } from './session';
import { supabase } from './supabase';

const BATTERY_GUIDE_FLAG = 'batteryGuideShown';

export async function markBatteryGuideShown(): Promise<void> {
  await AsyncStorage.setItem(BATTERY_GUIDE_FLAG, '1');
}

export type BootstrapResult = {
  home: Home;
  showBatteryGuide: boolean;
  roles: Role[];
  /** null when push was not attempted (no app access). */
  pushStatus: PushStatus | null;
};

/**
 * Runs once per signed-in user: claim invites, load memberships, register push,
 * and decide where to go.
 */
export async function bootstrapSignedInUser(userId: string): Promise<BootstrapResult> {
  const claim = await supabase.rpc('claim_invites');
  if (claim.error) throw claim.error;

  const { data, error } = await supabase.from('memberships').select('role').eq('profile_id', userId);
  if (error) throw error;

  const roles = (data ?? []).map((m) => m.role);
  const home = pickHome(data ?? []);
  if (home === '/no-access') return { home, showBatteryGuide: false, roles, pushStatus: null };

  const pushStatus = await registerPushToken();

  const shown = Platform.OS === 'android' ? await AsyncStorage.getItem(BATTERY_GUIDE_FLAG) : '1';
  return { home, showBatteryGuide: shown === null, roles, pushStatus };
}
