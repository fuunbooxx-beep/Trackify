import "server-only";

import { cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "node:fs";
import path from "node:path";

function loadServiceAccount() {
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

const app = getApps().length ? getApp() : initializeApp({ credential: cert(loadServiceAccount()) });

export const adminDb = getFirestore(app);

