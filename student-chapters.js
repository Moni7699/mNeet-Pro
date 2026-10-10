/* =========================================================
   mNEET STUDENT CHAPTERS
   File: student-chapters.js

   Purpose:
   - Display chapters belonging to an approved course.
   - Filter chapters by course and subject.
   - Keep chapter order.
   - Display chapter progress when available.
   - Open the selected chapter's topics.
   - Never modify Admin-created chapter records.
   ========================================================= */

(function () {
  "use strict";

  const MODULE_NAME = "MNEETStudentChapters";

  const COLLECTIONS = {
    courses: "courses",
    subjects: "subjects",
    chapters: "chapters",
    topics: "topics",
    purchases: "purchases",
    quizAttempts: "quizAttempts",
    quizResults: "quizResults"
  };

  const state = {
    initialized: false,
    loading: false,
    currentUser: null,
    courseId: "",
    subjectId: "",
    chapters: [],
    topics: [],
    courses: [],
    subjects: [],
    purchases: [],
    attempts: [],
    results: [],
    error: ""
  };

  let db = null;
  let auth = null;
  let eventHandlersReady = false;
  let stylesAdded = false;

  /* ---------------------------------------------------------
     BASIC HELPERS
     --------------------------------------------------------- */

  function getFirebase() {
    if (window.MNEETFirebase) {
      db = window.MNEETFirebase.db || db;
      auth = window.MNEETFirebase.auth || auth;
    }

    if (!db && window.firebase && firebase.firestore) {
      db = firebase.firestore();
    }

    if (!auth && window.firebase && firebase.auth) {
      auth = firebase.auth();
    }

    return Boolean(db && auth);
  }

  function getStudentAPI() {
    return window.MNEETStudent || null;
  }

  function getCurrentUser() {
    const api = getStudentAPI();

    if (api && typeof api.getCurrentUser === "function") {
      const user = api.getCurrentUser();

      if (user) {
        state.currentUser = user;
        return user;
      }
    }

    if (auth && auth.currentUser) {
      state.currentUser = auth.currentUser;
      return auth.currentUser;
    }

    return state.currentUser;
  }

  function getDocumentId(item) {
    if (!item || typeof item !== "object") {
      return "";
    }

    return String(
      item.id ||
      item.chapterId ||
      item.subjectId ||
      item.courseId ||
      item.topicId ||
      ""
    );
  }

  function getName(item) {
    if (!item || typeof item !== "object") {
      return "Untitled";
    }

    return String(
      item.name ||
      item.title ||
      item.chapterName ||
      item.subjectName ||
      "Untitled"
    );
  }

  function getNumber(value) {
    const number = Number(value);

    return Number.isFinite(number) ? number : 0;
  }

  function getOrder(item) {
    if (!item) {
      return 0;
    }

    return getNumber(
      item.order !== undefined
        ? item.order
        : item.chapterOrder
    );
  }

  function sortByOrder(items) {
    return items.slice().sort(function (a, b) {
      const orderDifference = getOrder(a) - getOrder(b);

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return getName(a).localeCompare(getName(b));
    });
  }

  function isActive(item) {
    if (!item) {
      return false;
    }

    return item.active !== false &&
      item.published !== false &&
      item.isActive !== false;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatText(value) {
    const text = String(value || "").trim();

    return text
      ? escapeHTML(text)
      : "";
  }

  function showMessage(message, type) {
    const text = String(message || "");
    const api = getStudentAPI();

    if (api && typeof api.showMessage === "function") {
      api.showMessage(text, type || "info");
      return;
    }

    const container = getContainer();

    if (!container) {
      return;
    }

    let notice = container.querySelector(
      ".mneet-chapter-notice"
    );

    if (!notice) {
      notice = document.createElement("div");
      notice.className = "mneet-chapter-notice";
      notice.setAttribute("role", "status");

      container.prepend(notice);
    }

    notice.textContent = text;
  }

  function getContainer() {
    return document.getElementById("studentChaptersContent") ||
      document.getElementById("studentChapterList") ||
      document.getElementById("studentChaptersList") ||
      document.getElementById("studentStudyContent") ||
      document.getElementById("studentStudyPageContent") ||
      document.getElementById("studentPageChapters") ||
      document.getElementById("studentPageStudy");
  }

  function getSelectedCourseId() {
    if (state.courseId) {
      return state.courseId;
    }

    const api = getStudentAPI();

    if (api && typeof api.getActiveCourseId === "function") {
      const courseId = api.getActiveCourseId();

      if (courseId) {
        return String(courseId);
      }
    }

    return localStorage.getItem("activeCourse") || "";
  }

  function getSelectedSubjectId() {
    if (state.subjectId) {
      return state.subjectId;
    }

    return localStorage.getItem("activeSubject") || "";
  }

  function getRelatedId(item, possibleFields) {
    if (!item) {
      return "";
    }

    for (const field of possibleFields) {
      if (
        item[field] !== undefined &&
        item[field] !== null &&
        String(item[field]).trim() !== ""
      ) {
        return String(item[field]);
      }
    }

    return "";
  }

  function belongsToCourse(item, courseId) {
    if (!item || !courseId) {
      return false;
    }

    const itemCourseId = getRelatedId(item, [
      "courseId",
      "courseID",
      "parentCourseId"
    ]);

    return itemCourseId === String(courseId);
  }

  function belongsToSubject(item, subjectId) {
    if (!item || !subjectId) {
      return false;
    }

    const itemSubjectId = getRelatedId(item, [
      "subjectId",
      "subjectID",
      "parentSubjectId"
    ]);

    return itemSubjectId === String(subjectId);
  }

  function belongsToChapter(item, chapterId) {
    if (!item || !chapterId) {
      return false;
    }

    const itemChapterId = getRelatedId(item, [
      "chapterId",
      "chapterID",
      "parentChapterId"
    ]);

    return itemChapterId === String(chapterId);
  }

  /* ---------------------------------------------------------
     FIRESTORE HELPERS
     --------------------------------------------------------- */

  async function readCollection(collectionName) {
    if (!db) {
      throw new Error("Firebase Firestore is not initialized.");
    }

    const snapshot = await db
      .collection(collectionName)
      .get();

    return snapshot.docs.map(function (doc) {
      return {
        id: doc.id,
        ...doc.data()
      };
    });
  }

  async function readUserPurchases(userId) {
    if (!db || !userId) {
      return [];
    }

    try {
      const snapshot = await db
        .collection(COLLECTIONS.purchases)
        .where("userId", "==", userId)
        .get();

      return snapshot.docs.map(function (doc) {
        return {
          id: doc.id,
          ...doc.data()
        };
      });
    } catch (error) {
      console.error(
        "[mNEET Chapters] Could not read purchases:",
        error
      );

      throw error;
    }
  }

  /* ---------------------------------------------------------
     PURCHASE AND COURSE ACCESS
     --------------------------------------------------------- */

  function isApprovedPurchase(purchase) {
    if (!purchase) {
      return false;
    }

    const status = String(
      purchase.status ||
      purchase.paymentStatus ||
      purchase.approvalStatus ||
      ""
    ).toLowerCase();

    return [
      "approved",
      "paid",
      "completed"
    ].includes(status);
  }

  function getApprovedCourseIds() {
    const ids = new Set();

    state.purchases.forEach(function (purchase) {
      if (!isApprovedPurchase(purchase)) {
        return;
      }

      const courseId = getRelatedId(purchase, [
        "courseId",
        "courseID"
      ]);

      if (courseId) {
        ids.add(courseId);
      }
    });

    const api = getStudentAPI();

    if (
      ids.size === 0 &&
      api &&
      typeof api.getPurchasedCourses === "function"
    ) {
      const courses = api.getPurchasedCourses();

      if (Array.isArray(courses)) {
        courses.forEach(function (course) {
          const id = getDocumentId(course);

          if (id) {
            ids.add(id);
          }
        });
      }
    }

    return ids;
  }

  function hasCourseAccess(courseId) {
    if (!courseId) {
      return false;
    }

    const api = getStudentAPI();

    if (
      api &&
      typeof api.hasCourseAccess === "function"
    ) {
      try {
        if (api.hasCourseAccess(courseId)) {
          return true;
        }
      } catch (error) {
        console.warn(
          "[mNEET Chapters] Student access check:",
          error
        );
      }
    }

    return getApprovedCourseIds().has(String(courseId));
  }

  function getActiveCourse(courseId) {
    return state.courses.find(function (course) {
      return getDocumentId(course) === String(courseId);
    }) || null;
  }

  function isCourseAvailable(course) {
    if (!course || !isActive(course)) {
      return false;
    }

    return true;
  }

  /* ---------------------------------------------------------
     DATA LOADING
     --------------------------------------------------------- */

  async function loadRequiredData() {
    const user = getCurrentUser();

    if (!user || !user.uid) {
      throw new Error("Please sign in to view your chapters.");
    }

    if (!getFirebase()) {
      throw new Error("Firebase is not ready. Please reload the page.");
    }

    const results = await Promise.all([
      readCollection(COLLECTIONS.courses),
      readCollection(COLLECTIONS.subjects),
      readCollection(COLLECTIONS.chapters),
      readCollection(COLLECTIONS.topics),
      readUserPurchases(user.uid)
    ]);

    state.courses = results[0];
    state.subjects = results[1];
    state.chapters = results[2];
    state.topics = results[3];
    state.purchases = results[4];
  }

  async function loadProgressData() {
    const user = getCurrentUser();

    if (!user || !db) {
      state.attempts = [];
      state.results = [];
      return;
    }

    const tasks = [
      db.collection(COLLECTIONS.quizAttempts)
        .where("userId", "==", user.uid)
        .get()
        .then(function (snapshot) {
          state.attempts = snapshot.docs.map(function (doc) {
            return {
              id: doc.id,
              ...doc.data()
            };
          });
        })
        .catch(function (error) {
          console.warn(
            "[mNEET Chapters] Quiz attempts unavailable:",
            error
          );

          state.attempts = [];
        }),

      db.collection(COLLECTIONS.quizResults)
        .where("userId", "==", user.uid)
        .get()
        .then(function (snapshot) {
          state.results = snapshot.docs.map(function (doc) {
            return {
              id: doc.id,
              ...doc.data()
            };
          });
        })
        .catch(function (error) {
          console.warn(
            "[mNEET Chapters] Quiz results unavailable:",
            error
          );

          state.results = [];
        })
    ];

    await Promise.all(tasks);
  }

  function getChaptersForSelection(courseId, subjectId) {
    return sortByOrder(
      state.chapters.filter(function (chapter) {
        if (!isActive(chapter)) {
          return false;
        }

        if (!belongsToCourse(chapter, courseId)) {
          return false;
        }

        if (subjectId && !belongsToSubject(chapter, subjectId)) {
          return false;
        }

        return true;
      })
    );
  }

  function getTopicsForChapter(chapterId) {
    return state.topics.filter(function (topic) {
      return isActive(topic) &&
        belongsToChapter(topic, chapterId);
    });
  }

  /* ---------------------------------------------------------
     CHAPTER PROGRESS
     --------------------------------------------------------- */

  function itemMatchesChapter(item, chapterId) {
    if (!item || !chapterId) {
      return false;
    }

    if (belongsToChapter(item, chapterId)) {
      return true;
    }

    const nested = item.chapter &&
      typeof item.chapter === "object"
      ? item.chapter
      : null;

    if (nested && getDocumentId(nested) === chapterId) {
      return true;
    }

    return false;
  }

  function getChapterProgress(chapter) {
    const chapterId = getDocumentId(chapter);

    const topics = getTopicsForChapter(chapterId);

    if (!topics.length) {
      return {
        percentage: 0,
        completed: 0,
        total: 0
      };
    }

    const topicIds = new Set(
      topics.map(getDocumentId).filter(Boolean)
    );

    const topicProgress = new Map();

    function updateTopicProgress(item) {
      const topicId = getRelatedId(item, [
        "topicId",
        "topicID",
        "parentTopicId"
      ]);

      if (!topicId || !topicIds.has(topicId)) {
        return;
      }

      const explicitProgress = Number(
        item.completionPercentage !== undefined
          ? item.completionPercentage
          : item.progressPercentage !== undefined
            ? item.progressPercentage
            : item.progress
      );

      const completed = item.completed === true ||
        item.isCompleted === true ||
        item.status === "completed" ||
        (
          Number.isFinite(explicitProgress) &&
          explicitProgress >= 100
        );

      if (completed) {
        topicProgress.set(topicId, 100);
        return;
      }

      if (
        Number.isFinite(explicitProgress) &&
        explicitProgress >= 0
      ) {
        const previous = topicProgress.get(topicId) || 0;

        topicProgress.set(
          topicId,
          Math.max(
            previous,
            Math.min(100, explicitProgress)
          )
        );
      }
    }

    state.results.forEach(updateTopicProgress);
    state.attempts.forEach(updateTopicProgress);

    let completed = 0;
    let totalProgress = 0;

    topics.forEach(function (topic) {
      const topicId = getDocumentId(topic);
      const percentage = topicProgress.get(topicId) || 0;

      totalProgress += percentage;

      if (percentage >= 100) {
        completed += 1;
      }
    });

    return {
      percentage: Math.round(totalProgress / topics.length),
      completed: completed,
      total: topics.length
    };
  }

  /* ---------------------------------------------------------
     NAVIGATION
     --------------------------------------------------------- */

  function openTopics(chapter) {
    const courseId = getSelectedCourseId();
    const subjectId = getSelectedSubjectId();
    const chapterId = getDocumentId(chapter);

    if (!courseId || !chapterId) {
      showMessage(
        "Chapter information is incomplete. Please go back and select the course again.",
        "error"
      );

      return false;
    }

    if (!hasCourseAccess(courseId)) {
      showMessage(
        "This course is locked. Access is available after Admin approves your payment.",
        "error"
      );

      return false;
    }

    localStorage.setItem("activeCourse", courseId);
    localStorage.setItem("activeChapter", chapterId);

    if (subjectId) {
      localStorage.setItem("activeSubject", subjectId);
    }

    const api = getStudentAPI();

    if (api && typeof api.navigateTo === "function") {
      api.navigateTo("topics", {
        courseId: courseId,
        subjectId: subjectId,
        chapterId: chapterId,
        chapter: chapter
      });

      return true;
    }

    if (api && typeof api.showPage === "function") {
      api.showPage("topics");
      return true;
    }

    showMessage(
      "The Topics page navigation is not connected yet. Check student.js and student.html.",
      "error"
    );

    return false;
  }

  function goBack() {
    const api = getStudentAPI();

    if (api && typeof api.navigateTo === "function") {
      api.navigateTo("study", {
        courseId: getSelectedCourseId(),
        subjectId: getSelectedSubjectId()
      });

      return;
    }

    if (api && typeof api.showPage === "function") {
      api.showPage("study");
      return;
    }

    window.history.back();
  }

  /* ---------------------------------------------------------
     STYLES
     --------------------------------------------------------- */

  function addStyles() {
    if (stylesAdded || document.getElementById("mneet-chapters-styles")) {
      stylesAdded = true;
      return;
    }

    const style = document.createElement("style");
    style.id = "mneet-chapters-styles";

    style.textContent = `
      .mneet-chapters-wrap {
        width: 100%;
        color: #FFFFFF;
      }

      .mneet-chapters-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .mneet-chapters-heading {
        margin: 0;
        color: #FFFFFF;
        font-size: clamp(21px, 4vw, 28px);
        font-weight: 800;
      }

      .mneet-chapters-subtitle {
        margin: 7px 0 0;
        color: #D1D5DB;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .mneet-chapters-back,
      .mneet-chapter-open {
        min-height: 42px;
        padding: 10px 15px;
        border: 1px solid #28513A;
        border-radius: 11px;
        background: #10291D;
        color: #FFFFFF;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .mneet-chapter-open {
        background: #16A34A;
        border-color: #16A34A;
        color: #FFFFFF;
        width: 100%;
      }

      .mneet-chapters-back:hover,
      .mneet-chapter-open:hover {
        filter: brightness(1.1);
      }

      .mneet-chapters-course-info {
        padding: 15px;
        margin-bottom: 18px;
        border: 1px solid #28513A;
        border-radius: 15px;
        background: #0D2419;
      }

      .mneet-chapters-course-name {
        margin: 0;
        color: #FFFFFF;
        font-size: 17px;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .mneet-chapters-subject-name {
        margin: 6px 0 0;
        color: #D1D5DB;
        font-size: 14px;
        overflow-wrap: anywhere;
      }

      .mneet-chapters-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(min(100%, 235px), 1fr)
        );
        gap: 14px;
      }

      .mneet-chapter-card {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 13px;
        padding: 16px;
        border: 1px solid #28513A;
        border-radius: 16px;
        background: #0D2419;
      }

      .mneet-chapter-card-top {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .mneet-chapter-number {
        flex: 0 0 42px;
        width: 42px;
        height: 42px;
        display: grid;
        place-items: center;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #10291D;
        color: #22C55E;
        font-weight: 800;
      }

      .mneet-chapter-title {
        min-width: 0;
        margin: 1px 0 0;
        color: #FFFFFF;
        font-size: 16px;
        line-height: 1.5;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .mneet-chapter-description {
        margin: 7px 0 0;
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .mneet-chapter-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        color: #D1D5DB;
        font-size: 12px;
      }

      .mneet-chapter-progress {
        width: 100%;
        height: 7px;
        overflow: hidden;
        border-radius: 20px;
        background: #10291D;
        border: 1px solid #28513A;
      }

      .mneet-chapter-progress-fill {
        height: 100%;
        border-radius: inherit;
        background: #22C55E;
        transition: width 0.2s ease;
      }

      .mneet-chapters-empty,
      .mneet-chapters-loading,
      .mneet-chapters-error {
        padding: 24px 16px;
        border: 1px solid #28513A;
        border-radius: 15px;
        background: #0D2419;
        color: #D1D5DB;
        text-align: center;
        line-height: 1.7;
      }

      .mneet-chapter-notice {
        padding: 12px;
        margin-bottom: 14px;
        border: 1px solid #28513A;
        border-radius: 10px;
        background: #10291D;
        color: #FFFFFF;
        overflow-wrap: anywhere;
      }

      @media (max-width: 480px) {
        .mneet-chapter-card {
          padding: 13px;
        }

        .mneet-chapters-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `;

    document.head.appendChild(style);
    stylesAdded = true;
  }

  /* ---------------------------------------------------------
     RENDERING
     --------------------------------------------------------- */

  function renderLoading() {
    const container = getContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="mneet-chapters-loading">
        Loading chapters...
      </div>
    `;
  }

  function renderError(message) {
    const container = getContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="mneet-chapters-error">
        <p>${escapeHTML(message)}</p>
        <button
          type="button"
          class="mneet-chapters-back"
          data-mneet-chapter-retry
        >
          Try Again
        </button>
      </div>
    `;
  }

  function renderEmpty() {
    const container = getContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="mneet-chapters-empty">
        <strong>No chapters available</strong>
        <p>
          No published chapters were found for this course and subject.
          Please check again later.
        </p>
        <button
          type="button"
          class="mneet-chapters-back"
          data-mneet-chapters-back
        >
          Back
        </button>
      </div>
    `;
  }

  function renderChapters() {
    const container = getContainer();

    if (!container) {
      console.warn(
        "[mNEET Chapters] Chapter container was not found in student.html."
      );

      return;
    }

    addStyles();

    const courseId = getSelectedCourseId();
    const subjectId = getSelectedSubjectId();

    state.courseId = courseId;
    state.subjectId = subjectId;

    if (!courseId) {
      container.innerHTML = `
        <div class="mneet-chapters-empty">
          <strong>Select a course first</strong>
          <p>
            Open a purchased course and then select a subject
            to view its chapters.
          </p>
          <button
            type="button"
            class="mneet-chapters-back"
            data-mneet-chapters-back
          >
            Back to Study
          </button>
        </div>
      `;

      return;
    }

    if (!hasCourseAccess(courseId)) {
      container.innerHTML = `
        <div class="mneet-chapters-empty">
          <strong>Course locked</strong>
          <p>
            Chapter access will be available after Admin approves
            your course payment.
          </p>
          <button
            type="button"
            class="mneet-chapters-back"
            data-mneet-chapters-back
          >
            Back
          </button>
        </div>
      `;

      return;
    }

    const course = getActiveCourse(courseId);

    if (!isCourseAvailable(course)) {
      container.innerHTML = `
        <div class="mneet-chapters-empty">
          <strong>Course unavailable</strong>
          <p>This course is not currently available.</p>
          <button
            type="button"
            class="mneet-chapters-back"
            data-mneet-chapters-back
          >
            Back
          </button>
        </div>
      `;

      return;
    }

    const subject = state.subjects.find(function (item) {
      return getDocumentId(item) === subjectId;
    }) || null;

    const chapters = getChaptersForSelection(
      courseId,
      subjectId
    );

    state.chaptersForView = chapters;

    if (!chapters.length) {
      renderEmpty();
      return;
    }

    const courseName = getName(course);
    const subjectName = subject ? getName(subject) : "Chapters";

    const chapterCards = chapters.map(function (chapter, index) {
      const chapterId = getDocumentId(chapter);
      const title = getName(chapter);
      const description = chapter.description ||
        chapter.shortDescription ||
        "";

      const progress = getChapterProgress(chapter);
      const topicCount = getTopicsForChapter(chapterId).length;

      const chapterNumber = getOrder(chapter) > 0
        ? getOrder(chapter)
        : index + 1;

      return `
        <article class="mneet-chapter-card">
          <div class="mneet-chapter-card-top">
            <div class="mneet-chapter-number">
              ${escapeHTML(chapterNumber)}
            </div>

            <div style="min-width:0;flex:1">
              <h3 class="mneet-chapter-title">
                ${escapeHTML(title)}
              </h3>

              ${
                description
                  ? `<p class="mneet-chapter-description">
                       ${formatText(description)}
                     </p>`
                  : ""
              }
            </div>
          </div>

          <div class="mneet-chapter-meta">
            <span>
              ${topicCount} ${topicCount === 1 ? "Topic" : "Topics"}
            </span>

            <span>
              ${progress.percentage}% complete
            </span>
          </div>

          <div
            class="mneet-chapter-progress"
            role="progressbar"
            aria-label="${escapeHTML(title)} progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="${progress.percentage}"
          >
            <div
              class="mneet-chapter-progress-fill"
              style="width:${progress.percentage}%"
            ></div>
          </div>

          <button
            type="button"
            class="mneet-chapter-open"
            data-mneet-open-chapter="${escapeHTML(chapterId)}"
          >
            Open Chapter
          </button>
        </article>
      `;
    }).join("");

    container.innerHTML = `
      <div class="mneet-chapters-wrap">
        <header class="mneet-chapters-header">
          <div>
            <h2 class="mneet-chapters-heading">
              Chapters
            </h2>

            <p class="mneet-chapters-subtitle">
              Select a chapter to view its topics and practice.
            </p>
          </div>

          <button
            type="button"
            class="mneet-chapters-back"
            data-mneet-chapters-back
          >
            Back
          </button>
        </header>

        <section class="mneet-chapters-course-info">
          <h3 class="mneet-chapters-course-name">
            ${escapeHTML(courseName)}
          </h3>

          <p class="mneet-chapters-subject-name">
            Subject: ${escapeHTML(subjectName)}
          </p>
        </section>

        <div class="mneet-chapters-grid">
          ${chapterCards}
        </div>
      </div>
    `;
  }

  /* ---------------------------------------------------------
     EVENT HANDLERS
     --------------------------------------------------------- */

  function setupEventHandlers() {
    if (eventHandlersReady) {
      return;
    }

    document.addEventListener("click", function (event) {
      const chapterButton = event.target.closest(
        "[data-mneet-open-chapter]"
      );

      if (chapterButton) {
        const chapterId = chapterButton.getAttribute(
          "data-mneet-open-chapter"
        );

        const chapter = state.chapters.find(function (item) {
          return getDocumentId(item) === chapterId;
        });

        if (chapter) {
          openTopics(chapter);
        }

        return;
      }

      const backButton = event.target.closest(
        "[data-mneet-chapters-back]"
      );

      if (backButton) {
        goBack();
        return;
      }

      const retryButton = event.target.closest(
        "[data-mneet-chapter-retry]"
      );

      if (retryButton) {
        refresh();
      }
    });

    document.addEventListener(
      "mneet:student-page-change",
      function (event) {
        const detail = event.detail || {};
        const page = String(
          detail.page ||
          detail.name ||
          ""
        ).toLowerCase();

        if (
          page.includes("chapter") ||
          page === "study"
        ) {
          const courseId =
            detail.courseId ||
            (detail.data && detail.data.courseId);

          const subjectId =
            detail.subjectId ||
            (detail.data && detail.data.subjectId);

          if (courseId) {
            state.courseId = String(courseId);
            localStorage.setItem(
              "activeCourse",
              state.courseId
            );
          }

          if (subjectId) {
            state.subjectId = String(subjectId);
            localStorage.setItem(
              "activeSubject",
              state.subjectId
            );
          }

          refresh();
        }
      }
    );

    document.addEventListener(
      "mneet:student-ready",
      function () {
        initialize();
      }
    );

    eventHandlersReady = true;
  }

  /* ---------------------------------------------------------
     INITIALIZATION
     --------------------------------------------------------- */

  async function initialize(options) {
    options = options || {};

    if (options.courseId) {
      state.courseId = String(options.courseId);
      localStorage.setItem(
        "activeCourse",
        state.courseId
      );
    }

    if (options.subjectId) {
      state.subjectId = String(options.subjectId);
      localStorage.setItem(
        "activeSubject",
        state.subjectId
      );
    }

    if (options.chapterId) {
      localStorage.setItem(
        "activeChapter",
        String(options.chapterId)
      );
    }

    addStyles();
    setupEventHandlers();

    if (!getFirebase()) {
      state.error = "Firebase is not initialized.";
      renderError(state.error);
      return false;
    }

    state.currentUser = getCurrentUser();

    if (!state.currentUser) {
      state.error = "Please sign in to view chapters.";
      renderError(state.error);
      return false;
    }

    return refresh();
  }

  async function refresh() {
    if (state.loading) {
      return false;
    }

    state.loading = true;
    state.error = "";

    renderLoading();

    try {
      await loadRequiredData();
      await loadProgressData();

      state.courseId = getSelectedCourseId();
      state.subjectId = getSelectedSubjectId();

      renderChapters();

      state.initialized = true;

      return true;
    } catch (error) {
      state.error = error && error.message
        ? error.message
        : "Could not load chapters.";

      console.error(
        "[mNEET Chapters] Refresh failed:",
        error
      );

      renderError(state.error);

      return false;
    } finally {
      state.loading = false;
    }
  }

  /* ---------------------------------------------------------
     PUBLIC API
     --------------------------------------------------------- */

  window[MODULE_NAME] = {
    initialize: initialize,
    refresh: refresh,
    renderChapters: renderChapters,

    getChapters: function () {
      return state.chapters.slice();
    },

    getChaptersForSelection: function () {
      return getChaptersForSelection(
        getSelectedCourseId(),
        getSelectedSubjectId()
      );
    },

    getTopicsForChapter: getTopicsForChapter,
    getChapterProgress: getChapterProgress,
    hasCourseAccess: hasCourseAccess,
    openTopics: openTopics,
    goBack: goBack,

    setSelection: function (courseId, subjectId) {
      state.courseId = String(courseId || "");
      state.subjectId = String(subjectId || "");

      if (state.courseId) {
        localStorage.setItem(
          "activeCourse",
          state.courseId
        );
      }

      if (state.subjectId) {
        localStorage.setItem(
          "activeSubject",
          state.subjectId
        );
      }

      return refresh();
    },

    getState: function () {
      return {
        initialized: state.initialized,
        loading: state.loading,
        courseId: state.courseId,
        subjectId: state.subjectId,
        chapterCount: state.chapters.length,
        error: state.error
      };
    },

    getLastError: function () {
      return state.error;
    }
  };

  /* ---------------------------------------------------------
     AUTO START
     --------------------------------------------------------- */

  function start() {
    setupEventHandlers();

    const api = getStudentAPI();

    if (api && typeof api.isReady === "function") {
      if (api.isReady()) {
        initialize();
      }
    } else if (auth) {
      auth.onAuthStateChanged(function (user) {
        if (user) {
          initialize();
        }
      });
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

})();
