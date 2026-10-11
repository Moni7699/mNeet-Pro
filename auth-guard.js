(function () {
  "use strict";

  const ADMIN_LOGIN_PAGE = "admin-login.html";
  const STUDENT_LOGIN_PAGE = "index.html";
  const ADMIN_DASHBOARD_PAGE = "admin.html";
  const STUDENT_DASHBOARD_PAGE = "student.html";

  const currentPage = (
    window.location.pathname.split("/").pop() || "index.html"
  ).toLowerCase();

  const isAdminLoginPage = currentPage === ADMIN_LOGIN_PAGE;
  const isAdminDashboardPage = currentPage === ADMIN_DASHBOARD_PAGE;

  const studentPages = [
    "student.html",
    "course.html",
    "chapter.html",
    "topic.html",
    "ncert.html",
    "video.html"
  ];

  const isStudentPage = studentPages.includes(currentPage);

  if (
    !isAdminLoginPage &&
    !isAdminDashboardPage &&
    !studentPages.includes(currentPage)
  ) {
    return;
  }

  let verificationInProgress = false;

  function getFirebase() {
    const services = window.MNEETFirebase;

    if (
      !services ||
      !services.ready ||
      !services.auth ||
      !services.db ||
      services.projectId !== "mneet-spark"
    ) {
      throw new Error(
        "Firebase is not ready or the project ID is incorrect."
      );
    }

    return services;
  }

  function redirect(page) {
    if (currentPage !== page) {
      window.location.replace(page);
    }
  }

  function showAdminLoginError(message) {
    const possibleElements = [
      document.getElementById("adminLoginMessage"),
      document.getElementById("loginMessage"),
      document.getElementById("authMessage"),
      document.getElementById("errorMessage")
    ];

    const target = possibleElements.find(Boolean);

    if (target) {
      target.textContent = message;
      target.hidden = false;
    } else {
      console.error("Admin login verification:", message);
    }
  }

  async function isAuthorizedAdmin(user) {
    if (!user || !user.uid) {
      return false;
    }

    const services = getFirebase();

    console.log("[mNEET Admin] Project:", services.projectId);
    console.log("[mNEET Admin] Signed-in UID:", user.uid);

    const snapshot = await services.db
      .collection("admins")
      .doc(user.uid)
      .get();

    console.log("[mNEET Admin] Document exists:", snapshot.exists);

    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data();

    console.log("[mNEET Admin] active value:", data.active);
    console.log("[mNEET Admin] active type:", typeof data.active);

    return data.active === true;
  }

  async function hasActiveStudentProfile(user) {
    if (!user || !user.uid) {
      return false;
    }

    const services = getFirebase();

    const snapshot = await services.db
      .collection("users")
      .doc(user.uid)
      .get();

    if (!snapshot.exists) {
      return false;
    }

    return snapshot.data().accountStatus !== "disabled";
  }

  async function handleAuthState(user) {
    if (verificationInProgress) {
      return;
    }

    verificationInProgress = true;

    try {
      const services = getFirebase();

      if (!user) {
        if (isAdminDashboardPage) {
          redirect(ADMIN_LOGIN_PAGE);
        } else if (isStudentPage) {
          redirect(STUDENT_LOGIN_PAGE);
        }

        return;
      }

      // ADMIN LOGIN
      if (isAdminLoginPage) {
        let admin = false;

        try {
          admin = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error("[mNEET Admin] Firestore verification error:", error);

          showAdminLoginError(
            "Admin verification failed: " +
            (error.code || error.message || "Unknown Firebase error")
          );

          return;
        }

        if (admin) {
          redirect(ADMIN_DASHBOARD_PAGE);
          return;
        }

        showAdminLoginError(
          "Login succeeded, but this account is not an active administrator. " +
          "Check the admins document and its active field."
        );

        return;
      }

      // ADMIN DASHBOARD
      if (isAdminDashboardPage) {
        let admin = false;

        try {
          admin = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error("[mNEET Admin] Dashboard verification error:", error);

          const message = document.getElementById("verificationMessage");

          if (message) {
            message.textContent =
              "Admin verification failed: " +
              (error.code || error.message || "Unknown Firebase error");
          }

          return;
        }

        if (!admin) {
          let student = false;

          try {
            student = await hasActiveStudentProfile(user);
          } catch (error) {
            console.error("[mNEET Student] Profile check failed:", error);
          }

          if (student) {
            redirect(STUDENT_DASHBOARD_PAGE);
          } else {
            await services.auth.signOut();
            redirect(ADMIN_LOGIN_PAGE);
          }

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

      // STUDENT DASHBOARD AND PAGES
      if (isStudentPage) {
        let admin = false;

        try {
          admin = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error("[mNEET] Admin role check failed:", error);
        }

        if (admin) {
          redirect(ADMIN_DASHBOARD_PAGE);
          return;
        }

        let student = false;

        try {
          student = await hasActiveStudentProfile(user);
        } catch (error) {
          console.error("[mNEET] Student profile verification failed:", error);
          return;
        }

        if (!student) {
          await services.auth.signOut();
          redirect(STUDENT_LOGIN_PAGE);
        }
      }
    } catch (error) {
      console.error("[mNEET] Authentication guard error:", error);

      if (isAdminLoginPage) {
        showAdminLoginError(
          "Firebase error: " +
          (error.code || error.message || "Unknown error")
        );
      }
    } finally {
      verificationInProgress = false;
    }
  }

  try {
    getFirebase().auth.onAuthStateChanged(function (user) {
      handleAuthState(user);
    });
  } catch (error) {
    console.error("[mNEET] Unable to initialize auth guard:", error);

    if (isAdminLoginPage) {
      showAdminLoginError(
        "Firebase initialization failed: " +
        (error.message || "Unknown error")
      );
    }
  }
})();
