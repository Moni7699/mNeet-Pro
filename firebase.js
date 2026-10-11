/* =====================================================
   mNEET FIREBASE CONFIGURATION
   File: firebase.js

   Responsibilities:
   1. Initialize Firebase only once.
   2. Provide Authentication and Firestore.
   3. Expose a shared Firebase service object.
   4. Prevent duplicate initialization.

   Project: mneet-spark
===================================================== */

(function (window) {
  "use strict";

  const PROJECT_ID = "mneet-spark";

  /*
   * Do not initialize Firebase twice.
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
      "Firebase SDK load হয়নি। Firebase SDK scripts পরীক্ষা করো।";

    console.error(message);

    window.MNEETFirebase = Object.freeze({
      ready: false,
      error: message,
      app: null,
      auth: null,
      db: null,
      projectId: PROJECT_ID
    });

    return;
  }

  /*
   * Your Firebase project configuration.
   */

  const firebaseConfig = {
    apiKey: "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",
    authDomain: "mneet-spark.firebaseapp.com",
    databaseURL: "https://mneet-spark-default-rtdb.firebaseio.com",
    projectId: "mneet-spark",
    storageBucket: "mneet-spark.firebasestorage.app",
    messagingSenderId: "252201633700",
    appId: "1:252201633700:web:1a1e7a2cff1f0b168ea331"
  };

  let app = null;
  let auth = null;
  let db = null;

  try {
    /*
     * Reuse the existing default app when available.
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
     * Verify that the initialized app belongs to
     * the expected Firebase project.
     */

    const actualProjectId = app.options.projectId;

    if (actualProjectId !== PROJECT_ID) {
      throw new Error(
        "Firebase project mismatch. Expected: " +
        PROJECT_ID +
        ", received: " +
        actualProjectId
      );
    }

    /*
     * Initialize Firebase services.
     */

    auth = app.auth();
    db = app.firestore();

    /*
     * Publish shared services for other files.
     */

    window.MNEETFirebase = Object.freeze({
      ready: true,
      error: null,
      app: app,
      auth: auth,
      db: db,
      projectId: PROJECT_ID
    });

    /*
     * Compatibility aliases for existing app files.
     */

    window.mneetAuth = auth;
    window.mneetDB = db;

    console.info(
      "mNEET Firebase initialized successfully.",
      PROJECT_ID
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
      projectId: PROJECT_ID
    });

    window.mneetAuth = auth;
    window.mneetDB = db;
  }

})(window);
