/* =========================================================
   mNEET — Student Settings
   File: student-settings.js

   Features:
   - Student account settings
   - Exam target and preparation information
   - Dark / light theme preference
   - Notification preferences
   - Email password-reset request
   - Account information
   - Save settings to the student's own Firestore document
   - No access to Admin settings
   - No payment approval or course unlocking
   - Green and White design system
   ========================================================= */

(function (window, document) {
  "use strict";

  const MODULE_NAME = "MNEETStudentSettings";

  const COLLECTIONS = Object.freeze({
    USERS: "users",
    SETTINGS: "studentSettings"
  });

  const DEFAULT_SETTINGS = Object.freeze({
    theme: "dark",
    emailNotifications: true,
    courseNotifications: true,
    quizNotifications: true,
    announcementNotifications: true
  });

  const ALLOWED_TARGETS = [
    "NEET 2027",
    "NEET 2028",
    "Other"
  ];

  const state = {
    initialized: false,
    loading: false,
    saving: false,

    user: null,
    db: null,
    auth: null,

    profile: {},
    settings: Object.assign({}, DEFAULT_SETTINGS),

    error: "",
    lastUpdated: null
  };

  let refreshPromise = null;
  let eventsBound = false;

  /* =======================================================
     1. FIREBASE
     ======================================================= */

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

    throw new Error(
      "Firebase চালু নেই। Firebase SDK ও firebase.js পরীক্ষা করো।"
    );
  }

  /* =======================================================
     2. HELPERS
     ======================================================= */

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return String(value == null ? "" : value)
      .trim()
      .toLowerCase();
  }

  function showMessage(message, type) {
    const element =
      byId("studentSettingsMessage") ||
      byId("studentMessage");

    if (!element) {
      return;
    }

    element.textContent = String(message || "");
    element.hidden = !message;

    element.classList.remove(
      "is-success",
      "is-error",
      "is-warning",
      "is-info"
    );

    if (type === "success") {
      element.classList.add("is-success");
    } else if (type === "error") {
      element.classList.add("is-error");
    } else if (type === "warning") {
      element.classList.add("is-warning");
    } else {
      element.classList.add("is-info");
    }
  }

  function getErrorMessage(error) {
    const code = String(error && error.code || "");

    if (code.includes("permission-denied")) {
      return "Settings save করার অনুমতি নেই। Firebase Rules পরীক্ষা করতে হবে।";
    }

    if (code.includes("unauthenticated")) {
      return "Login session শেষ হয়েছে। আবার Login করো।";
    }

    if (code.includes("network-request-failed")) {
      return "Internet connection পরীক্ষা করে আবার চেষ্টা করো।";
    }

    if (code.includes("requires-recent-login")) {
      return "এই কাজের জন্য আবার Login করতে হবে।";
    }

    return error && error.message
      ? error.message
      : "একটি সমস্যা হয়েছে। আবার চেষ্টা করো।";
  }

  function getCurrentTheme() {
    try {
      const stored = localStorage.getItem("mneet-theme");

      if (stored === "light" || stored === "dark") {
        return stored;
      }
    } catch (error) {
      // Continue to the document theme.
    }

    const root = document.documentElement;

    if (
      root.dataset.theme === "light" ||
      root.classList.contains("light-theme")
    ) {
      return "light";
    }

    return "dark";
  }

  function isBoolean(value) {
    return typeof value === "boolean";
  }

  /* =======================================================
     3. LOAD PROFILE AND SETTINGS
     ======================================================= */

  async function loadProfile() {
    if (!state.user) {
      return {};
    }

    const doc = await state.db
      .collection(COLLECTIONS.USERS)
      .doc(state.user.uid)
      .get();

    return doc.exists ? doc.data() : {};
  }

  async function loadSettings() {
    if (!state.user) {
      return Object.assign({}, DEFAULT_SETTINGS);
    }

    const doc = await state.db
      .collection(COLLECTIONS.SETTINGS)
      .doc(state.user.uid)
      .get();

    const saved = doc.exists ? doc.data() : {};

    return {
      theme:
        saved.theme === "light" || saved.theme === "dark"
          ? saved.theme
          : getCurrentTheme(),

      emailNotifications: isBoolean(saved.emailNotifications)
        ? saved.emailNotifications
        : DEFAULT_SETTINGS.emailNotifications,

      courseNotifications: isBoolean(saved.courseNotifications)
        ? saved.courseNotifications
        : DEFAULT_SETTINGS.courseNotifications,

      quizNotifications: isBoolean(saved.quizNotifications)
        ? saved.quizNotifications
        : DEFAULT_SETTINGS.quizNotifications,

      announcementNotifications: isBoolean(
        saved.announcementNotifications
      )
        ? saved.announcementNotifications
        : DEFAULT_SETTINGS.announcementNotifications
    };
  }

  /* =======================================================
     4. THEME
     ======================================================= */

  function applyTheme(theme) {
    const selectedTheme = theme === "light" ? "light" : "dark";

    state.settings.theme = selectedTheme;

    try {
      localStorage.setItem("mneet-theme", selectedTheme);
    } catch (error) {
      // Theme can still be applied to the current page.
    }

    /*
     * Prefer the shared theme controller when available.
     */

    if (
      window.MNEETTheme &&
      typeof window.MNEETTheme.applyTheme === "function"
    ) {
      try {
        window.MNEETTheme.applyTheme(selectedTheme);
      } catch (error) {
        // Use the document fallback below.
      }
    } else {
      document.documentElement.dataset.theme = selectedTheme;

      document.documentElement.classList.toggle(
        "light-theme",
        selectedTheme === "light"
      );

      document.documentElement.classList.toggle(
        "dark-theme",
        selectedTheme === "dark"
      );

      document.body.classList.toggle(
        "light-theme",
        selectedTheme === "light"
      );

      document.body.classList.toggle(
        "dark-theme",
        selectedTheme === "dark"
      );
    }

    document.dispatchEvent(
      new CustomEvent("mneet:student-theme-changed", {
        detail: {
          theme: selectedTheme
        }
      })
    );
  }

  /* =======================================================
     5. SAVE SETTINGS
     ======================================================= */

  function readSettingsForm() {
    const themeInput = byId("studentSettingTheme");

    const emailInput = byId("studentSettingEmailNotifications");

    const courseInput = byId("studentSettingCourseNotifications");

    const quizInput = byId("studentSettingQuizNotifications");

    const announcementInput = byId(
      "studentSettingAnnouncementNotifications"
    );

    const nextSettings = {
      theme: themeInput
        ? themeInput.value
        : state.settings.theme,

      emailNotifications: emailInput
        ? emailInput.checked
        : state.settings.emailNotifications,

      courseNotifications: courseInput
        ? courseInput.checked
        : state.settings.courseNotifications,

      quizNotifications: quizInput
        ? quizInput.checked
        : state.settings.quizNotifications,

      announcementNotifications: announcementInput
        ? announcementInput.checked
        : state.settings.announcementNotifications
    };

    if (
      nextSettings.theme !== "dark" &&
      nextSettings.theme !== "light"
    ) {
      throw new Error("Theme selection সঠিক নয়।");
    }

    return nextSettings;
  }

  async function saveSettings() {
    if (!state.user || !state.db) {
      showMessage("প্রথমে Login করো।", "error");
      return false;
    }

    if (state.saving) {
      return false;
    }

    state.saving = true;

    const saveButton = byId("studentSettingsSaveButton");

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";
    }

    try {
      const nextSettings = readSettingsForm();

      /*
       * Save only to this student's own settings document.
       * Never write to Admin settings or course settings.
       */

      await state.db
        .collection(COLLECTIONS.SETTINGS)
        .doc(state.user.uid)
        .set(
          Object.assign({}, nextSettings, {
            updatedAt:
              window.firebase.firestore.FieldValue.serverTimestamp()
          }),
          { merge: true }
        );

      state.settings = nextSettings;

      applyTheme(nextSettings.theme);

      state.lastUpdated = new Date();

      showMessage(
        "তোমার Settings সফলভাবে save হয়েছে।",
        "success"
      );

      return true;
    } catch (error) {
      state.error = getErrorMessage(error);
      showMessage(state.error, "error");

      return false;
    } finally {
      state.saving = false;

      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "Save Settings";
      }
    }
  }

  /* =======================================================
     6. SAVE EXAM TARGET
     ======================================================= */

  async function saveExamTarget() {
    if (!state.user || !state.db) {
      showMessage("প্রথমে Login করো।", "error");
      return false;
    }

    const targetInput = byId("studentSettingExamTarget");

    if (!targetInput) {
      showMessage(
        "Exam Target field পাওয়া যায়নি।",
        "error"
      );

      return false;
    }

    const target = targetInput.value.trim();

    if (!target) {
      showMessage("Exam Target নির্বাচন করো।", "error");
      return false;
    }

    if (!ALLOWED_TARGETS.includes(target)) {
      showMessage("Exam Target সঠিক নয়।", "error");
      return false;
    }

    try {
      await state.db
        .collection(COLLECTIONS.USERS)
        .doc(state.user.uid)
        .set(
          {
            target: target,
            examTarget: target,
            updatedAt:
              window.firebase.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

      state.profile.target = target;
      state.profile.examTarget = target;

      showMessage(
        "তোমার Exam Target save হয়েছে।",
        "success"
      );

      return true;
    } catch (error) {
      state.error = getErrorMessage(error);
      showMessage(state.error, "error");

      return false;
    }
  }

  /* =======================================================
     7. PASSWORD RESET EMAIL
     ======================================================= */

  async function sendPasswordReset() {
    if (!state.user || !state.auth) {
      showMessage("প্রথমে Login করো।", "error");
      return false;
    }

    const email = String(
      state.user.email || ""
    ).trim();

    if (!email) {
      showMessage(
        "Account email পাওয়া যায়নি। Profile পরীক্ষা করো।",
        "error"
      );

      return false;
    }

    const button = byId("studentSettingsPasswordResetButton");

    if (button) {
      button.disabled = true;
      button.textContent = "Sending...";
    }

    try {
      await state.auth.sendPasswordResetEmail(email);

      showMessage(
        "Password reset link তোমার account email-এ পাঠানো হয়েছে। Inbox ও Spam folder পরীক্ষা করো।",
        "success"
      );

      return true;
    } catch (error) {
      state.error = getErrorMessage(error);
      showMessage(state.error, "error");

      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Send Password Reset Email";
      }
    }
  }

  /* =======================================================
     8. STYLE
     ======================================================= */

  function injectStyles() {
    if (byId("mneetStudentSettingsStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "mneetStudentSettingsStyles";

    style.textContent = `
      .mneet-settings {
        padding: 16px;
        color: var(--mn-text, #FFFFFF);
        background: var(--mn-bg, #071A12);
        border-radius: 16px;
      }

      .mneet-settings * {
        box-sizing: border-box;
      }

      .mneet-settings-muted {
        color: var(--mn-text-secondary, #D1D5DB);
        line-height: 1.55;
        font-size: .9rem;
      }

      .mneet-settings-card {
        padding: 16px;
        margin: 14px 0;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 13px;
        background: var(--mn-card, #0D2419);
      }

      .mneet-settings-card h3 {
        margin-top: 0;
      }

      .mneet-settings-field {
        margin: 14px 0;
      }

      .mneet-settings-field label {
        display: block;
        margin-bottom: 7px;
        font-weight: 600;
      }

      .mneet-settings-input,
      .mneet-settings-select {
        width: 100%;
        min-height: 42px;
        padding: 10px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        color: var(--mn-text, #FFFFFF);
        background: var(--mn-input-bg, #10291D);
        font: inherit;
      }

      .mneet-settings-input[readonly] {
        opacity: .8;
      }

      .mneet-settings-toggle {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid var(--mn-border, #28513A);
      }

      .mneet-settings-toggle:last-child {
        border-bottom: 0;
      }

      .mneet-settings-toggle label {
        margin: 0;
        line-height: 1.5;
      }

      .mneet-settings-toggle input {
        width: 20px;
        height: 20px;
        accent-color: var(--mn-primary, #16A34A);
        flex-shrink: 0;
      }

      .mneet-settings-button {
        width: 100%;
        min-height: 42px;
        padding: 11px 14px;
        border: 1px solid var(--mn-primary, #16A34A);
        border-radius: 9px;
        color: #FFFFFF;
        background: var(--mn-primary, #16A34A);
        font: inherit;
        cursor: pointer;
      }

      .mneet-settings-button:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .mneet-settings-secondary {
        background: var(--mn-card, #0D2419);
        border-color: var(--mn-border, #28513A);
      }

      .mneet-settings-actions {
        display: grid;
        gap: 10px;
        margin-top: 16px;
      }

      .mneet-settings-note {
        padding: 12px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        color: var(--mn-text-secondary, #D1D5DB);
        line-height: 1.6;
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     9. RENDER
     ======================================================= */

  function getHost() {
    return (
      byId("studentSettingsContent") ||
      byId("studentSettingsPageContent") ||
      byId("studentPageSettings")
    );
  }

  function render() {
    injectStyles();

    const host = getHost();

    if (!host) {
      return false;
    }

    if (!state.user) {
      host.innerHTML = `
        <section class="mneet-settings">
          <p class="mneet-settings-muted">
            Settings দেখতে Student account দিয়ে Login করো।
          </p>
        </section>
      `;

      return true;
    }

    const profile = state.profile || {};

    const email = state.user.email || profile.email || "";

    const name =
      profile.name ||
      profile.fullName ||
      state.user.displayName ||
      "";

    const phone = profile.phone || "";

    const target =
      profile.target ||
      profile.examTarget ||
      "";

    const settings = state.settings;

    const targetOptions = [
      ["", "Select Exam Target"],
      ["NEET 2027", "NEET 2027"],
      ["NEET 2028", "NEET 2028"],
      ["Other", "Other"]
    ];

    host.innerHTML = `
      <section class="mneet-settings">
        <h2>Settings</h2>

        <p class="mneet-settings-muted">
          তোমার account preferences পরিচালনা করো।
          Admin-এর course ও examination rules এখানে পরিবর্তন করা যাবে না।
        </p>

        <section class="mneet-settings-card">
          <h3>Account Information</h3>

          <div class="mneet-settings-field">
            <label for="studentSettingName">Full Name</label>
            <input
              id="studentSettingName"
              class="mneet-settings-input"
              value="${escapeHTML(name)}"
              readonly>
          </div>

          <div class="mneet-settings-field">
            <label for="studentSettingEmail">Email</label>
            <input
              id="studentSettingEmail"
              class="mneet-settings-input"
              type="email"
              value="${escapeHTML(email)}"
              readonly>
          </div>

          <div class="mneet-settings-field">
            <label for="studentSettingPhone">Phone Number</label>
            <input
              id="studentSettingPhone"
              class="mneet-settings-input"
              value="${escapeHTML(phone)}"
              readonly>
          </div>

          <p class="mneet-settings-muted">
            Name, email, phone এবং profile photo পরিবর্তন করতে Profile section ব্যবহার করো।
          </p>
        </section>

        <section class="mneet-settings-card">
          <h3>Exam Target</h3>

          <div class="mneet-settings-field">
            <label for="studentSettingExamTarget">
              Target Examination
            </label>

            <select
              id="studentSettingExamTarget"
              class="mneet-settings-select">

              ${targetOptions.map(function (option) {
                return `
                  <option
                    value="${escapeHTML(option[0])}"
                    ${target === option[0] ? "selected" : ""}>
                    ${escapeHTML(option[1])}
                  </option>
                `;
              }).join("")}

            </select>
          </div>

          <button
            type="button"
            id="studentSettingsTargetSaveButton"
            class="mneet-settings-button">
            Save Exam Target
          </button>
        </section>

        <section class="mneet-settings-card">
          <h3>Appearance</h3>

          <div class="mneet-settings-field">
            <label for="studentSettingTheme">Theme</label>

            <select
              id="studentSettingTheme"
              class="mneet-settings-select">

              <option value="dark"
                ${settings.theme === "dark" ? "selected" : ""}>
                Dark Mode
              </option>

              <option value="light"
                ${settings.theme === "light" ? "selected" : ""}>
                Light Mode
              </option>
            </select>
          </div>

          <p class="mneet-settings-muted">
            Theme preference এই account-এর জন্য save করা হবে।
          </p>
        </section>

        <section class="mneet-settings-card">
          <h3>Notification Preferences</h3>

          <div class="mneet-settings-toggle">
            <label for="studentSettingEmailNotifications">
              Email Notifications
            </label>

            <input
              id="studentSettingEmailNotifications"
              type="checkbox"
              ${settings.emailNotifications ? "checked" : ""}>
          </div>

          <div class="mneet-settings-toggle">
            <label for="studentSettingCourseNotifications">
              Course Updates
            </label>

            <input
              id="studentSettingCourseNotifications"
              type="checkbox"
              ${settings.courseNotifications ? "checked" : ""}>
          </div>

          <div class="mneet-settings-toggle">
            <label for="studentSettingQuizNotifications">
              Quiz and Practice Updates
            </label>

            <input
              id="studentSettingQuizNotifications"
              type="checkbox"
              ${settings.quizNotifications ? "checked" : ""}>
          </div>

          <div class="mneet-settings-toggle">
            <label for="studentSettingAnnouncementNotifications">
              Announcements
            </label>

            <input
              id="studentSettingAnnouncementNotifications"
              type="checkbox"
              ${settings.announcementNotifications ? "checked" : ""}>
          </div>

          <p class="mneet-settings-muted">
            এই preferences save হবে। Email বা push notifications
            বাস্তবে পাঠাতে notification delivery system-এ এগুলো
            আলাদাভাবে প্রয়োগ করতে হবে।
          </p>
        </section>

        <section class="mneet-settings-card">
          <h3>Password & Security</h3>

          <p class="mneet-settings-muted">
            Password পরিবর্তন বা recovery করতে তোমার account email-এ
            password reset link পাঠানো হবে।
          </p>

          <button
            type="button"
            id="studentSettingsPasswordResetButton"
            class="mneet-settings-button mneet-settings-secondary">
            Send Password Reset Email
          </button>
        </section>

        <section class="mneet-settings-card">
          <h3>Save Preferences</h3>

          <p class="mneet-settings-note">
            Course price, payment approval, answer keys, quiz marking
            এবং exam timer Admin-এর নিয়ন্ত্রণে থাকবে।
          </p>

          <div class="mneet-settings-actions">
            <button
              type="button"
              id="studentSettingsSaveButton"
              class="mneet-settings-button">
              Save Settings
            </button>
          </div>
        </section>

        <p class="mneet-settings-muted">
          ${
            state.lastUpdated
              ? "Last updated: " +
                escapeHTML(state.lastUpdated.toLocaleString("en-IN"))
              : ""
          }
        </p>
      </section>
    `;

    return true;
  }

  /* =======================================================
     10. EVENTS
     ======================================================= */

  async function handleClick(event) {
    const saveButton = event.target.closest(
      "#studentSettingsSaveButton"
    );

    if (saveButton) {
      await saveSettings();
      return;
    }

    const targetButton = event.target.closest(
      "#studentSettingsTargetSaveButton"
    );

    if (targetButton) {
      await saveExamTarget();
      return;
    }

    const passwordButton = event.target.closest(
      "#studentSettingsPasswordResetButton"
    );

    if (passwordButton) {
      await sendPasswordReset();
    }
  }

  function handleThemeChange(event) {
    if (event.target.id !== "studentSettingTheme") {
      return;
    }

    applyTheme(event.target.value);
  }

  /* =======================================================
     11. REFRESH
     ======================================================= */

  async function refresh() {
    if (refreshPromise) {
      return refreshPromise;
    }

    refreshPromise = (async function () {
      state.loading = true;
      state.error = "";

      try {
        const services = getFirebase();

        state.auth = services.auth;
        state.db = services.db;
        state.user = services.auth.currentUser;

        if (!state.user) {
          state.profile = {};
          state.settings = Object.assign(
            {},
            DEFAULT_SETTINGS
          );

          render();

          return false;
        }

        const results = await Promise.all([
          loadProfile(),
          loadSettings()
        ]);

        state.profile = results[0];
        state.settings = results[1];

        state.lastUpdated = new Date();

        applyTheme(state.settings.theme);

        render();

        return true;
      } catch (error) {
        state.error = getErrorMessage(error);
        showMessage(state.error, "error");

        render();

        return false;
      } finally {
        state.loading = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  /* =======================================================
     12. INITIALIZE
     ======================================================= */

  function initialize() {
    if (state.initialized) {
      return refresh();
    }

    state.initialized = true;

    injectStyles();

    if (!eventsBound) {
      eventsBound = true;

      document.addEventListener("click", handleClick);
      document.addEventListener("change", handleThemeChange);

      document.addEventListener(
        "mneet:student-ready",
        refresh
      );

      document.addEventListener(
        "mneet:student-page-change",
        function (event) {
          const detail = event.detail || {};

          const page = String(
            detail.page ||
            detail.pageName ||
            ""
          ).toLowerCase();

          if (page.includes("setting")) {
            refresh();
          }
        }
      );
    }

    return refresh();
  }

  /* =======================================================
     13. PUBLIC API
     ======================================================= */

  window[MODULE_NAME] = Object.freeze({
    initialize: initialize,
    refresh: refresh,
    render: render,

    saveSettings: saveSettings,
    saveExamTarget: saveExamTarget,
    sendPasswordReset: sendPasswordReset,
    applyTheme: applyTheme,

    getProfile: function () {
      return Object.assign({}, state.profile);
    },

    getSettings: function () {
      return Object.assign({}, state.settings);
    },

    getState: function () {
      return {
        initialized: state.initialized,
        loading: state.loading,
        saving: state.saving,
        error: state.error,
        lastUpdated: state.lastUpdated
      };
    },

    getLastError: function () {
      return state.error;
    }
  });

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
