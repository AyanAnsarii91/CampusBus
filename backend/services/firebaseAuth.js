import { initializeApp, getApps, getApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = process.env.FIREBASE_PROJECT_ID || "campusbus-9e9a0";

function getFirebaseAdminApp() {
  if (getApps().length) {
    return getApp();
  }

  const serviceAccountVar = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountVar) {
    try {
      const credentials =
        typeof serviceAccountVar === "string" && serviceAccountVar.trim().startsWith("{")
          ? JSON.parse(serviceAccountVar)
          : serviceAccountVar;
      return initializeApp({
        credential: cert(credentials),
        projectId,
      });
    } catch (err) {
      console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT, falling back to projectId:", err);
    }
  }

  return initializeApp({ projectId });
}

const app = getFirebaseAdminApp();
const auth = getAuth(app);

export async function verifyFirebaseToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("No token provided");
  }
  return await auth.verifyIdToken(idToken);
}

export { app as firebaseAdminApp, auth as firebaseAdminAuth };
