/* =========================================================
   mNEET ADMIN SETTINGS
   File: admin-settings.js

   Requirements:
   - Admin-only settings management
   - Course defaults
   - Quiz marking and timer
   - Student sidebar social links
   - Persistent Firestore settings
   - Green and White colour combination
   ========================================================= */

(function () {
  "use strict";

  if (window.MNEETSettings) {
    return;
  }

  const SETTINGS = {
    collection: "settings",
    document: "general"
  };

  const DEFAULTS = {
    courseDefaults: {
      defaultActive: true
    },

    quizMarking: {
      correctMarks: 4,
      incorrectMarks: -1,
      skippedMarks: 0
    },

    quizTimer: {
      enabled: true,
      defaultQuestionTime: 60,
      reduceTimePerAttempt: 10,
      minimumQuestionTime: 10
    },

    socialLinks: {
      facebook: "",
      instagram: "",
      youtube: "",
      whatsapp: ""
    },

    updatedAt: null,
    updatedBy: ""
  };

  const STYLE = `
    .mneet-settings {
      color: #FFFFFF;
      width: 100%;
      max-width: 1100px;
      margin: 0 auto;
      padding: 16px;
      box-sizing: border-box;
    }

    .mneet-settings * {
      box-sizing: border-box;
    }

    .mneet-settings .settings-heading {
      margin-bottom: 22px;
    }

    .mneet-settings .settings-heading h2 {
      margin: 0 0 8px;
      color: #FFFFFF;
      font-size: 25px;
    }

    .mneet-settings .settings-heading p {
      margin: 0;
      color: #D1D5DB;
      line-height: 1.6;
    }

    .mneet-settings .settings-card {
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 15px;
      padding: 20px;
      margin-bottom: 18px;
    }

    .mneet-settings .settings-card h3 {
      margin: 0 0 8px;
      color: #FFFFFF;
      font-size: 19px;
    }

    .mneet-settings .settings-description {
      color: #D1D5DB;
      font-size: 13px;
      line-height: 1.6;
      margin: 0 0 18px;
    }

    .mneet-settings .settings-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }

    .mneet-settings .settings-field {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }

    .mneet-settings .settings-field label {
      color: #FFFFFF;
      font-size: 14px;
      font-weight: 600;
    }

    .mneet-settings .settings-field input,
    .mneet-settings .settings-field select {
      width: 100%;
      min-height: 45px;
      padding: 11px 12px;
      color: #FFFFFF;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 9px;
      outline: none;
      font-size: 14px;
    }

    .mneet-settings .settings-field input:focus,
    .mneet-settings .settings-field select:focus {
      border-color: #22C55E;
      box-shadow: 0 0 0 2px #16A34A;
    }

    .mneet-settings .settings-field input::placeholder {
      color: #D1D5DB;
    }

    .mneet-settings .settings-field select option {
      color: #FFFFFF;
      background: #0D2419;
    }

    .mneet-settings .settings-check {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #FFFFFF;
      font-size: 14px;
      margin-top: 10px;
    }

    .mneet-settings .settings-check input {
      width: 18px;
      height: 18px;
      accent-color: #16A34A;
    }

    .mneet-settings .settings-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 20px;
    }

    .mneet-settings .settings-button {
      border: 1px solid #16A34A;
      background: #16A34A;
      color: #FFFFFF;
      border-radius: 9px;
      padding: 12px 18px;
      min-height: 44px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
    }

    .mneet-settings .settings-button:hover {
      background: #22C55E;
    }

    .mneet-settings .settings-button.secondary {
      background: transparent;
      border-color: #28513A;
    }

    .mneet-settings .settings-button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .mneet-settings .settings-message {
      display: none;
      margin: 0 0 18px;
      padding: 12px;
      border: 1px solid #28513A;
      border-radius: 9px;
      color: #FFFFFF;
      background: #10291D;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .mneet-settings .settings-message.visible {
      display: block;
    }

    .mneet-settings .settings-info {
      color: #D1D5DB;
      font-size: 13px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .mneet-settings .settings-info strong {
      color: #FFFFFF;
    }

    .mneet-settings .settings-link {
      color: #22C55E;
      overflow-wrap: anywhere;
    }

    @media (max-width: 650px) {
      .mneet-settings {
        padding: 10px;
      }

      .mneet-settings .settings-grid {
        grid-template-columns: 1fr;
      }

      .mneet-settings .settings-card {
        padding: 15px;
      }

      .mneet-settings .settings-heading h2 {
        font-size: 22px;
      }

      .mneet-settings .settings-button {
        width: 100%;
      }
    }
  `;

  let db = null;
  let auth = null;
  let initialized = false;
  let saving = false;
  let loadedSettings = null;

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

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULTS));
  }

  function showMessage(message) {
    const box = byId("mneetSettingsMessage");

    if (!box) return;

    box.textContent = message;
    box.classList.add("visible");
  }

  function hideMessage() {
    const box = byId("mneetSettingsMessage");

    if (!box) return;

    box.textContent = "";
    box.classList.remove("visible");
  }

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.ready &&
      window.MNEETFirebase.db &&
      window.MNEETFirebase.auth
    ) {
      db = window.MNEETFirebase.db;
      auth = window.MNEETFirebase.auth;
      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.firestore === "function" &&
      typeof window.firebase.auth === "function"
    ) {
      db = window.firebase.firestore();
      auth = window.firebase.auth();
      return true;
    }

    return false;
  }

  async function verifyAdmin() {
    if (!getFirebase()) {
      throw new Error(
        "Firebase প্রস্তুত নয়। firebase.js ও Firebase SDK পরীক্ষা করো।"
      );
    }

    const user = auth.currentUser;

    if (!user) {
      throw new Error(
        "Admin হিসেবে Sign In করা নেই। আবার Sign In করো।"
      );
    }

    const adminSnapshot = await db
      .collection("admins")
      .doc(user.uid)
      .get();

    if (
      !adminSnapshot.exists ||
      adminSnapshot.data().active !== true
    ) {
      throw new Error(
        "এই অ্যাকাউন্টের Admin Permission নেই।"
      );
    }

    return user;
  }

  function getSettingsContainer() {
    return byId("settingsContent");
  }

  function injectStyles() {
    if (byId("mneetSettingsStyles")) return;

    const style = document.createElement("style");
    style.id = "mneetSettingsStyles";
    style.textContent = STYLE;

    document.head.appendChild(style);
  }

  function renderUI() {
    const container = getSettingsContainer();

    if (!container) {
      return false;
    }

    injectStyles();

    container.innerHTML = `
      <div class="mneet-settings">

        <div class="settings-heading">
          <h2>Admin Settings</h2>
          <p>
            mNEET-এর Course Defaults, Quiz Marking,
            Timer এবং Student Social Links পরিচালনা করো।
          </p>
        </div>

        <div
          id="mneetSettingsMessage"
          class="settings-message"
          role="status"
          aria-live="polite">
        </div>

        <form id="mneetSettingsForm">

          <section class="settings-card">
            <h3>Course Defaults</h3>

            <p class="settings-description">
              নতুন Course তৈরি করার সময় প্রাথমিক Active
              অবস্থা নির্ধারণ করো। এটি ভবিষ্যতের Course
              তৈরি করার জন্য একটি Default Preference।
            </p>

            <label class="settings-check">
              <input
                type="checkbox"
                id="settingsDefaultCourseActive">
              <span>নতুন Course ডিফল্টভাবে Active থাকবে</span>
            </label>

            <p class="settings-info">
              এই Default পরিবর্তন করলে আগে থেকে তৈরি
              Course-এর Active অবস্থা নিজে থেকে বদলাবে না।
            </p>
          </section>

          <section class="settings-card">
            <h3>Quiz Marking</h3>

            <p class="settings-description">
              সঠিক, ভুল এবং উত্তর না দেওয়া প্রশ্নের জন্য
              Default Marks নির্ধারণ করো।
            </p>

            <div class="settings-grid">

              <div class="settings-field">
                <label for="settingsCorrectMarks">
                  Correct Answer Marks
                </label>
                <input
                  type="number"
                  id="settingsCorrectMarks"
                  min="0"
                  max="100"
                  step="0.5"
                  required>
              </div>

              <div class="settings-field">
                <label for="settingsIncorrectMarks">
                  Incorrect Answer Marks
                </label>
                <input
                  type="number"
                  id="settingsIncorrectMarks"
                  min="-100"
                  max="0"
                  step="0.5"
                  required>
              </div>

              <div class="settings-field">
                <label for="settingsSkippedMarks">
                  Skipped Answer Marks
                </label>
                <input
                  type="number"
                  id="settingsSkippedMarks"
                  min="-100"
                  max="100"
                  step="0.5"
                  required>
              </div>

            </div>

            <p class="settings-info">
              এখানে Save করা Marks নতুন Quiz-এর Default
              Settings হিসেবে সংরক্ষিত হবে। Quiz চালানোর
              সময় এই Marks প্রয়োগ করতে Student Quiz Engine
              এবং সংশ্লিষ্ট Quiz Module-কে এই Settings পড়তে হবে।
            </p>
          </section>

          <section class="settings-card">
            <h3>Quiz Timer</h3>

            <p class="settings-description">
              প্রতি প্রশ্নের Default Time এবং পরবর্তী
              Attempt-এ সময় কত কমবে তা নির্ধারণ করো।
            </p>

            <label class="settings-check">
              <input
                type="checkbox"
                id="settingsTimerEnabled">
              <span>Quiz Question Timer চালু থাকবে</span>
            </label>

            <div class="settings-grid">

              <div class="settings-field">
                <label for="settingsQuestionTime">
                  Default Time per Question (Seconds)
                </label>
                <input
                  type="number"
                  id="settingsQuestionTime"
                  min="10"
                  max="3600"
                  step="1"
                  required>
              </div>

              <div class="settings-field">
                <label for="settingsAttemptReduction">
                  Time Reduction per Attempt (Seconds)
                </label>
                <input
                  type="number"
                  id="settingsAttemptReduction"
                  min="0"
                  max="300"
                  step="1"
                  required>
              </div>

              <div class="settings-field">
                <label for="settingsMinimumTime">
                  Minimum Question Time (Seconds)
                </label>
                <input
                  type="number"
                  id="settingsMinimumTime"
                  min="1"
                  max="3600"
                  step="1"
                  required>
              </div>

            </div>

            <p class="settings-info">
              Default Time 60 এবং Attempt Reduction 10 হলে
              সময় কমানোর নিয়ম হবে: ১ম Attempt 60 সেকেন্ড,
              ২য় Attempt 50 সেকেন্ড, ৩য় Attempt 40 সেকেন্ড।
              Minimum Time-এর নিচে সময় নামানো উচিত নয়।
              Quiz Engine-কে এই নিয়ম বাস্তবায়ন করতে হবে।
            </p>
          </section>

          <section class="settings-card">
            <h3>Student Sidebar Social Links</h3>

            <p class="settings-description">
              Student Panel-এর Sidebar-এ দেখানোর জন্য
              Social Media Links সংরক্ষণ করো।
            </p>

            <div class="settings-grid">

              <div class="settings-field">
                <label for="settingsFacebook">
                  Facebook URL
                </label>
                <input
                  type="url"
                  id="settingsFacebook"
                  placeholder="https://www.facebook.com/..."
                  autocomplete="url">
              </div>

              <div class="settings-field">
                <label for="settingsInstagram">
                  Instagram URL
                </label>
                <input
                  type="url"
                  id="settingsInstagram"
                  placeholder="https://www.instagram.com/..."
                  autocomplete="url">
              </div>

              <div class="settings-field">
                <label for="settingsYouTube">
                  YouTube URL
                </label>
                <input
                  type="url"
                  id="settingsYouTube"
                  placeholder="https://www.youtube.com/..."
                  autocomplete="url">
              </div>

              <div class="settings-field">
                <label for="settingsWhatsApp">
                  WhatsApp URL
                </label>
                <input
                  type="url"
                  id="settingsWhatsApp"
                  placeholder="https://wa.me/..."
                  autocomplete="url">
              </div>

            </div>

            <p class="settings-info">
              এখানে Link Save হবে। Student Sidebar-এ Link
              দেখানোর জন্য Student Panel-কে Firestore-এর
              এই Settings Document পড়তে হবে।
            </p>
          </section>

          <div class="settings-actions">

            <button
              type="submit"
              id="mneetSettingsSaveButton"
              class="settings-button">
              Save Settings
            </button>

            <button
              type="button"
              id="mneetSettingsReloadButton"
              class="settings-button secondary">
              Reload Saved Settings
            </button>

          </div>

        </form>

        <section class="settings-card" style="margin-top:22px">
          <h3>Firebase Security & Data Validation</h3>

          <p class="settings-info">
            <strong>Admin Access:</strong>
            Admin-এর অনুমতি অবশ্যই Firebase Security Rules
            দিয়ে যাচাই করতে হবে। শুধু Admin Panel-এ
            Button লুকিয়ে রাখলে নিরাপত্তা নিশ্চিত হয় না।
          </p>

          <p class="settings-info">
            <strong>Data Validation:</strong>
            Firestore Security Rules-এ অনুমোদিত Field,
            Data Type, Required Value এবং কে Read/Write
            করতে পারবে তা যাচাই করতে হবে।
          </p>

          <p class="settings-info">
            <strong>গুরুত্বপূর্ণ:</strong>
            এই ওয়েব পেজ Firebase Security Rules সরাসরি
            পরিবর্তন করে না। Rules পরিবর্তন করতে Firebase
            Console-এর Firestore Database → Rules অংশে
            যেতে হবে। Rules পরিবর্তনের আগে বর্তমান Rules
            পরীক্ষা করো, যাতে Student ও Admin-এর
            অনুমোদিত কাজ বন্ধ না হয়ে যায়।
          </p>
        </section>

        <p class="settings-info" id="mneetSettingsUpdatedAt"></p>

      </div>
    `;

    return true;
  }

  function readForm() {
    const courseActive = byId(
      "settingsDefaultCourseActive"
    ).checked;

    const timerEnabled = byId(
      "settingsTimerEnabled"
    ).checked;

    const correctMarks = Number(
      byId("settingsCorrectMarks").value
    );

    const incorrectMarks = Number(
      byId("settingsIncorrectMarks").value
    );

    const skippedMarks = Number(
      byId("settingsSkippedMarks").value
    );

    const questionTime = Number(
      byId("settingsQuestionTime").value
    );

    const attemptReduction = Number(
      byId("settingsAttemptReduction").value
    );

    const minimumTime = Number(
      byId("settingsMinimumTime").value
    );

    const socialLinks = {
      facebook: byId("settingsFacebook").value.trim(),
      instagram: byId("settingsInstagram").value.trim(),
      youtube: byId("settingsYouTube").value.trim(),
      whatsapp: byId("settingsWhatsApp").value.trim()
    };

    if (
      !Number.isFinite(correctMarks) ||
      correctMarks < 0 ||
      correctMarks > 100
    ) {
      throw new Error(
        "Correct Answer Marks 0 থেকে 100-এর মধ্যে দাও।"
      );
    }

    if (
      !Number.isFinite(incorrectMarks) ||
      incorrectMarks < -100 ||
      incorrectMarks > 0
    ) {
      throw new Error(
        "Incorrect Answer Marks -100 থেকে 0-এর মধ্যে দাও।"
      );
    }

    if (
      !Number.isFinite(skippedMarks) ||
      skippedMarks < -100 ||
      skippedMarks > 100
    ) {
      throw new Error(
        "Skipped Answer Marks -100 থেকে 100-এর মধ্যে দাও।"
      );
    }

    if (
      !Number.isInteger(questionTime) ||
      questionTime < 10 ||
      questionTime > 3600
    ) {
      throw new Error(
        "Question Time 10 থেকে 3600 সেকেন্ডের মধ্যে দাও।"
      );
    }

    if (
      !Number.isInteger(attemptReduction) ||
      attemptReduction < 0 ||
      attemptReduction > 300
    ) {
      throw new Error(
        "Attempt Time Reduction 0 থেকে 300 সেকেন্ডের মধ্যে দাও।"
      );
    }

    if (
      !Number.isInteger(minimumTime) ||
      minimumTime < 1 ||
      minimumTime > 3600
    ) {
      throw new Error(
        "Minimum Question Time 1 থেকে 3600 সেকেন্ডের মধ্যে দাও।"
      );
    }

    if (minimumTime > questionTime) {
      throw new Error(
        "Minimum Question Time, Default Question Time-এর চেয়ে বেশি হতে পারবে না।"
      );
    }

    Object.keys(socialLinks).forEach(function (key) {
      const value = socialLinks[key];

      if (!value) return;

      let parsed;

      try {
        parsed = new URL(value);
      } catch (error) {
        throw new Error(
          key + " Link সঠিক URL নয়।"
        );
      }

      if (
        parsed.protocol !== "https:" &&
        parsed.protocol !== "http:"
      ) {
        throw new Error(
          key + " Link অবশ্যই HTTP বা HTTPS URL হতে হবে।"
        );
      }
    });

    return {
      courseDefaults: {
        defaultActive: courseActive
      },

      quizMarking: {
        correctMarks: correctMarks,
        incorrectMarks: incorrectMarks,
        skippedMarks: skippedMarks
      },

      quizTimer: {
        enabled: timerEnabled,
        defaultQuestionTime: questionTime,
        reduceTimePerAttempt: attemptReduction,
        minimumQuestionTime: minimumTime
      },

      socialLinks: socialLinks
    };
  }

  function fillForm(data) {
    const defaults = cloneDefaults();

    const source = data || {};

    const courseDefaults = Object.assign(
      {},
      defaults.courseDefaults,
      source.courseDefaults || {}
    );

    const quizMarking = Object.assign(
      {},
      defaults.quizMarking,
      source.quizMarking || {}
    );

    const quizTimer = Object.assign(
      {},
      defaults.quizTimer,
      source.quizTimer || {}
    );

    const socialLinks = Object.assign(
      {},
      defaults.socialLinks,
      source.socialLinks || {}
    );

    byId("settingsDefaultCourseActive").checked =
      courseDefaults.defaultActive === true;

    byId("settingsCorrectMarks").value =
      quizMarking.correctMarks;

    byId("settingsIncorrectMarks").value =
      quizMarking.incorrectMarks;

    byId("settingsSkippedMarks").value =
      quizMarking.skippedMarks;

    byId("settingsTimerEnabled").checked =
      quizTimer.enabled === true;

    byId("settingsQuestionTime").value =
      quizTimer.defaultQuestionTime;

    byId("settingsAttemptReduction").value =
      quizTimer.reduceTimePerAttempt;

    byId("settingsMinimumTime").value =
      quizTimer.minimumQuestionTime;

    byId("settingsFacebook").value =
      socialLinks.facebook || "";

    byId("settingsInstagram").value =
      socialLinks.instagram || "";

    byId("settingsYouTube").value =
      socialLinks.youtube || "";

    byId("settingsWhatsApp").value =
      socialLinks.whatsapp || "";

    const updatedAt = byId("mneetSettingsUpdatedAt");

    if (updatedAt) {
      if (source.updatedAt) {
        let date = null;

        if (
          typeof source.updatedAt.toDate === "function"
        ) {
          date = source.updatedAt.toDate();
        } else if (source.updatedAt instanceof Date) {
          date = source.updatedAt;
        }

        updatedAt.textContent = date
          ? "Last Updated: " + date.toLocaleString()
          : "Settings saved.";
      } else {
        updatedAt.textContent =
          "এখনও কোনো Settings Save করা হয়নি।";
      }
    }
  }

  async function loadSettings() {
    hideMessage();

    const user = await verifyAdmin();

    const snapshot = await db
      .collection(SETTINGS.collection)
      .doc(SETTINGS.document)
      .get();

    if (snapshot.exists) {
      loadedSettings = snapshot.data();
      fillForm(loadedSettings);
    } else {
      loadedSettings = cloneDefaults();
      fillForm(loadedSettings);
    }

    if (user) {
      showMessage(
        snapshot.exists
          ? "Saved Settings Firebase থেকে Load হয়েছে।"
          : "প্রথমবার Settings দেখানো হচ্ছে। পরিবর্তন করলে Save Settings চাপো।"
      );
    }
  }

  async function saveSettings(event) {
    if (event) {
      event.preventDefault();
    }

    if (saving) return;

    hideMessage();

    const button = byId("mneetSettingsSaveButton");

    try {
      saving = true;

      if (button) {
        button.disabled = true;
        button.textContent = "Saving...";
      }

      const user = await verifyAdmin();
      const formData = readForm();

      const payload = Object.assign(
        {},
        formData,
        {
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: user.uid
        }
      );

      await db
        .collection(SETTINGS.collection)
        .doc(SETTINGS.document)
        .set(payload, { merge: true });

      loadedSettings = payload;

      showMessage(
        "Settings সফলভাবে Firebase Firestore-এ Save হয়েছে।"
      );

      await loadSettings();

    } catch (error) {
      console.error(
        "mNEET settings save error:",
        error
      );

      showMessage(
        error && error.message
          ? error.message
          : "Settings Save করা যায়নি। Firebase Rules ও Connection পরীক্ষা করো।"
      );

    } finally {
      saving = false;

      if (button) {
        button.disabled = false;
        button.textContent = "Save Settings";
      }
    }
  }

  function setupEvents() {
    const form = byId("mneetSettingsForm");
    const reloadButton = byId(
      "mneetSettingsReloadButton"
    );

    if (form) {
      form.addEventListener("submit", saveSettings);
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", function () {
        loadSettings().catch(function (error) {
          console.error(error);

          showMessage(
            error && error.message
              ? error.message
              : "Saved Settings Load করা যায়নি।"
          );
        });
      });
    }
  }

  async function initialize() {
    if (initialized) return;

    const container = getSettingsContainer();

    if (!container) return;

    const rendered = renderUI();

    if (!rendered) return;

    initialized = true;

    setupEvents();

    try {
      await loadSettings();
    } catch (error) {
      console.error(
        "mNEET settings initialization error:",
        error
      );

      showMessage(
        error && error.message
          ? error.message
          : "Settings Load করা যায়নি।"
      );
    }
  }

  function resetInitialization() {
    const container = getSettingsContainer();

    if (container && !container.querySelector("#mneetSettingsForm")) {
      initialized = false;
    }
  }

  window.MNEETSettings = Object.freeze({
    initialize: initialize,

    reload: function () {
      return loadSettings();
    },

    getSavedSettings: function () {
      return loadedSettings;
    }
  });

  document.addEventListener("DOMContentLoaded", function () {
    initialize();
  });

  document.addEventListener(
    "mneet:admin-page-change",
    function (event) {
      const page = event.detail && event.detail.page;

      if (page === "settings") {
        resetInitialization();
        initialize();
      }
    }
  );

})();
