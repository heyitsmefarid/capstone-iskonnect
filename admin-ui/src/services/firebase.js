import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// When true, the admin panel talks to the local Firebase emulator suite
// (Auth 9099, Firestore 8080) instead of the real project. Used to test the
// bulk scholar import end-to-end without deploying. Enable with `npm run dev:emu`
// (sets VITE_USE_EMULATORS=true via .env.emulator).
const USE_EMULATORS = import.meta.env.VITE_USE_EMULATORS === 'true';

const realConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// The emulator ignores real credentials but namespaces data by projectId, so it
// must match the project the Functions emulator runs under (demo-capstone).
const emulatorConfig = {
  apiKey: 'demo-key',
  authDomain: 'demo-capstone.firebaseapp.com',
  projectId: 'demo-capstone',
  storageBucket: 'demo-capstone.appspot.com',
  messagingSenderId: 'demo-sender',
  appId: 'demo-app',
};

const firebaseConfig = USE_EMULATORS ? emulatorConfig : realConfig;

const hasRequiredConfig =
  USE_EMULATORS ||
  [
    realConfig.apiKey,
    realConfig.authDomain,
    realConfig.projectId,
    realConfig.storageBucket,
    realConfig.messagingSenderId,
    realConfig.appId,
  ].every(Boolean);

const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY;

let app = null;
let auth = null;
let db = null;
let storage = null;
let emulatorsConnected = false;

export function initializeFirebase() {
  if (!hasRequiredConfig) {
    // Allow app boot for UI work while backend credentials are not yet provided.
    return { app: null, auth: null, db: null, storage: null, isReady: false };
  }

  if (import.meta.env.DEV && typeof window !== 'undefined') {
    window.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);

  if (USE_EMULATORS && !emulatorsConnected) {
    // Must run before any Auth/Firestore call — initializeFirebase is the first
    // thing the app does, so this is safe.
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    emulatorsConnected = true;
  }

  // App Check (reCAPTCHA) would reject emulator traffic, so only enable it
  // against the real project.
  if (!USE_EMULATORS && appCheckSiteKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  return { app, auth, db, storage, isReady: true };
}

export { app, auth, db, storage };
