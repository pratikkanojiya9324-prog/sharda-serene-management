import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

const MAX_WIDTH = 1000;

export type PhotoBucket = 'complaint-photos' | 'helper-photos' | 'parcel-photos';

/**
 * Shrinks the picked photo (~1000 px wide JPEG) and uploads it to a private
 * bucket under `pathPrefix` (the RLS policies need `{society}` or
 * `{society}/{flat}` there). Returns the storage path. Throws on failure.
 */
export async function uploadSocietyPhoto(bucket: PhotoBucket, pathPrefix: string, uri: string): Promise<string> {
  const probe = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = ImageManipulator.manipulate(uri);
  if (probe.width > MAX_WIDTH) ctx.resize({ width: MAX_WIDTH });
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });

  const path = `${pathPrefix}/${Crypto.randomUUID()}.jpg`;
  const bytes = await fetch(saved.uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: 'image/jpeg' });
  if (error) throw error;
  return path;
}
