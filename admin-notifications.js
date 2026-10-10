/* =========================================================
   mNEET ADMIN PANEL
   FILE 21: admin-notifications.js

   Features:
   - Create announcements
   - Global or course-specific notifications
   - Notification categories
   - Draft and published states
   - Edit, publish and delete
   - Persistent Firestore storage
   - Admin-only management

   Theme: Green + White
========================================================= */

(function () {
  "use strict";

  if (window.MNEETNotifications) return;

  const Notifications = {
    initialized: false,
    loading: false,
    saving: false,
    authorized: false,

    db: null,
    auth: null,
    currentUser: null,

    items: [],
    courses: [],

    filterStatus: "all",
    filterType: "all",
    searchText: "",

    editingId: null,

    pageSize: 20,
    currentPage: 1
  };

  const COLLECTION = "notifications";
  const STYLE_ID = "mneet-notifications-style";

  const TYPES = [
    {
      value: "general",
      label: "General Announcement"
    },
    {
      value: "course",
      label: "Course Announcement"
    },
    {
      value: "notes",
      label: "New Notes Released"
    },
    {
      value: "quiz",
      label: "New Quiz Released"
    },
    {
      value: "course_update",
      label: "Course Update"
    }
  ];

  /* =====================================================
     HELPERS
  ===================================================== */

  function byId(id) {
    return document.getElementById(id);
  }

  function text(input) {
    return String(input == null ? "" : input);
  }

  function normalize(input) {
    return text(input).trim().toLowerCase();
  }

  function escapeHTML(input) {
    return text(input)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function value(data, keys, fallback) {
    for (let i = 0; i < keys.length; i++) {
      const current = data ? data[keys[i]] : undefined;

      if (
        current !== undefined &&
        current !== null &&
        String(current).trim() !== ""
      ) {
        return current;
      }
    }

    return fallback == null ? "" : fallback;
  }

  function timestampValue(input) {
    if (!input) return 0;

    if (typeof input.toMillis === "function") {
      return input.toMillis();
    }

    if (input instanceof Date) {
      return input.getTime();
    }

    if (typeof input.seconds === "number") {
      return input.seconds * 1000;
    }

    const parsed = Date.parse(input);

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function formatDate(input) {
    const time = timestampValue(input);

    if (!time) return "—";

    try {
      return new Date(time).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (error) {
      return "—";
    }
  }

  function showMessage(message, type) {
    const box = byId("notificationsMessage");

    if (!box) return;

    box.textContent = message || "";
    box.hidden = !message;

    box.className = "mneet-notification-message";

    if (type === "error") {
      box.classList.add("message-error");
    } else if (type === "success") {
      box.classList.add("message-success");
    } else {
      box.classList.add("message-info");
    }
  }

  function hideMessage() {
    showMessage("", "");
  }

  function getTypeLabel(type) {
    const match = TYPES.find(function (item) {
      return item.value === type;
    });

    return match ? match.label : "General Announcement";
  }

  function getCourseName(courseId) {
    if (!courseId || courseId === "all") {
      return "All Students";
    }

    const course = Notifications.courses.find(function (item) {
      return item.id === courseId;
    });

    return course
      ? text(value(course, ["name", "title", "courseName"], "Course"))
      : "Course record unavailable";
  }

  function getStatus(item) {
    if (
      item.published === true ||
      normalize(item.status) === "published"
    ) {
      return "published";
    }

    return "draft";
  }

  function isAuthorized() {
    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized === "function"
    ) {
      return window.MNEETAdmin.isAdminAuthorized() === true;
    }

    return Notifications.authorized === true;
  }

  function makeTimestamp() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  }

  /* =====================================================
     CSS
  ===================================================== */

  function injectStyles() {
    if (byId(STYLE_ID)) return;

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #notificationsContent {
        color: #FFFFFF;
      }

      .mneet-notifications-wrap {
        width: 100%;
        color: #FFFFFF;
      }

      .mneet-notifications-heading {
        margin-bottom: 18px;
      }

      .mneet-notifications-heading h2 {
        margin: 0 0 8px;
        color: #FFFFFF;
        font-size: 24px;
        font-weight: 800;
      }

      .mneet-notifications-heading p {
        margin: 0;
        color: #D1D5DB;
        line-height: 1.6;
      }

      .mneet-notification-message {
        padding: 12px 14px;
        margin-bottom: 16px;
        border: 1px solid #28513A;
        border-radius: 10px;
        background: #0D2419;
        color: #FFFFFF;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .mneet-notification-message[hidden] {
        display: none !important;
      }

      .mneet-notification-panel {
        padding: 16px;
        margin-bottom: 18px;
        border: 1px solid #28513A;
        border-radius: 14px;
        background: #0D2419;
      }

      .mneet-notification-panel h3 {
        margin: 0 0 14px;
        color: #FFFFFF;
        font-size: 17px;
      }

      .mneet-notification-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }

      .mneet-notification-stat {
        min-width: 0;
        padding: 15px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #0D2419;
      }

      .mneet-notification-stat-label {
        margin-bottom: 8px;
        color: #D1D5DB;
        font-size: 13px;
      }

      .mneet-notification-stat-value {
        color: #FFFFFF;
        font-size: 25px;
        font-weight: 800;
      }

      .mneet-notification-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .mneet-notification-field {
        min-width: 0;
      }

      .mneet-notification-field.full {
        grid-column: 1 / -1;
      }

      .mneet-notification-field label {
        display: block;
        margin-bottom: 7px;
        color: #D1D5DB;
        font-size: 13px;
      }

      .mneet-notification-field input,
      .mneet-notification-field select,
      .mneet-notification-field textarea {
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 11px 12px;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #FFFFFF;
        outline: none;
        font: inherit;
      }

      .mneet-notification-field textarea {
        min-height: 140px;
        resize: vertical;
        line-height: 1.6;
      }

      .mneet-notification-field input:focus,
      .mneet-notification-field select:focus,
      .mneet-notification-field textarea:focus {
        border-color: #22C55E;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
      }

      .mneet-notification-field select option {
        background: #0D2419;
        color: #FFFFFF;
      }

      .mneet-notification-help {
        margin-top: 6px;
        color: #D1D5DB;
        font-size: 12px;
        line-height: 1.6;
      }

      .mneet-notification-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 16px;
      }

      .mneet-notification-button {
        min-height: 42px;
        padding: 10px 14px;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #FFFFFF;
        font-weight: 700;
        cursor: pointer;
      }

      .mneet-notification-button.primary {
        border-color: #16A34A;
        background: #16A34A;
      }

      .mneet-notification-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .mneet-notification-filters {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(150px, 1fr) minmax(150px, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }

      .mneet-notification-table-wrap {
        width: 100%;
        overflow-x: auto;
        border: 1px solid #28513A;
        border-radius: 12px;
      }

      .mneet-notification-table {
        width: 100%;
        min-width: 900px;
        border-collapse: collapse;
        color: #FFFFFF;
      }

      .mneet-notification-table th,
      .mneet-notification-table td {
        padding: 12px;
        border-bottom: 1px solid #28513A;
        text-align: left;
        vertical-align: top;
        font-size: 13px;
        line-height: 1.6;
      }

      .mneet-notification-table th {
        background: #10291D;
        color: #FFFFFF;
        white-space: nowrap;
        font-weight: 800;
      }

      .mneet-notification-table tbody tr:last-child td {
        border-bottom: none;
      }

      .mneet-notification-title {
        color: #FFFFFF;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .mneet-notification-sub {
        color: #D1D5DB;
        overflow-wrap: anywhere;
      }

      .mneet-notification-badge {
        display: inline-block;
        padding: 4px 8px;
        border: 1px solid #28513A;
        border-radius: 7px;
        background: #10291D;
        color: #FFFFFF;
        font-size: 12px;
        font-weight: 700;
      }

      .mneet-notification-badge.published {
        border-color: #16A34A;
        background: #16A34A;
        color: #FFFFFF;
      }

      .mneet-notification-row-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .mneet-notification-pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
      }

      .mneet-notification-pagination-info {
        color: #D1D5DB;
        font-size: 13px;
      }

      .mneet-notification-empty {
        padding: 28px 14px !important;
        text-align: center !important;
        color: #D1D5DB;
      }

      @media (max-width: 850px) {
        .mneet-notification-filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .mneet-notification-filters .search-field {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 520px) {
        .mneet-notification-panel {
          padding: 12px;
        }

        .mneet-notification-stats {
          grid-template-columns: 1fr;
        }

        .mneet-notification-form-grid {
          grid-template-columns: 1fr;
        }

        .mneet-notification-field.full {
          grid-column: auto;
        }

        .mneet-notification-filters {
          grid-template-columns: 1fr;
        }

        .mneet-notification-filters .search-field {
          grid-column: auto;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =====================================================
     UI LAYOUT
  ===================================================== */

  function renderLayout() {
    const container = byId("notificationsContent");

    if (!container) return false;

    injectStyles();

    container.innerHTML = `
      <div class="mneet-notifications-wrap">

        <div class="mneet-notifications-heading">
          <h2>Notifications & Announcements</h2>
          <p>
            Create and manage announcements for all students
            or for a specific course.
          </p>
        </div>

        <div id="notificationsMessage"
             class="mneet-notification-message"
             role="status"
             aria-live="polite"
             hidden></div>

        <div class="mneet-notification-stats">

          <div class="mneet-notification-stat">
            <div class="mneet-notification-stat-label">
              Total Notifications
            </div>
            <div id="notificationTotalCount"
                 class="mneet-notification-stat-value">0</div>
          </div>

          <div class="mneet-notification-stat">
            <div class="mneet-notification-stat-label">
              Published
            </div>
            <div id="notificationPublishedCount"
                 class="mneet-notification-stat-value">0</div>
          </div>

          <div class="mneet-notification-stat">
            <div class="mneet-notification-stat-label">
              Drafts
            </div>
            <div id="notificationDraftCount"
                 class="mneet-notification-stat-value">0</div>
          </div>

        </div>

        <div class="mneet-notification-panel">

          <h3 id="notificationFormHeading">
            Create Notification
          </h3>

          <form id="notificationForm">

            <div class="mneet-notification-form-grid">

              <div class="mneet-notification-field full">
                <label for="notificationTitle">
                  Notification Title
                </label>

                <input
                  id="notificationTitle"
                  type="text"
                  maxlength="150"
                  required
                  placeholder="Enter notification title">
              </div>

              <div class="mneet-notification-field">
                <label for="notificationType">
                  Notification Type
                </label>

                <select id="notificationType" required>
                  ${TYPES.map(function (item) {
                    return `
                      <option value="${escapeHTML(item.value)}">
                        ${escapeHTML(item.label)}
                      </option>
                    `;
                  }).join("")}
                </select>
              </div>

              <div class="mneet-notification-field">
                <label for="notificationCourse">
                  Audience / Course
                </label>

                <select id="notificationCourse">
                  <option value="all">All Students</option>
                </select>

                <div class="mneet-notification-help">
                  All Students নির্বাচন করলে Global Announcement হবে।
                </div>
              </div>

              <div class="mneet-notification-field full">
                <label for="notificationMessageText">
                  Notification Message
                </label>

                <textarea
                  id="notificationMessageText"
                  maxlength="5000"
                  required
                  placeholder="Write the complete announcement here..."></textarea>
              </div>

            </div>

            <div class="mneet-notification-actions">

              <button
                type="submit"
                id="notificationSaveDraft"
                class="mneet-notification-button">
                Save Draft
              </button>

              <button
                type="button"
                id="notificationPublishButton"
                class="mneet-notification-button primary">
                Publish Notification
              </button>

              <button
                type="button"
                id="notificationCancelEdit"
                class="mneet-notification-button"
                hidden>
                Cancel Edit
              </button>

              <button
                type="button"
                id="notificationResetForm"
                class="mneet-notification-button">
                Clear Form
              </button>

            </div>

          </form>

        </div>

        <div class="mneet-notification-panel">

          <h3>Saved Notifications</h3>

          <div class="mneet-notification-filters">

            <div class="mneet-notification-field search-field">
              <label for="notificationSearch">Search</label>
              <input
                id="notificationSearch"
                type="search"
                placeholder="Search title or message">
            </div>

            <div class="mneet-notification-field">
              <label for="notificationStatusFilter">
                Publication Status
              </label>

              <select id="notificationStatusFilter">
                <option value="all">All Statuses</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>

            <div class="mneet-notification-field">
              <label for="notificationTypeFilter">
                Notification Type
              </label>

              <select id="notificationTypeFilter">
                <option value="all">All Types</option>
                ${TYPES.map(function (item) {
                  return `
                    <option value="${escapeHTML(item.value)}">
                      ${escapeHTML(item.label)}
                    </option>
                  `;
                }).join("")}
              </select>
            </div>

          </div>

          <div class="mneet-notification-table-wrap">

            <table class="mneet-notification-table">

              <thead>
                <tr>
                  <th>Title / Message</th>
                  <th>Type</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Published</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody id="notificationsTableBody">
                <tr>
                  <td colspan="7" class="mneet-notification-empty">
                    Notifications will appear here.
                  </td>
                </tr>
              </tbody>

            </table>

          </div>

          <div class="mneet-notification-pagination">

            <div id="notificationPaginationInfo"
                 class="mneet-notification-pagination-info">
              No notifications loaded.
            </div>

            <div>
              <button
                type="button"
                id="notificationPrevPage"
                class="mneet-notification-button"
                disabled>
                Previous
              </button>

              <button
                type="button"
                id="notificationNextPage"
                class="mneet-notification-button primary"
                disabled>
                Next
              </button>
            </div>

          </div>

        </div>

      </div>
    `;

    return true;
  }

  /* =====================================================
     FIREBASE
  ===================================================== */

  function initializeFirebase() {
    const state = window.MNEETFirebase;

    if (
      state &&
      state.ready &&
      state.db &&
      state.auth
    ) {
      Notifications.db = state.db;
      Notifications.auth = state.auth;

      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.firestore === "function" &&
      typeof window.firebase.auth === "function"
    ) {
      Notifications.db = window.firebase.firestore();
      Notifications.auth = window.firebase.auth();

      return true;
    }

    showMessage(
      "Firebase initialize হয়নি। firebase.js ও Firebase SDK পরীক্ষা করো।",
      "error"
    );

    return false;
  }

  async function verifyAdmin() {
    const user = Notifications.auth
      ? Notifications.auth.currentUser
      : null;

    if (!user || !Notifications.db) {
      Notifications.authorized = false;
      return false;
    }

    try {
      const snapshot = await Notifications.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!snapshot.exists) {
        Notifications.authorized = false;
        return false;
      }

      const adminData = snapshot.data() || {};

      if (adminData.active !== true) {
        Notifications.authorized = false;
        return false;
      }

      Notifications.currentUser = user;
      Notifications.authorized = true;

      return true;

    } catch (error) {
      console.error("Notification admin verification failed:", error);

      Notifications.authorized = false;

      showMessage(
        "Admin verification ব্যর্থ হয়েছে। Firestore rules পরীক্ষা করো।",
        "error"
      );

      return false;
    }
  }

  async function readCollection(name) {
    const snapshot = await Notifications.db
      .collection(name)
      .get();

    return snapshot.docs.map(function (doc) {
      return Object.assign(
        { id: doc.id },
        doc.data() || {}
      );
    });
  }

  async function loadData() {
    if (Notifications.loading) return;

    if (!Notifications.db || !Notifications.auth) {
      if (!initializeFirebase()) return;
    }

    Notifications.loading = true;

    showMessage("Loading notifications...", "info");

    try {
      const authorized = await verifyAdmin();

      if (!authorized) {
        Notifications.items = [];
        Notifications.courses = [];

        renderTable();

        showMessage(
          "এই Section ব্যবহার করতে Active Admin Account দিয়ে Login করতে হবে।",
          "error"
        );

        return;
      }

      const results = await Promise.allSettled([
        readCollection(COLLECTION),
        readCollection("courses")
      ]);

      Notifications.items =
        results[0].status === "fulfilled"
          ? results[0].value
          : [];

      Notifications.courses =
        results[1].status === "fulfilled"
          ? results[1].value
          : [];

      populateCourseSelect();

      renderStatistics();
      renderTable();

      const failures = [];

      if (results[0].status === "rejected") {
        failures.push(COLLECTION);
      }

      if (results[1].status === "rejected") {
        failures.push("courses");
      }

      if (failures.length) {
        showMessage(
          "কিছু Data Load হয়নি: " +
            failures.join(", ") +
            ". Firestore rules পরীক্ষা করো।",
          "error"
        );
      } else {
        hideMessage();
      }

    } catch (error) {
      console.error("Notification loading error:", error);

      showMessage(
        "Notification load করা যায়নি। Firebase connection ও Firestore rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      Notifications.loading = false;
    }
  }

  /* =====================================================
     COURSE SELECT
  ===================================================== */

  function populateCourseSelect() {
    const select = byId("notificationCourse");

    if (!select) return;

    const previous = select.value || "all";

    select.innerHTML =
      '<option value="all">All Students</option>';

    Notifications.courses
      .slice()
      .sort(function (a, b) {
        return text(value(a, ["name", "title"], ""))
          .localeCompare(text(value(b, ["name", "title"], "")));
      })
      .forEach(function (course) {
        const option = document.createElement("option");

        option.value = course.id;

        option.textContent = text(
          value(course, ["name", "title", "courseName"], "Unnamed Course")
        );

        select.appendChild(option);
      });

    const valid = Array.from(select.options).some(function (option) {
      return option.value === previous;
    });

    select.value = valid ? previous : "all";
  }

  /* =====================================================
     FORM
  ===================================================== */

  function resetForm() {
    const form = byId("notificationForm");

    if (form) form.reset();

    Notifications.editingId = null;

    if (byId("notificationFormHeading")) {
      byId("notificationFormHeading").textContent =
        "Create Notification";
    }

    if (byId("notificationSaveDraft")) {
      byId("notificationSaveDraft").textContent =
        "Save Draft";
    }

    if (byId("notificationPublishButton")) {
      byId("notificationPublishButton").textContent =
        "Publish Notification";
    }

    if (byId("notificationCancelEdit")) {
      byId("notificationCancelEdit").hidden = true;
    }
  }

  function getFormData() {
    const title = text(
      byId("notificationTitle")
        ? byId("notificationTitle").value
        : ""
    ).trim();

    const message = text(
      byId("notificationMessageText")
        ? byId("notificationMessageText").value
        : ""
    ).trim();

    const type = text(
      byId("notificationType")
        ? byId("notificationType").value
        : "general"
    );

    const courseId = text(
      byId("notificationCourse")
        ? byId("notificationCourse").value
        : "all"
    );

    if (!title) {
      throw new Error("Notification Title লিখতে হবে।");
    }

    if (!message) {
      throw new Error("Notification Message লিখতে হবে।");
    }

    if (title.length > 150) {
      throw new Error("Title সর্বোচ্চ 150 characters হতে পারবে।");
    }

    if (message.length > 5000) {
      throw new Error("Message সর্বোচ্চ 5000 characters হতে পারবে।");
    }

    if (!TYPES.some(function (item) {
      return item.value === type;
    })) {
      throw new Error("Notification Type সঠিক নয়।");
    }

    if (
      courseId !== "all" &&
      !Notifications.courses.some(function (course) {
        return course.id === courseId;
      })
    ) {
      throw new Error("নির্বাচিত Course পাওয়া যায়নি।");
    }

    return {
      title: title,
      message: message,
      type: type,
      courseId: courseId,
      audience: courseId === "all" ? "all" : "course",
      courseName: getCourseName(courseId)
    };
  }

  async function saveNotification(publish) {
    if (Notifications.saving) return;

    if (!isAuthorized()) {
      showMessage(
        "Active Admin authorization প্রয়োজন।",
        "error"
      );

      return;
    }

    let formData;

    try {
      formData = getFormData();
    } catch (error) {
      showMessage(error.message, "error");
      return;
    }

    Notifications.saving = true;

    showMessage(
      publish
        ? "Publishing notification..."
        : "Saving draft...",
      "info"
    );

    try {
      const authorized = await verifyAdmin();

      if (!authorized) {
        throw new Error("Admin authorization failed.");
      }

      const now = makeTimestamp();

      const payload = {
        title: formData.title,
        message: formData.message,

        type: formData.type,

        courseId: formData.courseId,
        courseName: formData.courseName,

        audience: formData.audience,

        published: publish,
        status: publish ? "published" : "draft",

        updatedAt: now,
        updatedBy: Notifications.currentUser.uid
      };

      if (Notifications.editingId) {
        const existing = Notifications.items.find(function (item) {
          return item.id === Notifications.editingId;
        });

        if (!existing) {
          throw new Error("Notification record পাওয়া যায়নি।");
        }

        payload.createdAt =
          existing.createdAt || now;

        payload.createdBy =
          existing.createdBy || Notifications.currentUser.uid;

        if (publish) {
          payload.publishedAt =
            getStatus(existing) === "published"
              ? existing.publishedAt || now
              : now;

          payload.publishedBy =
            getStatus(existing) === "published"
              ? existing.publishedBy || Notifications.currentUser.uid
              : Notifications.currentUser.uid;
        } else {
          payload.publishedAt = null;
          payload.publishedBy = null;
        }

        await Notifications.db
          .collection(COLLECTION)
          .doc(Notifications.editingId)
          .update(payload);

      } else {
        payload.createdAt = now;
        payload.createdBy = Notifications.currentUser.uid;

        payload.publishedAt = publish ? now : null;
        payload.publishedBy = publish
          ? Notifications.currentUser.uid
          : null;

        await Notifications.db
          .collection(COLLECTION)
          .add(payload);
      }

      resetForm();

      showMessage(
        publish
          ? "Notification Published হয়েছে।"
          : "Notification Draft হিসেবে Save হয়েছে।",
        "success"
      );

      await loadData();

    } catch (error) {
      console.error("Notification save error:", error);

      showMessage(
        error.message ||
          "Notification Save করা যায়নি। Firestore rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      Notifications.saving = false;
    }
  }

  function editNotification(id) {
    if (!isAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    const item = Notifications.items.find(function (notification) {
      return notification.id === id;
    });

    if (!item) {
      showMessage("Notification পাওয়া যায়নি।", "error");
      return;
    }

    Notifications.editingId = id;

    byId("notificationTitle").value = text(item.title);
    byId("notificationMessageText").value = text(item.message);

    byId("notificationType").value =
      TYPES.some(function (type) {
        return type.value === item.type;
      })
        ? item.type
        : "general";

    byId("notificationCourse").value =
      item.courseId &&
      Array.from(byId("notificationCourse").options).some(
        function (option) {
          return option.value === item.courseId;
        }
      )
        ? item.courseId
        : "all";

    byId("notificationFormHeading").textContent =
      "Edit Notification";

    byId("notificationSaveDraft").textContent =
      "Update Draft";

    byId("notificationPublishButton").textContent =
      "Update & Publish";

    byId("notificationCancelEdit").hidden = false;

    byId("notificationForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  /* =====================================================
     PUBLISH / UNPUBLISH
  ===================================================== */

  async function togglePublication(id) {
    if (!isAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    if (Notifications.saving) return;

    const item = Notifications.items.find(function (notification) {
      return notification.id === id;
    });

    if (!item) {
      showMessage("Notification পাওয়া যায়নি।", "error");
      return;
    }

    const currentlyPublished = getStatus(item) === "published";

    const nextPublished = !currentlyPublished;

    const confirmation = nextPublished
      ? "এই Notification Publish করবে?"
      : "এই Notification Unpublish করে Draft করবে?";

    if (!window.confirm(confirmation)) {
      return;
    }

    Notifications.saving = true;

    try {
      const authorized = await verifyAdmin();

      if (!authorized) {
        throw new Error("Admin authorization failed.");
      }

      const payload = {
        published: nextPublished,
        status: nextPublished ? "published" : "draft",
        updatedAt: makeTimestamp(),
        updatedBy: Notifications.currentUser.uid
      };

      if (nextPublished) {
        payload.publishedAt = makeTimestamp();
        payload.publishedBy = Notifications.currentUser.uid;
      } else {
        payload.publishedAt = null;
        payload.publishedBy = null;
      }

      await Notifications.db
        .collection(COLLECTION)
        .doc(id)
        .update(payload);

      showMessage(
        nextPublished
          ? "Notification Published হয়েছে।"
          : "Notification Draft করা হয়েছে।",
        "success"
      );

      await loadData();

    } catch (error) {
      console.error("Notification publication update failed:", error);

      showMessage(
        "Notification Status পরিবর্তন করা যায়নি। Firestore rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      Notifications.saving = false;
    }
  }

  /* =====================================================
     DELETE
  ===================================================== */

  async function deleteNotification(id) {
    if (!isAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    if (Notifications.saving) return;

    const item = Notifications.items.find(function (notification) {
      return notification.id === id;
    });

    if (!item) {
      showMessage("Notification পাওয়া যায়নি।", "error");
      return;
    }

    if (!window.confirm(
      "এই Notification স্থায়ীভাবে Delete করবে?\n\n" +
      text(item.title)
    )) {
      return;
    }

    Notifications.saving = true;

    try {
      const authorized = await verifyAdmin();

      if (!authorized) {
        throw new Error("Admin authorization failed.");
      }

      await Notifications.db
        .collection(COLLECTION)
        .doc(id)
        .delete();

      if (Notifications.editingId === id) {
        resetForm();
      }

      showMessage("Notification Delete হয়েছে।", "success");

      await loadData();

    } catch (error) {
      console.error("Notification delete error:", error);

      showMessage(
        "Notification Delete করা যায়নি। Firestore rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      Notifications.saving = false;
    }
  }

  /* =====================================================
     STATISTICS
  ===================================================== */

  function renderStatistics() {
    const total = Notifications.items.length;

    const published = Notifications.items.filter(function (item) {
      return getStatus(item) === "published";
    }).length;

    const drafts = total - published;

    if (byId("notificationTotalCount")) {
      byId("notificationTotalCount").textContent = total;
    }

    if (byId("notificationPublishedCount")) {
      byId("notificationPublishedCount").textContent = published;
    }

    if (byId("notificationDraftCount")) {
      byId("notificationDraftCount").textContent = drafts;
    }
  }

  /* =====================================================
     FILTERS
  ===================================================== */

  function getFilteredItems() {
    const search = normalize(Notifications.searchText);

    return Notifications.items
      .filter(function (item) {
        if (
          Notifications.filterStatus !== "all" &&
          getStatus(item) !== Notifications.filterStatus
        ) {
          return false;
        }

        if (
          Notifications.filterType !== "all" &&
          item.type !== Notifications.filterType
        ) {
          return false;
        }

        const haystack = [
          item.title,
          item.message,
          item.courseName,
          item.type
        ].map(normalize).join(" ");

        if (search && !haystack.includes(search)) {
          return false;
        }

        return true;
      })
      .sort(function (a, b) {
        const aTime = timestampValue(
          value(a, ["publishedAt", "createdAt"], null)
        );

        const bTime = timestampValue(
          value(b, ["publishedAt", "createdAt"], null)
        );

        return bTime - aTime;
      });
  }

  /* =====================================================
     TABLE
  ===================================================== */

  function renderTable() {
    const body = byId("notificationsTableBody");

    if (!body) return;

    const filtered = getFilteredItems();

    const total = filtered.length;

    const pages = Math.max(
      1,
      Math.ceil(total / Notifications.pageSize)
    );

    if (Notifications.currentPage > pages) {
      Notifications.currentPage = pages;
    }

    const startIndex =
      (Notifications.currentPage - 1) *
      Notifications.pageSize;

    const pageItems = filtered.slice(
      startIndex,
      startIndex + Notifications.pageSize
    );

    if (!pageItems.length) {
      body.innerHTML = `
        <tr>
          <td colspan="7" class="mneet-notification-empty">
            No notifications found.
          </td>
        </tr>
      `;
    } else {
      body.innerHTML = pageItems.map(function (item) {
        const status = getStatus(item);

        const publishLabel = status === "published"
          ? "Unpublish"
          : "Publish";

        return `
          <tr>

            <td>
              <div class="mneet-notification-title">
                ${escapeHTML(item.title || "Untitled Notification")}
              </div>

              <div class="mneet-notification-sub">
                ${escapeHTML(item.message || "")}
              </div>
            </td>

            <td>
              ${escapeHTML(getTypeLabel(item.type))}
            </td>

            <td>
              ${escapeHTML(
                item.courseId
                  ? getCourseName(item.courseId)
                  : "All Students"
              )}
            </td>

            <td>
              <span class="mneet-notification-badge ${status}">
                ${status === "published" ? "Published" : "Draft"}
              </span>
            </td>

            <td>
              ${escapeHTML(formatDate(item.createdAt))}
            </td>

            <td>
              ${escapeHTML(formatDate(item.publishedAt))}
            </td>

            <td>
              <div class="mneet-notification-row-actions">

                <button
                  type="button"
                  class="mneet-notification-button"
                  data-notification-action="edit"
                  data-notification-id="${escapeHTML(item.id)}">
                  Edit
                </button>

                <button
                  type="button"
                  class="mneet-notification-button primary"
                  data-notification-action="toggle"
                  data-notification-id="${escapeHTML(item.id)}">
                  ${publishLabel}
                </button>

                <button
                  type="button"
                  class="mneet-notification-button"
                  data-notification-action="delete"
                  data-notification-id="${escapeHTML(item.id)}">
                  Delete
                </button>

              </div>
            </td>

          </tr>
        `;
      }).join("");
    }

    const first = total === 0 ? 0 : startIndex + 1;

    const last = Math.min(
      startIndex + Notifications.pageSize,
      total
    );

    if (byId("notificationPaginationInfo")) {
      byId("notificationPaginationInfo").textContent =
        "Showing " + first + "–" + last +
        " of " + total + " notifications";
    }

    if (byId("notificationPrevPage")) {
      byId("notificationPrevPage").disabled =
        Notifications.currentPage <= 1;
    }

    if (byId("notificationNextPage")) {
      byId("notificationNextPage").disabled =
        Notifications.currentPage >= pages;
    }

    renderStatistics();
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  function setupEvents() {
    const form = byId("notificationForm");

    const saveDraft = byId("notificationSaveDraft");
    const publish = byId("notificationPublishButton");

    const cancel = byId("notificationCancelEdit");
    const reset = byId("notificationResetForm");

    const search = byId("notificationSearch");
    const status = byId("notificationStatusFilter");
    const type = byId("notificationTypeFilter");

    const body = byId("notificationsTableBody");

    const previous = byId("notificationPrevPage");
    const next = byId("notificationNextPage");

    if (form) {
      form.addEventListener("submit", function (event) {
        event.preventDefault();

        saveNotification(false);
      });
    }

    if (saveDraft) {
      saveDraft.addEventListener("click", function () {
        saveNotification(false);
      });
    }

    if (publish) {
      publish.addEventListener("click", function () {
        saveNotification(true);
      });
    }

    if (cancel) {
      cancel.addEventListener("click", function () {
        resetForm();
        hideMessage();
      });
    }

    if (reset) {
      reset.addEventListener("click", function () {
        resetForm();
        hideMessage();
      });
    }

    if (search) {
      search.addEventListener("input", function () {
        Notifications.searchText = search.value;
        Notifications.currentPage = 1;

        renderTable();
      });
    }

    if (status) {
      status.addEventListener("change", function () {
        Notifications.filterStatus = status.value;
        Notifications.currentPage = 1;

        renderTable();
      });
    }

    if (type) {
      type.addEventListener("change", function () {
        Notifications.filterType = type.value;
        Notifications.currentPage = 1;

        renderTable();
      });
    }

    if (body) {
      body.addEventListener("click", function (event) {
        const button = event.target.closest(
          "[data-notification-action]"
        );

        if (!button) return;

        const action = button.dataset.notificationAction;
        const id = button.dataset.notificationId;

        if (action === "edit") {
          editNotification(id);
        } else if (action === "toggle") {
          togglePublication(id);
        } else if (action === "delete") {
          deleteNotification(id);
        }
      });
    }

    if (previous) {
      previous.addEventListener("click", function () {
        if (Notifications.currentPage > 1) {
          Notifications.currentPage--;
          renderTable();
        }
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        const total = getFilteredItems().length;

        const pages = Math.max(
          1,
          Math.ceil(total / Notifications.pageSize)
        );

        if (Notifications.currentPage < pages) {
          Notifications.currentPage++;
          renderTable();
        }
      });
    }
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  function initialize() {
    if (Notifications.initialized) {
      if (byId("notificationsContent")) {
        loadData();
      }

      return;
    }

    if (!byId("notificationsContent")) {
      return;
    }

    if (!renderLayout()) return;

    Notifications.initialized = true;

    setupEvents();

    if (!initializeFirebase()) return;

    loadData();
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.MNEETNotifications = {
    initialize: initialize,

    refresh: function () {
      return loadData();
    },

    getNotifications: function () {
      return Notifications.items.slice();
    },

    isAuthorized: function () {
      return isAuthorized();
    }
  };

  document.addEventListener("DOMContentLoaded", initialize);

  document.addEventListener("mneet:admin-page-change", function (event) {
    if (event.detail && event.detail.page === "notifications") {
      initialize();
    }
  });

})();
