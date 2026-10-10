/* =========================================================
   mNEET FIREBASE CONFIGURATION
   File: firebase.js

   Firebase Services:
   1. Firebase App
   2. Firebase Authentication
   3. Cloud Firestore
   4. Firebase Storage

   Project ID: mneet-spark

   IMPORTANT:
   - Initialize Firebase only once.
   - Reuse an existing Firebase app when available.
   - Never grant Admin privileges in this file.
   - Protect all sensitive data with Firebase Security Rules.
   - Load Firebase compat SDK scripts before this file.
========================================================= */

(function (window) {
  "use strict";

  /* =======================================================
     1. PREVENT DUPLICATE INITIALIZATION
     ======================================================= */

  if (
    window.MNEETFirebase &&
    window.MNEETFirebase.ready === true
  ) {
    console.info(
      "mNEET Firebase is already initialized."
    );

    return;
  }

  /* =======================================================
     2. CHECK FIREBASE SDK
     ======================================================= */

  if (!window.firebase) {
    const errorMessage =
      "Firebase SDK not loaded. Check the SDK scripts in your HTML file.";

    console.error(errorMessage);

    window.MNEETFirebase = Object.freeze({
      ready: false,
      error: errorMessage,
      app: null,
      auth: null,
      db: null,
      storage: null,
      projectId: "mneet-spark"
    });

    return;
  }

  /* =======================================================
     3. FIREBASE PROJECT CONFIGURATION
     ======================================================= */

  const firebaseConfig = {
    apiKey: "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",
    authDomain: "mneet-spark.firebaseapp.com",
    databaseURL:
      "https://mneet-spark-default-rtdb.firebaseio.com",
    projectId: "mneet-spark",
    storageBucket:
      "mneet-spark.firebasestorage.app",
    messagingSenderId: "252201633700",
    appId:
      "1:252201633700:web:1a1e7a2cff1f0b168ea331"
  };

  /* =======================================================
     4. INITIALIZE FIREBASE SERVICES
     ======================================================= */

  let app = null;
  let auth = null;
  let db = null;
  let storage = null;

  try {
    /*
     * Reuse the Firebase app if it already exists.
     */

    if (
      window.firebase.apps &&
      window.firebase.apps.length > 0
    ) {
      app = window.firebase.app();
    } else {
      app = window.firebase.initializeApp(
        firebaseConfig
      );
    }

    /* Authentication */

    auth = window.firebase.auth();

    /* Cloud Firestore */

    db = window.firebase.firestore();

    /* Firebase Storage */

    if (
      typeof window.firebase.storage === "function"
    ) {
      storage = window.firebase.storage();
    } else {
      console.warn(
        "Firebase Storage SDK is not loaded. File uploads will not work."
      );
    }

    /* =====================================================
       5. EXPORT FIREBASE SERVICES
       ===================================================== */

    const firebaseServices = {
      ready: true,

      app: app,
      auth: auth,
      db: db,
      storage: storage,

      projectId: firebaseConfig.projectId,

      /*
       * Storage availability helper.
       */

      hasStorage: Boolean(storage),

      /*
       * Firebase initialization status.
       */

      initializedAt: new Date().toISOString()
    };

    window.MNEETFirebase = Object.freeze(
      firebaseServices
    );

    /*
     * Compatibility with existing mNEET files.
     */

    window.mneetAuth = auth;
    window.mneetDB = db;
    window.mneetStorage = storage;

    /* =====================================================
       6. INITIALIZATION SUCCESS
       ===================================================== */

    console.info(
      "mNEET Firebase initialized successfully."
    );

    console.info(
      "Firebase project:",
      firebaseConfig.projectId
    );

    console.info(
      "Authentication:",
      Boolean(auth)
    );

    console.info(
      "Firestore:",
      Boolean(db)
    );

    console.info(
      "Storage:",
      Boolean(storage)
    );

  } catch (error) {
    /* =====================================================
       7. INITIALIZATION ERROR
       ===================================================== */

    console.error(
      "mNEET Firebase initialization failed:",
      error
    );

    const errorMessage =
      error && error.message
        ? error.message
        : "Firebase initialization failed.";

    window.MNEETFirebase = Object.freeze({
      ready: false,

      error: errorMessage,

      app: app,
      auth: auth,
      db: db,
      storage: storage,

      projectId: firebaseConfig.projectId
    });

    window.mneetAuth = auth;
    window.mneetDB = db;
    window.mneetStorage = storage;
  }

})(window);
