/* =========================================================
   mNEET STUDENT QUIZ
   File: student-quiz.js

   Topic-wise and Chapter-wise Quiz Interface
   Green + White Theme
   ========================================================= */

(function () {
  "use strict";

  const MODULE = "MNEETStudentQuiz";

  const COLLECTIONS = {
    quizzes: "quizzes",
    questions: "questions",
    purchases: "purchases"
  };

  const QUIZ_TYPES = {
    topic: "Topic Wise Practice",
    assertion_reason: "Assertion–Reason",
    statement_based: "Statement Based",
    match_following: "Match the Following",
    correct_incorrect: "Correct / Incorrect",
    diagram_based: "Diagram Based",
    pyq: "Previous Year Questions",
    fill_blanks: "Fill in the Blanks",
    rapid_revision: "Rapid Revision"
  };

  const state = {
    initialized: false,
    loading: false,
    submitting: false,
    finished: false,

    user: null,
    quiz: null,
    quizId: "",
    courseId: "",
    subjectId: "",
    chapterId: "",
    topicId: "",

    questions: [],
    currentIndex: 0,

    answers: {},
    submittedAnswers: {},
    feedback: {},

    attemptNumber: 1,
    startedAt: 0,
    error: ""
  };

  let db = null;
  let auth = null;
  let stylesAdded = false;
  let eventsAdded = false;

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

  function getFirebase() {
    if (window.MNEETFirebase) {
      db = window.MNEETFirebase.db || db;
      auth = window.MNEETFirebase.auth || auth;
    }

    if (window.firebase) {
      if (!db && firebase.firestore) {
        db = firebase.firestore();
      }

      if (!auth && firebase.auth) {
        auth = firebase.auth();
      }
    }

    return Boolean(db && auth);
  }

  function getStudentAPI() {
    return window.MNEETStudent || null;
  }

  function getTimerAPI() {
    return window.MNEETStudentQuizTimer || null;
  }

  function getResultsAPI() {
    return window.MNEETStudentResults || null;
  }

  function getUser() {
    const api = getStudentAPI();

    if (api && typeof api.getCurrentUser === "function") {
      const user = api.getCurrentUser();

      if (user) {
        state.user = user;
        return user;
      }
    }

    if (auth && auth.currentUser) {
      state.user = auth.currentUser;
      return auth.currentUser;
    }

    return state.user;
  }

  function getContainer() {
    return document.getElementById("studentQuizContent") ||
      document.getElementById("studentQuizContainer") ||
      document.getElementById("studentQuizPageContent") ||
      document.getElementById("studentPageQuiz") ||
      document.getElementById("studentQuizPage");
  }

  function getId(item) {
    return String(
      item && (
        item.id ||
        item.quizId ||
        item.questionId
      ) || ""
    );
  }

  function getRelation(item, fields) {
    if (!item) return "";

    for (const field of fields) {
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

  function normaliseAnswer(value) {
    const answer = String(
      value == null ? "" : value
    ).trim().toUpperCase();

    if (/^[A-D]$/.test(answer)) {
      return answer;
    }

    if (/^[1-4]$/.test(answer)) {
      return ["A", "B", "C", "D"][Number(answer) - 1];
    }

    return answer;
  }

  function getOptionText(question, index) {
    const keys = [
      ["option1", "optionA"],
      ["option2", "optionB"],
      ["option3", "optionC"],
      ["option4", "optionD"]
    ];

    if (Array.isArray(question.options)) {
      const option = question.options[index];

      if (option && typeof option === "object") {
        return String(
          option.text ||
          option.value ||
          option.label ||
          ""
        );
      }

      return String(option == null ? "" : option);
    }

    for (const key of keys[index]) {
      if (question[key] !== undefined) {
        return String(question[key] || "");
      }
    }

    return "";
  }

  function getOptionImage(question, index) {
    if (
      Array.isArray(question.options) &&
      question.options[index] &&
      typeof question.options[index] === "object"
    ) {
      return String(
        question.options[index].imageUrl ||
        question.options[index].image ||
        ""
      );
    }

    return "";
  }

  function getOptions(question) {
    const output = [];

    for (let i = 0; i < 4; i++) {
      const text = getOptionText(question, i);
      const image = getOptionImage(question, i);

      if (text.trim() || image.trim()) {
        output.push({
          letter: ["A", "B", "C", "D"][i],
          text: text,
          image: image
        });
      }
    }

    return output;
  }

  function getCorrectAnswer(question) {
    return normaliseAnswer(
      question.correctAnswer !== undefined
        ? question.correctAnswer
        : question.correctOption !== undefined
          ? question.correctOption
          : question.answer
    );
  }

  function getQuestionText(question) {
    return String(
      question.questionText ||
      question.question ||
      question.text ||
      ""
    );
  }

  function getQuestionImage(question) {
    return String(
      question.imageUrl ||
      question.questionImage ||
      question.image ||
      question.diagramUrl ||
      ""
    );
  }

  function getSolution(question) {
    return String(
      question.solution ||
      question.explanation ||
      question.answerExplanation ||
      ""
    );
  }

  function getNCERTReference(question) {
    return String(
      question.ncertReference ||
      question.ncert ||
      question.reference ||
      ""
    );
  }

  function getCurrentQuestion() {
    return state.questions[state.currentIndex] || null;
  }

  function getQuizType() {
    const type = String(
      state.quiz && (
        state.quiz.type ||
        state.quiz.quizType
      ) || "topic"
    ).toLowerCase();

    return QUIZ_TYPES[type] || "Topic Wise Practice";
  }

  function getElapsedSeconds() {
    return state.startedAt
      ? Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000))
      : 0;
  }

  function showMessage(message) {
    const api = getStudentAPI();

    if (api && typeof api.showMessage === "function") {
      api.showMessage(message, "info");
      return;
    }

    const container = getContainer();

    if (container) {
      let notice = container.querySelector(".mneet-quiz-message");

      if (!notice) {
        notice = document.createElement("p");
        notice.className = "mneet-quiz-message";
        container.prepend(notice);
      }

      notice.textContent = String(message || "");
    }
  }

  /* =========================================================
     FIRESTORE
     ========================================================= */

  async function readDocument(collection, id) {
    const doc = await db.collection(collection).doc(id).get();

    if (!doc.exists) return null;

    return {
      ...doc.data(),
      id: doc.id
    };
  }

  async function readPurchases(userId) {
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

  async function readQuestions(quizId) {
    /*
     * Supports:
     * quizzes/{quizId}/questions/{questionId}
     *
     * Or:
     * questions/{questionId}, with question.quizId
     */

    try {
      const nested = await db
        .collection(COLLECTIONS.quizzes)
        .doc(quizId)
        .collection(COLLECTIONS.questions)
        .get();

      if (!nested.empty) {
        return nested.docs.map(function (doc) {
          return {
            ...doc.data(),
            id: doc.id
          };
        });
      }
    } catch (error) {
      console.warn(
        "[mNEET Quiz] Nested question query unavailable.",
        error
      );
    }

    const snapshot = await db
      .collection(COLLECTIONS.questions)
      .where("quizId", "==", quizId)
      .get();

    return snapshot.docs.map(function (doc) {
      return {
        ...doc.data(),
        id: doc.id
      };
    });
  }

  function hasCourseAccess(courseId, purchases) {
    const api = getStudentAPI();

    if (
      api &&
      typeof api.hasCourseAccess === "function" &&
      api.hasCourseAccess(courseId)
    ) {
      return true;
    }

    return purchases.some(function (purchase) {
      const id = getRelation(purchase, [
        "courseId",
        "courseID"
      ]);

      const status = String(
        purchase.status ||
        purchase.paymentStatus ||
        purchase.approvalStatus ||
        ""
      ).toLowerCase();

      return id === String(courseId) &&
        ["approved", "paid", "completed"].includes(status);
    });
  }

  /* =========================================================
     LOAD QUIZ
     ========================================================= */

  function getSelection() {
    return {
      quizId:
        state.quizId ||
        localStorage.getItem("activeQuiz") ||
        "",

      courseId:
        state.courseId ||
        localStorage.getItem("activeCourse") ||
        "",

      subjectId:
        state.subjectId ||
        localStorage.getItem("activeSubject") ||
        "",

      chapterId:
        state.chapterId ||
        localStorage.getItem("activeChapter") ||
        "",

      topicId:
        state.topicId ||
        localStorage.getItem("activeTopic") ||
        ""
    };
  }

  async function load(options) {
    options = options || {};

    if (!getFirebase()) {
      throw new Error("Firebase is not ready.");
    }

    const user = getUser();

    if (!user || !user.uid) {
      throw new Error("Please sign in to start the quiz.");
    }

    const selection = getSelection();

    state.user = user;
    state.quizId = String(options.quizId || selection.quizId);
    state.courseId = String(options.courseId || selection.courseId);
    state.subjectId = String(options.subjectId || selection.subjectId);
    state.chapterId = String(options.chapterId || selection.chapterId);
    state.topicId = String(options.topicId || selection.topicId);

    if (!state.quizId) {
      throw new Error("No quiz selected. Please open a topic first.");
    }

    const purchases = await readPurchases(user.uid);

    state.quiz = await readDocument(
      COLLECTIONS.quizzes,
      state.quizId
    );

    if (!state.quiz) {
      throw new Error("This quiz could not be found.");
    }

    if (
      state.quiz.active === false ||
      state.quiz.published === false ||
      state.quiz.isActive === false
    ) {
      throw new Error("This quiz is not available yet.");
    }

    state.courseId = getRelation(state.quiz, [
      "courseId",
      "courseID"
    ]) || state.courseId;

    if (!hasCourseAccess(state.courseId, purchases)) {
      throw new Error(
        "This course is locked. Admin approval is required before access."
      );
    }

    const questions = await readQuestions(state.quizId);

    questions.sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });

    if (!questions.length) {
      throw new Error("No questions have been added to this quiz yet.");
    }

    state.questions = questions;
    state.currentIndex = 0;
    state.answers = {};
    state.submittedAnswers = {};
    state.feedback = {};
    state.finished = false;
    state.submitting = false;

    state.attemptNumber = Math.max(
      1,
      Number(options.attemptNumber || 1)
    );

    state.startedAt = Date.now();
    state.loading = false;
    state.initialized = true;

    localStorage.setItem("activeQuiz", state.quizId);

    render();

    /*
     * Connect to File 35 timer.
     */
    const timer = getTimerAPI();

    if (timer && typeof timer.start === "function") {
      timer.start({
        quizId: state.quizId,
        attemptNumber: state.attemptNumber,
        questionTime: Number(state.quiz.perQuestionTime) || 60,
        totalTime: Number(state.quiz.durationMinutes) > 0
          ? Number(state.quiz.durationMinutes) * 60
          : 0
      });

      setTimerQuestion(0);
    }

    document.dispatchEvent(
      new CustomEvent("mneet:quiz-loaded", {
        detail: {
          quizId: state.quizId,
          courseId: state.courseId,
          chapterId: state.chapterId,
          topicId: state.topicId,
          totalQuestions: state.questions.length
        }
      })
    );

    return state.questions;
  }

  /* =========================================================
     ANSWER SELECTION AND SUBMISSION
     ========================================================= */

  function selectAnswer(letter) {
    if (state.finished || state.submitting) return false;

    const question = getCurrentQuestion();

    if (!question) return false;

    const index = state.currentIndex;
    const key = normaliseAnswer(letter);

    if (state.submittedAnswers[index]) {
      showMessage("This answer has already been submitted.");
      return false;
    }

    const exists = getOptions(question).some(function (option) {
      return option.letter === key;
    });

    if (!exists) return false;

    state.answers[index] = key;

    /*
     * Before Answer Submit, only selection is highlighted.
     * Correctness is not displayed before submission.
     */
    render();

    return true;
  }

  function submitCurrentAnswer() {
    const index = state.currentIndex;
    const question = getCurrentQuestion();

    if (!question || state.finished) return false;

    if (state.submittedAnswers[index]) {
      showMessage("You have already submitted this answer.");
      return false;
    }

    const selected = state.answers[index];

    if (!selected) {
      showMessage("Please select an option first.");
      return false;
    }

    const correct = getCorrectAnswer(question);

    state.submittedAnswers[index] = true;

    if (correct) {
      state.feedback[index] = {
        checked: true,
        correct: selected === correct,
        correctAnswer: correct
      };
    } else {
      state.feedback[index] = {
        checked: false,
        correct: null,
        correctAnswer: ""
      };
    }

    /*
     * Stop this question's timer after Answer Submit.
     */
    const timer = getTimerAPI();

    if (timer && typeof timer.markQuestionAnswered === "function") {
      timer.markQuestionAnswered(
        question.id || question.questionId || "question-" + index
      );
    }

    render();

    document.dispatchEvent(
      new CustomEvent("mneet:quiz-answer-submitted", {
        detail: {
          quizId: state.quizId,
          questionId: question.id || "",
          questionIndex: index,
          selectedAnswer: selected,
          correct: state.feedback[index].correct
        }
      })
    );

    return true;
  }

  /* =========================================================
     QUESTION NAVIGATION
     ========================================================= */

  function setTimerQuestion(index) {
    const timer = getTimerAPI();

    if (!timer || typeof timer.setCurrentQuestion !== "function") {
      return;
    }

    const question = state.questions[index];

    if (!question) return;

    timer.setCurrentQuestion(
      question.id || question.questionId || "question-" + index,
      index,
      Number(state.quiz && state.quiz.perQuestionTime) || 60
    );
  }

  function goToQuestion(index) {
    if (
      state.finished ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= state.questions.length
    ) {
      return false;
    }

    state.currentIndex = index;

    render();
    setTimerQuestion(index);

    document.dispatchEvent(
      new CustomEvent("mneet:quiz-question-change", {
        detail: {
          quizId: state.quizId,
          questionId: state.questions[index].id || "",
          questionIndex: index,
          totalQuestions: state.questions.length
        }
      })
    );

    return true;
  }

  function previousQuestion() {
    return goToQuestion(state.currentIndex - 1);
  }

  function nextQuestion() {
    return goToQuestion(state.currentIndex + 1);
  }

  /* =========================================================
     RESULT CALCULATION
     ========================================================= */

  function calculateResult() {
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    let unchecked = 0;

    const answerDetails = state.questions.map(function (question, index) {
      const selected = state.answers[index] || "";
      const feedback = state.feedback[index];

      if (!selected) {
        skipped += 1;
      } else if (!state.submittedAnswers[index]) {
        unchecked += 1;
      } else if (feedback && feedback.checked) {
        if (feedback.correct) {
          correct += 1;
        } else {
          incorrect += 1;
        }
      } else {
        unchecked += 1;
      }

      return {
        questionId: question.id || "",
        selectedAnswer: selected,
        answerSubmitted: Boolean(state.submittedAnswers[index]),
        correct: feedback && feedback.checked
          ? feedback.correct
          : null
      };
    });

    const attempted = correct + incorrect;
    const accuracy = attempted > 0
      ? Math.round((correct / attempted) * 100)
      : 0;

    const total = state.questions.length;

    const marking = state.quiz || {};
    const marksCorrect = Number(marking.marksPerQuestion ?? 4);
    const marksIncorrect = Number(marking.negativeMarks ?? 1);

    const score =
      correct * marksCorrect -
      incorrect * marksIncorrect;

    return {
      quizId: state.quizId,
      courseId: state.courseId,
      subjectId: state.subjectId,
      chapterId: state.chapterId,
      topicId: state.topicId,

      totalQuestions: total,
      attemptedQuestions: attempted,
      correct: correct,
      incorrect: incorrect,
      skipped: skipped,
      unchecked: unchecked,

      score: score,
      accuracy: accuracy,
      completionPercent: total > 0
        ? Math.round((attempted / total) * 100)
        : 0,

      elapsedSeconds: getElapsedSeconds(),
      attemptNumber: state.attemptNumber,
      answers: answerDetails,

      submittedAt: new Date().toISOString()
    };
  }

  /* =========================================================
     FINAL SUBMIT
     ========================================================= */

  async function submitQuiz() {
    if (state.finished || state.submitting) return false;

    const unanswered = state.questions.filter(function (_, index) {
      return !state.answers[index];
    }).length;

    const confirmed = window.confirm(
      unanswered > 0
        ? "You have " + unanswered +
          " unanswered question(s). Submit the quiz?"
        : "Submit your quiz now?"
    );

    if (!confirmed) return false;

    state.submitting = true;

    const result = calculateResult();

    state.finished = true;
    state.submitting = false;

    const timer = getTimerAPI();

    if (timer && typeof timer.submitQuiz === "function") {
      timer.submitQuiz();
    }

    /*
     * Tell File 36 that a result is ready.
     */
    document.dispatchEvent(
      new CustomEvent("mneet:quiz-submitted", {
        detail: {
          quizId: state.quizId,
          courseId: state.courseId,
          chapterId: state.chapterId,
          topicId: state.topicId,
          result: result
        }
      })
    );

    renderFinished(result);

    const resultsAPI = getResultsAPI();

    if (
      resultsAPI &&
      typeof resultsAPI.handleQuizResult === "function"
    ) {
      try {
        await resultsAPI.handleQuizResult(result);
      } catch (error) {
        console.error(
          "[mNEET Quiz] Results module error:",
          error
        );
      }
    }

    return result;
  }

  /* =========================================================
     RENDER QUESTION
     ========================================================= */

  function renderImage(question) {
    const url = getQuestionImage(question);

    if (!url) return "";

    return `
      <div class="mneet-quiz-image-wrap">
        <img
          class="mneet-quiz-image"
          src="${escapeHTML(url)}"
          alt="Question diagram"
          loading="lazy"
        >
      </div>
    `;
  }

  function renderOption(question, option, index) {
    const selected = state.answers[index] === option.letter;
    const submitted = Boolean(state.submittedAnswers[index]);
    const feedback = state.feedback[index];

    let classes = "mneet-quiz-option";

    if (selected) classes += " is-selected";

    if (submitted && feedback && feedback.checked) {
      if (option.letter === feedback.correctAnswer) {
        classes += " is-correct";
      }

      if (selected && !feedback.correct) {
        classes += " is-wrong";
      }
    }

    const disabled = submitted || state.finished;

    return `
      <button
        type="button"
        class="${classes}"
        data-quiz-option="${escapeHTML(option.letter)}"
        ${disabled ? "disabled" : ""}
        aria-pressed="${selected ? "true" : "false"}"
      >
        <span class="mneet-quiz-option-letter">
          ${escapeHTML(option.letter)}
        </span>

        <span class="mneet-quiz-option-content">
          ${
            option.text
              ? `<span>${escapeHTML(option.text)}</span>`
              : ""
          }

          ${
            option.image
              ? `<img
                   class="mneet-quiz-option-image"
                   src="${escapeHTML(option.image)}"
                   alt="Option ${escapeHTML(option.letter)}"
                 >`
              : ""
          }
        </span>
      </button>
    `;
  }

  function renderFeedback(question, index) {
    if (!state.submittedAnswers[index]) return "";

    const feedback = state.feedback[index];

    if (!feedback || !feedback.checked) {
      return `
        <div class="mneet-quiz-feedback">
          <strong>Answer Submitted</strong>
          <p>
            The correct answer is not available for this question.
          </p>
        </div>
      `;
    }

    const solution = getSolution(question);
    const reference = getNCERTReference(question);

    return `
      <div class="mneet-quiz-feedback">
        <strong>
          ${feedback.correct ? "Correct Answer" : "Incorrect Answer"}
        </strong>

        <p>
          Correct Option:
          <strong>${escapeHTML(feedback.correctAnswer)}</strong>
        </p>

        ${
          solution
            ? `<div class="mneet-quiz-solution">
                 <h4>Solution</h4>
                 <p>${escapeHTML(solution)}</p>
               </div>`
            : ""
        }

        ${
          reference
            ? `<div class="mneet-quiz-reference">
                 <h4>NCERT Reference</h4>
                 <p>${escapeHTML(reference)}</p>
               </div>`
            : ""
        }
      </div>
    `;
  }

  function getStatus(index) {
    if (state.submittedAnswers[index]) {
      const feedback = state.feedback[index];

      if (feedback && feedback.checked) {
        return feedback.correct ? "Correct" : "Incorrect";
      }

      return "Submitted";
    }

    return state.answers[index] ? "Answered" : "Unanswered";
  }

  function renderNavigator() {
    return state.questions.map(function (_, index) {
      const current = index === state.currentIndex;
      const answered = Boolean(state.answers[index]);

      return `
        <button
          type="button"
          class="mneet-quiz-nav-button
            ${current ? "is-current" : ""}
            ${answered ? "is-answered" : ""}"
          data-quiz-goto="${index}"
          aria-label="Question ${index + 1}: ${getStatus(index)}"
        >
          ${index + 1}
        </button>
      `;
    }).join("");
  }

  function render() {
    const container = getContainer();

    if (!container || !state.questions.length) return;

    addStyles();

    const question = getCurrentQuestion();
    if (!question) return;

    const index = state.currentIndex;
    const options = getOptions(question);

    const title = state.quiz.title ||
      state.quiz.name ||
      "Practice Quiz";

    const progress = Math.round(
      ((index + 1) / state.questions.length) * 100
    );

    container.innerHTML = `
      <section class="mneet-quiz-shell">

        <header class="mneet-quiz-header">
          <div>
            <p class="mneet-quiz-type">
              ${escapeHTML(getQuizType())}
            </p>

            <h2>${escapeHTML(title)}</h2>
          </div>

          <button
            type="button"
            class="mneet-quiz-exit"
            data-quiz-exit
          >
            Exit Quiz
          </button>
        </header>

        <div class="mneet-quiz-timer-area">
          <div class="mneet-quiz-timer-box">
            <span>Question Timer</span>
            <strong id="studentQuestionTimerText">--:--</strong>
          </div>

          <div class="mneet-quiz-timer-box">
            <span>Total Timer</span>
            <strong id="studentTotalTimerText">--:--</strong>
          </div>
        </div>

        <div class="mneet-quiz-progress-label">
          <span>Question ${index + 1} of ${state.questions.length}</span>
          <span>${progress}%</span>
        </div>

        <div class="mneet-quiz-progress-track">
          <div
            class="mneet-quiz-progress-fill"
            style="width:${progress}%"
          ></div>
        </div>

        <div class="mneet-quiz-main-grid">

          <main class="mneet-quiz-question-card">

            <div class="mneet-quiz-question-number">
              Question ${index + 1}
            </div>

            <div class="mneet-quiz-question-text">
              ${escapeHTML(getQuestionText(question))}
            </div>

            ${renderImage(question)}

            <div class="mneet-quiz-options">
              ${
                options.length
                  ? options.map(function (option) {
                      return renderOption(question, option, index);
                    }).join("")
                  : "<p>No answer options are available.</p>"
              }
            </div>

            ${renderFeedback(question, index)}

            <div class="mneet-quiz-actions">

              <button
                type="button"
                class="mneet-quiz-secondary"
                data-quiz-previous
                ${index === 0 ? "disabled" : ""}
              >
                Previous
              </button>

              ${
                !state.submittedAnswers[index]
                  ? `<button
                       type="button"
                       class="mneet-quiz-primary"
                       data-quiz-submit-answer
                       ${!state.answers[index] ? "disabled" : ""}
                     >
                       Answer Submit
                     </button>`
                  : `<span class="mneet-quiz-submitted-label">
                       Answer Submitted
                     </span>`
              }

              <button
                type="button"
                class="mneet-quiz-secondary"
                data-quiz-next
                ${index === state.questions.length - 1 ? "disabled" : ""}
              >
                Next
              </button>

            </div>

            <button
              type="button"
              class="mneet-quiz-final-submit"
              data-quiz-submit
            >
              Submit Quiz
            </button>

          </main>

          <aside class="mneet-quiz-navigator">
            <h3>Question Navigator</h3>

            <div class="mneet-quiz-nav-grid">
              ${renderNavigator()}
            </div>

            <div class="mneet-quiz-status-summary">
              <p>
                Answered:
                ${Object.keys(state.answers).filter(function (key) {
                  return Boolean(state.answers[key]);
                }).length}
              </p>

              <p>
                Submitted:
                ${Object.keys(state.submittedAnswers).filter(function (key) {
                  return Boolean(state.submittedAnswers[key]);
                }).length}
              </p>

              <p>Status: ${escapeHTML(getStatus(index))}</p>
            </div>
          </aside>

        </div>
      </section>
    `;

    updateTimerDisplay();

    document.dispatchEvent(
      new CustomEvent("mneet:quiz-rendered", {
        detail: {
          quizId: state.quizId,
          questionId: question.id || "",
          questionIndex: index,
          totalQuestions: state.questions.length
        }
      })
    );
  }

  function updateTimerDisplay() {
    const timer = getTimerAPI();

    if (!timer || typeof timer.getState !== "function") {
      return;
    }

    const timerState = timer.getState();

    const questionText = document.getElementById(
      "studentQuestionTimerText"
    );

    const totalText = document.getElementById(
      "studentTotalTimerText"
    );

    if (questionText) {
      questionText.textContent = timer.formatTime
        ? timer.formatTime(timerState.questionTimeLeft)
        : String(timerState.questionTimeLeft);
    }

    if (totalText) {
      totalText.textContent = timerState.totalTimeLimit > 0
        ? timer.formatTime(timerState.totalTimeLeft)
        : "No limit";
    }
  }

  /* =========================================================
     FINAL RESULT VIEW
     ========================================================= */

  function renderFinished(result) {
    const container = getContainer();

    if (!container) return;

    addStyles();

    container.innerHTML = `
      <section class="mneet-quiz-finished">

        <h2>Quiz Submitted Successfully</h2>

        <p>Your quiz attempt is complete.</p>

        <div class="mneet-quiz-result-grid">

          <div class="mneet-quiz-result-card">
            <span>Total Questions</span>
            <strong>${result.totalQuestions}</strong>
          </div>

          <div class="mneet-quiz-result-card">
            <span>Correct</span>
            <strong>${result.correct}</strong>
          </div>

          <div class="mneet-quiz-result-card">
            <span>Incorrect</span>
            <strong>${result.incorrect}</strong>
          </div>

          <div class="mneet-quiz-result-card">
            <span>Skipped</span>
            <strong>${result.skipped}</strong>
          </div>

          <div class="mneet-quiz-result-card">
            <span>Score</span>
            <strong>${result.score}</strong>
          </div>

          <div class="mneet-quiz-result-card">
            <span>Accuracy</span>
            <strong>${result.accuracy}%</strong>
          </div>

        </div>

        <div class="mneet-quiz-finished-actions">

          <button
            type="button"
            class="mneet-quiz-primary"
            data-quiz-review
          >
            Review Answers
          </button>

          <button
            type="button"
            class="mneet-quiz-secondary"
            data-quiz-reattempt
          >
            Reattempt
          </button>

          <button
            type="button"
            class="mneet-quiz-secondary"
            data-quiz-exit
          >
            Back to Topics
          </button>

        </div>

      </section>
    `;

    document.dispatchEvent(
      new CustomEvent("mneet:quiz-results-ready", {
        detail: {
          quizId: state.quizId,
          result: result
        }
      })
    );
  }

  function reviewAnswers() {
    /*
     * Review the questions after final submission.
     * Do not permit changing previously submitted answers.
     */
    state.finished = false;
    state.currentIndex = 0;
    render();

    return true;
  }

  async function reattempt() {
    const quizId = state.quizId;
    const nextAttempt = state.attemptNumber + 1;

    const timer = getTimerAPI();

    if (
      timer &&
      typeof timer.resetForNewAttempt === "function"
    ) {
      timer.resetForNewAttempt({
        quizId: quizId,
        attemptNumber: nextAttempt,
        questionTime: Number(state.quiz.perQuestionTime) || 60,
        totalTime: Number(state.quiz.durationMinutes) > 0
          ? Number(state.quiz.durationMinutes) * 60
          : 0
      });
    }

    return load({
      quizId: quizId,
      attemptNumber: nextAttempt
    });
  }

  function exitQuiz() {
    if (!state.finished && Object.keys(state.answers).length) {
      const confirmed = window.confirm(
        "You have started this quiz. Are you sure you want to exit?"
      );

      if (!confirmed) return false;
    }

    const api = getStudentAPI();

    if (api && typeof api.navigateTo === "function") {
      api.navigateTo("topicPractice", {
        courseId: state.courseId,
        chapterId: state.chapterId,
        topicId: state.topicId
      });

      return true;
    }

    if (api && typeof api.showPage === "function") {
      api.showPage("topicPractice");
      return true;
    }

    window.history.back();

    return true;
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function setupEvents() {
    if (eventsAdded) return;

    document.addEventListener("click", function (event) {
      const target = event.target.closest(
        "[data-quiz-option]," +
        "[data-quiz-submit-answer]," +
        "[data-quiz-previous]," +
        "[data-quiz-next]," +
        "[data-quiz-goto]," +
        "[data-quiz-submit]," +
        "[data-quiz-exit]," +
        "[data-quiz-review]," +
        "[data-quiz-reattempt]"
      );

      if (!target) return;

      if (target.hasAttribute("data-quiz-option")) {
        selectAnswer(
          target.getAttribute("data-quiz-option")
        );
      } else if (target.hasAttribute("data-quiz-submit-answer")) {
        submitCurrentAnswer();
      } else if (target.hasAttribute("data-quiz-previous")) {
        previousQuestion();
      } else if (target.hasAttribute("data-quiz-next")) {
        nextQuestion();
      } else if (target.hasAttribute("data-quiz-goto")) {
        goToQuestion(
          Number(target.getAttribute("data-quiz-goto"))
        );
      } else if (target.hasAttribute("data-quiz-submit")) {
        submitQuiz();
      } else if (target.hasAttribute("data-quiz-exit")) {
        exitQuiz();
      } else if (target.hasAttribute("data-quiz-review")) {
        reviewAnswers();
      } else if (target.hasAttribute("data-quiz-reattempt")) {
        reattempt().catch(function (error) {
          showMessage(error.message || "Could not restart quiz.");
        });
      }
    });

    /*
     * File 35 timer updates.
     */
    document.addEventListener(
      "mneet:quiz-timer-update",
      updateTimerDisplay
    );

    /*
     * Timer expiration:
     * - Question timeout stops that question timer.
     * - Total timeout submits the quiz.
     */
    document.addEventListener(
      "mneet:quiz-question-timeout",
      function (event) {
        const detail = event.detail || {};

        if (
          detail.questionIndex === state.currentIndex &&
          !state.submittedAnswers[state.currentIndex]
        ) {
          showMessage(
            "Time is up for this question. Submit your selected answer if one is available, or move to the next question."
          );
        }
      }
    );

    document.addEventListener(
      "mneet:quiz-total-timeout",
      function () {
        if (!state.finished) {
          submitQuizAfterTimeout();
        }
      }
    );

    eventsAdded = true;
  }

  async function submitQuizAfterTimeout() {
    if (state.finished || state.submitting) return;

    state.submitting = true;

    const result = calculateResult();

    state.finished = true;
    state.submitting = false;

    const timer = getTimerAPI();

    if (timer && typeof timer.submitQuiz === "function") {
      timer.submitQuiz();
    }

    renderFinished(result);

    document.dispatchEvent(
      new CustomEvent("mneet:quiz-submitted", {
        detail: {
          quizId: state.quizId,
          result: result,
          reason: "total-timeout"
        }
      })
    );

    const resultsAPI = getResultsAPI();

    if (
      resultsAPI &&
      typeof resultsAPI.handleQuizResult === "function"
    ) {
      try {
        await resultsAPI.handleQuizResult(result);
      } catch (error) {
        console.error(
          "[mNEET Quiz] Could not pass timed-out result.",
          error
        );
      }
    }
  }

  /* =========================================================
     STYLES — GREEN + WHITE ONLY
     ========================================================= */

  function addStyles() {
    if (
      stylesAdded ||
      document.getElementById("mneet-student-quiz-css")
    ) {
      stylesAdded = true;
      return;
    }

    const style = document.createElement("style");

    style.id = "mneet-student-quiz-css";

    style.textContent = `
      .mneet-quiz-shell {
        width: 100%;
        color: #FFFFFF;
      }

      .mneet-quiz-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 16px;
      }

      .mneet-quiz-header h2 {
        margin: 0;
        color: #FFFFFF;
        font-size: clamp(20px, 4vw, 28px);
        overflow-wrap: anywhere;
      }

      .mneet-quiz-type {
        margin: 0 0 5px;
        color: #22C55E;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .mneet-quiz-exit,
      .mneet-quiz-secondary {
        min-height: 42px;
        padding: 10px 14px;
        border: 1px solid #28513A;
        border-radius: 11px;
        background: #10291D;
        color: #FFFFFF;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .mneet-quiz-timer-area {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-bottom: 16px;
      }

      .mneet-quiz-timer-box {
        padding: 12px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #0D2419;
      }

      .mneet-quiz-timer-box span {
        display: block;
        color: #D1D5DB;
        font-size: 12px;
        margin-bottom: 5px;
      }

      .mneet-quiz-timer-box strong {
        color: #22C55E;
        font-size: 22px;
        font-variant-numeric: tabular-nums;
      }

      .mneet-quiz-progress-label {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 7px;
        color: #D1D5DB;
        font-size: 13px;
      }

      .mneet-quiz-progress-track {
        width: 100%;
        height: 7px;
        overflow: hidden;
        border: 1px solid #28513A;
        border-radius: 20px;
        background: #10291D;
        margin-bottom: 18px;
      }

      .mneet-quiz-progress-fill {
        height: 100%;
        border-radius: inherit;
        background: #22C55E;
        transition: width 0.2s ease;
      }

      .mneet-quiz-main-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 230px;
        align-items: start;
        gap: 16px;
      }

      .mneet-quiz-question-card,
      .mneet-quiz-navigator {
        min-width: 0;
        padding: 18px;
        border: 1px solid #28513A;
        border-radius: 16px;
        background: #0D2419;
      }

      .mneet-quiz-question-number {
        margin-bottom: 12px;
        color: #22C55E;
        font-weight: 800;
      }

      .mneet-quiz-question-text {
        margin-bottom: 17px;
        color: #FFFFFF;
        font-size: clamp(16px, 2.5vw, 19px);
        line-height: 1.8;
        font-weight: 600;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }

      .mneet-quiz-image-wrap {
        margin-bottom: 16px;
        padding: 10px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #10291D;
        text-align: center;
      }

      .mneet-quiz-image {
        display: block;
        max-width: 100%;
        max-height: 400px;
        margin: auto;
        object-fit: contain;
      }

      .mneet-quiz-options {
        display: grid;
        gap: 10px;
      }

      .mneet-quiz-option {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        width: 100%;
        min-width: 0;
        padding: 13px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #10291D;
        color: #FFFFFF;
        text-align: left;
        font: inherit;
        line-height: 1.65;
        cursor: pointer;
        overflow-wrap: anywhere;
      }

      .mneet-quiz-option:hover:not(:disabled) {
        border-color: #22C55E;
      }

      .mneet-quiz-option.is-selected {
        border: 2px solid #22C55E;
      }

      .mneet-quiz-option.is-correct {
        border: 2px solid #22C55E;
        background: #10291D;
      }

      .mneet-quiz-option.is-wrong {
        border: 2px dashed #FFFFFF;
        background: #0D2419;
      }

      .mneet-quiz-option:disabled {
        cursor: default;
      }

      .mneet-quiz-option-letter {
        flex: 0 0 29px;
        width: 29px;
        height: 29px;
        display: grid;
        place-items: center;
        border: 1px solid #28513A;
        border-radius: 9px;
        color: #FFFFFF;
        font-weight: 800;
        background: #0D2419;
      }

      .mneet-quiz-option-content {
        min-width: 0;
        display: grid;
        gap: 8px;
      }

      .mneet-quiz-option-image {
        display: block;
        max-width: 100%;
        max-height: 180px;
        object-fit: contain;
      }

      .mneet-quiz-feedback {
        margin-top: 17px;
        padding: 14px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #10291D;
        color: #FFFFFF;
        line-height: 1.7;
      }

      .mneet-quiz-feedback > strong {
        display: block;
        margin-bottom: 7px;
        color: #22C55E;
        font-size: 16px;
      }

      .mneet-quiz-solution,
      .mneet-quiz-reference {
        margin-top: 12px;
        padding-top: 11px;
        border-top: 1px solid #28513A;
      }

      .mneet-quiz-solution h4,
      .mneet-quiz-reference h4 {
        color: #22C55E;
        margin: 0 0 6px;
      }

      .mneet-quiz-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 20px;
      }

      .mneet-quiz-primary,
      .mneet-quiz-final-submit {
        min-height: 43px;
        padding: 11px 15px;
        border: 1px solid #16A34A;
        border-radius: 11px;
        background: #16A34A;
        color: #FFFFFF;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }

      .mneet-quiz-primary:disabled,
      .mneet-quiz-secondary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .mneet-quiz-submitted-label {
        color: #22C55E;
        font-size: 12px;
        font-weight: 800;
      }

      .mneet-quiz-final-submit {
        width: 100%;
        margin-top: 18px;
      }

      .mneet-quiz-navigator h3 {
        margin: 0 0 14px;
        color: #FFFFFF;
        font-size: 16px;
      }

      .mneet-quiz-nav-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 7px;
      }

      .mneet-quiz-nav-button {
        min-height: 39px;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #FFFFFF;
        font-weight: 800;
        cursor: pointer;
      }

      .mneet-quiz-nav-button.is-current {
        border: 2px solid #22C55E;
      }

      .mneet-quiz-nav-button.is-answered {
        background: #0D2419;
        border-color: #22C55E;
      }

      .mneet-quiz-status-summary {
        margin-top: 15px;
        padding-top: 10px;
        border-top: 1px solid #28513A;
        color: #D1D5DB;
        font-size: 12px;
      }

      .mneet-quiz-finished {
        padding: 22px;
        border: 1px solid #28513A;
        border-radius: 16px;
        background: #0D2419;
        color: #FFFFFF;
      }

      .mneet-quiz-finished h2 {
        margin-top: 0;
        color: #22C55E;
      }

      .mneet-quiz-result-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin: 18px 0;
      }

      .mneet-quiz-result-card {
        padding: 14px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #10291D;
      }

      .mneet-quiz-result-card span {
        display: block;
        color: #D1D5DB;
        font-size: 12px;
        margin-bottom: 7px;
      }

      .mneet-quiz-result-card strong {
        color: #22C55E;
        font-size: 23px;
      }

      .mneet-quiz-finished-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 20px;
      }

      .mneet-quiz-message {
        padding: 10px 12px;
        border: 1px solid #28513A;
        border-radius: 10px;
        color: #FFFFFF;
        background: #10291D;
      }

      @media (max-width: 760px) {
        .mneet-quiz-main-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .mneet-quiz-navigator {
          order: -1;
        }

        .mneet-quiz-nav-grid {
          grid-template-columns: repeat(6, minmax(0, 1fr));
        }
      }

      @media (max-width: 420px) {
        .mneet-quiz-question-card,
        .mneet-quiz-navigator {
          padding: 13px;
        }

        .mneet-quiz-timer-area {
          grid-template-columns: minmax(0, 1fr);
        }

        .mneet-quiz-nav-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .mneet-quiz-result-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .mneet-quiz-actions > button {
          flex: 1 1 auto;
        }
      }
    `;

    document.head.appendChild(style);
    stylesAdded = true;
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  function initialize() {
    setupEvents();
    addStyles();

    state.initialized = true;

    return getState();
  }

  function getState() {
    return {
      initialized: state.initialized,
      loading: state.loading,
      finished: state.finished,

      quizId: state.quizId,
      courseId: state.courseId,
      chapterId: state.chapterId,
      topicId: state.topicId,

      currentIndex: state.currentIndex,
      totalQuestions: state.questions.length,
      attemptNumber: state.attemptNumber
    };
  }

  function openQuiz(options) {
    return load(options || {});
  }

  function getQuestions() {
    return state.questions.slice();
  }

  function getResult() {
    return calculateResult();
  }

  window[MODULE] = {
    initialize: initialize,
    openQuiz: openQuiz,
    load: load,

    selectAnswer: selectAnswer,
    submitCurrentAnswer: submitCurrentAnswer,

    previousQuestion: previousQuestion,
    nextQuestion: nextQuestion,
    goToQuestion: goToQuestion,

    submitQuiz: submitQuiz,
    reviewAnswers: reviewAnswers,
    reattempt: reattempt,
    exitQuiz: exitQuiz,

    getState: getState,
    getQuestions: getQuestions,
    getCurrentQuestion: getCurrentQuestion,
    getResult: getResult
  };

  /* =========================================================
     AUTO INITIALIZATION
     ========================================================= */

  function autoInitialize() {
    initialize();

    /*
     * This module does not automatically launch a quiz
     * without a selected quiz ID. The Topics module or
     * quiz button should call:
     *
     * MNEETStudentQuiz.openQuiz({
     *   quizId: "YOUR_QUIZ_DOCUMENT_ID"
     * });
     */
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      autoInitialize,
      { once: true }
    );
  } else {
    autoInitialize();
  }

})();
