/* =========================================================
   mNEET — Firebase Helpers
   File: firebase-helpers.js

   Purpose:
   - Firebase Authentication helpers
   - Firestore read/write helpers
   - Admin authorization checks
   - Approved course-access verification
   - Safe error handling
   - Server timestamps and document utilities

   Security:
   - Admin access requires admins/{uid}.active === true
   - Students cannot approve purchases
   - Students cannot unlock courses themselves
   - Correct answers must be handled by secure backend functions
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MNEETFirebaseHelpers) {
    return;
  }

  const COLLECTIONS = Object.freeze({
    ADMINS: "admins",
    USERS: "users",
    COURSES: "courses",
    SUBJECTS: "subjects",
    CHAPTERS: "chapters",
    TOPICS: "topics",
    QUIZZES: "quizzes",
    QUESTIONS: "questions",
    NOTES: "notes",
    NCERT: "ncert",
    PYQ: "pyq",
    PURCHASES: "purchases",
    COURSE_ACCESS: "courseAccess",
    QUIZ_ATTEMPTS: "quizAttempts",
    QUIZ_RESULTS: "quizResults",
    NOTIFICATIONS: "notifications",
    STUDENT_NOTIFICATION_READS: "studentNotificationReads",
    SETTINGS: "settings"
  });

  const APPROVED_PURCHASE_STATUSES = Object.freeze([
    "approved",
    "paid",
    "completed"
  ]);

  const state = {
    initialized: false,
    lastError: null
  };

  /* ---------------------------------------------------------
     1. FIREBASE INSTANCE
     --------------------------------------------------------- */

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.auth &&
      window.MNEETFirebase.db
    ) {
      return {
        app: window.MNEETFirebase.app || null,
        auth: window.MNEETFirebase.auth,
        db: window.MNEETFirebase.db,
        projectId: window.MNEETFirebase.projectId || "mneet-spark"
      };
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      return {
        app: typeof window.firebase.app === "function"
          ? window.firebase.app()
          : null,

        auth: window.firebase.auth(),
        db: window.firebase.firestore(),
        projectId: "mneet-spark"
      };
    }

    return null;
  }

  function requireFirebase() {
    const services = getFirebase();

    if (!services) {
      throw createError(
        "firebase/not-initialized",
        "Firebase is not initialized. Please refresh the page."
      );
    }

    return services;
  }

  function getAuth() {
    return requireFirebase().auth;
  }

  function getDB() {
    return requireFirebase().db;
  }

  function getCurrentUser() {
    const services = getFirebase();

    return services && services.auth
      ? services.auth.currentUser || null
      : null;
  }

  function getCurrentUserId() {
    const user = getCurrentUser();

    return user ? user.uid : null;
  }

  /* ---------------------------------------------------------
     2. ERROR HELPERS
     --------------------------------------------------------- */

  function createError(code, message, originalError) {
    const error = new Error(message);

    error.name = "MNEETFirebaseError";
    error.code = code;

    if (originalError) {
      error.originalError = originalError;
    }

    return error;
  }

  function rememberError(error) {
    state.lastError = error
      ? {
          code: error.code || "unknown",
          message: error.message || "An unexpected error occurred."
        }
      : null;
  }

  function normalizeError(error) {
    rememberError(error);

    const code = error && error.code
      ? String(error.code)
      : "unknown";

    const messages = {
      "auth/user-not-found":
        "No account was found with these details.",

      "auth/wrong-password":
        "The email or password is incorrect.",

      "auth/invalid-credential":
        "The email or password is incorrect.",

      "auth/email-already-in-use":
        "An account already exists with this email.",

      "auth/weak-password":
        "Please choose a stronger password.",

      "auth/invalid-email":
        "Please enter a valid email address.",

      "auth/too-many-requests":
        "Too many attempts. Please try again later.",

      "permission-denied":
        "You do not have permission to perform this action.",

      "unavailable":
        "The service is temporarily unavailable. Please try again.",

      "not-found":
        "The requested information could not be found.",

      "firebase/not-initialized":
        "Firebase is not ready. Please refresh the page."
    };

    const message = messages[code] ||
      (
        error && error.message
          ? error.message
          : "Something went wrong. Please try again."
      );

    return {
      code: code,
      message: message,
      originalError: error || null
    };
  }

  /* ---------------------------------------------------------
     3. AUTHENTICATION
     --------------------------------------------------------- */

  async function signIn(email, password) {
    try {
      const auth = getAuth();

      const cleanEmail = String(email || "")
        .trim()
        .toLowerCase();

      if (!cleanEmail || !password) {
        throw createError(
          "validation/required",
          "Email and password are required."
        );
      }

      const result = await auth.signInWithEmailAndPassword(
        cleanEmail,
        password
      );

      rememberError(null);

      return result.user;

    } catch (error) {
      throw createError(
        error.code || "auth/sign-in-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  async function signOut() {
    try {
      await getAuth().signOut();

      rememberError(null);

      return true;

    } catch (error) {
      throw createError(
        error.code || "auth/sign-out-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  async function sendPasswordReset(email) {
    try {
      const cleanEmail = String(email || "")
        .trim()
        .toLowerCase();

      if (!cleanEmail) {
        throw createError(
          "validation/email-required",
          "Please enter your email address."
        );
      }

      await getAuth().sendPasswordResetEmail(cleanEmail);

      rememberError(null);

      return true;

    } catch (error) {
      throw createError(
        error.code || "auth/password-reset-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  /* ---------------------------------------------------------
     4. AUTHORIZATION
     --------------------------------------------------------- */

  async function isAdmin(user) {
    try {
      const services = requireFirebase();
      const currentUser = user || services.auth.currentUser;

      if (!currentUser || !currentUser.uid) {
        return false;
      }

      const snapshot = await services.db
        .collection(COLLECTIONS.ADMINS)
        .doc(currentUser.uid)
        .get();

      if (!snapshot.exists) {
        return false;
      }

      const data = snapshot.data() || {};

      return data.active === true;

    } catch (error) {
      rememberError(error);

      /*
       * Fail closed: if authorization cannot be verified,
       * never assume the user is an administrator.
       */
      return false;
    }
  }

  async function requireAdmin(user) {
    const currentUser = user || getCurrentUser();

    if (!currentUser) {
      throw createError(
        "auth/unauthenticated",
        "Please sign in first."
      );
    }

    const authorized = await isAdmin(currentUser);

    if (!authorized) {
      throw createError(
        "permission-denied",
        "Administrator permission is required."
      );
    }

    return currentUser;
  }

  function requireSignedIn() {
    const user = getCurrentUser();

    if (!user) {
      throw createError(
        "auth/unauthenticated",
        "Please sign in first."
      );
    }

    return user;
  }

  /* ---------------------------------------------------------
     5. DOCUMENT HELPERS
     --------------------------------------------------------- */

  function getDocumentId(snapshot) {
    return snapshot && snapshot.id
      ? snapshot.id
      : "";
  }

  function documentToObject(snapshot) {
    if (!snapshot || !snapshot.exists) {
      return null;
    }

    return {
      ...snapshot.data(),
      id: snapshot.id
    };
  }

  function serverTimestamp() {
    const services = requireFirebase();

    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore.FieldValue
    ) {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    if (
      services.db &&
      services.db.constructor &&
      services.db.constructor.FieldValue
    ) {
      return services.db.constructor.FieldValue.serverTimestamp();
    }

    throw createError(
      "firebase/timestamp-unavailable",
      "Firebase server timestamps are unavailable."
    );
  }

  function createDocumentId(collectionName) {
    if (!collectionName) {
      throw createError(
        "validation/collection-required",
        "Collection name is required."
      );
    }

    return getDB()
      .collection(collectionName)
      .doc()
      .id;
  }

  /* ---------------------------------------------------------
     6. FIRESTORE READ HELPERS
     --------------------------------------------------------- */

  async function getDocument(collectionName, documentId) {
    if (!collectionName || !documentId) {
      throw createError(
        "validation/document-required",
        "Collection name and document ID are required."
      );
    }

    try {
      const snapshot = await getDB()
        .collection(collectionName)
        .doc(String(documentId))
        .get();

      rememberError(null);

      return documentToObject(snapshot);

    } catch (error) {
      throw createError(
        error.code || "firestore/read-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  async function queryDocuments(collectionName, filters, options) {
    if (!collectionName) {
      throw createError(
        "validation/collection-required",
        "Collection name is required."
      );
    }

    try {
      const db = getDB();

      let query = db.collection(collectionName);

      (Array.isArray(filters) ? filters : [])
        .forEach(function (filter) {
          if (
            !Array.isArray(filter) ||
            filter.length !== 3
          ) {
            return;
          }

          query = query.where(
            filter[0],
            filter[1],
            filter[2]
          );
        });

      const settings = options || {};

      if (settings.orderBy) {
        query = query.orderBy(
          settings.orderBy,
          settings.direction === "desc" ? "desc" : "asc"
        );
      }

      if (
        Number.isInteger(settings.limit) &&
        settings.limit > 0
      ) {
        query = query.limit(
          Math.min(settings.limit, 1000)
        );
      }

      const snapshot = await query.get();
      const results = [];

      snapshot.forEach(function (doc) {
        results.push({
          ...doc.data(),
          id: doc.id
        });
      });

      rememberError(null);

      return results;

    } catch (error) {
      throw createError(
        error.code || "firestore/query-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  /* ---------------------------------------------------------
     7. FIRESTORE WRITE HELPERS
     --------------------------------------------------------- */

  async function createDocument(collectionName, data) {
    if (!collectionName || !data || typeof data !== "object") {
      throw createError(
        "validation/invalid-document",
        "A collection name and document data are required."
      );
    }

    try {
      const reference = await getDB()
        .collection(collectionName)
        .add(data);

      rememberError(null);

      return {
        id: reference.id,
        path: reference.path
      };

    } catch (error) {
      throw createError(
        error.code || "firestore/create-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  async function updateDocument(collectionName, documentId, data) {
    if (!collectionName || !documentId || !data) {
      throw createError(
        "validation/invalid-update",
        "Collection, document ID and update data are required."
      );
    }

    try {
      await getDB()
        .collection(collectionName)
        .doc(String(documentId))
        .update(data);

      rememberError(null);

      return true;

    } catch (error) {
      throw createError(
        error.code || "firestore/update-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  async function deleteDocument(collectionName, documentId) {
    if (!collectionName || !documentId) {
      throw createError(
        "validation/document-required",
        "Collection name and document ID are required."
      );
    }

    try {
      await getDB()
        .collection(collectionName)
        .doc(String(documentId))
        .delete();

      rememberError(null);

      return true;

    } catch (error) {
      throw createError(
        error.code || "firestore/delete-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  /* ---------------------------------------------------------
     8. COURSE ACCESS
     --------------------------------------------------------- */

  function isApprovedPurchaseStatus(status) {
    return APPROVED_PURCHASE_STATUSES.includes(
      String(status || "").toLowerCase()
    );
  }

  async function checkCourseAccess(courseId) {
    const user = requireSignedIn();

    if (!courseId) {
      return false;
    }

    /*
     * Use the trusted backend callable function when available.
     * Course access must be granted by the backend after Admin
     * approval, not by trusting a client-side purchase record.
     */
    const functionsService = getFunctionsService();

    if (functionsService) {
      try {
        const callable = functionsService.httpsCallable(
          "checkCourseAccess"
        );

        const response = await callable({
          courseId: String(courseId)
        });

        return Boolean(
          response &&
          response.data &&
          response.data.hasAccess === true
        );

      } catch (error) {
        rememberError(error);

        /*
         * Do not fall back to client-side approval checks after
         * a backend authorization failure.
         */
        throw createError(
          error.code || "permission-denied",
          normalizeError(error).message,
          error
        );
      }
    }

    /*
     * Without the trusted backend, do not grant access based
     * only on a student-editable purchase record.
     */
    throw createError(
      "functions/not-available",
      "Secure course verification is unavailable. Please try again later."
    );
  }

  /* ---------------------------------------------------------
     9. CLOUD FUNCTIONS
     --------------------------------------------------------- */

  function getFunctionsService() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.functions
    ) {
      return window.MNEETFirebase.functions;
    }

    if (
      window.firebase &&
      typeof window.firebase.app === "function" &&
      typeof window.firebase.app().functions === "function"
    ) {
      try {
        return window.firebase.app().functions("asia-south1");
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  async function callFunction(functionName, payload) {
    const functionsService = getFunctionsService();

    if (!functionsService) {
      throw createError(
        "functions/not-available",
        "Secure backend functions are not configured."
      );
    }

    if (
      !/^[A-Za-z][A-Za-z0-9_-]*$/.test(
        String(functionName || "")
      )
    ) {
      throw createError(
        "validation/invalid-function",
        "Invalid backend function name."
      );
    }

    try {
      const callable = functionsService.httpsCallable(
        functionName
      );

      const response = await callable(payload || {});

      rememberError(null);

      return response.data;

    } catch (error) {
      throw createError(
        error.code || "functions/call-failed",
        normalizeError(error).message,
        error
      );
    }
  }

  /* ---------------------------------------------------------
     10. USER PROFILE
     --------------------------------------------------------- */

  async function getOwnProfile() {
    const user = requireSignedIn();

    return getDocument(
      COLLECTIONS.USERS,
      user.uid
    );
  }

  async function updateOwnProfile(changes) {
    const user = requireSignedIn();

    if (!changes || typeof changes !== "object") {
      throw createError(
        "validation/invalid-profile",
        "Profile information is invalid."
      );
    }

    /*
     * Only these profile fields may be updated through this
     * helper. Firestore Rules must enforce the same restrictions.
     */
    const allowedFields = [
      "name",
      "fullName",
      "phone",
      "target",
      "examTarget",
      "photoURL",
      "updatedAt"
    ];

    const safeChanges = {};

    Object.keys(changes).forEach(function (key) {
      if (allowedFields.includes(key)) {
        safeChanges[key] = changes[key];
      }
    });

    if (Object.keys(safeChanges).length === 0) {
      throw createError(
        "validation/no-valid-fields",
        "No valid profile fields were provided."
      );
    }

    if (!("updatedAt" in safeChanges)) {
      safeChanges.updatedAt = serverTimestamp();
    }

    await updateDocument(
      COLLECTIONS.USERS,
      user.uid,
      safeChanges
    );

    return true;
  }

  /* ---------------------------------------------------------
     11. PUBLIC API
     --------------------------------------------------------- */

  window.MNEETFirebaseHelpers = Object.freeze({
    collections: COLLECTIONS,
    approvedPurchaseStatuses: APPROVED_PURCHASE_STATUSES,

    initialize: function () {
      const services = getFirebase();

      state.initialized = Boolean(services);

      return state.initialized;
    },

    getFirebase: getFirebase,
    getAuth: getAuth,
    getDB: getDB,

    getCurrentUser: getCurrentUser,
    getCurrentUserId: getCurrentUserId,

    signIn: signIn,
    signOut: signOut,
    sendPasswordReset: sendPasswordReset,

    isAdmin: isAdmin,
    requireAdmin: requireAdmin,
    requireSignedIn: requireSignedIn,

    getDocumentId: getDocumentId,
    documentToObject: documentToObject,
    serverTimestamp: serverTimestamp,
    createDocumentId: createDocumentId,

    getDocument: getDocument,
    queryDocuments: queryDocuments,
    createDocument: createDocument,
    updateDocument: updateDocument,
    deleteDocument: deleteDocument,

    isApprovedPurchaseStatus: isApprovedPurchaseStatus,
    checkCourseAccess: checkCourseAccess,

    callFunction: callFunction,

    getOwnProfile: getOwnProfile,
    updateOwnProfile: updateOwnProfile,

    normalizeError: normalizeError,

    getLastError: function () {
      return state.lastError;
    },

    getState: function () {
      return {
        initialized: state.initialized,
        userId: getCurrentUserId(),
        lastError: state.lastError
      };
    }
  });

  /*
   * Do not initialize Firebase here.
   * firebase.js remains responsible for initialization.
   */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        window.MNEETFirebaseHelpers.initialize();
      },
      { once: true }
    );
  } else {
    window.MNEETFirebaseHelpers.initialize();
  }

})(window, document);
