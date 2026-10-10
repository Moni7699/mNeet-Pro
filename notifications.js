/* =========================================================
   mNEET — Shared Notification Utilities
   File: notifications.js

   Requirements:
   - Admin-created announcements
   - Course, Notes and Quiz notifications
   - Student-specific unread/read status
   - Green and White theme compatibility
   - Firebase Authentication and Firestore
   - No Teacher Panel
   - No client-side notification publishing
   ========================================================= */

(function (window, document) {
  "use strict";

  if (window.MNEETNotificationUtils) {
    return;
  }

  const COLLECTIONS = Object.freeze({
    NOTIFICATIONS: "notifications",
    READS: "studentNotificationReads",
    USERS: "users",
    COURSES: "courses",
    PURCHASES: "purchases"
  });

  const APPROVED_STATUSES = Object.freeze([
    "approved",
    "paid",
    "completed"
  ]);

  const NOTIFICATION_TYPES = Object.freeze([
    "general",
    "course",
    "notes",
    "quiz",
    "course_update"
  ]);

  const state = {
    initialized: false,
    user: null,
    notifications: [],
    readIds: new Set(),
    unreadCount: 0,
    loading: false,
    error: null
  };

  let authListenerAttached = false;
  let authUnsubscribe = null;
  let activeReadListener = null;
  let activeReadListenerUserId = null;
  let lastNotificationIds = "";

  /* ---------------------------------------------------------
     FIREBASE ACCESS
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

  function getServerTimestamp() {
    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore.FieldValue
    ) {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    return null;
  }

  function getCurrentUser() {
    const services = getFirebase();

    return services && services.auth
      ? services.auth.currentUser
      : null;
  }

  function getCollection(name) {
    const services = getFirebase();

    if (!services || !services.db) {
      throw new Error("Firebase is not initialized.");
    }

    return services.db.collection(name);
  }

  /* ---------------------------------------------------------
     BASIC HELPERS
     --------------------------------------------------------- */

  function getText(value, fallback) {
    if (value === null || value === undefined) {
      return fallback || "";
    }

    const text = String(value).trim();

    return text || fallback || "";
  }

  function getDocumentId(item) {
    return item && (item.id || item.notificationId)
      ? String(item.id || item.notificationId)
      : "";
  }

  function getDateValue(value) {
    if (!value) {
      return 0;
    }

    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }

    if (typeof value.toDate === "function") {
      return value.toDate().getTime();
    }

    if (typeof value.seconds === "number") {
      return value.seconds * 1000;
    }

    const date = new Date(value).getTime();

    return Number.isFinite(date) ? date : 0;
  }

  function escapeHTML(value) {
    if (
      window.MNEETCommon &&
      typeof window.MNEETCommon.escapeHTML === "function"
    ) {
      return window.MNEETCommon.escapeHTML(value);
    }

    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function emit(eventName, detail) {
    window.dispatchEvent(
      new CustomEvent(eventName, {
        detail: detail || {}
      })
    );
  }

  function showMessage(message, type) {
    if (
      window.MNEETCommon &&
      typeof window.MNEETCommon.showMessage === "function"
    ) {
      const container =
        document.getElementById("studentMessage") ||
        document.getElementById("adminMessage");

      if (container) {
        window.MNEETCommon.showMessage(
          container,
          message,
          type || "info"
        );

        return;
      }
    }

    emit("mneet:notification-message", {
      message: message,
      type: type || "info"
    });
  }

  /* ---------------------------------------------------------
     NOTIFICATION VALIDATION
     --------------------------------------------------------- */

  function isPublished(notification) {
    if (!notification) {
      return false;
    }

    const status = String(
      notification.status || ""
    ).toLowerCase();

    return notification.published === true &&
      (status === "published" || status === "");
  }

  function getNotificationType(notification) {
    const type = String(
      notification && notification.type || "general"
    ).toLowerCase();

    return NOTIFICATION_TYPES.includes(type)
      ? type
      : "general";
  }

  function sortNotifications(notifications) {
    return notifications.slice().sort(function (a, b) {
      const dateA = getDateValue(
        a.publishedAt || a.createdAt || a.updatedAt
      );

      const dateB = getDateValue(
        b.publishedAt || b.createdAt || b.updatedAt
      );

      return dateB - dateA;
    });
  }

  /* ---------------------------------------------------------
     READ STATUS
     --------------------------------------------------------- */

  function isRead(notificationId) {
    return state.readIds.has(String(notificationId));
  }

  function calculateUnreadCount() {
    state.unreadCount = state.notifications.filter(function (item) {
      return !isRead(getDocumentId(item));
    }).length;

    return state.unreadCount;
  }

  function getUnreadNotifications() {
    return state.notifications.filter(function (item) {
      return !isRead(getDocumentId(item));
    });
  }

  function getReadNotifications() {
    return state.notifications.filter(function (item) {
      return isRead(getDocumentId(item));
    });
  }

  /* ---------------------------------------------------------
     NOTIFICATION BADGE
     --------------------------------------------------------- */

  function updateBadge() {
    const count = calculateUnreadCount();

    const badgeIds = [
      "studentUnreadNotificationCount",
      "studentNotificationBadge",
      "studentNotificationUnreadCount"
    ];

    badgeIds.forEach(function (id) {
      const element = document.getElementById(id);

      if (!element) {
        return;
      }

      element.textContent = count > 99
        ? "99+"
        : String(count);

      element.hidden = count === 0;
      element.setAttribute("aria-live", "polite");
      element.setAttribute(
        "aria-label",
        count + " unread notifications"
      );
    });

    document.querySelectorAll(
      "[data-student-notification-badge]"
    ).forEach(function (element) {
      element.textContent = count > 99
        ? "99+"
        : String(count);

      element.hidden = count === 0;
    });

    const button = document.getElementById(
      "studentNotificationButton"
    );

    if (button) {
      button.setAttribute(
        "aria-label",
        count > 0
          ? "Notifications, " + count + " unread"
          : "Notifications"
      );
    }

    emit("mneet:student-unread-notifications", {
      count: count
    });

    return count;
  }

  /* ---------------------------------------------------------
     LOAD USER'S READ RECORDS
     --------------------------------------------------------- */

  async function loadReadRecords(userId) {
    const db = getCollection(COLLECTIONS.READS);

    /*
     * Firestore Rules must permit a student to read only their
     * own read-status documents.
     */
    const snapshot = await db
      .where("userId", "==", userId)
      .get();

    const ids = new Set();

    snapshot.forEach(function (doc) {
      const data = doc.data() || {};

      if (data.read === true && data.notificationId) {
        ids.add(String(data.notificationId));
      }
    });

    state.readIds = ids;

    return ids;
  }

  /* ---------------------------------------------------------
     LOAD PUBLISHED NOTIFICATIONS
     --------------------------------------------------------- */

  async function loadNotifications() {
    if (!state.user) {
      state.notifications = [];
      state.readIds.clear();
      updateBadge();

      return [];
    }

    if (state.loading) {
      return state.notifications;
    }

    state.loading = true;
    state.error = null;

    try {
      /*
       * Query only published notifications. Firestore Rules are
       * not filters: a broad query may fail when the rules permit
       * reading published notifications only.
       *
       * The Admin Panel must set:
       * published: true
       * status: "published"
       */
      const db = getCollection(COLLECTIONS.NOTIFICATIONS);

      const snapshot = await db
        .where("published", "==", true)
        .where("status", "==", "published")
        .get();

      const notifications = [];

      snapshot.forEach(function (doc) {
        const data = doc.data() || {};

        notifications.push({
          ...data,
          id: doc.id
        });
      });

      /*
       * Load read records before updating the badge.
       */
      await loadReadRecords(state.user.uid);

      state.notifications = sortNotifications(
        notifications.filter(isPublished)
      );

      calculateUnreadCount();
      updateBadge();

      const ids = state.notifications
        .map(getDocumentId)
        .join("|");

      if (ids !== lastNotificationIds) {
        lastNotificationIds = ids;

        emit("mneet:notifications-updated", {
          count: state.notifications.length,
          unreadCount: state.unreadCount
        });
      }

      return state.notifications;

    } catch (error) {
      state.error = error;

      console.error(
        "[mNEET Notifications] Could not load notifications:",
        error
      );

      showMessage(
        "Notifications could not be loaded. Please try again.",
        "error"
      );

      throw error;

    } finally {
      state.loading = false;
    }
  }

  /* ---------------------------------------------------------
     MARK ONE NOTIFICATION AS READ
     --------------------------------------------------------- */

  async function markAsRead(notificationId) {
    if (!state.user) {
      throw new Error("Please sign in to continue.");
    }

    const id = String(notificationId || "").trim();

    if (!id) {
      throw new Error("Notification ID is missing.");
    }

    const exists = state.notifications.some(function (item) {
      return getDocumentId(item) === id;
    });

    if (!exists) {
      throw new Error("Notification was not found.");
    }

    if (isRead(id)) {
      return true;
    }

    const userId = state.user.uid;
    const documentId = userId + "_" + id;

    const payload = {
      userId: userId,
      notificationId: id,
      read: true
    };

    const timestamp = getServerTimestamp();

    if (timestamp) {
      payload.readAt = timestamp;
    }

    /*
     * Firestore Rules must validate ownership.
     * This write never changes the notification itself.
     */
    await getCollection(COLLECTIONS.READS)
      .doc(documentId)
      .set(payload, { merge: true });

    state.readIds.add(id);

    updateBadge();

    emit("mneet:notification-read", {
      notificationId: id,
      unreadCount: state.unreadCount
    });

    return true;
  }

  /* ---------------------------------------------------------
     MARK ALL AS READ
     --------------------------------------------------------- */

  async function markAllAsRead() {
    if (!state.user) {
      throw new Error("Please sign in to continue.");
    }

    const unread = getUnreadNotifications();

    if (!unread.length) {
      return {
        success: true,
        count: 0
      };
    }

    const db = getCollection(COLLECTIONS.READS);
    const timestamp = getServerTimestamp();

    /*
     * Firestore batches support at most 500 writes.
     * Use smaller batches to stay safely below that limit.
     */
    let completed = 0;

    for (let start = 0; start < unread.length; start += 400) {
      const batch = db.firestore.batch();

      const chunk = unread.slice(start, start + 400);

      chunk.forEach(function (notification) {
        const id = getDocumentId(notification);

        const payload = {
          userId: state.user.uid,
          notificationId: id,
          read: true
        };

        if (timestamp) {
          payload.readAt = timestamp;
        }

        batch.set(
          db.doc(state.user.uid + "_" + id),
          payload,
          { merge: true }
        );
      });

      await batch.commit();

      chunk.forEach(function (notification) {
        state.readIds.add(getDocumentId(notification));
      });

      completed += chunk.length;
    }

    updateBadge();

    emit("mneet:notifications-marked-all-read", {
      count: completed,
      unreadCount: state.unreadCount
    });

    return {
      success: true,
      count: completed
    };
  }

  /* ---------------------------------------------------------
     OPEN A NOTIFICATION
     --------------------------------------------------------- */

  async function openNotification(notificationId) {
    const id = String(notificationId || "");

    const notification = state.notifications.find(function (item) {
      return getDocumentId(item) === id;
    });

    if (!notification) {
      throw new Error("Notification was not found.");
    }

    if (!isRead(id)) {
      await markAsRead(id);
    }

    emit("mneet:open-notification", {
      notification: notification
    });

    return notification;
  }

  /* ---------------------------------------------------------
     FILTERS
     --------------------------------------------------------- */

  function getNotifications(filter) {
    const selectedFilter = String(filter || "all").toLowerCase();

    switch (selectedFilter) {
      case "unread":
        return getUnreadNotifications();

      case "read":
        return getReadNotifications();

      case "general":
      case "course":
      case "notes":
      case "quiz":
      case "course_update":
        return state.notifications.filter(function (item) {
          return getNotificationType(item) === selectedFilter;
        });

      case "all":
      default:
        return state.notifications.slice();
    }
  }

  /* ---------------------------------------------------------
     USER SESSION
     --------------------------------------------------------- */

  function resetUserState() {
    state.user = null;
    state.notifications = [];
    state.readIds.clear();
    state.unreadCount = 0;
    state.error = null;
    state.loading = false;

    lastNotificationIds = "";

    updateBadge();

    emit("mneet:notifications-session-reset", {});
  }

  function stopReadListener() {
    if (typeof activeReadListener === "function") {
      activeReadListener();
    }

    activeReadListener = null;
    activeReadListenerUserId = null;
  }

  function handleAuthState(user) {
    if (!user) {
      stopReadListener();
      resetUserState();
      return;
    }

    if (state.user && state.user.uid === user.uid) {
      state.user = user;
      return;
    }

    stopReadListener();

    state.user = user;
    state.notifications = [];
    state.readIds.clear();
    state.unreadCount = 0;
    lastNotificationIds = "";

    loadNotifications().catch(function () {
      /*
       * The detailed error has already been recorded.
       */
    });
  }

  /* ---------------------------------------------------------
     INITIALIZATION
     --------------------------------------------------------- */

  function initialize() {
    if (state.initialized) {
      return true;
    }

    const services = getFirebase();

    if (!services || !services.auth || !services.db) {
      console.warn(
        "[mNEET Notifications] Firebase is not ready yet."
      );

      return false;
    }

    state.initialized = true;

    if (!authListenerAttached) {
      authListenerAttached = true;

      authUnsubscribe = services.auth.onAuthStateChanged(
        handleAuthState
      );
    }

    return true;
  }

  function refresh() {
    if (!state.user) {
      return Promise.resolve([]);
    }

    return loadNotifications();
  }

  function destroy() {
    stopReadListener();

    if (typeof authUnsubscribe === "function") {
      authUnsubscribe();
    }

    authUnsubscribe = null;
    authListenerAttached = false;
    state.initialized = false;

    resetUserState();
  }

  /* ---------------------------------------------------------
     PUBLIC API
     --------------------------------------------------------- */

  window.MNEETNotificationUtils = Object.freeze({
    collections: COLLECTIONS,
    types: NOTIFICATION_TYPES,

    initialize: initialize,
    refresh: refresh,
    destroy: destroy,

    getCurrentUser: getCurrentUser,
    getNotifications: getNotifications,
    getUnreadNotifications: getUnreadNotifications,
    getReadNotifications: getReadNotifications,
    getUnreadCount: calculateUnreadCount,
    isRead: isRead,

    markAsRead: markAsRead,
    markAllAsRead: markAllAsRead,
    openNotification: openNotification,

    getNotificationType: getNotificationType,
    isPublished: isPublished,

    getState: function () {
      return {
        initialized: state.initialized,
        userId: state.user ? state.user.uid : null,
        notifications: state.notifications.slice(),
        readIds: Array.from(state.readIds),
        unreadCount: state.unreadCount,
        loading: state.loading,
        error: state.error
          ? state.error.message
          : null
      };
    }
  });

  /*
   * Wait for the page and Firebase scripts to be ready.
   */
  function start() {
    if (!initialize()) {
      window.addEventListener(
        "mneet:firebase-ready",
        initialize
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      { once: true }
    );
  } else {
    start();
  }

})(window, document);
