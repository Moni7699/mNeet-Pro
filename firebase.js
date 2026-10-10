/* =====================================================
   mNEET FIREBASE CONFIGURATION
   File: firebase.js

   Firebase Services:
   1. Firebase App
   2. Firebase Authentication
   3. Cloud Firestore

   Project ID: mneet-spark

   IMPORTANT:
   - This file initializes Firebase only once.
   - It does not grant Admin privileges.
   - Admin authorization must be checked separately.
   - Firestore Security Rules must protect all sensitive data.
===================================================== */

(function () {
  "use strict";

  /* =====================================================
     PREVENT DUPLICATE INITIALIZATION
  ===================================================== */

  if (window.MNEETFirebase) {
    console.info("mNEET Firebase is already initialized.");
    return;
  }

  /* =====================================================
     CHECK FIREBASE SDK
  ===================================================== */

  if (!window.firebase) {
    console.error(
      "mNEET Firebase SDK is missing. Check the Firebase SDK scripts in index.html."
    );

    window.MNEETFirebase = {
      ready: false,
      error: "Firebase SDK not loaded."
    };

    return;
     
  }<script src="firebase-helpers.js" defer></script>

  /* =====================================================
     FIREBASE PROJECT CONFIGURATION
  ===================================================== */

  const firebaseConfig = {
    apiKey: "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",
    authDomain: "mneet-spark.firebaseapp.com",
    databaseURL: "https://mneet-spark-default-rtdb.firebaseio.com",
    projectId: "mneet-spark",
    storageBucket: "mneet-spark.firebasestorage.app",
    messagingSenderId: "252201633700",
    appId: "1:252201633700:web:1a1e7a2cff1f0b168ea331"
  };

  /* =====================================================
     INITIALIZE FIREBASE
  ===================================================== */

  let app;
  let auth;
  let db;

  try {
    /*
     * Reuse an existing Firebase app if another script
     * has already initialized this project.
     */

    if (firebase.apps.length > 0) {
      app = firebase.app();
    } else {
      app = firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();
    db = firebase.firestore();

    /* =================================================
       AUTHENTICATION SETTINGS
    ================================================= */

    /*
     * Email/Password Authentication must be enabled
     * in Firebase Console.
     *
     * Do not enable public Admin registration here.
     */

    /* =================================================
       EXPORT FIREBASE SERVICES
    ================================================= */

    window.MNEETFirebase = Object.freeze({
      ready: true,
      app: app,
      auth: auth,
      db: db,
      projectId: firebaseConfig.projectId
    });

    /*
     * Compatibility with existing project files.
     * These global objects are used by auth.js and
     * other modules that call firebase.auth() and
     * firebase.firestore().
     */

    window.mneetAuth = auth;
    window.mneetDB = db;

    console.info("mNEET Firebase initialized successfully.");

  } catch (error) {
    console.error(
      "mNEET Firebase initialization failed:",
      error
    );

    window.MNEETFirebase = Object.freeze({
      ready: false,
      error: error.message || "Firebase initialization failed."
    });
  }

})();
