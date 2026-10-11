(function () {
  "use strict";

  if (window.MNEETAdminSidebar) return;

  const Sidebar = {
    initialized: false,

    open: function () {
      document.body.classList.add("sidebar-open");

      const button = document.getElementById("sidebarToggle");

      if (button) {
        button.setAttribute("aria-expanded", "true");
      }
    },

    close: function () {
      document.body.classList.remove("sidebar-open");

      const button = document.getElementById("sidebarToggle");

      if (button) {
        button.setAttribute("aria-expanded", "false");
      }
    },

    toggle: function () {
      if (document.body.classList.contains("sidebar-open")) {
        Sidebar.close();
      } else {
        Sidebar.open();
      }
    },

    showPage: function (pageName) {
      const target = document.getElementById(
        "section-" + pageName
      );

      if (!target) {
        console.warn(
          "mNEET Admin: section পাওয়া যায়নি:",
          pageName
        );
        return false;
      }

      document.querySelectorAll(".admin-section").forEach(
        function (section) {
          section.hidden = true;
        }
      );

      target.hidden = false;

      document.querySelectorAll(
        "#adminNavigation [data-section]"
      ).forEach(function (button) {
        const active =
          button.dataset.section === pageName;

        button.classList.toggle("active", active);

        if (active) {
          button.setAttribute("aria-current", "page");
        } else {
          button.removeAttribute("aria-current");
        }
      });

      Sidebar.close();

      document.dispatchEvent(
        new CustomEvent("mneet:admin-page-change", {
          detail: { page: pageName }
        })
      );

      return true;
    },

    init: function () {
      if (Sidebar.initialized) return;

      if (
        !document.getElementById("adminNavigation") ||
        !document.getElementById("adminSidebar")
      ) {
        return;
      }

      Sidebar.initialized = true;
    }
  };

  window.MNEETAdminSidebar = Sidebar;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      Sidebar.init,
      { once: true }
    );
  } else {
    Sidebar.init();
  }
})();
