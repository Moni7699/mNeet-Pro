/* =========================================================
   mNEET ADMIN QUESTIONS — FILE 16
   Root file: admin-questions.js

   Structure:
   Course → Subject → Chapter → Topic → Quiz → Questions

   Features:
   - Admin-only question management
   - Text or image questions
   - Four options
   - Correct answer
   - Solution and NCERT reference
   - Create, edit, delete and reorder
   - Firestore persistence
   - Green and white UI
========================================================= */

(function () {
  "use strict";

  if (window.MNEETQuestionsAdmin) return;

  const MODULE = {
    initialized: false,
    initializing: false,
    authorized: false,
    db: null,
    auth: null,
    courses: [],
    subjects: [],
    chapters: [],
    topics: [],
    quizzes: [],
    questions: [],
    editingId: null,
    loading: false,
    selectedCourse: "",
    selectedSubject: "",
    selectedChapter: "",
    selectedTopic: "",
    selectedQuiz: ""
  };

  const COLLECTIONS = {
    courses: "courses",
    subjects: "subjects",
    chapters: "chapters",
    topics: "topics",
    quizzes: "quizzes",
    questions: "questions"
  };

  const GREEN = "#16A34A";
  const LIGHT_GREEN = "#22C55E";
  const WHITE = "#FFFFFF";
  const TEXT_MUTED = "#D1D5DB";
  const BORDER = "#28513A";
  const CARD = "#0D2419";
  const INPUT = "#10291D";
  const BG = "#071A12";

  function el(id) {
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

  function notify(message, type) {
    const root = el("questionsContent");
    if (!root) return;

    let box = el("questionsAdminMessage");

    if (!box) {
      box = document.createElement("div");
      box.id = "questionsAdminMessage";
      box.setAttribute("role", "status");
      root.prepend(box);
    }

    box.style.cssText = [
      "padding:12px 14px",
      "margin:10px 0",
      "border:1px solid " + BORDER,
      "border-radius:10px",
      "background:" + CARD,
      "color:" + WHITE,
      "line-height:1.5"
    ].join(";");

    box.textContent = message;

    if (type === "error") {
      box.style.borderColor = GREEN;
    }
  }

  function requireFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.ready &&
      window.MNEETFirebase.db &&
      window.MNEETFirebase.auth
    ) {
      MODULE.db = window.MNEETFirebase.db;
      MODULE.auth = window.MNEETFirebase.auth;
      return true;
    }

    if (
      window.firebase &&
      window.firebase.apps &&
      window.firebase.apps.length
    ) {
      MODULE.auth = window.firebase.auth();
      MODULE.db = window.firebase.firestore();
      return true;
    }

    notify(
      "Firebase এখনো প্রস্তুত নয়। Firebase configuration ও script loading পরীক্ষা করো।",
      "error"
    );

    return false;
  }

  async function checkAdmin() {
    if (!requireFirebase()) return false;

    const user = MODULE.auth.currentUser;

    if (!user) {
      MODULE.authorized = false;
      notify("প্রশ্ন পরিচালনা করতে Admin হিসেবে Login করো।", "error");
      return false;
    }

    try {
      const snapshot = await MODULE.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!snapshot.exists || snapshot.data().active !== true) {
        MODULE.authorized = false;
        notify("এই Account-এর Admin অনুমতি নেই।", "error");
        return false;
      }

      MODULE.authorized = true;
      return true;
    } catch (error) {
      MODULE.authorized = false;
      notify(
        "Admin অনুমতি যাচাই করা যায়নি: " +
          (error.message || "অজানা সমস্যা"),
        "error"
      );
      return false;
    }
  }

  function getCurrentUserId() {
    return MODULE.auth &&
      MODULE.auth.currentUser
      ? MODULE.auth.currentUser.uid
      : "";
  }

  function timestamp() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  }

  function collection(name) {
    return MODULE.db.collection(name);
  }

  function orderValue(item) {
    const value = Number(item.order);
    return Number.isFinite(value) ? value : 0;
  }

  function sortByOrder(items) {
    return items.slice().sort(function (a, b) {
      return orderValue(a) - orderValue(b);
    });
  }

  async function readCollection(name, filters) {
    let query = collection(name);

    (filters || []).forEach(function (filter) {
      query = query.where(filter[0], filter[1], filter[2]);
    });

    const snapshot = await query.get();

    return snapshot.docs.map(function (doc) {
      return Object.assign({ id: doc.id }, doc.data());
    });
  }

  function activeItems(items) {
    return items.filter(function (item) {
      return item.active !== false &&
        item.published !== false;
    });
  }

  function fieldStyle() {
    return [
      "width:100%",
      "box-sizing:border-box",
      "padding:11px 12px",
      "border:1px solid " + BORDER,
      "border-radius:9px",
      "background:" + INPUT,
      "color:" + WHITE,
      "font-size:14px",
      "outline:none"
    ].join(";");
  }

  function labelStyle() {
    return [
      "display:block",
      "margin:0 0 7px",
      "font-size:13px",
      "font-weight:700",
      "color:" + TEXT_MUTED
    ].join(";");
  }

  function buttonStyle(primary) {
    return [
      "padding:10px 14px",
      "border:1px solid " + GREEN,
      "border-radius:9px",
      "background:" + (primary ? GREEN : CARD),
      "color:" + WHITE,
      "font-weight:700",
      "cursor:pointer"
    ].join(";");
  }

  function makeField(label, id, type, value, placeholder) {
    const isTextarea = type === "textarea";

    return `
      <div style="margin-bottom:14px;min-width:0">
        <label for="${id}" style="${labelStyle()}">
          ${escapeHTML(label)}
        </label>

        ${
          isTextarea
            ? `<textarea
                id="${id}"
                rows="3"
                placeholder="${escapeHTML(placeholder || "")}"
                style="${fieldStyle()}resize:vertical"
              >${escapeHTML(value || "")}</textarea>`
            : `<input
                id="${id}"
                type="${type || "text"}"
                value="${escapeHTML(value || "")}"
                placeholder="${escapeHTML(placeholder || "")}"
                style="${fieldStyle()}"
              >`
        }
      </div>
    `;
  }

  function makeSelect(label, id, items, selected, placeholder) {
    const options = items.map(function (item) {
      return `
        <option
          value="${escapeHTML(item.id)}"
          ${item.id === selected ? "selected" : ""}
        >
          ${escapeHTML(item.name || item.title || item.id)}
        </option>
      `;
    }).join("");

    return `
      <div style="margin-bottom:14px;min-width:0">
        <label for="${id}" style="${labelStyle()}">
          ${escapeHTML(label)}
        </label>

        <select id="${id}" style="${fieldStyle()}">
          <option value="">${escapeHTML(placeholder || "নির্বাচন করো")}</option>
          ${options}
        </select>
      </div>
    `;
  }

  function createInterface() {
    const root = el("questionsContent");

    if (!root) {
      console.warn(
        "mNEET Questions: admin.html-এ #questionsContent পাওয়া যায়নি।"
      );
      return false;
    }

    root.innerHTML = `
      <style>
        #questionsContent * {
          box-sizing: border-box;
        }

        #questionsContent .qa-card {
          background:${CARD};
          border:1px solid ${BORDER};
          border-radius:14px;
          padding:16px;
          margin-bottom:16px;
          color:${WHITE};
        }

        #questionsContent .qa-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        #questionsContent .qa-grid > div {
          min-width:0;
        }

        #questionsContent .qa-question {
          border:1px solid ${BORDER};
          border-radius:12px;
          padding:14px;
          margin:12px 0;
          background:${BG};
          color:${WHITE};
          overflow-wrap:anywhere;
        }

        #questionsContent .qa-small {
          color:${TEXT_MUTED};
          font-size:12px;
          line-height:1.6;
        }

        #questionsContent .qa-actions {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:12px;
        }

        #questionsContent .qa-btn {
          ${buttonStyle(false)}
        }

        #questionsContent .qa-primary {
          ${buttonStyle(true)}
        }

        #questionsContent .qa-btn:disabled,
        #questionsContent .qa-primary:disabled {
          opacity:.55;
          cursor:not-allowed;
        }

        #questionsContent .qa-option {
          padding:8px 10px;
          border:1px solid ${BORDER};
          border-radius:8px;
          margin-top:7px;
          color:${WHITE};
          overflow-wrap:anywhere;
        }

        #questionsContent .qa-correct {
          border-color:${LIGHT_GREEN};
        }

        #questionsContent .qa-preview {
          display:block;
          max-width:100%;
          max-height:220px;
          margin-top:10px;
          border:1px solid ${BORDER};
          border-radius:9px;
          object-fit:contain;
        }

        @media(max-width:650px) {
          #questionsContent .qa-grid {
            grid-template-columns:minmax(0,1fr);
          }

          #questionsContent .qa-card {
            padding:12px;
          }
        }
      </style>

      <div id="questionsAdminMessage"
           role="status"
           style="color:${WHITE};margin-bottom:12px">
        Questions Management
      </div>

      <section class="qa-card">
        <h2 style="margin:0 0 8px;color:${WHITE}">
          Question Management
        </h2>

        <p class="qa-small">
          Course → Subject → Chapter → Topic → Quiz → Questions
        </p>

        <div class="qa-grid">
          <div id="qaCourseSlot"></div>
          <div id="qaSubjectSlot"></div>
          <div id="qaChapterSlot"></div>
          <div id="qaTopicSlot"></div>
        </div>

        <div id="qaQuizSlot"></div>

        <div class="qa-actions">
          <button type="button" id="qaLoadQuestions"
                  class="qa-primary">
            Load Questions
          </button>

          <button type="button" id="qaNewQuestion"
                  class="qa-btn">
            + New Question
          </button>
        </div>
      </section>

      <section id="qaEditor" class="qa-card" hidden>
        <h3 id="qaEditorTitle" style="margin-top:0">
          Create Question
        </h3>

        <form id="qaForm">
          ${makeField(
            "Question Text",
            "qaQuestionText",
            "textarea",
            "",
            "প্রশ্ন এখানে লিখো"
          )}

          <div style="margin-bottom:14px">
            <label for="qaQuestionImage" style="${labelStyle()}">
              Question Image (JPEG/PNG)
            </label>

            <input
              id="qaQuestionImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style="${fieldStyle()}"
            >

            <p class="qa-small">
              ছবি আপলোডের জন্য Firebase Storage SDK এবং Storage Rules
              সক্রিয় থাকতে হবে। শুধু Text প্রশ্নের জন্য ছবি বাধ্যতামূলক নয়।
            </p>

            <img id="qaImagePreview"
                 class="qa-preview"
                 alt="Question image preview"
                 hidden>

            <button type="button"
                    id="qaRemoveImage"
                    class="qa-btn"
                    style="margin-top:8px">
              Remove Image
            </button>
          </div>

          <div class="qa-grid">
            ${makeField("Option 1", "qaOption1", "text", "", "Option 1")}
            ${makeField("Option 2", "qaOption2", "text", "", "Option 2")}
            ${makeField("Option 3", "qaOption3", "text", "", "Option 3")}
            ${makeField("Option 4", "qaOption4", "text", "", "Option 4")}
          </div>

          <div style="margin-bottom:14px">
            <label for="qaCorrectOption" style="${labelStyle()}">
              Correct Answer
            </label>

            <select id="qaCorrectOption" style="${fieldStyle()}" required>
              <option value="">সঠিক উত্তর নির্বাচন করো</option>
              <option value="1">Option 1</option>
              <option value="2">Option 2</option>
              <option value="3">Option 3</option>
              <option value="4">Option 4</option>
            </select>
          </div>

          ${makeField(
            "Solution / Explanation",
            "qaSolution",
            "textarea",
            "",
            "প্রশ্নের সমাধান লিখো"
          )}

          ${makeField(
            "NCERT Reference",
            "qaNcertReference",
            "text",
            "",
            "যেমন: Class 11, Chapter name, Page number"
          )}

          ${makeField(
            "Question Order",
            "qaQuestionOrder",
            "number",
            "1",
            "1"
          )}

          <div class="qa-actions">
            <button type="submit" id="qaSaveQuestion"
                    class="qa-primary">
              Save Question
            </button>

            <button type="button" id="qaCancelEdit"
                    class="qa-btn">
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section class="qa-card">
        <div style="display:flex;gap:12px;justify-content:space-between;
                    align-items:center;flex-wrap:wrap">
          <h3 style="margin:0">Saved Questions</h3>
          <span id="qaQuestionCount" class="qa-small">0 Questions</span>
        </div>

        <div id="qaQuestionList" style="margin-top:12px">
          <p class="qa-small">প্রথমে একটি Quiz নির্বাচন করো।</p>
        </div>
      </section>
    `;

    return true;
  }

  function fillSelectSlot(slotId, label, selectId, items, selected, placeholder) {
    const slot = el(slotId);
    if (!slot) return;

    slot.innerHTML = makeSelect(
      label,
      selectId,
      items,
      selected,
      placeholder
    );
  }

  async function loadCourses() {
    MODULE.courses = activeItems(
      await readCollection(COLLECTIONS.courses)
    );

    MODULE.courses.sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    fillSelectSlot(
      "qaCourseSlot",
      "Course",
      "qaCourse",
      MODULE.courses,
      MODULE.selectedCourse,
      "Course নির্বাচন করো"
    );

    if (
      !MODULE.selectedCourse ||
      !MODULE.courses.some(function (x) {
        return x.id === MODULE.selectedCourse;
      })
    ) {
      MODULE.selectedCourse =
        MODULE.courses.length ? MODULE.courses[0].id : "";
    }

    el("qaCourse").value = MODULE.selectedCourse;

    if (!MODULE.selectedCourse) {
      resetBelowCourse();
      notify("প্রথমে Admin Panel-এর Courses অংশে Course তৈরি করো.");
      return;
    }

    await loadSubjects();
  }

  function resetBelowCourse() {
    MODULE.subjects = [];
    MODULE.chapters = [];
    MODULE.topics = [];
    MODULE.quizzes = [];
    MODULE.questions = [];

    fillSelectSlot("qaSubjectSlot", "Subject", "qaSubject", [], "", "Subject নির্বাচন করো");
    fillSelectSlot("qaChapterSlot", "Chapter", "qaChapter", [], "", "Chapter নির্বাচন করো");
    fillSelectSlot("qaTopicSlot", "Topic", "qaTopic", [], "", "Topic নির্বাচন করো");
    fillSelectSlot("qaQuizSlot", "Quiz", "qaQuiz", [], "", "Quiz নির্বাচন করো");

    renderQuestions();
  }

  async function loadSubjects() {
    MODULE.selectedSubject = "";
    MODULE.selectedChapter = "";
    MODULE.selectedTopic = "";
    MODULE.selectedQuiz = "";

    MODULE.subjects = activeItems(
      await readCollection("subjects", [
        ["courseId", "==", MODULE.selectedCourse]
      ])
    );

    MODULE.subjects = sortByOrder(MODULE.subjects);

    fillSelectSlot(
      "qaSubjectSlot",
      "Subject",
      "qaSubject",
      MODULE.subjects,
      "",
      "Subject নির্বাচন করো"
    );

    if (MODULE.subjects.length) {
      MODULE.selectedSubject = MODULE.subjects[0].id;
      el("qaSubject").value = MODULE.selectedSubject;
      await loadChapters();
    } else {
      resetBelowSubject();
    }
  }

  function resetBelowSubject() {
    MODULE.chapters = [];
    MODULE.topics = [];
    MODULE.quizzes = [];
    MODULE.questions = [];

    fillSelectSlot("qaChapterSlot", "Chapter", "qaChapter", [], "", "Chapter নির্বাচন করো");
    fillSelectSlot("qaTopicSlot", "Topic", "qaTopic", [], "", "Topic নির্বাচন করো");
    fillSelectSlot("qaQuizSlot", "Quiz", "qaQuiz", [], "", "Quiz নির্বাচন করো");

    renderQuestions();
  }

  async function loadChapters() {
    MODULE.selectedChapter = "";
    MODULE.selectedTopic = "";
    MODULE.selectedQuiz = "";

    MODULE.chapters = activeItems(
      await readCollection("chapters", [
        ["courseId", "==", MODULE.selectedCourse],
        ["subjectId", "==", MODULE.selectedSubject]
      ])
    );

    MODULE.chapters = sortByOrder(MODULE.chapters);

    fillSelectSlot(
      "qaChapterSlot",
      "Chapter",
      "qaChapter",
      MODULE.chapters,
      "",
      "Chapter নির্বাচন করো"
    );

    if (MODULE.chapters.length) {
      MODULE.selectedChapter = MODULE.chapters[0].id;
      el("qaChapter").value = MODULE.selectedChapter;
      await loadTopics();
    } else {
      resetBelowChapter();
    }
  }

  function resetBelowChapter() {
    MODULE.topics = [];
    MODULE.quizzes = [];
    MODULE.questions = [];

    fillSelectSlot("qaTopicSlot", "Topic", "qaTopic", [], "", "Topic নির্বাচন করো");
    fillSelectSlot("qaQuizSlot", "Quiz", "qaQuiz", [], "", "Quiz নির্বাচন করো");

    renderQuestions();
  }

  async function loadTopics() {
    MODULE.selectedTopic = "";
    MODULE.selectedQuiz = "";

    MODULE.topics = activeItems(
      await readCollection("topics", [
        ["courseId", "==", MODULE.selectedCourse],
        ["subjectId", "==", MODULE.selectedSubject],
        ["chapterId", "==", MODULE.selectedChapter]
      ])
    );

    MODULE.topics = sortByOrder(MODULE.topics);

    fillSelectSlot(
      "qaTopicSlot",
      "Topic",
      "qaTopic",
      MODULE.topics,
      "",
      "Topic নির্বাচন করো"
    );

    if (MODULE.topics.length) {
      MODULE.selectedTopic = MODULE.topics[0].id;
      el("qaTopic").value = MODULE.selectedTopic;
      await loadQuizzes();
    } else {
      resetBelowTopic();
    }
  }

  function resetBelowTopic() {
    MODULE.quizzes = [];
    MODULE.questions = [];

    fillSelectSlot("qaQuizSlot", "Quiz", "qaQuiz", [], "", "Quiz নির্বাচন করো");
    renderQuestions();
  }

  async function loadQuizzes() {
    MODULE.selectedQuiz = "";

    MODULE.quizzes = activeItems(
      await readCollection("quizzes", [
        ["courseId", "==", MODULE.selectedCourse],
        ["subjectId", "==", MODULE.selectedSubject],
        ["chapterId", "==", MODULE.selectedChapter],
        ["topicId", "==", MODULE.selectedTopic]
      ])
    );

    MODULE.quizzes = sortByOrder(MODULE.quizzes);

    fillSelectSlot(
      "qaQuizSlot",
      "Quiz",
      "qaQuiz",
      MODULE.quizzes,
      "",
      "Quiz নির্বাচন করো"
    );

    if (MODULE.quizzes.length) {
      MODULE.selectedQuiz = MODULE.quizzes[0].id;
      el("qaQuiz").value = MODULE.selectedQuiz;
      await loadQuestions();
    } else {
      MODULE.questions = [];
      renderQuestions();
      notify("এই Topic-এ Quiz পাওয়া যায়নি। Admin Quizzes অংশে Quiz তৈরি করো।");
    }
  }

  async function loadQuestions() {
    if (!MODULE.selectedQuiz) {
      MODULE.questions = [];
      renderQuestions();
      return;
    }

    if (MODULE.loading) return;

    MODULE.loading = true;

    try {
      MODULE.questions = sortByOrder(
        await readCollection("questions", [
          ["courseId", "==", MODULE.selectedCourse],
          ["subjectId", "==", MODULE.selectedSubject],
          ["chapterId", "==", MODULE.selectedChapter],
          ["topicId", "==", MODULE.selectedTopic],
          ["quizId", "==", MODULE.selectedQuiz]
        ])
      );

      renderQuestions();
    } catch (error) {
      notify(
        "প্রশ্ন লোড করা যায়নি। Firestore Rules ও প্রশ্নের collection পরীক্ষা করো। " +
          (error.message || ""),
        "error"
      );
    } finally {
      MODULE.loading = false;
    }
  }

  function renderQuestions() {
    const root = el("qaQuestionList");
    const count = el("qaQuestionCount");

    if (!root || !count) return;

    count.textContent = MODULE.questions.length + " Questions";

    if (!MODULE.questions.length) {
      root.innerHTML = `
        <p class="qa-small">
          এই Quiz-এ এখনো কোনো প্রশ্ন নেই। “+ New Question” চাপ দিয়ে প্রশ্ন তৈরি করো।
        </p>
      `;
      return;
    }

    root.innerHTML = MODULE.questions.map(function (question, index) {
      const options = Array.isArray(question.options)
        ? question.options
        : [
            question.option1 || "",
            question.option2 || "",
            question.option3 || "",
            question.option4 || ""
          ];

      const correct = String(
        question.correctAnswer || question.correctOption || ""
      );

      const imageURL = question.imageUrl || "";

      return `
        <article class="qa-question">
          <div style="display:flex;justify-content:space-between;
                      gap:10px;align-items:flex-start;flex-wrap:wrap">
            <strong>
              Q${index + 1}. ${escapeHTML(question.questionText || "(Image question)")}
            </strong>

            <span class="qa-small">
              Order: ${escapeHTML(question.order || index + 1)}
            </span>
          </div>

          ${
            imageURL
              ? `<img class="qa-preview"
                      src="${escapeHTML(imageURL)}"
                      alt="Question image">`
              : ""
          }

          <div style="margin-top:10px">
            ${options.map(function (option, optionIndex) {
              const number = String(optionIndex + 1);
              const isCorrect = number === correct;

              return `
                <div class="qa-option ${isCorrect ? "qa-correct" : ""}">
                  ${number}. ${escapeHTML(option)}
                  ${isCorrect ? " ✓ Correct Answer" : ""}
                </div>
              `;
            }).join("")}
          </div>

          ${
            question.solution
              ? `<p class="qa-small">
                   <strong>Solution:</strong>
                   ${escapeHTML(question.solution)}
                 </p>`
              : ""
          }

          ${
            question.ncertReference
              ? `<p class="qa-small">
                   <strong>NCERT:</strong>
                   ${escapeHTML(question.ncertReference)}
                 </p>`
              : ""
          }

          <div class="qa-actions">
            <button type="button"
                    class="qa-btn"
                    data-action="up"
                    data-id="${escapeHTML(question.id)}"
                    ${index === 0 ? "disabled" : ""}>
              ↑ Move Up
            </button>

            <button type="button"
                    class="qa-btn"
                    data-action="down"
                    data-id="${escapeHTML(question.id)}"
                    ${index === MODULE.questions.length - 1 ? "disabled" : ""}>
              ↓ Move Down
            </button>

            <button type="button"
                    class="qa-btn"
                    data-action="edit"
                    data-id="${escapeHTML(question.id)}">
              Edit
            </button>

            <button type="button"
                    class="qa-btn"
                    data-action="delete"
                    data-id="${escapeHTML(question.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function openEditor(question) {
    MODULE.editingId = question ? question.id : null;

    const editor = el("qaEditor");
    if (!editor) return;

    editor.hidden = false;

    el("qaEditorTitle").textContent = question
      ? "Edit Question"
      : "Create Question";

    el("qaQuestionText").value = question
      ? question.questionText || ""
      : "";

    const options = question && Array.isArray(question.options)
      ? question.options
      : question
        ? [
            question.option1 || "",
            question.option2 || "",
            question.option3 || "",
            question.option4 || ""
          ]
        : ["", "", "", ""];

    el("qaOption1").value = options[0] || "";
    el("qaOption2").value = options[1] || "";
    el("qaOption3").value = options[2] || "";
    el("qaOption4").value = options[3] || "";

    el("qaCorrectOption").value = question
      ? String(question.correctAnswer || question.correctOption || "")
      : "";

    el("qaSolution").value = question
      ? question.solution || ""
      : "";

    el("qaNcertReference").value = question
      ? question.ncertReference || ""
      : "";

    el("qaQuestionOrder").value = question
      ? Number(question.order || 1)
      : MODULE.questions.length + 1;

    el("qaQuestionImage").value = "";

    const preview = el("qaImagePreview");
    preview.hidden = !question || !question.imageUrl;

    if (question && question.imageUrl) {
      preview.src = question.imageUrl;
    } else {
      preview.removeAttribute("src");
    }

    editor.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeEditor() {
    MODULE.editingId = null;

    const editor = el("qaEditor");
    if (editor) editor.hidden = true;

    const form = el("qaForm");
    if (form) form.reset();

    const preview = el("qaImagePreview");

    if (preview) {
      preview.hidden = true;
      preview.removeAttribute("src");
    }
  }

  async function uploadQuestionImage(file, questionId) {
    if (!file) return "";

    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      throw new Error("শুধু JPEG, PNG অথবা WebP ছবি ব্যবহার করো।");
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error("ছবির সর্বোচ্চ সাইজ 5 MB হতে পারবে।");
    }

    if (
      !window.firebase ||
      typeof window.firebase.storage !== "function"
    ) {
      throw new Error(
        "Firebase Storage SDK লোড করা নেই। admin.html-এ Storage compat SDK যোগ করতে হবে।"
      );
    }

    const storage = window.firebase.storage();

    const path =
      "question-images/" +
      getCurrentUserId() +
      "/" +
      questionId +
      "/" +
      Date.now() +
      "_" +
      file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

    const reference = storage.ref().child(path);

    await reference.put(file, {
      contentType: file.type
    });

    return await reference.getDownloadURL();
  }

  async function saveQuestion(event) {
    event.preventDefault();

    if (!(await checkAdmin())) return;

    if (!MODULE.selectedCourse ||
        !MODULE.selectedSubject ||
        !MODULE.selectedChapter ||
        !MODULE.selectedTopic ||
        !MODULE.selectedQuiz) {
      notify("প্রথমে Course, Subject, Chapter, Topic ও Quiz নির্বাচন করো।", "error");
      return;
    }

    const questionText = el("qaQuestionText").value.trim();

    const options = [
      el("qaOption1").value.trim(),
      el("qaOption2").value.trim(),
      el("qaOption3").value.trim(),
      el("qaOption4").value.trim()
    ];

    const correctAnswer = el("qaCorrectOption").value;

    const imageFile = el("qaQuestionImage").files[0] || null;

    if (!questionText && !imageFile &&
        !(MODULE.editingId && getExistingImage(MODULE.editingId))) {
      notify("প্রশ্নের Text অথবা Image দিতে হবে।", "error");
      return;
    }

    if (options.some(function (option) {
      return !option;
    })) {
      notify("চারটি Option-ই পূরণ করতে হবে।", "error");
      return;
    }

    if (!["1", "2", "3", "4"].includes(correctAnswer)) {
      notify("সঠিক উত্তর নির্বাচন করো।", "error");
      return;
    }

    const order = Number(el("qaQuestionOrder").value);

    if (!Number.isInteger(order) || order < 1) {
      notify("Question Order 1 বা তার বেশি পূর্ণসংখ্যা হতে হবে।", "error");
      return;
    }

    const saveButton = el("qaSaveQuestion");
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const userId = getCurrentUserId();

      const oldQuestion = MODULE.editingId
        ? MODULE.questions.find(function (q) {
            return q.id === MODULE.editingId;
          })
        : null;

      const questionId = MODULE.editingId ||
        collection("questions").doc().id;

      let imageUrl = oldQuestion ? oldQuestion.imageUrl || "" : "";

      if (imageFile) {
        imageUrl = await uploadQuestionImage(imageFile, questionId);
      }

      const payload = {
        courseId: MODULE.selectedCourse,
        subjectId: MODULE.selectedSubject,
        chapterId: MODULE.selectedChapter,
        topicId: MODULE.selectedTopic,
        quizId: MODULE.selectedQuiz,

        questionText: questionText,
        imageUrl: imageUrl,

        options: options,
        option1: options[0],
        option2: options[1],
        option3: options[2],
        option4: options[3],

        correctAnswer: correctAnswer,
        correctOption: correctAnswer,

        solution: el("qaSolution").value.trim(),
        ncertReference: el("qaNcertReference").value.trim(),

        order: order,
        updatedAt: timestamp(),
        updatedBy: userId
      };

      if (!oldQuestion) {
        payload.createdAt = timestamp();
        payload.createdBy = userId;
      }

      await collection("questions")
        .doc(questionId)
        .set(payload, { merge: true });

      notify(
        oldQuestion
          ? "প্রশ্ন সফলভাবে Update হয়েছে।"
          : "নতুন প্রশ্ন সফলভাবে Save হয়েছে।"
      );

      closeEditor();
      await loadQuestions();
    } catch (error) {
      notify(
        "প্রশ্ন Save করা যায়নি: " +
          (error.message || "অজানা সমস্যা"),
        "error"
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Question";
    }
  }

  function getExistingImage(questionId) {
    const question = MODULE.questions.find(function (item) {
      return item.id === questionId;
    });

    return question ? question.imageUrl || "" : "";
  }

  async function deleteQuestion(questionId) {
    if (!(await checkAdmin())) return;

    const question = MODULE.questions.find(function (item) {
      return item.id === questionId;
    });

    if (!question) return;

    if (!window.confirm("এই প্রশ্নটি স্থায়ীভাবে Delete করবে?")) {
      return;
    }

    try {
      await collection("questions").doc(questionId).delete();

      notify("প্রশ্ন Delete হয়েছে।");
      await loadQuestions();
    } catch (error) {
      notify(
        "প্রশ্ন Delete করা যায়নি: " + (error.message || ""),
        "error"
      );
    }
  }

  async function moveQuestion(questionId, direction) {
    if (!(await checkAdmin())) return;

    const index = MODULE.questions.findIndex(function (item) {
      return item.id === questionId;
    });

    const otherIndex = index + direction;

    if (
      index < 0 ||
      otherIndex < 0 ||
      otherIndex >= MODULE.questions.length
    ) {
      return;
    }

    const current = MODULE.questions[index];
    const other = MODULE.questions[otherIndex];

    try {
      const batch = MODULE.db.batch();

      batch.update(
        collection("questions").doc(current.id),
        {
          order: orderValue(other),
          updatedAt: timestamp(),
          updatedBy: getCurrentUserId()
        }
      );

      batch.update(
        collection("questions").doc(other.id),
        {
          order: orderValue(current),
          updatedAt: timestamp(),
          updatedBy: getCurrentUserId()
        }
      );

      await batch.commit();
      await loadQuestions();

      notify("প্রশ্নের Order পরিবর্তন হয়েছে।");
    } catch (error) {
      notify(
        "Order পরিবর্তন করা যায়নি: " + (error.message || ""),
        "error"
      );
    }
  }

  function setupEvents() {
    el("qaCourse").addEventListener("change", async function () {
      MODULE.selectedCourse = this.value;

      try {
        await loadSubjects();
      } catch (error) {
        notify("Subject লোড করা যায়নি: " + (error.message || ""), "error");
      }
    });

    el("qaSubject").addEventListener("change", async function () {
      MODULE.selectedSubject = this.value;

      try {
        await loadChapters();
      } catch (error) {
        notify("Chapter লোড করা যায়নি: " + (error.message || ""), "error");
      }
    });

    el("qaChapter").addEventListener("change", async function () {
      MODULE.selectedChapter = this.value;

      try {
        await loadTopics();
      } catch (error) {
        notify("Topic লোড করা যায়নি: " + (error.message || ""), "error");
      }
    });

    el("qaTopic").addEventListener("change", async function () {
      MODULE.selectedTopic = this.value;

      try {
        await loadQuizzes();
      } catch (error) {
        notify("Quiz লোড করা যায়নি: " + (error.message || ""), "error");
      }
    });

    el("qaQuiz").addEventListener("change", async function () {
      MODULE.selectedQuiz = this.value;

      try {
        await loadQuestions();
      } catch (error) {
        notify("প্রশ্ন লোড করা যায়নি: " + (error.message || ""), "error");
      }
    });

    el("qaLoadQuestions").addEventListener("click", loadQuestions);

    el("qaNewQuestion").addEventListener("click", async function () {
      if (!(await checkAdmin())) return;

      if (!MODULE.selectedQuiz) {
        notify("প্রথমে একটি Quiz নির্বাচন করো।", "error");
        return;
      }

      openEditor(null);
    });

    el("qaCancelEdit").addEventListener("click", closeEditor);
    el("qaForm").addEventListener("submit", saveQuestion);

    el("qaQuestionList").addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-action]");

      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === "edit") {
        if (!(await checkAdmin())) return;

        const question = MODULE.questions.find(function (item) {
          return item.id === id;
        });

        if (question) openEditor(question);
      }

      if (action === "delete") {
        await deleteQuestion(id);
      }

      if (action === "up") {
        await moveQuestion(id, -1);
      }

      if (action === "down") {
        await moveQuestion(id, 1);
      }
    });

    el("qaQuestionImage").addEventListener("change", function () {
      const file = this.files[0];
      const preview = el("qaImagePreview");

      if (!file) return;

      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
        notify("JPEG, PNG অথবা WebP ছবি নির্বাচন করো।", "error");
        this.value = "";
        return;
      }

      const reader = new FileReader();

      reader.onload = function () {
        preview.src = reader.result;
        preview.hidden = false;
      };

      reader.readAsDataURL(file);
    });

    el("qaRemoveImage").addEventListener("click", function () {
      el("qaQuestionImage").value = "";

      const preview = el("qaImagePreview");
      preview.src = "";
      preview.hidden = true;
    });
  }

  async function initialize() {
    if (MODULE.initializing) return;

    MODULE.initializing = true;

    try {
      if (!createInterface()) return;

      if (!requireFirebase()) return;

      if (!(await checkAdmin())) return;

      setupEvents();
      await loadCourses();

      MODULE.initialized = true;
    } catch (error) {
      notify(
        "Question Management চালু করা যায়নি: " +
          (error.message || "অজানা সমস্যা"),
        "error"
      );
    } finally {
      MODULE.initializing = false;
    }
  }

  function onPageChange(event) {
    if (!event || !event.detail) return;

    if (event.detail.page === "questions") {
      if (!MODULE.initialized) {
        initialize();
      } else {
        checkAdmin().then(function (authorized) {
          if (authorized) loadCourses();
        });
      }
    }
  }

  window.MNEETQuestionsAdmin = {
    initialize: initialize,
    reload: loadQuestions,
    getQuestions: function () {
      return MODULE.questions.slice();
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    initialize();
  });

  document.addEventListener(
    "mneet:admin-page-change",
    onPageChange
  );

})();
