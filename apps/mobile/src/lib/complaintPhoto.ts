import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

const MAX_WIDTH = 1000;

/** Storage path for a complaint photo; create_complaint only accepts `{society}/{flat}/...`. */
export function complaintPhotoPath(societyId: string, flatId: string, id: string): string {
  return `${societyId}/${flatId}/${id}.jpg`;
}

/**
 * Shrinks the picked photo (~1000 px wide JPEG) and uploads it to the private
 * `complaint-photos` bucket under the flat's folder. Returns the storage path
 * to pass as `p_photo_path`. Throws on failure.
 */
export async function uploadComplaintPhoto(
  societyId: string,
  flatId: string,
  photo: { uri: string; width: number },
): Promise<string> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (photo.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

  const path = complaintPhotoPath(societyId, flatId, Crypto.randomUUID());
  const bytes = await fetch(saved.uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('complaint-photos').upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}
