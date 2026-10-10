(function () {
  "use strict";

  /*
   * mNEET Admin Panel
   * File 14: admin-topics.js
   *
   * Structure:
   * Course -> Subject -> Chapter -> Topic
   *
   * Firestore collections:
   * courses
   * subjects
   * chapters
   * topics
   *
   * Theme: Green and White
   */

  if (window.MNEETAdminTopics) {
    return;
  }

  const Topics = {
    initialized: false,
    loading: false,
    saving: false,

    db: null,
    auth: null,

    courses: [],
    subjects: [],
    chapters: [],
    topics: [],

    selectedCourseId: "",
    selectedSubjectId: "",
    selectedChapterId: "",
    editingTopicId: ""
  };

  window.MNEETAdminTopics = Topics;

  const $ = (id) => document.getElementById(id);

  const STYLE_ID = "mneet-topics-styles";


  // ==================================================
  // STYLES — GREEN AND WHITE ONLY
  // ==================================================

  function addStyles() {
    if ($(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      #topicsContent {
        color: #FFFFFF;
      }

      #topicsContent *,
      #topicsContent *::before,
      #topicsContent *::after {
        box-sizing: border-box;
      }

      .mt-card {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 14px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .mt-title {
        color: #FFFFFF;
        font-size: 19px;
        font-weight: 700;
        margin: 0 0 14px;
      }

      .mt-description {
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.6;
        margin: 0 0 16px;
      }

      .mt-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 14px;
      }

      .mt-field {
        display: flex;
        flex-direction: column;
        gap: 7px;
        min-width: 0;
      }

      .mt-field-full {
        grid-column: 1 / -1;
      }

      .mt-field label {
        color: #FFFFFF;
        font-size: 13px;
        font-weight: 600;
      }

      .mt-field input,
      .mt-field textarea,
      .mt-field select {
        width: 100%;
        min-height: 44px;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #FFFFFF;
        padding: 11px;
        font: inherit;
        outline: none;
      }

      .mt-field textarea {
        min-height: 90px;
        resize: vertical;
      }

      .mt-field input:focus,
      .mt-field textarea:focus,
      .mt-field select:focus {
        border-color: #22C55E;
      }

      .mt-field select option {
        background: #0D2419;
        color: #FFFFFF;
      }

      .mt-checkbox-row {
        display: flex;
        align-items: center;
        gap: 10px;
        color: #FFFFFF;
        font-size: 14px;
      }

      .mt-checkbox-row input {
        width: 18px;
        height: 18px;
        accent-color: #16A34A;
      }

      .mt-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
        margin-top: 16px;
      }

      .mt-btn {
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

      .mt-btn:hover {
        background: #22C55E;
      }

      .mt-btn:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .mt-btn-secondary {
        background: transparent;
        border-color: #28513A;
        color: #FFFFFF;
      }

      .mt-btn-secondary:hover {
        background: #10291D;
      }

      .mt-status {
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.6;
        margin: 10px 0;
        overflow-wrap: anywhere;
      }

      .mt-topic-list {
        display: grid;
        gap: 12px;
      }

      .mt-topic-item {
        border: 1px solid #28513A;
        border-radius: 12px;
        padding: 14px;
        background: #10291D;
      }

      .mt-topic-heading {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }

      .mt-topic-name {
        margin: 0;
        color: #FFFFFF;
        font-size: 15px;
        font-weight: 700;
        overflow-wrap: anywhere;
      }

      .mt-topic-meta {
        color: #D1D5DB;
        font-size: 12px;
        line-height: 1.7;
        margin-top: 7px;
        overflow-wrap: anywhere;
      }

      .mt-topic-description {
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.6;
        margin: 10px 0 0;
        overflow-wrap: anywhere;
      }

      .mt-topic-status {
        display: inline-block;
        border: 1px solid #28513A;
        border-radius: 20px;
        padding: 4px 9px;
        color: #FFFFFF;
        font-size: 11px;
        white-space: nowrap;
      }

      .mt-empty {
        padding: 20px 12px;
        border: 1px dashed #28513A;
        border-radius: 10px;
        color: #D1D5DB;
        text-align: center;
        line-height: 1.7;
      }

      .mt-small-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 13px;
      }

      .mt-small-actions .mt-btn {
        min-height: 35px;
        padding: 7px 10px;
      }

      @media (max-width: 600px) {
        .mt-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .mt-card {
          padding: 13px;
        }

        .mt-topic-heading {
          flex-direction: column;
        }

        .mt-actions .mt-btn {
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
    const firebaseState = window.MNEETFirebase;

    if (
      firebaseState &&
      firebaseState.ready === true &&
      firebaseState.db &&
      firebaseState.auth
    ) {
      Topics.db = firebaseState.db;
      Topics.auth = firebaseState.auth;

      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.firestore === "function" &&
      typeof window.firebase.auth === "function"
    ) {
      try {
        Topics.db = window.firebase.firestore();
        Topics.auth = window.firebase.auth();

        return true;
      } catch (error) {
        console.error(
          "mNEET Topics Firebase error:",
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
  // AUTHORIZATION
  // ==================================================

  async function verifyAdmin() {
    if (!Topics.auth || !Topics.db) {
      return false;
    }

    const user = Topics.auth.currentUser;

    if (!user) {
      return false;
    }

    /*
     * Reuse the main Admin authorization function
     * when it is available.
     */

    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized ===
        "function" &&
      window.MNEETAdmin.isAdminAuthorized()
    ) {
      return true;
    }

    try {
      const snapshot = await Topics.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!snapshot.exists) {
        return false;
      }

      const adminData = snapshot.data() || {};

      return adminData.active === true;

    } catch (error) {
      console.error(
        "mNEET Topics authorization error:",
        error
      );

      return false;
    }
  }


  // ==================================================
  // UI HELPERS
  // ==================================================

  function showStatus(message, type) {
    const status = $("topicsStatus");

    if (!status) {
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

    status.textContent = String(message || "");
    status.hidden = false;
  }


  function clearStatus() {
    const status = $("topicsStatus");

    if (status) {
      status.textContent = "";
      status.hidden = true;
    }
  }


  function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }


  function makeField(labelText, input, fullWidth) {
    const wrapper = makeElement(
      "div",
      "mt-field" + (fullWidth ? " mt-field-full" : "")
    );

    const label = makeElement("label", "", labelText);

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

    if (value !== undefined && value !== null) {
      input.value = String(value);
    }

    return input;
  }


  function makeSelect(id) {
    const select = document.createElement("select");

    select.id = id;

    return select;
  }


  function makeOption(value, label) {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = label;

    return option;
  }


  function makeButton(label, className, callback) {
    const button = makeElement(
      "button",
      className || "mt-btn",
      label
    );

    button.type = "button";

    button.addEventListener("click", callback);

    return button;
  }


  function setButtonLoading(button, loading, normalText) {
    if (!button) {
      return;
    }

    button.disabled = Boolean(loading);

    button.textContent = loading
      ? "Please wait…"
      : normalText;
  }


  // ==================================================
  // MAIN UI
  // ==================================================

  function createInterface() {
    const root = $("topicsContent");

    if (!root || root.dataset.topicsReady === "true") {
      return;
    }

    root.dataset.topicsReady = "true";

    root.replaceChildren();

    const heading = makeElement(
      "h2",
      "mt-title",
      "Topic Management"
    );

    const intro = makeElement(
      "p",
      "mt-description",
      "Course, Subject ও Chapter নির্বাচন করে Topic তৈরি, Edit, Delete এবং সাজিয়ে রাখো।"
    );

    const status = makeElement(
      "div",
      "mt-status"
    );

    status.id = "topicsStatus";
    status.hidden = true;
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    const selectorCard = makeElement(
      "section",
      "mt-card"
    );

    selectorCard.appendChild(
      makeElement("h3", "mt-title", "Select Course Structure")
    );

    const selectorGrid = makeElement("div", "mt-grid");

    const courseSelect = makeSelect("topicCourseSelect");
    const subjectSelect = makeSelect("topicSubjectSelect");
    const chapterSelect = makeSelect("topicChapterSelect");

    selectorGrid.append(
      makeField("Course", courseSelect),
      makeField("Subject", subjectSelect),
      makeField("Chapter", chapterSelect)
    );

    selectorCard.appendChild(selectorGrid);

    const formCard = makeElement(
      "section",
      "mt-card"
    );

    formCard.appendChild(
      makeElement("h3", "mt-title", "Topic Details")
    );

    formCard.appendChild(
      makeElement(
        "p",
        "mt-description",
        "Topic-এর নাম, বিবরণ ও ক্রম নির্ধারণ করো।"
      )
    );

    const form = document.createElement("form");

    form.id = "topicForm";

    const grid = makeElement("div", "mt-grid");

    const nameInput = makeInput("topicName", "text");
    nameInput.maxLength = 150;
    nameInput.required = true;
    nameInput.autocomplete = "off";

    const orderInput = makeInput("topicOrder", "number", "1");
    orderInput.min = "1";
    orderInput.step = "1";
    orderInput.required = true;

    const descriptionInput = document.createElement("textarea");
    descriptionInput.id = "topicDescription";
    descriptionInput.maxLength = 3000;
    descriptionInput.rows = 4;

    const activeWrapper = makeElement(
      "label",
      "mt-checkbox-row"
    );

    const activeInput = makeInput("topicActive", "checkbox");
    activeInput.checked = true;

    activeWrapper.append(
      activeInput,
      makeElement("span", "", "Topic Active")
    );

    grid.append(
      makeField("Topic Name", nameInput),
      makeField("Display Order", orderInput),
      makeField("Description", descriptionInput, true),
      makeField("Status", activeWrapper, true)
    );

    const actions = makeElement("div", "mt-actions");

    const saveButton = document.createElement("button");

    saveButton.id = "topicSaveButton";
    saveButton.type = "submit";
    saveButton.className = "mt-btn";
    saveButton.textContent = "Create Topic";

    const cancelButton = makeButton(
      "Cancel Edit",
      "mt-btn mt-btn-secondary",
      resetForm
    );

    cancelButton.id = "topicCancelButton";
    cancelButton.hidden = true;

    actions.append(saveButton, cancelButton);

    form.append(grid, actions);

    form.addEventListener("submit", saveTopic);

    formCard.appendChild(form);

    const listCard = makeElement(
      "section",
      "mt-card"
    );

    listCard.appendChild(
      makeElement("h3", "mt-title", "Topics")
    );

    listCard.appendChild(
      makeElement(
        "p",
        "mt-description",
        "নির্বাচিত Chapter-এর Topics এখানে দেখা যাবে।"
      )
    );

    const list = makeElement("div", "mt-topic-list");

    list.id = "topicList";

    listCard.appendChild(list);

    root.append(
      heading,
      intro,
      status,
      selectorCard,
      formCard,
      listCard
    );

    courseSelect.addEventListener("change", async function () {
      Topics.selectedCourseId = courseSelect.value;
      Topics.selectedSubjectId = "";
      Topics.selectedChapterId = "";

      await loadSubjects();
    });

    subjectSelect.addEventListener("change", async function () {
      Topics.selectedSubjectId = subjectSelect.value;
      Topics.selectedChapterId = "";

      await loadChapters();
    });

    chapterSelect.addEventListener("change", async function () {
      Topics.selectedChapterId = chapterSelect.value;

      resetForm();

      await loadTopics();
    });
  }


  // ==================================================
  // SELECT OPTIONS
  // ==================================================

  function fillSelect(select, items, placeholder, getName) {
    if (!select) {
      return;
    }

    select.replaceChildren();

    select.appendChild(
      makeOption("", placeholder)
    );

    items.forEach(function (item) {
      const option = makeOption(
        item.id,
        getName(item)
      );

      select.appendChild(option);
    });
  }


  // ==================================================
  // LOAD COURSES
  // ==================================================

  async function loadCourses() {
    if (!Topics.db) {
      return;
    }

    const select = $("topicCourseSelect");

    if (!select) {
      return;
    }

    select.disabled = true;

    try {
      const snapshot = await Topics.db
        .collection("courses")
        .get();

      Topics.courses = snapshot.docs
        .map(function (document) {
          return {
            id: document.id,
            ...document.data()
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
        Topics.courses,
        "Select Course",
        function (course) {
          return String(
            course.name ||
            course.title ||
            course.id
          );
        }
      );

      const activeCourseId =
        window.MNEETAdmin &&
        typeof window.MNEETAdmin.getActiveCourse ===
          "function"
          ? window.MNEETAdmin.getActiveCourse()
          : "all";

      if (
        activeCourseId &&
        activeCourseId !== "all" &&
        Topics.courses.some(function (course) {
          return course.id === activeCourseId;
        })
      ) {
        select.value = activeCourseId;
      }

      Topics.selectedCourseId = select.value;

      if (Topics.selectedCourseId) {
        await loadSubjects();
      } else {
        resetDependentSelectors();
      }

    } catch (error) {
      console.error(
        "mNEET Topics: could not load courses:",
        error
      );

      showStatus(
        "Course লোড করা যায়নি। Firestore Security Rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      select.disabled = false;
    }
  }


  // ==================================================
  // LOAD SUBJECTS
  // ==================================================

  async function loadSubjects() {
    const select = $("topicSubjectSelect");

    if (!select || !Topics.db) {
      return;
    }

    select.disabled = true;

    fillSelect(
      select,
      [],
      "Loading Subjects",
      function (item) {
        return item.name;
      }
    );

    try {
      if (!Topics.selectedCourseId) {
        Topics.subjects = [];
        Topics.selectedSubjectId = "";

        await loadChapters();

        return;
      }

      const snapshot = await Topics.db
        .collection("subjects")
        .where(
          "courseId",
          "==",
          Topics.selectedCourseId
        )
        .get();

      Topics.subjects = snapshot.docs
        .map(function (document) {
          return {
            id: document.id,
            ...document.data()
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
        Topics.subjects,
        "Select Subject",
        function (subject) {
          return String(
            subject.name ||
            subject.title ||
            subject.id
          );
        }
      );

      Topics.selectedSubjectId = select.value;

      await loadChapters();

    } catch (error) {
      console.error(
        "mNEET Topics: could not load subjects:",
        error
      );

      showStatus(
        "Subject লোড করা যায়নি। Subject-এর courseId পরীক্ষা করো।",
        "error"
      );

    } finally {
      select.disabled = false;
    }
  }


  // ==================================================
  // LOAD CHAPTERS
  // ==================================================

  async function loadChapters() {
    const select = $("topicChapterSelect");

    if (!select || !Topics.db) {
      return;
    }

    select.disabled = true;

    try {
      if (
        !Topics.selectedCourseId ||
        !Topics.selectedSubjectId
      ) {
        Topics.chapters = [];
        Topics.selectedChapterId = "";

        fillSelect(
          select,
          [],
          "Select Subject First",
          function (chapter) {
            return chapter.name;
          }
        );

        await loadTopics();

        return;
      }

      const snapshot = await Topics.db
        .collection("chapters")
        .where(
          "courseId",
          "==",
          Topics.selectedCourseId
        )
        .where(
          "subjectId",
          "==",
          Topics.selectedSubjectId
        )
        .get();

      Topics.chapters = snapshot.docs
        .map(function (document) {
          return {
            id: document.id,
            ...document.data()
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
        Topics.chapters,
        "Select Chapter",
        function (chapter) {
          return String(
            chapter.name ||
            chapter.title ||
            chapter.id
          );
        }
      );

      Topics.selectedChapterId = select.value;

      await loadTopics();

    } catch (error) {
      console.error(
        "mNEET Topics: could not load chapters:",
        error
      );

      showStatus(
        "Chapter লোড করা যায়নি। Chapter-এর courseId ও subjectId পরীক্ষা করো।",
        "error"
      );

    } finally {
      select.disabled = false;
    }
  }


  function resetDependentSelectors() {
    Topics.selectedSubjectId = "";
    Topics.selectedChapterId = "";

    fillSelect(
      $("topicSubjectSelect"),
      [],
      "Select Course First",
      function (item) {
        return item.name;
      }
    );

    fillSelect(
      $("topicChapterSelect"),
      [],
      "Select Subject First",
      function (item) {
        return item.name;
      }
    );

    renderTopicList([]);
  }


  // ==================================================
  // LOAD TOPICS
  // ==================================================

  async function loadTopics() {
    if (!Topics.db) {
      return;
    }

    const list = $("topicList");

    if (!list) {
      return;
    }

    if (!Topics.selectedChapterId) {
      Topics.topics = [];

      renderTopicList([]);

      return;
    }

    if (Topics.loading) {
      return;
    }

    Topics.loading = true;

    list.replaceChildren(
      makeElement(
        "div",
        "mt-empty",
        "Loading Topics…"
      )
    );

    try {
      const snapshot = await Topics.db
        .collection("topics")
        .where(
          "courseId",
          "==",
          Topics.selectedCourseId
        )
        .where(
          "subjectId",
          "==",
          Topics.selectedSubjectId
        )
        .where(
          "chapterId",
          "==",
          Topics.selectedChapterId
        )
        .get();

      Topics.topics = snapshot.docs
        .map(function (document) {
          return {
            id: document.id,
            ...document.data()
          };
        })
        .sort(function (a, b) {
          const orderDifference =
            Number(a.order || 0) -
            Number(b.order || 0);

          if (orderDifference !== 0) {
            return orderDifference;
          }

          return String(a.name || "")
            .localeCompare(String(b.name || ""));
        });

      renderTopicList(Topics.topics);

    } catch (error) {
      console.error(
        "mNEET Topics: could not load topics:",
        error
      );

      list.replaceChildren(
        makeElement(
          "div",
          "mt-empty",
          "Topics লোড করা যায়নি। Firestore Security Rules ও collection fields পরীক্ষা করো।"
        )
      );

    } finally {
      Topics.loading = false;
    }
  }


  // ==================================================
  // RENDER TOPIC LIST
  // ==================================================

  function renderTopicList(topics) {
    const list = $("topicList");

    if (!list) {
      return;
    }

    list.replaceChildren();

    if (!Topics.selectedChapterId) {
      list.appendChild(
        makeElement(
          "div",
          "mt-empty",
          "প্রথমে Course, Subject ও Chapter নির্বাচন করো।"
        )
      );

      return;
    }

    if (!topics.length) {
      list.appendChild(
        makeElement(
          "div",
          "mt-empty",
          "এই Chapter-এ এখনো কোনো Topic নেই। উপরের Form ব্যবহার করে Topic তৈরি করো।"
        )
      );

      return;
    }

    topics.forEach(function (topic, index) {
      const card = makeElement(
        "article",
        "mt-topic-item"
      );

      const heading = makeElement(
        "div",
        "mt-topic-heading"
      );

      const title = makeElement(
        "h4",
        "mt-topic-name",
        String(
          topic.order || index + 1
        ) + ". " + String(
          topic.name || "Untitled Topic"
        )
      );

      const status = makeElement(
        "span",
        "mt-topic-status",
        topic.active === false
          ? "Inactive"
          : "Active"
      );

      heading.append(title, status);

      const meta = makeElement(
        "div",
        "mt-topic-meta",
        "Order: " + String(topic.order || index + 1)
      );

      card.append(heading, meta);

      if (topic.description) {
        card.appendChild(
          makeElement(
            "p",
            "mt-topic-description",
            topic.description
          )
        );
      }

      const actions = makeElement(
        "div",
        "mt-small-actions"
      );

      actions.appendChild(
        makeButton(
          "Edit",
          "mt-btn",
          function () {
            editTopic(topic.id);
          }
        )
      );

      if (index > 0) {
        actions.appendChild(
          makeButton(
            "Move Up",
            "mt-btn mt-btn-secondary",
            function () {
              moveTopic(topic.id, -1);
            }
          )
        );
      }

      if (index < topics.length - 1) {
        actions.appendChild(
          makeButton(
            "Move Down",
            "mt-btn mt-btn-secondary",
            function () {
              moveTopic(topic.id, 1);
            }
          )
        );
      }

      actions.appendChild(
        makeButton(
          topic.active === false
            ? "Activate"
            : "Deactivate",
          "mt-btn mt-btn-secondary",
          function () {
            toggleTopicStatus(topic);
          }
        )
      );

      actions.appendChild(
        makeButton(
          "Delete",
          "mt-btn mt-btn-secondary",
          function () {
            deleteTopic(topic);
          }
        )
      );

      card.appendChild(actions);

      list.appendChild(card);
    });
  }


  // ==================================================
  // VALIDATION
  // ==================================================

  function validateTopicForm() {
    const name = $("topicName").value.trim();
    const order = Number($("topicOrder").value);

    if (!Topics.selectedCourseId) {
      showStatus(
        "প্রথমে Course নির্বাচন করো।",
        "error"
      );

      return false;
    }

    if (!Topics.selectedSubjectId) {
      showStatus(
        "প্রথমে Subject নির্বাচন করো।",
        "error"
      );

      return false;
    }

    if (!Topics.selectedChapterId) {
      showStatus(
        "প্রথমে Chapter নির্বাচন করো।",
        "error"
      );

      return false;
    }

    if (!name) {
      showStatus(
        "Topic Name লিখতে হবে।",
        "error"
      );

      return false;
    }

    if (!Number.isInteger(order) || order < 1) {
      showStatus(
        "Order অবশ্যই 1 বা তার বেশি পূর্ণসংখ্যা হতে হবে।",
        "error"
      );

      return false;
    }

    const duplicate = Topics.topics.some(function (topic) {
      return (
        topic.id !== Topics.editingTopicId &&
        String(topic.name || "").trim().toLowerCase() ===
          name.toLowerCase()
      );
    });

    if (duplicate) {
      showStatus(
        "এই Chapter-এ একই নামে Topic আগে থেকেই রয়েছে।",
        "error"
      );

      return false;
    }

    return true;
  }


  // ==================================================
  // CREATE / UPDATE TOPIC
  // ==================================================

  async function saveTopic(event) {
    event.preventDefault();

    clearStatus();

    if (Topics.saving) {
      return;
    }

    const authorized = await verifyAdmin();

    if (!authorized) {
      showStatus(
        "Topic পরিবর্তনের জন্য Admin authorization প্রয়োজন।",
        "error"
      );

      return;
    }

    if (!validateTopicForm()) {
      return;
    }

    const user = Topics.auth.currentUser;

    const name = $("topicName").value.trim();

    const description =
      $("topicDescription").value.trim();

    const order = Number(
      $("topicOrder").value
    );

    const active = $("topicActive").checked;

    const saveButton = $("topicSaveButton");

    const normalButtonText = Topics.editingTopicId
      ? "Update Topic"
      : "Create Topic";

    Topics.saving = true;

    setButtonLoading(
      saveButton,
      true,
      normalButtonText
    );

    try {
      const payload = {
        courseId: Topics.selectedCourseId,
        subjectId: Topics.selectedSubjectId,
        chapterId: Topics.selectedChapterId,

        name: name,
        description: description,
        order: order,
        active: active,

        updatedAt:
          window.firebase.firestore.FieldValue.serverTimestamp(),

        updatedBy: user.uid
      };

      if (Topics.editingTopicId) {
        await Topics.db
          .collection("topics")
          .doc(Topics.editingTopicId)
          .update(payload);

        showStatus(
          "Topic সফলভাবে Update হয়েছে।",
          "success"
        );

      } else {
        payload.createdAt =
          window.firebase.firestore.FieldValue.serverTimestamp();

        payload.createdBy = user.uid;

        await Topics.db
          .collection("topics")
          .add(payload);

        showStatus(
          "Topic সফলভাবে তৈরি হয়েছে।",
          "success"
        );
      }

      resetForm();

      await loadTopics();

      if (
        window.MNEETAdmin &&
        typeof window.MNEETAdmin.refreshDashboard ===
          "function"
      ) {
        window.MNEETAdmin.refreshDashboard();
      }

    } catch (error) {
      console.error(
        "mNEET Topics: save error:",
        error
      );

      showStatus(
        error.code === "permission-denied"
          ? "Firestore Rules Topic Save করতে অনুমতি দেয়নি।"
          : "Topic Save করা যায়নি। Internet ও Firebase পরীক্ষা করো।",
        "error"
      );

    } finally {
      Topics.saving = false;

      setButtonLoading(
        saveButton,
        false,
        normalButtonText
      );
    }
  }


  // ==================================================
  // EDIT TOPIC
  // ==================================================

  function editTopic(topicId) {
    const topic = Topics.topics.find(function (item) {
      return item.id === topicId;
    });

    if (!topic) {
      showStatus(
        "Topic পাওয়া যায়নি। আবার Load করো।",
        "error"
      );

      return;
    }

    Topics.editingTopicId = topic.id;

    $("topicName").value = topic.name || "";

    $("topicDescription").value =
      topic.description || "";

    $("topicOrder").value =
      Number(topic.order || 1);

    $("topicActive").checked =
      topic.active !== false;

    $("topicSaveButton").textContent =
      "Update Topic";

    $("topicCancelButton").hidden = false;

    $("topicName").focus();

    showStatus(
      "Edit mode: " + topic.name,
      "success"
    );

    const root = $("topicsContent");

    if (root) {
      root.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }


  // ==================================================
  // RESET FORM
  // ==================================================

  function resetForm() {
    const form = $("topicForm");

    if (!form) {
      return;
    }

    form.reset();

    Topics.editingTopicId = "";

    $("topicOrder").value =
      String(Topics.topics.length + 1);

    $("topicActive").checked = true;

    $("topicSaveButton").textContent =
      "Create Topic";

    $("topicCancelButton").hidden = true;
  }


  // ==================================================
  // DELETE TOPIC
  // ==================================================

  async function deleteTopic(topic) {
    const confirmed = window.confirm(
      'তুমি কি "' +
      String(topic.name || "এই Topic") +
      '" Delete করতে চাও? সংশ্লিষ্ট Quiz বা Notes আলাদাভাবে যাচাই করতে হবে।'
    );

    if (!confirmed) {
      return;
    }

    const authorized = await verifyAdmin();

    if (!authorized) {
      showStatus(
        "Topic Delete করার জন্য Admin authorization প্রয়োজন।",
        "error"
      );

      return;
    }

    try {
      await Topics.db
        .collection("topics")
        .doc(topic.id)
        .delete();

      if (Topics.editingTopicId === topic.id) {
        resetForm();
      }

      showStatus(
        "Topic Delete হয়েছে। সংশ্লিষ্ট Quiz ও Notes স্বয়ংক্রিয়ভাবে Delete হয়নি।",
        "success"
      );

      await loadTopics();

      if (
        window.MNEETAdmin &&
        typeof window.MNEETAdmin.refreshDashboard ===
          "function"
      ) {
        window.MNEETAdmin.refreshDashboard();
      }

    } catch (error) {
      console.error(
        "mNEET Topics: delete error:",
        error
      );

      showStatus(
        error.code === "permission-denied"
          ? "Firestore Rules Delete করার অনুমতি দেয়নি।"
          : "Topic Delete করা যায়নি। Firebase পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // ACTIVATE / DEACTIVATE
  // ==================================================

  async function toggleTopicStatus(topic) {
    const authorized = await verifyAdmin();

    if (!authorized) {
      showStatus(
        "Topic Status পরিবর্তনের জন্য Admin authorization প্রয়োজন।",
        "error"
      );

      return;
    }

    try {
      await Topics.db
        .collection("topics")
        .doc(topic.id)
        .update({
          active: topic.active === false,
          updatedAt:
            window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: Topics.auth.currentUser.uid
        });

      showStatus(
        "Topic Status Update হয়েছে।",
        "success"
      );

      await loadTopics();

    } catch (error) {
      console.error(
        "mNEET Topics: status update error:",
        error
      );

      showStatus(
        "Topic Status পরিবর্তন করা যায়নি। Firestore Rules পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // MOVE TOPIC UP / DOWN
  // ==================================================

  async function moveTopic(topicId, direction) {
    const authorized = await verifyAdmin();

    if (!authorized) {
      showStatus(
        "Topic Order পরিবর্তনের জন্য Admin authorization প্রয়োজন।",
        "error"
      );

      return;
    }

    const sorted = Topics.topics
      .slice()
      .sort(function (a, b) {
        return Number(a.order || 0) -
          Number(b.order || 0);
      });

    const currentIndex = sorted.findIndex(
      function (topic) {
        return topic.id === topicId;
      }
    );

    const targetIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= sorted.length
    ) {
      return;
    }

    const current = sorted[currentIndex];
    const target = sorted[targetIndex];

    const currentOrder = Number(
      current.order || currentIndex + 1
    );

    const targetOrder = Number(
      target.order || targetIndex + 1
    );

    try {
      const batch = Topics.db.batch();

      batch.update(
        Topics.db.collection("topics").doc(current.id),
        {
          order: targetOrder,
          updatedAt:
            window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: Topics.auth.currentUser.uid
        }
      );

      batch.update(
        Topics.db.collection("topics").doc(target.id),
        {
          order: currentOrder,
          updatedAt:
            window.firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: Topics.auth.currentUser.uid
        }
      );

      await batch.commit();

      showStatus(
        "Topic Order পরিবর্তন হয়েছে।",
        "success"
      );

      await loadTopics();

    } catch (error) {
      console.error(
        "mNEET Topics: reorder error:",
        error
      );

      showStatus(
        "Topic Order পরিবর্তন করা যায়নি। Firebase Rules পরীক্ষা করো।",
        "error"
      );
    }
  }


  // ==================================================
  // INITIALIZATION
  // ==================================================

  async function initialize() {
    if (Topics.initialized) {
      return;
    }

    const root = $("topicsContent");

    if (!root) {
      return;
    }

    Topics.initialized = true;

    addStyles();
    createInterface();

    if (!initializeFirebase()) {
      return;
    }

    const authorized = await verifyAdmin();

    if (!authorized) {
      showStatus(
        "Admin authorization যাচাই করা হচ্ছে। Login করা Admin account ব্যবহার করো।"
      );

      /*
       * Wait for the main Admin module to confirm
       * authorization, then load the Course list.
       */

      return;
    }

    await loadCourses();
  }


  // ==================================================
  // RETRY AFTER AUTHORIZATION
  // ==================================================

  async function retryInitialization() {
    if (!Topics.initialized) {
      await initialize();
      return;
    }

    if (!Topics.db || !Topics.auth) {
      if (!initializeFirebase()) {
        return;
      }
    }

    if (!await verifyAdmin()) {
      return;
    }

    if (!Topics.courses.length) {
      await loadCourses();
    }
  }


  // ==================================================
  // ADMIN NAVIGATION INTEGRATION
  // ==================================================

  document.addEventListener(
    "mneet:admin-page-change",
    function (event) {
      const page = event.detail &&
        event.detail.page;

      if (page !== "topics") {
        return;
      }

      retryInitialization();
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

      const select = $("topicCourseSelect");

      if (!select) {
        return;
      }

      const exists = Array.from(
        select.options
      ).some(function (option) {
        return option.value === courseId;
      });

      if (exists) {
        select.value = courseId;

        Topics.selectedCourseId = courseId;
        Topics.selectedSubjectId = "";
        Topics.selectedChapterId = "";

        loadSubjects();
      }
    }
  );


  // ==================================================
  // PUBLIC API
  // ==================================================

  Topics.loadCourses = loadCourses;
  Topics.loadSubjects = loadSubjects;
  Topics.loadChapters = loadChapters;
  Topics.loadTopics = loadTopics;

  Topics.createInterface = createInterface;
  Topics.initialize = initialize;

  Topics.getSelectedCourse = function () {
    return Topics.selectedCourseId;
  };

  Topics.getSelectedSubject = function () {
    return Topics.selectedSubjectId;
  };

  Topics.getSelectedChapter = function () {
    return Topics.selectedChapterId;
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
