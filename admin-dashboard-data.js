/* =========================================================
   mNEET ADMIN DASHBOARD DATA
   File: admin-dashboard-data.js

   Purpose:
   - Dashboard statistics
   - Course-wise filtering
   - Student and purchase metrics
   - Chapter and topic counts
   - Quiz attempts and results
   - Recent payments
   - Admin authorization

   Theme: Green and White, Dark Mode
   ========================================================= */

(function () {
  "use strict";

  if (window.MNEETDashboardData) return;

  const COLLECTIONS = [
    "courses",
    "users",
    "purchases",
    "chapters",
    "topics",
    "quizAttempts",
    "quizResults"
  ];

  const state = {
    db: null,
    auth: null,
    user: null,
    authorized: false,
    loading: false,
    initialized: false,
    courseId: "all",
    data: {},
    errors: [],
    lastUpdated: null
  };

  const STYLE = `
    .mneet-dashboard-data {
      color: #FFFFFF;
      width: 100%;
      margin: 0 auto;
    }

    .mneet-dashboard-data * {
      box-sizing: border-box;
    }

    .mneet-dashboard-data .mdd-card {
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 14px;
      padding: 17px;
      min-width: 0;
    }

    .mneet-dashboard-data .mdd-label {
      color: #D1D5DB;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 9px;
    }

    .mneet-dashboard-data .mdd-value {
      color: #FFFFFF;
      font-size: 28px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .mneet-dashboard-data .mdd-caption {
      color: #D1D5DB;
      font-size: 12px;
      margin-top: 7px;
      line-height: 1.5;
    }

    .mneet-dashboard-data .mdd-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 13px;
      margin: 18px 0;
    }

    .mneet-dashboard-data .mdd-section {
      margin-top: 24px;
    }

    .mneet-dashboard-data .mdd-section h3 {
      color: #FFFFFF;
      font-size: 18px;
      margin: 0 0 13px;
    }

    .mneet-dashboard-data .mdd-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .mneet-dashboard-data .mdd-button {
      color: #FFFFFF;
      background: #16A34A;
      border: 1px solid #16A34A;
      border-radius: 9px;
      padding: 11px 15px;
      min-height: 42px;
      font-weight: 700;
      cursor: pointer;
    }

    .mneet-dashboard-data .mdd-button:hover {
      background: #22C55E;
    }

    .mneet-dashboard-data .mdd-button:disabled {
      opacity: .6;
      cursor: not-allowed;
    }

    .mneet-dashboard-data .mdd-table-wrap {
      overflow-x: auto;
      width: 100%;
    }

    .mneet-dashboard-data table {
      width: 100%;
      border-collapse: collapse;
      min-width: 520px;
    }

    .mneet-dashboard-data th,
    .mneet-dashboard-data td {
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid #28513A;
      color: #FFFFFF;
      font-size: 13px;
      overflow-wrap: anywhere;
    }

    .mneet-dashboard-data th {
      color: #D1D5DB;
      font-weight: 700;
    }

    .mneet-dashboard-data .mdd-message {
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 10px;
      padding: 13px;
      color: #FFFFFF;
      margin: 12px 0;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    .mneet-dashboard-data .mdd-empty {
      color: #D1D5DB;
      padding: 18px 0;
      text-align: center;
    }

    .mneet-dashboard-data .mdd-refresh-time {
      color: #D1D5DB;
      font-size: 12px;
    }

    @media (max-width: 950px) {
      .mneet-dashboard-data .mdd-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 520px) {
      .mneet-dashboard-data .mdd-grid {
        grid-template-columns: 1fr 1fr;
        gap: 9px;
      }

      .mneet-dashboard-data .mdd-card {
        padding: 13px;
      }

      .mneet-dashboard-data .mdd-value {
        font-size: 23px;
      }

      .mneet-dashboard-data .mdd-toolbar {
        align-items: stretch;
      }

      .mneet-dashboard-data .mdd-button {
        width: 100%;
      }
    }
  `;

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.ready &&
      window.MNEETFirebase.db &&
      window.MNEETFirebase.auth
    ) {
      state.db = window.MNEETFirebase.db;
      state.auth = window.MNEETFirebase.auth;
      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.firestore === "function" &&
      typeof window.firebase.auth === "function"
    ) {
      state.db = window.firebase.firestore();
      state.auth = window.firebase.auth();
      return true;
    }

    return false;
  }

  async function verifyAdmin() {
    if (!getFirebase()) {
      throw new Error(
        "Firebase প্রস্তুত নয়। firebase.js পরীক্ষা করো।"
      );
    }

    const user = state.auth.currentUser;

    if (!user) {
      state.authorized = false;

      throw new Error(
        "Admin হিসেবে Sign In করা নেই।"
      );
    }

    const snapshot = await state.db
      .collection("admins")
      .doc(user.uid)
      .get();

    if (
      !snapshot.exists ||
      snapshot.data().active !== true
    ) {
      state.authorized = false;

      throw new Error(
        "Admin Permission পাওয়া যায়নি।"
      );
    }

    state.user = user;
    state.authorized = true;

    return user;
  }

  function injectStyles() {
    if (byId("mneetDashboardDataStyles")) return;

    const style = document.createElement("style");

    style.id = "mneetDashboardDataStyles";
    style.textContent = STYLE;

    document.head.appendChild(style);
  }

  function getRoot() {
    return (
      byId("dashboardDataContent") ||
      byId("dashboardStatisticsContent")
    );
  }

  function getCourseSelector() {
    return byId("dashboardCourseSelect");
  }

  function currentCourseId() {
    const selector = getCourseSelector();

    if (selector && selector.value) {
      return selector.value;
    }

    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.getActiveCourse === "function"
    ) {
      return window.MNEETAdmin.getActiveCourse() || "all";
    }

    return state.courseId || "all";
  }

  function number(value) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : 0;
  }

  function isActiveCourse(course) {
    if (!course) return false;

    return course.active !== false &&
      course.published !== false;
  }

  function belongsToCourse(item, courseId) {
    if (!item) return false;

    if (!courseId || courseId === "all") {
      return true;
    }

    return item.courseId === courseId;
  }

  function getStudentId(purchase) {
    return (
      purchase.userId ||
      purchase.studentId ||
      purchase.uid ||
      ""
    );
  }

  function getPurchaseStatus(purchase) {
    return String(
      purchase.status ||
      purchase.paymentStatus ||
      purchase.approvalStatus ||
      ""
    ).toLowerCase();
  }

  function isApprovedPurchase(purchase) {
    const status = getPurchaseStatus(purchase);

    return (
      status === "approved" ||
      status === "paid" ||
      status === "success" ||
      status === "completed"
    );
  }

  function isPendingPurchase(purchase) {
    const status = getPurchaseStatus(purchase);

    return (
      status === "pending" ||
      status === "requested" ||
      status === "under_review"
    );
  }

  function isRejectedPurchase(purchase) {
    const status = getPurchaseStatus(purchase);

    return (
      status === "rejected" ||
      status === "declined" ||
      status === "failed"
    );
  }

  function getDate(value) {
    if (!value) return null;

    if (typeof value.toDate === "function") {
      return value.toDate();
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === "number") {
      const date = new Date(value);

      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === "string") {
      const date = new Date(value);

      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (value.seconds != null) {
      return new Date(value.seconds * 1000);
    }

    return null;
  }

  function formatDate(value) {
    const date = getDate(value);

    if (!date) return "—";

    return date.toLocaleString();
  }

  function getCollection(name) {
    return Array.isArray(state.data[name])
      ? state.data[name]
      : [];
  }

  async function readCollection(name) {
    const snapshot = await state.db
      .collection(name)
      .get();

    return snapshot.docs.map(function (doc) {
      return Object.assign(
        { id: doc.id },
        doc.data()
      );
    });
  }

  async function loadAllCollections() {
    state.errors = [];

    const results = await Promise.allSettled(
      COLLECTIONS.map(async function (name) {
        const data = await readCollection(name);

        return {
          name: name,
          data: data
        };
      })
    );

    results.forEach(function (result, index) {
      const collectionName = COLLECTIONS[index];

      if (result.status === "fulfilled") {
        state.data[collectionName] = result.value.data;
      } else {
        state.data[collectionName] = [];

        state.errors.push({
          collection: collectionName,
          message:
            result.reason && result.reason.message
              ? result.reason.message
              : "ডেটা Load করা যায়নি।"
        });
      }
    });
  }

  function getFilteredData() {
    const courseId = currentCourseId();

    const courses = getCollection("courses")
      .filter(isActiveCourse)
      .filter(function (item) {
        return belongsToCourse(item, courseId);
      });

    const users = getCollection("users");

    const purchases = getCollection("purchases")
      .filter(function (item) {
        return belongsToCourse(item, courseId);
      });

    const chapters = getCollection("chapters")
      .filter(function (item) {
        return belongsToCourse(item, courseId);
      });

    const topics = getCollection("topics")
      .filter(function (item) {
        return belongsToCourse(item, courseId);
      });

    const attempts = getCollection("quizAttempts")
      .filter(function (item) {
        return belongsToCourse(item, courseId);
      });

    const results = getCollection("quizResults")
      .filter(function (item) {
        return belongsToCourse(item, courseId);
      });

    return {
      courseId: courseId,
      courses: courses,
      users: users,
      purchases: purchases,
      chapters: chapters,
      topics: topics,
      attempts: attempts,
      results: results
    };
  }

  function countUniqueStudents(purchases) {
    const ids = new Set();

    purchases.forEach(function (purchase) {
      if (!isApprovedPurchase(purchase)) return;

      const id = getStudentId(purchase);

      if (id) {
        ids.add(id);
      }
    });

    return ids.size;
  }

  function renderStatCards(data) {
    const approvedPurchases = data.purchases.filter(
      isApprovedPurchase
    );

    const pendingPurchases = data.purchases.filter(
      isPendingPurchase
    );

    const metrics = [
      {
        label: "Total Students",
        value: data.users.length,
        caption: "Registered student accounts"
      },
      {
        label: "Total Courses",
        value: data.courses.length,
        caption: "Active and published courses"
      },
      {
        label: "Paid Students",
        value: countUniqueStudents(data.purchases),
        caption: "Students with approved purchases"
      },
      {
        label: "Pending Approvals",
        value: pendingPurchases.length,
        caption: "Payments waiting for review"
      },
      {
        label: "Total Chapters",
        value: data.chapters.length,
        caption: "Chapters in selected course scope"
      },
      {
        label: "Total Topics",
        value: data.topics.length,
        caption: "Topics in selected course scope"
      },
      {
        label: "Quiz Attempts",
        value: data.attempts.length,
        caption: "Recorded quiz attempts"
      },
      {
        label: "Quiz Results",
        value: data.results.length,
        caption: "Saved quiz results"
      }
    ];

    return `
      <div class="mdd-grid">
        ${metrics.map(function (metric) {
          return `
            <div class="mdd-card">
              <div class="mdd-label">
                ${safeText(metric.label)}
              </div>

              <div class="mdd-value">
                ${number(metric.value).toLocaleString()}
              </div>

              <div class="mdd-caption">
                ${safeText(metric.caption)}
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="mdd-card">
        <div class="mdd-label">
          Approved Purchase Records
        </div>

        <div class="mdd-value">
          ${approvedPurchases.length.toLocaleString()}
        </div>

        <div class="mdd-caption">
          এটি approved purchase record-এর সংখ্যা;
          এটি আলাদা Student সংখ্যার সমান নাও হতে পারে।
        </div>
      </div>
    `;
  }

  function getStudentName(purchase) {
    return (
      purchase.studentName ||
      purchase.userName ||
      purchase.name ||
      purchase.email ||
      getStudentId(purchase) ||
      "Unknown Student"
    );
  }

  function getCourseName(purchase, courses) {
    if (purchase.courseName) {
      return purchase.courseName;
    }

    const course = courses.find(function (item) {
      return item.id === purchase.courseId;
    });

    return course
      ? course.name || "Unnamed Course"
      : purchase.courseId || "Unknown Course";
  }

  function getTransactionId(purchase) {
    return (
      purchase.transactionId ||
      purchase.txnId ||
      purchase.utr ||
      purchase.paymentReference ||
      "—"
    );
  }

  function renderRecentPayments(data) {
    const recent = data.purchases
      .slice()
      .sort(function (a, b) {
        const dateA = getDate(
          a.updatedAt || a.createdAt || a.requestedAt
        );

        const dateB = getDate(
          b.updatedAt || b.createdAt || b.requestedAt
        );

        return (
          (dateB ? dateB.getTime() : 0) -
          (dateA ? dateA.getTime() : 0)
        );
      })
      .slice(0, 8);

    if (!recent.length) {
      return `
        <div class="mdd-empty">
          এই Course Selection-এ কোনো Purchase Record পাওয়া যায়নি।
        </div>
      `;
    }

    return `
      <div class="mdd-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Course</th>
              <th>Transaction ID</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>

          <tbody>
            ${recent.map(function (purchase) {
              return `
                <tr>
                  <td>
                    ${safeText(getStudentName(purchase))}
                  </td>

                  <td>
                    ${safeText(getCourseName(
                      purchase,
                      data.courses
                    ))}
                  </td>

                  <td>
                    ${safeText(getTransactionId(purchase))}
                  </td>

                  <td>
                    ${safeText(
                      getPurchaseStatus(purchase) || "unknown"
                    )}
                  </td>

                  <td>
                    ${safeText(formatDate(
                      purchase.updatedAt ||
                      purchase.createdAt ||
                      purchase.requestedAt
                    ))}
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderErrors() {
    if (!state.errors.length) return "";

    return `
      <div class="mdd-message">
        কিছু Collection Load করা যায়নি।
        Firebase Security Rules ও Collection Names পরীক্ষা করো.
        <br><br>
        ${state.errors.map(function (error) {
          return (
            safeText(error.collection) +
            ": " +
            safeText(error.message)
          );
        }).join("<br>")}
      </div>
    `;
  }

  function renderDashboard() {
    const root = getRoot();

    if (!root) return;

    const data = getFilteredData();

    root.innerHTML = `
      <div class="mneet-dashboard-data">

        <div class="mdd-toolbar">
          <div>
            <div style="
              color:#FFFFFF;
              font-size:22px;
              font-weight:800;
              margin-bottom:6px">
              Dashboard Statistics
            </div>

            <div class="mdd-refresh-time">
              ${state.lastUpdated
                ? "Last refreshed: " +
                  safeText(state.lastUpdated.toLocaleString())
                : "Dashboard data"}
            </div>
          </div>

          <button
            type="button"
            class="mdd-button"
            id="mneetDashboardRefresh">
            Refresh Statistics
          </button>
        </div>

        ${renderErrors()}

        ${renderStatCards(data)}

        <div class="mdd-section">
          <h3>Recent Payments</h3>

          <div class="mdd-card">
            ${renderRecentPayments(data)}
          </div>
        </div>

      </div>
    `;

    const refreshButton = byId("mneetDashboardRefresh");

    if (refreshButton) {
      refreshButton.addEventListener("click", function () {
        refresh();
      });
    }
  }

  async function refresh() {
    if (state.loading) return;

    state.loading = true;

    const root = getRoot();

    if (root) {
      root.setAttribute("aria-busy", "true");
    }

    try {
      await verifyAdmin();

      state.courseId = currentCourseId();

      await loadAllCollections();

      state.lastUpdated = new Date();

      renderDashboard();

    } catch (error) {
      console.error(
        "mNEET dashboard statistics error:",
        error
      );

      if (root) {
        root.innerHTML = `
          <div class="mneet-dashboard-data">
            <div class="mdd-message">
              ${safeText(
                error && error.message
                  ? error.message
                  : "Dashboard Load করা যায়নি।"
              )}
            </div>
          </div>
        `;
      }

    } finally {
      state.loading = false;

      if (root) {
        root.setAttribute("aria-busy", "false");
      }
    }
  }

  function setupCourseSelector() {
    const selector = getCourseSelector();

    if (!selector || selector.dataset.mddBound === "true") {
      return;
    }

    selector.dataset.mddBound = "true";

    selector.addEventListener("change", function () {
      state.courseId = selector.value || "all";

      if (state.authorized) {
        renderDashboard();
      }
    });
  }

  async function initialize() {
    if (state.initialized) {
      setupCourseSelector();
      return;
    }

    injectStyles();

    if (!getRoot()) {
      return;
    }

    state.initialized = true;

    setupCourseSelector();

    await refresh();
  }

  document.addEventListener("DOMContentLoaded", function () {
    initialize();
  });

  document.addEventListener(
    "mneet:admin-page-change",
    function (event) {
      if (
        event.detail &&
        event.detail.page === "dashboard"
      ) {
        initialize();
        refresh();
      }
    }
  );

  document.addEventListener(
    "mneet:admin-course-change",
    function () {
      state.courseId = currentCourseId();

      if (state.authorized) {
        renderDashboard();
      }
    }
  );

  window.MNEETDashboardData = Object.freeze({
    initialize: initialize,
    refresh: refresh,

    getData: function () {
      return state.data;
    },

    getCourseId: function () {
      return state.courseId;
    },

    isAuthorized: function () {
      return state.authorized;
    }
  });

})();
