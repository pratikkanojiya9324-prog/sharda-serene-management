import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

const MAX_WIDTH = 800;

/**
 * Shrinks the camera photo (~800 px wide JPEG), uploads it under the society's
 * folder and attaches it to an existing visit. Throws on any failure; the visit
 * itself already exists, so callers just tell the guard the photo was not saved.
 */
export async function attachVisitPhoto(
  visitId: string,
  societyId: string,
  photo: { uri: string; width: number },
): Promise<void> {
  const ctx = ImageManipulator.manipulate(photo.uri);
  if (photo.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG });

  const path = `${societyId}/${Crypto.randomUUID()}.jpg`;
  const bytes = await fetch(saved.uri).then((r) => r.arrayBuffer());
  const up = await supabase.storage.from('visitor-photos').upload(path, bytes, { contentType: 'image/jpeg' });
  if (up.error) throw up.error;

  const { error } = await supabase.rpc('set_visit_photo', { p_visit_id: visitId, p_photo_path: path });
  if (error) throw error;
}
