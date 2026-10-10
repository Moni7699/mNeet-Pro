/* =========================================================
   mNEET STUDENT TOPICS
   File: student-topics.js

   Features:
   - Load topics for the selected chapter.
   - Verify approved course access.
   - Display ordered topics.
   - Display topic quiz and notes availability.
   - Display progress when available.
   - Navigate to topic quiz and notes.
   - Read-only access to Admin-created content.
   ========================================================= */

(function () {
  "use strict";

  const MODULE_NAME = "MNEETStudentTopics";

  const COLLECTIONS = {
    courses: "courses",
    subjects: "subjects",
    chapters: "chapters",
    topics: "topics",
    quizzes: "quizzes",
    questions: "questions",
    notes: "notes",
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
    chapterId: "",
    topicId: "",

    courses: [],
    subjects: [],
    chapters: [],
    topics: [],
    quizzes: [],
    notes: [],
    purchases: [],
    attempts: [],
    results: [],

    error: ""
  };

  let db = null;
  let auth = null;
  let eventsReady = false;
  let stylesReady = false;

  /* =========================================================
     FIREBASE
     ========================================================= */

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

  /* =========================================================
     HELPERS
     ========================================================= */

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getId(item) {
    if (!item || typeof item !== "object") {
      return "";
    }

    return String(
      item.id ||
      item.topicId ||
      item.chapterId ||
      item.subjectId ||
      item.courseId ||
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
      item.topicName ||
      item.chapterName ||
      "Untitled"
    );
  }

  function getOrder(item) {
    const value = Number(
      item && item.order !== undefined
        ? item.order
        : 0
    );

    return Number.isFinite(value) ? value : 0;
  }

  function sortByOrder(items) {
    return items.slice().sort(function (a, b) {
      const difference = getOrder(a) - getOrder(b);

      if (difference !== 0) {
        return difference;
      }

      return getName(a).localeCompare(getName(b));
    });
  }

  function isPublished(item) {
    if (!item) {
      return false;
    }

    return item.active !== false &&
      item.published !== false &&
      item.isActive !== false;
  }

  function getRelatedId(item, fields) {
    if (!item) {
      return "";
    }

    for (const field of fields) {
      const value = item[field];

      if (
        value !== undefined &&
        value !== null &&
        String(value).trim() !== ""
      ) {
        return String(value);
      }
    }

    return "";
  }

  function belongsToCourse(item, courseId) {
    return getRelatedId(item, [
      "courseId",
      "courseID",
      "parentCourseId"
    ]) === String(courseId || "");
  }

  function belongsToChapter(item, chapterId) {
    return getRelatedId(item, [
      "chapterId",
      "chapterID",
      "parentChapterId"
    ]) === String(chapterId || "");
  }

  function belongsToTopic(item, topicId) {
    return getRelatedId(item, [
      "topicId",
      "topicID",
      "parentTopicId"
    ]) === String(topicId || "");
  }

  function getContainer() {
    return document.getElementById("studentTopicsContent") ||
      document.getElementById("studentTopicsList") ||
      document.getElementById("studentTopicList") ||
      document.getElementById("studentPageTopics") ||
      document.getElementById("studentTopicPracticeContent") ||
      document.getElementById("studentPageTopicPractice") ||
      document.getElementById("studentStudyContent") ||
      document.getElementById("studentPageStudy");
  }

  function getSelectedCourseId() {
    if (state.courseId) {
      return state.courseId;
    }

    const api = getStudentAPI();

    if (api && typeof api.getActiveCourseId === "function") {
      const value = api.getActiveCourseId();

      if (value) {
        return String(value);
      }
    }

    return localStorage.getItem("activeCourse") || "";
  }

  function getSelectedChapterId() {
    if (state.chapterId) {
      return state.chapterId;
    }

    return localStorage.getItem("activeChapter") || "";
  }

  function getSelectedSubjectId() {
    if (state.subjectId) {
      return state.subjectId;
    }

    return localStorage.getItem("activeSubject") || "";
  }

  function showMessage(message, type) {
    const api = getStudentAPI();

    if (api && typeof api.showMessage === "function") {
      api.showMessage(message, type || "info");
      return;
    }

    const container = getContainer();

    if (!container) {
      return;
    }

    let notice = container.querySelector(
      ".mneet-topics-notice"
    );

    if (!notice) {
      notice = document.createElement("div");
      notice.className = "mneet-topics-notice";
      notice.setAttribute("role", "status");
      container.prepend(notice);
    }

    notice.textContent = String(message || "");
  }

  /* =========================================================
     FIRESTORE READS
     ========================================================= */

  async function readCollection(collectionName) {
    const snapshot = await db
      .collection(collectionName)
      .get();

    return snapshot.docs.map(function (doc) {
      return {
        ...doc.data(),
        id: doc.id
      };
    });
  }

  async function readPurchases(userId) {
    if (!userId) {
      return [];
    }

    const snapshot = await db
      .collection(COLLECTIONS.purchases)
      .where("userId", "==", userId)
      .get();

    return snapshot.docs.map(function (doc) {
      return {
        ...doc.data(),
        id: doc.id
      };
    });
  }

  async function readProgress(collectionName, userId) {
    try {
      const snapshot = await db
        .collection(collectionName)
        .where("userId", "==", userId)
        .get();

      return snapshot.docs.map(function (doc) {
        return {
          ...doc.data(),
          id: doc.id
        };
      });
    } catch (error) {
      console.warn(
        "[mNEET Topics] Could not read " + collectionName,
        error
      );

      return [];
    }
  }

  /* =========================================================
     COURSE ACCESS
     ========================================================= */

  function isApprovedPurchase(purchase) {
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

      const id = getRelatedId(purchase, [
        "courseId",
        "courseID"
      ]);

      if (id) {
        ids.add(id);
      }
    });

    const api = getStudentAPI();

    if (
      ids.size === 0 &&
      api &&
      typeof api.getPurchasedCourses === "function"
    ) {
      const purchasedCourses = api.getPurchasedCourses();

      if (Array.isArray(purchasedCourses)) {
        purchasedCourses.forEach(function (course) {
          const id = getId(course);

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
          "[mNEET Topics] Access check failed:",
          error
        );
      }
    }

    return getApprovedCourseIds().has(String(courseId));
  }

  function getCourse(courseId) {
    return state.courses.find(function (course) {
      return getId(course) === String(courseId);
    }) || null;
  }

  function getChapter(chapterId) {
    return state.chapters.find(function (chapter) {
      return getId(chapter) === String(chapterId);
    }) || null;
  }

  /* =========================================================
     DATA LOADING
     ========================================================= */

  async function loadData() {
    const user = getCurrentUser();

    if (!user || !user.uid) {
      throw new Error("Please sign in to view topics.");
    }

    if (!getFirebase()) {
      throw new Error("Firebase is not initialized.");
    }

    const results = await Promise.all([
      readCollection(COLLECTIONS.courses),
      readCollection(COLLECTIONS.subjects),
      readCollection(COLLECTIONS.chapters),
      readCollection(COLLECTIONS.topics),
      readCollection(COLLECTIONS.quizzes),
      readCollection(COLLECTIONS.notes),
      readPurchases(user.uid)
    ]);

    state.courses = results[0];
    state.subjects = results[1];
    state.chapters = results[2];
    state.topics = results[3];
    state.quizzes = results[4];
    state.notes = results[5];
    state.purchases = results[6];

    const progressResults = await Promise.all([
      readProgress(
        COLLECTIONS.quizAttempts,
        user.uid
      ),
      readProgress(
        COLLECTIONS.quizResults,
        user.uid
      )
    ]);

    state.attempts = progressResults[0];
    state.results = progressResults[1];
  }

  function getTopicsForChapter(chapterId) {
    const courseId = getSelectedCourseId();

    return sortByOrder(
      state.topics.filter(function (topic) {
        if (!isPublished(topic)) {
          return false;
        }

        if (!belongsToChapter(topic, chapterId)) {
          return false;
        }

        if (
          courseId &&
          !belongsToCourse(topic, courseId)
        ) {
          return false;
        }

        return true;
      })
    );
  }

  function getQuizzesForTopic(topicId) {
    return state.quizzes.filter(function (quiz) {
      return isPublished(quiz) &&
        belongsToTopic(quiz, topicId);
    });
  }

  function getNotesForTopic(topicId) {
    return state.notes.filter(function (note) {
      if (!isPublished(note)) {
        return false;
      }

      return belongsToTopic(note, topicId);
    });
  }

  /* =========================================================
     TOPIC PROGRESS
     ========================================================= */

  function getTopicProgress(topicId) {
    const related = state.results
      .concat(state.attempts)
      .filter(function (item) {
        return belongsToTopic(item, topicId);
      });

    if (!related.length) {
      return {
        percentage: 0,
        attempts: 0,
        completed: false
      };
    }

    let highestProgress = 0;
    let completed = false;

    related.forEach(function (item) {
      const raw = item.completionPercentage !== undefined
        ? item.completionPercentage
        : item.progressPercentage !== undefined
          ? item.progressPercentage
          : item.progress;

      const progress = Number(raw);

      if (Number.isFinite(progress)) {
        highestProgress = Math.max(
          highestProgress,
          Math.min(100, Math.max(0, progress))
        );
      }

      if (
        item.completed === true ||
        item.isCompleted === true ||
        item.status === "completed"
      ) {
        completed = true;
      }

      const totalQuestions = Number(
        item.totalQuestions ||
        item.questionCount ||
        0
      );

      const answeredQuestions = Number(
        item.answeredQuestions ||
        item.attemptedQuestions ||
        0
      );

      if (
        totalQuestions > 0 &&
        answeredQuestions >= totalQuestions
      ) {
        completed = true;
        highestProgress = 100;
      }
    });

    if (completed) {
      highestProgress = 100;
    }

    return {
      percentage: Math.round(highestProgress),
      attempts: related.length,
      completed: completed
    };
  }

  /* =========================================================
     NAVIGATION
     ========================================================= */

  function openQuiz(topic) {
    const courseId = getSelectedCourseId();
    const chapterId = getSelectedChapterId();
    const topicId = getId(topic);

    if (!hasCourseAccess(courseId)) {
      showMessage(
        "Your course is locked until Admin approves your payment.",
        "error"
      );

      return false;
    }

    if (!topicId) {
      showMessage("Topic information is missing.", "error");
      return false;
    }

    localStorage.setItem("activeCourse", courseId);
    localStorage.setItem("activeChapter", chapterId);
    localStorage.setItem("activeTopic", topicId);

    const api = getStudentAPI();

    if (api && typeof api.navigateTo === "function") {
      api.navigateTo("topicPractice", {
        courseId: courseId,
        chapterId: chapterId,
        topicId: topicId,
        topic: topic
      });

      return true;
    }

    if (api && typeof api.showPage === "function") {
      api.showPage("topicPractice");
      return true;
    }

    showMessage(
      "Quiz navigation is not connected. Check student.html and student.js.",
      "error"
    );

    return false;
  }

  function openNotes(topic) {
    const courseId = getSelectedCourseId();
    const chapterId = getSelectedChapterId();
    const topicId = getId(topic);

    if (!hasCourseAccess(courseId)) {
      showMessage(
        "Your course is locked until Admin approves your payment.",
        "error"
      );

      return false;
    }

    if (!topicId) {
      showMessage("Topic information is missing.", "error");
      return false;
    }

    localStorage.setItem("activeCourse", courseId);
    localStorage.setItem("activeChapter", chapterId);
    localStorage.setItem("activeTopic", topicId);

    const api = getStudentAPI();

    if (api && typeof api.navigateTo === "function") {
      api.navigateTo("notes", {
        courseId: courseId,
        chapterId: chapterId,
        topicId: topicId,
        topic: topic
      });

      return true;
    }

    if (api && typeof api.showPage === "function") {
      api.showPage("notes");
      return true;
    }

    showMessage(
      "Notes navigation is not connected. Check student.html and student.js.",
      "error"
    );

    return false;
  }

  function goBack() {
    const api = getStudentAPI();

    if (api && typeof api.navigateTo === "function") {
      api.navigateTo("chapters", {
        courseId: getSelectedCourseId(),
        subjectId: getSelectedSubjectId(),
        chapterId: getSelectedChapterId()
      });

      return;
    }

    if (api && typeof api.showPage === "function") {
      api.showPage("study");
      return;
    }

    window.history.back();
  }

  /* =========================================================
     STYLES: GREEN + WHITE ONLY
     ========================================================= */

  function addStyles() {
    if (
      stylesReady ||
      document.getElementById("mneet-student-topics-styles")
    ) {
      stylesReady = true;
      return;
    }

    const style = document.createElement("style");

    style.id = "mneet-student-topics-styles";

    style.textContent = `
      .mneet-topics-wrap {
        width: 100%;
        color: #FFFFFF;
      }

      .mneet-topics-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 20px;
      }

      .mneet-topics-heading {
        margin: 0;
        font-size: clamp(21px, 4vw, 28px);
        line-height: 1.3;
        font-weight: 800;
        color: #FFFFFF;
      }

      .mneet-topics-subtitle {
        margin: 7px 0 0;
        color: #D1D5DB;
        font-size: 14px;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .mneet-topics-course-info {
        margin-bottom: 18px;
        padding: 15px;
        border: 1px solid #28513A;
        border-radius: 15px;
        background: #0D2419;
      }

      .mneet-topics-course-name {
        margin: 0;
        color: #FFFFFF;
        font-size: 16px;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .mneet-topics-chapter-name {
        margin: 6px 0 0;
        color: #D1D5DB;
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .mneet-topics-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(min(100%, 245px), 1fr)
        );
        gap: 14px;
      }

      .mneet-topic-card {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 13px;
        padding: 16px;
        border: 1px solid #28513A;
        border-radius: 16px;
        background: #0D2419;
      }

      .mneet-topic-card-heading {
        display: flex;
        align-items: flex-start;
        gap: 11px;
      }

      .mneet-topic-number {
        flex: 0 0 39px;
        width: 39px;
        height: 39px;
        display: grid;
        place-items: center;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #10291D;
        color: #22C55E;
        font-weight: 800;
      }

      .mneet-topic-title {
        min-width: 0;
        margin: 1px 0 0;
        color: #FFFFFF;
        font-size: 16px;
        line-height: 1.5;
        font-weight: 800;
        overflow-wrap: anywhere;
      }

      .mneet-topic-description {
        margin: 7px 0 0;
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.6;
        overflow-wrap: anywhere;
      }

      .mneet-topic-progress-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        color: #D1D5DB;
        font-size: 12px;
      }

      .mneet-topic-progress-track {
        width: 100%;
        height: 7px;
        overflow: hidden;
        border: 1px solid #28513A;
        border-radius: 20px;
        background: #10291D;
      }

      .mneet-topic-progress-fill {
        height: 100%;
        border-radius: inherit;
        background: #22C55E;
      }

      .mneet-topic-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
        margin-top: auto;
      }

      .mneet-topic-button,
      .mneet-topics-back {
        min-width: 0;
        min-height: 42px;
        padding: 10px 12px;
        border: 1px solid #28513A;
        border-radius: 11px;
        background: #10291D;
        color: #FFFFFF;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
        overflow-wrap: anywhere;
      }

      .mneet-topic-button-primary {
        background: #16A34A;
        border-color: #16A34A;
        color: #FFFFFF;
      }

      .mneet-topic-button:disabled {
        cursor: not-allowed;
        opacity: 0.65;
      }

      .mneet-topic-button:hover,
      .mneet-topics-back:hover {
        filter: brightness(1.1);
      }

      .mneet-topics-empty,
      .mneet-topics-loading,
      .mneet-topics-error {
        padding: 24px 16px;
        border: 1px solid #28513A;
        border-radius: 15px;
        background: #0D2419;
        color: #D1D5DB;
        text-align: center;
        line-height: 1.7;
      }

      .mneet-topics-empty strong,
      .mneet-topics-error strong {
        color: #FFFFFF;
      }

      .mneet-topics-notice {
        margin-bottom: 14px;
        padding: 12px;
        border: 1px solid #28513A;
        border-radius: 10px;
        background: #10291D;
        color: #FFFFFF;
        overflow-wrap: anywhere;
      }

      @media (max-width: 480px) {
        .mneet-topics-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .mneet-topic-card {
          padding: 13px;
        }

        .mneet-topic-actions {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `;

    document.head.appendChild(style);
    stylesReady = true;
  }

  /* =========================================================
     RENDERING
     ========================================================= */

  function renderLoading() {
    const container = getContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="mneet-topics-loading">
        Loading topics...
      </div>
    `;
  }

  function renderError(message) {
    const container = getContainer();

    if (!container) {
      return;
    }

    container.innerHTML = `
      <div class="mneet-topics-error">
        <strong>Unable to load topics</strong>
        <p>${escapeHTML(message)}</p>

        <button
          type="button"
          class="mneet-topics-back"
          data-mneet-topics-retry
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
      <div class="mneet-topics-empty">
        <strong>No topics available</strong>
        <p>
          This chapter has no published topics yet.
          Please check again later.
        </p>

        <button
          type="button"
          class="mneet-topics-back"
          data-mneet-topics-back
        >
          Back to Chapters
        </button>
      </div>
    `;
  }

  function renderTopics() {
    const container = getContainer();

    if (!container) {
      console.warn(
        "[mNEET Topics] Topic container not found in student.html."
      );

      return;
    }

    addStyles();

    const courseId = getSelectedCourseId();
    const chapterId = getSelectedChapterId();

    state.courseId = courseId;
    state.chapterId = chapterId;

    if (!courseId || !chapterId) {
      container.innerHTML = `
        <div class="mneet-topics-empty">
          <strong>Select a chapter first</strong>
          <p>
            Open a course, select a subject, and then select a chapter
            to view its topics.
          </p>

          <button
            type="button"
            class="mneet-topics-back"
            data-mneet-topics-back
          >
            Back
          </button>
        </div>
      `;

      return;
    }

    if (!hasCourseAccess(courseId)) {
      container.innerHTML = `
        <div class="mneet-topics-empty">
          <strong>Course locked</strong>
          <p>
            Your topics will become available after Admin approves
            your payment.
          </p>
        </div>
      `;

      return;
    }

    const course = getCourse(courseId);
    const chapter = getChapter(chapterId);

    if (
      !course ||
      course.active === false ||
      course.published === false
    ) {
      container.innerHTML = `
        <div class="mneet-topics-empty">
          <strong>Course unavailable</strong>
          <p>This course is not currently available.</p>
        </div>
      `;

      return;
    }

    if (!chapter || !isPublished(chapter)) {
      container.innerHTML = `
        <div class="mneet-topics-empty">
          <strong>Chapter unavailable</strong>
          <p>This chapter is not currently available.</p>
        </div>
      `;

      return;
    }

    if (!belongsToCourse(chapter, courseId)) {
      container.innerHTML = `
        <div class="mneet-topics-empty">
          <strong>Chapter mismatch</strong>
          <p>
            This chapter does not belong to the selected course.
            Please return to the course and select the chapter again.
          </p>
        </div>
      `;

      return;
    }

    const topics = getTopicsForChapter(chapterId);

    if (!topics.length) {
      renderEmpty();
      return;
    }

    const cards = topics.map(function (topic, index) {
      const topicId = getId(topic);
      const title = getName(topic);

      const description = topic.description ||
        topic.shortDescription ||
        "";

      const quizzes = getQuizzesForTopic(topicId);
      const notes = getNotesForTopic(topicId);
      const progress = getTopicProgress(topicId);

      const number = getOrder(topic) > 0
        ? getOrder(topic)
        : index + 1;

      const quizLabel = quizzes.length
        ? "Practice Quiz"
        : "Quiz Unavailable";

      const notesLabel = notes.length
        ? "Topic Notes"
        : "Notes Unavailable";

      return `
        <article class="mneet-topic-card">

          <div class="mneet-topic-card-heading">
            <div class="mneet-topic-number">
              ${escapeHTML(number)}
            </div>

            <div style="min-width:0;flex:1">
              <h3 class="mneet-topic-title">
                ${escapeHTML(title)}
              </h3>

              ${
                description
                  ? `<p class="mneet-topic-description">
                       ${escapeHTML(description)}
                     </p>`
                  : ""
              }
            </div>
          </div>

          <div class="mneet-topic-progress-meta">
            <span>
              ${
                progress.completed
                  ? "Completed"
                  : progress.attempts
                    ? progress.attempts + " attempts"
                    : "Not attempted"
              }
            </span>

            <span>${progress.percentage}% complete</span>
          </div>

          <div
            class="mneet-topic-progress-track"
            role="progressbar"
            aria-label="${escapeHTML(title)} progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow="${progress.percentage}"
          >
            <div
              class="mneet-topic-progress-fill"
              style="width:${progress.percentage}%"
            ></div>
          </div>

          <div class="mneet-topic-actions">
            <button
              type="button"
              class="mneet-topic-button mneet-topic-button-primary"
              data-mneet-topic-quiz="${escapeHTML(topicId)}"
              ${quizzes.length ? "" : "disabled"}
            >
              ${escapeHTML(quizLabel)}
            </button>

            <button
              type="button"
              class="mneet-topic-button"
              data-mneet-topic-notes="${escapeHTML(topicId)}"
              ${notes.length ? "" : "disabled"}
            >
              ${escapeHTML(notesLabel)}
            </button>
          </div>

        </article>
      `;
    }).join("");

    container.innerHTML = `
      <div class="mneet-topics-wrap">

        <header class="mneet-topics-header">
          <div>
            <h2 class="mneet-topics-heading">
              Topics
            </h2>

            <p class="mneet-topics-subtitle">
              Choose a topic to practice questions or read notes.
            </p>
          </div>

          <button
            type="button"
            class="mneet-topics-back"
            data-mneet-topics-back
          >
            Back
          </button>
        </header>

        <section class="mneet-topics-course-info">
          <h3 class="mneet-topics-course-name">
            ${escapeHTML(getName(course))}
          </h3>

          <p class="mneet-topics-chapter-name">
            Chapter: ${escapeHTML(getName(chapter))}
          </p>
        </section>

        <div class="mneet-topics-grid">
          ${cards}
        </div>

      </div>
    `;
  }

  /* =========================================================
     EVENT HANDLERS
     ========================================================= */

  function setupEvents() {
    if (eventsReady) {
      return;
    }

    document.addEventListener("click", function (event) {
      const quizButton = event.target.closest(
        "[data-mneet-topic-quiz]"
      );

      if (quizButton) {
        const topicId = quizButton.getAttribute(
          "data-mneet-topic-quiz"
        );

        const topic = state.topics.find(function (item) {
          return getId(item) === topicId;
        });

        if (topic) {
          openQuiz(topic);
        }

        return;
      }

      const notesButton = event.target.closest(
        "[data-mneet-topic-notes]"
      );

      if (notesButton) {
        const topicId = notesButton.getAttribute(
          "data-mneet-topic-notes"
        );

        const topic = state.topics.find(function (item) {
          return getId(item) === topicId;
        });

        if (topic) {
          openNotes(topic);
        }

        return;
      }

      if (
        event.target.closest("[data-mneet-topics-back]")
      ) {
        goBack();
        return;
      }

      if (
        event.target.closest("[data-mneet-topics-retry]")
      ) {
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

        const data = detail.data || {};

        if (
          page.includes("topic") ||
          page.includes("chapter")
        ) {
          const courseId =
            detail.courseId || data.courseId;

          const chapterId =
            detail.chapterId || data.chapterId;

          const subjectId =
            detail.subjectId || data.subjectId;

          if (courseId) {
            state.courseId = String(courseId);
            localStorage.setItem(
              "activeCourse",
              state.courseId
            );
          }

          if (chapterId) {
            state.chapterId = String(chapterId);
            localStorage.setItem(
              "activeChapter",
              state.chapterId
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

    eventsReady = true;
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  async function initialize(options) {
    options = options || {};

    if (options.courseId) {
      state.courseId = String(options.courseId);
    }

    if (options.subjectId) {
      state.subjectId = String(options.subjectId);
    }

    if (options.chapterId) {
      state.chapterId = String(options.chapterId);
    }

    if (options.topicId) {
      state.topicId = String(options.topicId);
    }

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

    if (state.chapterId) {
      localStorage.setItem(
        "activeChapter",
        state.chapterId
      );
    }

    if (state.topicId) {
      localStorage.setItem(
        "activeTopic",
        state.topicId
      );
    }

    addStyles();
    setupEvents();

    if (!getFirebase()) {
      state.error = "Firebase is not initialized.";
      renderError(state.error);
      return false;
    }

    state.currentUser = getCurrentUser();

    if (!state.currentUser) {
      state.error = "Please sign in to view topics.";
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
      await loadData();

      state.courseId = getSelectedCourseId();
      state.chapterId = getSelectedChapterId();
      state.subjectId = getSelectedSubjectId();

      renderTopics();

      state.initialized = true;

      return true;
    } catch (error) {
      state.error = error && error.message
        ? error.message
        : "Unable to load topics.";

      console.error(
        "[mNEET Topics] Refresh failed:",
        error
      );

      renderError(state.error);

      return false;
    } finally {
      state.loading = false;
    }
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window[MODULE_NAME] = {
    initialize: initialize,
    refresh: refresh,
    renderTopics: renderTopics,

    getTopics: function () {
      return state.topics.slice();
    },

    getTopicsForChapter: getTopicsForChapter,
    getQuizzesForTopic: getQuizzesForTopic,
    getNotesForTopic: getNotesForTopic,
    getTopicProgress: getTopicProgress,

    hasCourseAccess: hasCourseAccess,
    openQuiz: openQuiz,
    openNotes: openNotes,
    goBack: goBack,

    setSelection: function (courseId, chapterId, subjectId) {
      state.courseId = String(courseId || "");
      state.chapterId = String(chapterId || "");
      state.subjectId = String(subjectId || "");

      if (state.courseId) {
        localStorage.setItem(
          "activeCourse",
          state.courseId
        );
      }

      if (state.chapterId) {
        localStorage.setItem(
          "activeChapter",
          state.chapterId
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
        chapterId: state.chapterId,
        topicCount: state.topics.length,
        error: state.error
      };
    },

    getLastError: function () {
      return state.error;
    }
  };

  /* =========================================================
     AUTO START
     ========================================================= */

  function start() {
    setupEvents();

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
