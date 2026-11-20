import * as Crypto from 'expo-crypto';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from './supabase';

export type AttachmentKind = 'image' | 'pdf';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_TITLE_LENGTH = 120;
const MAX_IMAGE_WIDTH = 1600;

/** Validation text for the new-notice form, or null when it can be posted. */
export function validateNotice(title: string, body: string): string | null {
  if (!title.trim()) return 'Give the notice a title';
  if (title.trim().length > MAX_TITLE_LENGTH) return `Keep the title under ${MAX_TITLE_LENGTH} characters`;
  if (!body.trim()) return 'Write the notice';
  return null;
}

/** Attachments are capped at 10 MB; an unknown size is let through (the upload decides). */
export function attachmentError(size: number | undefined): string | null {
  return size !== undefined && size > MAX_ATTACHMENT_BYTES ? 'Attachments can be at most 10 MB' : null;
}

/** `{society_id}/<uuid>.<ext>` in the `notices` bucket; create_notice only accepts the admin's society folder. */
export function noticeAttachmentPath(societyId: string, id: string, kind: AttachmentKind): string {
  return `${societyId}/${id}.${kind === 'pdf' ? 'pdf' : 'jpg'}`;
}

export type PickedAttachment = { kind: AttachmentKind; uri: string; name: string; size?: number; width?: number };

/**
 * Uploads the picked attachment to the private `notices` bucket and returns
 * its storage path. Photos are re-encoded as JPEG (at most 1600 px wide).
 * Throws on failure.
 */
export async function uploadNoticeAttachment(societyId: string, file: PickedAttachment): Promise<string> {
  let uri = file.uri;
  if (file.kind === 'image') {
    const ctx = ImageManipulator.manipulate(file.uri);
    if (file.width && file.width > MAX_IMAGE_WIDTH) ctx.resize({ width: MAX_IMAGE_WIDTH });
    const image = await ctx.renderAsync();
    uri = (await image.saveAsync({ compress: 0.75, format: SaveFormat.JPEG })).uri;
  }
  const path = noticeAttachmentPath(societyId, Crypto.randomUUID(), file.kind);
  const bytes = await fetch(uri).then((r) => r.arrayBuffer());
  const tooBig = attachmentError(bytes.byteLength);
  if (tooBig) throw new Error(tooBig);
  const { error } = await supabase.storage
    .from('notices')
    .upload(path, bytes, { contentType: file.kind === 'pdf' ? 'application/pdf' : 'image/jpeg' });
  if (error) throw error;
  return path;
}
