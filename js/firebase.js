/* ========================================
   mNEET FIREBASE CONFIGURATION
   Firebase Compat SDK
   ======================================== */

(function () {
    "use strict";

    // Prevent duplicate initialization.
    if (window.mneetFirebase) {
        return;
    }

    // Ensure the Firebase SDK is loaded.
    if (
        typeof firebase === "undefined" ||
        !firebase.apps
    ) {
        console.error(
            "Firebase SDK was not loaded. Check the script tags in index.html."
        );

        return;
    }

    // mNEET Firebase project configuration.
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

    try {
        // Initialize Firebase only once.
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Firebase services.
        const auth = firebase.auth();

        const db = firebase.firestore();

        // Expose services to other application files.
        window.mneetFirebase = {
            app: firebase.app(),
            auth: auth,
            db: db,
            serverTimestamp: function () {
                return firebase.firestore.FieldValue.serverTimestamp();
            }
        };

        console.log("mNEET Firebase initialized successfully.");

    } catch (error) {
        console.error(
            "mNEET Firebase initialization failed:",
            error
        );
    }

})();
