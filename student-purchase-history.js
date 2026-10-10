/* =========================================================
   mNEET — Student Purchase History
   File: student-purchase-history.js

   Features:
   - Show the signed-in student's purchase history
   - Show course name and payment amount
   - Show transaction ID and payment method
   - Show pending, approved and rejected status
   - Show payment submission and approval dates
   - Filter purchases by status
   - Search by course name or transaction ID
   - Refresh history from Firestore
   - Never approve or unlock a course from this module
   - Green and White design system
   ========================================================= */

(function (window, document) {
  "use strict";

  const MODULE_NAME = "MNEETStudentPurchaseHistory";

  const COLLECTIONS = Object.freeze({
    PURCHASES: "purchases",
    COURSES: "courses"
  });

  const state = {
    initialized: false,
    loading: false,
    user: null,
    db: null,
    purchases: [],
    courses: [],
    selectedStatus: "all",
    searchText: "",
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
      "Firebase চালু নেই। firebase.js ও Firebase SDK পরীক্ষা করো।"
    );
  }

  async function getOwnPurchases() {
    if (!state.user) {
      return [];
    }

    /*
     * Only request records belonging to the current user.
     * Firestore Rules must independently enforce ownership.
     */

    const snapshot = await state.db
      .collection(COLLECTIONS.PURCHASES)
      .where("userId", "==", state.user.uid)
      .get();

    return snapshot.docs.map(function (doc) {
      return Object.assign(
        { id: doc.id },
        doc.data()
      );
    });
  }

  async function getCourses() {
    const snapshot = await state.db
      .collection(COLLECTIONS.COURSES)
      .get();

    return snapshot.docs.map(function (doc) {
      return Object.assign(
        { id: doc.id },
        doc.data()
      );
    });
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

  function getDateValue(value) {
    if (!value) {
      return 0;
    }

    if (typeof value.toDate === "function") {
      try {
        return value.toDate().getTime();
      } catch (error) {
        return 0;
      }
    }

    if (typeof value.seconds === "number") {
      return value.seconds * 1000;
    }

    const timestamp = new Date(value).getTime();

    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function formatDate(value) {
    const timestamp = getDateValue(value);

    if (!timestamp) {
      return "তথ্য পাওয়া যায়নি";
    }

    return new Date(timestamp).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatCurrency(value, currency) {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
      return "তথ্য পাওয়া যায়নি";
    }

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

  function getErrorMessage(error) {
    const code = String(error && error.code || "");

    if (code.includes("permission-denied")) {
      return "Purchase history পড়ার অনুমতি নেই। Firebase Rules পরীক্ষা করতে হবে।";
    }

    if (code.includes("unauthenticated")) {
      return "Login session শেষ হয়েছে। আবার Login করো।";
    }

    if (code.includes("unavailable")) {
      return "Internet connection পরীক্ষা করে আবার চেষ্টা করো।";
    }

    return error && error.message
      ? error.message
      : "Purchase history লোড করা যায়নি।";
  }

  function showMessage(message, type) {
    const element =
      byId("studentPurchaseHistoryMessage") ||
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

  function getPurchaseStatus(purchase) {
    /*
     * Use the primary status field first.
     * Do not show an unverified purchase as approved.
     */

    const status = normalize(
      purchase.status ||
      purchase.approvalStatus ||
      purchase.paymentStatus
    );

    if (
      status === "approved" ||
      status === "paid" ||
      status === "completed"
    ) {
      return {
        key: "approved",
        label: "Approved"
      };
    }

    if (
      status === "rejected" ||
      status === "declined"
    ) {
      return {
        key: "rejected",
        label: "Rejected"
      };
    }

    if (
      status === "refunded" ||
      status === "refund_completed"
    ) {
      return {
        key: "refunded",
        label: "Refunded"
      };
    }

    if (
      status === "cancelled" ||
      status === "canceled"
    ) {
      return {
        key: "cancelled",
        label: "Cancelled"
      };
    }

    /*
     * Missing or unknown status is treated as pending.
     * It must never imply course access.
     */

    return {
      key: "pending",
      label: "Pending Admin Approval"
    };
  }

  function getPurchaseCourseId(purchase) {
    return String(
      purchase.courseId ||
      purchase.courseID ||
      ""
    );
  }

  function getPurchaseCourseName(purchase) {
    if (purchase.courseName) {
      return purchase.courseName;
    }

    const courseId = getPurchaseCourseId(purchase);

    const course = state.courses.find(function (item) {
      return item.id === courseId;
    });

    if (course) {
      return course.name || course.title || "Course";
    }

    return "Course information unavailable";
  }

  function getTransactionId(purchase) {
    return String(
      purchase.transactionId ||
      purchase.transactionID ||
      purchase.utr ||
      purchase.utrNumber ||
      ""
    );
  }

  function getPaymentMethod(purchase) {
    return String(
      purchase.paymentMethod ||
      purchase.method ||
      "Not specified"
    );
  }

  function getSubmittedDate(purchase) {
    return (
      purchase.createdAt ||
      purchase.submittedAt ||
      purchase.paymentDate ||
      null
    );
  }

  function getApprovalDate(purchase) {
    return (
      purchase.approvedAt ||
      purchase.reviewedAt ||
      purchase.updatedAt ||
      null
    );
  }

  /* =======================================================
     3. STYLE
     ======================================================= */

  function injectStyles() {
    if (byId("mneetPurchaseHistoryStyles")) {
      return;
    }

    const style = document.createElement("style");

    style.id = "mneetPurchaseHistoryStyles";

    style.textContent = `
      .mneet-ph {
        padding: 16px;
        border-radius: 16px;
        background: var(--mn-bg, #071A12);
        color: var(--mn-text, #FFFFFF);
      }

      .mneet-ph * {
        box-sizing: border-box;
      }

      .mneet-ph-muted {
        color: var(--mn-text-secondary, #D1D5DB);
        line-height: 1.55;
        font-size: .9rem;
      }

      .mneet-ph-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 16px 0;
      }

      .mneet-ph-input,
      .mneet-ph-select {
        flex: 1 1 180px;
        min-width: 0;
        min-height: 42px;
        padding: 10px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        background: var(--mn-input-bg, #10291D);
        color: var(--mn-text, #FFFFFF);
        font: inherit;
      }

      .mneet-ph-button {
        padding: 10px 14px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        background: var(--mn-primary, #16A34A);
        color: #FFFFFF;
        cursor: pointer;
        font: inherit;
      }

      .mneet-ph-button:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .mneet-ph-stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin: 16px 0;
      }

      .mneet-ph-stat {
        min-width: 0;
        padding: 14px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 12px;
        background: var(--mn-card, #0D2419);
      }

      .mneet-ph-stat strong {
        display: block;
        font-size: 1.2rem;
        margin-top: 6px;
        overflow-wrap: anywhere;
      }

      .mneet-ph-card {
        padding: 16px;
        margin: 12px 0;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 13px;
        background: var(--mn-card, #0D2419);
      }

      .mneet-ph-card h3 {
        margin: 0 0 8px;
        font-size: 1.05rem;
        overflow-wrap: anywhere;
      }

      .mneet-ph-status {
        display: inline-block;
        padding: 5px 10px;
        margin: 8px 0;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 20px;
        font-size: .82rem;
      }

      .mneet-ph-row {
        margin: 9px 0;
        overflow-wrap: anywhere;
        line-height: 1.5;
      }

      .mneet-ph-empty {
        padding: 22px 15px;
        border: 1px dashed var(--mn-border, #28513A);
        border-radius: 12px;
        text-align: center;
        line-height: 1.6;
        color: var(--mn-text-secondary, #D1D5DB);
      }

      @media (max-width: 480px) {
        .mneet-ph {
          padding: 10px;
        }

        .mneet-ph-stats {
          grid-template-columns: 1fr 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     4. FILTERS
     ======================================================= */

  function getFilteredPurchases() {
    const query = normalize(state.searchText);

    let purchases = state.purchases.slice();

    if (state.selectedStatus !== "all") {
      purchases = purchases.filter(function (purchase) {
        return getPurchaseStatus(purchase).key ===
          state.selectedStatus;
      });
    }

    if (query) {
      purchases = purchases.filter(function (purchase) {
        const courseName = getPurchaseCourseName(purchase);
        const transactionId = getTransactionId(purchase);
        const courseId = getPurchaseCourseId(purchase);

        return (
          normalize(courseName).includes(query) ||
          normalize(transactionId).includes(query) ||
          normalize(courseId).includes(query)
        );
      });
    }

    purchases.sort(function (a, b) {
      return getDateValue(getSubmittedDate(b)) -
        getDateValue(getSubmittedDate(a));
    });

    return purchases;
  }

  /* =======================================================
     5. RENDER
     ======================================================= */

  function getHost() {
    return (
      byId("studentPurchaseHistoryContent") ||
      byId("studentPurchaseHistoryPageContent") ||
      byId("studentPagePurchaseHistory")
    );
  }

  function renderStats() {
    const stats = {
      total: state.purchases.length,
      approved: 0,
      pending: 0,
      rejected: 0
    };

    state.purchases.forEach(function (purchase) {
      const status = getPurchaseStatus(purchase).key;

      if (status === "approved") {
        stats.approved += 1;
      } else if (status === "rejected") {
        stats.rejected += 1;
      } else if (status === "pending") {
        stats.pending += 1;
      }
    });

    return `
      <div class="mneet-ph-stats">
        <div class="mneet-ph-stat">
          <span class="mneet-ph-muted">Total Purchases</span>
          <strong>${stats.total}</strong>
        </div>

        <div class="mneet-ph-stat">
          <span class="mneet-ph-muted">Approved</span>
          <strong>${stats.approved}</strong>
        </div>

        <div class="mneet-ph-stat">
          <span class="mneet-ph-muted">Pending</span>
          <strong>${stats.pending}</strong>
        </div>

        <div class="mneet-ph-stat">
          <span class="mneet-ph-muted">Rejected</span>
          <strong>${stats.rejected}</strong>
        </div>
      </div>
    `;
  }

  function renderPurchaseCard(purchase) {
    const status = getPurchaseStatus(purchase);

    const amount = formatCurrency(
      purchase.amount,
      purchase.currency || "INR"
    );

    const transactionId = getTransactionId(purchase);

    const submittedDate = getSubmittedDate(purchase);

    const approvalDate = getApprovalDate(purchase);

    const screenshotUrl = String(
      purchase.paymentScreenshotUrl ||
      purchase.screenshotUrl ||
      ""
    );

    return `
      <article class="mneet-ph-card">
        <h3>${escapeHTML(getPurchaseCourseName(purchase))}</h3>

        <span class="mneet-ph-status">
          ${escapeHTML(status.label)}
        </span>

        <div class="mneet-ph-row">
          <span class="mneet-ph-muted">Amount:</span>
          <strong>${escapeHTML(amount)}</strong>
        </div>

        <div class="mneet-ph-row">
          <span class="mneet-ph-muted">Transaction ID / UTR:</span>
          <strong>
            ${transactionId
              ? escapeHTML(transactionId)
              : "Not provided"}
          </strong>
        </div>

        <div class="mneet-ph-row">
          <span class="mneet-ph-muted">Payment Method:</span>
          ${escapeHTML(getPaymentMethod(purchase))}
        </div>

        <div class="mneet-ph-row">
          <span class="mneet-ph-muted">Submitted:</span>
          ${escapeHTML(formatDate(submittedDate))}
        </div>

        ${
          status.key === "approved" ||
          status.key === "rejected"
            ? `<div class="mneet-ph-row">
                <span class="mneet-ph-muted">Last Review / Update:</span>
                ${escapeHTML(formatDate(approvalDate))}
              </div>`
            : ""
        }

        ${
          purchase.paymentNote
            ? `<div class="mneet-ph-row">
                <span class="mneet-ph-muted">Payment Note:</span>
                ${escapeHTML(purchase.paymentNote)}
              </div>`
            : ""
        }

        ${
          screenshotUrl
            ? `<div class="mneet-ph-row">
                <a
                  href="${escapeHTML(screenshotUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="mneet-ph-button"
                  style="display:inline-block;text-decoration:none">
                  View Submitted Payment Screenshot
                </a>
              </div>`
            : ""
        }

        <div class="mneet-ph-muted">
          Purchase Reference: ${escapeHTML(purchase.id)}
        </div>

        ${
          status.key === "pending"
            ? `<p class="mneet-ph-muted">
                Payment Admin যাচাই করছেন। Approval না হওয়া পর্যন্ত
                course access নিশ্চিত নয়।
              </p>`
            : ""
        }

        ${
          status.key === "rejected"
            ? `<p class="mneet-ph-muted">
                এই payment request rejected হয়েছে।
                প্রয়োজন হলে support-এর সঙ্গে যোগাযোগ করো।
              </p>`
            : ""
        }
      </article>
    `;
  }

  function render() {
    injectStyles();

    const host = getHost();

    if (!host) {
      return false;
    }

    if (!state.user) {
      host.innerHTML = `
        <section class="mneet-ph">
          <div class="mneet-ph-empty">
            Purchase History দেখতে Student account দিয়ে Login করো।
          </div>
        </section>
      `;

      return true;
    }

    const purchases = getFilteredPurchases();

    host.innerHTML = `
      <section class="mneet-ph">
        <h2>Purchase History</h2>

        <p class="mneet-ph-muted">
          তোমার course purchase ও payment approval-এর বর্তমান অবস্থা।
        </p>

        ${renderStats()}

        <div class="mneet-ph-toolbar">
          <input
            id="mneetPurchaseHistorySearch"
            class="mneet-ph-input"
            type="search"
            value="${escapeHTML(state.searchText)}"
            placeholder="Course বা Transaction ID খুঁজুন"
            aria-label="Search purchase history">

          <select
            id="mneetPurchaseHistoryStatus"
            class="mneet-ph-select"
            aria-label="Filter by payment status">

            <option value="all"
              ${state.selectedStatus === "all" ? "selected" : ""}>
              All Statuses
            </option>

            <option value="approved"
              ${state.selectedStatus === "approved" ? "selected" : ""}>
              Approved
            </option>

            <option value="pending"
              ${state.selectedStatus === "pending" ? "selected" : ""}>
              Pending
            </option>

            <option value="rejected"
              ${state.selectedStatus === "rejected" ? "selected" : ""}>
              Rejected
            </option>

            <option value="refunded"
              ${state.selectedStatus === "refunded" ? "selected" : ""}>
              Refunded
            </option>

            <option value="cancelled"
              ${state.selectedStatus === "cancelled" ? "selected" : ""}>
              Cancelled
            </option>
          </select>

          <button
            type="button"
            id="mneetPurchaseHistoryRefresh"
            class="mneet-ph-button"
            ${state.loading ? "disabled" : ""}>
            ${state.loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <div id="mneetPurchaseHistoryList">
          ${
            purchases.length
              ? purchases.map(renderPurchaseCard).join("")
              : `<div class="mneet-ph-empty">
                   কোনো purchase record পাওয়া যায়নি।
                 </div>`
          }
        </div>

        <p class="mneet-ph-muted">
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
     6. EVENTS
     ======================================================= */

  function handleInput(event) {
    if (event.target.id === "mneetPurchaseHistorySearch") {
      state.searchText = event.target.value || "";

      const list = byId("mneetPurchaseHistoryList");

      if (list) {
        const purchases = getFilteredPurchases();

        list.innerHTML = purchases.length
          ? purchases.map(renderPurchaseCard).join("")
          : `<div class="mneet-ph-empty">
               কোনো matching purchase পাওয়া যায়নি।
             </div>`;
      }
    }
  }

  function handleChange(event) {
    if (event.target.id === "mneetPurchaseHistoryStatus") {
      state.selectedStatus = event.target.value || "all";
      render();
    }
  }

  function handleClick(event) {
    const refreshButton = event.target.closest(
      "#mneetPurchaseHistoryRefresh"
    );

    if (refreshButton) {
      refresh();
    }
  }

  /* =======================================================
     7. REFRESH
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

        state.user = services.auth.currentUser;
        state.db = services.db;

        if (!state.user) {
          state.purchases = [];
          state.courses = [];

          render();
          return false;
        }

        const results = await Promise.all([
          getOwnPurchases(),
          getCourses()
        ]);

        state.purchases = results[0];
        state.courses = results[1];

        state.lastUpdated = new Date();

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
     8. INITIALIZE
     ======================================================= */

  function initialize() {
    if (state.initialized) {
      return refresh();
    }

    state.initialized = true;

    injectStyles();

    if (!eventsBound) {
      eventsBound = true;

      document.addEventListener("input", handleInput);
      document.addEventListener("change", handleChange);
      document.addEventListener("click", handleClick);

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

          if (page.includes("purchase")) {
            refresh();
          }
        }
      );
    }

    return refresh();
  }

  /* =======================================================
     9. PUBLIC API
     ======================================================= */

  window[MODULE_NAME] = Object.freeze({
    initialize: initialize,
    refresh: refresh,
    render: render,

    getPurchases: function () {
      return state.purchases.slice();
    },

    getFilteredPurchases: getFilteredPurchases,

    getPurchaseStatus: getPurchaseStatus,

    getState: function () {
      return {
        initialized: state.initialized,
        loading: state.loading,
        purchaseCount: state.purchases.length,
        selectedStatus: state.selectedStatus,
        searchText: state.searchText,
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
