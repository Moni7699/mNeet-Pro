/* =====================================================
   mNEET AUTH GUARD
   Firebase project: mneet-spark
   ===================================================== */

(function (window, document) {
  "use strict";

  const ADMIN_LOGIN = "admin-login.html";
  const ADMIN_DASHBOARD = "admin.html";
  const STUDENT_LOGIN = "index.html";

  const ADMIN_EMAIL = "mi4286803@gmail.com";
  const ADMIN_UID = "vMMaKyl7NoRv2BcthmDobbBXfZE3";

  const STUDENT_PAGES = [
    "student.html",
    "course.html",
    "chapter.html",
    "topic.html",
    "ncert.html",
    "video.html"
  ];

  const currentPage =
    (window.location.pathname.split("/").pop() || "index.html")
      .toLowerCase();

  const isAdminLogin = currentPage === ADMIN_LOGIN;
  const isAdminDashboard = currentPage === ADMIN_DASHBOARD;
  const isStudentPage = STUDENT_PAGES.includes(currentPage);

  /*
   * অন্য public page-এ এই guard কোনো পরিবর্তন করবে না।
   */
  if (!isAdminLogin && !isAdminDashboard && !isStudentPage) {
    return;
  }

  let running = false;

  function firebase() {
    const f = window.MNEETFirebase;

    if (
      !f ||
      f.ready !== true ||
      !f.auth ||
      !f.db ||
      f.projectId !== "mneet-spark"
    ) {
      throw new Error("Firebase initialization failed.");
    }

    return f;
  }

  function redirect(page) {
    if (currentPage !== page) {
      window.location.replace(page);
    }
  }

  function showMessage(text) {
    const ids = [
      "verificationMessage",
      "message",
      "adminLoginMessage",
      "authMessage"
    ];

    for (const id of ids) {
      const el = document.getElementById(id);

      if (el) {
        el.textContent = text;
        el.hidden = false;
        return;
      }
    }

    console.error("[mNEET Auth]", text);
  }

  async function isAdmin(user) {
    if (
      !user ||
      user.uid !== ADMIN_UID ||
      user.email !== ADMIN_EMAIL
    ) {
      return false;
    }

    const f = firebase();

    const doc = await f.db
      .collection("admins")
      .doc(ADMIN_UID)
      .get();

    if (!doc.exists) return false;

    return doc.data().active === true;
  }

  async function verifyStudent(user) {
    if (!user) return false;

    const f = firebase();

    const doc = await f.db
      .collection("users")
      .doc(user.uid)
      .get();

    if (!doc.exists) return false;

    const profile = doc.data() || {};

    if (profile.accountStatus === "disabled") {
      return false;
    }

    /*
     * The configured Admin must never enter the student dashboard.
     */
    if (
      user.uid === ADMIN_UID &&
      user.email === ADMIN_EMAIL
    ) {
      return false;
    }

    return true;
  }

  async function handleAuth(user) {
    if (running) return;
    running = true;

    try {
      const f = firebase();

      if (!user) {
        if (isAdminDashboard) {
          redirect(ADMIN_LOGIN);
        } else if (isStudentPage) {
          redirect(STUDENT_LOGIN);
        }

        return;
      }

      /*
       * Admin login page:
       * Do not redirect an unverified signed-in account away.
       * Keep the login page available to display an error.
       */
      if (isAdminLogin) {
        try {
          if (await isAdmin(user)) {
            redirect(ADMIN_DASHBOARD);
          } else {
            showMessage(
              "এই account-এর সক্রিয় Admin permission নেই।"
            );
          }
        } catch (error) {
          console.error("Admin login-page verification:", error);

          showMessage(
            "Admin যাচাই করা যায়নি। Firebase Rules ও সংযোগ পরীক্ষা করো।"
          );
        }

        return;
      }

      if (isAdminDashboard) {
        let authorized = false;

        try {
          authorized = await isAdmin(user);
        } catch (error) {
          console.error("Dashboard Admin verification:", error);

          showMessage(
            "Admin যাচাই ব্যর্থ হয়েছে। Firebase Rules পরীক্ষা করো।"
          );

          return;
        }

        if (!authorized) {
          await f.auth.signOut();
          redirect(ADMIN_LOGIN);
          return;
        }

        document.documentElement.setAttribute(
          "data-admin-authorized",
          "true"
        );

        window.dispatchEvent(
          new CustomEvent("mneet:admin-authorized", {
            detail: { uid: user.uid }
          })
        );

        return;
      }

      if (isStudentPage) {
        let allowed = false;

        try {
          allowed = await verifyStudent(user);
        } catch (error) {
          console.error("Student verification:", error);

          showMessage(
            "Student account যাচাই করা যায়নি। Refresh করে আবার চেষ্টা করো।"
          );

          return;
        }

        if (!allowed) {
          await f.auth.signOut();
          redirect(STUDENT_LOGIN);
          return;
        }

        document.documentElement.setAttribute(
          "data-student-authorized",
          "true"
        );

        window.dispatchEvent(
          new CustomEvent("mneet:student-authorized", {
            detail: { uid: user.uid }
          })
        );
      }
    } catch (error) {
      console.error("mNEET Auth Guard:", error);

      showMessage(
        "Firebase চালু হয়নি। firebase.js ও Firebase SDK পরীক্ষা করো।"
      );
    } finally {
      running = false;
    }
  }

  try {
    const f = firebase();

    f.auth.onAuthStateChanged(function (user) {
      handleAuth(user);
    });
  } catch (error) {
    console.error("Auth Guard initialization:", error);

    showMessage(
      "Firebase initialization failed। পেজ Refresh করো।"
    );
  }
})(window, document);
