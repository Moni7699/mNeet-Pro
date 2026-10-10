/* ==========================================================
   mNEET — FILE 37
   Student Course, Chapter & Topic Progress
   Theme: Green + White Dark Mode
   ========================================================== */

(function () {
  "use strict";

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
    user: null,
    courses: [],
    purchases: [],
    subjects: [],
    chapters: [],
    topics: [],
    attempts: [],
    results: [],
    selectedCourseId: "",
    loading: false,
    initialized: false,
    lastError: null
  };

  const styles = `
    .mneet-progress {
      background: #071A12;
      color: #FFFFFF;
      padding: 16px;
      border-radius: 18px;
      width: 100%;
      box-sizing: border-box;
    }

    .mneet-progress *,
    .mneet-progress *::before,
    .mneet-progress *::after {
      box-sizing: border-box;
    }

    .mneet-progress-card {
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 16px;
      padding: 17px;
      margin-bottom: 15px;
      min-width: 0;
    }

    .mneet-progress-title {
      color: #FFFFFF;
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 8px;
    }

    .mneet-progress-subtitle {
      color: #D1D5DB;
      font-size: 14px;
      line-height: 1.7;
      margin: 0 0 15px;
    }

    .mneet-progress-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .mneet-progress-stat {
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 12px;
      padding: 14px;
      min-width: 0;
    }

    .mneet-progress-label {
      color: #D1D5DB;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .mneet-progress-value {
      color: #22C55E;
      font-size: 24px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .mneet-progress-detail {
      color: #D1D5DB;
      font-size: 12px;
      line-height: 1.6;
      margin-top: 5px;
    }

    .mneet-progress-bar {
      width: 100%;
      height: 10px;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 20px;
      overflow: hidden;
      margin: 10px 0;
    }

    .mneet-progress-fill {
      height: 100%;
      background: #22C55E;
      border-radius: 20px;
      width: 0;
      transition: width .3s ease;
    }

    .mneet-progress-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .mneet-progress-row strong {
      color: #FFFFFF;
      overflow-wrap: anywhere;
    }

    .mneet-progress-percent {
      color: #22C55E;
      font-weight: 800;
      white-space: nowrap;
    }

    .mneet-progress-item {
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 11px;
    }

    .mneet-progress-item-title {
      color: #FFFFFF;
      font-size: 15px;
      font-weight: 800;
      margin-bottom: 7px;
      overflow-wrap: anywhere;
    }

    .mneet-progress-item-meta {
      color: #D1D5DB;
      font-size: 12px;
      line-height: 1.7;
    }

    .mneet-progress-select {
      display: block;
      width: 100%;
      min-height: 44px;
      background: #10291D;
      color: #FFFFFF;
      border: 1px solid #28513A;
      border-radius: 10px;
      padding: 10px 12px;
      margin: 10px 0 16px;
      font: inherit;
    }

    .mneet-progress-button {
      background: #10291D;
      color: #FFFFFF;
      border: 1px solid #28513A;
      border-radius: 10px;
      padding: 10px 14px;
      min-height: 40px;
      font-weight: 700;
      cursor: pointer;
    }

    .mneet-progress-button-primary {
      background: #16A34A;
      border-color: #16A34A;
      color: #FFFFFF;
    }

    .mneet-progress-empty {
      background: #0D2419;
      border: 1px dashed #28513A;
      border-radius: 12px;
      color: #D1D5DB;
      padding: 18px;
      line-height: 1.7;
      text-align: center;
    }

    .mneet-progress-message {
      background: #10291D;
      border: 1px solid #28513A;
      color: #FFFFFF;
      padding: 12px;
      border-radius: 10px;
      margin-bottom: 14px;
      line-height: 1.6;
    }

    @media (min-width: 720px) {
      .mneet-progress {
        padding: 22px;
      }

      .mneet-progress-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }
    }
  `;

  function addStyles() {
    if (document.getElementById("mneetProgressStyles")) return;

    const style = document.createElement("style");
    style.id = "mneetProgressStyles";
    style.textContent = styles;
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

    throw new Error("Firebase প্রস্তুত নয়। পেজ রিফ্রেশ করে আবার চেষ্টা করো।");
  }

  function getStudentAPI() {
    return window.MNEETStudent || null;
  }

  function getUser() {
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
      "studentProgressContent",
      "studentProgressPageContent",
      "studentPageProgress",
      "studentCourseProgress",
      "studentStudyProgress"
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

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function docId(item) {
    return item && item.id ? String(item.id) : "";
  }

  function orderValue(item) {
    return number(item.order ?? item.position ?? item.sequence, 0);
  }

  function sortItems(items) {
    return [...items].sort((a, b) => {
      const difference = orderValue(a) - orderValue(b);
      if (difference !== 0) return difference;

      return String(a.name || a.title || "")
        .localeCompare(String(b.name || b.title || ""));
    });
  }

  function isActive(item) {
    return item &&
      item.active !== false &&
      item.published !== false;
  }

  function getCourseId(item) {
    return String(
      item.courseId ||
      item.courseID ||
      item.parentCourseId ||
      ""
    );
  }

  function getSubjectId(item) {
    return String(
      item.subjectId ||
      item.subjectID ||
      item.parentSubjectId ||
      ""
    );
  }

  function getChapterId(item) {
    return String(
      item.chapterId ||
      item.chapterID ||
      item.parentChapterId ||
      ""
    );
  }

  function getTopicId(item) {
    return String(
      item.topicId ||
      item.topicID ||
      item.parentTopicId ||
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
    return ["approved", "paid", "completed"].includes(
      getPurchaseStatus(purchase)
    );
  }

  function getPurchaseCourseId(purchase) {
    return String(
      purchase.courseId ||
      purchase.courseID ||
      purchase.parentCourseId ||
      ""
    );
  }

  function getApprovedCourseIds() {
    const ids = new Set();

    state.purchases.forEach(purchase => {
      if (!isApprovedPurchase(purchase)) return;

      const courseId = getPurchaseCourseId(purchase);
      if (courseId) ids.add(courseId);
    });

    const api = getStudentAPI();

    if (
      ids.size === 0 &&
      api &&
      typeof api.getPurchasedCourses === "function"
    ) {
      const purchasedCourses = api.getPurchasedCourses() || [];

      purchasedCourses.forEach(course => {
        if (typeof course === "string") {
          ids.add(course);
        } else {
          const id = docId(course) || course.courseId;
          if (id) ids.add(String(id));
        }
      });
    }

    return ids;
  }

  function getVisibleCourses() {
    const approvedIds = getApprovedCourseIds();

    return state.courses.filter(course =>
      isActive(course) && approvedIds.has(docId(course))
    );
  }

  function getSelectedCourse() {
    return state.courses.find(
      course => docId(course) === state.selectedCourseId
    ) || null;
  }

  function getCourseSubjects(courseId) {
    return sortItems(state.subjects.filter(subject =>
      isActive(subject) && getCourseId(subject) === courseId
    ));
  }

  function getCourseChapters(courseId) {
    return sortItems(state.chapters.filter(chapter =>
      isActive(chapter) && getCourseId(chapter) === courseId
    ));
  }

  function getSubjectChapters(subjectId, courseId) {
    return sortItems(state.chapters.filter(chapter =>
      isActive(chapter) &&
      getSubjectId(chapter) === subjectId &&
      (!courseId || !getCourseId(chapter) ||
        getCourseId(chapter) === courseId)
    ));
  }

  function getChapterTopics(chapterId, courseId) {
    return sortItems(state.topics.filter(topic =>
      isActive(topic) &&
      getChapterId(topic) === chapterId &&
      (!courseId || !getCourseId(topic) ||
        getCourseId(topic) === courseId)
    ));
  }

  function belongsToCourse(item, courseId) {
    if (getCourseId(item) === courseId) return true;

    const chapterId = getChapterId(item);
    if (chapterId) {
      const chapter = state.chapters.find(
        item => docId(item) === chapterId
      );

      if (chapter && getCourseId(chapter) === courseId) return true;

      const subjectId = getSubjectId(chapter || {});
      if (subjectId) {
        const subject = state.subjects.find(
          item => docId(item) === subjectId
        );

        if (subject && getCourseId(subject) === courseId) return true;
      }
    }

    const topicId = getTopicId(item);
    if (topicId) {
      const topic = state.topics.find(
        item => docId(item) === topicId
      );

      if (topic && getCourseId(topic) === courseId) return true;

      const topicChapterId = getChapterId(topic || {});
      if (topicChapterId) {
        const chapter = state.chapters.find(
          item => docId(item) === topicChapterId
        );

        if (chapter && getCourseId(chapter) === courseId) return true;
      }
    }

    const subjectId = getSubjectId(item);

    if (subjectId) {
      const subject = state.subjects.find(
        item => docId(item) === subjectId
      );

      if (subject && getCourseId(subject) === courseId) return true;
    }

    return false;
  }

  function getCourseResults(courseId) {
    return state.results.filter(result =>
      belongsToCourse(result, courseId)
    );
  }

  function getCourseAttempts(courseId) {
    return state.attempts.filter(attempt =>
      belongsToCourse(attempt, courseId)
    );
  }

  function getUniqueQuizCount(results) {
    const ids = new Set();

    results.forEach(result => {
      const id = result.quizId || result.quizTitle || result.id;
      if (id) ids.add(String(id));
    });

    return ids.size;
  }

  function getAccuracy(results) {
    if (!results.length) return null;

    const totalQuestions = results.reduce(
      (sum, result) => sum + number(result.totalQuestions),
      0
    );

    const correct = results.reduce(
      (sum, result) => sum + number(
        result.correctAnswers ?? result.correct
      ),
      0
    );

    if (totalQuestions > 0) {
      return (correct / totalQuestions) * 100;
    }

    const validAccuracy = results.filter(
      result => result.accuracy != null
    );

    if (!validAccuracy.length) return null;

    return validAccuracy.reduce(
      (sum, result) => sum + number(result.accuracy),
      0
    ) / validAccuracy.length;
  }

  function getQuizCountForTopic(topicId) {
    const results = state.results.filter(
      result => getTopicId(result) === topicId
    );

    const attempts = state.attempts.filter(
      attempt => getTopicId(attempt) === topicId
    );

    return {
      results,
      attempts,
      attemptCount: Math.max(results.length, attempts.length),
      accuracy: getAccuracy(results)
    };
  }

  function getTopicProgress(topicId) {
    const data = getQuizCountForTopic(topicId);

    /*
      A topic is not automatically declared complete merely because
      a quiz was attempted. We report activity instead.
    */
    return {
      topicId,
      attemptCount: data.attemptCount,
      accuracy: data.accuracy,
      hasAttempt: data.attemptCount > 0,
      progressPercentage: data.attemptCount > 0 ? null : 0
    };
  }

  function getChapterProgress(chapterId, courseId) {
    const topics = getChapterTopics(chapterId, courseId);

    if (!topics.length) {
      return {
        chapterId,
        totalTopics: 0,
        attemptedTopics: 0,
        progressPercentage: null
      };
    }

    const attemptedTopics = topics.filter(topic =>
      getTopicProgress(docId(topic)).hasAttempt
    ).length;

    return {
      chapterId,
      totalTopics: topics.length,
      attemptedTopics,
      progressPercentage: Math.round(
        (attemptedTopics / topics.length) * 100
      )
    };
  }

  function getCourseProgress(courseId) {
    const chapters = getCourseChapters(courseId);

    if (!chapters.length) {
      return {
        courseId,
        totalChapters: 0,
        attemptedChapters: 0,
        progressPercentage: null
      };
    }

    const chapterProgress = chapters.map(chapter =>
      getChapterProgress(docId(chapter), courseId)
    );

    const measurable = chapterProgress.filter(
      item => item.progressPercentage != null
    );

    if (!measurable.length) {
      return {
        courseId,
        totalChapters: chapters.length,
        attemptedChapters: 0,
        progressPercentage: null
      };
    }

    const completed = measurable.filter(
      item => item.progressPercentage === 100
    ).length;

    return {
      courseId,
      totalChapters: chapters.length,
      attemptedChapters: chapterProgress.filter(
        item => item.attemptedTopics > 0
      ).length,
      progressPercentage: Math.round(
        measurable.reduce(
          (sum, item) => sum + item.progressPercentage,
          0
        ) / measurable.length
      )
    };
  }

  async function readCollection(collectionName) {
    const fb = getFirebase();

    const snapshot = await fb.db.collection(collectionName).get();
    const items = [];

    snapshot.forEach(doc => {
      items.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return items;
  }

  async function readOwnCollection(collectionName, uid) {
    const fb = getFirebase();

    const snapshot = await fb.db
      .collection(collectionName)
      .where("userId", "==", uid)
      .get();

    const items = [];

    snapshot.forEach(doc => {
      items.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return items;
  }

  async function loadData() {
    const user = getUser();

    if (!user) {
      throw new Error("Progress দেখতে আগে Sign In করো।");
    }

    state.user = user;
    state.loading = true;
    state.lastError = null;

    try {
      const [
        courses,
        subjects,
        chapters,
        topics,
        purchases,
        attempts,
        results
      ] = await Promise.all([
        readCollection(COLLECTIONS.courses),
        readCollection(COLLECTIONS.subjects),
        readCollection(COLLECTIONS.chapters),
        readCollection(COLLECTIONS.topics),
        readOwnCollection(COLLECTIONS.purchases, user.uid),
        readOwnCollection(COLLECTIONS.quizAttempts, user.uid),
        readOwnCollection(COLLECTIONS.quizResults, user.uid)
      ]);

      state.courses = courses;
      state.subjects = subjects;
      state.chapters = chapters;
      state.topics = topics;
      state.purchases = purchases;
      state.attempts = attempts;
      state.results = results;

      const visibleCourses = getVisibleCourses();

      if (
        !state.selectedCourseId ||
        !visibleCourses.some(
          course => docId(course) === state.selectedCourseId
        )
      ) {
        state.selectedCourseId = visibleCourses.length
          ? docId(visibleCourses[0])
          : "";
      }

      return true;
    } catch (error) {
      state.lastError = error;
      console.error("[mNEET Progress] Data loading failed:", error);
      throw error;
    } finally {
      state.loading = false;
    }
  }

  function renderCourseSelector(courses) {
    if (!courses.length) {
      return `
        <div class="mneet-progress-empty">
          তোমার account-এ এখনো কোনো approved course পাওয়া যায়নি।
          Payment approve হলে course access পাওয়া যাবে।
        </div>
      `;
    }

    return `
      <label for="mneetProgressCourseSelect"
        class="mneet-progress-label">
        Course নির্বাচন করো
      </label>

      <select id="mneetProgressCourseSelect"
        class="mneet-progress-select">
        ${courses.map(course => `
          <option value="${escapeHTML(docId(course))}"
            ${docId(course) === state.selectedCourseId ? "selected" : ""}>
            ${escapeHTML(course.name || course.title || "Course")}
          </option>
        `).join("")}
      </select>
    `;
  }

  function renderOverview(course) {
    if (!course) return "";

    const courseId = docId(course);
    const progress = getCourseProgress(courseId);
    const results = getCourseResults(courseId);
    const attempts = getCourseAttempts(courseId);
    const accuracy = getAccuracy(results);
    const uniqueQuizzes = getUniqueQuizCount(results);

    const progressText = progress.progressPercentage == null
      ? "তথ্য অপর্যাপ্ত"
      : progress.progressPercentage + "%";

    const progressDetail = progress.progressPercentage == null
      ? "Chapter ও Topic-এর activity data পাওয়া গেলে progress হিসাব হবে।"
      : "Topic quiz activity অনুযায়ী আনুমানিক অগ্রগতি।";

    return `
      <section class="mneet-progress-card">
        <h2 class="mneet-progress-title">
          ${escapeHTML(course.name || course.title || "Course Progress")}
        </h2>

        <p class="mneet-progress-subtitle">
          তোমার Course, Chapter ও Topic activity-এর সারাংশ।
        </p>

        <div class="mneet-progress-grid">
          <div class="mneet-progress-stat">
            <div class="mneet-progress-label">Course Progress</div>
            <div class="mneet-progress-value">
              ${escapeHTML(progressText)}
            </div>
            <div class="mneet-progress-detail">
              ${escapeHTML(progressDetail)}
            </div>
          </div>

          <div class="mneet-progress-stat">
            <div class="mneet-progress-label">Quiz Attempts</div>
            <div class="mneet-progress-value">
              ${attempts.length || results.length}
            </div>
          </div>

          <div class="mneet-progress-stat">
            <div class="mneet-progress-label">Quizzes Attempted</div>
            <div class="mneet-progress-value">${uniqueQuizzes}</div>
          </div>

          <div class="mneet-progress-stat">
            <div class="mneet-progress-label">Accuracy</div>
            <div class="mneet-progress-value">
              ${accuracy == null ? "—" : accuracy.toFixed(1) + "%"}
            </div>
          </div>
        </div>

        ${progress.progressPercentage != null ? `
          <div class="mneet-progress-bar">
            <div class="mneet-progress-fill"
              style="width:${progress.progressPercentage}%"></div>
          </div>
        ` : ""}
      </section>
    `;
  }

  function renderChapterProgress(course) {
    const chapters = getCourseChapters(docId(course));

    if (!chapters.length) {
      return `
        <section class="mneet-progress-card">
          <h3 class="mneet-progress-title">Chapter Progress</h3>
          <div class="mneet-progress-empty">
            এই Course-এর জন্য কোনো published Chapter পাওয়া যায়নি।
          </div>
        </section>
      `;
    }

    return `
      <section class="mneet-progress-card">
        <h3 class="mneet-progress-title">Chapter-wise Progress</h3>
        <p class="mneet-progress-subtitle">
          প্রতিটি Chapter-এ কতগুলো Topic-এ Quiz attempt হয়েছে।
        </p>

        ${chapters.map(chapter => {
          const progress = getChapterProgress(
            docId(chapter),
            docId(course)
          );

          const percentage = progress.progressPercentage;

          return `
            <div class="mneet-progress-item">
              <div class="mneet-progress-row">
                <strong>
                  ${escapeHTML(chapter.name || chapter.title || "Chapter")}
                </strong>

                <span class="mneet-progress-percent">
                  ${percentage == null ? "তথ্য নেই" : percentage + "%"}
                </span>
              </div>

              ${percentage == null
                ? `<p class="mneet-progress-item-meta">
                    Topic data পাওয়া যায়নি।
                  </p>`
                : `
                  <div class="mneet-progress-bar">
                    <div class="mneet-progress-fill"
                      style="width:${percentage}%"></div>
                  </div>

                  <div class="mneet-progress-item-meta">
                    ${progress.attemptedTopics} / ${progress.totalTopics}
                    Topic-এ অন্তত একটি Quiz attempt হয়েছে।
                  </div>
                `}
            </div>
          `;
        }).join("")}
      </section>
    `;
  }

  function renderTopicProgress(course) {
    const courseId = docId(course);
    const chapters = getCourseChapters(courseId);

    const rows = [];

    chapters.forEach(chapter => {
      const topics = getChapterTopics(docId(chapter), courseId);

      topics.forEach(topic => {
        const progress = getTopicProgress(docId(topic));
        const lastResult = state.results
          .filter(result => getTopicId(result) === docId(topic))
          .sort((a, b) => {
            const dateA = a.createdAt && a.createdAt.toDate
              ? a.createdAt.toDate().getTime()
              : new Date(a.createdAt || 0).getTime();

            const dateB = b.createdAt && b.createdAt.toDate
              ? b.createdAt.toDate().getTime()
              : new Date(b.createdAt || 0).getTime();

            return dateB - dateA;
          })[0];

        rows.push({
          topic,
          chapter,
          progress,
          lastResult
        });
      });
    });

    if (!rows.length) {
      return `
        <section class="mneet-progress-card">
          <h3 class="mneet-progress-title">Topic-wise Progress</h3>
          <div class="mneet-progress-empty">
            এই Course-এর জন্য কোনো published Topic পাওয়া যায়নি।
          </div>
        </section>
      `;
    }

    return `
      <section class="mneet-progress-card">
        <h3 class="mneet-progress-title">Topic-wise Progress</h3>

        ${rows.map(row => `
          <div class="mneet-progress-item">
            <div class="mneet-progress-item-title">
              ${escapeHTML(row.topic.name || row.topic.title || "Topic")}
            </div>

            <div class="mneet-progress-item-meta">
              Chapter:
              ${escapeHTML(row.chapter.name || row.chapter.title || "—")}
              <br>
              Quiz Attempts: ${row.progress.attemptCount}
              <br>
              Accuracy:
              ${row.progress.accuracy == null
                ? "তথ্য নেই"
                : row.progress.accuracy.toFixed(1) + "%"}
              <br>
              সর্বশেষ Score:
              ${row.lastResult
                ? escapeHTML(
                    row.lastResult.score +
                    (row.lastResult.maxScore
                      ? " / " + row.lastResult.maxScore
                      : "")
                  )
                : "এখনো কোনো result নেই"}
            </div>

            <div class="mneet-progress-detail">
              ${row.progress.hasAttempt
                ? "Quiz attempt পাওয়া গেছে।"
                : "এখনো Quiz attempt পাওয়া যায়নি।"}
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }

  function renderRecentResults(course) {
    const results = getCourseResults(docId(course))
      .sort((a, b) => {
        const dateA = a.createdAt && a.createdAt.toDate
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt || 0).getTime();

        const dateB = b.createdAt && b.createdAt.toDate
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt || 0).getTime();

        return dateB - dateA;
      })
      .slice(0, 5);

    if (!results.length) {
      return `
        <section class="mneet-progress-card">
          <h3 class="mneet-progress-title">Recent Quiz Results</h3>
          <div class="mneet-progress-empty">
            এখনো কোনো quiz result সংরক্ষিত নেই।
          </div>
        </section>
      `;
    }

    return `
      <section class="mneet-progress-card">
        <h3 class="mneet-progress-title">Recent Quiz Results</h3>

        ${results.map(result => `
          <div class="mneet-progress-item">
            <div class="mneet-progress-item-title">
              ${escapeHTML(result.quizTitle || result.title || "Quiz")}
            </div>

            <div class="mneet-progress-item-meta">
              Score: ${escapeHTML(result.score ?? "—")}
              ${result.maxScore
                ? " / " + escapeHTML(result.maxScore)
                : ""}
              <br>
              Accuracy:
              ${result.accuracy == null
                ? "তথ্য নেই"
                : escapeHTML(number(result.accuracy).toFixed(1) + "%")}
              <br>
              Correct: ${escapeHTML(result.correctAnswers ?? "—")}
              · Incorrect: ${escapeHTML(result.incorrectAnswers ?? "—")}
              · Skipped: ${escapeHTML(result.skippedAnswers ?? "—")}
            </div>
          </div>
        `).join("")}
      </section>
    `;
  }

  function render() {
    const container = getContainer();
    if (!container) return false;

    addStyles();

    const visibleCourses = getVisibleCourses();

    if (!visibleCourses.length) {
      container.innerHTML = `
        <div class="mneet-progress">
          <section class="mneet-progress-card">
            <h2 class="mneet-progress-title">My Progress</h2>
            <div class="mneet-progress-empty">
              তোমার কোনো approved course পাওয়া যায়নি।
              Admin payment approve করলে Course Progress এখানে দেখা যাবে।
            </div>
          </section>
        </div>
      `;
      return true;
    }

    const course = getSelectedCourse();

    if (!course || !visibleCourses.some(
      item => docId(item) === docId(course)
    )) {
      state.selectedCourseId = docId(visibleCourses[0]);
    }

    const selectedCourse = getSelectedCourse();

    container.innerHTML = `
      <div class="mneet-progress">
        <section class="mneet-progress-card">
          <h1 class="mneet-progress-title">My Learning Progress</h1>
          <p class="mneet-progress-subtitle">
            তোমার কেনা Course-এর Quiz activity ও উপলব্ধ progress data দেখো।
          </p>

          ${renderCourseSelector(visibleCourses)}
        </section>

        ${selectedCourse ? renderOverview(selectedCourse) : ""}
        ${selectedCourse ? renderChapterProgress(selectedCourse) : ""}
        ${selectedCourse ? renderTopicProgress(selectedCourse) : ""}
        ${selectedCourse ? renderRecentResults(selectedCourse) : ""}
      </div>
    `;

    const select = container.querySelector("#mneetProgressCourseSelect");

    if (select) {
      select.addEventListener("change", event => {
        state.selectedCourseId = event.target.value;
        render();
      });
    }

    return true;
  }

  async function refresh() {
    try {
      await loadData();
      render();
      return true;
    } catch (error) {
      state.lastError = error;

      const container = getContainer();

      if (container) {
        addStyles();

        container.innerHTML = `
          <div class="mneet-progress">
            <div class="mneet-progress-message">
              Progress load করা যায়নি।
              Firebase connection এবং Security Rules পরীক্ষা করো।
            </div>

            <button type="button"
              class="mneet-progress-button mneet-progress-button-primary"
              data-mneet-progress-action="retry">
              আবার চেষ্টা করো
            </button>
          </div>
        `;
      }

      console.error("[mNEET Progress] Refresh failed:", error);
      return false;
    }
  }

  function handleClick(event) {
    const button = event.target.closest(
      "[data-mneet-progress-action]"
    );

    if (!button) return;

    if (button.dataset.mneetProgressAction === "retry") {
      refresh();
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);

    document.addEventListener("mneet:student-page-change", event => {
      const detail = event.detail || {};
      const page = String(
        detail.page || detail.pageName || detail.name || ""
      ).toLowerCase();

      if (page.includes("progress")) {
        refresh();
      }
    });

    document.addEventListener("mneet:quiz-submitted", () => {
      /*
        Allow the Quiz and Results modules to finish saving first.
      */
      setTimeout(() => {
        if (state.user) refresh();
      }, 1200);
    });

    document.addEventListener("mneet:student-ready", () => {
      if (state.user) refresh();
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
          state.courses = [];
          state.purchases = [];
          state.subjects = [];
          state.chapters = [];
          state.topics = [];
          state.attempts = [];
          state.results = [];
          state.selectedCourseId = "";
          return;
        }

        await refresh();
      });

      state.initialized = true;
    } catch (error) {
      state.lastError = error;
      console.error("[mNEET Progress] Initialization failed:", error);
    }
  }

  window.MNEETStudentProgress = {
    initialize,
    refresh,
    render,
    loadData,

    getCourseProgress,
    getChapterProgress,
    getTopicProgress,

    getState() {
      return {
        user: state.user,
        courses: [...state.courses],
        purchases: [...state.purchases],
        subjects: [...state.subjects],
        chapters: [...state.chapters],
        topics: [...state.topics],
        attempts: [...state.attempts],
        results: [...state.results],
        selectedCourseId: state.selectedCourseId,
        loading: state.loading,
        lastError: state.lastError
      };
    },

    getLastError() {
      return state.lastError;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();
