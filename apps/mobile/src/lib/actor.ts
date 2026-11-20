import AsyncStorage from '@react-native-async-storage/async-storage';

// "Who's using this phone?": the family member's name, stored on this device only.
// Actions (approve visitor, raise complaint, ...) send it as `p_actor_name`.
const ACTOR_KEY = 'actorName';
const MAX_LENGTH = 60;

const clean = (name: string) => name.trim().slice(0, MAX_LENGTH).trim();

export async function getActorName(): Promise<string | null> {
  const name = await AsyncStorage.getItem(ACTOR_KEY);
  return name ? name : null;
}

/** Stores the name (trimmed, max 60 chars); a blank name forgets it. */
export async function setActorName(name: string): Promise<void> {
  const value = clean(name);
  if (value) await AsyncStorage.setItem(ACTOR_KEY, value);
  else await AsyncStorage.removeItem(ACTOR_KEY);
}

/** Called on sign-out, so the next flat on this phone is asked again. */
export async function clearActorName(): Promise<void> {
  await AsyncStorage.removeItem(ACTOR_KEY);
}
