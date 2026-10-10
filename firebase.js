/* =========================================================
   mNEET FIREBASE INITIALIZATION
   File: firebase.js

   Services:
   - Firebase App
   - Firebase Authentication
   - Cloud Firestore
   - Firebase Storage

   Project: mneet-spark
========================================================= */

(function (window) {
  "use strict";

  /*
   * Avoid duplicate initialization.
   */

  if (
    window.MNEETFirebase &&
    window.MNEETFirebase.ready === true
  ) {
    console.info("mNEET Firebase is already initialized.");
    return;
  }

  /*
   * Firebase SDK must load before this file.
   */

  if (!window.firebase) {
    const message =
      "Firebase SDK load হয়নি। index.html-এর Firebase scripts পরীক্ষা করো।";

    console.error(message);

    window.MNEETFirebase = Object.freeze({
      ready: false,
      error: message,
      app: null,
      auth: null,
      db: null,
      storage: null,
      projectId: "mneet-spark"
    });

    return;
  }

  /*
   * Firebase project configuration.
   */

  const firebaseConfig = {
    apiKey: "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",
    authDomain: "mneet-spark.firebaseapp.com",
    databaseURL:
      "https://mneet-spark-default-rtdb.firebaseio.com",
    projectId: "mneet-spark",
    storageBucket: "mneet-spark.firebasestorage.app",
    messagingSenderId: "252201633700",
    appId: "1:252201633700:web:1a1e7a2cff1f0b168ea331"
  };

  let app = null;
  let auth = null;
  let db = null;
  let storage = null;

  try {
    /*
     * Initialize Firebase only if necessary.
     */

    if (
      window.firebase.apps &&
      window.firebase.apps.length > 0
    ) {
      app = window.firebase.app();
    } else {
      app = window.firebase.initializeApp(firebaseConfig);
    }

    /*
     * Authentication.
     */

    auth = app.auth();

    /*
     * Cloud Firestore.
     */

    db = app.firestore();

    /*
     * Firebase Storage is optional until its SDK loads.
     */

    if (typeof app.storage === "function") {
      storage = app.storage();
    } else {
      console.warn(
        "Firebase Storage SDK পাওয়া যায়নি। File upload চালু হবে না।"
      );
    }

    /*
     * Export services for existing mNEET files.
     */

    window.MNEETFirebase = Object.freeze({
      ready: true,
      app: app,
      auth: auth,
      db: db,
      storage: storage,
      hasStorage: Boolean(storage),
      projectId: firebaseConfig.projectId
    });

    /*
     * Compatibility aliases used by existing files.
     */

    window.mneetAuth = auth;
    window.mneetDB = db;
    window.mneetStorage = storage;

    console.info(
      "mNEET Firebase initialized successfully."
    );

  } catch (error) {
    console.error(
      "mNEET Firebase initialization failed:",
      error
    );

    window.MNEETFirebase = Object.freeze({
      ready: false,
      error: error.message || "Firebase initialization failed.",
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
