import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

function loadServiceAccount() {
  const envProjectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const envClientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const envPrivateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (envProjectId && envClientEmail && envPrivateKey) {
    return { projectId: envProjectId, clientEmail: envClientEmail, privateKey: envPrivateKey.replace(/\\n/g, "\n") };
  }
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!configuredPath) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH is not configured.");
  }
  const absolutePath = path.isAbsolute(configuredPath) ? configuredPath : path.join(process.cwd(), configuredPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Firebase service account file was not found at ${absolutePath}.`);
  }
  const raw = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!raw.project_id || !raw.client_email || !raw.private_key) {
    throw new Error("Firebase service account file is missing required fields.");
  }
  return {
    projectId: raw.project_id,
    clientEmail: raw.client_email,
    privateKey: raw.private_key.replace(/\\n/g, "\n"),
  };
}

let firestore: Firestore | null = null;
function getAdminDb() {
  if (!firestore) {
    const app = getApps().length ? getApp() : initializeApp({ credential: cert(loadServiceAccount()) });
    firestore = getFirestore(app);
  }
  return firestore;
}

// Keep credential loading out of Next's build-time page-data collection. The
// credential is required only when an API request actually touches Firestore.
export const adminDb = new Proxy({} as Firestore, {
  get(_target, property) {
    const db = getAdminDb();
    const value = Reflect.get(db as object, property, db);
    return typeof value === "function" ? value.bind(db) : value;
  },
});
