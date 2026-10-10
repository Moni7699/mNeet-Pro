(function () {
  "use strict";

  if (window.MNEETAdminSidebar) return;

  const Sidebar = {
    initialized: false,
    isOpen: false
  };

  window.MNEETAdminSidebar = Sidebar;

  const $ = (id) => document.getElementById(id);

  const elements = {
    sidebar: $("adminSidebar"),
    overlay: $("sidebarOverlay"),
    toggleButton: $("sidebarToggle"),
    closeButton: $("sidebarCloseButton"),
    navigation: $("adminNavigation"),
    sidebarLogoutButton: $("sidebarLogoutButton"),
    topbarLogoutButton: $("adminLogoutButton"),
    notificationButton: $("topbarNotificationButton")
  };

  const PAGE_NAMES = {
    dashboard: "Dashboard",
    courses: "Courses",
    subjects: "Subjects",
    chapters: "Chapters",
    topics: "Topics",
    quizzes: "Quizzes",
    questions: "Questions",
    notes: "Notes",
    ncert: "NCERT",
    pyq: "PYQ",
    students: "Students",
    purchases: "Purchases",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings"
  };

  function showMessage(message, type) {
    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.showMessage === "function"
    ) {
      window.MNEETAdmin.showMessage(message, type || "warning");
      return;
    }

    const messageElement = $("adminMessage");

    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className =
        "admin-message show " + (type || "warning");
      messageElement.setAttribute("role", "status");
    }
  }

  function closeSidebar() {
    Sidebar.isOpen = false;

    if (elements.sidebar) {
      elements.sidebar.classList.remove("open");
      elements.sidebar.setAttribute("aria-hidden", "true");
    }

    if (elements.overlay) {
      elements.overlay.classList.remove("show");
      elements.overlay.setAttribute("aria-hidden", "true");
    }

    if (elements.toggleButton) {
      elements.toggleButton.setAttribute("aria-expanded", "false");
    }

    document.body.classList.remove("sidebar-open");
  }

  function openSidebar() {
    if (!elements.sidebar) return;

    Sidebar.isOpen = true;

    elements.sidebar.classList.add("open");
    elements.sidebar.setAttribute("aria-hidden", "false");

    if (elements.overlay) {
      elements.overlay.classList.add("show");
      elements.overlay.setAttribute("aria-hidden", "false");
    }

    if (elements.toggleButton) {
      elements.toggleButton.setAttribute("aria-expanded", "true");
    }

    document.body.classList.add("sidebar-open");
  }

  function toggleSidebar() {
    if (Sidebar.isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function showPage(pageName) {
    if (!PAGE_NAMES[pageName]) {
      showMessage("এই Admin page পাওয়া যায়নি।", "warning");
      return;
    }

    const targetModule = document.querySelector(
      '[data-module="' + pageName + '"]'
    );

    if (!targetModule) {
      showMessage(
        PAGE_NAMES[pageName] +
          " section admin.html-এ পাওয়া যায়নি। HTML-এর module ID পরীক্ষা করো।",
        "warning"
      );
      return;
    }

    document.querySelectorAll("[data-module]").forEach(function (module) {
      module.hidden = true;
      module.classList.remove("active");
    });

    targetModule.hidden = false;
    targetModule.classList.add("active");

    document.querySelectorAll("[data-page]").forEach(function (button) {
      const isCurrentPage =
        button.getAttribute("data-page") === pageName;

      button.classList.toggle("active", isCurrentPage);

      if (isCurrentPage) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    const titleElement = $("adminPageTitle");

    if (titleElement) {
      titleElement.textContent = PAGE_NAMES[pageName];
    }

    closeSidebar();

    try {
      window.dispatchEvent(
        new CustomEvent("mneet:admin-page-change", {
          detail: { page: pageName }
        })
      );
    } catch (error) {
      // Page navigation should continue if a custom event is unavailable.
    }
  }

  function handleNavigationClick(event) {
    const button = event.target.closest("[data-page]");

    if (!button || !elements.navigation.contains(button)) return;

    event.preventDefault();

    const pageName = button.getAttribute("data-page");
    showPage(pageName);
  }

  function handleLogout() {
    const auth =
      (window.MNEETFirebase && window.MNEETFirebase.auth) ||
      window.mneetAuth ||
      (window.firebase && window.firebase.auth
        ? window.firebase.auth()
        : null);

    if (!auth || !auth.currentUser) {
      window.location.replace("index.html");
      return;
    }

    const logoutButtons = [
      elements.sidebarLogoutButton,
      elements.topbarLogoutButton
    ].filter(Boolean);

    logoutButtons.forEach(function (button) {
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
    });

    auth
      .signOut()
      .then(function () {
        window.location.replace("index.html");
      })
      .catch(function (error) {
        logoutButtons.forEach(function (button) {
          button.disabled = false;
          button.removeAttribute("aria-busy");
        });

        console.error("mNEET logout error:", error);

        showMessage(
          "Logout করা যায়নি। Internet connection পরীক্ষা করে আবার চেষ্টা করো।",
          "error"
        );
      });
  }

  function setupSidebarButtons() {
    if (elements.toggleButton) {
      elements.toggleButton.addEventListener("click", toggleSidebar);
      elements.toggleButton.setAttribute("aria-controls", "adminSidebar");
      elements.toggleButton.setAttribute("aria-expanded", "false");
    }

    if (elements.closeButton) {
      elements.closeButton.addEventListener("click", closeSidebar);
    }

    if (elements.overlay) {
      elements.overlay.addEventListener("click", closeSidebar);
    }

    if (elements.navigation) {
      elements.navigation.addEventListener(
        "click",
        handleNavigationClick
      );
    }

    if (elements.sidebarLogoutButton) {
      elements.sidebarLogoutButton.addEventListener(
        "click",
        handleLogout
      );
    }

    if (elements.topbarLogoutButton) {
      elements.topbarLogoutButton.addEventListener(
        "click",
        handleLogout
      );
    }

    if (elements.notificationButton) {
      elements.notificationButton.addEventListener("click", function (event) {
        event.preventDefault();
        showPage("notifications");
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && Sidebar.isOpen) {
        closeSidebar();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) {
        closeSidebar();
      }
    });
  }

  function setupInitialPage() {
    const activeButton = document.querySelector(
      '#adminNavigation [data-page].active'
    );

    const initialPage = activeButton
      ? activeButton.getAttribute("data-page")
      : "dashboard";

    showPage(PAGE_NAMES[initialPage] ? initialPage : "dashboard");
  }

  function init() {
    if (Sidebar.initialized) return;

    if (!elements.sidebar || !elements.navigation) {
      console.warn(
        "mNEET Sidebar: adminSidebar অথবা adminNavigation পাওয়া যায়নি।"
      );
      return;
    }

    Sidebar.initialized = true;

    setupSidebarButtons();
    setupInitialPage();
    closeSidebar();

    window.addEventListener("mneet:admin-page-change", function (event) {
      if (!event.detail || !event.detail.page) return;

      const pageName = event.detail.page;

      document.querySelectorAll("[data-page]").forEach(function (button) {
        const isCurrentPage =
          button.getAttribute("data-page") === pageName;

        button.classList.toggle("active", isCurrentPage);
      });
    });
  }

  Sidebar.open = openSidebar;
  Sidebar.close = closeSidebar;
  Sidebar.toggle = toggleSidebar;
  Sidebar.showPage = showPage;
  Sidebar.logout = handleLogout;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
