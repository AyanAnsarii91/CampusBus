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
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        apikey: key,
      },
      fetch: (input, init = {}) => {
        const headers = new Headers(init?.headers);
        // Ensure apikey header is always present for authentication
        if (!headers.has("apikey")) {
          headers.set("apikey", key);
        }
        // When using new-format Supabase secret keys (e.g. sb_secret_...), the key
        // is NOT a JWT. If @supabase/supabase-js attached `Authorization: Bearer sb_secret_...`,
        // remove it so the API gateway authenticates via `apikey` and does not attempt
        // to parse the secret key as a Compact JWS.
        const auth = headers.get("authorization");
        if (auth && (auth.includes("sb_secret_") || auth.includes("sb_publishable_"))) {
          headers.delete("authorization");
        }
        return fetch(input, { ...init, headers });
      },
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
    throw Object.assign(
      new Error(
        "Supabase Storage credentials are not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      ),
      { status: 503 }
    );
  }

  // Detect if user mistakenly pasted a Publishable key instead of a secret key
  if (key.startsWith("sb_publishable_")) {
    throw Object.assign(
      new Error(
        "SUPABASE_SERVICE_ROLE_KEY is configured with a publishable key (starts with sb_publishable_). The server requires a secret key (sb_secret_... or service_role JWT) to manage storage."
      ),
      { status: 400 }
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
    const msg = error.message || "Unknown error";
    if (error.statusCode === "404" || error.status === 404 || msg.toLowerCase().includes("bucket not found")) {
      throw Object.assign(
        new Error(`Supabase Storage bucket '${bucket}' not found. Please create the bucket in your Supabase dashboard.`),
        { status: 404 }
      );
    }
    if (
      error.statusCode === "403" ||
      error.status === 400 ||
      msg.includes("row-level security") ||
      msg.includes("Compact JWS")
    ) {
      throw Object.assign(
        new Error(`Supabase Storage permission error: ${msg}. Ensure SUPABASE_SERVICE_ROLE_KEY is the secret key and bucket '${bucket}' exists.`),
        { status: 400 }
      );
    }
    throw Object.assign(new Error(`Failed to upload photo to Supabase: ${msg}`), { status: error.status || 500 });
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

/**
 * Diagnostic helper to verify Render environment variables without exposing secrets.
 */
export function getSupabaseDiagnostics() {
  const { url, key } = getSupabaseCredentials();
  const bucket = getBucketName();

  let keyType = "missing";
  if (key) {
    if (key.startsWith("sb_secret_")) keyType = "sb_secret (valid secret key)";
    else if (key.startsWith("eyJ")) keyType = "jwt (legacy secret key)";
    else if (key.startsWith("sb_publishable_")) keyType = "sb_publishable (invalid for backend storage)";
    else keyType = "custom";
  }

  let maskedUrl = "missing";
  if (url) {
    try {
      const u = new URL(url);
      maskedUrl = `${u.protocol}//${u.hostname}`;
    } catch {
      maskedUrl = "malformed URL";
    }
  }

  return {
    isConfigured: Boolean(url && key && !key.startsWith("sb_publishable_")),
    url: maskedUrl,
    keyType,
    bucket,
  };
}
