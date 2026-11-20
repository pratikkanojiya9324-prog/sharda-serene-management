import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Creates the Android `visitor` channel, asks permission and upserts the Expo push token. */
export async function registerPushToken(profileId: string): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('visitor', {
      name: 'Visitors',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
    });
  }

  if (!Device.isDevice) {
    console.warn('[push] not a physical device; skipping push registration');
    return;
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') {
    console.warn('[push] notification permission denied; skipping push registration');
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('[push] no EAS projectId in app config (extra.eas.projectId); skipping push registration');
    return;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase
    .from('push_tokens')
    .upsert({ profile_id: profileId, token, platform: Platform.OS }, { onConflict: 'token' });
  if (error) console.warn('[push] failed to save push token', error.message);
}
