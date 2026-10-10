(function () {
  "use strict";

  if (window.MNEETAdminCourses) return;

  const Courses = {
    initialized: false,
    db: null,
    auth: null,
    courses: [],
    editingCourseId: null,
    loading: false,
    saving: false,
    unsubscribe: null
  };

  window.MNEETAdminCourses = Courses;

  const $ = (id) => document.getElementById(id);

  const elements = {
    container: $("coursesContent"),
    courseSelector: $("dashboardCourseSelect")
  };

  function showMessage(message, type) {
    if (
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.showMessage === "function"
    ) {
      window.MNEETAdmin.showMessage(message, type || "warning");
      return;
    }

    const messageElement = $("adminMessage");

    if (messageElement) {
      messageElement.textContent = message;
      messageElement.className =
        "admin-message show " + (type || "warning");
      messageElement.setAttribute("role", "status");
    }
  }

  function getFirebaseServices() {
    const wrapper = window.MNEETFirebase;

    if (wrapper && wrapper.ready) {
      Courses.db = wrapper.db;
      Courses.auth = wrapper.auth;
      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      Courses.auth = window.firebase.auth();
      Courses.db = window.firebase.firestore();
      return true;
    }

    showMessage(
      "Firebase সংযোগ পাওয়া যায়নি। firebase.js পরীক্ষা করো।",
      "error"
    );

    return false;
  }

  function isAdminAuthorized() {
    return Boolean(
      window.MNEETAdmin &&
      typeof window.MNEETAdmin.isAdminAuthorized === "function" &&
      window.MNEETAdmin.isAdminAuthorized() &&
      Courses.auth &&
      Courses.auth.currentUser
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

  function formatPrice(value) {
    const amount = Number(value);

    if (!Number.isFinite(amount) || amount < 0) {
      return "₹0";
    }

    return "₹" + amount.toLocaleString("en-IN", {
      maximumFractionDigits: 2
    });
  }

  function formatDate(value) {
    if (!value) return "Not set";

    let date;

    if (typeof value.toDate === "function") {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) {
      return "Not set";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function getDateInputValue(value) {
    if (!value) return "";

    let date;

    if (typeof value.toDate === "function") {
      date = value.toDate();
    } else if (value instanceof Date) {
      date = value;
    } else {
      date = new Date(value);
    }

    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  function validateCourse(data) {
    if (!data.name || data.name.length < 2) {
      showMessage(
        "Course Name কমপক্ষে ২ অক্ষরের হতে হবে।",
        "warning"
      );
      return false;
    }

    if (data.name.length > 150) {
      showMessage(
        "Course Name ১৫০ অক্ষরের বেশি হতে পারবে না।",
        "warning"
      );
      return false;
    }

    if (data.description.length > 5000) {
      showMessage(
        "Course Description খুব বড়। সর্বোচ্চ ৫০০০ অক্ষর রাখো।",
        "warning"
      );
      return false;
    }

    if (
      data.price === "" ||
      !Number.isFinite(Number(data.price)) ||
      Number(data.price) < 0
    ) {
      showMessage(
        "Course-এর সঠিক Price লিখো।",
        "warning"
      );
      return false;
    }

    if (data.thumbnailUrl) {
      try {
        const url = new URL(data.thumbnailUrl);

        if (
          url.protocol !== "https:" &&
          url.protocol !== "http:"
        ) {
          throw new Error("Invalid URL");
        }
      } catch (error) {
        showMessage(
          "Thumbnail URL সঠিক নয়। বৈধ HTTP/HTTPS URL ব্যবহার করো।",
          "warning"
        );
        return false;
      }
    }

    if (
      data.startDate &&
      data.endDate &&
      data.startDate > data.endDate
    ) {
      showMessage(
        "End Date, Start Date-এর আগের হতে পারবে না।",
        "warning"
      );
      return false;
    }

    return true;
  }

  function renderManagementLayout() {
    if (!elements.container) {
      console.warn(
        "mNEET Courses: coursesContent element পাওয়া যায়নি।"
      );
      return;
    }

    elements.container.innerHTML = `
      <section class="admin-course-management">

        <div class="admin-section-heading">
          <div>
            <h2>Course Management</h2>
            <p>
              NEET course তৈরি করো, Course information update করো
              এবং Course status পরিচালনা করো।
            </p>
          </div>

          <button
            type="button"
            id="addNewCourseButton"
            class="admin-primary-button">
            + Create Course
          </button>
        </div>

        <section
          id="courseEditorPanel"
          class="admin-card"
          hidden>

          <h3 id="courseEditorTitle">Create New Course</h3>

          <form id="adminCourseForm" novalidate>

            <div class="admin-form-grid">

              <div class="admin-form-group">
                <label for="courseName">Course Name *</label>

                <input
                  type="text"
                  id="courseName"
                  name="name"
                  maxlength="150"
                  required
                  placeholder="যেমন: NEET Biology Complete Course">
              </div>

              <div class="admin-form-group">
                <label for="coursePrice">Course Price (₹) *</label>

                <input
                  type="number"
                  id="coursePrice"
                  name="price"
                  min="0"
                  step="0.01"
                  required
                  placeholder="যেমন: 499">
              </div>

              <div class="admin-form-group admin-form-full">
                <label for="courseDescription">
                  Course Description
                </label>

                <textarea
                  id="courseDescription"
                  name="description"
                  rows="4"
                  maxlength="5000"
                  placeholder="Course সম্পর্কে বিস্তারিত লিখো"></textarea>
              </div>

              <div class="admin-form-group admin-form-full">
                <label for="courseThumbnailUrl">
                  Course Thumbnail URL
                </label>

                <input
                  type="url"
                  id="courseThumbnailUrl"
                  name="thumbnailUrl"
                  placeholder="https://example.com/course-image.jpg">

                <small>
                  এখানে একটি image URL দাও। এই সংস্করণে সরাসরি
                  device থেকে file upload চালু নেই।
                </small>
              </div>

              <div class="admin-form-group admin-form-full">
                <label>Thumbnail Preview</label>

                <div id="courseThumbnailPreviewBox">
                  <img
                    id="courseThumbnailPreview"
                    alt="Course thumbnail preview"
                    hidden>

                  <p id="courseThumbnailPreviewMessage">
                    Thumbnail URL দিলে এখানে preview দেখা যাবে।
                  </p>
                </div>
              </div>

              <div class="admin-form-group">
                <label for="courseStartDate">Start Date</label>

                <input
                  type="date"
                  id="courseStartDate"
                  name="startDate">
              </div>

              <div class="admin-form-group">
                <label for="courseEndDate">End Date</label>

                <input
                  type="date"
                  id="courseEndDate"
                  name="endDate">
              </div>

              <div class="admin-form-group admin-form-full">
                <label class="admin-checkbox-label">
                  <input
                    type="checkbox"
                    id="courseActive"
                    name="active"
                    checked>

                  <span>Course Active রাখো</span>
                </label>
              </div>

            </div>

            <div class="admin-form-actions">

              <button
                type="submit"
                id="saveCourseButton"
                class="admin-primary-button">
                Save Course
              </button>

              <button
                type="button"
                id="cancelCourseEditButton"
                class="admin-secondary-button">
                Cancel
              </button>

            </div>

          </form>
        </section>

        <section class="admin-card">
          <div class="admin-section-heading">
            <div>
              <h3>All Courses</h3>
              <p id="courseListSummary">Courses loading...</p>
            </div>

            <button
              type="button"
              id="refreshCoursesButton"
              class="admin-secondary-button">
              Refresh
            </button>
          </div>

          <div id="courseListMessage" role="status"></div>

          <div id="adminCoursesList" class="admin-courses-list">
            <p>Courses loading...</p>
          </div>
        </section>

      </section>
    `;

    addStyles();
    setupFormEvents();
  }

  function addStyles() {
    if ($("adminCoursesModuleStyles")) return;

    const style = document.createElement("style");
    style.id = "adminCoursesModuleStyles";

    style.textContent = `
      .admin-course-management {
        display: grid;
        gap: 20px;
        color: #FFFFFF;
      }

      .admin-course-management .admin-card {
        background: #0D2419;
        border: 1px solid #28513A;
        border-radius: 16px;
        padding: 20px;
        min-width: 0;
      }

      .admin-course-management .admin-section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }

      .admin-course-management h2,
      .admin-course-management h3 {
        color: #FFFFFF;
        margin: 0 0 8px;
      }

      .admin-course-management p,
      .admin-course-management small {
        color: #D1D5DB;
        line-height: 1.6;
      }

      .admin-course-management .admin-form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }

      .admin-course-management .admin-form-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
      }

      .admin-course-management .admin-form-full {
        grid-column: 1 / -1;
      }

      .admin-course-management label {
        color: #FFFFFF;
        font-weight: 600;
      }

      .admin-course-management input:not([type="checkbox"]),
      .admin-course-management textarea {
        width: 100%;
        box-sizing: border-box;
        background: #10291D;
        color: #FFFFFF;
        border: 1px solid #28513A;
        border-radius: 10px;
        padding: 12px;
        font: inherit;
      }

      .admin-course-management input:focus,
      .admin-course-management textarea:focus {
        outline: 2px solid #22C55E;
        outline-offset: 2px;
      }

      .admin-course-management input::placeholder,
      .admin-course-management textarea::placeholder {
        color: #D1D5DB;
        opacity: 0.8;
      }

      .admin-course-management .admin-form-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: 20px;
      }

      .admin-course-management .admin-primary-button,
      .admin-course-management .admin-secondary-button {
        border-radius: 10px;
        padding: 11px 16px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .admin-course-management .admin-primary-button {
        background: #16A34A;
        color: #FFFFFF;
        border: 1px solid #22C55E;
      }

      .admin-course-management .admin-secondary-button {
        background: #10291D;
        color: #FFFFFF;
        border: 1px solid #28513A;
      }

      .admin-course-management button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .admin-course-management #courseThumbnailPreviewBox {
        background: #071A12;
        border: 1px dashed #28513A;
        border-radius: 12px;
        padding: 12px;
        min-height: 70px;
      }

      .admin-course-management #courseThumbnailPreview {
        max-width: 100%;
        width: 100%;
        max-height: 240px;
        object-fit: contain;
        border-radius: 8px;
      }

      .admin-course-management .admin-courses-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
        gap: 14px;
      }

      .admin-course-management .admin-course-card {
        min-width: 0;
        overflow: hidden;
        background: #071A12;
        border: 1px solid #28513A;
        border-radius: 14px;
      }

      .admin-course-management .admin-course-image {
        width: 100%;
        height: 140px;
        object-fit: cover;
        background: #10291D;
        border-bottom: 1px solid #28513A;
      }

      .admin-course-management .admin-course-image-placeholder {
        height: 90px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #D1D5DB;
        background: #10291D;
        border-bottom: 1px solid #28513A;
      }

      .admin-course-management .admin-course-card-body {
        padding: 14px;
      }

      .admin-course-management .admin-course-card h4 {
        margin: 0 0 8px;
        color: #FFFFFF;
        overflow-wrap: anywhere;
      }

      .admin-course-management .admin-course-price {
        color: #22C55E;
        font-size: 1.15rem;
        font-weight: 800;
      }

      .admin-course-management .admin-course-status {
        display: inline-block;
        padding: 5px 9px;
        border-radius: 8px;
        background: #10291D;
        border: 1px solid #28513A;
        color: #FFFFFF;
        font-size: 0.85rem;
      }

      .admin-course-management .admin-course-card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 14px;
      }

      .admin-course-management .admin-course-card-actions button {
        flex: 1;
        min-width: 70px;
      }

      .admin-course-management .admin-empty-state {
        padding: 22px;
        border: 1px dashed #28513A;
        border-radius: 12px;
        text-align: center;
        color: #D1D5DB;
      }

      .admin-course-management .admin-checkbox-label {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .admin-course-management input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #16A34A;
      }

      @media (max-width: 600px) {
        .admin-course-management .admin-card {
          padding: 14px;
        }

        .admin-course-management .admin-form-grid {
          grid-template-columns: 1fr;
        }

        .admin-course-management .admin-form-full {
          grid-column: auto;
        }

        .admin-course-management .admin-courses-list {
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function setupFormEvents() {
    $("addNewCourseButton").addEventListener("click", function () {
      resetForm();
      $("courseEditorPanel").hidden = false;
      $("courseEditorPanel").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      $("courseName").focus();
    });

    $("cancelCourseEditButton").addEventListener("click", function () {
      resetForm();
      $("courseEditorPanel").hidden = true;
    });

    $("adminCourseForm").addEventListener("submit", saveCourse);

    $("refreshCoursesButton").addEventListener("click", function () {
      loadCourses();
    });

    $("courseThumbnailUrl").addEventListener(
      "input",
      updateThumbnailPreview
    );

    $("adminCoursesList").addEventListener(
      "click",
      handleCourseAction
    );
  }

  function updateThumbnailPreview() {
    const input = $("courseThumbnailUrl");
    const image = $("courseThumbnailPreview");
    const message = $("courseThumbnailPreviewMessage");

    if (!input || !image || !message) return;

    const url = input.value.trim();

    if (!url) {
      image.hidden = true;
      image.removeAttribute("src");
      message.hidden = false;
      message.textContent =
        "Thumbnail URL দিলে এখানে preview দেখা যাবে।";
      return;
    }

    try {
      const parsed = new URL(url);

      if (
        parsed.protocol !== "https:" &&
        parsed.protocol !== "http:"
      ) {
        throw new Error("Invalid URL");
      }

      image.onload = function () {
        image.hidden = false;
        message.hidden = true;
      };

      image.onerror = function () {
        image.hidden = true;
        message.hidden = false;
        message.textContent =
          "Thumbnail load করা যায়নি। URL পরীক্ষা করো।";
      };

      image.src = parsed.href;
    } catch (error) {
      image.hidden = true;
      image.removeAttribute("src");
      message.hidden = false;
      message.textContent = "সঠিক Thumbnail URL দাও।";
    }
  }

  function resetForm() {
    const form = $("adminCourseForm");

    if (form) form.reset();

    Courses.editingCourseId = null;

    if ($("courseEditorTitle")) {
      $("courseEditorTitle").textContent = "Create New Course";
    }

    if ($("saveCourseButton")) {
      $("saveCourseButton").textContent = "Save Course";
      $("saveCourseButton").disabled = false;
    }

    if ($("courseActive")) {
      $("courseActive").checked = true;
    }

    updateThumbnailPreview();
  }

  function getFormData() {
    return {
      name: $("courseName").value.trim(),
      description: $("courseDescription").value.trim(),
      price: $("coursePrice").value,
      thumbnailUrl: $("courseThumbnailUrl").value.trim(),
      startDate: $("courseStartDate").value,
      endDate: $("courseEndDate").value,
      active: $("courseActive").checked
    };
  }

  async function saveCourse(event) {
    event.preventDefault();

    if (Courses.saving) return;

    if (!isAdminAuthorized()) {
      showMessage(
        "Course পরিবর্তনের জন্য Admin authorization প্রয়োজন।",
        "error"
      );
      return;
    }

    const data = getFormData();

    if (!validateCourse(data)) return;

    Courses.saving = true;

    const saveButton = $("saveCourseButton");

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const now = firebase.firestore.FieldValue.serverTimestamp();

      const courseData = {
        name: data.name,
        description: data.description,
        price: Number(data.price),
        thumbnailUrl: data.thumbnailUrl,
        startDate: data.startDate || null,
        endDate: data.endDate || null,
        active: data.active,
        published: data.active,
        updatedAt: now,
        updatedBy: Courses.auth.currentUser.uid
      };

      if (Courses.editingCourseId) {
        const existingCourse = Courses.courses.find(function (course) {
          return course.id === Courses.editingCourseId;
        });

        if (!existingCourse) {
          showMessage(
            "Course পাওয়া যায়নি। তালিকা Refresh করে আবার চেষ্টা করো।",
            "warning"
          );
          return;
        }

        await Courses.db
          .collection("courses")
          .doc(Courses.editingCourseId)
          .update(courseData);

        showMessage(
          "Course সফলভাবে update হয়েছে।",
          "success"
        );
      } else {
        courseData.createdAt = now;
        courseData.createdBy = Courses.auth.currentUser.uid;

        await Courses.db
          .collection("courses")
          .add(courseData);

        showMessage(
          "নতুন Course সফলভাবে তৈরি হয়েছে।",
          "success"
        );
      }

      resetForm();
      $("courseEditorPanel").hidden = true;

      await loadCourses();
    } catch (error) {
      console.error("mNEET course save error:", error);

      if (error && error.code === "permission-denied") {
        showMessage(
          "Firebase Security Rules Course save করতে অনুমতি দিচ্ছে না। Admin authorization ও Firestore Rules পরীক্ষা করো।",
          "error"
        );
      } else {
        showMessage(
          "Course save করা যায়নি। Internet connection ও Firebase configuration পরীক্ষা করো।",
          "error"
        );
      }
    } finally {
      Courses.saving = false;

      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = Courses.editingCourseId
          ? "Update Course"
          : "Save Course";
      }
    }
  }

  function handleCourseAction(event) {
    const button = event.target.closest("[data-course-action]");

    if (!button) return;

    const action = button.getAttribute("data-course-action");
    const courseId = button.getAttribute("data-course-id");

    const course = Courses.courses.find(function (item) {
      return item.id === courseId;
    });

    if (!course) {
      showMessage(
        "Course পাওয়া যায়নি। Refresh করে আবার চেষ্টা করো।",
        "warning"
      );
      return;
    }

    if (action === "edit") {
      editCourse(course);
      return;
    }

    if (action === "delete") {
      deleteCourse(course);
    }
  }

  function editCourse(course) {
    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    Courses.editingCourseId = course.id;

    $("courseEditorTitle").textContent = "Edit Course";
    $("courseName").value = course.name || "";
    $("courseDescription").value = course.description || "";
    $("coursePrice").value =
      course.price == null ? "" : String(course.price);
    $("courseThumbnailUrl").value = course.thumbnailUrl || "";
    $("courseStartDate").value = getDateInputValue(course.startDate);
    $("courseEndDate").value = getDateInputValue(course.endDate);
    $("courseActive").checked =
      course.active !== false && course.published !== false;

    $("saveCourseButton").textContent = "Update Course";
    $("courseEditorPanel").hidden = false;

    updateThumbnailPreview();

    $("courseEditorPanel").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function deleteCourse(course) {
    if (!isAdminAuthorized()) {
      showMessage("Admin authorization প্রয়োজন।", "error");
      return;
    }

    const confirmed = window.confirm(
      'তুমি কি "' +
        course.name +
        '" Course-টি delete করতে চাও?\n\n' +
        "সতর্কতা: এই কাজটি Firestore-এ থাকা Course document মুছে দেবে। " +
        "এর subcollection, purchases বা অন্য সম্পর্কিত document স্বয়ংক্রিয়ভাবে মুছবে না।"
    );

    if (!confirmed) return;

    try {
      await Courses.db
        .collection("courses")
        .doc(course.id)
        .delete();

      showMessage(
        "Course document delete হয়েছে। সম্পর্কিত subcollection বা purchase আলাদাভাবে পরীক্ষা করতে হবে।",
        "success"
      );

      if (Courses.editingCourseId === course.id) {
        resetForm();
        $("courseEditorPanel").hidden = true;
      }

      await loadCourses();
    } catch (error) {
      console.error("mNEET course delete error:", error);

      showMessage(
        error && error.code === "permission-denied"
          ? "Firebase Security Rules Course delete করতে অনুমতি দিচ্ছে না।"
          : "Course delete করা যায়নি। Firebase connection পরীক্ষা করো।",
        "error"
      );
    }
  }

  function renderCourses() {
    const list = $("adminCoursesList");
    const summary = $("courseListSummary");

    if (!list) return;

    const sortedCourses = Courses.courses.slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(
        String(b.name || ""),
        "en",
        { sensitivity: "base" }
      );
    });

    if (summary) {
      summary.textContent =
        sortedCourses.length +
        (sortedCourses.length === 1
          ? " Course found"
          : " Courses found");
    }

    if (!sortedCourses.length) {
      list.innerHTML = `
        <div class="admin-empty-state">
          <h3>No Courses Yet</h3>
          <p>
            Create Course button-এ চাপ দিয়ে তোমার প্রথম Course তৈরি করো।
          </p>
        </div>
      `;

      updateDashboardCourseSelector();
      return;
    }

    list.innerHTML = sortedCourses.map(function (course) {
      const active =
        course.active !== false && course.published !== false;

      const image = course.thumbnailUrl
        ? `
          <img
            class="admin-course-image"
            src="${escapeHTML(course.thumbnailUrl)}"
            alt="${escapeHTML(course.name || "Course thumbnail")}"
            loading="lazy"
            data-course-image>
        `
        : `
          <div class="admin-course-image-placeholder">
            No Thumbnail
          </div>
        `;

      return `
        <article class="admin-course-card">
          ${image}

          <div class="admin-course-card-body">
            <h4>${escapeHTML(course.name || "Untitled Course")}</h4>

            <p class="admin-course-price">
              ${formatPrice(course.price)}
            </p>

            <p>
              ${escapeHTML(
                course.description
                  ? course.description.slice(0, 180)
                  : "No description added."
              )}
            </p>

            <p>
              <span class="admin-course-status">
                ${active ? "Active" : "Inactive"}
              </span>
            </p>

            <p>
              Start: ${escapeHTML(formatDate(course.startDate))}
            </p>

            <p>
              End: ${escapeHTML(formatDate(course.endDate))}
            </p>

            <div class="admin-course-card-actions">
              <button
                type="button"
                class="admin-primary-button"
                data-course-action="edit"
                data-course-id="${escapeHTML(course.id)}">
                Edit
              </button>

              <button
                type="button"
                class="admin-secondary-button"
                data-course-action="delete"
                data-course-id="${escapeHTML(course.id)}">
                Delete
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");

    list.querySelectorAll("[data-course-image]").forEach(function (image) {
      image.addEventListener("error", function () {
        const placeholder = document.createElement("div");
        placeholder.className = "admin-course-image-placeholder";
        placeholder.textContent = "Thumbnail unavailable";
        image.replaceWith(placeholder);
      });
    });

    updateDashboardCourseSelector();
  }

  function updateDashboardCourseSelector() {
    const selector = elements.courseSelector;

    if (!selector) return;

    const previousValue = selector.value;

    selector.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Courses";
    selector.appendChild(allOption);

    Courses.courses
      .filter(function (course) {
        return course.active !== false && course.published !== false;
      })
      .sort(function (a, b) {
        return String(a.name || "").localeCompare(String(b.name || ""));
      })
      .forEach(function (course) {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name || "Untitled Course";
        selector.appendChild(option);
      });

    if (
      previousValue === "all" ||
      Courses.courses.some(function (course) {
        return course.id === previousValue &&
          course.active !== false &&
          course.published !== false;
      })
    ) {
      selector.value = previousValue;
    } else {
      selector.value = "all";
    }

    selector.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function loadCourses() {
    if (Courses.loading) return;

    if (!isAdminAuthorized()) {
      const list = $("adminCoursesList");

      if (list) {
        list.textContent =
          "Course list দেখার জন্য Admin authorization প্রয়োজন।";
      }

      return;
    }

    Courses.loading = true;

    const list = $("adminCoursesList");

    if (list) {
      list.textContent = "Courses loading...";
    }

    try {
      const snapshot = await Courses.db
        .collection("courses")
        .get();

      Courses.courses = snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });

      renderCourses();
    } catch (error) {
      console.error("mNEET course load error:", error);

      if (list) {
        list.textContent =
          error && error.code === "permission-denied"
            ? "Firestore Rules Course list পড়তে অনুমতি দিচ্ছে না।"
            : "Course list load করা যায়নি। Connection পরীক্ষা করো।";
      }

      showMessage(
        "Course list load করা যায়নি। Firebase ও Security Rules পরীক্ষা করো।",
        "error"
      );
    } finally {
      Courses.loading = false;
    }
  }

  function init() {
    if (Courses.initialized) return;
    if (!elements.container) return;
    if (!getFirebaseServices()) return;

    Courses.initialized = true;

    renderManagementLayout();

    /*
     * Course list load when Admin opens the Courses section.
     */
    window.addEventListener("mneet:admin-page-change", function (event) {
      if (event.detail && event.detail.page === "courses") {
        loadCourses();
      }
    });

    /*
     * Load once on initialization so existing Courses can be displayed.
     */
    loadCourses();
  }

  Courses.load = loadCourses;
  Courses.refresh = loadCourses;
  Courses.edit = editCourse;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
