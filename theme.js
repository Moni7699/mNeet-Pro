/* =========================================================
   mNEET — Theme Manager
   File: theme.js

   Requirements:
   - Green and White colour combination only
   - Dark and Light modes
   - Remember user's selected theme
   - Compatible with Admin and Student panels
   - Do not modify existing authentication or panel logic
   ========================================================= */

(function (window, document) {
  "use strict";

  /* Prevent duplicate initialization. */
  if (window.MNEETTheme) {
    return;
  }

  const THEME_KEY = "mneet-theme";

  const THEMES = Object.freeze({
    DARK: "dark",
    LIGHT: "light"
  });

  const state = {
    current: THEMES.DARK,
    initialized: false
  };

  /* ---------------------------------------------------------
     STORAGE
     --------------------------------------------------------- */

  function readSavedTheme() {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);

      if (saved === THEMES.DARK || saved === THEMES.LIGHT) {
        return saved;
      }
    } catch (error) {
      console.warn(
        "[mNEET Theme] Could not read saved theme."
      );
    }

    return THEMES.DARK;
  }

  function saveTheme(theme) {
    try {
      window.localStorage.setItem(THEME_KEY, theme);
      return true;
    } catch (error) {
      console.warn(
        "[mNEET Theme] Could not save theme preference."
      );

      return false;
    }
  }

  /* ---------------------------------------------------------
     THEME VALIDATION
     --------------------------------------------------------- */

  function normalizeTheme(theme) {
    return theme === THEMES.LIGHT
      ? THEMES.LIGHT
      : THEMES.DARK;
  }

  function getCurrentTheme() {
    return state.current;
  }

  function isDarkMode() {
    return state.current === THEMES.DARK;
  }

  function isLightMode() {
    return state.current === THEMES.LIGHT;
  }

  /* ---------------------------------------------------------
     UPDATE THEME BUTTONS
     --------------------------------------------------------- */

  function updateThemeButtons() {
    const buttons = document.querySelectorAll(
      "[data-theme-toggle], #studentThemeToggle, #adminThemeToggle"
    );

    buttons.forEach(function (button) {
      const darkMode = state.current === THEMES.DARK;

      button.setAttribute(
        "aria-pressed",
        darkMode ? "true" : "false"
      );

      button.setAttribute(
        "aria-label",
        darkMode
          ? "Switch to light mode"
          : "Switch to dark mode"
      );

      button.setAttribute(
        "title",
        darkMode ? "Light Mode" : "Dark Mode"
      );

      /*
       * Update only explicitly designated theme labels.
       * Do not replace the entire button content, because
       * existing buttons may contain icons or other elements.
       */
      const label = button.querySelector(
        "[data-theme-label]"
      );

      if (label) {
        label.textContent = darkMode
          ? "Light Mode"
          : "Dark Mode";
      }

      const icon = button.querySelector(
        "[data-theme-icon]"
      );

      if (icon) {
        icon.textContent = darkMode ? "☀" : "☾";
      }
    });
  }

  /* ---------------------------------------------------------
     APPLY THEME
     --------------------------------------------------------- */

  function applyTheme(theme, options) {
    const selectedTheme = normalizeTheme(theme);
    const settings = options || {};

    const previousTheme = state.current;

    state.current = selectedTheme;

    /*
     * common.css uses data-theme="dark" and data-theme="light".
     * Apply the attribute to both documentElement and body
     * for compatibility with the existing CSS selectors.
     */
    document.documentElement.setAttribute(
      "data-theme",
      selectedTheme
    );

    if (document.body) {
      document.body.setAttribute(
        "data-theme",
        selectedTheme
      );
    }

    updateThemeButtons();

    if (settings.save !== false) {
      saveTheme(selectedTheme);
    }

    /*
     * Notify other modules without directly changing
     * Admin, Student, authentication or navigation logic.
     */
    if (previousTheme !== selectedTheme || settings.forceEvent) {
      window.dispatchEvent(
        new CustomEvent("mneet:theme-changed", {
          detail: {
            theme: selectedTheme,
            previousTheme: previousTheme
          }
        })
      );
    }

    return selectedTheme;
  }

  /* ---------------------------------------------------------
     TOGGLE THEME
     --------------------------------------------------------- */

  function toggleTheme() {
    const nextTheme = isDarkMode()
      ? THEMES.LIGHT
      : THEMES.DARK;

    return applyTheme(nextTheme);
  }

  /* ---------------------------------------------------------
     THEME BUTTON EVENTS
     --------------------------------------------------------- */

  function bindThemeButtons() {
    const buttons = document.querySelectorAll(
      "[data-theme-toggle], #studentThemeToggle, #adminThemeToggle"
    );

    buttons.forEach(function (button) {
      /*
       * Prevent duplicate click listeners if initialization
       * is called more than once.
       */
      if (button.dataset.mneetThemeBound === "true") {
        return;
      }

      button.dataset.mneetThemeBound = "true";

      button.addEventListener("click", function (event) {
        event.preventDefault();
        toggleTheme();
      });
    });

    updateThemeButtons();
  }

  /* ---------------------------------------------------------
     SUPPORT BUTTONS ADDED AFTER PAGE LOAD
     --------------------------------------------------------- */

  function observeNewThemeButtons() {
    if (!("MutationObserver" in window)) {
      return;
    }

    const observer = new MutationObserver(function () {
      bindThemeButtons();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  /* ---------------------------------------------------------
     INITIALIZATION
     --------------------------------------------------------- */

  function initialize() {
    if (state.initialized) {
      bindThemeButtons();
      return state.current;
    }

    state.initialized = true;

    /*
     * Restore the saved theme.
     * Dark Mode is the default when no valid preference exists.
     */
    applyTheme(readSavedTheme(), {
      save: false,
      forceEvent: true
    });

    bindThemeButtons();
    observeNewThemeButtons();

    return state.current;
  }

  /* ---------------------------------------------------------
     PUBLIC API
     --------------------------------------------------------- */

  window.MNEETTheme = Object.freeze({
    themes: THEMES,

    initialize: initialize,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,

    getCurrentTheme: getCurrentTheme,
    isDarkMode: isDarkMode,
    isLightMode: isLightMode,

    bindThemeButtons: bindThemeButtons
  });

  /*
   * Initialize after the document is ready.
   */
  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})(window, document);
