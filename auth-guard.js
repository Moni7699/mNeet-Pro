/* =====================================================
   mNEET AUTHENTICATION GUARD
   File: auth-guard.js

   Responsibilities:
   1. Protect Admin pages.
   2. Protect Student pages.
   3. Verify Admin using admins/{uid}.active === true.
   4. Centralize role-based navigation.
   5. Prevent unauthenticated access.
   6. Log useful authorization diagnostics.

   IMPORTANT:
   Firestore Security Rules must enforce authorization.
===================================================== */

(function (window, document) {
  "use strict";

  const LOGIN_PAGE = "index.html";
  const ADMIN_PAGE = "admin.html";
  const STUDENT_PAGE = "student.html";

  let auth = null;
  let db = null;

  let currentUser = null;
  let currentRole = null;

  let started = false;
  let authCheckVersion = 0;

  /* =====================================================
     PAGE DETECTION
  ===================================================== */

  function getCurrentPage() {
    const path = window.location.pathname || "";
    const filename = path.split("/").pop().toLowerCase();

    return filename || LOGIN_PAGE;
  }

  function isLoginPage(page) {
    return page === "" || page === LOGIN_PAGE;
  }

  function isAdminPage(page) {
    return (
      page === ADMIN_PAGE ||
      page.startsWith("admin-") ||
      page.startsWith("admin_")
    );
  }

  function isStudentPage(page) {
    return [
      "student.html",
      "course.html",
      "chapter.html",
      "topic.html",
      "ncert.html",
      "video.html"
    ].includes(page);
  }

  function isProtectedPage(page) {
    return isAdminPage(page) || isStudentPage(page);
  }

  /* =====================================================
     FIREBASE SERVICES
  ===================================================== */

  function getFirebaseServices() {
    const services = window.MNEETFirebase;

    if (
      services &&
      services.ready === true &&
      services.auth &&
      services.db
    ) {
      auth = services.auth;
      db = services.db;

      return { auth, db };
    }

    if (!window.firebase) {
      throw new Error("Firebase SDK পাওয়া যায়নি।");
    }

    if (
      !window.firebase.apps ||
      window.firebase.apps.length === 0
    ) {
      throw new Error("Firebase initialize করা হয়নি।");
    }

    auth = window.firebase.auth();
    db = window.firebase.firestore();

    return { auth, db };
  }

  /* =====================================================
     REDIRECTION
  ===================================================== */

  function redirectTo(page) {
    const currentPage = getCurrentPage();

    if (currentPage !== page.toLowerCase()) {
      console.info("mNEET navigation:", currentPage, "→", page);
      window.location.replace(page);
    }
  }

  /* =====================================================
     ADMIN VERIFICATION
  ===================================================== */

  async function verifyAdmin(user) {
    if (!user || !user.uid) {
      return false;
    }

    const services = getFirebaseServices();

    console.info("mNEET Admin verification started.");
    console.info("Current login UID:", user.uid);
    console.info(
      "Firebase project:",
      window.firebase.app().options.projectId
    );

    const snapshot = await services.db
      .collection("admins")
      .doc(user.uid)
      .get();

    console.info(
      "Admin document exists:",
      snapshot.exists
    );

    if (!snapshot.exists) {
      console.warn(
        "No Admin document exists for the current UID."
      );

      return false;
    }

    const data = snapshot.data() || {};

    console.info("Admin active:", data.active);

    return data.active === true;
  }

  /* =====================================================
     AUTHENTICATED USER HANDLER
  ===================================================== */

  async function handleAuthenticatedUser(user, version) {
    const page = getCurrentPage();

    /*
     * Ignore stale asynchronous checks.
     */

    function isCurrentCheck() {
      return version === authCheckVersion;
    }

    /*
     * Signed-out users cannot access protected pages.
     */

    if (!user) {
      currentUser = null;
      currentRole = null;

      if (isProtectedPage(page)) {
        redirectTo(LOGIN_PAGE);
      }

      return;
    }

    currentUser = user;

    /*
     * Verify Admin status once for this navigation check.
     */

    let adminAuthorized;

    try {
      adminAuthorized = await verifyAdmin(user);
    } catch (error) {
      if (!isCurrentCheck()) return;

      console.error(
        "mNEET Admin verification failed:",
        error
      );

      currentRole = null;

      /*
       * Do not treat a Firestore error as proof that
       * the user is a Student.
       */

      if (isLoginPage(page)) {
        showAuthorizationError(
          "Account যাচাই করা যায়নি। আবার চেষ্টা করো।",
          error
        );
      } else if (isAdminPage(page)) {
        showAuthorizationError(
          "Admin access যাচাই করা যায়নি। পেজটি নিরাপদ রাখতে Login পেজে ফিরিয়ে দেওয়া হচ্ছে।",
          error
        );

        redirectTo(LOGIN_PAGE);
      } else if (isStudentPage(page)) {
        showAuthorizationError(
          "Account যাচাই করা যায়নি। Internet connection পরীক্ষা করে আবার চেষ্টা করো।",
          error
        );
      }

      return;
    }

    if (!isCurrentCheck()) return;

    currentRole = adminAuthorized ? "admin" : "student";

    /*
     * LOGIN PAGE:
     * Route based on the verified Admin document.
     */

    if (isLoginPage(page)) {
      if (adminAuthorized) {
        redirectTo(ADMIN_PAGE);
      } else {
        redirectTo(STUDENT_PAGE);
      }

      return;
    }

    /*
     * ADMIN PAGE:
     * Only active Admin accounts may remain here.
     */

    if (isAdminPage(page)) {
      if (!adminAuthorized) {
        console.warn(
          "Admin page blocked: current user is not an active Admin."
        );

        redirectTo(STUDENT_PAGE);
      }

      return;
    }

    /*
     * STUDENT PAGES:
     * Authenticated users can remain on Student pages.
     *
     * Course purchase authorization must be checked
     * separately by the course system and Firestore Rules.
     */

    if (isStudentPage(page)) {
      return;
    }
  }

  /* =====================================================
     AUTHORIZATION ERROR DISPLAY
  ===================================================== */

  function showAuthorizationError(message, error) {
    console.error("mNEET authorization error:", error);

    const messageElement =
      document.getElementById("authMessage");

    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className = "auth-message error show";
    }
  }

  /* =====================================================
     AUTH STATE LISTENER
  ===================================================== */

  function start() {
    if (started) return;

    let services;

    try {
      services = getFirebaseServices();
    } catch (error) {
      console.error(
        "mNEET Auth Guard could not initialize:",
        error
      );

      const page = getCurrentPage();

      if (isProtectedPage(page)) {
        redirectTo(LOGIN_PAGE);
      }

      return;
    }

    started = true;

    services.auth.onAuthStateChanged(async function (user) {
      const version = ++authCheckVersion;

      try {
        await handleAuthenticatedUser(user, version);
      } catch (error) {
        console.error(
          "mNEET Auth Guard error:",
          error
        );

        if (version !== authCheckVersion) return;

        /*
         * Fail closed on Admin pages.
         */

        if (isAdminPage(getCurrentPage())) {
          redirectTo(LOGIN_PAGE);
        }
      }
    });
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.MNEETAuthGuard = Object.freeze({
    start: start,

    getCurrentUser: function () {
      return currentUser;
    },

    getCurrentRole: function () {
      return currentRole;
    },

    isAdmin: function () {
      return currentRole === "admin";
    },

    verifyAdmin: verifyAdmin
  });

  /*
   * Start automatically.
   */

  start();

})(window, document);
