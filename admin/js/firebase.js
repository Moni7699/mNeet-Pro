// ============================================
// mNEET-Pro Admin Panel
// File: admin/js/firebase.js
// Firebase SDK Configuration
// ============================================

import { initializeApp } from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore
} from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getStorage
} from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";


// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",
  authDomain: "mneet-spark.firebaseapp.com",
  databaseURL: "https://mneet-spark-default-rtdb.firebaseio.com",
  projectId: "mneet-spark",
  storageBucket: "mneet-spark.firebasestorage.app",
  messagingSenderId: "252201633700",
  appId: "1:252201633700:web:1a1e7a2cff1f0b168ea331"
};


// ============================================
// INITIALIZE FIREBASE
// ============================================

const app = initializeApp(firebaseConfig);


// ============================================
// FIREBASE AUTHENTICATION
// ============================================

const auth = getAuth(app);


// Keep authentication persistent across page refreshes.
// Firebase may still require the user to sign in again
// if browser storage is unavailable or cleared.

const authPersistence = setPersistence(
  auth,
  browserLocalPersistence
);


// ============================================
// FIRESTORE DATABASE
// ============================================

const db = getFirestore(app);


// ============================================
// FIREBASE STORAGE
// ============================================

const storage = getStorage(app);


// ============================================
// EXPORT FIREBASE SERVICES
// ============================================

export {
  app,
  auth,
  authPersistence,
  db,
  storage
};
