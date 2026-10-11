/* =====================================================
   mNEET AUTHENTICATION GUARD
   File: auth-guard.js

   Responsibilities:
   1. Protect Admin and Student pages.
   2. Verify Admin using admins/{uid}.active === true.
   3. Route Admin to admin.html.
   4. Route Student to student.html.
   5. Prevent unauthorized access.
   6. Never treat a Firebase verification error as Student.
===================================================== */

(function (window, document) {
  "use strict";

  const LOGIN_PAGE = "index.html";
  const ADMIN_PAGE = "admin.html";
  const STUDENT_PAGE = "student.html";

  let started = false;
  let auth = null;
  let db = null;
  let currentUser = null;
  let currentRole = null;
  let checkVersion = 0;

  /* =====================================================
     PAGE DETECTION
  ===================================================== */

  function getCurrentPage() {
    const path = window.location.pathname || "/";
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
      !services ||
      services.ready !== true ||
      !services.auth ||
      !services.db
    ) {
      throw new Error(
        "Firebase প্রস্তুত নয়। firebase.js এবং Firebase SDK পরীক্ষা করো।"
      );
    }

    auth = services.auth;
    db = services.db;

    return {
      auth: auth,
      db: db
    };
  }

  /* =====================================================
     SAFE NAVIGATION
  ===================================================== */

  function redirectTo(page) {
    const currentPage = getCurrentPage();

    if (currentPage !== page.toLowerCase()) {
      console.info(
        "mNEET navigation:",
        currentPage,
        "→",
        page
      );

      window.location.replace(page);
    }
  }

  /* =====================================================
     DISPLAY ERROR
  ===================================================== */

  function showError(message) {
    console.error("mNEET Access Error:", message);

    const element = document.getElementById("authMessage");

    if (element) {
      element.textContent = message;
      element.classList.add("show");
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

    console.info(
      "mNEET Admin verification started."
    );

    console.info(
      "Current UID:",
      user.uid
    );

    console.info(
      "Firebase project:",
      services.db.app.options.projectId
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
      return false;
    }

    const data = snapshot.data() || {};

    console.info(
      "Admin active:",
      data.active
    );

    /*
     * Only a Boolean true authorizes an Admin.
     * The string "true" is not sufficient.
     */

    return data.active === true;
  }

  /* =====================================================
     AUTHENTICATED USER HANDLER
  ===================================================== */

  async function handleUser(user, version) {
    const page = getCurrentPage();

    function isLatestCheck() {
      return version === checkVersion;
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
     * Verify the current user's Admin status.
     *
     * A successful verification returning false means
     * the user is not an active Admin.
     *
     * A rejected Firestore request is an ERROR and must
     * not be treated as a Student account.
     */

    let adminAuthorized;

    try {
      adminAuthorized = await verifyAdmin(user);
    } catch (error) {
      if (!isLatestCheck()) return;

      currentRole = null;

      console.error(
        "mNEET Admin verification failed:",
        error
      );

      const message =
        "Account যাচাই করা যায়নি। Internet connection এবং Firebase Security Rules পরীক্ষা করে আবার চেষ্টা করো।";

      if (isLoginPage(page)) {
        showError(message);
      } else if (isAdminPage(page)) {
        showError(message);
      } else if (isStudentPage(page)) {
        showError(message);
      }

      /*
       * Do not redirect to Student on verification errors.
       * Fail closed on protected pages.
       */

      if (isProtectedPage(page)) {
        redirectTo(LOGIN_PAGE);
      }

      return;
    }

    if (!isLatestCheck()) return;

    /*
     * LOGIN PAGE
     */

    if (isLoginPage(page)) {
      if (adminAuthorized) {
        currentRole = "admin";
        redirectTo(ADMIN_PAGE);
        return;
      }

      /*
       * A successful Admin check that returns false
       * means the account is not an active Admin.
       *
       * Continue only if the user has a valid Student
       * profile. Never grant Admin access through users/.
       */

      try {
        const studentSnapshot = await db
          .collection("users")
          .doc(user.uid)
          .get();

        if (!isLatestCheck()) return;

        if (!studentSnapshot.exists) {
          currentRole = null;

          showError(
            "এই অ্যাকাউন্টের Student Profile পাওয়া যায়নি। Admin হলে admins/{uid} পরীক্ষা করো; Student হলে Registration সম্পূর্ণ করো।"
          );

          await auth.signOut();
          return;
        }

        const studentData = studentSnapshot.data() || {};

        if (studentData.accountStatus === "disabled") {
          currentRole = null;

          showError(
            "এই Student Account নিষ্ক্রিয় করা হয়েছে।"
          );

          await auth.signOut();
          return;
        }

        currentRole = "student";
        redirectTo(STUDENT_PAGE);

      } catch (error) {
        if (!isLatestCheck()) return;

        currentRole = null;

        console.error(
          "mNEET Student profile verification failed:",
          error
        );

        showError(
          "Student Profile যাচাই করা যায়নি। Firestore Security Rules পরীক্ষা করো।"
        );
      }

      return;
    }

    /*
     * ADMIN PAGE
     */

    if (isAdminPage(page)) {
      if (adminAuthorized) {
        currentRole = "admin";
        return;
      }

      /*
       * Admin document is missing or inactive.
       * Do not allow the account to remain on Admin pages.
       */

      currentRole = null;

      showError(
        "এই অ্যাকাউন্টের Admin Access নেই।"
      );

      redirectTo(STUDENT_PAGE);
      return;
    }

    /*
     * STUDENT PAGE
     */

    if (isStudentPage(page)) {
      if (adminAuthorized) {
        /*
         * An active Admin should not remain on Student pages.
         */

        currentRole = "admin";
        redirectTo(ADMIN_PAGE);
        return;
      }

      try {
        const studentSnapshot = await db
          .collection("users")
          .doc(user.uid)
          .get();

        if (!isLatestCheck()) return;

        if (!studentSnapshot.exists) {
          currentRole = null;
          redirectTo(LOGIN_PAGE);
          return;
        }

        const studentData = studentSnapshot.data() || {};

        if (studentData.accountStatus === "disabled") {
          currentRole = null;
          await auth.signOut();
          redirectTo(LOGIN_PAGE);
          return;
        }

        currentRole = "student";

      } catch (error) {
        if (!isLatestCheck()) return;

        currentRole = null;

        console.error(
          "mNEET Student access verification failed:",
          error
        );

        redirectTo(LOGIN_PAGE);
      }
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
        "mNEET Auth Guard initialization failed:",
        error
      );

      if (isProtectedPage(getCurrentPage())) {
        redirectTo(LOGIN_PAGE);
      }

      return;
    }

    started = true;

    services.auth.onAuthStateChanged(async function (user) {
      const version = ++checkVersion;

      try {
        await handleUser(user, version);
      } catch (error) {
        if (version !== checkVersion) return;

        console.error(
          "mNEET Auth Guard error:",
          error
        );

        currentRole = null;

        if (isProtectedPage(getCurrentPage())) {
          redirectTo(LOGIN_PAGE);
        } else {
          showError(
            "Account যাচাই করতে সমস্যা হয়েছে। আবার চেষ্টা করো।"
          );
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
   * Start the guard.
   */

  start();

})(window, document);
