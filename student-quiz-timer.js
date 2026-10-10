/* =========================================================
   mNEET STUDENT QUIZ TIMER
   File: student-quiz-timer.js

   Requirements:
   - Per-question timer
   - Total quiz timer
   - Default 60 seconds per question
   - Reduce 10 seconds per subsequent attempt
   - Minimum 10 seconds per question
   - Stop question timer after answer submission
   - Preserve question timer states when navigating
   - Restore saved timer state after refresh
   - Green + White theme
   ========================================================= */

(function () {
  "use strict";

  const MODULE_NAME = "MNEETStudentQuizTimer";

  const DEFAULT_QUESTION_TIME = 60;
  const ATTEMPT_TIME_REDUCTION = 10;
  const MINIMUM_QUESTION_TIME = 10;

  const DEFAULT_TOTAL_TIME = 0;
  const STORAGE_PREFIX = "mneetQuizTimer:";

  const state = {
    initialized: false,
    running: false,
    paused: false,
    submitted: false,

    quizId: "",
    attemptNumber: 1,

    currentQuestionId: "",
    currentQuestionIndex: 0,

    questionTimeLimit: DEFAULT_QUESTION_TIME,
    questionTimeLeft: DEFAULT_QUESTION_TIME,

    totalTimeLimit: DEFAULT_TOTAL_TIME,
    totalTimeLeft: DEFAULT_TOTAL_TIME,

    questionTimes: {},
    answeredQuestions: {},
    expiredQuestions: {},

    questionInterval: null,
    totalInterval: null,

    lastTickAt: 0,
    storageKey: "",
    error: ""
  };

  let eventsReady = false;
  let stylesReady = false;

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

  function toNumber(value, fallback) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  }

  function getStudentAPI() {
    return window.MNEETStudent || null;
  }

  function getQuizAPI() {
    return window.MNEETStudentQuiz || null;
  }

  function getCurrentUserId() {
    const studentAPI = getStudentAPI();

    if (
      studentAPI &&
      typeof studentAPI.getCurrentUser === "function"
    ) {
      const user = studentAPI.getCurrentUser();

      if (user && user.uid) {
        return String(user.uid);
      }
    }

    if (
      window.firebase &&
      firebase.auth &&
      firebase.auth().currentUser
    ) {
      return String(
        firebase.auth().currentUser.uid
      );
    }

    return "anonymous";
  }

  function getQuizId(options) {
    options = options || {};

    if (options.quizId) {
      return String(options.quizId);
    }

    const quizAPI = getQuizAPI();

    if (
      quizAPI &&
      typeof quizAPI.getState === "function"
    ) {
      const quizState = quizAPI.getState() || {};

      if (quizState.quizId) {
        return String(quizState.quizId);
      }

      if (quizState.currentQuizId) {
        return String(quizState.currentQuizId);
      }
    }

    return localStorage.getItem("activeQuiz") ||
      localStorage.getItem("activeTopic") ||
      "default";
  }

  function getStorageKey(quizId) {
    return STORAGE_PREFIX +
      getCurrentUserId() +
      ":" +
      String(quizId || "default");
  }

  function getAttemptNumber(options) {
    options = options || {};

    const supplied = Number(options.attemptNumber);

    if (
      Number.isFinite(supplied) &&
      supplied >= 1
    ) {
      return Math.floor(supplied);
    }

    const quizAPI = getQuizAPI();

    if (
      quizAPI &&
      typeof quizAPI.getState === "function"
    ) {
      const quizState = quizAPI.getState() || {};

      const value = Number(
        quizState.attemptNumber ||
        quizState.attempt ||
        1
      );

      if (Number.isFinite(value) && value >= 1) {
        return Math.floor(value);
      }
    }

    return 1;
  }

  function getQuestionId(question, index) {
    if (question && typeof question === "object") {
      return String(
        question.id ||
        question.questionId ||
        question.questionID ||
        "question-" + index
      );
    }

    return "question-" + index;
  }

  function getQuestionTimeForAttempt(attemptNumber, configuredTime) {
    const baseTime = Math.max(
      MINIMUM_QUESTION_TIME,
      toNumber(
        configuredTime,
        DEFAULT_QUESTION_TIME
      )
    );

    const attempt = Math.max(
      1,
      Math.floor(
        toNumber(attemptNumber, 1)
      )
    );

    const reduction =
      (attempt - 1) * ATTEMPT_TIME_REDUCTION;

    return Math.max(
      MINIMUM_QUESTION_TIME,
      baseTime - reduction
    );
  }

  function formatTime(seconds) {
    const totalSeconds = Math.max(
      0,
      Math.floor(
        toNumber(seconds, 0)
      )
    );

    const minutes = Math.floor(
      totalSeconds / 60
    );

    const remainingSeconds =
      totalSeconds % 60;

    return String(minutes).padStart(2, "0") +
      ":" +
      String(remainingSeconds).padStart(2, "0");
  }

  function getQuestionTimerElement() {
    return document.getElementById(
      "studentQuestionTimer"
    ) ||
      document.getElementById(
        "quizQuestionTimer"
      ) ||
      document.getElementById(
        "questionTimer"
      );
  }

  function getTotalTimerElement() {
    return document.getElementById(
      "studentTotalTimer"
    ) ||
      document.getElementById(
        "quizTotalTimer"
      ) ||
      document.getElementById(
        "totalQuizTimer"
      );
  }

  function getQuestionTimerTextElement() {
    return document.getElementById(
      "studentQuestionTimerText"
    ) ||
      document.getElementById(
        "questionTimerText"
      );
  }

  function getTotalTimerTextElement() {
    return document.getElementById(
      "studentTotalTimerText"
    ) ||
      document.getElementById(
        "totalTimerText"
      );
  }

  /* =========================================================
     PERSISTENCE
     ========================================================= */

  function saveState() {
    if (!state.storageKey) {
      return false;
    }

    try {
      const data = {
        version: 1,

        quizId: state.quizId,
        attemptNumber: state.attemptNumber,

        currentQuestionId: state.currentQuestionId,
        currentQuestionIndex: state.currentQuestionIndex,

        questionTimeLimit: state.questionTimeLimit,
        questionTimeLeft: state.questionTimeLeft,

        totalTimeLimit: state.totalTimeLimit,
        totalTimeLeft: state.totalTimeLeft,

        questionTimes: state.questionTimes,
        answeredQuestions: state.answeredQuestions,
        expiredQuestions: state.expiredQuestions,

        submitted: state.submitted,
        savedAt: Date.now()
      };

      localStorage.setItem(
        state.storageKey,
        JSON.stringify(data)
      );

      return true;
    } catch (error) {
      console.warn(
        "[mNEET Timer] Could not save timer state:",
        error
      );

      return false;
    }
  }

  function restoreState() {
    if (!state.storageKey) {
      return false;
    }

    try {
      const raw = localStorage.getItem(
        state.storageKey
      );

      if (!raw) {
        return false;
      }

      const data = JSON.parse(raw);

      if (!data || data.quizId !== state.quizId) {
        return false;
      }

      state.attemptNumber = Math.max(
        1,
        Math.floor(
          toNumber(data.attemptNumber, 1)
        )
      );

      state.currentQuestionId =
        String(data.currentQuestionId || "");

      state.currentQuestionIndex = Math.max(
        0,
        Math.floor(
          toNumber(data.currentQuestionIndex, 0)
        )
      );

      state.questionTimeLimit = Math.max(
        MINIMUM_QUESTION_TIME,
        toNumber(
          data.questionTimeLimit,
          DEFAULT_QUESTION_TIME
        )
      );

      state.questionTimeLeft = clamp(
        toNumber(
          data.questionTimeLeft,
          state.questionTimeLimit
        ),
        0,
        state.questionTimeLimit
      );

      state.totalTimeLimit = Math.max(
        0,
        toNumber(
          data.totalTimeLimit,
          DEFAULT_TOTAL_TIME
        )
      );

      state.totalTimeLeft = state.totalTimeLimit > 0
        ? clamp(
            toNumber(
              data.totalTimeLeft,
              state.totalTimeLimit
            ),
            0,
            state.totalTimeLimit
          )
        : 0;

      state.questionTimes =
        data.questionTimes &&
        typeof data.questionTimes === "object"
          ? data.questionTimes
          : {};

      state.answeredQuestions =
        data.answeredQuestions &&
        typeof data.answeredQuestions === "object"
          ? data.answeredQuestions
          : {};

      state.expiredQuestions =
        data.expiredQuestions &&
        typeof data.expiredQuestions === "object"
          ? data.expiredQuestions
          : {};

      state.submitted = data.submitted === true;

      return true;
    } catch (error) {
      console.warn(
        "[mNEET Timer] Could not restore timer state:",
        error
      );

      return false;
    }
  }

  function clearSavedState() {
    if (!state.storageKey) {
      return;
    }

    try {
      localStorage.removeItem(
        state.storageKey
      );
    } catch (error) {
      console.warn(
        "[mNEET Timer] Could not clear timer state:",
        error
      );
    }
  }

  /* =========================================================
     TIMER DISPLAY
     ========================================================= */

  function addStyles() {
    if (
      stylesReady ||
      document.getElementById(
        "mneet-quiz-timer-styles"
      )
    ) {
      stylesReady = true;
      return;
    }

    const style = document.createElement("style");

    style.id = "mneet-quiz-timer-styles";

    style.textContent = `
      .mneet-timer-panel {
        display: flex;
        align-items: stretch;
        flex-wrap: wrap;
        gap: 10px;
        width: 100%;
        margin: 0 0 16px;
      }

      .mneet-timer-card {
        flex: 1 1 135px;
        min-width: 0;
        padding: 12px 14px;
        border: 1px solid #28513A;
        border-radius: 13px;
        background: #0D2419;
        color: #FFFFFF;
      }

      .mneet-timer-label {
        display: block;
        margin-bottom: 5px;
        color: #D1D5DB;
        font-size: 12px;
        font-weight: 700;
      }

      .mneet-timer-value {
        display: block;
        color: #FFFFFF;
        font-size: clamp(20px, 4vw, 27px);
        font-weight: 800;
        line-height: 1.3;
        font-variant-numeric: tabular-nums;
      }

      .mneet-timer-progress {
        width: 100%;
        height: 5px;
        margin-top: 9px;
        overflow: hidden;
        border: 1px solid #28513A;
        border-radius: 20px;
        background: #10291D;
      }

      .mneet-timer-progress-fill {
        width: 100%;
        height: 100%;
        border-radius: inherit;
        background: #22C55E;
        transition: width 0.2s linear;
      }

      .mneet-timer-expired {
        border-color: #28513A;
        background: #10291D;
      }

      .mneet-timer-expired .mneet-timer-value {
        color: #FFFFFF;
      }

      @media (max-width: 420px) {
        .mneet-timer-card {
          flex-basis: 100%;
        }
      }
    `;

    document.head.appendChild(style);

    stylesReady = true;
  }

  function updateTimerElement(element, textElement, seconds, limit) {
    if (!element) {
      return;
    }

    const text = formatTime(seconds);

    if (textElement) {
      textElement.textContent = text;
    } else {
      element.textContent = text;
    }

    const percentage = limit > 0
      ? clamp((seconds / limit) * 100, 0, 100)
      : 100;

    const progress = element.querySelector(
      ".mneet-timer-progress-fill"
    );

    if (progress) {
      progress.style.width = percentage + "%";
    }

    if (seconds <= 0) {
      element.classList.add(
        "mneet-timer-expired"
      );
    } else {
      element.classList.remove(
        "mneet-timer-expired"
      );
    }

    element.setAttribute(
      "aria-live",
      "polite"
    );

    element.setAttribute(
      "aria-label",
      "Time remaining " + text
    );
  }

  function updateDisplay() {
    updateTimerElement(
      getQuestionTimerElement(),
      getQuestionTimerTextElement(),
      state.questionTimeLeft,
      state.questionTimeLimit
    );

    if (state.totalTimeLimit > 0) {
      updateTimerElement(
        getTotalTimerElement(),
        getTotalTimerTextElement(),
        state.totalTimeLeft,
        state.totalTimeLimit
      );
    }

    document.dispatchEvent(
      new CustomEvent(
        "mneet:quiz-timer-update",
        {
          detail: {
            quizId: state.quizId,

            questionId: state.currentQuestionId,
            questionIndex: state.currentQuestionIndex,

            questionTimeLeft: state.questionTimeLeft,
            questionTimeLimit: state.questionTimeLimit,

            totalTimeLeft: state.totalTimeLeft,
            totalTimeLimit: state.totalTimeLimit,

            attemptNumber: state.attemptNumber,
            running: state.running,
            paused: state.paused
          }
        }
      )
    );
  }

  function ensureTimerElements() {
    addStyles();

    let panel = document.getElementById(
      "mneetQuizTimerPanel"
    );

    if (panel) {
      return panel;
    }

    const quizContainer =
      document.getElementById(
        "studentQuizContent"
      ) ||
      document.getElementById(
        "studentQuizContainer"
      ) ||
      document.getElementById(
        "studentPageQuiz"
      ) ||
      document.getElementById(
        "quizContainer"
      );

    if (!quizContainer) {
      return null;
    }

    panel = document.createElement("div");

    panel.id = "mneetQuizTimerPanel";
    panel.className = "mneet-timer-panel";

    panel.innerHTML = `
      <div
        class="mneet-timer-card"
        id="studentQuestionTimer"
      >
        <span class="mneet-timer-label">
          Question Time
        </span>

        <span
          class="mneet-timer-value"
          id="studentQuestionTimerText"
        >
          01:00
        </span>

        <div class="mneet-timer-progress">
          <div class="mneet-timer-progress-fill"></div>
        </div>
      </div>

      <div
        class="mneet-timer-card"
        id="studentTotalTimer"
      >
        <span class="mneet-timer-label">
          Total Quiz Time
        </span>

        <span
          class="mneet-timer-value"
          id="studentTotalTimerText"
        >
          --:--
        </span>

        <div class="mneet-timer-progress">
          <div class="mneet-timer-progress-fill"></div>
        </div>
      </div>
    `;

    quizContainer.prepend(panel);

    return panel;
  }

  /* =========================================================
     EVENTS
     ========================================================= */

  function emitTimerEvent(eventName, detail) {
    document.dispatchEvent(
      new CustomEvent(eventName, {
        detail: detail || {}
      })
    );
  }

  function stopQuestionInterval() {
    if (state.questionInterval !== null) {
      clearInterval(state.questionInterval);
      state.questionInterval = null;
    }
  }

  function stopTotalInterval() {
    if (state.totalInterval !== null) {
      clearInterval(state.totalInterval);
      state.totalInterval = null;
    }
  }

  function stopAllIntervals() {
    stopQuestionInterval();
    stopTotalInterval();
  }

  function handleQuestionExpired() {
    stopQuestionInterval();

    state.questionTimeLeft = 0;

    state.expiredQuestions[
      state.currentQuestionId
    ] = true;

    saveState();
    updateDisplay();

    emitTimerEvent(
      "mneet:quiz-question-timeout",
      {
        quizId: state.quizId,
        questionId: state.currentQuestionId,
        questionIndex: state.currentQuestionIndex
      }
    );
  }

  function handleTotalExpired() {
    stopAllIntervals();

    state.totalTimeLeft = 0;
    state.running = false;
    state.paused = false;

    saveState();
    updateDisplay();

    emitTimerEvent(
      "mneet:quiz-total-timeout",
      {
        quizId: state.quizId,
        totalTimeLeft: 0
      }
    );
  }

  function tickQuestionTimer() {
    if (
      !state.running ||
      state.paused ||
      state.submitted
    ) {
      return;
    }

    if (
      state.answeredQuestions[
        state.currentQuestionId
      ] === true
    ) {
      stopQuestionInterval();
      return;
    }

    if (
      state.expiredQuestions[
        state.currentQuestionId
      ] === true
    ) {
      stopQuestionInterval();
      return;
    }

    state.questionTimeLeft = Math.max(
      0,
      state.questionTimeLeft - 1
    );

    saveState();
    updateDisplay();

    if (state.questionTimeLeft <= 0) {
      handleQuestionExpired();
    }
  }

  function tickTotalTimer() {
    if (
      !state.running ||
      state.paused ||
      state.submitted ||
      state.totalTimeLimit <= 0
    ) {
      return;
    }

    state.totalTimeLeft = Math.max(
      0,
      state.totalTimeLeft - 1
    );

    saveState();
    updateDisplay();

    if (state.totalTimeLeft <= 0) {
      handleTotalExpired();
    }
  }

  function startQuestionInterval() {
    stopQuestionInterval();

    if (
      !state.running ||
      state.paused ||
      state.submitted
    ) {
      return;
    }

    if (
      state.answeredQuestions[
        state.currentQuestionId
      ] === true ||
      state.expiredQuestions[
        state.currentQuestionId
      ] === true
    ) {
      return;
    }

    if (state.questionTimeLeft <= 0) {
      handleQuestionExpired();
      return;
    }

    state.questionInterval = setInterval(
      tickQuestionTimer,
      1000
    );
  }

  function startTotalInterval() {
    stopTotalInterval();

    if (
      !state.running ||
      state.paused ||
      state.submitted ||
      state.totalTimeLimit <= 0
    ) {
      return;
    }

    if (state.totalTimeLeft <= 0) {
      handleTotalExpired();
      return;
    }

    state.totalInterval = setInterval(
      tickTotalTimer,
      1000
    );
  }

  function setupEvents() {
    if (eventsReady) {
      return;
    }

    document.addEventListener(
      "mneet:quiz-question-change",
      function (event) {
        const detail = event.detail || {};

        setCurrentQuestion(
          detail.questionId,
          detail.questionIndex,
          detail.questionTime
        );
      }
    );

    document.addEventListener(
      "mneet:quiz-answer-submitted",
      function (event) {
        const detail = event.detail || {};

        markQuestionAnswered(
          detail.questionId ||
          state.currentQuestionId
        );
      }
    );

    document.addEventListener(
      "mneet:quiz-submitted",
      function () {
        submitQuiz();
      }
    );

    document.addEventListener(
      "mneet:quiz-start",
      function (event) {
        const detail = event.detail || {};

        start({
          quizId: detail.quizId || state.quizId,
          attemptNumber:
            detail.attemptNumber ||
            state.attemptNumber,
          questionTime: detail.questionTime,
          totalTime: detail.totalTime
        });
      }
    );

    document.addEventListener(
      "visibilitychange",
      function () {
        if (document.hidden) {
          saveState();
        }
      }
    );

    window.addEventListener(
      "pagehide",
      saveState
    );

    eventsReady = true;
  }

  /* =========================================================
     PUBLIC TIMER CONTROLS
     ========================================================= */

  function start(options) {
    options = options || {};

    if (state.running && !state.paused) {
      return getState();
    }

    const newQuizId = getQuizId(options);

    if (
      state.quizId &&
      state.quizId !== newQuizId
    ) {
      reset();
    }

    state.quizId = newQuizId;

    state.storageKey = getStorageKey(
      state.quizId
    );

    state.attemptNumber = getAttemptNumber(
      options
    );

    const configuredQuestionTime = Math.max(
      MINIMUM_QUESTION_TIME,
      toNumber(
        options.questionTime,
        DEFAULT_QUESTION_TIME
      )
    );

    const configuredTotalTime = Math.max(
      0,
      toNumber(
        options.totalTime,
        DEFAULT_TOTAL_TIME
      )
    );

    const restored = restoreState();

    state.questionTimeLimit =
      getQuestionTimeForAttempt(
        state.attemptNumber,
        configuredQuestionTime
      );

    if (!restored) {
      state.questionTimeLeft =
        state.questionTimeLimit;

      state.totalTimeLimit =
        configuredTotalTime;

      state.totalTimeLeft =
        configuredTotalTime;

      state.questionTimes = {};
      state.answeredQuestions = {};
      state.expiredQuestions = {};

      state.submitted = false;
    } else {
      state.totalTimeLimit =
        configuredTotalTime > 0
          ? configuredTotalTime
          : state.totalTimeLimit;

      if (state.totalTimeLimit > 0) {
        state.totalTimeLeft = clamp(
          state.totalTimeLeft,
          0,
          state.totalTimeLimit
        );
      }
    }

    state.running = true;
    state.paused = false;

    ensureTimerElements();
    setupEvents();

    state.lastTickAt = Date.now();

    updateDisplay();
    saveState();

    if (
      state.totalTimeLimit > 0 &&
      state.totalTimeLeft <= 0
    ) {
      handleTotalExpired();
      return getState();
    }

    startQuestionInterval();
    startTotalInterval();

    emitTimerEvent(
      "mneet:quiz-timer-started",
      getState()
    );

    return getState();
  }

  function pause() {
    if (!state.running || state.submitted) {
      return false;
    }

    state.paused = true;

    stopAllIntervals();
    saveState();
    updateDisplay();

    emitTimerEvent(
      "mneet:quiz-timer-paused",
      getState()
    );

    return true;
  }

  function resume() {
    if (
      !state.running ||
      !state.paused ||
      state.submitted
    ) {
      return false;
    }

    state.paused = false;

    state.lastTickAt = Date.now();

    updateDisplay();

    startQuestionInterval();
    startTotalInterval();

    saveState();

    emitTimerEvent(
      "mneet:quiz-timer-resumed",
      getState()
    );

    return true;
  }

  function setCurrentQuestion(
    questionId,
    questionIndex,
    questionTime
  ) {
    if (state.submitted) {
      return false;
    }

    const id = String(
      questionId ||
      "question-" +
        toNumber(questionIndex, 0)
    );

    const index = Math.max(
      0,
      Math.floor(
        toNumber(questionIndex, 0)
      )
    );

    stopQuestionInterval();

    state.currentQuestionId = id;
    state.currentQuestionIndex = index;

    const configuredTime = Math.max(
      MINIMUM_QUESTION_TIME,
      toNumber(
        questionTime,
        DEFAULT_QUESTION_TIME
      )
    );

    state.questionTimeLimit =
      getQuestionTimeForAttempt(
        state.attemptNumber,
        configuredTime
      );

    if (
      Object.prototype.hasOwnProperty.call(
        state.questionTimes,
        id
      )
    ) {
      state.questionTimeLeft = clamp(
        state.questionTimes[id],
        0,
        state.questionTimeLimit
      );
    } else {
      state.questionTimeLeft =
        state.questionTimeLimit;

      state.questionTimes[id] =
        state.questionTimeLeft;
    }

    saveState();
    updateDisplay();

    if (state.running && !state.paused) {
      startQuestionInterval();
    }

    emitTimerEvent(
      "mneet:quiz-timer-question-changed",
      getState()
    );

    return true;
  }

  function markQuestionAnswered(questionId) {
    const id = String(
      questionId || state.currentQuestionId
    );

    if (!id) {
      return false;
    }

    state.answeredQuestions[id] = true;

    if (id === state.currentQuestionId) {
      stopQuestionInterval();
    }

    saveState();
    updateDisplay();

    emitTimerEvent(
      "mneet:quiz-timer-answer-locked",
      {
        questionId: id,
        questionTimeLeft:
          state.questionTimes[id] || 0
      }
    );

    return true;
  }

  function markQuestionExpired(questionId) {
    const id = String(
      questionId || state.currentQuestionId
    );

    if (!id) {
      return false;
    }

    state.expiredQuestions[id] = true;

    if (id === state.currentQuestionId) {
      state.questionTimeLeft = 0;
      stopQuestionInterval();
    }

    saveState();
    updateDisplay();

    return true;
  }

  function submitQuiz() {
    if (state.submitted) {
      return false;
    }

    state.submitted = true;
    state.running = false;
    state.paused = false;

    stopAllIntervals();

    saveState();
    updateDisplay();

    emitTimerEvent(
      "mneet:quiz-timer-submitted",
      getState()
    );

    return true;
  }

  function reset() {
    stopAllIntervals();

    clearSavedState();

    state.running = false;
    state.paused = false;
    state.submitted = false;

    state.quizId = "";
    state.attemptNumber = 1;

    state.currentQuestionId = "";
    state.currentQuestionIndex = 0;

    state.questionTimeLimit =
      DEFAULT_QUESTION_TIME;

    state.questionTimeLeft =
      DEFAULT_QUESTION_TIME;

    state.totalTimeLimit =
      DEFAULT_TOTAL_TIME;

    state.totalTimeLeft =
      DEFAULT_TOTAL_TIME;

    state.questionTimes = {};
    state.answeredQuestions = {};
    state.expiredQuestions = {};

    state.lastTickAt = 0;
    state.storageKey = "";
    state.error = "";

    updateDisplay();

    emitTimerEvent(
      "mneet:quiz-timer-reset",
      getState()
    );

    return true;
  }

  function resetForNewAttempt(options) {
    options = options || {};

    stopAllIntervals();

    clearSavedState();

    const nextAttempt = Math.max(
      1,
      Math.floor(
        toNumber(
          options.attemptNumber,
          state.attemptNumber + 1
        )
      )
    );

    const quizId = getQuizId(options);

    reset();

    state.quizId = quizId;
    state.attemptNumber = nextAttempt;

    state.storageKey = getStorageKey(
      state.quizId
    );

    state.questionTimeLimit =
      getQuestionTimeForAttempt(
        nextAttempt,
        options.questionTime ||
          DEFAULT_QUESTION_TIME
      );

    state.questionTimeLeft =
      state.questionTimeLimit;

    state.totalTimeLimit = Math.max(
      0,
      toNumber(
        options.totalTime,
        DEFAULT_TOTAL_TIME
      )
    );

    state.totalTimeLeft =
      state.totalTimeLimit;

    saveState();

    return start({
      quizId: quizId,
      attemptNumber: nextAttempt,
      questionTime: options.questionTime ||
        DEFAULT_QUESTION_TIME,
      totalTime: options.totalTime ||
        DEFAULT_TOTAL_TIME
    });
  }

  function getState() {
    return {
      initialized: state.initialized,
      running: state.running,
      paused: state.paused,
      submitted: state.submitted,

      quizId: state.quizId,
      attemptNumber: state.attemptNumber,

      currentQuestionId:
        state.currentQuestionId,

      currentQuestionIndex:
        state.currentQuestionIndex,

      questionTimeLimit:
        state.questionTimeLimit,

      questionTimeLeft:
        state.questionTimeLeft,

      totalTimeLimit:
        state.totalTimeLimit,

      totalTimeLeft:
        state.totalTimeLeft,

      answeredQuestions: {
        ...state.answeredQuestions
      },

      expiredQuestions: {
        ...state.expiredQuestions
      },

      error: state.error
    };
  }

  /* =========================================================
     INITIALIZATION
     ========================================================= */

  function initialize(options) {
    setupEvents();
    addStyles();

    const quizId = getQuizId(options || {});

    state.quizId = quizId;
    state.storageKey = getStorageKey(quizId);

    state.initialized = true;

    ensureTimerElements();

    return getState();
  }

  /* =========================================================
     PUBLIC API
     ========================================================= */

  window[MODULE_NAME] = {
    initialize: initialize,
    start: start,
    pause: pause,
    resume: resume,
    reset: reset,

    resetForNewAttempt: resetForNewAttempt,

    setCurrentQuestion: setCurrentQuestion,

    markQuestionAnswered: markQuestionAnswered,
    markQuestionExpired: markQuestionExpired,

    submitQuiz: submitQuiz,

    getState: getState,
    getQuestionTimeForAttempt:
      getQuestionTimeForAttempt,

    formatTime: formatTime,
    saveState: saveState,
    restoreState: restoreState
  };

  /* =========================================================
     AUTO INITIALIZATION
     ========================================================= */

  function autoInitialize() {
    initialize();

    /*
      Timer starts when student-quiz.js calls:

      MNEETStudentQuizTimer.start({
        quizId: "quiz-document-id",
        attemptNumber: 1,
        questionTime: 60,
        totalTime: 1800
      });

      The quiz module should call:
      - setCurrentQuestion() when navigating
      - markQuestionAnswered() after Answer Submit
      - submitQuiz() after final Submit Quiz
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
