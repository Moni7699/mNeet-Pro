/* ==========================================================
   mNEET — FILE 40
   Student Notifications
   Read / Unread / Unread Count
   Firebase Firestore
   Green + White Theme
   ========================================================== */

(function () {
  "use strict";

  const COLLECTIONS = {
    notifications: "notifications",
    purchases: "purchases",
    courses: "courses",
    reads: "studentNotificationReads"
  };

  const APPROVED_STATUSES = [
    "approved",
    "paid",
    "completed"
  ];

  const state = {
    user: null,
    profile: null,
    notifications: [],
    purchases: [],
    courses: [],
    readIds: new Set(),
    activeFilter: "all",
    selectedNotification: null,
    loading: false,
    initialized: false,
    error: null,
    unreadCount: 0
  };

  const CSS = `
    .mneet-student-notifications {
      width: 100%;
      padding: 14px;
      box-sizing: border-box;
      color: #FFFFFF;
      background: #071A12;
      border-radius: 16px;
    }

    .mneet-student-notifications *,
    .mneet-student-notifications *::before,
    .mneet-student-notifications *::after {
      box-sizing: border-box;
    }

    .mneet-sn-card {
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 14px;
    }

    .mneet-student-notifications h2,
    .mneet-student-notifications h3 {
      color: #FFFFFF;
      line-height: 1.45;
      margin-top: 0;
    }

    .mneet-student-notifications p {
      color: #D1D5DB;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .mneet-sn-summary {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .mneet-sn-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      min-height: 30px;
      padding: 5px 10px;
      color: #FFFFFF;
      background: #16A34A;
      border-radius: 999px;
      font-weight: 800;
    }

    .mneet-sn-filters {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }

    .mneet-sn-filter,
    .mneet-sn-button {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 40px;
      padding: 9px 12px;
      color: #FFFFFF;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 10px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }

    .mneet-sn-filter[aria-pressed="true"],
    .mneet-sn-button-primary {
      background: #16A34A;
      border-color: #16A34A;
    }

    .mneet-sn-button:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    .mneet-sn-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .mneet-sn-item {
      width: 100%;
      padding: 14px;
      text-align: left;
      color: #FFFFFF;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 12px;
      cursor: pointer;
    }

    .mneet-sn-item-unread {
      border-left: 4px solid #22C55E;
    }

    .mneet-sn-item-title {
      font-size: 15px;
      font-weight: 800;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .mneet-sn-item-message {
      color: #D1D5DB;
      font-size: 13px;
      line-height: 1.7;
      margin-top: 7px;
      overflow-wrap: anywhere;
    }

    .mneet-sn-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      color: #D1D5DB;
      font-size: 12px;
      margin-top: 10px;
    }

    .mneet-sn-status {
      display: inline-block;
      padding: 4px 8px;
      color: #FFFFFF;
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 800;
    }

    .mneet-sn-status-unread {
      background: #16A34A;
      border-color: #16A34A;
    }

    .mneet-sn-detail-message {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.9;
      color: #FFFFFF;
    }

    .mneet-sn-empty {
      padding: 22px;
      text-align: center;
      color: #D1D5DB;
      background: #0D2419;
      border: 1px dashed #28513A;
      border-radius: 12px;
      line-height: 1.8;
    }

    .mneet-sn-error {
      padding: 14px;
      color: #FFFFFF;
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 12px;
      line-height: 1.8;
      overflow-wrap: anywhere;
    }

    @media (min-width: 760px) {
      .mneet-student-notifications {
        padding: 22px;
      }

      .mneet-sn-list {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  function addStyles() {
    if (document.getElementById("mneetStudentNotificationsCSS")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "mneetStudentNotificationsCSS";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.db &&
      window.MNEETFirebase.auth
    ) {
      return {
        db: window.MNEETFirebase.db,
        auth: window.MNEETFirebase.auth
      };
    }

    if (
      typeof firebase !== "undefined" &&
      firebase.apps &&
      firebase.apps.length
    ) {
      return {
        db: firebase.firestore(),
        auth: firebase.auth()
      };
    }

    throw new Error("Firebase connection পাওয়া যায়নি।");
  }

  function getStudentAPI() {
    return window.MNEETStudent || null;
  }

  function getCurrentUser() {
    const api = getStudentAPI();

    if (api && typeof api.getCurrentUser === "function") {
      const user = api.getCurrentUser();
      if (user) return user;
    }

    try {
      return getFirebase().auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  function getContainer() {
    const ids = [
      "studentNotificationsContent",
      "studentNotificationsPageContent",
      "studentPageNotifications",
      "studentNotificationList",
      "studentNotificationsList",
      "studentPageNotificationContent"
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) return element;
    }

    return null;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getId(item) {
    return String(item && item.id ? item.id : "");
  }

  function getCourseId(item) {
    return String(
      item.courseId ||
      item.courseID ||
      item.parentCourseId ||
      ""
    );
  }

  function getUserId(item) {
    return String(
      item.userId ||
      item.studentId ||
      item.uid ||
      ""
    );
  }

  function getStatus(item) {
    return String(
      item.status ||
      item.paymentStatus ||
      item.approvalStatus ||
      ""
    ).toLowerCase();
  }

  function isApproved(purchase) {
    return APPROVED_STATUSES.includes(getStatus(purchase));
  }

  function toMillis(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }

    if (typeof value.seconds === "number") {
      return value.seconds * 1000;
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value === "number") {
      return value;
    }

    const parsed = Date.parse(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatDate(value) {
    const millis = toMillis(value);

    if (!millis) return "তারিখ পাওয়া যায়নি";

    try {
      return new Intl.DateTimeFormat("bn-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }).format(new Date(millis));
    } catch (_) {
      return new Date(millis).toLocaleString();
    }
  }

  function getNotificationType(item) {
    return String(item.type || "general").toLowerCase();
  }

  function getTypeLabel(type) {
    const labels = {
      general: "General",
      course: "Course",
      notes: "Notes",
      quiz: "Quiz",
      course_update: "Course Update"
    };

    return labels[type] || "General";
  }

  function isPublished(item) {
    if (item.published === false) return false;

    if (String(item.status || "").toLowerCase() === "draft") {
      return false;
    }

    return true;
  }

  function getApprovedCourseIds() {
    const ids = new Set();

    state.purchases.forEach(purchase => {
      if (!isApproved(purchase)) return;

      const courseId = getCourseId(purchase);

      if (courseId) ids.add(courseId);
    });

    const api = getStudentAPI();

    if (
      ids.size === 0 &&
      api &&
      typeof api.getPurchasedCourses === "function"
    ) {
      (api.getPurchasedCourses() || []).forEach(course => {
        if (typeof course === "string") {
          ids.add(course);
          return;
        }

        const id = getId(course) || course.courseId;

        if (id) ids.add(String(id));
      });
    }

    return ids;
  }

  function notificationIsVisible(item) {
    if (!isPublished(item)) return false;

    const audience = String(
      item.audience || "all"
    ).toLowerCase();

    const uid = state.user ? state.user.uid : "";

    const courseId = getCourseId(item);
    const approvedCourseIds = getApprovedCourseIds();

    /*
      General/all announcements are visible to signed-in students.
      Course-specific announcements require approved course access.
    */
    if (
      audience === "all" ||
      audience === "students" ||
      audience === "student"
    ) {
      if (courseId) {
        return approvedCourseIds.has(courseId);
      }

      return true;
    }

    if (
      audience === "course" ||
      audience === "purchased_course"
    ) {
      return Boolean(
        courseId && approvedCourseIds.has(courseId)
      );
    }

    if (
      audience === "specific_user" ||
      audience === "user"
    ) {
      return getUserId(item) === uid;
    }

    if (audience === "specific_users") {
      return Array.isArray(item.userIds) &&
        item.userIds.includes(uid);
    }

    return false;
  }

  async function readCollection(name) {
    const snapshot = await getFirebase()
      .db.collection(name).get();

    const result = [];

    snapshot.forEach(doc => {
      result.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return result;
  }

  async function readOwnPurchases(uid) {
    const snapshot = await getFirebase()
      .db.collection(COLLECTIONS.purchases)
      .where("userId", "==", uid)
      .get();

    const result = [];

    snapshot.forEach(doc => {
      result.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return result;
  }

  async function readOwnReadStates(uid) {
    const snapshot = await getFirebase()
      .db.collection(COLLECTIONS.reads)
      .where("userId", "==", uid)
      .get();

    const ids = new Set();

    snapshot.forEach(doc => {
      const data = doc.data() || {};

      if (
        data.userId === uid &&
        data.read === true &&
        data.notificationId
      ) {
        ids.add(String(data.notificationId));
      }
    });

    return ids;
  }

  async function loadData() {
    const user = getCurrentUser();

    if (!user) {
      throw new Error("Notifications দেখতে আগে Sign In করো।");
    }

    state.user = user;
    state.loading = true;
    state.error = null;

    try {
      const [
        notifications,
        purchases,
        courses,
        readIds
      ] = await Promise.all([
        readCollection(COLLECTIONS.notifications),
        readOwnPurchases(user.uid),
        readCollection(COLLECTIONS.courses),
        readOwnReadStates(user.uid)
      ]);

      state.notifications = notifications.filter(
        notificationIsVisible
      );

      state.purchases = purchases;
      state.courses = courses;
      state.readIds = readIds;

      state.notifications.sort((a, b) => {
        const dateA = toMillis(
          a.publishedAt || a.createdAt || a.updatedAt
        );

        const dateB = toMillis(
          b.publishedAt || b.createdAt || b.updatedAt
        );

        return dateB - dateA;
      });

      updateUnreadCount();

      return true;
    } finally {
      state.loading = false;
    }
  }

  function isRead(notificationId) {
    return state.readIds.has(String(notificationId));
  }

  function getUnreadNotifications() {
    return state.notifications.filter(
      item => !isRead(getId(item))
    );
  }

  function updateUnreadCount() {
    state.unreadCount = getUnreadNotifications().length;

    updateBadgeElements();
    updateDocumentTitleBadge();

    document.dispatchEvent(
      new CustomEvent("mneet:student-unread-notifications", {
        detail: {
          count: state.unreadCount
        }
      })
    );
  }

  function updateBadgeElements() {
    const ids = [
      "studentUnreadNotificationCount",
      "studentNotificationBadge",
      "studentNotificationUnreadCount"
    ];

    ids.forEach(id => {
      const element = document.getElementById(id);

      if (!element) return;

      element.textContent = state.unreadCount > 99
        ? "99+"
        : String(state.unreadCount);

      element.hidden = state.unreadCount === 0;
      element.setAttribute(
        "aria-label",
        state.unreadCount + " unread notifications"
      );
    });

    const buttons = document.querySelectorAll(
      "[data-student-notification-badge]"
    );

    buttons.forEach(element => {
      element.textContent = state.unreadCount > 99
        ? "99+"
        : String(state.unreadCount);

      element.hidden = state.unreadCount === 0;
    });

    const button = document.getElementById(
      "studentNotificationButton"
    );

    if (button) {
      button.setAttribute(
        "aria-label",
        state.unreadCount
          ? state.unreadCount + " unread notifications"
          : "Notifications"
      );
    }
  }

  function updateDocumentTitleBadge() {
    const originalTitle = document.title.replace(
      /^\(\d+\)\s*/,
      ""
    );

    document.title = state.unreadCount
      ? "(" + state.unreadCount + ") " + originalTitle
      : originalTitle;
  }

  function getFilteredNotifications() {
    if (state.activeFilter === "unread") {
      return state.notifications.filter(
        item => !isRead(getId(item))
      );
    }

    if (state.activeFilter === "read") {
      return state.notifications.filter(
        item => isRead(getId(item))
      );
    }

    if (state.activeFilter !== "all") {
      return state.notifications.filter(
        item =>
          getNotificationType(item) === state.activeFilter
      );
    }

    return [...state.notifications];
  }

  function renderFilters() {
    const filters = [
      ["all", "All"],
      ["unread", "Unread"],
      ["read", "Read"],
      ["general", "General"],
      ["course", "Course"],
      ["notes", "Notes"],
      ["quiz", "Quiz"],
      ["course_update", "Course Update"]
    ];

    return `
      <div class="mneet-sn-filters">
        ${filters.map(([key, label]) => `
          <button type="button"
            class="mneet-sn-filter"
            data-sn-filter="${escapeHTML(key)}"
            aria-pressed="${state.activeFilter === key}">
            ${escapeHTML(label)}
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderNotificationList() {
    const notifications = getFilteredNotifications();

    if (!notifications.length) {
      return `
        <div class="mneet-sn-empty">
          <h3>No Notifications</h3>
          এই Filter-এ কোনো Notification নেই।
        </div>
      `;
    }

    return `
      <div class="mneet-sn-list">
        ${notifications.map(item => {
          const id = getId(item);
          const read = isRead(id);
          const type = getNotificationType(item);
          const date = formatDate(
            item.publishedAt ||
            item.createdAt ||
            item.updatedAt
          );

          return `
            <button type="button"
              class="mneet-sn-item ${read ? "" : "mneet-sn-item-unread"}"
              data-sn-open="${escapeHTML(id)}">

              <div class="mneet-sn-summary">
                <div class="mneet-sn-item-title">
                  ${escapeHTML(item.title || "Notification")}
                </div>

                <span class="mneet-sn-status ${read ? "" : "mneet-sn-status-unread"}">
                  ${read ? "Read" : "Unread"}
                </span>
              </div>

              <div class="mneet-sn-item-message">
                ${escapeHTML(item.message || "")}
              </div>

              <div class="mneet-sn-meta">
                <span>${escapeHTML(getTypeLabel(type))}</span>
                <span>${escapeHTML(date)}</span>
              </div>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function renderDetail() {
    const item = state.selectedNotification;

    if (!item) return "";

    const id = getId(item);

    return `
      <section class="mneet-sn-card">
        <button type="button"
          class="mneet-sn-button"
          data-sn-back>
          Back to Notifications
        </button>

        <br><br>

        <h2>${escapeHTML(item.title || "Notification")}</h2>

        <div class="mneet-sn-meta">
          <span>${escapeHTML(
            getTypeLabel(getNotificationType(item))
          )}</span>
          <span>${escapeHTML(
            formatDate(
              item.publishedAt ||
              item.createdAt ||
              item.updatedAt
            )
          )}</span>
          <span>${isRead(id) ? "Read" : "Unread"}</span>
        </div>

        <div class="mneet-sn-detail-message">
          ${escapeHTML(item.message || "")}
        </div>

        ${item.courseName ? `
          <p>Course: ${escapeHTML(item.courseName)}</p>
        ` : ""}

        ${item.actionUrl ? `
          <p>
            <a class="mneet-sn-button mneet-sn-button-primary"
              href="${safeLink(item.actionUrl)}"
              target="_blank"
              rel="noopener noreferrer">
              Open Link
            </a>
          </p>
        ` : ""}

        <button type="button"
          class="mneet-sn-button"
          data-sn-back>
          Back
        </button>
      </section>
    `;
  }

  function safeLink(value) {
    try {
      const url = new URL(String(value), window.location.origin);

      if (
        url.protocol === "https:" ||
        url.protocol === "http:"
      ) {
        return escapeHTML(url.href);
      }
    } catch (_) {}

    return "#";
  }

  function render() {
    const container = getContainer();

    updateUnreadCount();

    if (!container) return false;

    addStyles();

    container.innerHTML = `
      <div class="mneet-student-notifications">
        ${state.selectedNotification
          ? renderDetail()
          : `
            <section class="mneet-sn-card">
              <div class="mneet-sn-summary">
                <div>
                  <h2>Notifications</h2>
                  <p>mNEET-এর গুরুত্বপূর্ণ আপডেট এখানে দেখবে।</p>
                </div>

                <div>
                  <span class="mneet-sn-count">
                    ${state.unreadCount}
                  </span>
                  <p>Unread</p>
                </div>
              </div>

              <div class="mneet-sn-filters">
                ${renderFilters()}
              </div>

              <br>

              <button type="button"
                class="mneet-sn-button mneet-sn-button-primary"
                data-sn-read-all
                ${state.unreadCount === 0 ? "disabled" : ""}>
                Mark All as Read
              </button>

              <button type="button"
                class="mneet-sn-button"
                data-sn-refresh>
                Refresh
              </button>
            </section>

            <section class="mneet-sn-card">
              ${renderNotificationList()}
            </section>
          `
        }
      </div>
    `;

    return true;
  }

  async function markAsRead(notificationId) {
    const user = getCurrentUser();

    if (!user) {
      throw new Error("Sign In করা নেই।");
    }

    const id = String(notificationId);

    const item = state.notifications.find(
      notification => getId(notification) === id
    );

    if (!item) {
      throw new Error("Notification পাওয়া যায়নি।");
    }

    if (isRead(id)) return true;

    const db = getFirebase().db;

    /*
      Each student has a separate read-state document.
      This operation never edits the Admin announcement itself.
    */
    const readDocId = user.uid + "_" + id;

    await db.collection(COLLECTIONS.reads)
      .doc(readDocId)
      .set({
        userId: user.uid,
        notificationId: id,
        read: true,
        readAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    state.readIds.add(id);
    updateUnreadCount();

    return true;
  }

  async function markAllAsRead() {
    const unread = getUnreadNotifications();

    if (!unread.length) return true;

    const user = getCurrentUser();

    if (!user) {
      throw new Error("Sign In করা নেই।");
    }

    const db = getFirebase().db;
    const batchLimit = 400;

    for (let start = 0; start < unread.length; start += batchLimit) {
      const batch = db.batch();

      const group = unread.slice(start, start + batchLimit);

      group.forEach(item => {
        const id = getId(item);
        const readDocId = user.uid + "_" + id;

        const ref = db
          .collection(COLLECTIONS.reads)
          .doc(readDocId);

        batch.set(ref, {
          userId: user.uid,
          notificationId: id,
          read: true,
          readAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();

      group.forEach(item => {
        state.readIds.add(getId(item));
      });
    }

    updateUnreadCount();

    return true;
  }

  async function openNotification(notificationId) {
    const item = state.notifications.find(
      notification => getId(notification) === String(notificationId)
    );

    if (!item) {
      throw new Error("Notification পাওয়া যায়নি।");
    }

    state.selectedNotification = item;

    await markAsRead(notificationId);

    render();
  }

  async function refresh() {
    try {
      await loadData();
      render();
      return true;
    } catch (error) {
      state.error = error;

      console.error(
        "[mNEET Student Notifications] Refresh failed:",
        error
      );

      const container = getContainer();

      if (container) {
        addStyles();

        container.innerHTML = `
          <div class="mneet-student-notifications">
            <div class="mneet-sn-error">
              <h3>Notifications load হয়নি</h3>
              Firebase connection ও Firestore Security Rules পরীক্ষা করো।
              <br><br>
              <button type="button"
                class="mneet-sn-button mneet-sn-button-primary"
                data-sn-retry>
                আবার চেষ্টা করো
              </button>
            </div>
          </div>
        `;
      }

      return false;
    }
  }

  function handleClick(event) {
    const target = event.target.closest("button");

    if (!target) return;

    const filter = target.getAttribute("data-sn-filter");

    if (filter) {
      state.activeFilter = filter;
      state.selectedNotification = null;
      render();
      return;
    }

    const openId = target.getAttribute("data-sn-open");

    if (openId) {
      openNotification(openId).catch(error => {
        console.error(error);
        alert(error.message || "Notification খোলা যায়নি।");
      });
      return;
    }

    if (target.hasAttribute("data-sn-read-all")) {
      markAllAsRead()
        .then(render)
        .catch(error => {
          console.error(error);
          alert(
            "সব Notification Read করা যায়নি। Firestore Rules পরীক্ষা করো।"
          );
        });
      return;
    }

    if (target.hasAttribute("data-sn-back")) {
      state.selectedNotification = null;
      render();
      return;
    }

    if (target.hasAttribute("data-sn-refresh")) {
      refresh().catch(console.error);
      return;
    }

    if (target.hasAttribute("data-sn-retry")) {
      refresh().catch(console.error);
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);

    document.addEventListener("mneet:student-page-change", event => {
      const detail = event.detail || {};

      const page = String(
        detail.page || detail.pageName || detail.name || ""
      ).toLowerCase();

      if (page.includes("notification")) {
        refresh().catch(console.error);
      }
    });

    document.addEventListener("mneet:student-ready", () => {
      refresh().catch(console.error);
    });
  }

  async function initialize() {
    if (state.initialized) return;

    addStyles();
    bindEvents();

    try {
      const fb = getFirebase();

      fb.auth.onAuthStateChanged(async user => {
        state.user = user || null;

        if (!user) {
          state.notifications = [];
          state.purchases = [];
          state.courses = [];
          state.readIds = new Set();
          state.unreadCount = 0;
          state.selectedNotification = null;

          updateBadgeElements();
          return;
        }

        await refresh();
      });

      state.initialized = true;
    } catch (error) {
      state.error = error;

      console.error(
        "[mNEET Student Notifications] Initialization failed:",
        error
      );
    }
  }

  window.MNEETStudentNotifications = {
    initialize,
    refresh,
    loadData,
    render,
    markAsRead,
    markAllAsRead,
    openNotification,

    getUnreadCount() {
      return state.unreadCount;
    },

    getUnreadNotifications() {
      return getUnreadNotifications();
    },

    getNotifications() {
      return [...state.notifications];
    },

    getState() {
      return {
        user: state.user,
        notifications: [...state.notifications],
        unreadCount: state.unreadCount,
        activeFilter: state.activeFilter,
        selectedNotification: state.selectedNotification,
        loading: state.loading,
        error: state.error
      };
    },

    getLastError() {
      return state.error;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();
