/* =========================================
   mNEET ADMIN PANEL
   File: admin.js
   Main admin controller
========================================= */

(function () {
  "use strict";

  // Prevent duplicate initialization
  if (window.MNEETAdminControllerLoaded) return;
  window.MNEETAdminControllerLoaded = true;

  const Admin = window.MNEETAdmin =
    window.MNEETAdmin || {};

  Admin.modules = Admin.modules || {};

  let currentAdmin = null;
  let currentPage = "dashboard";
  let navigationStarted = false;

  /* =========================================
     COMMON HELPERS
  ========================================= */

  Admin.getAuth = function () {
    if (typeof firebase === "undefined") return null;

    try {
      return firebase.auth();
    } catch (error) {
      console.error("Firebase Auth error:", error);
      return null;
    }
  };

  Admin.getDB = function () {
    if (typeof firebase === "undefined") return null;

    try {
      return firebase.firestore();
    } catch (error) {
      console.error("Firestore error:", error);
      return null;
    }
  };

  Admin.getCurrentAdmin = function () {
    return currentAdmin;
  };

  Admin.getCurrentPage = function () {
    return currentPage;
  };

  Admin.getTimestamp = function () {
    const db = Admin.getDB();

    if (db && db.FieldValue) {
      return db.FieldValue.serverTimestamp();
    }

    return new Date();
  };

  /* =========================================
     MESSAGE SYSTEM
  ========================================= */

  Admin.showMessage = function (
    message,
    type = "info"
  ) {
    const box = document.getElementById("adminMessage");

    if (!box) {
      console.log("[mNEET Admin]", message);
      return;
    }

    box.textContent = message;
    box.className = "admin-message";
    box.classList.add("show");

    if (type === "success") {
      box.classList.add("success");
    } else if (type === "error") {
      box.classList.add("error");
    } else if (type === "warning") {
      box.classList.add("warning");
    }

    clearTimeout(box._messageTimer);

    box._messageTimer = setTimeout(function () {
      box.classList.remove("show");
    }, 4500);
  };

  /* =========================================
     ADMIN ACCESS CHECK
  ========================================= */

  async function verifyAdmin(user) {
    if (!user) {
      currentAdmin = null;
      window.location.replace("index.html");
      return false;
    }

    const db = Admin.getDB();

    if (!db) {
      Admin.showMessage(
        "Firebase সংযোগ পাওয়া যায়নি। firebase.js পরীক্ষা করো।",
        "error"
      );

      setStatus("firebaseStatus", "Firebase unavailable", "error");
      setStatus("authStatus", "Signed in", "success");
      setStatus("adminAccessStatus", "Not verified", "error");

      return false;
    }

    try {
      const adminSnapshot = await db
        .collection("admins")
        .doc(user.uid)
        .get();

      const adminData = adminSnapshot.exists
        ? adminSnapshot.data()
        : null;

      if (!adminData || adminData.active !== true) {
        currentAdmin = null;

        Admin.showMessage(
          "এই অ্যাকাউন্টের Admin অনুমতি নেই।",
          "error"
        );

        await Admin.getAuth().signOut();

        window.location.replace("index.html");
        return false;
      }

      currentAdmin = {
        uid: user.uid,
        email: user.email || "",
        name:
          adminData.name ||
          user.displayName ||
          "mNEET Admin"
      };

      updateAdminIdentity();

      setStatus("firebaseStatus", "Connected", "success");
      setStatus("authStatus", "Signed in", "success");
      setStatus("adminAccessStatus", "Verified", "success");

      return true;

    } catch (error) {
      console.error("Admin verification failed:", error);

      setStatus("adminAccessStatus", "Verification failed", "error");

      Admin.showMessage(
        "Admin যাচাই করা যায়নি। Firebase Rules ও Internet পরীক্ষা করো।",
        "error"
      );

      return false;
    }
  }

  /* =========================================
     STATUS DISPLAY
  ========================================= */

  function setStatus(id, text, state) {
    const element = document.getElementById(id);

    if (!element) return;

    element.textContent = text;
    element.dataset.status = state || "info";

    element.classList.remove(
      "status-success",
      "status-error",
      "status-warning"
    );

    if (state === "success") {
      element.classList.add("status-success");
    } else if (state === "error") {
      element.classList.add("status-error");
    } else if (state === "warning") {
      element.classList.add("status-warning");
    }
  }

  /* =========================================
     ADMIN NAME AND PROFILE
  ========================================= */

  function updateAdminIdentity() {
    if (!currentAdmin) return;

    const name = currentAdmin.name;
    const email = currentAdmin.email;

    const nameElements = [
      "sidebarAdminName",
      "dashboardWelcome"
    ];

    nameElements.forEach(function (id) {
      const element = document.getElementById(id);

      if (element) {
        if (id === "dashboardWelcome") {
          element.textContent = "Welcome, " + name;
        } else {
          element.textContent = name;
        }
      }
    });

    const avatar = document.getElementById("sidebarAvatar");

    if (avatar) {
      avatar.textContent =
        name.trim().charAt(0).toUpperCase() || "A";
    }

    const profileButton = document.getElementById(
      "topbarProfileButton"
    );

    if (profileButton) {
      profileButton.title = email
        ? name + " — " + email
        : name;
    }
  }

  /* =========================================
     SIDEBAR OPEN / CLOSE
  ========================================= */

  function setupSidebar() {
    const toggle = document.getElementById("sidebarToggle");
    const sidebar = document.getElementById("adminSidebar");
    const overlay = document.getElementById("sidebarOverlay");

    if (toggle && sidebar) {
      toggle.addEventListener("click", function () {
        sidebar.classList.toggle("open");

        if (overlay) {
          overlay.classList.toggle(
            "show",
            sidebar.classList.contains("open")
          );
        }
      });
    }

    if (overlay && sidebar) {
      overlay.addEventListener("click", closeSidebar);
    }

    function closeSidebar() {
      if (sidebar) sidebar.classList.remove("open");
      if (overlay) overlay.classList.remove("show");
    }

    Admin.closeSidebar = closeSidebar;
  }

  /* =========================================
     PAGE NAVIGATION
  ========================================= */

  function setupNavigation() {
    if (navigationStarted) return;
    navigationStarted = true;

    const navigation = document.getElementById("adminNavigation");

    if (!navigation) return;

    navigation.addEventListener("click", function (event) {
      const button = event.target.closest("[data-page]");

      if (!button) return;

      const page = button.dataset.page;

      if (!page) return;

      navigateTo(page);
    });
  }

  function navigateTo(page) {
    const target = document.getElementById(
      page + "Module"
    );

    if (!target) {
      Admin.showMessage(
        "এই পেজটি এখনো তৈরি হয়নি: " + page,
        "warning"
      );
      return;
    }

    currentPage = page;

    document.querySelectorAll("[data-page]").forEach(
      function (button) {
        button.classList.toggle(
          "active",
          button.dataset.page === page
        );
      }
    );

    document.querySelectorAll(".admin-page").forEach(
      function (section) {
        section.classList.toggle(
          "active",
          section.id === page + "Module"
        );
      }
    );

    updatePageHeading(page);

    if (typeof Admin.modules[page]?.render === "function") {
      try {
        const result = Admin.modules[page].render();

        if (result && typeof result.catch === "function") {
          result.catch(function (error) {
            console.error(
              "Page render failed:",
              page,
              error
            );

            Admin.showMessage(
              "পেজ লোড করতে সমস্যা হয়েছে।",
              "error"
            );
          });
        }
      } catch (error) {
        console.error("Page render failed:", error);

        Admin.showMessage(
          "পেজ লোড করতে সমস্যা হয়েছে।",
          "error"
        );
      }
    }

    if (typeof Admin.modules[page]?.init === "function") {
      try {
        Admin.modules[page].init();
      } catch (error) {
        console.error("Page initialization failed:", error);
      }
    }

    if (typeof Admin.closeSidebar === "function") {
      Admin.closeSidebar();
    }

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  Admin.navigateTo = navigateTo;

  /* =========================================
     PAGE TITLES
  ========================================= */

  const pageInformation = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Your mNEET platform overview"
    },
    courses: {
      title: "Courses",
      subtitle: "Manage NEET courses"
    },
    subjects: {
      title: "Subjects",
      subtitle: "Manage course subjects"
    },
    chapters: {
      title: "Chapters",
      subtitle: "Organize chapters"
    },
    topics: {
      title: "Topics",
      subtitle: "Manage topic-wise content"
    },
    quizzes: {
      title: "Quizzes",
      subtitle: "Manage quizzes"
    },
    questions: {
      title: "Questions",
      subtitle: "Manage quiz questions"
    },
    materials: {
      title: "Study Materials",
      subtitle: "Manage notes and PDFs"
    },
    mockTests: {
      title: "Mock Tests",
      subtitle: "Manage NEET mock tests"
    },
    students: {
      title: "Students",
      subtitle: "View registered students"
    },
    purchases: {
      title: "Purchases",
      subtitle: "Review course purchases"
    },
    notifications: {
      title: "Notifications",
      subtitle: "Manage student announcements"
    },
    profile: {
      title: "Admin Profile",
      subtitle: "Your administrator information"
    },
    settings: {
      title: "Settings",
      subtitle: "Manage platform settings"
    }
  };

  function updatePageHeading(page) {
    const information = pageInformation[page] || {
      title: page,
      subtitle: "mNEET Admin Panel"
    };

    const title = document.getElementById("pageTitle");
    const subtitle = document.getElementById("pageSubtitle");

    if (title) title.textContent = information.title;
    if (subtitle) subtitle.textContent = information.subtitle;
  }

  /* =========================================
     LOGOUT
  ========================================= */

  function setupLogout() {
    const logoutButton = document.getElementById(
      "adminLogoutButton"
    );

    if (!logoutButton) return;

    logoutButton.addEventListener("click", async function () {
      const confirmed = window.confirm(
        "তুমি কি Admin Panel থেকে Logout করতে চাও?"
      );

      if (!confirmed) return;

      const auth = Admin.getAuth();

      if (!auth) {
        window.location.replace("index.html");
        return;
      }

      try {
        await auth.signOut();

        currentAdmin = null;

        window.location.replace("index.html");

      } catch (error) {
        console.error("Logout failed:", error);

        Admin.showMessage(
          "Logout করা যায়নি। আবার চেষ্টা করো।",
          "error"
        );
      }
    });
  }

  /* =========================================
     PROFILE BUTTON
  ========================================= */

  function setupProfileButton() {
    const button = document.getElementById(
      "topbarProfileButton"
    );

    if (!button) return;

    button.addEventListener("click", function () {
      navigateTo("profile");
    });
  }

  /* =========================================
     DASHBOARD MODULE
  ========================================= */

  function setupDashboard() {
    if (
      Admin.modules.dashboard &&
      typeof Admin.modules.dashboard.render === "function"
    ) {
      Admin.modules.dashboard.render();
    }
  }

  /* =========================================
     FIREBASE AUTH LISTENER
  ========================================= */

  function setupAuthListener() {
    const auth = Admin.getAuth();

    if (!auth) {
      setStatus("firebaseStatus", "Unavailable", "error");

      Admin.showMessage(
        "Firebase SDK লোড হয়নি। admin.html পরীক্ষা করো।",
        "error"
      );

      return;
    }

    auth.onAuthStateChanged(async function (user) {
      if (!user) {
        currentAdmin = null;
        window.location.replace("index.html");
        return;
      }

      const verified = await verifyAdmin(user);

      if (!verified) return;

      setupDashboard();
    });
  }

  /* =========================================
     INITIALIZATION
  ========================================= */

  function initializeAdminPanel() {
    const year = document.getElementById("adminCurrentYear");

    if (year) {
      year.textContent = new Date().getFullYear();
    }

    setupSidebar();
    setupNavigation();
    setupLogout();
    setupProfileButton();
    setupAuthListener();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initializeAdminPanel
    );
  } else {
    initializeAdminPanel();
  }

})();
