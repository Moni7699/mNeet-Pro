/* =========================================================
   mNEET — Student Weak Points
   File: student-weak-points.js

   Purpose:
   - Identify weak Biology topics from quiz results
   - Calculate topic-wise accuracy
   - Show incorrect and unanswered questions
   - Identify topics needing revision
   - Link back to topic practice
   - Restrict results to the signed-in student

   No Teacher Panel.
   Green and White design system.
   ========================================================= */

(function (window, document) {
  "use strict";

  const MODULE_NAME = "MNEETStudentWeakPoints";

  const COLLECTIONS = Object.freeze({
    COURSES: "courses",
    SUBJECTS: "subjects",
    CHAPTERS: "chapters",
    TOPICS: "topics",
    PURCHASES: "purchases",
    QUIZ_ATTEMPTS: "quizAttempts",
    QUIZ_RESULTS: "quizResults"
  });

  const APPROVED_STATUSES = [
    "approved",
    "paid",
    "completed"
  ];

  const DEFAULTS = Object.freeze({
    LOW_ACCURACY_PERCENT: 60,
    MIN_ATTEMPTS_FOR_CONFIDENCE: 1,
    MAX_RECENT_RESULTS: 30
  });

  const state = {
    initialized: false,
    loading: false,
    user: null,
    db: null,

    courses: [],
    subjects: [],
    chapters: [],
    topics: [],
    purchases: [],
    attempts: [],
    results: [],

    weakPoints: [],
    selectedCourseId: "all",
    selectedFilter: "all",

    error: "",
    lastUpdated: null
  };

  let eventsBound = false;
  let refreshPromise = null;

  /* =======================================================
     1. FIREBASE HELPERS
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
      "Firebase চালু নেই। firebase.js এবং Firebase SDK পরীক্ষা করো।"
    );
  }

  function getCurrentUser() {
    try {
      return getFirebase().auth.currentUser || null;
    } catch (error) {
      return null;
    }
  }

  async function getOwnCollection(collectionName) {
    if (!state.db || !state.user) {
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

  async function getCollection(collectionName) {
    if (!state.db) {
      return [];
    }

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

  /* =======================================================
     2. GENERAL HELPERS
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

  function getItemId(item) {
    return String(
      item && (
        item.id ||
        item.topicId ||
        item.chapterId ||
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
      return "Quiz ফলাফল পড়ার অনুমতি নেই। Firebase Rules পরীক্ষা করতে হবে।";
    }

    if (code.includes("unauthenticated")) {
      return "Session শেষ হয়েছে। আবার Login করো।";
    }

    if (code.includes("unavailable")) {
      return "Internet connection পরীক্ষা করে আবার চেষ্টা করো।";
    }

    return error && error.message
      ? error.message
      : "তথ্য লোড করা যায়নি।";
  }

  function showMessage(message, type) {
    const container =
      byId("studentWeakPointsMessage") ||
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

  /* =======================================================
     3. ACCESS CONTROL
     ======================================================= */

  function isApprovedPurchase(purchase) {
    if (!purchase) {
      return false;
    }

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

    const studentAPI = window.MNEETStudent;

    if (
      ids.size === 0 &&
      studentAPI &&
      typeof studentAPI.getPurchasedCourses === "function"
    ) {
      try {
        const courses = studentAPI.getPurchasedCourses();

        if (Array.isArray(courses)) {
          courses.forEach(function (course) {
            const id = String(
              course.id ||
              course.courseId ||
              ""
            );

            if (id) {
              ids.add(id);
            }
          });
        }
      } catch (error) {
        // Firestore purchase records remain the primary source.
      }
    }

    return ids;
  }

  function getVisibleCourses() {
    const purchasedIds = getPurchasedCourseIds();

    return state.courses.filter(function (course) {
      const id = getItemId(course);

      return (
        purchasedIds.has(id) &&
        course.active !== false &&
        course.published !== false
      );
    });
  }

  function hasCourseAccess(courseId) {
    if (!courseId) {
      return false;
    }

    if (
      window.MNEETStudent &&
      typeof window.MNEETStudent.hasCourseAccess === "function"
    ) {
      try {
        if (window.MNEETStudent.hasCourseAccess(courseId)) {
          return true;
        }
      } catch (error) {
        // Check approved purchase records below.
      }
    }

    return getPurchasedCourseIds().has(String(courseId));
  }

  /* =======================================================
     4. DATA LOADING
     ======================================================= */

  async function loadData() {
    if (!state.user || !state.db) {
      throw new Error("Student Login পাওয়া যায়নি।");
    }

    const results = await Promise.all([
      getCollection(COLLECTIONS.COURSES),
      getCollection(COLLECTIONS.SUBJECTS),
      getCollection(COLLECTIONS.CHAPTERS),
      getCollection(COLLECTIONS.TOPICS),
      getOwnCollection(COLLECTIONS.PURCHASES),
      getOwnCollection(COLLECTIONS.QUIZ_ATTEMPTS),
      getOwnCollection(COLLECTIONS.QUIZ_RESULTS)
    ]);

    state.courses = results[0];
    state.subjects = results[1];
    state.chapters = results[2];
    state.topics = results[3];
    state.purchases = results[4];
    state.attempts = results[5];
    state.results = results[6];

    state.lastUpdated = new Date();

    buildWeakPoints();
  }

  /* =======================================================
     5. RESULT NORMALIZATION
     ======================================================= */

  function getResultTopicId(result) {
    return String(
      result.topicId ||
      result.topicID ||
      result.parentTopicId ||
      ""
    );
  }

  function getResultCourseId(result) {
    return String(
      result.courseId ||
      result.courseID ||
      ""
    );
  }

  function getResultChapterId(result) {
    return String(
      result.chapterId ||
      result.chapterID ||
      ""
    );
  }

  function getResultAttemptId(result) {
    return String(
      result.attemptId ||
      result.quizAttemptId ||
      result.id ||
      ""
    );
  }

  function getTotalQuestions(result) {
    return Math.max(
      0,
      getNumber(
        result.totalQuestions ||
        result.questionCount ||
        result.total ||
        0,
        0
      )
    );
  }

  function getCorrectCount(result) {
    return Math.max(
      0,
      getNumber(
        result.correctCount ||
        result.correctAnswers ||
        result.correct ||
        0,
        0
      )
    );
  }

  function getIncorrectCount(result) {
    return Math.max(
      0,
      getNumber(
        result.incorrectCount ||
        result.incorrectAnswers ||
        result.incorrect ||
        0,
        0
      )
    );
  }

  function getSkippedCount(result) {
    return Math.max(
      0,
      getNumber(
        result.skippedCount ||
        result.skippedAnswers ||
        result.skipped ||
        0,
        0
      )
    );
  }

  function getAccuracy(result) {
    const savedAccuracy = Number(result.accuracy);

    if (
      Number.isFinite(savedAccuracy) &&
      savedAccuracy >= 0 &&
      savedAccuracy <= 100
    ) {
      return savedAccuracy;
    }

    const total = getTotalQuestions(result);
    const correct = getCorrectCount(result);

    if (total > 0) {
      return (correct / total) * 100;
    }

    return null;
  }

  /* =======================================================
     6. LINK QUIZ RESULTS TO TOPICS
     ======================================================= */

  function findTopicForResult(result) {
    const topicId = getResultTopicId(result);

    if (topicId) {
      const topic = state.topics.find(function (item) {
        return getItemId(item) === topicId;
      });

      if (topic) {
        return topic;
      }
    }

    const chapterId = getResultChapterId(result);
    const courseId = getResultCourseId(result);

    const matchingTopics = state.topics.filter(function (topic) {
      const topicChapterId = String(
        topic.chapterId ||
        topic.chapterID ||
        topic.parentChapterId ||
        ""
      );

      const topicCourseId = String(
        topic.courseId ||
        topic.courseID ||
        ""
      );

      return (
        chapterId &&
        topicChapterId === chapterId &&
        (!courseId || !topicCourseId || topicCourseId === courseId)
      );
    });

    if (matchingTopics.length === 1) {
      return matchingTopics[0];
    }

    return null;
  }

  function getTopicName(topic) {
    if (!topic) {
      return "Topic information unavailable";
    }

    return String(
      topic.name ||
      topic.title ||
      topic.topicName ||
      "Untitled Topic"
    );
  }

  function getChapterForTopic(topic) {
    if (!topic) {
      return null;
    }

    const chapterId = String(
      topic.chapterId ||
      topic.chapterID ||
      topic.parentChapterId ||
      ""
    );

    return state.chapters.find(function (chapter) {
      return getItemId(chapter) === chapterId;
    }) || null;
  }

  function getCourseForTopic(topic, result) {
    const resultCourseId = getResultCourseId(result || {});

    const topicCourseId = String(
      topic && (
        topic.courseId ||
        topic.courseID
      ) || ""
    );

    const chapter = getChapterForTopic(topic);

    const chapterCourseId = String(
      chapter && (
        chapter.courseId ||
        chapter.courseID
      ) || ""
    );

    const courseId =
      resultCourseId ||
      topicCourseId ||
      chapterCourseId;

    return state.courses.find(function (course) {
      return getItemId(course) === courseId;
    }) || null;
  }

  /* =======================================================
     7. AGGREGATE TOPIC PERFORMANCE
     ======================================================= */

  function buildWeakPoints() {
    const grouped = new Map();

    const visibleCourses = getVisibleCourses();
    const visibleCourseIds = new Set(
      visibleCourses.map(getItemId)
    );

    state.results.forEach(function (result) {
      const topic = findTopicForResult(result);

      if (!topic) {
        return;
      }

      const course = getCourseForTopic(topic, result);

      if (!course) {
        return;
      }

      const courseId = getItemId(course);

      if (!visibleCourseIds.has(courseId)) {
        return;
      }

      const topicId = getItemId(topic);

      if (!topicId) {
        return;
      }

      const key = courseId + "::" + topicId;

      if (!grouped.has(key)) {
        grouped.set(key, {
          topicId: topicId,
          topicName: getTopicName(topic),
          courseId: courseId,
          courseName: String(
            course.name ||
            course.title ||
            "Course"
          ),
          chapterId: String(
            topic.chapterId ||
            topic.chapterID ||
            topic.parentChapterId ||
            ""
          ),
          chapterName: getChapterForTopic(topic)
            ? String(
                getChapterForTopic(topic).name ||
                getChapterForTopic(topic).title ||
                "Chapter"
              )
            : "Chapter information unavailable",

          attemptCount: 0,
          totalQuestions: 0,
          correctCount: 0,
          incorrectCount: 0,
          skippedCount: 0,
          scoreTotal: 0,
          accuracyValues: [],
          latestAttemptAt: 0,
          recentResults: []
        });
      }

      const item = grouped.get(key);

      item.attemptCount += 1;
      item.totalQuestions += getTotalQuestions(result);
      item.correctCount += getCorrectCount(result);
      item.incorrectCount += getIncorrectCount(result);
      item.skippedCount += getSkippedCount(result);

      const score = Number(result.score);

      if (Number.isFinite(score)) {
        item.scoreTotal += score;
      }

      const accuracy = getAccuracy(result);

      if (accuracy !== null) {
        item.accuracyValues.push(accuracy);
      }

      const createdAt = getDateValue(
        result.createdAt ||
        result.submittedAt ||
        result.completedAt
      );

      item.latestAttemptAt = Math.max(
        item.latestAttemptAt,
        createdAt
      );

      item.recentResults.push({
        id: getResultAttemptId(result),
        accuracy: accuracy,
        score: Number.isFinite(score) ? score : null,
        createdAt: createdAt,
        correctCount: getCorrectCount(result),
        incorrectCount: getIncorrectCount(result),
        skippedCount: getSkippedCount(result)
      });
    });

    state.weakPoints = Array.from(grouped.values())
      .map(function (item) {
        const accuracy = item.totalQuestions > 0
          ? (
              item.correctCount /
              item.totalQuestions
            ) * 100
          : item.accuracyValues.length
          ? item.accuracyValues.reduce(
              function (sum, value) {
                return sum + value;
              },
              0
            ) / item.accuracyValues.length
          : null;

        const topic = state.topics.find(function (candidate) {
          return getItemId(candidate) === item.topicId;
        });

        const chapter = getChapterForTopic(topic);

        const subjectId = String(
          chapter && (
            chapter.subjectId ||
            chapter.subjectID ||
            chapter.parentSubjectId
          ) || ""
        );

        const subject = state.subjects.find(function (candidate) {
          return getItemId(candidate) === subjectId;
        });

        item.accuracy = accuracy === null
          ? null
          : Math.round(accuracy * 10) / 10;

        item.averageScore = item.attemptCount
          ? Math.round(
              (item.scoreTotal / item.attemptCount) * 10
            ) / 10
          : null;

        item.subjectName = subject
          ? String(subject.name || subject.title || "Subject")
          : "";

        item.recentResults.sort(function (a, b) {
          return b.createdAt - a.createdAt;
        });

        item.recentResults = item.recentResults.slice(
          0,
          DEFAULTS.MAX_RECENT_RESULTS
        );

        item.isWeak =
          item.accuracy !== null &&
          item.accuracy < DEFAULTS.LOW_ACCURACY_PERCENT;

        item.needsRevision =
          item.isWeak ||
          item.incorrectCount > 0 ||
          item.skippedCount > 0;

        item.recommendation = getRecommendation(item);

        return item;
      })
      .sort(function (a, b) {
        const accuracyA = a.accuracy === null
          ? 101
          : a.accuracy;

        const accuracyB = b.accuracy === null
          ? 101
          : b.accuracy;

        if (accuracyA !== accuracyB) {
          return accuracyA - accuracyB;
        }

        return b.incorrectCount - a.incorrectCount;
      });
  }

  function getRecommendation(item) {
    if (item.accuracy === null) {
      return "আরও quiz result জমা হলে topic performance বোঝা যাবে।";
    }

    if (item.accuracy < 40) {
      return "NCERT-এর সংশ্লিষ্ট অংশ আবার পড়ে topic-wise quiz দাও।";
    }

    if (item.accuracy < DEFAULTS.LOW_ACCURACY_PERCENT) {
      return "ভুল প্রশ্নগুলোর solution review করে আবার practice করো।";
    }

    if (item.skippedCount > item.correctCount) {
      return "প্রথমে NCERT revision করো, তারপর unanswered প্রশ্ন practice করো।";
    }

    if (item.incorrectCount > 0) {
      return "ভুল প্রশ্নগুলো review করে আরও practice করো।";
    }

    return "এই topic নিয়মিত revise করে performance ধরে রাখো।";
  }

  /* =======================================================
     8. FILTERS
     ======================================================= */

  function getFilteredWeakPoints() {
    let items = state.weakPoints.slice();

    if (state.selectedCourseId !== "all") {
      items = items.filter(function (item) {
        return item.courseId === state.selectedCourseId;
      });
    }

    if (state.selectedFilter === "weak") {
      items = items.filter(function (item) {
        return item.isWeak;
      });
    } else if (state.selectedFilter === "revision") {
      items = items.filter(function (item) {
        return item.needsRevision;
      });
    } else if (state.selectedFilter === "incorrect") {
      items = items.filter(function (item) {
        return item.incorrectCount > 0;
      });
    } else if (state.selectedFilter === "skipped") {
      items = items.filter(function (item) {
        return item.skippedCount > 0;
      });
    }

    return items;
  }

  /* =======================================================
     9. STYLES
     ======================================================= */

  function injectStyles() {
    if (byId("mneetWeakPointsStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "mneetWeakPointsStyles";

    style.textContent = `
      .mneet-wp {
        color: var(--mn-text, #FFFFFF);
        background: var(--mn-bg, #071A12);
        padding: 16px;
        border-radius: 16px;
      }

      .mneet-wp * {
        box-sizing: border-box;
      }

      .mneet-wp-card {
        border: 1px solid var(--mn-border, #28513A);
        background: var(--mn-card, #0D2419);
        border-radius: 13px;
        padding: 15px;
        margin-bottom: 12px;
      }

      .mneet-wp-stats {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }

      .mneet-wp-stat {
        border: 1px solid var(--mn-border, #28513A);
        background: var(--mn-card, #0D2419);
        border-radius: 12px;
        padding: 12px;
        min-width: 0;
      }

      .mneet-wp-stat strong {
        display: block;
        font-size: 1.4rem;
        margin-bottom: 5px;
        overflow-wrap: anywhere;
      }

      .mneet-wp-muted {
        color: var(--mn-text-secondary, #D1D5DB);
        font-size: .9rem;
        line-height: 1.5;
      }

      .mneet-wp-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 16px;
      }

      .mneet-wp-select {
        flex: 1 1 190px;
        min-width: 0;
        min-height: 42px;
        border: 1px solid var(--mn-border, #28513A);
        background: var(--mn-input-bg, #10291D);
        color: var(--mn-text, #FFFFFF);
        border-radius: 9px;
        padding: 10px;
        font: inherit;
      }

      .mneet-wp-title {
        margin: 0 0 7px;
        font-size: 1.08rem;
        overflow-wrap: anywhere;
      }

      .mneet-wp-metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin: 14px 0;
      }

      .mneet-wp-metric {
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        padding: 9px;
        min-width: 0;
      }

      .mneet-wp-metric strong {
        display: block;
        margin-top: 5px;
        overflow-wrap: anywhere;
      }

      .mneet-wp-progress {
        height: 8px;
        width: 100%;
        background: var(--mn-input-bg, #10291D);
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 20px;
        overflow: hidden;
        margin: 10px 0;
      }

      .mneet-wp-progress span {
        display: block;
        height: 100%;
        background: var(--mn-primary, #16A34A);
        border-radius: inherit;
      }

      .mneet-wp-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }

      .mneet-wp-button {
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        padding: 10px 13px;
        background: var(--mn-card, #0D2419);
        color: var(--mn-text, #FFFFFF);
        cursor: pointer;
        font: inherit;
      }

      .mneet-wp-button-primary {
        background: var(--mn-primary, #16A34A);
        border-color: var(--mn-primary, #16A34A);
        color: #FFFFFF;
      }

      .mneet-wp-button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .mneet-wp-empty {
        border: 1px dashed var(--mn-border, #28513A);
        border-radius: 12px;
        padding: 22px 15px;
        text-align: center;
        line-height: 1.6;
        color: var(--mn-text-secondary, #D1D5DB);
      }

      .mneet-wp-notice {
        padding: 12px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 10px;
        margin-bottom: 12px;
        line-height: 1.5;
      }

      @media (max-width: 720px) {
        .mneet-wp-stats {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .mneet-wp-metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     10. RENDER
     ======================================================= */

  function getHost() {
    return (
      byId("studentWeakPointsContent") ||
      byId("studentWeakPointsPageContent") ||
      byId("studentPageWeakPoints")
    );
  }

  function renderCourseOptions() {
    const options = getVisibleCourses();

    return `
      <option value="all">All Purchased Courses</option>
      ${options.map(function (course) {
        const id = getItemId(course);

        return `
          <option value="${escapeHTML(id)}"
            ${state.selectedCourseId === id ? "selected" : ""}>
            ${escapeHTML(course.name || course.title || "Course")}
          </option>
        `;
      }).join("")}
    `;
  }

  function renderFilters() {
    const filters = [
      ["all", "All Topics"],
      ["weak", "Low Accuracy"],
      ["revision", "Needs Revision"],
      ["incorrect", "Has Incorrect Answers"],
      ["skipped", "Has Skipped Questions"]
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

  function renderStats(items) {
    const weakCount = items.filter(function (item) {
      return item.isWeak;
    }).length;

    const revisionCount = items.filter(function (item) {
      return item.needsRevision;
    }).length;

    const attempts = items.reduce(function (sum, item) {
      return sum + item.attemptCount;
    }, 0);

    const incorrect = items.reduce(function (sum, item) {
      return sum + item.incorrectCount;
    }, 0);

    return `
      <div class="mneet-wp-stats">
        <div class="mneet-wp-stat">
          <strong>${weakCount}</strong>
          <span class="mneet-wp-muted">Low Accuracy Topics</span>
        </div>

        <div class="mneet-wp-stat">
          <strong>${revisionCount}</strong>
          <span class="mneet-wp-muted">Topics to Revise</span>
        </div>

        <div class="mneet-wp-stat">
          <strong>${attempts}</strong>
          <span class="mneet-wp-muted">Topic Result Records</span>
        </div>

        <div class="mneet-wp-stat">
          <strong>${incorrect}</strong>
          <span class="mneet-wp-muted">Incorrect Answers</span>
        </div>
      </div>
    `;
  }

  function renderTopicCard(item) {
    const accuracyText = item.accuracy === null
      ? "Not enough data"
      : item.accuracy.toFixed(1) + "%";

    const progressWidth = item.accuracy === null
      ? 0
      : Math.max(0, Math.min(100, item.accuracy));

    return `
      <article class="mneet-wp-card">
        <h3 class="mneet-wp-title">
          ${escapeHTML(item.topicName)}
        </h3>

        <div class="mneet-wp-muted">
          ${escapeHTML(item.courseName)}
          ·
          ${escapeHTML(item.chapterName)}
          ${item.subjectName
            ? " · " + escapeHTML(item.subjectName)
            : ""}
        </div>

        <div class="mneet-wp-progress"
          role="progressbar"
          aria-valuenow="${progressWidth}"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Topic accuracy">
          <span style="width:${progressWidth}%"></span>
        </div>

        <div class="mneet-wp-muted">
          Accuracy: ${accuracyText}
        </div>

        <div class="mneet-wp-metrics">
          <div class="mneet-wp-metric">
            <span class="mneet-wp-muted">Attempts</span>
            <strong>${item.attemptCount}</strong>
          </div>

          <div class="mneet-wp-metric">
            <span class="mneet-wp-muted">Correct</span>
            <strong>${item.correctCount}</strong>
          </div>

          <div class="mneet-wp-metric">
            <span class="mneet-wp-muted">Incorrect</span>
            <strong>${item.incorrectCount}</strong>
          </div>

          <div class="mneet-wp-metric">
            <span class="mneet-wp-muted">Skipped</span>
            <strong>${item.skippedCount}</strong>
          </div>
        </div>

        <div class="mneet-wp-notice">
          ${escapeHTML(item.recommendation)}
        </div>

        <div class="mneet-wp-actions">
          <button type="button"
            class="mneet-wp-button mneet-wp-button-primary"
            data-wp-action="practice"
            data-wp-topic-id="${escapeHTML(item.topicId)}"
            data-wp-course-id="${escapeHTML(item.courseId)}"
            data-wp-chapter-id="${escapeHTML(item.chapterId)}">
            Practice Topic
          </button>

          <button type="button"
            class="mneet-wp-button"
            data-wp-action="view-progress"
            data-wp-topic-id="${escapeHTML(item.topicId)}">
            View Topic Progress
          </button>
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

    const items = getFilteredWeakPoints();

    if (!state.user) {
      host.innerHTML = `
        <div class="mneet-wp">
          <div class="mneet-wp-empty">
            Weak Points দেখতে Student account দিয়ে Login করো।
          </div>
        </div>
      `;

      return true;
    }

    host.innerHTML = `
      <section class="mneet-wp">
        <h2>My Weak Points</h2>

        <p class="mneet-wp-muted">
          Quiz results-এর ভিত্তিতে কোন Biology topic-এ আরও practice
          দরকার তা এখানে দেখানো হবে।
        </p>

        <div class="mneet-wp-toolbar">
          <select id="mneetWpCourseFilter"
            class="mneet-wp-select"
            aria-label="Filter by course">
            ${renderCourseOptions()}
          </select>

          <select id="mneetWpResultFilter"
            class="mneet-wp-select"
            aria-label="Filter topics">
            ${renderFilters()}
          </select>
        </div>

        ${renderStats(items)}

        <div id="mneetWpTopicList">
          ${
            items.length
              ? items.map(renderTopicCard).join("")
              : `
                <div class="mneet-wp-empty">
                  এই filter-এর জন্য কোনো topic result পাওয়া যায়নি।
                  Quiz practice করার পরে এখানে performance দেখা যাবে।
                </div>
              `
          }
        </div>

        <div class="mneet-wp-muted">
          ${
            state.lastUpdated
              ? "Last updated: " +
                escapeHTML(state.lastUpdated.toLocaleString("en-IN"))
              : ""
          }
        </div>
      </section>
    `;

    return true;
  }

  /* =======================================================
     11. NAVIGATION
     ======================================================= */

  function openTopicPractice(item) {
    if (!item || !hasCourseAccess(item.courseId)) {
      showMessage(
        "এই course-এর access নেই। Payment approval status পরীক্ষা করো।",
        "warning"
      );
      return;
    }

    try {
      localStorage.setItem("activeCourse", item.courseId);
      localStorage.setItem("activeChapter", item.chapterId);
      localStorage.setItem("activeTopic", item.topicId);
    } catch (error) {
      // Navigation can still use the module API.
    }

    const student = window.MNEETStudent;

    if (student && typeof student.navigateTo === "function") {
      student.navigateTo("topicPractice", {
        courseId: item.courseId,
        chapterId: item.chapterId,
        topicId: item.topicId
      });

      return;
    }

    if (student && typeof student.showPage === "function") {
      student.showPage("topicPractice");
      return;
    }

    showMessage(
      "Topic Practice page navigation যুক্ত করা হয়নি। Student Panel integration দরকার।",
      "warning"
    );
  }

  function viewTopicProgress(topicId) {
    const student = window.MNEETStudent;

    try {
      localStorage.setItem("activeTopic", topicId);
    } catch (error) {
      // Navigation can still continue.
    }

    if (student && typeof student.navigateTo === "function") {
      student.navigateTo("progress", {
        topicId: topicId
      });
      return;
    }

    if (student && typeof student.showPage === "function") {
      student.showPage("progress");
      return;
    }

    showMessage(
      "Progress page navigation যুক্ত করা হয়নি।",
      "warning"
    );
  }

  function handleClick(event) {
    const button = event.target.closest("[data-wp-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.wpAction;

    if (action === "practice") {
      openTopicPractice({
        topicId: button.dataset.wpTopicId,
        courseId: button.dataset.wpCourseId,
        chapterId: button.dataset.wpChapterId
      });
    } else if (action === "view-progress") {
      viewTopicProgress(button.dataset.wpTopicId);
    }
  }

  function handleChange(event) {
    if (event.target.id === "mneetWpCourseFilter") {
      state.selectedCourseId = event.target.value || "all";
      render();
    }

    if (event.target.id === "mneetWpResultFilter") {
      state.selectedFilter = event.target.value || "all";
      render();
    }
  }

  /* =======================================================
     12. REFRESH
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
          state.weakPoints = [];
          state.error = "Student Login পাওয়া যায়নি।";
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
     13. EVENT BINDING
     ======================================================= */

  function bindEvents() {
    if (eventsBound) {
      return;
    }

    eventsBound = true;

    document.addEventListener("click", handleClick);
    document.addEventListener("change", handleChange);

    document.addEventListener(
      "mneet:student-page-change",
      function (event) {
        const detail = event.detail || {};
        const page = String(
          detail.page ||
          detail.pageName ||
          ""
        ).toLowerCase();

        if (
          page.includes("weak") ||
          page.includes("progress")
        ) {
          refresh();
        }
      }
    );

    document.addEventListener(
      "mneet:quiz-submitted",
      function () {
        window.setTimeout(refresh, 800);
      }
    );

    document.addEventListener(
      "mneet:student-ready",
      function () {
        refresh();
      }
    );
  }

  /* =======================================================
     14. INITIALIZATION
     ======================================================= */

  function initialize() {
    if (state.initialized) {
      return refresh();
    }

    state.initialized = true;

    injectStyles();
    bindEvents();

    return refresh();
  }

  /* =======================================================
     15. PUBLIC API
     ======================================================= */

  window[MODULE_NAME] = Object.freeze({
    initialize: initialize,
    refresh: refresh,
    render: render,

    getWeakPoints: function () {
      return state.weakPoints.slice();
    },

    getFilteredWeakPoints: getFilteredWeakPoints,

    getState: function () {
      return {
        initialized: state.initialized,
        loading: state.loading,
        selectedCourseId: state.selectedCourseId,
        selectedFilter: state.selectedFilter,
        weakPointCount: state.weakPoints.length,
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
