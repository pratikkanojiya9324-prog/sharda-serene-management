import { uploadSocietyPhoto } from './photoUpload';

/** Storage path for a complaint photo; create_complaint only accepts `{society}/{flat}/...`. */
export function complaintPhotoPath(societyId: string, flatId: string, id: string): string {
  return `${societyId}/${flatId}/${id}.jpg`;
}

/**
 * Uploads the picked photo to the private `complaint-photos` bucket under the
 * flat's folder. Returns the storage path to pass as `p_photo_path`. Throws on failure.
 */
export function uploadComplaintPhoto(societyId: string, flatId: string, photo: { uri: string }): Promise<string> {
  return uploadSocietyPhoto('complaint-photos', `${societyId}/${flatId}`, photo.uri);
}
