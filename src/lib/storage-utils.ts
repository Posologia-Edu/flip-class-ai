/**
 * Utility functions for handling private storage bucket URLs.
 * After making the materials bucket private, public URLs no longer work.
 * These helpers detect storage URLs and resolve them to signed URLs.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const STORAGE_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/materials/`;

/**
 * Check if a URL points to our Supabase storage materials bucket.
 */
export function isStorageUrl(url: string | null | undefined): boolean {
  return !!url && url.includes("/storage/v1/object/public/materials/");
}

/**
 * Extract the storage file path from a full public URL.
 */
export function extractStoragePath(url: string): string {
  const idx = url.indexOf("/storage/v1/object/public/materials/");
  if (idx === -1) return url;
  return url.substring(idx + "/storage/v1/object/public/materials/".length);
}
