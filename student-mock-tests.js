/* =========================================================
   mNEET — Student Mock Tests
   File: student-mock-tests.js

   Features:
   - Display published mock tests
   - Filter by purchased course
   - Show duration, marks and schedule
   - Display upcoming, available and completed tests
   - Verify course access before opening a test
   - Start test through the existing student navigation
   - Display previous attempts when available
   - Green and White design system

   This module does not replace the existing quiz system.
   ========================================================= */

(function (window, document) {
  "use strict";

  const MODULE_NAME = "MNEETStudentMockTests";

  const COLLECTIONS = Object.freeze({
    COURSES: "courses",
    PURCHASES: "purchases",
    MOCK_TESTS: "mockTests",
    ATTEMPTS: "mockTestAttempts"
  });

  const APPROVED_STATUSES = [
    "approved",
    "paid",
    "completed"
  ];

  const state = {
    initialized: false,
    loading: false,
    user: null,
    db: null,

    courses: [],
    purchases: [],
    mockTests: [],
    attempts: [],

    selectedCourseId: "all",
    selectedFilter: "all",

    error: "",
    lastUpdated: null
  };

  let eventsBound = false;
  let refreshPromise = null;

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

  async function getCollection(collectionName) {
    const snapshot = await state.db
      .collection(collectionName)
      .get();

    return snapshot.docs.map(function (doc) {
      return Object.assign(
        { id: doc.id },
        doc.data()
      );
    });
  }

  async function getOwnCollection(collectionName) {
    if (!state.user) {
      return [];
    }

    const snapshot = await state.db
      .collection(collectionName)
      .where("userId", "==", state.user.uid)
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

  function normalizeStatus(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function getId(item) {
    return String(
      item && (
        item.id ||
        item.mockTestId ||
        item.courseId
      ) || ""
    );
  }

  function getNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
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

    const date = new Date(value).getTime();

    return Number.isFinite(date) ? date : 0;
  }

  function getErrorMessage(error) {
    const code = String(error && error.code || "");

    if (code.includes("permission-denied")) {
      return "Mock Test পড়ার অনুমতি নেই। Firebase Rules পরীক্ষা করতে হবে।";
    }

    if (code.includes("unauthenticated")) {
      return "Login session শেষ হয়েছে। আবার Login করো।";
    }

    if (code.includes("unavailable")) {
      return "Internet connection পরীক্ষা করে আবার চেষ্টা করো।";
    }

    return error && error.message
      ? error.message
      : "Mock Test-এর তথ্য লোড করা যায়নি।";
  }

  function showMessage(message, type) {
    const container =
      byId("studentMockTestsMessage") ||
      byId("studentMessage");

    if (!container) {
      return;
    }

    container.textContent = String(message || "");
    container.hidden = !message;

    container.classList.remove(
      "is-success",
      "is-error",
      "is-warning",
      "is-info"
    );

    if (type === "success") {
      container.classList.add("is-success");
    } else if (type === "error") {
      container.classList.add("is-error");
    } else if (type === "warning") {
      container.classList.add("is-warning");
    } else {
      container.classList.add("is-info");
    }
  }

  function formatDate(value) {
    const timestamp = getDateValue(value);

    if (!timestamp) {
      return "সময়সূচি দেওয়া নেই";
    }

    return new Date(timestamp).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDuration(minutes) {
    const value = Math.max(0, getNumber(minutes, 0));

    if (value >= 60) {
      const hours = Math.floor(value / 60);
      const remainingMinutes = value % 60;

      return remainingMinutes
        ? hours + " ঘণ্টা " + remainingMinutes + " মিনিট"
        : hours + " ঘণ্টা";
    }

    return value + " মিনিট";
  }

  /* =======================================================
     3. COURSE ACCESS
     ======================================================= */

  function isApprovedPurchase(purchase) {
    const status = normalizeStatus(
      purchase.status ||
      purchase.paymentStatus ||
      purchase.approvalStatus
    );

    return APPROVED_STATUSES.includes(status);
  }

  function getPurchasedCourseIds() {
    const ids = new Set();

    state.purchases.forEach(function (purchase) {
      if (!isApprovedPurchase(purchase)) {
        return;
      }

      const courseId = String(
        purchase.courseId ||
        purchase.courseID ||
        ""
      );

      if (courseId) {
        ids.add(courseId);
      }
    });

    if (ids.size === 0) {
      const studentAPI = window.MNEETStudent;

      if (
        studentAPI &&
        typeof studentAPI.getPurchasedCourses === "function"
      ) {
        try {
          const courses = studentAPI.getPurchasedCourses();

          if (Array.isArray(courses)) {
            courses.forEach(function (course) {
              const courseId = String(
                course.id ||
                course.courseId ||
                ""
              );

              if (courseId) {
                ids.add(courseId);
              }
            });
          }
        } catch (error) {
          // Approved Firestore purchases remain the primary source.
        }
      }
    }

    return ids;
  }

  function hasCourseAccess(courseId) {
    if (!courseId) {
      return false;
    }

    const studentAPI = window.MNEETStudent;

    if (
      studentAPI &&
      typeof studentAPI.hasCourseAccess === "function"
    ) {
      try {
        if (studentAPI.hasCourseAccess(courseId)) {
          return true;
        }
      } catch (error) {
        // Fall back to the purchase records.
      }
    }

    return getPurchasedCourseIds().has(String(courseId));
  }

  function getVisibleCourses() {
    const purchasedIds = getPurchasedCourseIds();

    return state.courses.filter(function (course) {
      return (
        purchasedIds.has(getId(course)) &&
        course.active !== false &&
        course.published !== false
      );
    });
  }

  /* =======================================================
     4. LOAD MOCK TESTS
     ======================================================= */

  async function loadData() {
    const responses = await Promise.all([
      getCollection(COLLECTIONS.COURSES),
      getOwnCollection(COLLECTIONS.PURCHASES),
      getCollection(COLLECTIONS.MOCK_TESTS),
      getOwnCollection(COLLECTIONS.ATTEMPTS)
    ]);

    state.courses = responses[0];
    state.purchases = responses[1];
    state.mockTests = responses[2];
    state.attempts = responses[3];

    state.lastUpdated = new Date();
  }

  function isPublished(test) {
    if (test.active === false || test.published === false) {
      return false;
    }

    if (
      test.status &&
      normalizeStatus(test.status) !== "published"
    ) {
      return false;
    }

    return true;
  }

  function getTestCourseId(test) {
    return String(
      test.courseId ||
      test.courseID ||
      ""
    );
  }

  function getTestTitle(test) {
    return String(
      test.name ||
      test.title ||
      test.testName ||
      "Untitled Mock Test"
    );
  }

  function getTestAttempts(testId) {
    return state.attempts.filter(function (attempt) {
      return String(
        attempt.mockTestId ||
        attempt.testId ||
        ""
      ) === String(testId);
    });
  }

  function getLatestAttempt(testId) {
    const attempts = getTestAttempts(testId).slice();

    attempts.sort(function (a, b) {
      return getDateValue(
        b.createdAt || b.submittedAt || b.completedAt
      ) - getDateValue(
        a.createdAt || a.submittedAt || a.completedAt
      );
    });

    return attempts[0] || null;
  }

  /* =======================================================
     5. TEST STATUS
     ======================================================= */

  function getTestStatus(test) {
    const now = Date.now();

    const start = getDateValue(
      test.startDate ||
      test.startsAt ||
      test.startAt
    );

    const end = getDateValue(
      test.endDate ||
      test.endsAt ||
      test.endAt
    );

    if (start && now < start) {
      return {
        key: "upcoming",
        label: "Upcoming"
      };
    }

    if (end && now > end) {
      return {
        key: "ended",
        label: "Schedule Ended"
      };
    }

    return {
      key: "available",
      label: "Available"
    };
  }

  function getFilteredTests() {
    const visibleCourses = getVisibleCourses();
    const visibleCourseIds = new Set(
      visibleCourses.map(getId)
    );

    let tests = state.mockTests.filter(function (test) {
      const courseId = getTestCourseId(test);

      return (
        isPublished(test) &&
        courseId &&
        visibleCourseIds.has(courseId) &&
        hasCourseAccess(courseId)
      );
    });

    if (state.selectedCourseId !== "all") {
      tests = tests.filter(function (test) {
        return getTestCourseId(test) === state.selectedCourseId;
      });
    }

    if (state.selectedFilter !== "all") {
      tests = tests.filter(function (test) {
        const status = getTestStatus(test);

        if (state.selectedFilter === "completed") {
          return Boolean(getLatestAttempt(getId(test)));
        }

        return status.key === state.selectedFilter;
      });
    }

    tests.sort(function (a, b) {
      const aDate = getDateValue(
        a.startDate || a.startsAt || a.startAt
      );

      const bDate = getDateValue(
        b.startDate || b.startsAt || b.startAt
      );

      return aDate - bDate;
    });

    return tests;
  }

  /* =======================================================
     6. STYLE
     ======================================================= */

  function injectStyles() {
    if (byId("mneetMockTestsStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "mneetMockTestsStyles";

    style.textContent = `
      .mneet-mt {
        padding: 16px;
        color: var(--mn-text, #FFFFFF);
        background: var(--mn-bg, #071A12);
        border-radius: 16px;
      }

      .mneet-mt * {
        box-sizing: border-box;
      }

      .mneet-mt-muted {
        color: var(--mn-text-secondary, #D1D5DB);
        line-height: 1.55;
        font-size: .9rem;
      }

      .mneet-mt-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 16px 0;
      }

      .mneet-mt-select {
        flex: 1 1 180px;
        min-width: 0;
        min-height: 42px;
        border: 1px solid var(--mn-border, #28513A);
        background: var(--mn-input-bg, #10291D);
        color: var(--mn-text, #FFFFFF);
        padding: 10px;
        border-radius: 9px;
        font: inherit;
      }

      .mneet-mt-card {
        padding: 16px;
        margin-bottom: 12px;
        border-radius: 13px;
        border: 1px solid var(--mn-border, #28513A);
        background: var(--mn-card, #0D2419);
      }

      .mneet-mt-card h3 {
        margin: 0 0 8px;
        font-size: 1.1rem;
        overflow-wrap: anywhere;
      }

      .mneet-mt-status {
        display: inline-block;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 20px;
        padding: 5px 10px;
        margin: 10px 0;
        font-size: .82rem;
      }

      .mneet-mt-details {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
        margin: 14px 0;
      }

      .mneet-mt-detail {
        min-width: 0;
        padding: 10px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
      }

      .mneet-mt-detail strong {
        display: block;
        margin-top: 5px;
        overflow-wrap: anywhere;
      }

      .mneet-mt-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .mneet-mt-button {
        padding: 10px 14px;
        min-height: 40px;
        border-radius: 9px;
        border: 1px solid var(--mn-border, #28513A);
        background: var(--mn-card, #0D2419);
        color: var(--mn-text, #FFFFFF);
        font: inherit;
        cursor: pointer;
      }

      .mneet-mt-button-primary {
        background: var(--mn-primary, #16A34A);
        border-color: var(--mn-primary, #16A34A);
        color: #FFFFFF;
      }

      .mneet-mt-button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .mneet-mt-empty {
        border: 1px dashed var(--mn-border, #28513A);
        border-radius: 12px;
        padding: 22px 15px;
        text-align: center;
        line-height: 1.6;
        color: var(--mn-text-secondary, #D1D5DB);
      }

      @media (max-width: 620px) {
        .mneet-mt-details {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     7. RENDER
     ======================================================= */

  function getHost() {
    return (
      byId("studentMockTestsContent") ||
      byId("studentMockTestsPageContent") ||
      byId("studentPageMockTests")
    );
  }

  function renderCourseOptions() {
    return `
      <option value="all">All Purchased Courses</option>
      ${getVisibleCourses().map(function (course) {
        const id = getId(course);

        return `
          <option value="${escapeHTML(id)}"
            ${state.selectedCourseId === id ? "selected" : ""}>
            ${escapeHTML(course.name || course.title || "Course")}
          </option>
        `;
      }).join("")}
    `;
  }

  function renderFilterOptions() {
    const filters = [
      ["all", "All Tests"],
      ["available", "Available Now"],
      ["upcoming", "Upcoming"],
      ["ended", "Schedule Ended"],
      ["completed", "Attempted Tests"]
    ];

    return filters.map(function (filter) {
      return `
        <option value="${filter[0]}"
          ${state.selectedFilter === filter[0] ? "selected" : ""}>
          ${filter[1]}
        </option>
      `;
    }).join("");
  }

  function renderTestCard(test) {
    const testId = getId(test);
    const courseId = getTestCourseId(test);

    const course = state.courses.find(function (item) {
      return getId(item) === courseId;
    });

    const status = getTestStatus(test);
    const latestAttempt = getLatestAttempt(testId);

    const duration = getNumber(
      test.durationMinutes ||
      test.duration ||
      test.timeLimitMinutes,
      0
    );

    const totalMarks = getNumber(
      test.totalMarks ||
      test.maximumMarks ||
      test.marks,
      0
    );

    const questionCount = getNumber(
      test.questionCount ||
      test.totalQuestions,
      0
    );

    const startValue =
      test.startDate ||
      test.startsAt ||
      test.startAt;

    const endValue =
      test.endDate ||
      test.endsAt ||
      test.endAt;

    const attempted = Boolean(latestAttempt);

    const canStart =
      status.key === "available" &&
      !attempted &&
      hasCourseAccess(courseId);

    let actionText = "Start Mock Test";

    if (status.key === "upcoming") {
      actionText = "Not Started Yet";
    } else if (status.key === "ended") {
      actionText = "Schedule Ended";
    } else if (attempted) {
      actionText = "Already Attempted";
    }

    let attemptInfo = "";

    if (latestAttempt) {
      const score = getNumber(
        latestAttempt.score,
        NaN
      );

      const accuracy = getNumber(
        latestAttempt.accuracy,
        NaN
      );

      attemptInfo = `
        <div class="mneet-mt-detail">
          <span class="mneet-mt-muted">Previous Score</span>
          <strong>
            ${Number.isFinite(score)
              ? escapeHTML(score)
              : "Not available"}
          </strong>
        </div>

        <div class="mneet-mt-detail">
          <span class="mneet-mt-muted">Accuracy</span>
          <strong>
            ${Number.isFinite(accuracy)
              ? escapeHTML(accuracy) + "%"
              : "Not available"}
          </strong>
        </div>
      `;
    }

    return `
      <article class="mneet-mt-card">
        <h3>${escapeHTML(getTestTitle(test))}</h3>

        <div class="mneet-mt-muted">
          ${escapeHTML(
            course
              ? course.name || course.title || "Course"
              : "Course"
          )}
        </div>

        <span class="mneet-mt-status">
          ${escapeHTML(status.label)}
        </span>

        ${
          test.description
            ? `<p class="mneet-mt-muted">
                ${escapeHTML(test.description)}
              </p>`
            : ""
        }

        <div class="mneet-mt-details">
          <div class="mneet-mt-detail">
            <span class="mneet-mt-muted">Duration</span>
            <strong>
              ${duration > 0
                ? escapeHTML(formatDuration(duration))
                : "Not specified"}
            </strong>
          </div>

          <div class="mneet-mt-detail">
            <span class="mneet-mt-muted">Total Marks</span>
            <strong>
              ${totalMarks > 0
                ? escapeHTML(totalMarks)
                : "Not specified"}
            </strong>
          </div>

          <div class="mneet-mt-detail">
            <span class="mneet-mt-muted">Questions</span>
            <strong>
              ${questionCount > 0
                ? escapeHTML(questionCount)
                : "Not specified"}
            </strong>
          </div>

          ${attemptInfo}
        </div>

        <div class="mneet-mt-muted">
          Start: ${escapeHTML(formatDate(startValue))}
        </div>

        <div class="mneet-mt-muted">
          End: ${escapeHTML(formatDate(endValue))}
        </div>

        <div class="mneet-mt-actions">
          <button
            type="button"
            class="mneet-mt-button mneet-mt-button-primary"
            data-mneet-mock-action="start"
            data-mneet-mock-id="${escapeHTML(testId)}"
            ${canStart ? "" : "disabled"}>
            ${escapeHTML(actionText)}
          </button>

          ${
            attempted
              ? `<button
                  type="button"
                  class="mneet-mt-button"
                  data-mneet-mock-action="result"
                  data-mneet-mock-id="${escapeHTML(testId)}">
                  View Previous Result
                </button>`
              : ""
          }
        </div>
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
        <section class="mneet-mt">
          <div class="mneet-mt-empty">
            Mock Tests দেখতে Student account দিয়ে Login করো।
          </div>
        </section>
      `;

      return true;
    }

    const tests = getFilteredTests();

    host.innerHTML = `
      <section class="mneet-mt">
        <h2>Mock Tests</h2>

        <p class="mneet-mt-muted">
          তোমার approved course-এর প্রকাশিত Mock Test এখানে দেখা যাবে।
        </p>

        <div class="mneet-mt-toolbar">
          <select id="mneetMockCourseFilter"
            class="mneet-mt-select"
            aria-label="Filter by course">
            ${renderCourseOptions()}
          </select>

          <select id="mneetMockStatusFilter"
            class="mneet-mt-select"
            aria-label="Filter by test status">
            ${renderFilterOptions()}
          </select>
        </div>

        <div id="mneetMockTestList">
          ${
            tests.length
              ? tests.map(renderTestCard).join("")
              : `
                <div class="mneet-mt-empty">
                  এই filter-এর জন্য কোনো Mock Test পাওয়া যায়নি।
                  Admin প্রকাশিত test যোগ করলে এখানে দেখা যাবে।
                </div>
              `
          }
        </div>

        <p class="mneet-mt-muted">
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
     8. START TEST / VIEW RESULT
     ======================================================= */

  function startTest(testId) {
    const test = state.mockTests.find(function (item) {
      return getId(item) === String(testId);
    });

    if (!test || !isPublished(test)) {
      showMessage("এই Mock Test পাওয়া যায়নি।", "error");
      return;
    }

    const courseId = getTestCourseId(test);

    if (!hasCourseAccess(courseId)) {
      showMessage(
        "এই course-এর access নেই। Admin payment approval প্রয়োজন।",
        "warning"
      );
      return;
    }

    const status = getTestStatus(test);

    if (status.key !== "available") {
      showMessage(
        "এই Mock Test এখন শুরু করা যাবে না। Schedule পরীক্ষা করো।",
        "warning"
      );
      return;
    }

    const existingAttempt = getLatestAttempt(testId);

    if (existingAttempt) {
      showMessage(
        "এই test-এর একটি attempt পাওয়া গেছে। Previous result দেখো।",
        "warning"
      );
      return;
    }

    try {
      localStorage.setItem("activeMockTest", String(testId));
      localStorage.setItem("activeCourse", courseId);
    } catch (error) {
      // Navigation can continue using the module API.
    }

    const detail = {
      mockTestId: String(testId),
      testId: String(testId),
      courseId: courseId,
      mockTest: test
    };

    document.dispatchEvent(
      new CustomEvent("mneet:mock-test-start-request", {
        detail: detail
      })
    );

    const student = window.MNEETStudent;

    if (student && typeof student.navigateTo === "function") {
      student.navigateTo("mockTest", detail);

      showMessage(
        "Mock Test page খুলতে চেষ্টা করা হয়েছে। Student Panel integration না থাকলে navigation যুক্ত করতে হবে।",
        "info"
      );

      return;
    }

    showMessage(
      "Mock Test list প্রস্তুত। Test চালানোর জন্য mock-test quiz interface integration প্রয়োজন।",
      "warning"
    );
  }

  function viewResult(testId) {
    const attempt = getLatestAttempt(testId);

    if (!attempt) {
      showMessage("Previous result পাওয়া যায়নি।", "warning");
      return;
    }

    try {
      localStorage.setItem(
        "activeMockTestAttempt",
        String(attempt.id || "")
      );

      localStorage.setItem(
        "activeMockTest",
        String(testId)
      );
    } catch (error) {
      // Continue with the navigation API.
    }

    document.dispatchEvent(
      new CustomEvent("mneet:mock-test-result-request", {
        detail: {
          mockTestId: String(testId),
          attempt: attempt
        }
      })
    );

    const student = window.MNEETStudent;

    if (student && typeof student.navigateTo === "function") {
      student.navigateTo("results", {
        mockTestId: String(testId),
        attempt: attempt
      });

      return;
    }

    showMessage(
      "Previous result data পাওয়া গেছে, কিন্তু result page integration দরকার।",
      "info"
    );
  }

  /* =======================================================
     9. EVENT HANDLERS
     ======================================================= */

  function handleClick(event) {
    const button = event.target.closest("[data-mneet-mock-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.mneetMockAction;
    const testId = button.dataset.mneetMockId;

    if (action === "start") {
      startTest(testId);
    } else if (action === "result") {
      viewResult(testId);
    }
  }

  function handleChange(event) {
    if (event.target.id === "mneetMockCourseFilter") {
      state.selectedCourseId = event.target.value || "all";
      render();
    }

    if (event.target.id === "mneetMockStatusFilter") {
      state.selectedFilter = event.target.value || "all";
      render();
    }
  }

  /* =======================================================
     10. REFRESH
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
          state.courses = [];
          state.purchases = [];
          state.mockTests = [];
          state.attempts = [];

          render();
          return false;
        }

        await loadData();
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
     11. INITIALIZE
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
      document.addEventListener("change", handleChange);

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

          if (page.includes("mock")) {
            refresh();
          }
        }
      );
    }

    return refresh();
  }

  /* =======================================================
     12. PUBLIC API
     ======================================================= */

  window[MODULE_NAME] = Object.freeze({
    initialize: initialize,
    refresh: refresh,
    render: render,

    getTests: function () {
      return state.mockTests.slice();
    },

    getFilteredTests: getFilteredTests,

    getAttempts: function () {
      return state.attempts.slice();
    },

    getLatestAttempt: getLatestAttempt,

    hasCourseAccess: hasCourseAccess,

    startTest: startTest,

    viewResult: viewResult,

    getState: function () {
      return {
        initialized: state.initialized,
        loading: state.loading,
        selectedCourseId: state.selectedCourseId,
        selectedFilter: state.selectedFilter,
        testCount: state.mockTests.length,
        attemptCount: state.attempts.length,
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
