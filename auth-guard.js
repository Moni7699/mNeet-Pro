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

  // অন্য পেজে এই guard-এর কাজ নেই।
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
      !services.ready ||
      !services.auth ||
      !services.db ||
      services.projectId !== "mneet-spark"
    ) {
      throw new Error("Firebase is not ready or project is incorrect.");
    }

    return services;
  }

  function redirect(page) {
    if (currentPage !== page) {
      window.location.replace(page);
    }
  }

  async function isAuthorizedAdmin(user) {
    if (!user || !user.uid) {
      return false;
    }

    const services = getFirebase();

    const adminDoc = await services.db
      .collection("admins")
      .doc(user.uid)
      .get();

    if (!adminDoc.exists) {
      return false;
    }

    const adminData = adminDoc.data();

    return adminData.active === true;
  }

  async function hasActiveStudentProfile(user) {
    if (!user || !user.uid) {
      return false;
    }

    const services = getFirebase();

    const userDoc = await services.db
      .collection("users")
      .doc(user.uid)
      .get();

    if (!userDoc.exists) {
      return false;
    }

    const profile = userDoc.data();

    return profile.accountStatus !== "disabled";
  }

  async function handleAuthState(user) {
    if (verificationInProgress) {
      return;
    }

    verificationInProgress = true;

    try {
      const services = getFirebase();

      // No signed-in user: protected pages are inaccessible.
      if (!user) {
        if (isAdminDashboardPage) {
          redirect(ADMIN_LOGIN_PAGE);
        } else if (isStudentPage) {
          redirect(STUDENT_LOGIN_PAGE);
        }

        return;
      }

      // ADMIN LOGIN PAGE
      if (isAdminLoginPage) {
        let admin;

        try {
          admin = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error("Admin verification failed:", error);
          return;
        }

        if (admin) {
          redirect(ADMIN_DASHBOARD_PAGE);
          return;
        }

        // Only an account with a valid student profile goes to student.
        let student;

        try {
          student = await hasActiveStudentProfile(user);
        } catch (error) {
          console.error("Student profile verification failed:", error);
          return;
        }

        if (student) {
          redirect(STUDENT_DASHBOARD_PAGE);
        }

        return;
      }

      // ADMIN DASHBOARD
      if (isAdminDashboardPage) {
        let admin;

        try {
          admin = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error("Admin dashboard verification failed:", error);
          document.body.innerHTML =
            "<main style='padding:24px;font-family:Arial'>" +
            "<h2>Admin verification failed</h2>" +
            "<p>Check your internet connection and Firebase Security Rules, then reload.</p>" +
            "<a href='admin-login.html'>Return to Admin Login</a>" +
            "</main>";
          return;
        }

        if (!admin) {
          let student = false;

          try {
            student = await hasActiveStudentProfile(user);
          } catch (error) {
            console.error("Student profile verification failed:", error);
          }

          if (student) {
            redirect(STUDENT_DASHBOARD_PAGE);
          } else {
            await services.auth.signOut();
            redirect(ADMIN_LOGIN_PAGE);
          }

          return;
        }

        // Authorized admin stays on admin.html.
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

      // STUDENT PAGES
      if (isStudentPage) {
        let admin = false;

        try {
          admin = await isAuthorizedAdmin(user);
        } catch (error) {
          console.error("Admin role check failed:", error);
        }

        if (admin) {
          redirect(ADMIN_DASHBOARD_PAGE);
          return;
        }

        let student;

        try {
          student = await hasActiveStudentProfile(user);
        } catch (error) {
          console.error("Student profile verification failed:", error);
          return;
        }

        if (!student) {
          await services.auth.signOut();
          redirect(STUDENT_LOGIN_PAGE);
        }
      }
    } catch (error) {
      console.error("Authentication guard error:", error);
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
    console.error("Unable to initialize authentication guard:", error);
  }
})();
