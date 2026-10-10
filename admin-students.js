/* =========================================================
   mNEET ADMIN PANEL
   FILE 19: admin-students.js

   Purpose:
   - Student list and search
   - Student contact information
   - Purchased courses and payment status
   - Course access status
   - Account status
   - Quiz attempts and available progress
   - Admin-only access

   Color Theme: Green + White
========================================================= */

(function () {
  "use strict";

  if (window.MNEETStudents) return;

  const Students = {
    initialized: false,
    authorized: false,
    loading: false,

    db: null,
    auth: null,
    currentUser: null,

    students: [],
    courses: [],
    purchases: [],
    attempts: [],
    results: [],

    searchText: "",
    courseFilter: "all",
    accountFilter: "all",

    pageSize: 25,
    currentPage: 1
  };

  const STYLE_ID = "mneet-students-style";

  /* =====================================================
     HELPERS
  ===================================================== */

  function byId(id) {
    return document.getElementById(id);
  }

  function safeText(value) {
    return String(value == null ? "" : value);
  }

  function escapeHTML(value) {
    return safeText(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalize(value) {
    return safeText(value).trim().toLowerCase();
  }

  function timestampValue(value) {
    if (!value) return 0;

    if (typeof value.toMillis === "function") {
      return value.toMillis();
    }

    if (value instanceof Date) {
      return value.getTime();
    }

    if (typeof value.seconds === "number") {
      return value.seconds * 1000;
    }

    const parsed = Date.parse(value);

    return Number.isNaN(parsed) ? 0 : parsed;
  }

  function formatDate(value) {
    const time = timestampValue(value);

    if (!time) return "—";

    try {
      return new Date(time).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    } catch (error) {
      return "—";
    }
  }

  function setMessage(message, type) {
    const box = byId("studentsMessage");

    if (!box) return;

    box.textContent = message || "";
    box.hidden = !message;

    box.className = "mneet-students-message";

    if (type === "error") {
      box.classList.add("message-error");
    } else if (type === "success") {
      box.classList.add("message-success");
    } else {
      box.classList.add("message-info");
    }
  }

  function showLoading(message) {
    setMessage(message || "Loading student data...", "info");
  }

  function hideMessage() {
    setMessage("", "");
  }

  function getField(data, fields, fallback) {
    for (let i = 0; i < fields.length; i++) {
      const value = data ? data[fields[i]] : undefined;

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return value;
      }
    }

    return fallback == null ? "" : fallback;
  }

  function getStudentId(data, documentId) {
    return safeText(
      getField(data, ["uid", "userId", "studentId"], documentId)
    );
  }

  function getPurchaseStudentId(data) {
    return safeText(
      getField(data, ["userId", "studentId", "uid"], "")
    );
  }

  function getCourseId(data) {
    return safeText(
      getField(data, ["courseId", "courseID"], "")
    );
  }

  function getCourseName(courseId) {
    const course = Students.courses.find(function (item) {
      return item.id === courseId;
    });

    return course
      ? safeText(getField(course, ["name", "title", "courseName"], "Unnamed Course"))
      : "Unknown Course";
  }

  function getAccountStatus(student) {
    const rawStatus = normalize(
      getField(
        student,
        ["accountStatus", "status", "account_status"],
        "active"
      )
    );

    if (
      student.disabled === true ||
      student.active === false ||
      ["disabled", "inactive", "blocked", "suspended"].includes(rawStatus)
    ) {
      return "inactive";
    }

    if (
      ["pending", "pending_approval", "awaiting_approval"].includes(rawStatus)
    ) {
      return "pending";
    }

    return "active";
  }

  function getPaymentStatus(purchase) {
    const status = normalize(
      getField(
        purchase,
        ["paymentStatus", "status", "approvalStatus"],
        ""
      )
    );

    if (
      purchase.approved === true ||
      purchase.paymentApproved === true ||
      ["approved", "paid", "success", "successful", "completed"].includes(status)
    ) {
      return "approved";
    }

    if (
      purchase.approved === false ||
      ["rejected", "declined", "failed", "cancelled", "canceled"].includes(status)
    ) {
      return "rejected";
    }

    return "pending";
  }

  function hasCourseAccess(purchase) {
    /*
      Course access is granted only when the purchase record
      explicitly indicates approval.

      A transaction ID or payment reference alone does not
      grant access.
    */

    if (!purchase) return false;

    if (
      purchase.approved === true ||
      purchase.paymentApproved === true ||
      purchase.accessGranted === true
    ) {
      return true;
    }

    const status = normalize(
      getField(
        purchase,
        ["paymentStatus", "status", "approvalStatus"],
        ""
      )
    );

    return [
      "approved",
      "paid",
      "success",
      "successful",
      "completed"
    ].includes(status);
  }

  function getRecordStudentId(record) {
    return safeText(
      getField(record, ["userId", "studentId", "uid"], "")
    );
  }

  function getRecordCourseId(record) {
    return getCourseId(record);
  }

  function getProgressValue(record) {
    const raw = getField(
      record,
      [
        "completionPercent",
        "progressPercent",
        "progressPercentage",
        "courseProgress",
        "completion",
        "progress"
      ],
      null
    );

    if (raw === null || raw === "") return null;

    let number = Number(raw);

    if (!Number.isFinite(number)) return null;

    /*
      Supports both 0–1 fractions and 0–100 percentages.
    */

    if (number > 0 && number <= 1) {
      number = number * 100;
    }

    return Math.max(0, Math.min(100, number));
  }

  function formatPercent(value) {
    if (value === null || value === undefined) {
      return "Not available";
    }

    return Math.round(value) + "%";
  }

  function getAttemptCount(studentId, courseId) {
    return Students.attempts.filter(function (attempt) {
      if (getRecordStudentId(attempt) !== studentId) {
        return false;
      }

      if (
        courseId !== "all" &&
        getRecordCourseId(attempt) !== courseId
      ) {
        return false;
      }

      return true;
    }).length;
  }

  function getStudentPurchases(studentId) {
    return Students.purchases.filter(function (purchase) {
      return getPurchaseStudentId(purchase) === studentId;
    });
  }

  function getStudentProgress(studentId, courseId) {
    const records = Students.results.filter(function (result) {
      if (getRecordStudentId(result) !== studentId) {
        return false;
      }

      if (
        courseId !== "all" &&
        getRecordCourseId(result) !== courseId
      ) {
        return false;
      }

      return true;
    });

    const progressValues = records
      .map(getProgressValue)
      .filter(function (value) {
        return value !== null;
      });

    if (!progressValues.length) {
      return null;
    }

    /*
      Show the latest available progress record when
      timestamp fields are available.
    */

    records.sort(function (a, b) {
      const aTime = timestampValue(
        getField(a, ["updatedAt", "createdAt", "completedAt"], null)
      );

      const bTime = timestampValue(
        getField(b, ["updatedAt", "createdAt", "completedAt"], null)
      );

      return bTime - aTime;
    });

    return getProgressValue(records[0]);
  }

  function isAuthorized() {
    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized === "function"
    ) {
      return window.MNEETAdmin.isAdminAuthorized() === true;
    }

    return Students.authorized === true;
  }

  /* =====================================================
     CSS
  ===================================================== */

  function injectStyles() {
    if (byId(STYLE_ID)) return;

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #studentsContent {
        color: #FFFFFF;
      }

      .mneet-students-wrap {
        width: 100%;
        color: #FFFFFF;
      }

      .mneet-students-heading {
        margin-bottom: 18px;
      }

      .mneet-students-heading h2 {
        margin: 0 0 8px;
        font-size: 24px;
        font-weight: 800;
        color: #FFFFFF;
      }

      .mneet-students-heading p {
        margin: 0;
        color: #D1D5DB;
        line-height: 1.6;
      }

      .mneet-students-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        margin-bottom: 18px;
      }

      .mneet-students-stat {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 14px;
        padding: 16px;
        min-width: 0;
      }

      .mneet-students-stat-label {
        color: #D1D5DB;
        font-size: 13px;
        margin-bottom: 8px;
      }

      .mneet-students-stat-value {
        font-size: 25px;
        line-height: 1.3;
        font-weight: 800;
        color: #FFFFFF;
        overflow-wrap: anywhere;
      }

      .mneet-students-panel {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 18px;
      }

      .mneet-students-panel h3 {
        color: #FFFFFF;
        margin: 0 0 14px;
        font-size: 17px;
      }

      .mneet-students-filters {
        display: grid;
        grid-template-columns: minmax(0, 2fr) minmax(150px, 1fr) minmax(150px, 1fr);
        gap: 12px;
      }

      .mneet-students-field label {
        display: block;
        margin-bottom: 7px;
        font-size: 13px;
        color: #D1D5DB;
      }

      .mneet-students-field input,
      .mneet-students-field select {
        box-sizing: border-box;
        width: 100%;
        min-height: 44px;
        padding: 10px 12px;
        border-radius: 9px;
        border: 1px solid #28513A;
        background: #10291D;
        color: #FFFFFF;
        outline: none;
        font: inherit;
      }

      .mneet-students-field input:focus,
      .mneet-students-field select:focus {
        border-color: #22C55E;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
      }

      .mneet-students-field select option {
        background: #0D2419;
        color: #FFFFFF;
      }

      .mneet-students-table-wrap {
        width: 100%;
        overflow-x: auto;
        border: 1px solid #28513A;
        border-radius: 12px;
      }

      .mneet-students-table {
        width: 100%;
        min-width: 950px;
        border-collapse: collapse;
        color: #FFFFFF;
      }

      .mneet-students-table th,
      .mneet-students-table td {
        text-align: left;
        vertical-align: top;
        padding: 12px;
        border-bottom: 1px solid #28513A;
        font-size: 13px;
        line-height: 1.6;
      }

      .mneet-students-table th {
        background: #10291D;
        color: #FFFFFF;
        font-weight: 700;
        white-space: nowrap;
      }

      .mneet-students-table tbody tr:last-child td {
        border-bottom: none;
      }

      .mneet-students-table tbody tr:hover {
        background: rgba(34, 197, 94, 0.05);
      }

      .mneet-student-name {
        font-weight: 800;
        color: #FFFFFF;
        margin-bottom: 4px;
        overflow-wrap: anywhere;
      }

      .mneet-student-subtext {
        color: #D1D5DB;
        overflow-wrap: anywhere;
      }

      .mneet-student-badge {
        display: inline-block;
        max-width: 100%;
        padding: 4px 8px;
        border-radius: 7px;
        border: 1px solid #28513A;
        background: #10291D;
        color: #FFFFFF;
        font-size: 12px;
        overflow-wrap: anywhere;
      }

      .mneet-student-badge.approved,
      .mneet-student-badge.active {
        border-color: #16A34A;
        background: #16A34A;
        color: #FFFFFF;
      }

      .mneet-student-badge.pending {
        border-color: #28513A;
        background: #10291D;
        color: #D1D5DB;
      }

      .mneet-student-badge.rejected,
      .mneet-student-badge.inactive {
        border-color: #28513A;
        background: #0D2419;
        color: #FFFFFF;
      }

      .mneet-students-progress {
        width: 130px;
        max-width: 100%;
        height: 8px;
        border-radius: 20px;
        overflow: hidden;
        background: #10291D;
        border: 1px solid #28513A;
        margin: 5px 0;
      }

      .mneet-students-progress-fill {
        height: 100%;
        border-radius: 20px;
        background: #22C55E;
      }

      .mneet-students-pagination {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 16px;
      }

      .mneet-students-pagination-info {
        color: #D1D5DB;
        font-size: 13px;
      }

      .mneet-students-button {
        min-height: 40px;
        border: 1px solid #28513A;
        border-radius: 9px;
        padding: 9px 14px;
        background: #10291D;
        color: #FFFFFF;
        font-weight: 700;
        cursor: pointer;
      }

      .mneet-students-button.primary {
        background: #16A34A;
        border-color: #16A34A;
      }

      .mneet-students-button:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .mneet-students-message {
        padding: 12px 14px;
        margin-bottom: 16px;
        border-radius: 10px;
        border: 1px solid #28513A;
        background: #0D2419;
        color: #FFFFFF;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .mneet-students-message[hidden] {
        display: none !important;
      }

      .mneet-students-empty {
        text-align: center;
        padding: 28px 14px !important;
        color: #D1D5DB;
      }

      .mneet-student-details {
        margin-top: 16px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #10291D;
        padding: 16px;
      }

      .mneet-student-details h4 {
        color: #FFFFFF;
        margin: 0 0 12px;
        font-size: 17px;
      }

      .mneet-student-detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .mneet-student-detail-item {
        min-width: 0;
        border: 1px solid #28513A;
        border-radius: 9px;
        padding: 12px;
        background: #0D2419;
      }

      .mneet-student-detail-label {
        font-size: 12px;
        color: #D1D5DB;
        margin-bottom: 5px;
      }

      .mneet-student-detail-value {
        color: #FFFFFF;
        font-size: 14px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }

      @media (max-width: 850px) {
        .mneet-students-stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .mneet-students-filters {
          grid-template-columns: 1fr 1fr;
        }

        .mneet-students-filters .search-field {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 520px) {
        .mneet-students-stats {
          gap: 8px;
        }

        .mneet-students-stat {
          padding: 12px;
        }

        .mneet-students-stat-value {
          font-size: 21px;
        }

        .mneet-students-panel {
          padding: 12px;
        }

        .mneet-students-filters {
          grid-template-columns: 1fr;
        }

        .mneet-students-filters .search-field {
          grid-column: auto;
        }

        .mneet-student-detail-grid {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =====================================================
     UI
  ===================================================== */

  function renderLayout() {
    const container = byId("studentsContent");

    if (!container) {
      return false;
    }

    injectStyles();

    container.innerHTML = `
      <div class="mneet-students-wrap">

        <div class="mneet-students-heading">
          <h2>Students Management</h2>
          <p>
            Student information, purchases, payment approvals,
            course access and available learning progress.
          </p>
        </div>

        <div id="studentsMessage"
             class="mneet-students-message"
             role="status"
             aria-live="polite"
             hidden></div>

        <div class="mneet-students-stats">

          <div class="mneet-students-stat">
            <div class="mneet-students-stat-label">Total Students</div>
            <div id="studentsTotalCount"
                 class="mneet-students-stat-value">0</div>
          </div>

          <div class="mneet-students-stat">
            <div class="mneet-students-stat-label">Active Accounts</div>
            <div id="studentsActiveCount"
                 class="mneet-students-stat-value">0</div>
          </div>

          <div class="mneet-students-stat">
            <div class="mneet-students-stat-label">Students With Approved Purchases</div>
            <div id="studentsPaidCount"
                 class="mneet-students-stat-value">0</div>
          </div>

          <div class="mneet-students-stat">
            <div class="mneet-students-stat-label">Pending Payments</div>
            <div id="studentsPendingCount"
                 class="mneet-students-stat-value">0</div>
          </div>

        </div>

        <div class="mneet-students-panel">

          <h3>Search & Filter Students</h3>

          <div class="mneet-students-filters">

            <div class="mneet-students-field search-field">
              <label for="studentsSearch">Search Student</label>
              <input
                id="studentsSearch"
                type="search"
                placeholder="Name, email or phone number"
                autocomplete="off">
            </div>

            <div class="mneet-students-field">
              <label for="studentsCourseFilter">Course</label>
              <select id="studentsCourseFilter">
                <option value="all">All Courses</option>
              </select>
            </div>

            <div class="mneet-students-field">
              <label for="studentsAccountFilter">Account Status</label>
              <select id="studentsAccountFilter">
                <option value="all">All Accounts</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="pending">Pending</option>
              </select>
            </div>

          </div>
        </div>

        <div class="mneet-students-panel">

          <h3>Student List</h3>

          <div class="mneet-students-table-wrap">
            <table class="mneet-students-table">

              <thead>
                <tr>
                  <th>Student</th>
                  <th>Phone</th>
                  <th>Target</th>
                  <th>Purchased Courses</th>
                  <th>Payment Status</th>
                  <th>Course Access</th>
                  <th>Account Status</th>
                  <th>Quiz Attempts</th>
                  <th>Progress</th>
                  <th>Details</th>
                </tr>
              </thead>

              <tbody id="studentsTableBody">
                <tr>
                  <td colspan="10" class="mneet-students-empty">
                    Student data will appear here.
                  </td>
                </tr>
              </tbody>

            </table>
          </div>

          <div class="mneet-students-pagination">

            <div id="studentsPaginationInfo"
                 class="mneet-students-pagination-info">
              No students loaded.
            </div>

            <div>
              <button
                id="studentsPrevPage"
                type="button"
                class="mneet-students-button"
                disabled>
                Previous
              </button>

              <button
                id="studentsNextPage"
                type="button"
                class="mneet-students-button primary"
                disabled>
                Next
              </button>
            </div>

          </div>

          <div id="studentsDetailsPanel"
               class="mneet-student-details"
               hidden></div>

        </div>

      </div>
    `;

    return true;
  }

  /* =====================================================
     FIREBASE
  ===================================================== */

  function initializeFirebase() {
    const firebaseState = window.MNEETFirebase;

    if (
      firebaseState &&
      firebaseState.ready &&
      firebaseState.db &&
      firebaseState.auth
    ) {
      Students.db = firebaseState.db;
      Students.auth = firebaseState.auth;
      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.firestore === "function" &&
      typeof window.firebase.auth === "function"
    ) {
      Students.db = window.firebase.firestore();
      Students.auth = window.firebase.auth();
      return true;
    }

    setMessage(
      "Firebase initialize হয়নি। firebase.js এবং Firebase SDK পরীক্ষা করো।",
      "error"
    );

    return false;
  }

  async function verifyAdmin() {
    if (!Students.auth || !Students.db) {
      return false;
    }

    const user = Students.auth.currentUser;

    if (!user) {
      Students.authorized = false;
      return false;
    }

    /*
      Use the existing admin authorization function when
      it is available. Also verify the active admin record
      from Firestore.
    */

    try {
      const adminSnapshot = await Students.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!adminSnapshot.exists) {
        Students.authorized = false;
        return false;
      }

      const adminData = adminSnapshot.data() || {};

      if (adminData.active !== true) {
        Students.authorized = false;
        return false;
      }

      Students.currentUser = user;
      Students.authorized = true;

      return true;

    } catch (error) {
      console.error("Student module admin verification failed:", error);

      Students.authorized = false;

      setMessage(
        "Admin verification করা যায়নি। Firestore rules ও admins document পরীক্ষা করো।",
        "error"
      );

      return false;
    }
  }

  async function readCollection(collectionName) {
    const snapshot = await Students.db
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
     LOAD DATA
  ===================================================== */

  async function loadStudentData() {
    if (Students.loading) return;

    if (!Students.db || !Students.auth) {
      if (!initializeFirebase()) return;
    }

    Students.loading = true;
    showLoading("Loading students and related records...");

    try {
      const authorized = await verifyAdmin();

      if (!authorized) {
        Students.students = [];
        Students.courses = [];
        Students.purchases = [];
        Students.attempts = [];
        Students.results = [];

        renderTable();

        setMessage(
          "এই Section দেখতে Active Admin Account দিয়ে Login করতে হবে।",
          "error"
        );

        return;
      }

      /*
        The module reads existing collections only.
        It does not create or change student accounts.
      */

      const results = await Promise.allSettled([
        readCollection("users"),
        readCollection("courses"),
        readCollection("purchases"),
        readCollection("quizAttempts"),
        readCollection("quizResults")
      ]);

      const collectionNames = [
        "users",
        "courses",
        "purchases",
        "quizAttempts",
        "quizResults"
      ];

      const loaded = {};

      results.forEach(function (result, index) {
        const collectionName = collectionNames[index];

        if (result.status === "fulfilled") {
          loaded[collectionName] = result.value;
        } else {
          loaded[collectionName] = [];

          console.warn(
            "Could not read collection:",
            collectionName,
            result.reason
          );
        }
      });

      Students.students = loaded.users || [];
      Students.courses = loaded.courses || [];
      Students.purchases = loaded.purchases || [];
      Students.attempts = loaded.quizAttempts || [];
      Students.results = loaded.quizResults || [];

      /*
        Ignore any account that has explicitly been marked
        as an administrator. This keeps the list student-focused.
      */

      Students.students = Students.students.filter(function (student) {
        return normalize(student.role) !== "admin";
      });

      populateCourseFilter();
      renderStatistics();
      renderTable();

      const failedCollections = results
        .map(function (result, index) {
          return result.status === "rejected"
            ? collectionNames[index]
            : null;
        })
        .filter(Boolean);

      if (failedCollections.length) {
        setMessage(
          "কিছু Data Load হয়নি: " +
            failedCollections.join(", ") +
            ". Firestore collection name ও rules পরীক্ষা করো।",
          "error"
        );
      } else {
        hideMessage();
      }

    } catch (error) {
      console.error("Student data loading error:", error);

      setMessage(
        "Student data load করা যায়নি। Firebase connection এবং Firestore rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      Students.loading = false;
    }
  }

  /* =====================================================
     COURSE FILTER
  ===================================================== */

  function populateCourseFilter() {
    const select = byId("studentsCourseFilter");

    if (!select) return;

    const previousValue = Students.courseFilter || "all";

    const activeCourses = Students.courses
      .filter(function (course) {
        return course.active !== false &&
          course.published !== false;
      })
      .sort(function (a, b) {
        return safeText(a.name).localeCompare(safeText(b.name));
      });

    select.innerHTML =
      '<option value="all">All Courses</option>';

    activeCourses.forEach(function (course) {
      const option = document.createElement("option");

      option.value = course.id;
      option.textContent = safeText(
        getField(course, ["name", "title", "courseName"], "Unnamed Course")
      );

      select.appendChild(option);
    });

    const exists = Array.from(select.options).some(function (option) {
      return option.value === previousValue;
    });

    select.value = exists ? previousValue : "all";

    Students.courseFilter = select.value;
  }

  /* =====================================================
     STUDENT AGGREGATION
  ===================================================== */

  function getPurchasesForCourse(studentId, courseId) {
    return getStudentPurchases(studentId).filter(function (purchase) {
      if (courseId === "all") return true;

      return getCourseId(purchase) === courseId;
    });
  }

  function getApprovedPurchases(studentId, courseId) {
    return getPurchasesForCourse(studentId, courseId).filter(
      hasCourseAccess
    );
  }

  function getPendingPurchases(studentId, courseId) {
    return getPurchasesForCourse(studentId, courseId).filter(
      function (purchase) {
        return getPaymentStatus(purchase) === "pending";
      }
    );
  }

  function getStudentSummary(student) {
    const studentId = getStudentId(student, student.id);
    const courseId = Students.courseFilter;

    const purchases = getStudentPurchases(studentId);

    const relevantPurchases = purchases.filter(function (purchase) {
      if (courseId === "all") return true;

      return getCourseId(purchase) === courseId;
    });

    const approvedPurchases = relevantPurchases.filter(
      hasCourseAccess
    );

    const pendingPurchases = relevantPurchases.filter(
      function (purchase) {
        return getPaymentStatus(purchase) === "pending";
      }
    );

    const rejectedPurchases = relevantPurchases.filter(
      function (purchase) {
        return getPaymentStatus(purchase) === "rejected";
      }
    );

    const purchasedCourseNames = [];

    approvedPurchases.forEach(function (purchase) {
      const purchasedCourseId = getCourseId(purchase);

      if (!purchasedCourseId) return;

      const name = getCourseName(purchasedCourseId);

      if (!purchasedCourseNames.includes(name)) {
        purchasedCourseNames.push(name);
      }
    });

    return {
      id: studentId,
      student: student,

      name: safeText(
        getField(student, ["name", "fullName", "displayName"], "Unnamed Student")
      ),

      email: safeText(
        getField(student, ["email"], "")
      ),

      phone: safeText(
        getField(student, ["phone", "phoneNumber", "mobile"], "")
      ),

      target: safeText(
        getField(student, ["target", "examTarget", "goal"], "")
      ),

      accountStatus: getAccountStatus(student),

      purchases: relevantPurchases,
      approvedPurchases: approvedPurchases,
      pendingPurchases: pendingPurchases,
      rejectedPurchases: rejectedPurchases,

      purchasedCourseNames: purchasedCourseNames,

      attempts: getAttemptCount(studentId, courseId),

      progress: getStudentProgress(studentId, courseId)
    };
  }

  /* =====================================================
     SEARCH AND FILTER
  ===================================================== */

  function getFilteredStudents() {
    const search = normalize(Students.searchText);
    const accountFilter = Students.accountFilter;

    return Students.students
      .map(getStudentSummary)
      .filter(function (summary) {
        const searchHaystack = [
          summary.name,
          summary.email,
          summary.phone,
          summary.target
        ].map(normalize).join(" ");

        if (search && !searchHaystack.includes(search)) {
          return false;
        }

        if (
          accountFilter !== "all" &&
          summary.accountStatus !== accountFilter
        ) {
          return false;
        }

        /*
          When a specific course is selected, only show students
          who have a purchase record for that course.
        */

        if (Students.courseFilter !== "all") {
          const hasCoursePurchase = summary.purchases.some(
            function (purchase) {
              return getCourseId(purchase) === Students.courseFilter;
            }
          );

          if (!hasCoursePurchase) return false;
        }

        return true;
      })
      .sort(function (a, b) {
        return a.name.localeCompare(b.name);
      });
  }

  /* =====================================================
     STATISTICS
  ===================================================== */

  function renderStatistics() {
    const summaries = Students.students.map(getStudentSummary);

    const activeCount = summaries.filter(function (summary) {
      return summary.accountStatus === "active";
    }).length;

    const paidStudentIds = new Set();

    summaries.forEach(function (summary) {
      if (summary.approvedPurchases.length > 0) {
        paidStudentIds.add(summary.id);
      }
    });

    const pendingCount = Students.purchases.filter(function (purchase) {
      if (getPaymentStatus(purchase) !== "pending") return false;

      if (Students.courseFilter === "all") return true;

      return getCourseId(purchase) === Students.courseFilter;
    }).length;

    const courseStudentCount = Students.courseFilter === "all"
      ? Students.students.length
      : Students.students.filter(function (student) {
          const studentId = getStudentId(student, student.id);

          return Students.purchases.some(function (purchase) {
            return getPurchaseStudentId(purchase) === studentId &&
              getCourseId(purchase) === Students.courseFilter;
          });
        }).length;

    if (byId("studentsTotalCount")) {
      byId("studentsTotalCount").textContent = courseStudentCount;
    }

    if (byId("studentsActiveCount")) {
      byId("studentsActiveCount").textContent = activeCount;
    }

    if (byId("studentsPaidCount")) {
      byId("studentsPaidCount").textContent = paidStudentIds.size;
    }

    if (byId("studentsPendingCount")) {
      byId("studentsPendingCount").textContent = pendingCount;
    }
  }

  /* =====================================================
     BADGES AND TABLE
  ===================================================== */

  function badge(label, status) {
    return (
      '<span class="mneet-student-badge ' +
      escapeHTML(status || "") +
      '">' +
      escapeHTML(label) +
      "</span>"
    );
  }

  function renderPurchaseStatus(summary) {
    const statuses = [];

    if (summary.approvedPurchases.length) {
      statuses.push(
        badge(
          "Approved: " + summary.approvedPurchases.length,
          "approved"
        )
      );
    }

    if (summary.pendingPurchases.length) {
      statuses.push(
        badge(
          "Pending: " + summary.pendingPurchases.length,
          "pending"
        )
      );
    }

    if (summary.rejectedPurchases.length) {
      statuses.push(
        badge(
          "Rejected: " + summary.rejectedPurchases.length,
          "rejected"
        )
      );
    }

    if (!statuses.length) {
      return badge("No Purchase", "inactive");
    }

    return statuses.join("<br>");
  }

  function renderCourseAccess(summary) {
    if (summary.approvedPurchases.length > 0) {
      return badge("Granted", "approved");
    }

    if (summary.pendingPurchases.length > 0) {
      return badge("Awaiting Approval", "pending");
    }

    return badge("Locked / No Access", "inactive");
  }

  function renderAccountStatus(summary) {
    if (summary.accountStatus === "active") {
      return badge("Active", "active");
    }

    if (summary.accountStatus === "pending") {
      return badge("Pending", "pending");
    }

    return badge("Inactive", "inactive");
  }

  function renderProgress(summary) {
    if (summary.progress === null) {
      return (
        '<span class="mneet-student-subtext">' +
        "Not available" +
        "</span>"
      );
    }

    const percent = Math.round(summary.progress);

    return `
      <div>${percent}%</div>
      <div class="mneet-students-progress">
        <div
          class="mneet-students-progress-fill"
          style="width:${percent}%">
        </div>
      </div>
    `;
  }

  function renderTable() {
    const body = byId("studentsTableBody");

    if (!body) return;

    const filtered = getFilteredStudents();

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / Students.pageSize));

    if (Students.currentPage > pageCount) {
      Students.currentPage = pageCount;
    }

    const startIndex = (Students.currentPage - 1) * Students.pageSize;

    const pageItems = filtered.slice(
      startIndex,
      startIndex + Students.pageSize
    );

    if (!pageItems.length) {
      body.innerHTML = `
        <tr>
          <td colspan="10" class="mneet-students-empty">
            No matching students found.
          </td>
        </tr>
      `;
    } else {
      body.innerHTML = pageItems.map(function (summary) {
        const name = summary.name || "Unnamed Student";
        const email = summary.email || "Email not provided";
        const phone = summary.phone || "Not provided";
        const target = summary.target || "Not provided";

        const courseNames = summary.purchasedCourseNames.length
          ? summary.purchasedCourseNames.join(", ")
          : "No approved course";

        return `
          <tr>

            <td>
              <div class="mneet-student-name">
                ${escapeHTML(name)}
              </div>

              <div class="mneet-student-subtext">
                ${escapeHTML(email)}
              </div>

              <div class="mneet-student-subtext">
                ID: ${escapeHTML(summary.id)}
              </div>
            </td>

            <td>${escapeHTML(phone)}</td>

            <td>${escapeHTML(target)}</td>

            <td>
              ${escapeHTML(courseNames)}
            </td>

            <td>
              ${renderPurchaseStatus(summary)}
            </td>

            <td>
              ${renderCourseAccess(summary)}
            </td>

            <td>
              ${renderAccountStatus(summary)}
            </td>

            <td>
              ${summary.attempts}
            </td>

            <td>
              ${renderProgress(summary)}
            </td>

            <td>
              <button
                type="button"
                class="mneet-students-button"
                data-student-details="${escapeHTML(summary.id)}">
                View Details
              </button>
            </td>

          </tr>
        `;
      }).join("");
    }

    const firstItem = total === 0 ? 0 : startIndex + 1;
    const lastItem = Math.min(startIndex + Students.pageSize, total);

    if (byId("studentsPaginationInfo")) {
      byId("studentsPaginationInfo").textContent =
        "Showing " + firstItem + "–" + lastItem +
        " of " + total + " students";
    }

    if (byId("studentsPrevPage")) {
      byId("studentsPrevPage").disabled =
        Students.currentPage <= 1;
    }

    if (byId("studentsNextPage")) {
      byId("studentsNextPage").disabled =
        Students.currentPage >= pageCount;
    }

    renderStatistics();
  }

  /* =====================================================
     STUDENT DETAILS
  ===================================================== */

  function detailItem(label, value) {
    return `
      <div class="mneet-student-detail-item">
        <div class="mneet-student-detail-label">
          ${escapeHTML(label)}
        </div>
        <div class="mneet-student-detail-value">
          ${escapeHTML(value || "Not available")}
        </div>
      </div>
    `;
  }

  function showStudentDetails(studentId) {
    const panel = byId("studentsDetailsPanel");

    if (!panel) return;

    const student = Students.students.find(function (item) {
      return getStudentId(item, item.id) === studentId;
    });

    if (!student) {
      setMessage("Student record পাওয়া যায়নি।", "error");
      return;
    }

    const summary = getStudentSummary(student);

    const purchaseLines = summary.purchases.map(function (purchase) {
      const courseId = getCourseId(purchase);

      const courseName = courseId
        ? getCourseName(courseId)
        : "Course not specified";

      const paymentStatus = getPaymentStatus(purchase);

      const access = hasCourseAccess(purchase)
        ? "Access Granted"
        : "Access Not Granted";

      const transactionId = safeText(
        getField(
          purchase,
          ["transactionId", "paymentReference", "referenceId", "utr"],
          ""
        )
      );

      let line = courseName +
        " — Payment: " + paymentStatus +
        " — " + access;

      if (transactionId) {
        line += " — Transaction ID: " + transactionId;
      }

      return line;
    });

    const purchaseText = purchaseLines.length
      ? purchaseLines.join("\n")
      : "No purchase records found.";

    const progress = summary.progress === null
      ? "Not available"
      : formatPercent(summary.progress);

    panel.innerHTML = `
      <h4>Student Details</h4>

      <div class="mneet-student-detail-grid">

        ${detailItem("Full Name", summary.name)}
        ${detailItem("Student ID", summary.id)}
        ${detailItem("Email", summary.email)}
        ${detailItem("Phone Number", summary.phone)}
        ${detailItem("Target", summary.target)}
        ${detailItem("Account Status", summary.accountStatus)}
        ${detailItem("Quiz Attempts", String(summary.attempts))}
        ${detailItem("Available Progress", progress)}
        ${detailItem("Registered On", formatDate(
          getField(student, ["createdAt", "registeredAt"], null)
        ))}
        ${detailItem("Purchased Course Records", purchaseText)}

      </div>
    `;

    panel.hidden = false;

    panel.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }

  /* =====================================================
     EVENTS
  ===================================================== */

  function setupEvents() {
    const search = byId("studentsSearch");
    const course = byId("studentsCourseFilter");
    const account = byId("studentsAccountFilter");
    const body = byId("studentsTableBody");
    const previous = byId("studentsPrevPage");
    const next = byId("studentsNextPage");

    if (search) {
      search.addEventListener("input", function () {
        Students.searchText = search.value;
        Students.currentPage = 1;
        renderTable();
      });
    }

    if (course) {
      course.addEventListener("change", function () {
        Students.courseFilter = course.value;
        Students.currentPage = 1;

        renderStatistics();
        renderTable();
      });
    }

    if (account) {
      account.addEventListener("change", function () {
        Students.accountFilter = account.value;
        Students.currentPage = 1;
        renderTable();
      });
    }

    if (body) {
      body.addEventListener("click", function (event) {
        const button = event.target.closest("[data-student-details]");

        if (!button) return;

        if (!isAuthorized()) {
          setMessage("Admin authorization প্রয়োজন।", "error");
          return;
        }

        showStudentDetails(button.dataset.studentDetails);
      });
    }

    if (previous) {
      previous.addEventListener("click", function () {
        if (Students.currentPage > 1) {
          Students.currentPage--;
          renderTable();
        }
      });
    }

    if (next) {
      next.addEventListener("click", function () {
        const total = getFilteredStudents().length;

        const pageCount = Math.max(
          1,
          Math.ceil(total / Students.pageSize)
        );

        if (Students.currentPage < pageCount) {
          Students.currentPage++;
          renderTable();
        }
      });
    }
  }

  /* =====================================================
     INITIALIZATION
  ===================================================== */

  function initialize() {
    if (Students.initialized) {
      if (byId("studentsContent")) {
        loadStudentData();
      }

      return;
    }

    const container = byId("studentsContent");

    if (!container) return;

    if (!renderLayout()) return;

    Students.initialized = true;

    setupEvents();

    if (!initializeFirebase()) return;

    loadStudentData();
  }

  /* =====================================================
     PUBLIC API
  ===================================================== */

  window.MNEETStudents = {
    initialize: initialize,

    refresh: function () {
      return loadStudentData();
    },

    getStudents: function () {
      return Students.students.slice();
    },

    isAuthorized: function () {
      return isAuthorized();
    }
  };

  /*
    Initialize when the Students section is opened.
  */

  document.addEventListener("DOMContentLoaded", initialize);

  document.addEventListener("mneet:admin-page-change", function (event) {
    const page = event.detail && event.detail.page;

    if (page === "students") {
      initialize();
    }
  });

})();
