import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** Outcome of push registration; anything but `ok` means visitor alerts will not arrive. */
export type PushStatus = 'ok' | 'denied' | 'no_project_id' | 'error';

/** This device's Expo push token, remembered so sign-out can delete exactly that row. */
const TOKEN_KEY = 'pushToken';

/**
 * Creates the Android `visitor` and `default` channels, asks permission and registers this
 * device's Expo push token for the signed-in user (register_push_token moves the
 * token to the caller if someone else used this phone before).
 */
export async function registerPushToken(): Promise<PushStatus> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('visitor', {
        name: 'Visitors',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
      });
      // Notices, complaints and bills are sent without a channelId, so they land here.
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Society updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    if (!Device.isDevice) {
      console.warn('[push] not a physical device; skipping push registration');
      return 'error';
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') {
      console.warn('[push] notification permission denied');
      return 'denied';
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      console.warn('[push] no EAS projectId in app config (extra.eas.projectId)');
      return 'no_project_id';
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    if (error) {
      console.warn('[push] failed to save push token', error.message);
      return 'error';
    }
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'ok';
  } catch (e) {
    console.warn('[push] registration failed', e);
    return 'error';
  }
}

/** Deletes this device's token row (call while still signed in). Never throws. */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const { error } = await supabase.from('push_tokens').delete().eq('token', token);
    if (error) console.warn('[push] failed to delete push token', error.message);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn('[push] failed to delete push token', e);
  }
}
