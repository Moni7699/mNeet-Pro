(function () {
  "use strict";

  /*
   * mNEET Admin Panel
   * File 15: admin-quizzes.js
   *
   * Structure:
   * Course -> Subject -> Chapter -> Topic -> Quiz
   *
   * Firestore collections:
   * courses
   * subjects
   * chapters
   * topics
   * quizzes
   *
   * Theme: Green and White
   * Firebase SDK: Compat
   */

  if (window.MNEETAdminQuizzes) {
    return;
  }

  const QuizAdmin = {
    initialized: false,
    loading: false,
    saving: false,

    db: null,
    auth: null,

    courses: [],
    subjects: [],
    chapters: [],
    topics: [],
    quizzes: [],

    courseId: "",
    subjectId: "",
    chapterId: "",
    topicId: "",
    editingQuizId: ""
  };

  window.MNEETAdminQuizzes = QuizAdmin;

  const $ = (id) => document.getElementById(id);

  const STYLE_ID = "mneet-admin-quizzes-style";


  // ==================================================
  // STYLES
  // ==================================================

  function addStyles() {
    if ($(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #quizzesContent {
        color: #FFFFFF;
      }

      #quizzesContent *,
      #quizzesContent *::before,
      #quizzesContent *::after {
        box-sizing: border-box;
      }

      .mq-card {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .mq-heading {
        color: #FFFFFF;
        font-size: 19px;
        font-weight: 700;
        margin: 0 0 12px;
      }

      .mq-description {
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.7;
        margin: 0 0 16px;
      }

      .mq-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .mq-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
        min-width: 0;
      }

      .mq-full {
        grid-column: 1 / -1;
      }

      .mq-field label {
        color: #FFFFFF;
        font-size: 13px;
        font-weight: 600;
      }

      .mq-field input,
      .mq-field select,
      .mq-field textarea {
        width: 100%;
        min-height: 44px;
        padding: 11px;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #FFFFFF;
        font: inherit;
        outline: none;
      }

      .mq-field textarea {
        min-height: 85px;
        resize: vertical;
      }

      .mq-field input:focus,
      .mq-field select:focus,
      .mq-field textarea:focus {
        border-color: #22C55E;
      }

      .mq-field select option {
        background: #0D2419;
        color: #FFFFFF;
      }

      .mq-checkbox {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #FFFFFF;
        font-size: 14px;
      }

      .mq-checkbox input {
        width: 18px;
        height: 18px;
        accent-color: #16A34A;
      }

      .mq-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 16px;
      }

      .mq-button {
        min-height: 40px;
        border: 1px solid #16A34A;
        border-radius: 9px;
        background: #16A34A;
        color: #FFFFFF;
        padding: 9px 14px;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      .mq-button:hover {
        background: #22C55E;
      }

      .mq-button:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .mq-button-secondary {
        background: transparent;
        border-color: #28513A;
        color: #FFFFFF;
      }

      .mq-button-secondary:hover {
        background: #10291D;
      }

      .mq-status {
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.7;
        margin: 10px 0;
        overflow-wrap: anywhere;
      }

      .mq-list {
        display: grid;
        gap: 12px;
      }

      .mq-item {
        background: #10291D;
        border: 1px solid #28513A;
        border-radius: 12px;
        padding: 14px;
      }

      .mq-item-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .mq-item-title {
        color: #FFFFFF;
        font-size: 15px;
        font-weight: 700;
        line-height: 1.5;
        overflow-wrap: anywhere;
        margin: 0;
      }

      .mq-badge {
        color: #FFFFFF;
        border: 1px solid #28513A;
        border-radius: 20px;
        padding: 4px 9px;
        font-size: 11px;
        white-space: nowrap;
      }

      .mq-meta {
        color: #D1D5DB;
        font-size: 12px;
        line-height: 1.8;
        margin-top: 8px;
        overflow-wrap: anywhere;
      }

      .mq-item-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 13px;
      }

      .mq-item-actions .mq-button {
        min-height: 35px;
        padding: 7px 10px;
      }

      .mq-empty {
        border: 1px dashed #28513A;
        border-radius: 10px;
        color: #D1D5DB;
        text-align: center;
        padding: 20px 12px;
        line-height: 1.7;
      }

      @media (max-width: 600px) {
        .mq-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .mq-card {
          padding: 13px;
        }

        .mq-item-top {
          flex-direction: column;
        }

        .mq-actions .mq-button {
          flex: 1 1 auto;
        }
      }
    `;

    document.head.appendChild(style);
  }


  // ==================================================
  // FIREBASE
  // ==================================================

  function initializeFirebase() {
    const state = window.MNEETFirebase;

    if (
      state &&
      state.ready === true &&
      state.db &&
      state.auth
    ) {
      QuizAdmin.db = state.db;
      QuizAdmin.auth = state.auth;

      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      try {
        QuizAdmin.db = window.firebase.firestore();
        QuizAdmin.auth = window.firebase.auth();

        return true;
      } catch (error) {
        console.error(
          "mNEET Quiz Firebase initialization error:",
          error
        );
      }
    }

    showStatus(
      "Firebase connection পাওয়া যায়নি। firebase.js পরীক্ষা করো।"
    );

    return false;
  }


  // ==================================================
  // ADMIN AUTHORIZATION
  // ==================================================

  async function verifyAdmin() {
    if (!QuizAdmin.auth || !QuizAdmin.db) {
      return false;
    }

    const user = QuizAdmin.auth.currentUser;

    if (!user) {
      return false;
    }

    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized ===
        "function" &&
      window.MNEETAdmin.isAdminAuthorized()
    ) {
      return true;
    }

    try {
      const snapshot = await QuizAdmin.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!snapshot.exists) {
        return false;
      }

      return snapshot.data().active === true;

    } catch (error) {
      console.error(
        "mNEET Quiz authorization error:",
        error
      );

      return false;
    }
  }


  // ==================================================
  // UI HELPERS
  // ==================================================

  function element(tag, className, text) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (text !== undefined) {
      node.textContent = String(text);
    }

    return node;
  }


  function showStatus(message, type) {
    const box = $("quizAdminStatus");

    if (!box) {
      if (
        window.MNEETAdmin &&
        typeof window.MNEETAdmin.showMessage ===
          "function"
      ) {
        window.MNEETAdmin.showMessage(
          message,
          type || "warning"
        );
      }

      return;
    }

    box.hidden = false;
    box.textContent = String(message || "");
  }


  function clearStatus() {
    const box = $("quizAdminStatus");

    if (box) {
      box.hidden = true;
      box.textContent = "";
    }
  }


  function option(value, label) {
    const node = document.createElement("option");

    node.value = value;
    node.textContent = label;

    return node;
  }


  function fillSelect(select, items, placeholder) {
    if (!select) {
      return;
    }

    select.replaceChildren();

    select.appendChild(
      option("", placeholder)
    );

    items.forEach(function (item) {
      select.appendChild(
        option(
          item.id,
          String(item.name || item.title || item.id)
        )
      );
    });
  }


  function makeField(labelText, input, fullWidth) {
    const wrapper = element(
      "div",
      "mq-field" + (fullWidth ? " mq-full" : "")
    );

    const label = element("label", "", labelText);

    if (input.id) {
      label.htmlFor = input.id;
    }

    wrapper.append(label, input);

    return wrapper;
  }


  function makeInput(id, type, value) {
    const input = document.createElement("input");

    input.id = id;
    input.type = type || "text";

    if (value !== undefined) {
      input.value = String(value);
    }

    return input;
  }


  function makeSelect(id) {
    const select = document.createElement("select");

    select.id = id;

    return select;
  }


  function makeButton(text, callback, secondary) {
    const button = element(
      "button",
      secondary
        ? "mq-button mq-button-secondary"
        : "mq-button",
      text
    );

    button.type = "button";

    button.addEventListener("click", callback);

    return button;
  }


  // ==================================================
  // QUIZ TYPE OPTIONS
  // ==================================================

  const QUIZ_TYPES = [
    {
      value: "topic",
      label: "Topic-wise Quiz"
    },
    {
      value: "assertion_reason",
      label: "Assertion–Reason"
    },
    {
      value: "statement_based",
      label: "Statement Based"
    },
    {
      value: "match_following",
      label: "Match the Following"
    },
    {
      value: "correct_incorrect",
      label: "Correct / Incorrect"
    },
    {
      value: "diagram_based",
      label: "Diagram Based"
    },
    {
      value: "pyq",
      label: "PYQ"
    },
    {
      value: "fill_blanks",
      label: "Fill in the Blanks"
    },
    {
      value: "rapid_revision",
      label: "Rapid Revision"
    }
  ];


  // ==================================================
  // CREATE UI
  // ==================================================

  function createInterface() {
    const root = $("quizzesContent");

    if (!root || root.dataset.quizAdminReady === "true") {
      return;
    }

    root.dataset.quizAdminReady = "true";
    root.replaceChildren();

    const heading = element(
      "h2",
      "mq-heading",
      "Quiz Management"
    );

    const intro = element(
      "p",
      "mq-description",
      "Course, Subject, Chapter ও Topic নির্বাচন করে Quiz তৈরি, Edit, Delete এবং সাজিয়ে রাখো। প্রশ্নগুলো আলাদা Questions Management মডিউলে পরিচালিত হবে।"
    );

    const status = element("div", "mq-status");

    status.id = "quizAdminStatus";
    status.hidden = true;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const selectorCard = element("section", "mq-card");

    selectorCard.appendChild(
      element("h3", "mq-heading", "Select Topic")
    );

    const selectorGrid = element("div", "mq-grid");

    const courseSelect = makeSelect("quizCourseSelect");
    const subjectSelect = makeSelect("quizSubjectSelect");
    const chapterSelect = makeSelect("quizChapterSelect");
    const topicSelect = makeSelect("quizTopicSelect");

    selectorGrid.append(
      makeField("Course", courseSelect),
      makeField("Subject", subjectSelect),
      makeField("Chapter", chapterSelect),
      makeField("Topic", topicSelect)
    );

    selectorCard.appendChild(selectorGrid);

    const formCard = element("section", "mq-card");

    formCard.appendChild(
      element("h3", "mq-heading", "Quiz Details")
    );

    const form = document.createElement("form");

    form.id = "quizAdminForm";

    const grid = element("div", "mq-grid");

    const nameInput = makeInput("quizAdminName", "text");
    nameInput.maxLength = 150;
    nameInput.required = true;
    nameInput.autocomplete = "off";

    const typeSelect = makeSelect("quizAdminType");

    QUIZ_TYPES.forEach(function (type) {
      typeSelect.appendChild(
        option(type.value, type.label)
      );
    });

    const orderInput = makeInput(
      "quizAdminOrder",
      "number",
      "1"
    );

    orderInput.min = "1";
    orderInput.step = "1";
    orderInput.required = true;

    const timeInput = makeInput(
      "quizAdminQuestionTime",
      "number",
      "60"
    );

    timeInput.min = "1";
    timeInput.max = "3600";
    timeInput.step = "1";
    timeInput.required = true;

    const descriptionInput =
      document.createElement("textarea");

    descriptionInput.id = "quizAdminDescription";
    descriptionInput.maxLength = 3000;
    descriptionInput.rows = 4;

    const activeLabel = element(
      "label",
      "mq-checkbox"
    );

    const activeInput = makeInput(
      "quizAdminActive",
      "checkbox"
    );

    activeInput.checked = true;

    activeLabel.append(
      activeInput,
      element("span", "", "Quiz Active")
    );

    grid.append(
      makeField("Quiz Name", nameInput),
      makeField("Quiz Type", typeSelect),
      makeField("Display Order", orderInput),
      makeField("Per-question Time (seconds)", timeInput),
      makeField("Description", descriptionInput, true),
      makeField("Status", activeLabel, true)
    );

    const actions = element("div", "mq-actions");

    const saveButton = document.createElement("button");

    saveButton.id = "quizAdminSaveButton";
    saveButton.type = "submit";
    saveButton.className = "mq-button";
    saveButton.textContent = "Create Quiz";

    const cancelButton = makeButton(
      "Cancel Edit",
      resetForm,
      true
    );

    cancelButton.id = "quizAdminCancelButton";
    cancelButton.hidden = true;

    actions.append(saveButton, cancelButton);

    form.append(grid, actions);

    form.addEventListener("submit", saveQuiz);

    formCard.appendChild(form);

    const listCard = element("section", "mq-card");

    listCard.appendChild(
      element("h3", "mq-heading", "Quiz List")
    );

    listCard.appendChild(
      element(
        "p",
        "mq-description",
        "নির্বাচিত Topic-এর Quiz এখানে দেখা যাবে।"
      )
    );

    const list = element("div", "mq-list");

    list.id = "quizAdminList";

    listCard.appendChild(list);

    root.append(
      heading,
      intro,
      status,
      selectorCard,
      formCard,
      listCard
    );

    courseSelect.addEventListener(
      "change",
      async function () {
        QuizAdmin.courseId = courseSelect.value;
        QuizAdmin.subjectId = "";
        QuizAdmin.chapterId = "";
        QuizAdmin.topicId = "";

        resetForm();

        await loadSubjects();
      }
    );

    subjectSelect.addEventListener(
      "change",
      async function () {
        QuizAdmin.subjectId = subjectSelect.value;
        QuizAdmin.chapterId = "";
        QuizAdmin.topicId = "";

        resetForm();

        await loadChapters();
      }
    );

    chapterSelect.addEventListener(
      "change",
      async function () {
        QuizAdmin.chapterId = chapterSelect.value;
        QuizAdmin.topicId = "";

        resetForm();

        await loadTopics();
      }
    );

    topicSelect.addEventListener(
      "change",
      async function () {
        QuizAdmin.topicId = topicSelect.value;

        resetForm();

        await loadQuizzes();
      }
    );
  }


  // ==================================================
  // LOAD COURSES
  // ==================================================

  async function loadCourses() {
    const select = $("quizCourseSelect");

    if (!select || !QuizAdmin.db) {
      return;
    }

    try {
      const snapshot = await QuizAdmin.db
        .collection("courses")
        .get();

      QuizAdmin.courses = snapshot.docs
        .map(function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        })
        .filter(function (course) {
          return (
            course.active !== false &&
            course.published !== false
          );
        })
        .sort(function (a, b) {
          return Number(a.order || 0) -
            Number(b.order || 0);
        });

      fillSelect(
        select,
        QuizAdmin.courses,
        "Select Course"
      );

      const activeCourse =
        window.MNEETAdmin &&
        typeof window.MNEETAdmin.getActiveCourse ===
          "function"
          ? window.MNEETAdmin.getActiveCourse()
          : "all";

      if (
        activeCourse &&
        activeCourse !== "all" &&
        QuizAdmin.courses.some(function (course) {
          return course.id === activeCourse;
        })
      ) {
        select.value = activeCourse;
      }

      QuizAdmin.courseId = select.value;

      if (QuizAdmin.courseId) {
        await loadSubjects();
      } else {
        resetDependentSelectors();
      }

    } catch (error) {
      console.error(
        "mNEET Quiz: course loading error:",
        error
      );

      showStatus(
        "Course লোড করা যায়নি। Firestore Rules পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // LOAD SUBJECTS
  // ==================================================

  async function loadSubjects() {
    const select = $("quizSubjectSelect");

    if (!select) {
      return;
    }

    try {
      if (!QuizAdmin.courseId) {
        QuizAdmin.subjects = [];
        QuizAdmin.subjectId = "";

        fillSelect(
          select,
          [],
          "Select Course First"
        );

        await loadChapters();

        return;
      }

      const snapshot = await QuizAdmin.db
        .collection("subjects")
        .where("courseId", "==", QuizAdmin.courseId)
        .get();

      QuizAdmin.subjects = snapshot.docs
        .map(function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        })
        .filter(function (subject) {
          return subject.active !== false;
        })
        .sort(function (a, b) {
          return Number(a.order || 0) -
            Number(b.order || 0);
        });

      fillSelect(
        select,
        QuizAdmin.subjects,
        "Select Subject"
      );

      QuizAdmin.subjectId = select.value;

      await loadChapters();

    } catch (error) {
      console.error(
        "mNEET Quiz: subject loading error:",
        error
      );

      showStatus(
        "Subject লোড করা যায়নি। Subject-এর courseId পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // LOAD CHAPTERS
  // ==================================================

  async function loadChapters() {
    const select = $("quizChapterSelect");

    if (!select) {
      return;
    }

    try {
      if (!QuizAdmin.courseId || !QuizAdmin.subjectId) {
        QuizAdmin.chapters = [];
        QuizAdmin.chapterId = "";

        fillSelect(
          select,
          [],
          "Select Subject First"
        );

        await loadTopics();

        return;
      }

      const snapshot = await QuizAdmin.db
        .collection("chapters")
        .where("courseId", "==", QuizAdmin.courseId)
        .where("subjectId", "==", QuizAdmin.subjectId)
        .get();

      QuizAdmin.chapters = snapshot.docs
        .map(function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        })
        .filter(function (chapter) {
          return chapter.active !== false;
        })
        .sort(function (a, b) {
          return Number(a.order || 0) -
            Number(b.order || 0);
        });

      fillSelect(
        select,
        QuizAdmin.chapters,
        "Select Chapter"
      );

      QuizAdmin.chapterId = select.value;

      await loadTopics();

    } catch (error) {
      console.error(
        "mNEET Quiz: chapter loading error:",
        error
      );

      showStatus(
        "Chapter লোড করা যায়নি। Chapter-এর courseId ও subjectId পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // LOAD TOPICS
  // ==================================================

  async function loadTopics() {
    const select = $("quizTopicSelect");

    if (!select) {
      return;
    }

    try {
      if (
        !QuizAdmin.courseId ||
        !QuizAdmin.subjectId ||
        !QuizAdmin.chapterId
      ) {
        QuizAdmin.topics = [];
        QuizAdmin.topicId = "";

        fillSelect(
          select,
          [],
          "Select Chapter First"
        );

        await loadQuizzes();

        return;
      }

      const snapshot = await QuizAdmin.db
        .collection("topics")
        .where("courseId", "==", QuizAdmin.courseId)
        .where("subjectId", "==", QuizAdmin.subjectId)
        .where("chapterId", "==", QuizAdmin.chapterId)
        .get();

      QuizAdmin.topics = snapshot.docs
        .map(function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        })
        .filter(function (topic) {
          return topic.active !== false;
        })
        .sort(function (a, b) {
          return Number(a.order || 0) -
            Number(b.order || 0);
        });

      fillSelect(
        select,
        QuizAdmin.topics,
        "Select Topic"
      );

      QuizAdmin.topicId = select.value;

      await loadQuizzes();

    } catch (error) {
      console.error(
        "mNEET Quiz: topic loading error:",
        error
      );

      showStatus(
        "Topic লোড করা যায়নি। Topic-এর courseId, subjectId ও chapterId পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // LOAD QUIZZES
  // ==================================================

  async function loadQuizzes() {
    const list = $("quizAdminList");

    if (!list) {
      return;
    }

    if (!QuizAdmin.topicId) {
      QuizAdmin.quizzes = [];

      renderQuizzes([]);

      return;
    }

    if (QuizAdmin.loading) {
      return;
    }

    QuizAdmin.loading = true;

    list.replaceChildren(
      element("div", "mq-empty", "Loading Quizzes…")
    );

    try {
      const snapshot = await QuizAdmin.db
        .collection("quizzes")
        .where("courseId", "==", QuizAdmin.courseId)
        .where("subjectId", "==", QuizAdmin.subjectId)
        .where("chapterId", "==", QuizAdmin.chapterId)
        .where("topicId", "==", QuizAdmin.topicId)
        .get();

      QuizAdmin.quizzes = snapshot.docs
        .map(function (doc) {
          return {
            id: doc.id,
            ...doc.data()
          };
        })
        .sort(function (a, b) {
          return Number(a.order || 0) -
            Number(b.order || 0);
        });

      renderQuizzes(QuizAdmin.quizzes);

    } catch (error) {
      console.error(
        "mNEET Quiz: quiz loading error:",
        error
      );

      list.replaceChildren(
        element(
          "div",
          "mq-empty",
          "Quiz লোড করা যায়নি। Firestore Rules ও Quiz fields পরীক্ষা করো।"
        )
      );

    } finally {
      QuizAdmin.loading = false;
    }
  }


  // ==================================================
  // RENDER QUIZZES
  // ==================================================

  function renderQuizzes(quizzes) {
    const list = $("quizAdminList");

    if (!list) {
      return;
    }

    list.replaceChildren();

    if (!QuizAdmin.topicId) {
      list.appendChild(
        element(
          "div",
          "mq-empty",
          "Quiz দেখতে প্রথমে Course, Subject, Chapter ও Topic নির্বাচন করো।"
        )
      );

      return;
    }

    if (!quizzes.length) {
      list.appendChild(
        element(
          "div",
          "mq-empty",
          "এই Topic-এ কোনো Quiz নেই। উপরের Form থেকে Quiz তৈরি করো।"
        )
      );

      return;
    }

    quizzes.forEach(function (quiz, index) {
      const card = element("article", "mq-item");

      const top = element("div", "mq-item-top");

      const title = element(
        "h4",
        "mq-item-title",
        String(quiz.order || index + 1) +
          ". " +
          String(quiz.name || quiz.title || "Untitled Quiz")
      );

      const badge = element(
        "span",
        "mq-badge",
        quiz.active === false ? "Inactive" : "Active"
      );

      top.append(title, badge);

      const type = QUIZ_TYPES.find(function (item) {
        return item.value === quiz.type;
      });

      const meta = element(
        "div",
        "mq-meta",
        "Type: " +
          (type ? type.label : String(quiz.type || "Topic-wise Quiz")) +
          "\nOrder: " +
          String(quiz.order || index + 1) +
          "\nPer-question time: " +
          String(quiz.perQuestionTime || 60) +
          " seconds"
      );

      meta.style.whiteSpace = "pre-line";

      card.append(top, meta);

      if (quiz.description) {
        card.appendChild(
          element(
            "p",
            "mq-description",
            quiz.description
          )
        );
      }

      const actions = element(
        "div",
        "mq-item-actions"
      );

      actions.appendChild(
        makeButton("Edit", function () {
          editQuiz(quiz.id);
        })
      );

      if (index > 0) {
        actions.appendChild(
          makeButton(
            "Move Up",
            function () {
              moveQuiz(quiz.id, -1);
            },
            true
          )
        );
      }

      if (index < quizzes.length - 1) {
        actions.appendChild(
          makeButton(
            "Move Down",
            function () {
              moveQuiz(quiz.id, 1);
            },
            true
          )
        );
      }

      actions.appendChild(
        makeButton(
          quiz.active === false ? "Activate" : "Deactivate",
          function () {
            toggleQuizStatus(quiz);
          },
          true
        )
      );

      actions.appendChild(
        makeButton(
          "Delete",
          function () {
            deleteQuiz(quiz);
          },
          true
        )
      );

      card.appendChild(actions);
      list.appendChild(card);
    });
  }


  // ==================================================
  // VALIDATION
  // ==================================================

  function validateForm() {
    if (!QuizAdmin.courseId) {
      showStatus("Course নির্বাচন করো।", "error");
      return false;
    }

    if (!QuizAdmin.subjectId) {
      showStatus("Subject নির্বাচন করো।", "error");
      return false;
    }

    if (!QuizAdmin.chapterId) {
      showStatus("Chapter নির্বাচন করো।", "error");
      return false;
    }

    if (!QuizAdmin.topicId) {
      showStatus("Topic নির্বাচন করো।", "error");
      return false;
    }

    const name = $("quizAdminName").value.trim();

    if (!name) {
      showStatus("Quiz Name লিখতে হবে।", "error");
      return false;
    }

    const order = Number($("quizAdminOrder").value);

    if (!Number.isInteger(order) || order < 1) {
      showStatus(
        "Quiz Order 1 বা তার বেশি পূর্ণসংখ্যা হতে হবে।",
        "error"
      );
      return false;
    }

    const time = Number(
      $("quizAdminQuestionTime").value
    );

    if (
      !Number.isInteger(time) ||
      time < 1 ||
      time > 3600
    ) {
      showStatus(
        "Per-question time 1 থেকে 3600 seconds-এর মধ্যে হতে হবে।",
        "error"
      );
      return false;
    }

    const duplicate = QuizAdmin.quizzes.some(function (quiz) {
      return (
        quiz.id !== QuizAdmin.editingQuizId &&
        String(quiz.name || quiz.title || "")
          .trim()
          .toLowerCase() === name.toLowerCase()
      );
    });

    if (duplicate) {
      showStatus(
        "এই Topic-এ একই নামে Quiz আগে থেকেই আছে।",
        "error"
      );
      return false;
    }

    return true;
  }


  // ==================================================
  // CREATE / UPDATE QUIZ
  // ==================================================

  async function saveQuiz(event) {
    event.preventDefault();

    clearStatus();

    if (QuizAdmin.saving) {
      return;
    }

    if (!await verifyAdmin()) {
      showStatus(
        "Quiz পরিবর্তনের জন্য Admin authorization প্রয়োজন।",
        "error"
      );
      return;
    }

    if (!validateForm()) {
      return;
    }

    const user = QuizAdmin.auth.currentUser;

    const saveButton = $("quizAdminSaveButton");

    const originalText = QuizAdmin.editingQuizId
      ? "Update Quiz"
      : "Create Quiz";

    QuizAdmin.saving = true;
    saveButton.disabled = true;
    saveButton.textContent = "Saving…";

    try {
      const payload = {
        courseId: QuizAdmin.courseId,
        subjectId: QuizAdmin.subjectId,
        chapterId: QuizAdmin.chapterId,
        topicId: QuizAdmin.topicId,

        name: $("quizAdminName").value.trim(),

        description:
          $("quizAdminDescription").value.trim(),

        type: $("quizAdminType").value,

        order: Number(
          $("quizAdminOrder").value
        ),

        perQuestionTime: Number(
          $("quizAdminQuestionTime").value
        ),

        active: $("quizAdminActive").checked,

        updatedAt:
          window.firebase.firestore.FieldValue.serverTimestamp(),

        updatedBy: user.uid
      };

      if (QuizAdmin.editingQuizId) {
        await QuizAdmin.db
          .collection("quizzes")
          .doc(QuizAdmin.editingQuizId)
          .update(payload);

        showStatus(
          "Quiz সফলভাবে Update হয়েছে।",
          "success"
        );

      } else {
        payload.createdAt =
          window.firebase.firestore.FieldValue.serverTimestamp();

        payload.createdBy = user.uid;

        await QuizAdmin.db
          .collection("quizzes")
          .add(payload);

        showStatus(
          "Quiz সফলভাবে তৈরি হয়েছে।",
          "success"
        );
      }

      resetForm();

      await loadQuizzes();

      if (
        window.MNEETAdmin &&
        typeof window.MNEETAdmin.refreshDashboard ===
          "function"
      ) {
        window.MNEETAdmin.refreshDashboard();
      }

    } catch (error) {
      console.error(
        "mNEET Quiz: save error:",
        error
      );

      showStatus(
        error.code === "permission-denied"
          ? "Firestore Rules Quiz Save করার অনুমতি দেয়নি।"
          : "Quiz Save করা যায়নি। Internet ও Firebase পরীক্ষা করো।",
        "error"
      );

    } finally {
      QuizAdmin.saving = false;
      saveButton.disabled = false;
      saveButton.textContent = originalText;
    }
  }


  // ==================================================
  // EDIT QUIZ
  // ==================================================

  function editQuiz(quizId) {
    const quiz = QuizAdmin.quizzes.find(function (item) {
      return item.id === quizId;
    });

    if (!quiz) {
      showStatus(
        "Quiz পাওয়া যায়নি। আবার Load করো।",
        "error"
      );
      return;
    }

    QuizAdmin.editingQuizId = quiz.id;

    $("quizAdminName").value =
      quiz.name || quiz.title || "";

    $("quizAdminDescription").value =
      quiz.description || "";

    $("quizAdminType").value =
      quiz.type || "topic";

    $("quizAdminOrder").value =
      Number(quiz.order || 1);

    $("quizAdminQuestionTime").value =
      Number(quiz.perQuestionTime || 60);

    $("quizAdminActive").checked =
      quiz.active !== false;

    $("quizAdminSaveButton").textContent =
      "Update Quiz";

    $("quizAdminCancelButton").hidden = false;

    $("quizAdminName").focus();

    showStatus(
      "Edit mode: " + (quiz.name || quiz.title || ""),
      "success"
    );
  }


  // ==================================================
  // RESET FORM
  // ==================================================

  function resetForm() {
    const form = $("quizAdminForm");

    if (!form) {
      return;
    }

    form.reset();

    QuizAdmin.editingQuizId = "";

    $("quizAdminType").value = "topic";

    $("quizAdminOrder").value =
      String(QuizAdmin.quizzes.length + 1);

    $("quizAdminQuestionTime").value = "60";

    $("quizAdminActive").checked = true;

    $("quizAdminSaveButton").textContent =
      "Create Quiz";

    $("quizAdminCancelButton").hidden = true;
  }


  // ==================================================
  // DELETE QUIZ
  // ==================================================

  async function deleteQuiz(quiz) {
    const confirmed = window.confirm(
      'তুমি কি "' +
      String(quiz.name || quiz.title || "এই Quiz") +
      '" Delete করতে চাও? সংশ্লিষ্ট Questions আলাদাভাবে যাচাই করতে হবে।'
    );

    if (!confirmed) {
      return;
    }

    if (!await verifyAdmin()) {
      showStatus(
        "Quiz Delete করার জন্য Admin authorization প্রয়োজন।",
        "error"
      );
      return;
    }

    try {
      await QuizAdmin.db
        .collection("quizzes")
        .doc(quiz.id)
        .delete();

      if (QuizAdmin.editingQuizId === quiz.id) {
        resetForm();
      }

      showStatus(
        "Quiz Delete হয়েছে। সংশ্লিষ্ট Questions ও পুরোনো Results স্বয়ংক্রিয়ভাবে Delete হয়নি।",
        "success"
      );

      await loadQuizzes();

      if (
        window.MNEETAdmin &&
        typeof window.MNEETAdmin.refreshDashboard ===
          "function"
      ) {
        window.MNEETAdmin.refreshDashboard();
      }

    } catch (error) {
      console.error(
        "mNEET Quiz: delete error:",
        error
      );

      showStatus(
        error.code === "permission-denied"
          ? "Firestore Rules Delete করার অনুমতি দেয়নি।"
          : "Quiz Delete করা যায়নি। Firebase পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // ACTIVATE / DEACTIVATE
  // ==================================================

  async function toggleQuizStatus(quiz) {
    if (!await verifyAdmin()) {
      showStatus(
        "Quiz Status পরিবর্তনের জন্য Admin authorization প্রয়োজন।",
        "error"
      );
      return;
    }

    try {
      await QuizAdmin.db
        .collection("quizzes")
        .doc(quiz.id)
        .update({
          active: quiz.active === false,

          updatedAt:
            window.firebase.firestore.FieldValue.serverTimestamp(),

          updatedBy: QuizAdmin.auth.currentUser.uid
        });

      showStatus(
        "Quiz Status Update হয়েছে।",
        "success"
      );

      await loadQuizzes();

    } catch (error) {
      console.error(
        "mNEET Quiz: status update error:",
        error
      );

      showStatus(
        "Quiz Status পরিবর্তন করা যায়নি। Firestore Rules পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // MOVE QUIZ
  // ==================================================

  async function moveQuiz(quizId, direction) {
    if (!await verifyAdmin()) {
      showStatus(
        "Quiz Order পরিবর্তনের জন্য Admin authorization প্রয়োজন।",
        "error"
      );
      return;
    }

    const sorted = QuizAdmin.quizzes
      .slice()
      .sort(function (a, b) {
        return Number(a.order || 0) -
          Number(b.order || 0);
      });

    const index = sorted.findIndex(function (quiz) {
      return quiz.id === quizId;
    });

    const targetIndex = index + direction;

    if (
      index < 0 ||
      targetIndex < 0 ||
      targetIndex >= sorted.length
    ) {
      return;
    }

    const current = sorted[index];
    const target = sorted[targetIndex];

    const currentOrder = Number(
      current.order || index + 1
    );

    const targetOrder = Number(
      target.order || targetIndex + 1
    );

    try {
      const batch = QuizAdmin.db.batch();

      batch.update(
        QuizAdmin.db.collection("quizzes").doc(current.id),
        {
          order: targetOrder,
          updatedAt:
            window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: QuizAdmin.auth.currentUser.uid
        }
      );

      batch.update(
        QuizAdmin.db.collection("quizzes").doc(target.id),
        {
          order: currentOrder,
          updatedAt:
            window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: QuizAdmin.auth.currentUser.uid
        }
      );

      await batch.commit();

      showStatus(
        "Quiz Order পরিবর্তন হয়েছে।",
        "success"
      );

      await loadQuizzes();

    } catch (error) {
      console.error(
        "mNEET Quiz: reorder error:",
        error
      );

      showStatus(
        "Quiz Order পরিবর্তন করা যায়নি। Firestore Rules পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // RESET SELECTORS
  // ==================================================

  function resetDependentSelectors() {
    QuizAdmin.subjectId = "";
    QuizAdmin.chapterId = "";
    QuizAdmin.topicId = "";

    fillSelect(
      $("quizSubjectSelect"),
      [],
      "Select Course First"
    );

    fillSelect(
      $("quizChapterSelect"),
      [],
      "Select Subject First"
    );

    fillSelect(
      $("quizTopicSelect"),
      [],
      "Select Chapter First"
    );

    renderQuizzes([]);
  }


  // ==================================================
  // INITIALIZATION
  // ==================================================

  async function initialize() {
    if (QuizAdmin.initialized) {
      return;
    }

    const root = $("quizzesContent");

    if (!root) {
      return;
    }

    QuizAdmin.initialized = true;

    addStyles();
    createInterface();

    if (!initializeFirebase()) {
      return;
    }

    if (!await verifyAdmin()) {
      showStatus(
        "Admin authorization যাচাই করা হচ্ছে। অনুমোদিত Admin account দিয়ে Login করো।"
      );

      return;
    }

    await loadCourses();
  }


  async function retryInitialization() {
    if (!QuizAdmin.initialized) {
      await initialize();
      return;
    }

    if (!QuizAdmin.db || !QuizAdmin.auth) {
      if (!initializeFirebase()) {
        return;
      }
    }

    if (!await verifyAdmin()) {
      return;
    }

    if (!QuizAdmin.courses.length) {
      await loadCourses();
    }
  }


  // ==================================================
  // ADMIN NAVIGATION
  // ==================================================

  document.addEventListener(
    "mneet:admin-page-change",
    function (event) {
      const page = event.detail &&
        event.detail.page;

      if (page === "quizzes") {
        retryInitialization();
      }
    }
  );


  document.addEventListener(
    "mneet:admin-course-change",
    function (event) {
      const courseId = event.detail &&
        event.detail.courseId;

      if (!courseId || courseId === "all") {
        return;
      }

      const select = $("quizCourseSelect");

      if (!select) {
        return;
      }

      const exists = Array.from(
        select.options
      ).some(function (item) {
        return item.value === courseId;
      });

      if (exists) {
        select.value = courseId;

        QuizAdmin.courseId = courseId;
        QuizAdmin.subjectId = "";
        QuizAdmin.chapterId = "";
        QuizAdmin.topicId = "";

        resetForm();

        loadSubjects();
      }
    }
  );


  // ==================================================
  // PUBLIC API
  // ==================================================

  QuizAdmin.initialize = initialize;
  QuizAdmin.loadCourses = loadCourses;
  QuizAdmin.loadSubjects = loadSubjects;
  QuizAdmin.loadChapters = loadChapters;
  QuizAdmin.loadTopics = loadTopics;
  QuizAdmin.loadQuizzes = loadQuizzes;

  QuizAdmin.getSelectedCourse = function () {
    return QuizAdmin.courseId;
  };

  QuizAdmin.getSelectedSubject = function () {
    return QuizAdmin.subjectId;
  };

  QuizAdmin.getSelectedChapter = function () {
    return QuizAdmin.chapterId;
  };

  QuizAdmin.getSelectedTopic = function () {
    return QuizAdmin.topicId;
  };


  // ==================================================
  // START
  // ==================================================

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      { once: true }
    );
  } else {
    initialize();
  }

})();
