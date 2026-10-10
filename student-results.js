/* ==========================================================
   mNEET — FILE 36
   Student Quiz Results, Analysis & Answer Review
   Theme: Green + White Dark Mode
   ========================================================== */

(function () {
  "use strict";

  const COLLECTIONS = {
    users: "users",
    quizResults: "quizResults",
    quizAttempts: "quizAttempts"
  };

  const state = {
    user: null,
    latestResult: null,
    resultId: null,
    history: [],
    loading: false,
    initialized: false,
    savedResultIds: new Set(),
    lastError: null
  };

  let authListenerAdded = false;
  let quizSubmitListenerAdded = false;

  const styles = `
    .mneet-results {
      color: #FFFFFF;
      background: #071A12;
      padding: 16px;
      border-radius: 18px;
      width: 100%;
      box-sizing: border-box;
    }

    .mneet-results * {
      box-sizing: border-box;
    }

    .mneet-result-card {
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 16px;
      padding: 18px;
      margin-bottom: 16px;
    }

    .mneet-result-title {
      color: #FFFFFF;
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 8px;
    }

    .mneet-result-subtitle {
      color: #D1D5DB;
      font-size: 14px;
      margin: 0 0 16px;
      line-height: 1.6;
    }

    .mneet-result-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .mneet-result-stat {
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 12px;
      padding: 14px;
      min-width: 0;
    }

    .mneet-result-stat-label {
      color: #D1D5DB;
      font-size: 12px;
      margin-bottom: 8px;
    }

    .mneet-result-stat-value {
      color: #22C55E;
      font-size: 25px;
      font-weight: 800;
      overflow-wrap: anywhere;
    }

    .mneet-result-stat-detail {
      color: #D1D5DB;
      font-size: 12px;
      margin-top: 5px;
    }

    .mneet-result-progress {
      background: #10291D;
      height: 10px;
      overflow: hidden;
      border-radius: 20px;
      margin: 10px 0;
    }

    .mneet-result-progress-fill {
      background: #22C55E;
      height: 100%;
      width: 0;
      border-radius: 20px;
      transition: width .3s ease;
    }

    .mneet-result-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
    }

    .mneet-result-btn {
      border: 1px solid #28513A;
      background: #10291D;
      color: #FFFFFF;
      border-radius: 10px;
      padding: 11px 15px;
      min-height: 42px;
      font-weight: 700;
      cursor: pointer;
    }

    .mneet-result-btn-primary {
      background: #16A34A;
      border-color: #16A34A;
      color: #FFFFFF;
    }

    .mneet-result-btn:hover {
      border-color: #22C55E;
    }

    .mneet-result-section-title {
      font-size: 18px;
      font-weight: 800;
      color: #FFFFFF;
      margin: 0 0 14px;
    }

    .mneet-answer-card {
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 12px;
      padding: 15px;
      margin-bottom: 12px;
    }

    .mneet-answer-question {
      color: #FFFFFF;
      font-weight: 700;
      line-height: 1.65;
      margin-bottom: 12px;
      overflow-wrap: anywhere;
    }

    .mneet-answer-line {
      color: #D1D5DB;
      line-height: 1.6;
      margin: 7px 0;
      overflow-wrap: anywhere;
    }

    .mneet-answer-correct {
      color: #22C55E;
      font-weight: 700;
    }

    .mneet-answer-wrong {
      color: #FFFFFF;
      border-left: 3px solid #16A34A;
      padding-left: 10px;
    }

    .mneet-answer-solution {
      border-top: 1px solid #28513A;
      margin-top: 12px;
      padding-top: 12px;
      color: #D1D5DB;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .mneet-result-history-item {
      border: 1px solid #28513A;
      border-radius: 12px;
      background: #10291D;
      padding: 14px;
      margin-bottom: 10px;
    }

    .mneet-result-history-title {
      color: #FFFFFF;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .mneet-result-empty {
      background: #0D2419;
      border: 1px dashed #28513A;
      border-radius: 12px;
      color: #D1D5DB;
      padding: 20px;
      text-align: center;
      line-height: 1.7;
    }

    .mneet-result-message {
      background: #10291D;
      border: 1px solid #28513A;
      color: #FFFFFF;
      padding: 12px;
      border-radius: 10px;
      margin-bottom: 14px;
      line-height: 1.6;
    }

    .mneet-result-table {
      width: 100%;
      border-collapse: collapse;
      color: #FFFFFF;
    }

    .mneet-result-table th,
    .mneet-result-table td {
      border-bottom: 1px solid #28513A;
      padding: 11px 8px;
      text-align: left;
      font-size: 13px;
    }

    .mneet-result-table th {
      color: #22C55E;
    }

    .mneet-result-table-wrap {
      width: 100%;
      overflow-x: auto;
    }

    @media (min-width: 700px) {
      .mneet-result-grid {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .mneet-results {
        padding: 22px;
      }
    }
  `;

  function addStyles() {
    if (document.getElementById("mneetResultsStyles")) return;

    const style = document.createElement("style");
    style.id = "mneetResultsStyles";
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function getFirebase() {
    if (window.MNEETFirebase &&
        window.MNEETFirebase.db &&
        window.MNEETFirebase.auth) {
      return {
        db: window.MNEETFirebase.db,
        auth: window.MNEETFirebase.auth
      };
    }

    if (typeof firebase !== "undefined" &&
        firebase.apps &&
        firebase.apps.length) {
      return {
        db: firebase.firestore(),
        auth: firebase.auth()
      };
    }

    throw new Error("Firebase এখনো প্রস্তুত নয়। পেজ রিফ্রেশ করে আবার চেষ্টা করো।");
  }

  function getStudentAPI() {
    return window.MNEETStudent || null;
  }

  function getCurrentUser() {
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
      "studentResultsContent",
      "studentResultsPageContent",
      "studentPageResults",
      "studentResultContent",
      "studentQuizResultContent"
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) return element;
    }

    const quizContainer = document.getElementById("studentQuizContent");

    if (quizContainer && state.latestResult) {
      return quizContainer;
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

  function toNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function getDateValue(value) {
    if (!value) return null;

    if (value.toDate && typeof value.toDate === "function") {
      return value.toDate();
    }

    if (value instanceof Date) return value;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatDate(value) {
    const date = getDateValue(value);
    if (!date) return "তারিখ পাওয়া যায়নি";

    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Math.floor(toNumber(seconds)));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;

    if (hours > 0) {
      return hours + "h " + minutes + "m " + remainingSeconds + "s";
    }

    return minutes + "m " + remainingSeconds + "s";
  }

  function getResultId(result) {
    if (!result) return "";

    return String(
      result.resultId ||
      result.id ||
      result.attemptId ||
      result.quizAttemptId ||
      ""
    );
  }

  function normaliseQuestionResult(item, index) {
    const question = item || {};

    return {
      questionId: question.questionId || question.id || "",
      questionNumber: toNumber(
        question.questionNumber || question.order,
        index + 1
      ),
      questionText: question.questionText ||
        question.text ||
        question.question ||
        "",
      questionImage: question.questionImage ||
        question.imageUrl ||
        question.diagramUrl ||
        "",
      selectedAnswer: question.selectedAnswer ??
        question.userAnswer ??
        question.answerGiven ??
        "",
      correctAnswer: question.correctAnswer ??
        question.correctOption ??
        "",
      isCorrect: question.isCorrect === true ||
        question.correct === true,
      isSkipped: question.isSkipped === true ||
        question.skipped === true,
      solution: question.solution || question.explanation || "",
      ncertReference: question.ncertReference ||
        question.ncertRef ||
        question.reference ||
        "",
      options: Array.isArray(question.options)
        ? question.options
        : []
    };
  }

  function normaliseResult(raw) {
    const data = raw || {};
    const answers = Array.isArray(data.answers)
      ? data.answers
      : Array.isArray(data.answerDetails)
        ? data.answerDetails
        : Array.isArray(data.questions)
          ? data.questions
          : [];

    const normalisedAnswers = answers.map(normaliseQuestionResult);

    const totalQuestions = toNumber(
      data.totalQuestions || data.questionCount,
      normalisedAnswers.length
    );

    const correct = toNumber(
      data.correctAnswers ?? data.correct,
      normalisedAnswers.filter(item => item.isCorrect).length
    );

    const incorrect = toNumber(
      data.incorrectAnswers ?? data.incorrect,
      normalisedAnswers.filter(
        item => !item.isCorrect &&
          !item.isSkipped &&
          item.selectedAnswer !== ""
      ).length
    );

    const skipped = toNumber(
      data.skippedAnswers ?? data.skipped,
      Math.max(0, totalQuestions - correct - incorrect)
    );

    const accuracy = data.accuracy != null
      ? toNumber(data.accuracy)
      : totalQuestions > 0
        ? (correct / totalQuestions) * 100
        : 0;

    return {
      ...data,
      id: data.id || data.resultId || "",
      quizId: data.quizId || "",
      quizTitle: data.quizTitle || data.title || "Quiz Result",
      courseId: data.courseId || "",
      subjectId: data.subjectId || "",
      chapterId: data.chapterId || "",
      topicId: data.topicId || "",
      totalQuestions,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      skippedAnswers: skipped,
      score: toNumber(data.score ?? data.totalScore),
      maxScore: toNumber(data.maxScore ?? data.totalMarks),
      accuracy: Math.max(0, Math.min(100, accuracy)),
      completionPercentage: totalQuestions > 0
        ? Math.max(
            0,
            Math.min(
              100,
              ((correct + incorrect) / totalQuestions) * 100
            )
          )
        : 0,
      timeTakenSeconds: toNumber(
        data.timeTakenSeconds ??
        data.elapsedSeconds ??
        data.timeTaken
      ),
      attemptNumber: toNumber(data.attemptNumber, 1),
      answers: normalisedAnswers,
      createdAt: data.createdAt || data.submittedAt || null
    };
  }

  function showMessage(message) {
    const container = getContainer();
    if (!container) return;

    let box = container.querySelector(".mneet-result-message");

    if (!box) {
      box = document.createElement("div");
      box.className = "mneet-result-message";
      container.prepend(box);
    }

    box.textContent = message;
  }

  function getScorePercentage(result) {
    if (!result || result.maxScore <= 0) return 0;

    return Math.max(
      0,
      Math.min(100, (result.score / result.maxScore) * 100)
    );
  }

  function getPreviousBest(result) {
    const previous = state.history.filter(item =>
      item.quizId === result.quizId &&
      getResultId(item) !== getResultId(result)
    );

    if (!previous.length) return null;

    return previous.reduce((best, item) =>
      item.score > best.score ? item : best
    );
  }

  function renderStat(label, value, detail) {
    return `
      <div class="mneet-result-stat">
        <div class="mneet-result-stat-label">${escapeHTML(label)}</div>
        <div class="mneet-result-stat-value">${escapeHTML(value)}</div>
        ${detail
          ? `<div class="mneet-result-stat-detail">${escapeHTML(detail)}</div>`
          : ""}
      </div>
    `;
  }

  function renderSummary(result) {
    const previousBest = getPreviousBest(result);

    let comparison = "এটি তোমার সংরক্ষিত ফলাফল।";

    if (previousBest) {
      const difference = result.score - previousBest.score;

      if (difference > 0) {
        comparison = "আগের সর্বোচ্চ স্কোরের থেকে " +
          difference + " নম্বর বেশি।";
      } else if (difference < 0) {
        comparison = "আগের সর্বোচ্চ স্কোরের থেকে " +
          Math.abs(difference) + " নম্বর কম।";
      } else {
        comparison = "আগের সর্বোচ্চ স্কোরের সমান।";
      }
    }

    const scorePercentage = getScorePercentage(result);

    return `
      <section class="mneet-result-card">
        <h2 class="mneet-result-title">Quiz Result</h2>
        <p class="mneet-result-subtitle">
          ${escapeHTML(result.quizTitle)}
          · Attempt ${escapeHTML(result.attemptNumber)}
        </p>

        <div class="mneet-result-grid">
          ${renderStat("মোট Score", result.score,
            result.maxScore > 0 ? "সর্বোচ্চ " + result.maxScore : "")}
          ${renderStat("Accuracy", result.accuracy.toFixed(1) + "%")}
          ${renderStat("সঠিক উত্তর", result.correctAnswers)}
          ${renderStat("ভুল উত্তর", result.incorrectAnswers)}
          ${renderStat("Skipped", result.skippedAnswers)}
          ${renderStat("মোট প্রশ্ন", result.totalQuestions)}
          ${renderStat("সময়", formatDuration(result.timeTakenSeconds))}
          ${renderStat("Completion", result.completionPercentage.toFixed(1) + "%")}
        </div>

        <div class="mneet-result-subtitle">Score Percentage</div>
        <div class="mneet-result-progress">
          <div class="mneet-result-progress-fill"
            style="width:${scorePercentage}%"></div>
        </div>

        <p class="mneet-result-subtitle">
          ${escapeHTML(comparison)}
        </p>

        <p class="mneet-result-subtitle">
          জমা দেওয়ার সময়: ${escapeHTML(formatDate(result.createdAt))}
        </p>

        <div class="mneet-result-actions">
          <button type="button"
            class="mneet-result-btn mneet-result-btn-primary"
            data-mneet-result-action="review">
            Review Answers
          </button>

          <button type="button"
            class="mneet-result-btn"
            data-mneet-result-action="reattempt">
            Reattempt Quiz
          </button>

          <button type="button"
            class="mneet-result-btn"
            data-mneet-result-action="history">
            Previous Attempts
          </button>

          <button type="button"
            class="mneet-result-btn"
            data-mneet-result-action="back">
            Back to Topics
          </button>
        </div>
      </section>
    `;
  }

  function renderAnswerCard(item, index) {
    const questionText = item.questionText ||
      ("Question " + (index + 1));

    const selected = item.selectedAnswer === ""
      ? "উত্তর দেওয়া হয়নি"
      : String(item.selectedAnswer);

    const correct = item.correctAnswer === ""
      ? "সঠিক উত্তর পাওয়া যায়নি"
      : String(item.correctAnswer);

    let status = "উত্তর যাচাইয়ের তথ্য নেই";

    if (item.isSkipped || item.selectedAnswer === "") {
      status = "Skipped";
    } else if (item.isCorrect) {
      status = "Correct";
    } else {
      status = "Incorrect";
    }

    return `
      <article class="mneet-answer-card">
        <div class="mneet-answer-question">
          Q${index + 1}. ${escapeHTML(questionText)}
        </div>

        ${item.questionImage
          ? `<p class="mneet-answer-line">
              <a href="${escapeHTML(item.questionImage)}"
                 target="_blank" rel="noopener noreferrer"
                 class="mneet-result-btn">প্রশ্নের ছবি দেখো</a>
            </p>`
          : ""}

        <p class="mneet-answer-line">
          Status: <strong>${escapeHTML(status)}</strong>
        </p>

        <p class="mneet-answer-line">
          তোমার উত্তর:
          <strong>${escapeHTML(selected)}</strong>
        </p>

        <p class="mneet-answer-line mneet-answer-correct">
          সঠিক উত্তর: ${escapeHTML(correct)}
        </p>

        ${item.solution
          ? `<div class="mneet-answer-solution">
              <strong>Solution:</strong><br>
              ${escapeHTML(item.solution)}
            </div>`
          : ""}

        ${item.ncertReference
          ? `<div class="mneet-answer-solution">
              <strong>NCERT Reference:</strong><br>
              ${escapeHTML(item.ncertReference)}
            </div>`
          : ""}
      </article>
    `;
  }

  function renderAnswerReview(result) {
    if (!result.answers.length) {
      return `
        <section class="mneet-result-card">
          <h3 class="mneet-result-section-title">Answer Review</h3>
          <div class="mneet-result-empty">
            এই ফলাফলের সঙ্গে question-wise answer details সংরক্ষিত নেই।
            Quiz System-এ answer details সংরক্ষণ করা হলে এখানে দেখা যাবে।
          </div>
        </section>
      `;
    }

    return `
      <section class="mneet-result-card" id="mneetAnswerReview">
        <h3 class="mneet-result-section-title">Answer Review</h3>
        <p class="mneet-result-subtitle">
          প্রতিটি প্রশ্নের উত্তর ও উপলব্ধ ব্যাখ্যা দেখো।
        </p>

        ${result.answers.map(renderAnswerCard).join("")}
      </section>
    `;
  }

  function renderHistory() {
    if (!state.history.length) {
      return `
        <section class="mneet-result-card" id="mneetResultHistory">
          <h3 class="mneet-result-section-title">Previous Attempts</h3>
          <div class="mneet-result-empty">
            এখনো কোনো সংরক্ষিত quiz attempt পাওয়া যায়নি।
          </div>
        </section>
      `;
    }

    const rows = state.history.map((item, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(item.quizTitle)}</td>
        <td>${escapeHTML(item.score)}</td>
        <td>${escapeHTML(item.accuracy.toFixed(1) + "%")}</td>
        <td>${escapeHTML(formatDuration(item.timeTakenSeconds))}</td>
        <td>${escapeHTML(formatDate(item.createdAt))}</td>
        <td>
          <button type="button"
            class="mneet-result-btn"
            data-mneet-open-result="${escapeHTML(getResultId(item))}">
            View
          </button>
        </td>
      </tr>
    `).join("");

    return `
      <section class="mneet-result-card" id="mneetResultHistory">
        <h3 class="mneet-result-section-title">Previous Attempts</h3>

        <div class="mneet-result-table-wrap">
          <table class="mneet-result-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Quiz</th>
                <th>Score</th>
                <th>Accuracy</th>
                <th>Time</th>
                <th>Date</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function render() {
    const container = getContainer();
    if (!container) return false;

    addStyles();

    if (!state.latestResult) {
      container.innerHTML = `
        <div class="mneet-results">
          <section class="mneet-result-card">
            <h2 class="mneet-result-title">Quiz Results</h2>
            <div class="mneet-result-empty">
              কোনো quiz result নির্বাচন করা হয়নি।
              Quiz শেষ করার পরে এখানে ফলাফল দেখা যাবে।
            </div>
          </section>
          ${renderHistory()}
        </div>
      `;
      return true;
    }

    container.innerHTML = `
      <div class="mneet-results">
        ${renderSummary(state.latestResult)}
        ${renderAnswerReview(state.latestResult)}
        ${renderHistory()}
      </div>
    `;

    return true;
  }

  async function saveResult(result) {
    const user = getCurrentUser();
    if (!user) throw new Error("Result সংরক্ষণ করতে আগে Sign In করো।");

    const fb = getFirebase();
    const normalised = normaliseResult(result);

    normalised.userId = user.uid;
    normalised.studentId = user.uid;
    normalised.studentEmail = user.email || "";
    normalised.createdAt = normalised.createdAt ||
      firebase.firestore.FieldValue.serverTimestamp();

    const providedId = getResultId(result);

    if (providedId && state.savedResultIds.has(providedId)) {
      return providedId;
    }

    const payload = {
      userId: user.uid,
      studentId: user.uid,
      studentEmail: user.email || "",
      quizId: normalised.quizId,
      quizTitle: normalised.quizTitle,
      courseId: normalised.courseId,
      subjectId: normalised.subjectId,
      chapterId: normalised.chapterId,
      topicId: normalised.topicId,
      totalQuestions: normalised.totalQuestions,
      correctAnswers: normalised.correctAnswers,
      incorrectAnswers: normalised.incorrectAnswers,
      skippedAnswers: normalised.skippedAnswers,
      score: normalised.score,
      maxScore: normalised.maxScore,
      accuracy: normalised.accuracy,
      completionPercentage: normalised.completionPercentage,
      timeTakenSeconds: normalised.timeTakenSeconds,
      attemptNumber: normalised.attemptNumber,
      answers: normalised.answers,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    let docRef;

    if (providedId) {
      docRef = fb.db.collection(COLLECTIONS.quizResults).doc(providedId);

      const existing = await docRef.get();

      if (existing.exists) {
        const oldData = existing.data() || {};

        if (oldData.userId !== user.uid) {
          throw new Error("এই result সংরক্ষণ করার অনুমতি নেই।");
        }

        state.savedResultIds.add(providedId);
        return providedId;
      }

      await docRef.set(payload);
    } else {
      docRef = await fb.db.collection(COLLECTIONS.quizResults).add(payload);
    }

    state.savedResultIds.add(docRef.id);

    return docRef.id;
  }

  async function loadHistory(options = {}) {
    const user = getCurrentUser();
    if (!user) return [];

    const fb = getFirebase();

    try {
      const snapshot = await fb.db
        .collection(COLLECTIONS.quizResults)
        .where("userId", "==", user.uid)
        .get();

      const results = [];

      snapshot.forEach(doc => {
        results.push(normaliseResult({
          ...doc.data(),
          id: doc.id
        }));
      });

      results.sort((a, b) => {
        const dateA = getDateValue(a.createdAt);
        const dateB = getDateValue(b.createdAt);

        return (dateB ? dateB.getTime() : 0) -
          (dateA ? dateA.getTime() : 0);
      });

      state.history = results;

      if (options.render !== false) render();

      return results;
    } catch (error) {
      state.lastError = error;
      console.error("[mNEET Results] History load failed:", error);
      throw error;
    }
  }

  async function handleQuizResult(rawResult) {
    if (!rawResult || typeof rawResult !== "object") {
      throw new Error("Quiz result data পাওয়া যায়নি।");
    }

    const user = getCurrentUser();
    if (!user) {
      throw new Error("Result সংরক্ষণ করতে আগে Sign In করো।");
    }

    state.loading = true;
    state.lastError = null;

    try {
      let result = normaliseResult(rawResult);

      if (!result.quizId && window.MNEETStudentQuiz) {
        const quizState = window.MNEETStudentQuiz.getState();

        if (quizState) {
          result.quizId = quizState.quizId || "";
          result.courseId = result.courseId || quizState.courseId || "";
          result.chapterId = result.chapterId || quizState.chapterId || "";
          result.topicId = result.topicId || quizState.topicId || "";
        }
      }

      state.latestResult = result;

      try {
        const id = await saveResult(result);
        result.id = id;
        result.resultId = id;
        state.resultId = id;
      } catch (saveError) {
        /*
          Result screen remains available if Firestore rejects the write.
          The message is shown so the student knows it was not saved.
        */
        state.lastError = saveError;
        console.error("[mNEET Results] Save failed:", saveError);
      }

      try {
        await loadHistory({ render: false });
      } catch (historyError) {
        console.warn("[mNEET Results] History unavailable:", historyError);
      }

      render();

      if (state.lastError) {
        showMessage(
          "ফলাফল দেখানো হয়েছে, কিন্তু Firestore-এ সংরক্ষণ করা যায়নি। " +
          "Firebase Security Rules ও Console Error পরীক্ষা করতে হবে।"
        );
      }

      return result;
    } finally {
      state.loading = false;
    }
  }

  async function openSavedResult(resultId) {
    const user = getCurrentUser();
    if (!user) throw new Error("আগে Sign In করো।");

    const selected = state.history.find(
      item => getResultId(item) === resultId
    );

    if (!selected) {
      throw new Error("এই result পাওয়া যায়নি।");
    }

    state.latestResult = selected;
    state.resultId = resultId;
    render();

    return selected;
  }

  function reviewAnswers() {
    const section = document.getElementById("mneetAnswerReview");

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }

  function reattemptQuiz() {
    const result = state.latestResult;
    if (!result || !result.quizId) {
      showMessage("এই result-এর সঙ্গে Quiz ID পাওয়া যায়নি।");
      return;
    }

    const quizAPI = window.MNEETStudentQuiz;

    if (quizAPI && typeof quizAPI.openQuiz === "function") {
      quizAPI.openQuiz({
        quizId: result.quizId,
        courseId: result.courseId,
        subjectId: result.subjectId,
        chapterId: result.chapterId,
        topicId: result.topicId,
        reattempt: true
      }).catch(error => {
        state.lastError = error;
        showMessage(error.message || "Quiz আবার খোলা যায়নি।");
      });

      return;
    }

    showMessage("Quiz module এখনো লোড হয়নি।");
  }

  function goBack() {
    const student = getStudentAPI();

    if (student && typeof student.navigateTo === "function") {
      student.navigateTo("topics", {
        courseId: state.latestResult?.courseId || "",
        chapterId: state.latestResult?.chapterId || "",
        topicId: state.latestResult?.topicId || ""
      });
      return;
    }

    if (student && typeof student.showPage === "function") {
      student.showPage("topics");
      return;
    }

    showMessage("Topics page-এর navigation এখনো প্রস্তুত নয়।");
  }

  function handleClick(event) {
    const actionButton = event.target.closest(
      "[data-mneet-result-action]"
    );

    if (actionButton) {
      const action = actionButton.dataset.mneetResultAction;

      if (action === "review") reviewAnswers();
      if (action === "reattempt") reattemptQuiz();

      if (action === "history") {
        document.getElementById("mneetResultHistory")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }

      if (action === "back") goBack();

      return;
    }

    const resultButton = event.target.closest("[data-mneet-open-result]");

    if (resultButton) {
      openSavedResult(resultButton.dataset.mneetOpenResult)
        .catch(error => showMessage(error.message));
    }
  }

  async function initialize() {
    if (state.initialized) return;

    addStyles();

    if (!quizSubmitListenerAdded) {
      document.addEventListener("mneet:quiz-submitted", event => {
        const detail = event.detail || {};

        /*
          File 34 may dispatch result directly, or inside detail.result.
        */
        const result = detail.result || detail;

        handleQuizResult(result).catch(error => {
          state.lastError = error;
          console.error("[mNEET Results] Result handler failed:", error);
          showMessage(error.message || "Result process করা যায়নি।");
        });
      });

      quizSubmitListenerAdded = true;
    }

    document.addEventListener("click", handleClick);

    try {
      const fb = getFirebase();

      if (!authListenerAdded) {
        fb.auth.onAuthStateChanged(async user => {
          state.user = user || null;

          if (!user) {
            state.history = [];
            state.latestResult = null;
            state.resultId = null;
            return;
          }

          try {
            await loadHistory({ render: false });
            render();
          } catch (error) {
            state.lastError = error;
            console.error("[mNEET Results] Initialization failed:", error);
          }
        });

        authListenerAdded = true;
      }

      state.initialized = true;
    } catch (error) {
      state.lastError = error;
      console.error("[mNEET Results] Firebase initialization failed:", error);
    }
  }

  window.MNEETStudentResults = {
    initialize,
    render,
    handleQuizResult,
    saveResult,
    loadHistory,
    openSavedResult,
    reviewAnswers,
    reattemptQuiz,
    goBack,

    getState() {
      return {
        user: state.user,
        latestResult: state.latestResult,
        resultId: state.resultId,
        history: [...state.history],
        loading: state.loading,
        lastError: state.lastError
      };
    },

    getLatestResult() {
      return state.latestResult;
    },

    getHistory() {
      return [...state.history];
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
