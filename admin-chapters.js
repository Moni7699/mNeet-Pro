/* =========================================================
   mNEET ADMIN PANEL
   FILE 13: admin-chapters.js

   Requirements:
   - Admin-only chapter management
   - Course -> Subject -> Chapter
   - Create, Edit, Delete and Reorder chapters
   - Persistent Firestore storage
   - Green + White dark theme
   ========================================================= */

(function () {
  "use strict";

  const Chapters = {
    initialized: false,
    loading: false,
    saving: false,
    editingId: null,
    courses: [],
    subjects: [],
    chapters: [],
    selectedCourseId: "",
    selectedSubjectId: ""
  };

  const $ = (id) => document.getElementById(id);

  const db = () => {
    if (window.MNEETFirebase && window.MNEETFirebase.ready) {
      return window.MNEETFirebase.db;
    }

    if (window.firebase && firebase.apps.length) {
      return firebase.firestore();
    }

    throw new Error("Firebase connect করা নেই।");
  };

  const auth = () => {
    if (window.MNEETFirebase && window.MNEETFirebase.ready) {
      return window.MNEETFirebase.auth;
    }

    if (window.firebase && firebase.apps.length) {
      return firebase.auth();
    }

    throw new Error("Firebase Authentication পাওয়া যায়নি।");
  };

  const escapeHTML = (value) => {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const timestamp = () =>
    firebase.firestore.FieldValue.serverTimestamp();

  function showMessage(message, type) {
    const box = $("chapterMessage");
    if (!box) return;

    box.textContent = message;
    box.className = "chapter-message " + (type || "info");
    box.hidden = false;

    if (type === "success") {
      setTimeout(() => {
        if (box.textContent === message) {
          box.hidden = true;
        }
      }, 3500);
    }
  }

  function clearMessage() {
    const box = $("chapterMessage");
    if (!box) return;

    box.hidden = true;
    box.textContent = "";
  }

  function setBusy(isBusy) {
    Chapters.saving = isBusy;

    [
      "chapterSaveButton",
      "chapterResetButton",
      "chapterCourseSelect",
      "chapterSubjectSelect"
    ].forEach((id) => {
      const element = $(id);
      if (element) element.disabled = isBusy;
    });

    const saveButton = $("chapterSaveButton");

    if (saveButton) {
      saveButton.textContent = isBusy
        ? "Saving..."
        : Chapters.editingId
          ? "Update Chapter"
          : "Save Chapter";
    }
  }

  function injectStyles() {
    if ($("mneetChapterStyles")) return;

    const style = document.createElement("style");
    style.id = "mneetChapterStyles";

    style.textContent = `
      #chaptersModule {
        color: #FFFFFF;
      }

      .chapter-layout {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: 18px;
        align-items: start;
      }

      .chapter-panel {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 16px;
        padding: 18px;
        min-width: 0;
      }

      .chapter-panel h3 {
        color: #FFFFFF;
        margin: 0 0 16px;
        font-size: 18px;
      }

      .chapter-form-group {
        margin-bottom: 14px;
      }

      .chapter-form-group label {
        display: block;
        color: #D1D5DB;
        font-size: 13px;
        margin-bottom: 7px;
      }

      .chapter-form-group input,
      .chapter-form-group textarea,
      .chapter-form-group select {
        display: block;
        width: 100%;
        box-sizing: border-box;
        background: #10291D;
        border: 1px solid #28513A;
        border-radius: 9px;
        padding: 11px 12px;
        color: #FFFFFF;
        font: inherit;
        outline: none;
      }

      .chapter-form-group input:focus,
      .chapter-form-group textarea:focus,
      .chapter-form-group select:focus {
        border-color: #22C55E;
        box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.15);
      }

      .chapter-form-group select option {
        background: #0D2419;
        color: #FFFFFF;
      }

      .chapter-form-group textarea {
        min-height: 88px;
        resize: vertical;
      }

      .chapter-form-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .chapter-checkbox-row {
        display: flex;
        gap: 9px;
        align-items: center;
        color: #FFFFFF;
        font-size: 14px;
        margin: 12px 0 18px;
      }

      .chapter-checkbox-row input {
        accent-color: #16A34A;
        width: 17px;
        height: 17px;
      }

      .chapter-button-row {
        display: flex;
        flex-wrap: wrap;
        gap: 9px;
      }

      .chapter-btn {
        border: 1px solid #28513A;
        border-radius: 9px;
        padding: 10px 13px;
        background: #10291D;
        color: #FFFFFF;
        font-weight: 600;
        cursor: pointer;
      }

      .chapter-btn-primary {
        background: #16A34A;
        border-color: #16A34A;
        color: #FFFFFF;
      }

      .chapter-btn:hover {
        border-color: #22C55E;
      }

      .chapter-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .chapter-message {
        padding: 11px 12px;
        border: 1px solid #28513A;
        background: #10291D;
        color: #FFFFFF;
        border-radius: 9px;
        margin-bottom: 14px;
        overflow-wrap: anywhere;
      }

      .chapter-message[hidden] {
        display: none;
      }

      .chapter-toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 14px;
      }

      .chapter-toolbar select,
      .chapter-toolbar input {
        min-width: 0;
        max-width: 100%;
        box-sizing: border-box;
        background: #10291D;
        border: 1px solid #28513A;
        color: #FFFFFF;
        padding: 10px;
        border-radius: 9px;
      }

      .chapter-list {
        display: grid;
        gap: 10px;
      }

      .chapter-item {
        background: #10291D;
        border: 1px solid #28513A;
        border-radius: 12px;
        padding: 13px;
        min-width: 0;
      }

      .chapter-item-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
      }

      .chapter-item h4 {
        color: #FFFFFF;
        margin: 0 0 7px;
        overflow-wrap: anywhere;
      }

      .chapter-item p {
        color: #D1D5DB;
        margin: 5px 0;
        font-size: 13px;
        overflow-wrap: anywhere;
      }

      .chapter-item-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 7px;
        margin-top: 12px;
      }

      .chapter-item-actions .chapter-btn {
        padding: 7px 10px;
        font-size: 12px;
      }

      .chapter-status {
        display: inline-block;
        border: 1px solid #28513A;
        color: #FFFFFF;
        padding: 4px 8px;
        border-radius: 20px;
        font-size: 11px;
        white-space: nowrap;
      }

      .chapter-empty {
        padding: 22px 12px;
        text-align: center;
        border: 1px dashed #28513A;
        border-radius: 12px;
        color: #D1D5DB;
      }

      .chapter-count {
        color: #D1D5DB;
        font-size: 13px;
      }

      @media (max-width: 850px) {
        .chapter-layout {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 480px) {
        .chapter-panel {
          padding: 13px;
        }

        .chapter-form-row {
          grid-template-columns: 1fr;
        }

        .chapter-item-top {
          flex-direction: column;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function renderLayout() {
    const container = $("chaptersContent");
    if (!container) return;

    container.innerHTML = `
      <div class="chapter-layout">

        <section class="chapter-panel">
          <h3 id="chapterFormHeading">Create Chapter</h3>

          <div id="chapterMessage"
               class="chapter-message"
               role="status"
               aria-live="polite"
               hidden></div>

          <form id="chapterForm">

            <div class="chapter-form-group">
              <label for="chapterCourseSelect">Course *</label>
              <select id="chapterCourseSelect" required>
                <option value="">Loading courses...</option>
              </select>
            </div>

            <div class="chapter-form-group">
              <label for="chapterSubjectSelect">Subject *</label>
              <select id="chapterSubjectSelect" required>
                <option value="">Select a course first</option>
              </select>
            </div>

            <div class="chapter-form-group">
              <label for="chapterName">Chapter Name *</label>
              <input id="chapterName"
                     type="text"
                     maxlength="150"
                     placeholder="Enter chapter name"
                     required>
            </div>

            <div class="chapter-form-group">
              <label for="chapterDescription">Description</label>
              <textarea id="chapterDescription"
                        maxlength="2000"
                        placeholder="Chapter description (optional)"></textarea>
            </div>

            <div class="chapter-form-row">
              <div class="chapter-form-group">
                <label for="chapterOrder">Display Order *</label>
                <input id="chapterOrder"
                       type="number"
                       min="1"
                       step="1"
                       value="1"
                       required>
              </div>

              <div class="chapter-form-group">
                <label for="chapterStatusSelect">Status</label>
                <select id="chapterStatusSelect">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div class="chapter-button-row">
              <button class="chapter-btn chapter-btn-primary"
                      id="chapterSaveButton"
                      type="submit">
                Save Chapter
              </button>

              <button class="chapter-btn"
                      id="chapterResetButton"
                      type="button">
                Clear Form
              </button>
            </div>

          </form>
        </section>

        <section class="chapter-panel">
          <div class="chapter-toolbar">
            <div>
              <h3 style="margin-bottom:5px">Chapters</h3>
              <div class="chapter-count" id="chapterCount">
                Loading chapters...
              </div>
            </div>

            <button class="chapter-btn"
                    id="chapterRefreshButton"
                    type="button">
              Refresh
            </button>
          </div>

          <div class="chapter-form-group">
            <label for="chapterSearch">Search Chapters</label>
            <input id="chapterSearch"
                   type="search"
                   placeholder="Search by chapter name">
          </div>

          <div class="chapter-list" id="chapterList">
            <div class="chapter-empty">Loading chapters...</div>
          </div>
        </section>

      </div>
    `;

    $("chapterForm").addEventListener("submit", saveChapter);
    $("chapterResetButton").addEventListener("click", resetForm);
    $("chapterRefreshButton").addEventListener("click", loadChapters);
    $("chapterSearch").addEventListener("input", renderChapters);

    $("chapterCourseSelect").addEventListener("change", async (event) => {
      if (Chapters.saving) return;

      Chapters.selectedCourseId = event.target.value;
      Chapters.selectedSubjectId = "";

      await loadSubjects();
      await loadChapters();
      resetForm(false);

      document.dispatchEvent(
        new CustomEvent("mneet:admin-course-change", {
          detail: { courseId: Chapters.selectedCourseId }
        })
      );
    });

    $("chapterSubjectSelect").addEventListener("change", async (event) => {
      if (Chapters.saving) return;

      Chapters.selectedSubjectId = event.target.value;
      await loadChapters();
      resetForm(false);
    });

    $("chapterList").addEventListener("click", handleListAction);
  }

  async function requireAdmin() {
    const user = auth().currentUser;

    if (!user) {
      throw new Error("প্রথমে Admin account দিয়ে Sign In করো।");
    }

    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized === "function"
    ) {
      const allowed = await window.MNEETAdmin.isAdminAuthorized();

      if (!allowed) {
        throw new Error("এই কাজের জন্য Admin permission প্রয়োজন।");
      }

      return user;
    }

    const adminDoc = await db().collection("admins").doc(user.uid).get();

    if (!adminDoc.exists || adminDoc.data().active !== true) {
      throw new Error("এই account-এর Admin permission নেই।");
    }

    return user;
  }

  function getDashboardCourseId() {
    const selector = $("dashboardCourseSelect");
    return selector && selector.value ? selector.value : "";
  }

  async function loadCourses() {
    const select = $("chapterCourseSelect");
    if (!select) return;

    select.innerHTML = `<option value="">Loading courses...</option>`;

    const snapshot = await db().collection("courses").get();

    Chapters.courses = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((course) =>
        course.active !== false &&
        course.published !== false
      )
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );

    const dashboardCourseId = getDashboardCourseId();

    const preferredId =
      Chapters.selectedCourseId ||
      dashboardCourseId ||
      (Chapters.courses[0] && Chapters.courses[0].id) ||
      "";

    select.innerHTML = `
      <option value="">Select Course</option>
      ${Chapters.courses.map((course) => `
        <option value="${escapeHTML(course.id)}">
          ${escapeHTML(course.name || "Unnamed Course")}
        </option>
      `).join("")}
    `;

    if (Chapters.courses.some((course) => course.id === preferredId)) {
      select.value = preferredId;
      Chapters.selectedCourseId = preferredId;
    } else {
      select.value = "";
      Chapters.selectedCourseId = "";
    }

    if (!Chapters.courses.length) {
      showMessage(
        "কোনো Active Course পাওয়া যায়নি। আগে Courses বিভাগে Course তৈরি করো।",
        "info"
      );
    }

    await loadSubjects();
    await loadChapters();
  }

  async function loadSubjects() {
    const select = $("chapterSubjectSelect");
    if (!select) return;

    const courseId = Chapters.selectedCourseId;

    if (!courseId) {
      Chapters.subjects = [];
      select.innerHTML = `<option value="">Select a course first</option>`;
      Chapters.selectedSubjectId = "";
      return;
    }

    select.innerHTML = `<option value="">Loading subjects...</option>`;

    try {
      const snapshot = await db()
        .collection("subjects")
        .where("courseId", "==", courseId)
        .get();

      Chapters.subjects = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((subject) => subject.active !== false)
        .sort((a, b) => {
          const orderDifference =
            Number(a.order || 0) - Number(b.order || 0);

          return orderDifference ||
            String(a.name || "").localeCompare(String(b.name || ""));
        });

      select.innerHTML = `
        <option value="">Select Subject</option>
        ${Chapters.subjects.map((subject) => `
          <option value="${escapeHTML(subject.id)}">
            ${escapeHTML(subject.name || "Unnamed Subject")}
          </option>
        `).join("")}
      `;

      if (Chapters.subjects.some(
        (subject) => subject.id === Chapters.selectedSubjectId
      )) {
        select.value = Chapters.selectedSubjectId;
      } else {
        select.value = "";
        Chapters.selectedSubjectId = "";
      }

      if (!Chapters.subjects.length) {
        showMessage(
          "এই Course-এ Active Subject নেই। আগে Subjects বিভাগে Subject তৈরি করো।",
          "info"
        );
      }
    } catch (error) {
      select.innerHTML = `<option value="">Could not load subjects</option>`;
      throw error;
    }
  }

  async function loadChapters() {
    if (Chapters.loading) return;

    Chapters.loading = true;

    const list = $("chapterList");
    const count = $("chapterCount");

    if (list) {
      list.innerHTML = `<div class="chapter-empty">Loading chapters...</div>`;
    }

    try {
      if (!Chapters.selectedCourseId || !Chapters.selectedSubjectId) {
        Chapters.chapters = [];

        if (count) count.textContent = "0 chapters";

        if (list) {
          list.innerHTML = `
            <div class="chapter-empty">
              Chapter দেখতে বা তৈরি করতে Course এবং Subject নির্বাচন করো।
            </div>
          `;
        }

        return;
      }

      const snapshot = await db()
        .collection("chapters")
        .where("courseId", "==", Chapters.selectedCourseId)
        .where("subjectId", "==", Chapters.selectedSubjectId)
        .get();

      Chapters.chapters = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => {
          const orderDifference =
            Number(a.order || 0) - Number(b.order || 0);

          return orderDifference ||
            String(a.name || "").localeCompare(String(b.name || ""));
        });

      renderChapters();
    } catch (error) {
      if (list) {
        list.innerHTML = `
          <div class="chapter-empty">
            Chapter load করা যায়নি। Firebase Rules ও connection পরীক্ষা করো।
          </div>
        `;
      }

      showMessage(error.message || "Chapter load করা যায়নি।", "error");
    } finally {
      Chapters.loading = false;
    }
  }

  function renderChapters() {
    const list = $("chapterList");
    const count = $("chapterCount");

    if (!list) return;

    const searchTerm = (
      $("chapterSearch")?.value || ""
    ).trim().toLowerCase();

    const filtered = Chapters.chapters.filter((chapter) =>
      String(chapter.name || "").toLowerCase().includes(searchTerm)
    );

    if (count) {
      count.textContent =
        `${filtered.length} of ${Chapters.chapters.length} chapters`;
    }

    if (!filtered.length) {
      list.innerHTML = `
        <div class="chapter-empty">
          ${searchTerm
            ? "কোনো matching Chapter পাওয়া যায়নি।"
            : "এখনও কোনো Chapter তৈরি করা হয়নি।"}
        </div>
      `;
      return;
    }

    list.innerHTML = filtered.map((chapter) => {
      const index = Chapters.chapters.findIndex(
        (item) => item.id === chapter.id
      );

      const active = chapter.active !== false;

      return `
        <article class="chapter-item">
          <div class="chapter-item-top">
            <div>
              <h4>
                ${escapeHTML(chapter.order || index + 1)}.
                ${escapeHTML(chapter.name || "Unnamed Chapter")}
              </h4>

              <p>${escapeHTML(chapter.description || "No description")}</p>

              <p>Chapter ID: ${escapeHTML(chapter.id)}</p>
            </div>

            <span class="chapter-status">
              ${active ? "Active" : "Inactive"}
            </span>
          </div>

          <div class="chapter-item-actions">
            <button class="chapter-btn"
                    data-action="up"
                    data-id="${escapeHTML(chapter.id)}"
                    ${index === 0 ? "disabled" : ""}>
              Move Up
            </button>

            <button class="chapter-btn"
                    data-action="down"
                    data-id="${escapeHTML(chapter.id)}"
                    ${index === Chapters.chapters.length - 1 ? "disabled" : ""}>
              Move Down
            </button>

            <button class="chapter-btn"
                    data-action="edit"
                    data-id="${escapeHTML(chapter.id)}">
              Edit
            </button>

            <button class="chapter-btn"
                    data-action="delete"
                    data-id="${escapeHTML(chapter.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  async function saveChapter(event) {
    event.preventDefault();

    if (Chapters.saving) return;

    clearMessage();

    try {
      const user = await requireAdmin();

      const courseId = $("chapterCourseSelect").value;
      const subjectId = $("chapterSubjectSelect").value;
      const name = $("chapterName").value.trim();
      const description = $("chapterDescription").value.trim();
      const order = Number($("chapterOrder").value);
      const active = $("chapterStatusSelect").value === "active";

      if (!courseId) {
        throw new Error("একটি Course নির্বাচন করো।");
      }

      if (!subjectId) {
        throw new Error("একটি Subject নির্বাচন করো।");
      }

      if (!name) {
        throw new Error("Chapter Name লিখতে হবে।");
      }

      if (!Number.isInteger(order) || order < 1) {
        throw new Error("Display Order অবশ্যই 1 বা তার বেশি পূর্ণসংখ্যা হতে হবে।");
      }

      const subjectExists = Chapters.subjects.some(
        (subject) =>
          subject.id === subjectId &&
          subject.courseId === courseId
      );

      if (!subjectExists) {
        throw new Error("নির্বাচিত Subject এই Course-এর নয়।");
      }

      const duplicate = Chapters.chapters.some((chapter) =>
        chapter.id !== Chapters.editingId &&
        String(chapter.name || "").trim().toLowerCase() === name.toLowerCase()
      );

      if (duplicate) {
        throw new Error("এই Subject-এ একই নামে Chapter আগে থেকেই আছে।");
      }

      setBusy(true);

      const collection = db().collection("chapters");

      const data = {
        courseId,
        subjectId,
        name,
        description,
        order,
        active,
        updatedAt: timestamp(),
        updatedBy: user.uid
      };

      if (Chapters.editingId) {
        const existing = Chapters.chapters.find(
          (chapter) => chapter.id === Chapters.editingId
        );

        if (!existing) {
          throw new Error("Edit করার Chapter পাওয়া যায়নি। Refresh করে আবার চেষ্টা করো।");
        }

        await collection.doc(Chapters.editingId).update(data);

        showMessage("Chapter সফলভাবে Update হয়েছে।", "success");
      } else {
        data.createdAt = timestamp();
        data.createdBy = user.uid;

        await collection.add(data);

        showMessage("নতুন Chapter সফলভাবে তৈরি হয়েছে।", "success");
      }

      resetForm(false);
      await loadChapters();
    } catch (error) {
      console.error("mNEET chapter save error:", error);

      showMessage(
        error.message || "Chapter Save করা যায়নি।",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  function resetForm(clearNotice = true) {
    const form = $("chapterForm");
    if (!form) return;

    form.reset();
    Chapters.editingId = null;

    const heading = $("chapterFormHeading");
    if (heading) heading.textContent = "Create Chapter";

    const orderInput = $("chapterOrder");
    if (orderInput) orderInput.value = "1";

    const status = $("chapterStatusSelect");
    if (status) status.value = "active";

    const saveButton = $("chapterSaveButton");
    if (saveButton) saveButton.textContent = "Save Chapter";

    const courseSelect = $("chapterCourseSelect");
    if (courseSelect) {
      courseSelect.value = Chapters.selectedCourseId || "";
    }

    const subjectSelect = $("chapterSubjectSelect");
    if (subjectSelect) {
      subjectSelect.value = Chapters.selectedSubjectId || "";
    }

    if (clearNotice) clearMessage();
  }

  function editChapter(id) {
    const chapter = Chapters.chapters.find((item) => item.id === id);

    if (!chapter) {
      showMessage("Chapter পাওয়া যায়নি। Refresh করে আবার চেষ্টা করো।", "error");
      return;
    }

    Chapters.editingId = id;
    Chapters.selectedCourseId = chapter.courseId || "";
    Chapters.selectedSubjectId = chapter.subjectId || "";

    $("chapterCourseSelect").value = Chapters.selectedCourseId;

    loadSubjects()
      .then(() => {
        $("chapterSubjectSelect").value = Chapters.selectedSubjectId;
        $("chapterName").value = chapter.name || "";
        $("chapterDescription").value = chapter.description || "";
        $("chapterOrder").value = String(chapter.order || 1);
        $("chapterStatusSelect").value =
          chapter.active === false ? "inactive" : "active";

        $("chapterFormHeading").textContent = "Edit Chapter";
        $("chapterSaveButton").textContent = "Update Chapter";

        clearMessage();

        $("chapterFormHeading").scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
      })
      .catch((error) => {
        showMessage(error.message || "Subject load করা যায়নি।", "error");
      });
  }

  async function deleteChapter(id) {
    const chapter = Chapters.chapters.find((item) => item.id === id);

    if (!chapter) {
      showMessage("Chapter পাওয়া যায়নি।", "error");
      return;
    }

    const confirmed = window.confirm(
      `“${chapter.name}” Chapter delete করতে চাও?\n\n` +
      "সতর্কতা: এই কাজ Chapter document মুছবে। এর Topics, Quizzes বা অন্যান্য " +
      "subcollection স্বয়ংক্রিয়ভাবে মুছবে না। আগে সংশ্লিষ্ট Data পরীক্ষা করো।"
    );

    if (!confirmed) return;

    try {
      await requireAdmin();

      await db().collection("chapters").doc(id).delete();

      if (Chapters.editingId === id) {
        resetForm(false);
      }

      showMessage(
        "Chapter document delete হয়েছে। সম্পর্কিত Topics ও Quizzes আলাদাভাবে পরীক্ষা করো।",
        "success"
      );

      await loadChapters();
    } catch (error) {
      console.error("mNEET chapter delete error:", error);

      showMessage(
        error.message || "Chapter delete করা যায়নি।",
        "error"
      );
    }
  }

  async function moveChapter(id, direction) {
    try {
      await requireAdmin();

      const index = Chapters.chapters.findIndex(
        (chapter) => chapter.id === id
      );

      const targetIndex = index + direction;

      if (
        index < 0 ||
        targetIndex < 0 ||
        targetIndex >= Chapters.chapters.length
      ) {
        return;
      }

      const current = Chapters.chapters[index];
      const target = Chapters.chapters[targetIndex];

      if (
        current.courseId !== target.courseId ||
        current.subjectId !== target.subjectId
      ) {
        throw new Error("ভিন্ন Subject-এর Chapter reorder করা যাবে না।");
      }

      const batch = db().batch();

      batch.update(
        db().collection("chapters").doc(current.id),
        {
          order: Number(target.order || targetIndex + 1),
          updatedAt: timestamp()
        }
      );

      batch.update(
        db().collection("chapters").doc(target.id),
        {
          order: Number(current.order || index + 1),
          updatedAt: timestamp()
        }
      );

      await batch.commit();

      showMessage("Chapter order পরিবর্তন হয়েছে।", "success");

      await loadChapters();
    } catch (error) {
      console.error("mNEET chapter reorder error:", error);

      showMessage(
        error.message || "Chapter order পরিবর্তন করা যায়নি।",
        "error"
      );
    }
  }

  async function handleListAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled) return;

    const action = button.dataset.action;
    const id = button.dataset.id;

    if (!id) return;

    if (action === "edit") {
      editChapter(id);
    } else if (action === "delete") {
      await deleteChapter(id);
    } else if (action === "up") {
      await moveChapter(id, -1);
    } else if (action === "down") {
      await moveChapter(id, 1);
    }
  }

  async function initialize() {
    if (Chapters.initialized) return;

    const container = $("chaptersContent");
    if (!container) return;

    Chapters.initialized = true;

    injectStyles();
    renderLayout();

    try {
      await requireAdmin();

      const dashboardSelector = $("dashboardCourseSelect");

      if (dashboardSelector) {
        dashboardSelector.addEventListener("change", async () => {
          if (Chapters.saving) return;

          const newCourseId = dashboardSelector.value;

          if (!newCourseId || newCourseId === Chapters.selectedCourseId) {
            return;
          }

          Chapters.selectedCourseId = newCourseId;
          Chapters.selectedSubjectId = "";

          if ($("chapterCourseSelect")) {
            $("chapterCourseSelect").value = newCourseId;
          }

          await loadSubjects();
          await loadChapters();
          resetForm(false);
        });
      }

      await loadCourses();
    } catch (error) {
      console.error("mNEET chapter initialization error:", error);

      showMessage(
        error.message || "Chapter Management চালু করা যায়নি।",
        "error"
      );
    }
  }

  document.addEventListener("DOMContentLoaded", initialize);

  document.addEventListener("mneet:admin-page-change", (event) => {
    const page = event.detail && event.detail.page;

    if (page === "chapters") {
      initialize().then(() => {
        if (Chapters.initialized) {
          loadCourses().catch((error) => {
            showMessage(error.message || "Course load করা যায়নি।", "error");
          });
        }
      });
    }
  });

  window.MNEETAdminChapters = Object.freeze({
    refresh: loadChapters
  });
})();
