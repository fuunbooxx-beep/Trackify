import { initializeApp, getApp, getApps } from 'firebase/app';
import { User, getAuth } from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app); // Uses the (default) database
export const storage = getStorage(app);

export async function upsertUserProfile(user: User, overrides?: { displayName?: string }) {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  const now = Date.now();
  const payload = {
    uid: user.uid,
    email: user.email || null,
    displayName: overrides?.displayName || user.displayName || "",
    photoURL: user.photoURL || null,
    providerId: user.providerData?.[0]?.providerId || "unknown",
    isActive: true,
    lastLoginAt: now,
    ...(existing.exists() ? {} : { createdAt: now, role: "user" }),
  };
  await setDoc(userRef, payload, { merge: true });
}

// Custom Error Handler for Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
