/* =========================================================
   mNEET — Authentication Guard
   File: auth-guard.js

   Features:
   - Student page protection
   - Admin page protection
   - Firebase project verification
   - Active account verification
   - Role-based redirection
   - Fail-closed authorization
   ========================================================= */

(function (window, document) {
  "use strict";

  const ADMIN_LOGIN_PAGE = "admin-login.html";
  const ADMIN_DASHBOARD_PAGE = "admin.html";
  const STUDENT_LOGIN_PAGE = "index.html";
  const STUDENT_DASHBOARD_PAGE = "student.html";

  const STUDENT_PAGES = [
    "student.html",
    "course.html",
    "chapter.html",
    "topic.html",
    "ncert.html",
    "video.html"
  ];

  const currentPage = (
    window.location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();

  const isAdminLoginPage = currentPage === ADMIN_LOGIN_PAGE;
  const isAdminDashboardPage = currentPage === ADMIN_DASHBOARD_PAGE;
  const isStudentPage = STUDENT_PAGES.includes(currentPage);

  if (
    !isAdminLoginPage &&
    !isAdminDashboardPage &&
    !isStudentPage
  ) {
    return;
  }

  let verificationInProgress = false;

  function getFirebase() {
    const services = window.MNEETFirebase;

    if (
      !services ||
      services.ready !== true ||
      !services.auth ||
      !services.db ||
      services.projectId !== "mneet-spark"
    ) {
      throw new Error(
        "Firebase initialization failed. Check firebase.js."
      );
    }

    return services;
  }

  function redirect(page) {
    if (currentPage !== page) {
      window.location.replace(page);
    }
  }

  function showMessage(elementIds, message) {
    for (const id of elementIds) {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = message;
        element.hidden = false;
        return;
      }
    }

    console.error("[mNEET Auth Guard]", message);
  }

  async function isAuthorizedAdmin(user) {
    if (!user || !user.uid) {
      return false;
    }

    const services = getFirebase();

    const snapshot = await services.db
      .collection("admins")
      .doc(user.uid)
      .get();

    if (!snapshot.exists) {
      return false;
    }

    const adminData = snapshot.data() || {};

    return adminData.active === true;
  }

  async function getStudentProfile(user) {
    if (!user || !user.uid) {
      return null;
    }

    const services = getFirebase();

    const snapshot = await services.db
      .collection("users")
      .doc(user.uid)
      .get();

    if (!snapshot.exists) {
      return null;
    }

    const profile = snapshot.data() || {};

    if (profile.accountStatus === "disabled") {
      return null;
    }

    /*
     * An Admin account must not be treated as a Student
     * merely because a users/{uid} document exists.
     */
    if (await isAuthorizedAdmin(user)) {
      return null;
    }

    return profile;
  }

  async function handleAuthState(user) {
    if (verificationInProgress) {
      return;
    }

    verificationInProgress = true;

    try {
      const services = getFirebase();

      // Not signed in.
      if (!user) {
        if (isAdminDashboardPage) {
          redirect(ADMIN_LOGIN_PAGE);
        } else if (isStudentPage) {
          redirect(STUDENT_LOGIN_PAGE);
        }

        return;
      }

      // Admin login page.
      if (isAdminLoginPage) {
        let authorized = false;

        try {
          authorized = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error(
            "[mNEET] Admin verification failed:",
            error
          );

          showMessage(
            [
              "adminLoginMessage",
              "loginMessage",
              "authMessage",
              "errorMessage"
            ],
            "Admin যাচাই করা যায়নি। Firebase Rules পরীক্ষা করো।"
          );

          return;
        }

        if (authorized) {
          redirect(ADMIN_DASHBOARD_PAGE);
          return;
        }

        showMessage(
          [
            "adminLoginMessage",
            "loginMessage",
            "authMessage",
            "errorMessage"
          ],
          "এই অ্যাকাউন্টে সক্রিয় Admin অনুমতি নেই।"
        );

        return;
      }

      // Admin dashboard.
      if (isAdminDashboardPage) {
        let authorized = false;

        try {
          authorized = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error(
            "[mNEET] Admin dashboard verification failed:",
            error
          );

          showMessage(
            ["verificationMessage"],
            "Admin যাচাই ব্যর্থ হয়েছে। পরে আবার চেষ্টা করো।"
          );

          return;
        }

        if (!authorized) {
          redirect(STUDENT_LOGIN_PAGE);
          return;
        }

        document.documentElement.setAttribute(
          "data-admin-authorized",
          "true"
        );

        window.dispatchEvent(
          new CustomEvent("mneet:admin-authorized", {
            detail: {
              uid: user.uid
            }
          })
        );

        return;
      }

      // Student pages.
      if (isStudentPage) {
        let profile = null;

        try {
          profile = await getStudentProfile(user);
        } catch (error) {
          console.error(
            "[mNEET] Student verification failed:",
            error
          );

          showMessage(
            ["authMessage", "verificationMessage"],
            "Student account যাচাই করা যায়নি। পেজ Refresh করো।"
          );

          return;
        }

        if (!profile) {
          await services.auth.signOut();
          redirect(STUDENT_LOGIN_PAGE);
          return;
        }

        document.documentElement.setAttribute(
          "data-student-authorized",
          "true"
        );

        window.dispatchEvent(
          new CustomEvent("mneet:student-authorized", {
            detail: {
              uid: user.uid
            }
          })
        );
      }
    } catch (error) {
      console.error(
        "[mNEET] Authentication guard error:",
        error
      );

      if (isAdminLoginPage) {
        showMessage(
          [
            "adminLoginMessage",
            "loginMessage",
            "authMessage"
          ],
          "Firebase চালু হয়নি। পেজ Refresh করো।"
        );
      }
    } finally {
      verificationInProgress = false;
    }
  }

  try {
    const services = getFirebase();

    services.auth.onAuthStateChanged(function (user) {
      handleAuthState(user);
    });
  } catch (error) {
    console.error(
      "[mNEET] Auth Guard initialization error:",
      error
    );

    if (isAdminLoginPage) {
      showMessage(
        [
          "adminLoginMessage",
          "loginMessage",
          "authMessage"
        ],
        "Firebase initialization failed. পেজ Refresh করো।"
      );
    }
  }
})(window, document);
