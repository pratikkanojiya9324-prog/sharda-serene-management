import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** Offline only when NetInfo is sure: not connected, or connected without internet. */
export function isOnline(state: { isConnected?: boolean | null; isInternetReachable?: boolean | null }): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(isOnline(s))), []);
  return online;
}
