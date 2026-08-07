// Firebase auth + Firestore sync, isolated from render logic in app.js.
// Firebase's web API key is not a secret -- access is enforced by Firestore
// security rules (see README) plus the auth requirement below, not by
// hiding this config.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  enableIndexedDbPersistence,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyCEbg6_oBBAGl5ER9XUFmIN4OaZD9TIN9c',
  authDomain: 'workout-tracker-app-17a00.firebaseapp.com',
  projectId: 'workout-tracker-app-17a00',
  storageBucket: 'workout-tracker-app-17a00.firebasestorage.app',
  messagingSenderId: '316812780781',
  appId: '1:316812780781:web:911626cb7283636d0198e4',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Lets logged workouts read/write instantly from local cache and sync
// when back online -- important for spotty gym wifi.
enableIndexedDbPersistence(db).catch((err) => {
  console.warn('Offline persistence unavailable:', err.code);
});

const BATCH_LIMIT = 400; // Firestore write-batch limit is 500

export function onAuthChange(cb) {
  return onAuthStateChanged(auth, cb);
}

export function signUp(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  return signOut(auth);
}

export function subscribeSessions(uid, onChange, onError) {
  const ref = collection(db, 'users', uid, 'sessions');
  return onSnapshot(
    ref,
    (snap) => onChange(snap.docs.map((d) => d.data())),
    (err) => {
      console.error('Sessions listener error', err);
      if (onError) onError(err);
    }
  );
}

export function saveSessionCloud(uid, session) {
  return setDoc(doc(db, 'users', uid, 'sessions', session.id), session);
}

export function deleteSessionCloud(uid, id) {
  return deleteDoc(doc(db, 'users', uid, 'sessions', id));
}

export async function bulkImportCloud(uid, sessions) {
  for (let i = 0; i < sessions.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    sessions.slice(i, i + BATCH_LIMIT).forEach((s) => {
      batch.set(doc(db, 'users', uid, 'sessions', s.id), s);
    });
    await batch.commit();
  }
}

export async function bulkDeleteCloud(uid, sessions) {
  for (let i = 0; i < sessions.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    sessions.slice(i, i + BATCH_LIMIT).forEach((s) => {
      batch.delete(doc(db, 'users', uid, 'sessions', s.id));
    });
    await batch.commit();
  }
}

const AUTH_ERROR_MESSAGES = {
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-not-found': 'No account with that email. Try creating one instead.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already exists with that email -- try signing in instead.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/network-request-failed': 'No internet connection. Sign-in needs to be online once; the app works offline after that.',
};

export function authErrorMessage(err) {
  return AUTH_ERROR_MESSAGES[err.code] || err.message || 'Something went wrong.';
}
