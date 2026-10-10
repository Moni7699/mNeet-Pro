/* =========================================================
   mNEET — Common JavaScript Utilities
   File: common.js
   Purpose: Shared helpers for Admin and Student panels
   Theme: Green and White
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MNEETCommon) {
    return;
  }

  const CONFIG = Object.freeze({
    APP_NAME: "mNEET",
    DEFAULT_THEME: "dark",
    THEME_STORAGE_KEY: "mneet-theme",
    MESSAGE_TIMEOUT: 5000,
    MAX_FILE_SIZE_MB: 20
  });

  const messageTimers = new WeakMap();

  /* ---------------------------------------------------------
     1. BASIC UTILITIES
     --------------------------------------------------------- */

  function byId(id) {
    return typeof id === "string"
      ? document.getElementById(id)
      : null;
  }

  function query(selector, root) {
    try {
      return (root || document).querySelector(selector);
    } catch (error) {
      console.error("[mNEET] Invalid selector:", selector, error);
      return null;
    }
  }

  function queryAll(selector, root) {
    try {
      return Array.from(
        (root || document).querySelectorAll(selector)
      );
    } catch (error) {
      console.error("[mNEET] Invalid selector:", selector, error);
      return [];
    }
  }

  function getText(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || "";
    }

    const text = String(value).trim();

    return text || fallback || "";
  }

  function escapeHTML(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function safeNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : (fallback === undefined ? 0 : fallback);
  }

  function clamp(value, min, max) {
    const number = safeNumber(value, min);

    return Math.min(max, Math.max(min, number));
  }

  function debounce(callback, delay) {
    let timer = null;

    return function () {
      const context = this;
      const args = arguments;

      clearTimeout(timer);

      timer = setTimeout(function () {
        callback.apply(context, args);
      }, Math.max(0, safeNumber(delay, 0)));
    };
  }

  function throttle(callback, delay) {
    let lastCall = 0;
    let timer = null;

    return function () {
      const context = this;
      const args = arguments;
      const now = Date.now();
      const wait = Math.max(0, safeNumber(delay, 0));
      const remaining = wait - (now - lastCall);

      if (remaining <= 0) {
        clearTimeout(timer);
        timer = null;
        lastCall = now;
        callback.apply(context, args);
      } else if (!timer) {
        timer = setTimeout(function () {
          lastCall = Date.now();
          timer = null;
          callback.apply(context, args);
        }, remaining);
      }
    };
  }

  /* ---------------------------------------------------------
     2. SAFE LOCAL STORAGE
     --------------------------------------------------------- */

  const storage = {
    get: function (key, fallback) {
      try {
        const value = window.localStorage.getItem(key);

        return value === null
          ? (fallback === undefined ? null : fallback)
          : value;
      } catch (error) {
        console.warn("[mNEET] Local storage unavailable.");
        return fallback === undefined ? null : fallback;
      }
    },

    set: function (key, value) {
      try {
        window.localStorage.setItem(key, String(value));
        return true;
      } catch (error) {
        console.warn("[mNEET] Could not save local storage.");
        return false;
      }
    },

    remove: function (key) {
      try {
        window.localStorage.removeItem(key);
        return true;
      } catch (error) {
        return false;
      }
    },

    getJSON: function (key, fallback) {
      const raw = this.get(key, null);

      if (raw === null) {
        return fallback === undefined ? null : fallback;
      }

      try {
        return JSON.parse(raw);
      } catch (error) {
        return fallback === undefined ? null : fallback;
      }
    },

    setJSON: function (key, value) {
      try {
        return this.set(key, JSON.stringify(value));
      } catch (error) {
        return false;
      }
    }
  };

  /* ---------------------------------------------------------
     3. GREEN AND WHITE THEME HELPERS
     --------------------------------------------------------- */

  function getSavedTheme() {
    const savedTheme = storage.get(CONFIG.THEME_STORAGE_KEY, null);

    return savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : CONFIG.DEFAULT_THEME;
  }

  function applyTheme(theme, options) {
    const selectedTheme =
      theme === "light" ? "light" : "dark";

    const settings = options || {};

    document.documentElement.setAttribute(
      "data-theme",
      selectedTheme
    );

    if (document.body) {
      document.body.setAttribute("data-theme", selectedTheme);
    }

    if (settings.save !== false) {
      storage.set(CONFIG.THEME_STORAGE_KEY, selectedTheme);
    }

    queryAll("[data-theme-toggle]").forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        selectedTheme === "dark" ? "true" : "false"
      );

      button.setAttribute(
        "aria-label",
        selectedTheme === "dark"
          ? "Switch to light theme"
          : "Switch to dark theme"
      );
    });

    window.dispatchEvent(
      new CustomEvent("mneet:theme-changed", {
        detail: {
          theme: selectedTheme
        }
      })
    );

    return selectedTheme;
  }

  function toggleTheme() {
    const currentTheme =
      document.documentElement.getAttribute("data-theme") ||
      getSavedTheme();

    return applyTheme(
      currentTheme === "dark" ? "light" : "dark"
    );
  }

  /* ---------------------------------------------------------
     4. USER-FACING MESSAGES
     --------------------------------------------------------- */

  function showMessage(target, message, type, timeout) {
    const element =
      typeof target === "string" ? byId(target) : target;

    if (!element) {
      console.warn("[mNEET] Message container not found:", target);
      return false;
    }

    const messageType = [
      "success",
      "error",
      "warning",
      "info"
    ].includes(type) ? type : "info";

    if (messageTimers.has(element)) {
      clearTimeout(messageTimers.get(element));
      messageTimers.delete(element);
    }

    element.textContent = getText(message);
    element.hidden = false;
    element.setAttribute("role", "status");
    element.setAttribute("aria-live", "polite");
    element.dataset.messageType = messageType;

    element.classList.remove(
      "is-success",
      "is-error",
      "is-warning",
      "is-info"
    );

    element.classList.add("is-" + messageType);

    const duration = timeout === undefined
      ? CONFIG.MESSAGE_TIMEOUT
      : Math.max(0, safeNumber(timeout, 0));

    if (duration > 0) {
      const timer = setTimeout(function () {
        hideMessage(element);
      }, duration);

      messageTimers.set(element, timer);
    }

    return true;
  }

  function hideMessage(target) {
    const element =
      typeof target === "string" ? byId(target) : target;

    if (!element) {
      return false;
    }

    if (messageTimers.has(element)) {
      clearTimeout(messageTimers.get(element));
      messageTimers.delete(element);
    }

    element.hidden = true;
    element.textContent = "";
    delete element.dataset.messageType;

    element.classList.remove(
      "is-success",
      "is-error",
      "is-warning",
      "is-info"
    );

    return true;
  }

  /* ---------------------------------------------------------
     5. DATE AND NUMBER FORMATTING
     --------------------------------------------------------- */

  function formatDate(value, options) {
    if (!value) {
      return "—";
    }

    let date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value.toDate === "function") {
      date = value.toDate();
    } else if (
      typeof value === "object" &&
      typeof value.seconds === "number"
    ) {
      date = new Date(value.seconds * 1000);
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    try {
      return new Intl.DateTimeFormat(
        "en-IN",
        options || {
          day: "2-digit",
          month: "short",
          year: "numeric"
        }
      ).format(date);
    } catch (error) {
      return date.toLocaleDateString("en-IN");
    }
  }

  function formatDateTime(value) {
    return formatDate(value, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatCurrency(value, currency) {
    const amount = safeNumber(value, 0);

    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: currency || "INR",
        maximumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      return "₹" + amount.toFixed(2);
    }
  }

  function formatPercent(value, decimals) {
    const number = safeNumber(value, 0);
    const places = clamp(
      decimals === undefined ? 1 : decimals,
      0,
      4
    );

    return number.toFixed(places) + "%";
  }

  function formatDuration(totalSeconds) {
    let seconds = Math.max(
      0,
      Math.floor(safeNumber(totalSeconds, 0))
    );

    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;

    const minutes = Math.floor(seconds / 60);
    seconds %= 60;

    if (hours > 0) {
      return [
        String(hours).padStart(2, "0"),
        String(minutes).padStart(2, "0"),
        String(seconds).padStart(2, "0")
      ].join(":");
    }

    return [
      String(minutes).padStart(2, "0"),
      String(seconds).padStart(2, "0")
    ].join(":");
  }

  /* ---------------------------------------------------------
     6. BUTTON LOADING STATE
     --------------------------------------------------------- */

  function setButtonLoading(button, loading, loadingText) {
    const element =
      typeof button === "string" ? byId(button) : button;

    if (!element) {
      return false;
    }

    if (loading) {
      if (!element.dataset.originalText) {
        element.dataset.originalText =
          element.textContent.trim();
      }

      element.disabled = true;
      element.setAttribute("aria-busy", "true");

      if (loadingText) {
        element.textContent = loadingText;
      }
    } else {
      element.disabled = false;
      element.removeAttribute("aria-busy");

      if (element.dataset.originalText !== undefined) {
        element.textContent = element.dataset.originalText;
        delete element.dataset.originalText;
      }
    }

    return true;
  }

  /* ---------------------------------------------------------
     7. FIREBASE HELPERS
     --------------------------------------------------------- */

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.auth &&
      window.MNEETFirebase.db
    ) {
      return {
        auth: window.MNEETFirebase.auth,
        db: window.MNEETFirebase.db
      };
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      return {
        auth: window.firebase.auth(),
        db: window.firebase.firestore()
      };
    }

    return null;
  }

  function getCurrentUser() {
    const services = getFirebase();

    if (!services || !services.auth) {
      return null;
    }

    return services.auth.currentUser || null;
  }

  function serverTimestamp() {
    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore.FieldValue
    ) {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    return null;
  }

  /* ---------------------------------------------------------
     8. FILE VALIDATION
     --------------------------------------------------------- */

  function validateFile(file, options) {
    const settings = options || {};

    if (!file) {
      return {
        valid: false,
        message: "Please select a file."
      };
    }

    const allowedTypes = Array.isArray(settings.allowedTypes)
      ? settings.allowedTypes
      : [];

    if (
      allowedTypes.length > 0 &&
      !allowedTypes.includes(file.type)
    ) {
      return {
        valid: false,
        message: "This file type is not allowed."
      };
    }

    const maxSizeMB = Math.max(
      0,
      safeNumber(
        settings.maxSizeMB,
        CONFIG.MAX_FILE_SIZE_MB
      )
    );

    const maxBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxBytes) {
      return {
        valid: false,
        message: "File size must not exceed " +
          maxSizeMB + " MB."
      };
    }

    return {
      valid: true,
      message: "File is valid."
    };
  }

  /* ---------------------------------------------------------
     9. ACCESSIBLE MODAL HELPERS
     --------------------------------------------------------- */

  function openModal(modal) {
    const element =
      typeof modal === "string" ? byId(modal) : modal;

    if (!element) {
      return false;
    }

    element.hidden = false;
    element.setAttribute("aria-hidden", "false");

    document.body.classList.add("mneet-modal-open");

    const focusable = query(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      element
    );

    if (focusable) {
      focusable.focus();
    }

    return true;
  }

  function closeModal(modal) {
    const element =
      typeof modal === "string" ? byId(modal) : modal;

    if (!element) {
      return false;
    }

    element.hidden = true;
    element.setAttribute("aria-hidden", "true");

    const openModals = queryAll(
      '[role="dialog"], .mneet-modal'
    ).some(function (item) {
      return !item.hidden;
    });

    if (!openModals) {
      document.body.classList.remove("mneet-modal-open");
    }

    return true;
  }

  /* ---------------------------------------------------------
     10. EMPTY STATE AND LOADING HELPERS
     --------------------------------------------------------- */

  function renderEmptyState(container, message) {
    const element =
      typeof container === "string"
        ? byId(container)
        : container;

    if (!element) {
      return false;
    }

    element.replaceChildren();

    const wrapper = document.createElement("div");
    wrapper.className = "mn-empty-state";

    const paragraph = document.createElement("p");
    paragraph.textContent = getText(
      message,
      "No information available."
    );

    wrapper.appendChild(paragraph);
    element.appendChild(wrapper);

    return true;
  }

  function setLoading(container, loading, message) {
    const element =
      typeof container === "string"
        ? byId(container)
        : container;

    if (!element) {
      return false;
    }

    element.setAttribute(
      "aria-busy",
      loading ? "true" : "false"
    );

    if (loading) {
      const text = getText(message, "Loading...");

      element.replaceChildren();

      const wrapper = document.createElement("div");
      wrapper.className = "mn-loading-state";
      wrapper.setAttribute("role", "status");

      const spinner = document.createElement("span");
      spinner.className = "mn-spinner";
      spinner.setAttribute("aria-hidden", "true");

      const paragraph = document.createElement("p");
      paragraph.textContent = text;

      wrapper.appendChild(spinner);
      wrapper.appendChild(paragraph);
      element.appendChild(wrapper);
    }

    return true;
  }

  /* ---------------------------------------------------------
     11. EVENT HELPERS
     --------------------------------------------------------- */

  function emit(eventName, detail) {
    if (!eventName || typeof eventName !== "string") {
      return false;
    }

    document.dispatchEvent(
      new CustomEvent(eventName, {
        detail: detail || {}
      })
    );

    return true;
  }

  function onReady(callback) {
    if (typeof callback !== "function") {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        callback,
        { once: true }
      );
    } else {
      callback();
    }
  }

  /* ---------------------------------------------------------
     12. GLOBAL API
     --------------------------------------------------------- */

  window.MNEETCommon = Object.freeze({
    config: CONFIG,

    byId: byId,
    query: query,
    queryAll: queryAll,

    getText: getText,
    escapeHTML: escapeHTML,
    safeNumber: safeNumber,
    clamp: clamp,
    debounce: debounce,
    throttle: throttle,

    storage: storage,

    getSavedTheme: getSavedTheme,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,

    showMessage: showMessage,
    hideMessage: hideMessage,

    formatDate: formatDate,
    formatDateTime: formatDateTime,
    formatCurrency: formatCurrency,
    formatPercent: formatPercent,
    formatDuration: formatDuration,

    setButtonLoading: setButtonLoading,

    getFirebase: getFirebase,
    getCurrentUser: getCurrentUser,
    serverTimestamp: serverTimestamp,

    validateFile: validateFile,

    openModal: openModal,
    closeModal: closeModal,

    renderEmptyState: renderEmptyState,
    setLoading: setLoading,

    emit: emit,
    onReady: onReady
  });

  console.info("[mNEET] Common utilities loaded.");

})(window, document);
