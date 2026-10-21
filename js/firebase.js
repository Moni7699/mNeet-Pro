/* =====================================
   mNEET - FIREBASE CONFIGURATION
   Firebase Compat SDK
===================================== */

(function () {
  "use strict";

  // Firebase configuration
  // নিজের Firebase Console থেকে আসল তথ্য বসাতে হবে।
  const firebaseConfig = {
  apiKey: "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",
  authDomain: "mneet-spark.firebaseapp.com",
  databaseURL: "https://mneet-spark-default-rtdb.firebaseio.com",
  projectId: "mneet-spark",
  storageBucket: "mneet-spark.firebasestorage.app",
  messagingSenderId: "252201633700",
  appId: "1:252201633700:web:1a1e7a2cff1f0b168ea331"
};

  // Check required Firebase configuration
  const requiredFields = [
    "apiKey",
    "authDomain",
    "projectId",
    "messagingSenderId",
    "appId"
  ];

  const missingConfig = requiredFields.some(function (key) {
    return (
      !firebaseConfig[key] ||
      firebaseConfig[key].startsWith("PASTE_")
    );
  });

  if (missingConfig) {
    console.error(
      "mNEET: Firebase configuration is incomplete. " +
      "Copy the real configuration from Firebase Console."
    );

    window.mneetFirebaseReady = false;
    window.mneetFirebaseError = "Firebase configuration is incomplete.";
    return;
  }

  // Initialize Firebase only once
  try {
    if (typeof firebase === "undefined") {
      throw new Error(
        "Firebase SDK did not load. Check your internet connection."
      );
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    // Firebase services
    window.auth = firebase.auth();
    window.db = firebase.firestore();

    // Shared timestamp helper
    window.serverTimestamp = function () {
      return firebase.firestore.FieldValue.serverTimestamp();
    };

    // Current user helper
    window.getCurrentUser = function () {
      return window.auth.currentUser;
    };

    // Login helper
    window.loginUser = async function (email, password) {
      if (!email || !password) {
        throw new Error("Enter your email and password.");
      }

      const result = await window.auth.signInWithEmailAndPassword(
        email.trim(),
        password
      );

      return result.user;
    };

    // Logout helper
    window.logoutUser = async function () {
      await window.auth.signOut();

      localStorage.removeItem("activeSubject");
      localStorage.removeItem("activeChapter");
      localStorage.removeItem("activeQuizType");

      window.location.href = "index.html";
    };

    window.mneetFirebaseReady = true;
    window.mneetFirebaseError = "";

    console.log("mNEET Firebase initialized successfully.");

  } catch (error) {
    console.error("mNEET Firebase initialization failed:", error);

    window.mneetFirebaseReady = false;
    window.mneetFirebaseError = error.message;
  }
})();
