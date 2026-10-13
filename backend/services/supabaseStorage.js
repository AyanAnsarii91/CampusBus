import { createClient } from "@supabase/supabase-js";

let cachedClient = null;
let lastUrl = null;
let lastKey = null;

export function getBucketName() {
  return process.env.SUPABASE_BUCKET || "PrashantiCampusBus";
}

export function getSupabaseCredentials() {
  const url = process.env.SUPABASE_URL?.trim() || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_KEY?.trim() ||
    "";
  return { url, key };
}

export function isSupabaseConfigured() {
  const { url, key } = getSupabaseCredentials();
  return Boolean(url && key);
}

export function getSupabaseClient() {
  const { url, key } = getSupabaseCredentials();
  if (!url || !key) return null;

  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  lastUrl = url;
  lastKey = key;
  return cachedClient;
}

/**
 * Uploads a profile photo to the private PrashantiCampusBus bucket.
 * The file is strictly placed in profiles/{userId}/avatar.{ext} to prevent
 * unauthorized cross-user overwriting.
 */
export async function uploadProfilePhoto(userId, fileBuffer, mimeType, originalName = "") {
  const { url, key } = getSupabaseCredentials();

  if (!url || !key) {
    throw new Error(
      "Supabase Storage credentials are not configured in backend/.env. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  // Detect if user mistakenly pasted the Publishable / Anon key into SUPABASE_SERVICE_ROLE_KEY
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY in backend/.env is currently set to a Publishable key (starts with sb_publishable_). The backend requires the 'service_role' secret key to bypass Storage RLS policies. In your Supabase Dashboard, go to Project Settings > API > Project API Keys, copy the 'service_role' secret key, and paste it into backend/.env as SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const client = getSupabaseClient();
  const bucket = getBucketName();

  // Derive file extension
  let ext = "jpg";
  if (mimeType === "image/png") ext = "png";
  else if (mimeType === "image/webp") ext = "webp";
  else if (mimeType === "image/gif") ext = "gif";
  else if (originalName && originalName.includes(".")) {
    ext = originalName.split(".").pop().toLowerCase();
  }

  // Stable, user-scoped storage path
  const storagePath = `profiles/${userId}/avatar.${ext}`;

  const { data, error } = await client.storage
    .from(bucket)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error("Supabase Storage upload error:", error);
    if (error.statusCode === "403" || error.status === 400 || error.message?.includes("row-level security")) {
      throw new Error(
        `Supabase Storage permission error: ${error.message}. Ensure SUPABASE_SERVICE_ROLE_KEY in backend/.env is the secret service_role key, and bucket '${bucket}' exists in your Supabase Storage dashboard.`
      );
    }
    throw new Error(`Failed to upload photo to Supabase: ${error.message}`);
  }

  return storagePath;
}

/**
 * Creates a short-lived signed URL for a private bucket asset.
 * Default expiration: 3600 seconds (1 hour).
 */
export async function createSignedPhotoUrl(storagePath, expiresIn = 3600) {
  if (!storagePath) return null;
  const client = getSupabaseClient();
  if (!client) return null;
  const bucket = getBucketName();

  try {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(storagePath, expiresIn);

    if (error) {
      console.warn("Failed to generate signed URL for path:", storagePath, error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.warn("Error getting signed photo URL:", err.message);
    return null;
  }
}

/**
 * Removes a photo from the storage bucket.
 */
export async function deleteProfilePhoto(storagePath) {
  if (!storagePath) return false;
  const client = getSupabaseClient();
  if (!client) return false;
  const bucket = getBucketName();

  try {
    const { error } = await client.storage.from(bucket).remove([storagePath]);
    if (error) {
      console.warn("Failed to remove storage path:", storagePath, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Error deleting photo:", err.message);
    return false;
  }
}
