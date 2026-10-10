(function () {
  "use strict";

  if (window.MNEETAdminSubjects) return;

  const Subjects = {
    initialized: false,
    db: null,
    auth: null,
    items: [],
    courses: [],
    editingId: null,
    loading: false,
    saving: false
  };

  window.MNEETAdminSubjects = Subjects;

  const $ = (id) => document.getElementById(id);

  function showMessage(message, type) {
    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.showMessage === "function"
    ) {
      window.MNEETAdmin.showMessage(message, type || "warning");
      return;
    }

    const box = $("adminMessage");

    if (box) {
      box.textContent = message;
      box.className = "admin-message show " + (type || "warning");
      box.setAttribute("role", "status");
    }
  }

  function getFirebaseServices() {
    const wrapper = window.MNEETFirebase;

    if (wrapper && wrapper.ready) {
      Subjects.db = wrapper.db;
      Subjects.auth = wrapper.auth;
      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      Subjects.auth = window.firebase.auth();
      Subjects.db = window.firebase.firestore();
      return true;
    }

    showMessage("Firebase সংযোগ পাওয়া যায়নি।", "error");
    return false;
  }

  function isAdminAuthorized() {
    return Boolean(
      Subjects.auth &&
      Subjects.auth.currentUser &&
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized === "function" &&
      window.MNEETAdmin.isAdminAuthorized()
    );
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }

  function getSelectedCourseId() {
    const selector = $("subjectCourseFilter");

    if (selector && selector.value) {
      return selector.value;
    }

    const dashboardSelector = $("dashboardCourseSelect");

    if (dashboardSelector && dashboardSelector.value) {
      return dashboardSelector.value;
    }

    return "";
  }

  function getCourseName(courseId) {
    const course = Subjects.courses.find(
      (item) => item.id === courseId
    );

    return course ? course.name : "Unknown Course";
  }

  function renderLayout() {
    const container = $("subjectsContent");

    if (!container) return;

    container.innerHTML = `
      <section class="mneet-subject-management">

        <header class="subject-heading">
          <div>
            <h2>Subject Management</h2>
            <p>
              Course অনুযায়ী Subject তৈরি, Edit, Delete এবং সাজিয়ে রাখো।
            </p>
          </div>

          <button
            type="button"
            id="createSubjectButton"
            class="subject-primary-button">
            + Add Subject
          </button>
        </header>

        <section class="subject-panel">
          <label for="subjectCourseFilter">Select Course</label>

          <select id="subjectCourseFilter">
            <option value="">Loading Courses...</option>
          </select>

          <p id="subjectCourseHelp">
            প্রথমে একটি Course নির্বাচন করো।
          </p>
        </section>

        <section
          id="subjectEditorPanel"
          class="subject-panel"
          hidden>

          <h3 id="subjectEditorTitle">Create Subject</h3>

          <form id="adminSubjectForm" novalidate>

            <div class="subject-form-group">
              <label for="subjectName">Subject Name *</label>

              <input
                type="text"
                id="subjectName"
                maxlength="120"
                required
                placeholder="যেমন: Biology">
            </div>

            <div class="subject-form-group">
              <label for="subjectDescription">
                Subject Description
              </label>

              <textarea
                id="subjectDescription"
                rows="3"
                maxlength="3000"
                placeholder="Subject সম্পর্কে লিখো"></textarea>
            </div>

            <div class="subject-form-group">
              <label for="subjectOrder">Display Order *</label>

              <input
                type="number"
                id="subjectOrder"
                min="1"
                step="1"
                required
                value="1">

              <small>
                কম Order-এর Subject আগে দেখানো হবে।
              </small>
            </div>

            <div class="subject-form-group">
              <label class="subject-checkbox-label">
                <input
                  type="checkbox"
                  id="subjectActive"
                  checked>

                <span>Subject Active</span>
              </label>
            </div>

            <div class="subject-actions">
              <button
                type="submit"
                id="saveSubjectButton"
                class="subject-primary-button">
                Save Subject
              </button>

              <button
                type="button"
                id="cancelSubjectButton"
                class="subject-secondary-button">
                Cancel
              </button>
            </div>

          </form>
        </section>

        <section class="subject-panel">
          <header class="subject-list-heading">
            <div>
              <h3>Subjects</h3>
              <p id="subjectListSummary">Select a course to continue.</p>
            </div>

            <button
              type="button"
              id="refreshSubjectsButton"
              class="subject-secondary-button">
              Refresh
            </button>
          </header>

          <div id="subjectListMessage" role="status"></div>

          <div id="adminSubjectsList">
            <p>Select a course to view its subjects.</p>
          </div>
        </section>

      </section>
    `;

    addStyles();
    setupEvents();
  }

  function addStyles() {
    if ($("mneetSubjectStyles")) return;

    const style = document.createElement("style");
    style.id = "mneetSubjectStyles";

    style.textContent = `
      .mneet-subject-management {
        display: grid;
        gap: 18px;
        color: #FFFFFF;
      }

      .mneet-subject-management .subject-heading,
      .mneet-subject-management .subject-list-heading {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
      }

      .mneet-subject-management h2,
      .mneet-subject-management h3,
      .mneet-subject-management h4 {
        color: #FFFFFF;
        margin-top: 0;
      }

      .mneet-subject-management p,
      .mneet-subject-management small {
        color: #D1D5DB;
        line-height: 1.6;
      }

      .mneet-subject-management .subject-panel {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 14px;
        padding: 18px;
        min-width: 0;
      }

      .mneet-subject-management .subject-form-group {
        display: grid;
        gap: 8px;
        margin-bottom: 16px;
      }

      .mneet-subject-management label {
        color: #FFFFFF;
        font-weight: 600;
      }

      .mneet-subject-management input:not([type="checkbox"]),
      .mneet-subject-management textarea,
      .mneet-subject-management select {
        width: 100%;
        box-sizing: border-box;
        padding: 12px;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #FFFFFF;
        font: inherit;
      }

      .mneet-subject-management input:focus,
      .mneet-subject-management textarea:focus,
      .mneet-subject-management select:focus {
        outline: 2px solid #22C55E;
        outline-offset: 2px;
      }

      .mneet-subject-management .subject-checkbox-label {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .mneet-subject-management input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #16A34A;
      }

      .mneet-subject-management .subject-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .mneet-subject-management .subject-primary-button,
      .mneet-subject-management .subject-secondary-button {
        border-radius: 9px;
        padding: 10px 14px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .mneet-subject-management .subject-primary-button {
        background: #16A34A;
        border: 1px solid #22C55E;
        color: #FFFFFF;
      }

      .mneet-subject-management .subject-secondary-button {
        background: #10291D;
        border: 1px solid #28513A;
        color: #FFFFFF;
      }

      .mneet-subject-management button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .mneet-subject-management .subject-list {
        display: grid;
        gap: 12px;
        margin-top: 14px;
      }

      .mneet-subject-management .subject-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 14px;
        background: #071A12;
        border: 1px solid #28513A;
        border-radius: 12px;
        padding: 14px;
      }

      .mneet-subject-management .subject-order {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 40px;
        height: 40px;
        background: #10291D;
        border: 1px solid #28513A;
        border-radius: 10px;
        color: #22C55E;
        font-weight: 800;
      }

      .mneet-subject-management .subject-item h4 {
        margin-bottom: 6px;
        overflow-wrap: anywhere;
      }

      .mneet-subject-management .subject-status {
        display: inline-block;
        padding: 4px 8px;
        border: 1px solid #28513A;
        border-radius: 8px;
        color: #FFFFFF;
        background: #10291D;
        font-size: 0.85rem;
      }

      .mneet-subject-management .subject-item-actions {
        display: flex;
        gap: 7px;
        flex-wrap: wrap;
      }

      .mneet-subject-management .subject-empty {
        padding: 20px;
        text-align: center;
        border: 1px dashed #28513A;
        border-radius: 12px;
        color: #D1D5DB;
      }

      @media (max-width: 650px) {
        .mneet-subject-management .subject-item {
          grid-template-columns: auto minmax(0, 1fr);
        }

        .mneet-subject-management .subject-item-actions {
          grid-column: 1 / -1;
        }

        .mneet-subject-management .subject-panel {
          padding: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function setupEvents() {
    $("createSubjectButton").addEventListener("click", function () {
      if (!getSelectedCourseId()) {
        showMessage("প্রথমে একটি Course নির্বাচন করো।", "warning");
        return;
      }

      resetForm();

      $("subjectEditorPanel").hidden = false;
      $("subjectEditorPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      $("subjectName").focus();
    });

    $("cancelSubjectButton").addEventListener("click", function () {
      resetForm();
      $("subjectEditorPanel").hidden = true;
    });

    $("adminSubjectForm").addEventListener("submit", saveSubject);

    $("refreshSubjectsButton").addEventListener("click", loadSubjects);

    $("subjectCourseFilter").addEventListener("change", function () {
      resetForm();
      $("subjectEditorPanel").hidden = true;
      loadSubjects();
    });

    $("adminSubjectsList").addEventListener("click", handleSubjectAction);
  }

  async function loadCourses() {
    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    try {
      const snapshot = await Subjects.db.collection("courses").get();

      Subjects.courses = snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });

      const selector = $("subjectCourseFilter");
      if (!selector) return;

      const previous = selector.value;

      selector.replaceChildren();

      const availableCourses = Subjects.courses
        .filter(function (course) {
          return course.active !== false && course.published !== false;
        })
        .sort(function (a, b) {
          return String(a.name || "").localeCompare(String(b.name || ""));
        });

      if (!availableCourses.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No Active Courses";
        selector.appendChild(option);

        $("adminSubjectsList").innerHTML = `
          <div class="subject-empty">
            <p>কোনো Active Course পাওয়া যায়নি। আগে Course তৈরি করো।</p>
          </div>
        `;

        $("subjectListSummary").textContent = "No active courses.";
        return;
      }

      availableCourses.forEach(function (course) {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name || "Untitled Course";
        selector.appendChild(option);
      });

      if (availableCourses.some((course) => course.id === previous)) {
        selector.value = previous;
      } else {
        const dashboardCourseId = getDashboardCourseId();

        if (
          dashboardCourseId &&
          availableCourses.some((course) => course.id === dashboardCourseId)
        ) {
          selector.value = dashboardCourseId;
        } else {
          selector.selectedIndex = 0;
        }
      }

      await loadSubjects();
    } catch (error) {
      console.error("mNEET load courses error:", error);

      showMessage(
        error && error.code === "permission-denied"
          ? "Firestore Rules Course list পড়তে অনুমতি দিচ্ছে না।"
          : "Course list load করা যায়নি।",
        "error"
      );
    }
  }

  function getDashboardCourseId() {
    const selector = $("dashboardCourseSelect");

    if (selector && selector.value && selector.value !== "all") {
      return selector.value;
    }

    return "";
  }

  function resetForm() {
    const form = $("adminSubjectForm");

    if (form) form.reset();

    Subjects.editingId = null;

    if ($("subjectEditorTitle")) {
      $("subjectEditorTitle").textContent = "Create Subject";
    }

    if ($("saveSubjectButton")) {
      $("saveSubjectButton").textContent = "Save Subject";
      $("saveSubjectButton").disabled = false;
    }

    const courseId = getSelectedCourseId();

    const courseSubjects = Subjects.items.filter(function (subject) {
      return subject.courseId === courseId;
    });

    $("subjectOrder").value = String(courseSubjects.length + 1);
    $("subjectActive").checked = true;
  }

  function getFormData() {
    return {
      courseId: getSelectedCourseId(),
      name: $("subjectName").value.trim(),
      description: $("subjectDescription").value.trim(),
      order: Number($("subjectOrder").value),
      active: $("subjectActive").checked
    };
  }

  function validateSubject(data) {
    if (!data.courseId) {
      showMessage("একটি Course নির্বাচন করো।", "warning");
      return false;
    }

    if (!data.name || data.name.length < 2) {
      showMessage(
        "Subject Name কমপক্ষে ২ অক্ষরের হতে হবে।",
        "warning"
      );
      return false;
    }

    if (data.name.length > 120) {
      showMessage(
        "Subject Name ১২০ অক্ষরের বেশি হতে পারবে না।",
        "warning"
      );
      return false;
    }

    if (data.description.length > 3000) {
      showMessage(
        "Subject Description সর্বোচ্চ ৩০০০ অক্ষর হতে পারবে।",
        "warning"
      );
      return false;
    }

    if (
      !Number.isInteger(data.order) ||
      data.order < 1 ||
      data.order > 10000
    ) {
      showMessage(
        "Display Order ১ থেকে ১০০০০-এর মধ্যে পূর্ণসংখ্যা হতে হবে।",
        "warning"
      );
      return false;
    }

    const duplicate = Subjects.items.some(function (subject) {
      return (
        subject.id !== Subjects.editingId &&
        subject.courseId === data.courseId &&
        String(subject.name || "").trim().toLowerCase() ===
          data.name.toLowerCase()
      );
    });

    if (duplicate) {
      showMessage(
        "এই Course-এ একই নামের Subject ইতিমধ্যে আছে।",
        "warning"
      );
      return false;
    }

    return true;
  }

  async function saveSubject(event) {
    event.preventDefault();

    if (Subjects.saving) return;

    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    const data = getFormData();

    if (!validateSubject(data)) return;

    Subjects.saving = true;

    const button = $("saveSubjectButton");
    button.disabled = true;
    button.textContent = "Saving...";

    try {
      const subjectData = {
        courseId: data.courseId,
        name: data.name,
        description: data.description,
        order: data.order,
        active: data.active,
        updatedAt: getTimestamp(),
        updatedBy: Subjects.auth.currentUser.uid
      };

      if (Subjects.editingId) {
        const existing = Subjects.items.find(
          (item) => item.id === Subjects.editingId
        );

        if (!existing) {
          showMessage(
            "Subject পাওয়া যায়নি। Refresh করে আবার চেষ্টা করো।",
            "warning"
          );
          return;
        }

        if (existing.courseId !== data.courseId) {
          showMessage(
            "এই সংস্করণে Subject-কে অন্য Course-এ স্থানান্তর করা যাবে না।",
            "warning"
          );
          return;
        }

        await Subjects.db
          .collection("subjects")
          .doc(Subjects.editingId)
          .update(subjectData);

        showMessage("Subject update হয়েছে।", "success");
      } else {
        subjectData.createdAt = getTimestamp();
        subjectData.createdBy = Subjects.auth.currentUser.uid;

        await Subjects.db
          .collection("subjects")
          .add(subjectData);

        showMessage("নতুন Subject তৈরি হয়েছে।", "success");
      }

      resetForm();
      $("subjectEditorPanel").hidden = true;

      await loadSubjects();
    } catch (error) {
      console.error("mNEET save subject error:", error);

      showMessage(
        error && error.code === "permission-denied"
          ? "Firestore Security Rules Subject save করতে অনুমতি দিচ্ছে না।"
          : "Subject save করা যায়নি। Firebase connection পরীক্ষা করো।",
        "error"
      );
    } finally {
      Subjects.saving = false;

      if (button) {
        button.disabled = false;
        button.textContent = Subjects.editingId
          ? "Update Subject"
          : "Save Subject";
      }
    }
  }

  async function loadSubjects() {
    if (Subjects.loading) return;

    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    const courseId = getSelectedCourseId();

    if (!courseId) {
      $("adminSubjectsList").innerHTML = `
        <div class="subject-empty">
          <p>প্রথমে একটি Course নির্বাচন করো।</p>
        </div>
      `;

      $("subjectListSummary").textContent = "No course selected.";
      return;
    }

    Subjects.loading = true;

    $("adminSubjectsList").textContent = "Loading Subjects...";

    try {
      /*
       * This module uses the top-level collection:
       * subjects/{subjectId}
       *
       * Every subject stores its parent courseId.
       */
      const snapshot = await Subjects.db
        .collection("subjects")
        .where("courseId", "==", courseId)
        .get();

      Subjects.items = snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });

      Subjects.items.sort(function (a, b) {
        const orderA = Number(a.order) || 0;
        const orderB = Number(b.order) || 0;

        if (orderA !== orderB) return orderA - orderB;

        return String(a.name || "").localeCompare(
          String(b.name || ""),
          "en",
          { sensitivity: "base" }
        );
      });

      renderSubjects();
    } catch (error) {
      console.error("mNEET load subjects error:", error);

      $("adminSubjectsList").textContent =
        error && error.code === "permission-denied"
          ? "Firestore Rules Subject list পড়তে অনুমতি দিচ্ছে না।"
          : "Subject list load করা যায়নি।";

      showMessage(
        "Subject load করা যায়নি। Firestore structure ও Security Rules পরীক্ষা করো।",
        "error"
      );
    } finally {
      Subjects.loading = false;
    }
  }

  function renderSubjects() {
    const list = $("adminSubjectsList");
    const summary = $("subjectListSummary");

    if (!list) return;

    if (summary) {
      summary.textContent =
        Subjects.items.length +
        (Subjects.items.length === 1
          ? " Subject found"
          : " Subjects found") +
        " · " +
        getCourseName(getSelectedCourseId());
    }

    if (!Subjects.items.length) {
      list.innerHTML = `
        <div class="subject-empty">
          <h4>No Subjects Yet</h4>
          <p>
            Add Subject button-এ চাপ দিয়ে এই Course-এর প্রথম Subject তৈরি করো।
          </p>
        </div>
      `;

      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "subject-list";

    Subjects.items.forEach(function (subject, index) {
      const card = document.createElement("article");
      card.className = "subject-item";

      const order = document.createElement("div");
      order.className = "subject-order";
      order.textContent = String(subject.order || index + 1);

      const details = document.createElement("div");

      const title = document.createElement("h4");
      title.textContent = subject.name || "Untitled Subject";

      const description = document.createElement("p");
      description.textContent =
        subject.description || "No description added.";

      const status = document.createElement("span");
      status.className = "subject-status";
      status.textContent =
        subject.active === false ? "Inactive" : "Active";

      details.append(title, description, status);

      const actions = document.createElement("div");
      actions.className = "subject-item-actions";

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "subject-primary-button";
      editButton.textContent = "Edit";
      editButton.dataset.subjectAction = "edit";
      editButton.dataset.subjectId = subject.id;

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "subject-secondary-button";
      deleteButton.textContent = "Delete";
      deleteButton.dataset.subjectAction = "delete";
      deleteButton.dataset.subjectId = subject.id;

      const moveUpButton = document.createElement("button");
      moveUpButton.type = "button";
      moveUpButton.className = "subject-secondary-button";
      moveUpButton.textContent = "↑";
      moveUpButton.title = "Move Subject Up";
      moveUpButton.setAttribute("aria-label", "Move Subject Up");
      moveUpButton.dataset.subjectAction = "up";
      moveUpButton.dataset.subjectId = subject.id;
      moveUpButton.disabled = index === 0;

      const moveDownButton = document.createElement("button");
      moveDownButton.type = "button";
      moveDownButton.className = "subject-secondary-button";
      moveDownButton.textContent = "↓";
      moveDownButton.title = "Move Subject Down";
      moveDownButton.setAttribute("aria-label", "Move Subject Down");
      moveDownButton.dataset.subjectAction = "down";
      moveDownButton.dataset.subjectId = subject.id;
      moveDownButton.disabled = index === Subjects.items.length - 1;

      actions.append(
        moveUpButton,
        moveDownButton,
        editButton,
        deleteButton
      );

      card.append(order, details, actions);
      wrapper.appendChild(card);
    });

    list.replaceChildren(wrapper);
  }

  function handleSubjectAction(event) {
    const button = event.target.closest("[data-subject-action]");

    if (!button) return;

    const action = button.dataset.subjectAction;
    const subject = Subjects.items.find(
      (item) => item.id === button.dataset.subjectId
    );

    if (!subject) {
      showMessage("Subject পাওয়া যায়নি। Refresh করে আবার চেষ্টা করো।", "warning");
      return;
    }

    if (action === "edit") {
      editSubject(subject);
    } else if (action === "delete") {
      deleteSubject(subject);
    } else if (action === "up") {
      moveSubject(subject, -1);
    } else if (action === "down") {
      moveSubject(subject, 1);
    }
  }

  function editSubject(subject) {
    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    Subjects.editingId = subject.id;

    $("subjectEditorTitle").textContent = "Edit Subject";
    $("subjectName").value = subject.name || "";
    $("subjectDescription").value = subject.description || "";
    $("subjectOrder").value = String(subject.order || 1);
    $("subjectActive").checked = subject.active !== false;

    $("saveSubjectButton").textContent = "Update Subject";
    $("subjectEditorPanel").hidden = false;

    $("subjectEditorPanel").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function deleteSubject(subject) {
    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    const confirmed = window.confirm(
      'তুমি কি "' +
        subject.name +
        '" Subject delete করতে চাও?\n\n' +
        "এই কাজটি Subject document মুছে দেবে। এর সঙ্গে যুক্ত Chapters বা অন্য documents স্বয়ংক্রিয়ভাবে মুছে যাবে না।"
    );

    if (!confirmed) return;

    try {
      await Subjects.db
        .collection("subjects")
        .doc(subject.id)
        .delete();

      if (Subjects.editingId === subject.id) {
        resetForm();
        $("subjectEditorPanel").hidden = true;
      }

      showMessage("Subject document delete হয়েছে।", "success");

      await loadSubjects();
    } catch (error) {
      console.error("mNEET delete subject error:", error);

      showMessage(
        error && error.code === "permission-denied"
          ? "Firestore Rules Subject delete করতে অনুমতি দিচ্ছে না।"
          : "Subject delete করা যায়নি।",
        "error"
      );
    }
  }

  async function moveSubject(subject, direction) {
    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    const index = Subjects.items.findIndex(
      (item) => item.id === subject.id
    );

    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= Subjects.items.length) {
      return;
    }

    const other = Subjects.items[targetIndex];

    try {
      const batch = Subjects.db.batch();

      batch.update(
        Subjects.db.collection("subjects").doc(subject.id),
        {
          order: Number(other.order) || targetIndex + 1,
          updatedAt: getTimestamp(),
          updatedBy: Subjects.auth.currentUser.uid
        }
      );

      batch.update(
        Subjects.db.collection("subjects").doc(other.id),
        {
          order: Number(subject.order) || index + 1,
          updatedAt: getTimestamp(),
          updatedBy: Subjects.auth.currentUser.uid
        }
      );

      await batch.commit();

      showMessage("Subject order update হয়েছে।", "success");

      await loadSubjects();
    } catch (error) {
      console.error("mNEET reorder subject error:", error);

      showMessage(
        error && error.code === "permission-denied"
          ? "Firestore Rules Subject reorder করতে অনুমতি দিচ্ছে না।"
          : "Subject order পরিবর্তন করা যায়নি।",
        "error"
      );
    }
  }

  function init() {
    if (Subjects.initialized) return;
    if (!$("subjectsContent")) return;
    if (!getFirebaseServices()) return;

    Subjects.initialized = true;

    renderLayout();
    loadCourses();

    window.addEventListener("mneet:admin-page-change", function (event) {
      if (event.detail && event.detail.page === "subjects") {
        loadCourses();
      }
    });

    window.addEventListener("mneet:admin-course-change", function () {
      loadSubjects();
    });
  }

  Subjects.load = loadSubjects;
  Subjects.refresh = loadCourses;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
