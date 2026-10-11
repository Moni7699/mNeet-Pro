/* =========================================================
   mNEET — Firebase Helpers
   File: firebase-helpers.js
   Firebase SDK: Compat 10.14.1

   Features:
   - Firebase Auth helpers
   - Firestore read/write helpers
   - Admin authorization
   - Student profile helpers
   - Secure course-access verification
   - Cloud Functions support
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

  /* =====================================================
     FIREBASE SERVICES
     ===================================================== */

  function createError(code, message, originalError) {
    const error = new Error(message);

    error.name = "MNEETFirebaseError";
    error.code = code;

    if (originalError) {
      error.originalError = originalError;
    }

    return error;
  }

  function getFirebase() {
    const instance = window.MNEETFirebase;

    if (
      instance &&
      instance.ready === true &&
      instance.auth &&
      instance.db
    ) {
      return {
        app: instance.app || null,
        auth: instance.auth,
        db: instance.db,
        functions: instance.functions || null,
        projectId: instance.projectId || "mneet-spark"
      };
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      try {
        const app = window.firebase.app();

        return {
          app: app,
          auth: app.auth(),
          db: app.firestore(),
          functions: null,
          projectId: app.options.projectId
        };
      } catch (error) {
        rememberError(error);
      }
    }

    return null;
  }

  function requireFirebase() {
    const services = getFirebase();

    if (!services) {
      throw createError(
        "firebase/not-initialized",
        "Firebase চালু হয়নি। পেজটি Refresh করো।"
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

  /* =====================================================
     ERROR HANDLING
     ===================================================== */

  function rememberError(error) {
    state.lastError = error
      ? {
          code: error.code || "unknown",
          message: error.message || "Unknown error"
        }
      : null;
  }

  function normalizeError(error) {
    rememberError(error);

    const code = String(
      error && error.code ? error.code : "unknown"
    );

    const messages = {
      "auth/user-not-found":
        "এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি।",

      "auth/wrong-password":
        "ইমেইল অথবা পাসওয়ার্ড ভুল।",

      "auth/invalid-credential":
        "ইমেইল অথবা পাসওয়ার্ড ভুল।",

      "auth/email-already-in-use":
        "এই ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট রয়েছে।",

      "auth/weak-password":
        "আরও শক্তিশালী পাসওয়ার্ড ব্যবহার করো।",

      "auth/invalid-email":
        "সঠিক ইমেইল অ্যাড্রেস দাও।",

      "auth/too-many-requests":
        "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পরে চেষ্টা করো।",

      "auth/network-request-failed":
        "ইন্টারনেট সংযোগ পরীক্ষা করো।",

      "permission-denied":
        "এই কাজটি করার অনুমতি নেই।",

      "unauthenticated":
        "প্রথমে Login করো।",

      "not-found":
        "তথ্যটি পাওয়া যায়নি।",

      "unavailable":
        "সার্ভিস সাময়িকভাবে বন্ধ। পরে চেষ্টা করো।",

      "firebase/not-initialized":
        "Firebase চালু হয়নি। পেজ Refresh করো।",

      "functions/not-available":
        "নিরাপদ Backend Function কনফিগার করা নেই।"
    };

    return {
      code: code,
      message:
        messages[code] ||
        (error && error.message
          ? error.message
          : "সমস্যা হয়েছে। আবার চেষ্টা করো।"),
      originalError: error || null
    };
  }

  /* =====================================================
     AUTHENTICATION
     ===================================================== */

  async function signIn(email, password) {
    try {
      const cleanEmail = String(email || "")
        .trim()
        .toLowerCase();

      if (!cleanEmail || !password) {
        throw createError(
          "validation/required",
          "ইমেইল ও পাসওয়ার্ড দিতে হবে।"
        );
      }

      const result = await getAuth()
        .signInWithEmailAndPassword(cleanEmail, password);

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
          "ইমেইল অ্যাড্রেস দিতে হবে।"
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

  /* =====================================================
     AUTHORIZATION
     ===================================================== */

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

      // Authorization যাচাই করা না গেলে Admin access দেওয়া হবে না।
      return false;
    }
  }

  async function requireAdmin(user) {
    const currentUser = user || getCurrentUser();

    if (!currentUser) {
      throw createError(
        "auth/unauthenticated",
        "প্রথমে Login করো।"
      );
    }

    if (!(await isAdmin(currentUser))) {
      throw createError(
        "permission-denied",
        "Admin permission প্রয়োজন।"
      );
    }

    return currentUser;
  }

  function requireSignedIn() {
    const user = getCurrentUser();

    if (!user) {
      throw createError(
        "auth/unauthenticated",
        "প্রথমে Login করো।"
      );
    }

    return user;
  }

  /* =====================================================
     DOCUMENT UTILITIES
     ===================================================== */

  function getDocumentId(snapshot) {
    return snapshot && snapshot.id ? snapshot.id : "";
  }

  function documentToObject(snapshot) {
    if (!snapshot || !snapshot.exists) {
      return null;
    }

    return Object.assign(
      { id: snapshot.id },
      snapshot.data()
    );
  }

  function serverTimestamp() {
    requireFirebase();

    return window.firebase.firestore.FieldValue.serverTimestamp();
  }

  function createDocumentId(collectionName) {
    if (!collectionName) {
      throw createError(
        "validation/collection-required",
        "Collection name প্রয়োজন।"
      );
    }

    return getDB()
      .collection(collectionName)
      .doc()
      .id;
  }

  /* =====================================================
     FIRESTORE READ
     ===================================================== */

  async function getDocument(collectionName, documentId) {
    if (!collectionName || !documentId) {
      throw createError(
        "validation/document-required",
        "Collection ও document ID প্রয়োজন।"
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

  async function queryDocuments(
    collectionName,
    filters,
    options
  ) {
    if (!collectionName) {
      throw createError(
        "validation/collection-required",
        "Collection name প্রয়োজন।"
      );
    }

    try {
      let query = getDB().collection(collectionName);

      (Array.isArray(filters) ? filters : [])
        .forEach(function (filter) {
          if (
            Array.isArray(filter) &&
            filter.length === 3
          ) {
            query = query.where(
              filter[0],
              filter[1],
              filter[2]
            );
          }
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
        results.push(
          Object.assign({ id: doc.id }, doc.data())
        );
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

  /* =====================================================
     FIRESTORE WRITE
     ===================================================== */

  async function createDocument(collectionName, data) {
    if (
      !collectionName ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      throw createError(
        "validation/invalid-document",
        "সঠিক collection ও document data প্রয়োজন।"
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

  async function updateDocument(
    collectionName,
    documentId,
    data
  ) {
    if (
      !collectionName ||
      !documentId ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    ) {
      throw createError(
        "validation/invalid-update",
        "সঠিক update data প্রয়োজন।"
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
        "Collection ও document ID প্রয়োজন।"
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

  /* =====================================================
     CLOUD FUNCTIONS
     ===================================================== */

  function getFunctionsService() {
    const services = getFirebase();

    if (!services) {
      return null;
    }

    if (services.functions) {
      return services.functions;
    }

    try {
      if (
        services.app &&
        typeof services.app.functions === "function"
      ) {
        return services.app.functions("asia-south1");
      }
    } catch (error) {
      rememberError(error);
    }

    return null;
  }

  async function callFunction(functionName, payload) {
    if (
      !/^[A-Za-z][A-Za-z0-9_-]*$/.test(
        String(functionName || "")
      )
    ) {
      throw createError(
        "validation/invalid-function",
        "Function name সঠিক নয়।"
      );
    }

    const functionsService = getFunctionsService();

    if (!functionsService) {
      throw createError(
        "functions/not-available",
        "Cloud Functions SDK ও configuration প্রয়োজন।"
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

  /* =====================================================
     COURSE ACCESS
     ===================================================== */

  async function checkCourseAccess(courseId) {
    requireSignedIn();

    if (!courseId) {
      throw createError(
        "validation/course-required",
        "Course ID প্রয়োজন।"
      );
    }

    /*
     * Access will only be granted by a trusted backend.
     * A client-side purchase record is not proof of payment.
     */
    const result = await callFunction(
      "checkCourseAccess",
      { courseId: String(courseId) }
    );

    return Boolean(
      result && result.hasAccess === true
    );
  }

  /* =====================================================
     STUDENT PROFILE
     ===================================================== */

  async function getOwnProfile() {
    const user = requireSignedIn();

    return getDocument(
      COLLECTIONS.USERS,
      user.uid
    );
  }

  async function updateOwnProfile(changes) {
    const user = requireSignedIn();

    if (
      !changes ||
      typeof changes !== "object" ||
      Array.isArray(changes)
    ) {
      throw createError(
        "validation/invalid-profile",
        "Profile data সঠিক নয়।"
      );
    }

    const allowedFields = [
      "name",
      "fullName",
      "phone",
      "city",
      "photoURL",
      "target",
      "examTarget"
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
        "পরিবর্তন করার মতো বৈধ তথ্য পাওয়া যায়নি।"
      );
    }

    safeChanges.updatedAt = serverTimestamp();

    await updateDocument(
      COLLECTIONS.USERS,
      user.uid,
      safeChanges
    );

    return true;
  }

  /* =====================================================
     PUBLIC API
     ===================================================== */

  window.MNEETFirebaseHelpers = Object.freeze({
    collections: COLLECTIONS,
    approvedPurchaseStatuses: APPROVED_PURCHASE_STATUSES,

    initialize: function () {
      state.initialized = Boolean(getFirebase());
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

  function initializeHelpers() {
    window.MNEETFirebaseHelpers.initialize();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeHelpers,
      { once: true }
    );
  } else {
    initializeHelpers();
  }

})(window, document);
