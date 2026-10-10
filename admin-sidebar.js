/* ==========================================
   mNEET ADMIN PANEL
   File: admin-sidebar.js
   Sidebar Navigation Module
========================================== */

(function () {
  "use strict";

  window.MNEETAdmin = window.MNEETAdmin || {};

  const Admin = window.MNEETAdmin;

  /* Prevent duplicate initialization */
  if (Admin.sidebarModuleLoaded) return;
  Admin.sidebarModuleLoaded = true;

  /* ==========================================
     SIDEBAR ELEMENTS
  ========================================== */

  function getElements() {
    return {
      sidebar: document.getElementById("adminSidebar"),
      overlay: document.getElementById("sidebarOverlay"),
      toggle: document.getElementById("sidebarToggle"),
      navigation: document.getElementById("adminNavigation")
    };
  }

  /* ==========================================
     OPEN SIDEBAR
  ========================================== */

  function openSidebar() {
    const elements = getElements();

    if (elements.sidebar) {
      elements.sidebar.classList.add("open");
    }

    if (elements.overlay) {
      elements.overlay.classList.add("show");
    }

    document.body.classList.add("sidebar-open");

    if (elements.toggle) {
      elements.toggle.setAttribute("aria-expanded", "true");
    }
  }

  /* ==========================================
     CLOSE SIDEBAR
  ========================================== */

  function closeSidebar() {
    const elements = getElements();

    if (elements.sidebar) {
      elements.sidebar.classList.remove("open");
    }

    if (elements.overlay) {
      elements.overlay.classList.remove("show");
    }

    document.body.classList.remove("sidebar-open");

    if (elements.toggle) {
      elements.toggle.setAttribute("aria-expanded", "false");
    }
  }

  /* ==========================================
     TOGGLE SIDEBAR
  ========================================== */

  function toggleSidebar() {
    const elements = getElements();

    if (!elements.sidebar) return;

    if (elements.sidebar.classList.contains("open")) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  /* ==========================================
     NAVIGATION ACTIVE STATE
  ========================================== */

  function setActiveNavigation(page) {
    const elements = getElements();

    if (!elements.navigation) return;

    const buttons = elements.navigation.querySelectorAll(
      "[data-page]"
    );

    buttons.forEach(function (button) {
      const isActive = button.dataset.page === page;

      button.classList.toggle("active", isActive);

      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });
  }

  /* ==========================================
     MOBILE MENU EVENTS
  ========================================== */

  function setupSidebarEvents() {
    const elements = getElements();

    if (elements.toggle) {
      elements.toggle.addEventListener(
        "click",
        toggleSidebar
      );
    }

    if (elements.overlay) {
      elements.overlay.addEventListener(
        "click",
        closeSidebar
      );
    }

    if (elements.navigation) {
      elements.navigation.addEventListener(
        "click",
        function (event) {
          const button = event.target.closest("[data-page]");

          if (!button) return;

          setActiveNavigation(button.dataset.page);

          /*
           * Close the mobile sidebar after selecting
           * a navigation item.
           */
          if (window.innerWidth <= 900) {
            closeSidebar();
          }
        }
      );
    }

    /*
     * Escape key closes the sidebar.
     */
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });

    /*
     * Remove the mobile overlay when returning
     * to desktop width.
     */
    window.addEventListener("resize", function () {
      if (window.innerWidth > 900) {
        closeSidebar();
      }
    });
  }

  /* ==========================================
     PUBLIC MODULE API
  ========================================== */

  Admin.sidebar = {
    open: openSidebar,
    close: closeSidebar,
    toggle: toggleSidebar,
    setActive: setActiveNavigation,
    init: setupSidebarEvents
  };

  /*
   * Allow the main admin controller to close
   * the sidebar without depending on this file's
   * internal functions.
   */
  Admin.closeSidebar = closeSidebar;

  /* ==========================================
     INITIALIZE
  ========================================== */

  function initialize() {
    setupSidebarEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
