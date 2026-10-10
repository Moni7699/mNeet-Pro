/* =========================================================
   mNEET ADMIN PANEL
   FILE 20: admin-purchases.js

   Purchase Management:
   - View student purchase requests
   - Payment reference / UTR display
   - Pending / Approved / Rejected filters
   - Admin approval and rejection
   - Approval audit fields
   - Course access only after admin approval

   Theme: Green + White
========================================================= */

(function () {
  "use strict";

  if (window.MNEETPurchases) return;

  const PurchaseManager = {
    initialized: false,
    loading: false,
    saving: false,
    authorized: false,

    db: null,
    auth: null,
    currentUser: null,

    purchases: [],
    students: [],
    courses: [],

    statusFilter: "pending",
    courseFilter: "all",
    searchText: "",

    pageSize: 20,
    currentPage: 1
  };

  const STYLE_ID = "mneet-purchases-style";

  /* =====================================================
     HELPERS
  ===================================================== */

  function byId(id) {
    return document.getElementById(id);
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
    const box = byId("purchasesMessage");

    if (!box) return;

    box.textContent = message || "";
    box.hidden = !message;

    box.className = "mneet-purchase-message";

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

  function getPurchaseStatus(purchase) {
    const raw = normalize(
      value(
        purchase,
        ["paymentStatus", "approvalStatus", "status"],
        ""
      )
    );

    /*
      Approved records must have explicit approval evidence.
      A transaction ID by itself is not approval.
    */

    if (
      purchase.approved === true ||
      purchase.paymentApproved === true ||
      [
        "approved",
        "paid",
        "success",
        "successful",
        "completed"
      ].includes(raw)
    ) {
      return "approved";
    }

    if (
      purchase.approved === false ||
      [
        "rejected",
        "declined",
        "failed",
        "cancelled",
        "canceled"
      ].includes(raw)
    ) {
      return "rejected";
    }

    return "pending";
  }

  function getStudentId(purchase) {
    return text(
      value(
        purchase,
        ["userId", "studentId", "uid"],
        ""
      )
    );
  }

  function getCourseId(purchase) {
    return text(
      value(
        purchase,
        ["courseId", "courseID"],
        ""
      )
    );
  }

  function getTransactionId(purchase) {
    return text(
      value(
        purchase,
        [
          "transactionId",
          "paymentReference",
          "referenceId",
          "utr",
          "upiTransactionId"
        ],
        ""
      )
    );
  }

  function getStudent(studentId) {
    return PurchaseManager.students.find(function (student) {
      return student.id === studentId ||
        text(value(student, ["uid", "userId"], "")) === studentId;
    }) || null;
  }

  function getCourse(courseId) {
    return PurchaseManager.courses.find(function (course) {
      return course.id === courseId;
    }) || null;
  }

  function getStudentName(purchase) {
    const embeddedName = value(
      purchase,
      ["studentName", "name", "fullName"],
      ""
    );

    if (embeddedName) return text(embeddedName);

    const student = getStudent(getStudentId(purchase));

    return student
      ? text(value(student, ["name", "fullName", "displayName"], "Student"))
      : "Student record unavailable";
  }

  function getStudentEmail(purchase) {
    const embeddedEmail = value(
      purchase,
      ["studentEmail", "email"],
      ""
    );

    if (embeddedEmail) return text(embeddedEmail);

    const student = getStudent(getStudentId(purchase));

    return student
      ? text(value(student, ["email"], ""))
      : "";
  }

  function getStudentPhone(purchase) {
    const embeddedPhone = value(
      purchase,
      ["studentPhone", "phone", "phoneNumber", "mobile"],
      ""
    );

    if (embeddedPhone) return text(embeddedPhone);

    const student = getStudent(getStudentId(purchase));

    return student
      ? text(value(student, ["phone", "phoneNumber", "mobile"], ""))
      : "";
  }

  function getCourseName(purchase) {
    const embeddedName = value(
      purchase,
      ["courseName", "courseTitle"],
      ""
    );

    if (embeddedName) return text(embeddedName);

    const course = getCourse(getCourseId(purchase));

    return course
      ? text(value(course, ["name", "title", "courseName"], "Course"))
      : "Course record unavailable";
  }

  function getPrice(purchase) {
    const raw = value(
      purchase,
      ["amount", "price", "coursePrice", "totalAmount"],
      null
    );

    if (raw === null || raw === "") return "Not specified";

    const amount = Number(raw);

    if (!Number.isFinite(amount)) {
      return text(raw);
    }

    return "₹" + amount.toLocaleString("en-IN");
  }

  function statusLabel(status) {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Pending";
  }

  function statusBadge(status) {
    return (
      '<span class="mneet-purchase-badge ' +
      escapeHTML(status) +
      '">' +
      escapeHTML(statusLabel(status)) +
      "</span>"
    );
  }

  function isAuthorized() {
    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized === "function"
    ) {
      return window.MNEETAdmin.isAdminAuthorized() === true;
    }

    return PurchaseManager.authorized === true;
  }

  /* =====================================================
     CSS
  ===================================================== */

  function injectStyles() {
    if (byId(STYLE_ID)) return;

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #purchasesContent {
        color: #FFFFFF;
      }

      .mneet-purchases-wrap {
        width: 100%;
        color: #FFFFFF;
      }

      .mneet-purchases-heading {
        margin-bottom: 18px;
      }

      .mneet-purchases-heading h2 {
        margin: 0 0 8px;
        color: #FFFFFF;
        font-size: 24px;
        font-weight: 800;
      }

      .mneet-purchases-heading p {
        margin: 0;
        color: #D1D5DB;
        line-height: 1.6;
      }

      .mneet-purchase-stats {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }

      .mneet-purchase-stat {
        min-width: 0;
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 14px;
        padding: 16px;
      }

      .mneet-purchase-stat-label {
        margin-bottom: 8px;
        font-size: 13px;
        color: #D1D5DB;
      }

      .mneet-purchase-stat-value {
        color: #FFFFFF;
        font-size: 26px;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .mneet-purchase-panel {
        margin-bottom: 18px;
        padding: 16px;
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 14px;
      }

      .mneet-purchase-panel h3 {
        margin: 0 0 14px;
        font-size: 17px;
        color: #FFFFFF;
      }

      .mneet-purchase-filters {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(150px, 1fr) minmax(150px, 1fr);
        gap: 12px;
      }

      .mneet-purchase-field label {
        display: block;
        margin-bottom: 7px;
        color: #D1D5DB;
        font-size: 13px;
      }

      .mneet-purchase-field input,
      .mneet-purchase-field select {
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 10px 12px;
        border: 1px solid #28513A;
        border-radius: 9px;
        outline: none;
        background: #10291D;
        color: #FFFFFF;
        font: inherit;
      }

      .mneet-purchase-field input:focus,
      .mneet-purchase-field select:focus {
        border-color: #22C55E;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
      }

      .mneet-purchase-field select option {
        background: #0D2419;
        color: #FFFFFF;
      }

      .mneet-purchase-table-wrap {
        width: 100%;
        overflow-x: auto;
        border: 1px solid #28513A;
        border-radius: 12px;
      }

      .mneet-purchase-table {
        width: 100%;
        min-width: 1050px;
        border-collapse: collapse;
        color: #FFFFFF;
      }

      .mneet-purchase-table th,
      .mneet-purchase-table td {
        padding: 12px;
        border-bottom: 1px solid #28513A;
        text-align: left;
        vertical-align: top;
        font-size: 13px;
        line-height: 1.6;
      }

      .mneet-purchase-table th {
        white-space: nowrap;
        background: #10291D;
        color: #FFFFFF;
        font-weight: 800;
      }

      .mneet-purchase-table tbody tr:last-child td {
        border-bottom: none;
      }

      .mneet-purchase-table tbody tr:hover {
        background: rgba(34, 197, 94, 0.05);
      }

      .mneet-purchase-main {
        color: #FFFFFF;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .mneet-purchase-sub {
        color: #D1D5DB;
        overflow-wrap: anywhere;
        word-break: break-word;
      }

      .mneet-purchase-badge {
        display: inline-block;
        padding: 4px 9px;
        border: 1px solid #28513A;
        border-radius: 7px;
        background: #10291D;
        color: #FFFFFF;
        font-size: 12px;
        font-weight: 700;
      }

      .mneet-purchase-badge.approved {
        background: #16A34A;
        border-color: #16A34A;
        color: #FFFFFF;
      }

      .mneet-purchase-badge.pending {
        background: #10291D;
        border-color: #28513A;
        color: #D1D5DB;
      }

      .mneet-purchase-badge.rejected {
        background: #0D2419;
        border-color: #28513A;
        color: #FFFFFF;
      }

      .mneet-purchase-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
      }

      .mneet-purchase-button {
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid #28513A;
        border-radius: 8px;
        background: #10291D;
        color: #FFFFFF;
        font-weight: 700;
        cursor: pointer;
      }

      .mneet-purchase-button.approve {
        background: #16A34A;
        border-color: #16A34A;
      }

      .mneet-purchase-button.reject {
        background: #0D2419;
        border-color: #28513A;
      }

      .mneet-purchase-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .mneet-purchase-message {
        padding: 12px 14px;
        margin-bottom: 16px;
        border: 1px solid #28513A;
        border-radius: 10px;
        background: #0D2419;
        color: #FFFFFF;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .mneet-purchase-message[hidden] {
        display: none !important;
      }

      .mneet-purchase-empty {
        padding: 28px 14px !important;
        text-align: center !important;
        color: #D1D5DB;
      }

      .mneet-purchase-pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 16px;
      }

      .mneet-purchase-pagination-info {
        color: #D1D5DB;
        font-size: 13px;
      }

      @media (max-width: 850px) {
        .mneet-purchase-stats {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .mneet-purchase-filters {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .mneet-purchase-filters .search-field {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 520px) {
        .mneet-purchase-stats {
          grid-template-columns: 1fr;
        }

        .mneet-purchase-stat {
          padding: 13px;
        }

        .mneet-purchase-panel {
          padding: 12px;
        }

        .mneet-purchase-filters {
          grid-template-columns: 1fr;
        }

        .mneet-purchase-filters .search-field {
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
    const container = byId("purchasesContent");

    if (!container) return false;

    injectStyles();

    container.innerHTML = `
      <div class="mneet-purchases-wrap">

        <div class="mneet-purchases-heading">
          <h2>Purchases & Payment Approvals</h2>
          <p>
            Review student payment requests and approve or reject
            course purchases. A payment reference alone does not
            unlock a course.
          </p>
        </div>

        <div id="purchasesMessage"
             class="mneet-purchase-message"
             role="status"
             aria-live="polite"
             hidden></div>

        <div class="mneet-purchase-stats">

          <div class="mneet-purchase-stat">
            <div class="mneet-purchase-stat-label">Pending Requests</div>
            <div id="purchasePendingCount"
                 class="mneet-purchase-stat-value">0</div>
          </div>

          <div class="mneet-purchase-stat">
            <div class="mneet-purchase-stat-label">Approved Purchases</div>
            <div id="purchaseApprovedCount"
                 class="mneet-purchase-stat-value">0</div>
          </div>

          <div class="mneet-purchase-stat">
            <div class="mneet-purchase-stat-label">Rejected Requests</div>
            <div id="purchaseRejectedCount"
                 class="mneet-purchase-stat-value">0</div>
          </div>

        </div>

        <div class="mneet-purchase-panel">

          <h3>Search & Filter Requests</h3>

          <div class="mneet-purchase-filters">

            <div class="mneet-purchase-field search-field">
              <label for="purchaseSearch">Search</label>
              <input
                id="purchaseSearch"
                type="search"
                placeholder="Student, email, phone, course or transaction ID"
                autocomplete="off">
            </div>

            <div class="mneet-purchase-field">
              <label for="purchaseStatusFilter">Payment Status</label>
              <select id="purchaseStatusFilter">
                <option value="pending">Pending</option>
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div class="mneet-purchase-field">
              <label for="purchaseCourseFilter">Course</label>
              <select id="purchaseCourseFilter">
                <option value="all">All Courses</option>
              </select>
            </div>

          </div>
        </div>

        <div class="mneet-purchase-panel">

          <h3>Purchase Requests</h3>

          <div class="mneet-purchase-table-wrap">

            <table class="mneet-purchase-table">

              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>Transaction ID / UTR</th>
                  <th>Request Date</th>
                  <th>Payment Status</th>
                  <th>Course Access</th>
                  <th>Admin Action</th>
                </tr>
              </thead>

              <tbody id="purchaseTableBody">
                <tr>
                  <td colspan="8" class="mneet-purchase-empty">
                    Purchase data will appear here.
                  </td>
                </tr>
              </tbody>

            </table>

          </div>

          <div class="mneet-purchase-pagination">

            <div id="purchasePaginationInfo"
                 class="mneet-purchase-pagination-info">
              No records loaded.
            </div>

            <div>
              <button
                id="purchasePrevPage"
                type="button"
                class="mneet-purchase-button"
                disabled>
                Previous
              </button>

              <button
                id="purchaseNextPage"
                type="button"
                class="mneet-purchase-button approve"
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
     FIREBASE INITIALIZATION
  ===================================================== */

  function initializeFirebase() {
    const state = window.MNEETFirebase;

    if (
      state &&
      state.ready &&
      state.db &&
      state.auth
    ) {
      PurchaseManager.db = state.db;
      PurchaseManager.auth = state.auth;

      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.firestore === "function" &&
      typeof window.firebase.auth === "function"
    ) {
      PurchaseManager.db = window.firebase.firestore();
      PurchaseManager.auth = window.firebase.auth();

      return true;
    }

    showMessage(
      "Firebase initialize হয়নি। firebase.js ও Firebase SDK পরীক্ষা করো।",
      "error"
    );

    return false;
  }

  async function verifyAdmin() {
    const user = PurchaseManager.auth
      ? PurchaseManager.auth.currentUser
      : null;

    if (!user || !PurchaseManager.db) {
      PurchaseManager.authorized = false;
      return false;
    }

    try {
      const snapshot = await PurchaseManager.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!snapshot.exists) {
        PurchaseManager.authorized = false;
        return false;
      }

      const adminData = snapshot.data() || {};

      if (adminData.active !== true) {
        PurchaseManager.authorized = false;
        return false;
      }

      PurchaseManager.currentUser = user;
      PurchaseManager.authorized = true;

      return true;

    } catch (error) {
      console.error("Purchase admin verification error:", error);

      PurchaseManager.authorized = false;

      showMessage(
        "Admin verification ব্যর্থ হয়েছে। Firestore rules পরীক্ষা করো।",
        "error"
      );

      return false;
    }
  }

  async function readCollection(collectionName) {
    const snapshot = await PurchaseManager.db
      .collection(collectionName)
      .get();

    return snapshot.docs.map(function (doc) {
      return Object.assign(
        { id: doc.id },
        doc.data() || {}
      );
    });
  }

  /* =====================================================
     LOAD PURCHASE DATA
  ===================================================== */

  async function loadPurchases() {
    if (PurchaseManager.loading) return;

    if (!PurchaseManager.db || !PurchaseManager.auth) {
      if (!initializeFirebase()) return;
    }

    PurchaseManager.loading = true;

    showMessage("Loading purchase requests...", "info");

    try {
      const authorized = await verifyAdmin();

      if (!authorized) {
        PurchaseManager.purchases = [];
        PurchaseManager.students = [];
        PurchaseManager.courses = [];

        renderTable();

        showMessage(
          "এই Section ব্যবহার করতে Active Admin Account দিয়ে Login করতে হবে।",
          "error"
        );

        return;
      }

      const results = await Promise.allSettled([
        readCollection("purchases"),
        readCollection("users"),
        readCollection("courses")
      ]);

      const names = ["purchases", "users", "courses"];

      const loaded = {};

      results.forEach(function (result, index) {
        if (result.status === "fulfilled") {
          loaded[names[index]] = result.value;
        } else {
          loaded[names[index]] = [];

          console.warn(
            "Could not read collection:",
            names[index],
            result.reason
          );
        }
      });

      PurchaseManager.purchases = loaded.purchases || [];

      PurchaseManager.students = (loaded.users || []).filter(
        function (student) {
          return normalize(student.role) !== "admin";
        }
      );

      PurchaseManager.courses = loaded.courses || [];

      populateCourseFilter();
      renderStatistics();
      renderTable();

      const failed = results
        .map(function (result, index) {
          return result.status === "rejected"
            ? names[index]
            : null;
        })
        .filter(Boolean);

      if (failed.length) {
        showMessage(
          "কিছু Collection Load হয়নি: " +
            failed.join(", ") +
            ". Firestore rules ও collection names পরীক্ষা করো।",
          "error"
        );
      } else {
        hideMessage();
      }

    } catch (error) {
      console.error("Purchase loading error:", error);

      showMessage(
        "Purchase data load করা যায়নি। Firebase connection ও Firestore rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      PurchaseManager.loading = false;
    }
  }

  /* =====================================================
     FILTERS
  ===================================================== */

  function populateCourseFilter() {
    const select = byId("purchaseCourseFilter");

    if (!select) return;

    const previous = PurchaseManager.courseFilter;

    select.innerHTML =
      '<option value="all">All Courses</option>';

    PurchaseManager.courses
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

    PurchaseManager.courseFilter = select.value;
  }

  function getFilteredPurchases() {
    const search = normalize(PurchaseManager.searchText);

    return PurchaseManager.purchases
      .filter(function (purchase) {
        const status = getPurchaseStatus(purchase);

        if (
          PurchaseManager.statusFilter !== "all" &&
          status !== PurchaseManager.statusFilter
        ) {
          return false;
        }

        if (
          PurchaseManager.courseFilter !== "all" &&
          getCourseId(purchase) !== PurchaseManager.courseFilter
        ) {
          return false;
        }

        const haystack = [
          getStudentName(purchase),
          getStudentEmail(purchase),
          getStudentPhone(purchase),
          getCourseName(purchase),
          getTransactionId(purchase),
          getStudentId(purchase)
        ].map(normalize).join(" ");

        if (search && !haystack.includes(search)) {
          return false;
        }

        return true;
      })
      .sort(function (a, b) {
        return timestampValue(
          value(b, ["createdAt", "requestedAt", "submittedAt"], null)
        ) - timestampValue(
          value(a, ["createdAt", "requestedAt", "submittedAt"], null)
        );
      });
  }

  /* =====================================================
     STATISTICS
  ===================================================== */

  function renderStatistics() {
    const purchases = PurchaseManager.purchases.filter(function (purchase) {
      if (PurchaseManager.courseFilter === "all") return true;

      return getCourseId(purchase) === PurchaseManager.courseFilter;
    });

    const pending = purchases.filter(function (purchase) {
      return getPurchaseStatus(purchase) === "pending";
    }).length;

    const approved = purchases.filter(function (purchase) {
      return getPurchaseStatus(purchase) === "approved";
    }).length;

    const rejected = purchases.filter(function (purchase) {
      return getPurchaseStatus(purchase) === "rejected";
    }).length;

    if (byId("purchasePendingCount")) {
      byId("purchasePendingCount").textContent = pending;
    }

    if (byId("purchaseApprovedCount")) {
      byId("purchaseApprovedCount").textContent = approved;
    }

    if (byId("purchaseRejectedCount")) {
      byId("purchaseRejectedCount").textContent = rejected;
    }
  }

  /* =====================================================
     ACCESS DISPLAY
  ===================================================== */

  function getAccessLabel(purchase) {
    if (getPurchaseStatus(purchase) === "approved") {
      return (
        '<span class="mneet-purchase-badge approved">' +
        "Access Granted" +
        "</span>"
      );
    }

    return (
      '<span class="mneet-purchase-badge pending">' +
      "No Access" +
      "</span>"
    );
  }

  /* =====================================================
     TABLE
  ===================================================== */

  function renderTable() {
    const body = byId("purchaseTableBody");

    if (!body) return;

    const filtered = getFilteredPurchases();

    const total = filtered.length;

    const pageCount = Math.max(
      1,
      Math.ceil(total / PurchaseManager.pageSize)
    );

    if (PurchaseManager.currentPage > pageCount) {
      PurchaseManager.currentPage = pageCount;
    }

    const startIndex =
      (PurchaseManager.currentPage - 1) *
      PurchaseManager.pageSize;

    const pageItems = filtered.slice(
      startIndex,
      startIndex + PurchaseManager.pageSize
    );

    if (!pageItems.length) {
      body.innerHTML = `
        <tr>
          <td colspan="8" class="mneet-purchase-empty">
            No purchase requests found.
          </td>
        </tr>
      `;
    } else {
      body.innerHTML = pageItems.map(function (purchase) {
        const status = getPurchaseStatus(purchase);

        const studentName = getStudentName(purchase);
        const email = getStudentEmail(purchase);
        const phone = getStudentPhone(purchase);

        const courseName = getCourseName(purchase);
        const transactionId = getTransactionId(purchase);

        const requestedAt = value(
          purchase,
          ["createdAt", "requestedAt", "submittedAt"],
          null
        );

        let actionHTML = "";

        if (status === "pending") {
          actionHTML = `
            <div class="mneet-purchase-actions">

              <button
                type="button"
                class="mneet-purchase-button approve"
                data-purchase-action="approve"
                data-purchase-id="${escapeHTML(purchase.id)}">
                Approve
              </button>

              <button
                type="button"
                class="mneet-purchase-button reject"
                data-purchase-action="reject"
                data-purchase-id="${escapeHTML(purchase.id)}">
                Reject
              </button>

            </div>
          `;
        } else {
          const reviewedAt = value(
            purchase,
            ["reviewedAt", "approvedAt", "rejectedAt"],
            null
          );

          actionHTML = `
            <div>
              ${statusBadge(status)}
            </div>

            <div class="mneet-purchase-sub">
              ${reviewedAt ? escapeHTML(formatDate(reviewedAt)) : ""}
            </div>
          `;
        }

        return `
          <tr>

            <td>
              <div class="mneet-purchase-main">
                ${escapeHTML(studentName)}
              </div>

              <div class="mneet-purchase-sub">
                ${escapeHTML(email || "Email not available")}
              </div>

              <div class="mneet-purchase-sub">
                ${escapeHTML(phone || "Phone not available")}
              </div>

              <div class="mneet-purchase-sub">
                ID: ${escapeHTML(getStudentId(purchase) || "Not available")}
              </div>
            </td>

            <td>
              <div class="mneet-purchase-main">
                ${escapeHTML(courseName)}
              </div>

              <div class="mneet-purchase-sub">
                Course ID: ${escapeHTML(getCourseId(purchase) || "Not available")}
              </div>
            </td>

            <td>
              ${escapeHTML(getPrice(purchase))}
            </td>

            <td>
              ${escapeHTML(transactionId || "Not submitted")}
            </td>

            <td>
              ${escapeHTML(formatDate(requestedAt))}
            </td>

            <td>
              ${statusBadge(status)}
            </td>

            <td>
              ${getAccessLabel(purchase)}
            </td>

            <td>
              ${actionHTML}
            </td>

          </tr>
        `;
      }).join("");
    }

    const first = total === 0 ? 0 : startIndex + 1;
    const last = Math.min(
      startIndex + PurchaseManager.pageSize,
      total
    );

    if (byId("purchasePaginationInfo")) {
      byId("purchasePaginationInfo").textContent =
        "Showing " + first + "–" + last +
        " of " + total + " requests";
    }

    if (byId("purchasePrevPage")) {
      byId("purchasePrevPage").disabled =
        PurchaseManager.currentPage <= 1;
    }

    if (byId("purchaseNextPage")) {
      byId("purchaseNextPage").disabled =
        PurchaseManager.currentPage >= pageCount;
    }

    renderStatistics();
  }

  /* =====================================================
     APPROVAL AND REJECTION
  ===================================================== */

  async function updatePurchaseStatus(purchaseId, action) {
    if (PurchaseManager.saving) return;

    if (!isAuthorized()) {
      showMessage(
        "Active Admin authorization প্রয়োজন।",
        "error"
      );
      return;
    }

    if (!["approve", "reject"].includes(action)) {
      return;
    }

    const purchase = PurchaseManager.purchases.find(function (item) {
      return item.id === purchaseId;
    });

    if (!purchase) {
      showMessage("Purchase record পাওয়া যায়নি।", "error");
      return;
    }

    if (getPurchaseStatus(purchase) !== "pending") {
      showMessage(
        "এই Purchase Request ইতিমধ্যে Review করা হয়েছে।",
        "error"
      );

      return;
    }

    const studentName = getStudentName(purchase);
    const courseName = getCourseName(purchase);
    const transactionId = getTransactionId(purchase);

    if (action === "approve") {
      const confirmation =
        "Payment Approval Confirm করো:\n\n" +
        "Student: " + studentName + "\n" +
        "Course: " + courseName + "\n" +
        "Amount: " + getPrice(purchase) + "\n" +
        "Transaction ID: " + (transactionId || "Not submitted") +
        "\n\n" +
        "Payment যাচাই না করে Approve করবে না।\n" +
        "Confirm করলে Purchase Approved হবে।";

      if (!window.confirm(confirmation)) {
        return;
      }
    } else {
      const confirmation =
        "এই Purchase Request Reject করবে?\n\n" +
        "Student: " + studentName + "\n" +
        "Course: " + courseName + "\n\n" +
        "Rejected Request থেকে Course Access দেওয়া হবে না।";

      if (!window.confirm(confirmation)) {
        return;
      }
    }

    PurchaseManager.saving = true;

    showMessage(
      action === "approve"
        ? "Approving purchase..."
        : "Rejecting purchase...",
      "info"
    );

    try {
      /*
        Verify the current authenticated admin again before
        writing the payment decision.
      */

      const authorized = await verifyAdmin();

      if (!authorized) {
        throw new Error("Admin authorization failed.");
      }

      const now = window.firebase.firestore.FieldValue.serverTimestamp();

      const updateData = {
        paymentStatus: action === "approve" ? "approved" : "rejected",
        approvalStatus: action === "approve" ? "approved" : "rejected",

        approved: action === "approve",
        paymentApproved: action === "approve",

        accessGranted: action === "approve",

        reviewedBy: PurchaseManager.currentUser.uid,
        reviewedAt: now,

        updatedAt: now
      };

      if (action === "approve") {
        updateData.approvedAt = now;
        updateData.approvedBy = PurchaseManager.currentUser.uid;
      } else {
        updateData.rejectedAt = now;
        updateData.rejectedBy = PurchaseManager.currentUser.uid;
      }

      /*
        IMPORTANT:
        This updates the existing purchase record only.
        It does not create a new purchase record or create
        a second approval document.
      */

      await PurchaseManager.db
        .collection("purchases")
        .doc(purchaseId)
        .update(updateData);

      showMessage(
        action === "approve"
          ? "Purchase Approved হয়েছে। Course Access-এর জন্য Student-side access check-ও approved purchase যাচাই করতে হবে।"
          : "Purchase Request Reject করা হয়েছে। Course Access দেওয়া হয়নি।",
        "success"
      );

      await loadPurchases();

    } catch (error) {
      console.error("Purchase approval error:", error);

      let message =
        "Purchase update করা যায়নি। Firestore rules ও document structure পরীক্ষা করো।";

      if (error && error.code === "permission-denied") {
        message =
          "Permission denied: Firestore Security Rules Admin-কে এই Purchase update করতে দিচ্ছে না।";
      }

      showMessage(message, "error");

    } finally {
      PurchaseManager.saving = false;
    }
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  function setupEvents() {
    const search = byId("purchaseSearch");
    const status = byId("purchaseStatusFilter");
    const course = byId("purchaseCourseFilter");
    const body = byId("purchaseTableBody");
    const previous = byId("purchasePrevPage");
    const next = byId("purchaseNextPage");

    if (search) {
      search.addEventListener("input", function () {
        PurchaseManager.searchText = search.value;
        PurchaseManager.currentPage = 1;
        renderTable();
      });
    }

    if (status) {
      status.addEventListener("change", function () {
        PurchaseManager.statusFilter = status.value;
        PurchaseManager.currentPage = 1;
        renderTable();
      });
    }

    if (course) {
      course.addEventListener("change", function () {
        PurchaseManager.courseFilter = course.value;
        PurchaseManager.currentPage = 1;
        renderTable();
      });
    }

    if (body) {
      body.addEventListener("click", function (event) {
        const button = event.target.closest("[data-purchase-action]");

        if (!button) return;

        const action = button.dataset.purchaseAction;
        const purchaseId = button.dataset.purchaseId;

        updatePurchaseStatus(purchaseId, action);
      });
    }

    if (previous) {
      previous.addEventListener("click", function () {
        if (PurchaseManager.currentPage > 1) {
          PurchaseManager.currentPage--;
          renderTable();
        }
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        const count = getFilteredPurchases().length;

        const pages = Math.max(
          1,
          Math.ceil(count / PurchaseManager.pageSize)
        );

        if (PurchaseManager.currentPage < pages) {
          PurchaseManager.currentPage++;
          renderTable();
        }
      });
    }
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  function initialize() {
    if (PurchaseManager.initialized) {
      if (byId("purchasesContent")) {
        loadPurchases();
      }

      return;
    }

    if (!byId("purchasesContent")) {
      return;
    }

    if (!renderLayout()) return;

    PurchaseManager.initialized = true;

    setupEvents();

    if (!initializeFirebase()) return;

    loadPurchases();
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.MNEETPurchases = {
    initialize: initialize,

    refresh: function () {
      return loadPurchases();
    },

    getPurchases: function () {
      return PurchaseManager.purchases.slice();
    },

    isAuthorized: function () {
      return isAuthorized();
    }
  };

  document.addEventListener("DOMContentLoaded", initialize);

  document.addEventListener("mneet:admin-page-change", function (event) {
    if (event.detail && event.detail.page === "purchases") {
      initialize();
    }
  });

})();
