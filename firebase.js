/* ============================================
   mNEET FIREBASE CONFIGURATION
   File: firebase.js
   Project: mneet-spark
============================================ */

(function (window) {
  "use strict";

  const PROJECT_ID = "mneet-spark";

  /* Prevent duplicate initialization */

  if (
    window.MNEETFirebase &&
    window.MNEETFirebase.ready === true
  ) {
    console.info("mNEET Firebase already initialized.");
    return;
  }

  /* Check Firebase SDK */

  if (!window.firebase) {
    const errorMessage =
      "Firebase SDK not loaded. Check the Firebase scripts in index.html.";

    console.error(errorMessage);

    window.MNEETFirebase = Object.freeze({
      ready: false,
      error: errorMessage,
      app: null,
      auth: null,
      db: null,
      projectId: PROJECT_ID
    });

    return;
  }

  /* Firebase project configuration */

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
    /* Reuse an existing Firebase app if available */

    if (window.firebase.apps.length > 0) {
      app = window.firebase.app();
    } else {
      app = window.firebase.initializeApp(firebaseConfig);
    }

    /* Verify project ID */

    if (app.options.projectId !== PROJECT_ID) {
      throw new Error(
        "Firebase project ID mismatch. Expected " +
        PROJECT_ID +
        ", received " +
        app.options.projectId
      );
    }

    /* Initialize Firebase services */

    auth = app.auth();
    db = app.firestore();

    /* Shared Firebase service object */

    window.MNEETFirebase = Object.freeze({
      ready: true,
      error: null,
      app: app,
      auth: auth,
      db: db,
      projectId: PROJECT_ID
    });

    /* Compatibility aliases */

    window.mneetAuth = auth;
    window.mneetDB = db;

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
      projectId: PROJECT_ID
    });

    window.mneetAuth = auth;
    window.mneetDB = db;
  }

})(window);
