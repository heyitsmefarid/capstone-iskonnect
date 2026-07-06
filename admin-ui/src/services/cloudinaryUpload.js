// Uploads files to the same Cloudinary account already used by the scholar
// app for requirement/COR/COG uploads (unsigned preset, no backend needed).
// See scholar-ui11/lib/core/services/storage_service.dart for the Dart
// equivalent — keep the cloud name/preset/cap in sync with that file.

const CLOUD_NAME = 'c42z63hb';
const UPLOAD_PRESET = 'capstone';

// Cloudinary's free tier allows up to 10 MB per file.
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function isFileSizeAllowed(bytes) {
  return bytes > 0 && bytes <= MAX_FILE_BYTES;
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'heic', 'heif'];

// Cloudinary's `auto` upload classifies PDFs under the `image` resource type,
// which this account's security settings block from public delivery (401
// "deny or ACL failure"). Non-image files are uploaded as `raw` instead,
// which isn't subject to that restriction.
function resourceTypeFor(file) {
  if (file.type && file.type.startsWith('image/')) return 'image';
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'raw';
}

/**
 * Uploads a browser File to Cloudinary and returns its public URL, or null
 * if the file is empty/too large or the upload fails.
 * @param {File} file
 * @returns {Promise<string | null>}
 */
export async function uploadFile(file) {
  if (!file || !isFileSizeAllowed(file.size)) {
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceTypeFor(file)}/upload`,
      { method: 'POST', body: formData }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data.secure_url || data.url || null;
  } catch {
    return null;
  }
}
