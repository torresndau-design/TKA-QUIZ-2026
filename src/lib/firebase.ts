import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  projectId: firebaseConfigJson.projectId || "gen-lang-client-0747055464",
  appId: firebaseConfigJson.appId || "1:476816000214:web:c3b97ca244f12f940db577",
  apiKey: firebaseConfigJson.apiKey || "AIzaSyCjrE3njnojMry-zJ5hMqwZ-_QPRHczYlI",
  authDomain: firebaseConfigJson.authDomain || "gen-lang-client-0747055464.firebaseapp.com",
  storageBucket: firebaseConfigJson.storageBucket || "gen-lang-client-0747055464.firebasestorage.app",
  messagingSenderId: firebaseConfigJson.messagingSenderId || "476816000214"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const firestoreDatabaseId = firebaseConfigJson.firestoreDatabaseId;

export const db = firestoreDatabaseId
  ? initializeFirestore(app, { experimentalAutoDetectLongPolling: true }, firestoreDatabaseId)
  : initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
