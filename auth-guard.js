/* =====================================================
   mNEET AUTHENTICATION GUARD
   File: auth-guard.js

   Responsibilities:
   1. Protect Admin pages from signed-out users.
   2. Verify Admin access using admins/{uid}.
   3. Require active === true for Admin access.
   4. Prevent students from opening Admin pages.
   5. Protect Student pages from signed-out users.
   6. Never grant Admin privileges during registration.

   IMPORTANT:
   Client-side checks improve navigation security.
   Firestore Security Rules must enforce real authorization.
===================================================== */

(function () {
  "use strict";

  const LOGIN_PAGE = "index.html";
  const ADMIN_PAGE = "admin.html";
  const STUDENT_PAGE = "student.html";

  let auth = null;
  let db = null;

  let currentUser = null;
  let currentRole = null;

  let started = false;
  let handlingAuthState = false;

  /* =====================================================
     PAGE DETECTION
  ===================================================== */

  function getCurrentPage() {
    const path = window.location.pathname || "";
    const filename = path.split("/").pop().toLowerCase();

    return filename || LOGIN_PAGE;
  }

  function isAdminPage(page) {
    return (
      page === "admin.html" ||
      page.startsWith("admin-") ||
      page.startsWith("admin_")
    );
  }

  function isStudentPage(page) {
    return (
      page === "student.html" ||
      page === "course.html" ||
      page === "chapter.html" ||
      page === "topic.html" ||
      page === "ncert.html" ||
      page === "video.html"
    );
  }

  /* =====================================================
     REDIRECTION
  ===================================================== */

  function redirectTo(page) {
    if (getCurrentPage() !== page.toLowerCase()) {
      window.location.replace(page);
    }
  }

  /* =====================================================
     FIREBASE INITIALIZATION CHECK
  ===================================================== */

  function getFirebaseServices() {
    if (!window.firebase) {
      throw new Error("Firebase SDK পাওয়া যায়নি।");
    }

    if (!window.firebase.apps || window.firebase.apps.length === 0) {
      throw new Error("Firebase initialize করা হয়নি।");
    }

    if (!auth) {
      auth = window.firebase.auth();
    }

    if (!db) {
      db = window.firebase.firestore();
    }

    return { auth, db };
  }

  /* =====================================================
     ADMIN AUTHORIZATION

     Admin access requires:
     admins/{uid} exists
     AND
     active === true

     A users/{uid} document or a profile role field
     does not grant Admin access.
  ===================================================== */

  async function verifyAdmin(user) {
    const services = getFirebaseServices();

    const adminDocument = await services.db
      .collection("admins")
      .doc(user.uid)
      .get();

    if (!adminDocument.exists) {
      return false;
    }

    const adminData = adminDocument.data();

    return Boolean(
      adminData &&
      adminData.active === true
    );
  }

  /* =====================================================
     AUTHENTICATION GUARD
  ===================================================== */

  async function handleAuthenticatedUser(user) {
    const page = getCurrentPage();

    /*
     * No signed-in user:
     * Protected pages must not remain accessible.
     */

    if (!user) {
      currentUser = null;
      currentRole = null;

      if (isAdminPage(page) || isStudentPage(page)) {
        redirectTo(LOGIN_PAGE);
      }

      return;
    }

    currentUser = user;

    /*
     * Admin pages require an active Admin document.
     */

    if (isAdminPage(page)) {
      let adminAuthorized = false;

      try {
        adminAuthorized = await verifyAdmin(user);
      } catch (error) {
        console.error(
          "mNEET Admin authorization check failed:",
          error
        );

        /*
         * If authorization cannot be verified, do not
         * allow access to the Admin page.
         */

        redirectTo(LOGIN_PAGE);
        return;
      }

      if (!adminAuthorized) {
        currentRole = "student";
        redirectTo(STUDENT_PAGE);
        return;
      }

      currentRole = "admin";

      /*
       * Authorized Admin may remain on the Admin page.
       */
      return;
    }

    /*
     * Authenticated users on the login page:
     * Send them to the appropriate destination.
     */

    if (page === LOGIN_PAGE) {
      try {
        const adminAuthorized = await verifyAdmin(user);

        if (adminAuthorized) {
          currentRole = "admin";
          redirectTo(ADMIN_PAGE);
        } else {
          currentRole = "student";
          redirectTo(STUDENT_PAGE);
        }
      } catch (error) {
        console.error(
          "mNEET role verification failed:",
          error
        );

        /*
         * Do not guess the user's role if Firestore
         * authorization cannot be verified.
         */
      }

      return;
    }

    /*
     * Authenticated students may access student pages.
     * Admin users may also visit student pages.
     *
     * Course purchase checks must be performed separately
     * by the relevant student/course page and Firestore
     * Security Rules.
     */

    if (isStudentPage(page)) {
      try {
        const adminAuthorized = await verifyAdmin(user);

        currentRole = adminAuthorized ? "admin" : "student";
      } catch (error) {
        console.error(
          "mNEET account verification warning:",
          error
        );

        /*
         * A Firestore error must never grant Admin access.
         */
        currentRole = "student";
      }
    }
  }

  /* =====================================================
     START AUTH GUARD
  ===================================================== */

  function start() {
    if (started) {
      return;
    }

    started = true;

    try {
      const services = getFirebaseServices();

      services.auth.onAuthStateChanged(async user => {
        if (handlingAuthState) {
          return;
        }

        handlingAuthState = true;

        try {
          await handleAuthenticatedUser(user);
        } catch (error) {
          console.error(
            "mNEET authentication guard error:",
            error
          );

          const page = getCurrentPage();

          if (isAdminPage(page)) {
            redirectTo(LOGIN_PAGE);
          }
        } finally {
          handlingAuthState = false;
        }
      });

    } catch (error) {
      console.error(
        "mNEET authentication guard could not start:",
        error
      );

      /*
       * If Firebase is unavailable, do not pretend that
       * the user has been authenticated.
       */

      const page = getCurrentPage();

      if (isAdminPage(page) || isStudentPage(page)) {
        redirectTo(LOGIN_PAGE);
      }
    }
  }

  /* =====================================================
     PUBLIC GUARD API
  ===================================================== */

  window.MNEETAuthGuard = Object.freeze({
    start,

    getCurrentUser: function () {
      return currentUser;
    },

    getCurrentRole: function () {
      return currentRole;
    },

    isAdmin: function () {
      return currentRole === "admin";
    },

    verifyAdmin
  });

  /*
   * index.html loads this file with defer.
   * Start after the HTML has been parsed.
   */

  start();

})();
