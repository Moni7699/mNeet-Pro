/* =========================================
   mNEET AUTH GUARD
   Firebase Project: mneet-spark
========================================= */

(function (window, document) {
  "use strict";

  const PROJECT_ID = "mneet-spark";

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

  if (!isAdminLogin && !isAdminDashboard && !isStudentPage) {
    return;
  }

  let processing = false;
  let lastUser = null;

  function getFirebase() {
    const f = window.MNEETFirebase;

    if (
      !f ||
      f.ready !== true ||
      !f.auth ||
      !f.db ||
      f.projectId !== PROJECT_ID
    ) {
      throw new Error(
        "Firebase initialize হয়নি। firebase.js পরীক্ষা করো।"
      );
    }

    return f;
  }

  function showMessage(text) {
    const ids = [
      "verificationMessage",
      "message",
      "adminLoginMessage",
      "authMessage"
    ];

    for (const id of ids) {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = text;
        element.hidden = false;
        return;
      }
    }

    console.error("[mNEET Auth Guard]", text);
  }

  function isConfiguredAdmin(user) {
    return Boolean(
      user &&
      user.uid === ADMIN_UID &&
      user.email &&
      user.email.toLowerCase() === ADMIN_EMAIL
    );
  }

  /*
   * Firestore document remains mandatory.
   * Read errors are reported rather than silently ignored.
   */
  async function verifyAdmin(user) {
    if (!isConfiguredAdmin(user)) {
      return false;
    }

    const f = getFirebase();

    const snapshot = await f.db
      .collection("admins")
      .doc(ADMIN_UID)
      .get();

    if (!snapshot.exists) {
      throw new Error(
        "admins/" + ADMIN_UID +
        " document পাওয়া যায়নি। সঠিক Firebase project পরীক্ষা করো।"
      );
    }

    const data = snapshot.data() || {};

    if (data.active !== true) {
      return false;
    }

    if (
      data.email &&
      data.email.toLowerCase() !== ADMIN_EMAIL
    ) {
      return false;
    }

    return true;
  }

  async function verifyStudent(user) {
    if (!user || isConfiguredAdmin(user)) {
      return false;
    }

    const f = getFirebase();

    const snapshot = await f.db
      .collection("users")
      .doc(user.uid)
      .get();

    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data() || {};

    if (
      data.accountStatus === "disabled" ||
      data.status === "disabled"
    ) {
      return false;
    }

    return true;
  }

  function redirect(page) {
    if (currentPage !== page) {
      window.location.replace(page);
    }
  }

  async function handleAuth(user) {
    if (processing) return;

    processing = true;
    lastUser = user ? user.uid : null;

    try {
      const f = getFirebase();

      if (!user) {
        if (isAdminDashboard) {
          redirect(ADMIN_LOGIN);
        } else if (isStudentPage) {
          redirect(STUDENT_LOGIN);
        }

        return;
      }

      if (isAdminLogin || isAdminDashboard) {
        if (!isConfiguredAdmin(user)) {
          if (isAdminDashboard) {
            await f.auth.signOut();
            redirect(ADMIN_LOGIN);
          } else {
            showMessage(
              "এই account অনুমোদিত Admin account নয়।"
            );
          }

          return;
        }

        let authorized;

        try {
          authorized = await verifyAdmin(user);
        } catch (error) {
          console.error("Admin verification failed:", error);

          showMessage(
            error.message ||
            "Admin verification ব্যর্থ হয়েছে। Firebase পরীক্ষা করো।"
          );

          /*
           * Do not automatically sign out on a database read error.
           * Keep the error visible so the real issue can be diagnosed.
           */
          return;
        }

        if (!authorized) {
          showMessage(
            "Admin account active নয় অথবা অনুমতি পাওয়া যায়নি।"
          );

          if (isAdminDashboard) {
            await f.auth.signOut();
            redirect(ADMIN_LOGIN);
          }

          return;
        }

        if (isAdminLogin) {
          redirect(ADMIN_DASHBOARD);
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
        let allowed;

        try {
          allowed = await verifyStudent(user);
        } catch (error) {
          console.error("Student verification failed:", error);

          showMessage(
            "Student account যাচাই করা যায়নি। Firebase Rules পরীক্ষা করো।"
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
      console.error("mNEET Auth Guard error:", error);
      showMessage(error.message || "Firebase error হয়েছে।");
    } finally {
      processing = false;
    }
  }

  try {
    const f = getFirebase();

    f.auth.onAuthStateChanged(function (user) {
      /*
       * Ignore duplicate events for the same user while processing.
       */
      if (processing && lastUser === (user ? user.uid : null)) {
        return;
      }

      handleAuth(user);
    });
  } catch (error) {
    console.error("Auth Guard initialization failed:", error);
    showMessage("Firebase initialize হয়নি। পেজ Refresh করো।");
  }
})(window, document);
