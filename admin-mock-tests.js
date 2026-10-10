/* =========================================================
   mNEET ADMIN MOCK TESTS — FILE 18

   Root file: admin-mock-tests.js

   Features:
   - Create, edit and delete mock tests
   - Course selection
   - Test description
   - Duration, total marks and passing marks
   - Start and end dates
   - Active/inactive control
   - Firestore persistence
   - Admin authorization
   - Green and white UI

   No Teacher Panel.
========================================================= */

(function () {
  "use strict";

  if (window.MNEETMockTestsAdmin) return;

  const STATE = {
    db: null,
    auth: null,
    initialized: false,
    initializing: false,
    authorized: false,
    courses: [],
    tests: [],
    editingId: null
  };

  const COLLECTION = "mockTests";

  const COLORS = {
    background: "#071A12",
    card: "#0D2419",
    green: "#16A34A",
    lightGreen: "#22C55E",
    white: "#FFFFFF",
    muted: "#D1D5DB",
    border: "#28513A",
    input: "#10291D"
  };

  function byId(id) {
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

  function getUserId() {
    return STATE.auth && STATE.auth.currentUser
      ? STATE.auth.currentUser.uid
      : "";
  }

  function getTimestamp() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  }

  function testsCollection() {
    return STATE.db.collection(COLLECTION);
  }

  function showMessage(message, isError) {
    const root = byId("mockTestsContent");
    if (!root) return;

    let box = byId("mockTestsAdminMessage");

    if (!box) {
      box = document.createElement("div");
      box.id = "mockTestsAdminMessage";
      box.setAttribute("role", "status");
      root.prepend(box);
    }

    box.textContent = message;

    box.style.cssText = [
      "padding:12px 14px",
      "margin:10px 0",
      "border:1px solid " + COLORS.border,
      "border-radius:10px",
      "background:" + COLORS.card,
      "color:" + COLORS.white,
      "line-height:1.5"
    ].join(";");

    if (isError) {
      box.style.borderColor = COLORS.green;
    }
  }

  function initializeFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.ready &&
      window.MNEETFirebase.auth &&
      window.MNEETFirebase.db
    ) {
      STATE.auth = window.MNEETFirebase.auth;
      STATE.db = window.MNEETFirebase.db;
      return true;
    }

    if (
      window.firebase &&
      window.firebase.apps &&
      window.firebase.apps.length
    ) {
      STATE.auth = window.firebase.auth();
      STATE.db = window.firebase.firestore();
      return true;
    }

    showMessage("Firebase প্রস্তুত নয়। firebase.js পরীক্ষা করো।", true);
    return false;
  }

  async function verifyAdmin() {
    if (!initializeFirebase()) return false;

    const user = STATE.auth.currentUser;

    if (!user) {
      STATE.authorized = false;
      showMessage("এই অংশ ব্যবহার করতে Admin হিসেবে Login করো।", true);
      return false;
    }

    try {
      const adminDoc = await STATE.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!adminDoc.exists || adminDoc.data().active !== true) {
        STATE.authorized = false;
        showMessage("এই Account-এর Admin অনুমতি নেই।", true);
        return false;
      }

      STATE.authorized = true;
      return true;
    } catch (error) {
      STATE.authorized = false;

      showMessage(
        "Admin অনুমতি যাচাই করা যায়নি: " +
          (error.message || "অজানা সমস্যা"),
        true
      );

      return false;
    }
  }

  function fieldStyle() {
    return [
      "width:100%",
      "box-sizing:border-box",
      "padding:11px 12px",
      "border:1px solid " + COLORS.border,
      "border-radius:9px",
      "background:" + COLORS.input,
      "color:" + COLORS.white,
      "font-size:14px"
    ].join(";");
  }

  function labelStyle() {
    return [
      "display:block",
      "margin-bottom:7px",
      "font-size:13px",
      "font-weight:700",
      "color:" + COLORS.muted
    ].join(";");
  }

  function buttonStyle(primary) {
    return [
      "padding:10px 14px",
      "border:1px solid " + COLORS.green,
      "border-radius:9px",
      "background:" + (primary ? COLORS.green : COLORS.card),
      "color:" + COLORS.white,
      "font-weight:700",
      "cursor:pointer"
    ].join(";");
  }

  function inputField(label, id, type, placeholder) {
    return `
      <div style="margin-bottom:14px;min-width:0">
        <label for="${id}" style="${labelStyle()}">
          ${escapeHTML(label)}
        </label>

        <input
          id="${id}"
          type="${type || "text"}"
          placeholder="${escapeHTML(placeholder || "")}"
          style="${fieldStyle()}"
        >
      </div>
    `;
  }

  function textAreaField(label, id, placeholder) {
    return `
      <div style="margin-bottom:14px;min-width:0">
        <label for="${id}" style="${labelStyle()}">
          ${escapeHTML(label)}
        </label>

        <textarea
          id="${id}"
          rows="3"
          placeholder="${escapeHTML(placeholder || "")}"
          style="${fieldStyle()}resize:vertical"
        ></textarea>
      </div>
    `;
  }

  function selectField(label, id, items, placeholder) {
    return `
      <div style="margin-bottom:14px;min-width:0">
        <label for="${id}" style="${labelStyle()}">
          ${escapeHTML(label)}
        </label>

        <select id="${id}" style="${fieldStyle()}">
          <option value="">
            ${escapeHTML(placeholder || "নির্বাচন করো")}
          </option>

          ${items.map(function (item) {
            return `
              <option value="${escapeHTML(item.id)}">
                ${escapeHTML(item.name || item.title || item.id)}
              </option>
            `;
          }).join("")}
        </select>
      </div>
    `;
  }

  function createInterface() {
    const root = byId("mockTestsContent");

    if (!root) {
      console.warn(
        "mNEET Mock Tests: #mockTestsContent পাওয়া যায়নি।"
      );
      return false;
    }

    root.innerHTML = `
      <style>
        #mockTestsContent * {
          box-sizing:border-box;
        }

        #mockTestsContent .mt-card {
          padding:16px;
          margin-bottom:16px;
          background:${COLORS.card};
          border:1px solid ${COLORS.border};
          border-radius:14px;
          color:${COLORS.white};
        }

        #mockTestsContent .mt-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        #mockTestsContent .mt-muted {
          color:${COLORS.muted};
          font-size:12px;
          line-height:1.6;
        }

        #mockTestsContent .mt-item {
          margin-top:12px;
          padding:14px;
          background:${COLORS.background};
          border:1px solid ${COLORS.border};
          border-radius:11px;
          overflow-wrap:anywhere;
        }

        #mockTestsContent .mt-actions {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:12px;
        }

        #mockTestsContent .mt-btn {
          ${buttonStyle(false)}
        }

        #mockTestsContent .mt-primary {
          ${buttonStyle(true)}
        }

        @media(max-width:650px) {
          #mockTestsContent .mt-grid {
            grid-template-columns:minmax(0,1fr);
          }

          #mockTestsContent .mt-card {
            padding:12px;
          }
        }
      </style>

      <div id="mockTestsAdminMessage"
           role="status"
           style="color:${COLORS.white}">
        Mock Tests Management
      </div>

      <section class="mt-card">
        <h2 style="margin-top:0">Mock Tests</h2>

        <p class="mt-muted">
          NEET Mock Test তৈরি ও পরিচালনার জন্য এখানে তথ্য সংরক্ষণ করো।
        </p>

        <div class="mt-grid">
          <div id="mtCourseSlot"></div>

          <div style="margin-bottom:14px">
            <label for="mtFilterStatus" style="${labelStyle()}">
              Status Filter
            </label>

            <select id="mtFilterStatus" style="${fieldStyle()}">
              <option value="all">All Tests</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <div class="mt-actions">
          <button type="button" id="mtLoadButton"
                  class="mt-primary">
            Load Mock Tests
          </button>

          <button type="button" id="mtNewButton"
                  class="mt-btn">
            + Create Mock Test
          </button>
        </div>
      </section>

      <section id="mtEditor" class="mt-card" hidden>
        <h3 id="mtEditorHeading" style="margin-top:0">
          Create Mock Test
        </h3>

        <form id="mtForm">
          ${inputField("Test Name", "mtName", "text", "NEET Full Syllabus Mock Test")}

          ${textAreaField("Description", "mtDescription", "Test সম্পর্কে বিবরণ")}

          <div class="mt-grid">
            ${inputField("Duration (Minutes)", "mtDuration", "number", "180")}

            ${inputField("Total Marks", "mtTotalMarks", "number", "720")}

            ${inputField("Passing Marks", "mtPassingMarks", "number", "0")}

            ${inputField("Question Count", "mtQuestionCount", "number", "180")}
          </div>

          <div class="mt-grid">
            ${inputField("Start Date & Time", "mtStartDate", "datetime-local", "")}

            ${inputField("End Date & Time", "mtEndDate", "datetime-local", "")}
          </div>

          <div style="margin-bottom:14px">
            <label for="mtActive" style="${labelStyle()}">
              Test Status
            </label>

            <select id="mtActive" style="${fieldStyle()}">
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>

          <div class="mt-actions">
            <button type="submit" id="mtSaveButton"
                    class="mt-primary">
              Save Mock Test
            </button>

            <button type="button" id="mtCancelButton"
                    class="mt-btn">
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section class="mt-card">
        <div style="display:flex;justify-content:space-between;
                    align-items:center;gap:10px;flex-wrap:wrap">
          <h3 style="margin:0">Saved Mock Tests</h3>
          <span id="mtCount" class="mt-muted">0 Tests</span>
        </div>

        <div id="mtList" style="margin-top:12px">
          <p class="mt-muted">Mock Test তালিকা এখানে দেখানো হবে।</p>
        </div>
      </section>
    `;

    return true;
  }

  async function loadCourses() {
    const snapshot = await STATE.db.collection("courses").get();

    STATE.courses = snapshot.docs.map(function (doc) {
      return Object.assign({ id: doc.id }, doc.data());
    }).filter(function (course) {
      return course.active !== false &&
        course.published !== false;
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    const slot = byId("mtCourseSlot");

    slot.innerHTML = selectField(
      "Course",
      "mtCourse",
      STATE.courses,
      "Course নির্বাচন করো"
    );

    if (STATE.courses.length) {
      byId("mtCourse").value = STATE.courses[0].id;
    }
  }

  async function loadTests() {
    if (!(await verifyAdmin())) return;

    try {
      const snapshot = await testsCollection().get();

      STATE.tests = snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });

      STATE.tests.sort(function (a, b) {
        const aTime = a.createdAt && a.createdAt.toMillis
          ? a.createdAt.toMillis()
          : 0;

        const bTime = b.createdAt && b.createdAt.toMillis
          ? b.createdAt.toMillis()
          : 0;

        return bTime - aTime;
      });

      renderTests();
    } catch (error) {
      showMessage(
        "Mock Test লোড করা যায়নি: " + (error.message || ""),
        true
      );
    }
  }

  function courseName(courseId) {
    const course = STATE.courses.find(function (item) {
      return item.id === courseId;
    });

    return course ? course.name : "Course";
  }

  function renderTests() {
    const root = byId("mtList");
    const count = byId("mtCount");

    if (!root || !count) return;

    const filter = byId("mtFilterStatus").value;
    const selectedCourse = byId("mtCourse").value;

    let list = STATE.tests.slice();

    if (selectedCourse) {
      list = list.filter(function (test) {
        return test.courseId === selectedCourse;
      });
    }

    if (filter === "active") {
      list = list.filter(function (test) {
        return test.active === true;
      });
    } else if (filter === "inactive") {
      list = list.filter(function (test) {
        return test.active !== true;
      });
    }

    count.textContent = list.length + " Tests";

    if (!list.length) {
      root.innerHTML = `
        <p class="mt-muted">
          এই Selection-এ কোনো Mock Test নেই।
        </p>
      `;
      return;
    }

    root.innerHTML = list.map(function (test) {
      return `
        <article class="mt-item">
          <strong>${escapeHTML(test.name || "Untitled Test")}</strong>

          <p class="mt-muted">
            Course: ${escapeHTML(courseName(test.courseId))}
          </p>

          <p class="mt-muted">
            Duration: ${escapeHTML(test.durationMinutes)} minutes
            · Total Marks: ${escapeHTML(test.totalMarks)}
            · Questions: ${escapeHTML(test.questionCount)}
          </p>

          <p class="mt-muted">
            Passing Marks: ${escapeHTML(test.passingMarks)}
          </p>

          <p class="mt-muted">
            Status: ${test.active === true ? "Active" : "Inactive"}
          </p>

          ${
            test.description
              ? `<p>${escapeHTML(test.description)}</p>`
              : ""
          }

          <div class="mt-actions">
            <button type="button"
                    class="mt-btn"
                    data-action="edit"
                    data-id="${escapeHTML(test.id)}">
              Edit
            </button>

            <button type="button"
                    class="mt-btn"
                    data-action="toggle"
                    data-id="${escapeHTML(test.id)}">
              ${test.active === true ? "Deactivate" : "Activate"}
            </button>

            <button type="button"
                    class="mt-btn"
                    data-action="delete"
                    data-id="${escapeHTML(test.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function openEditor(test) {
    STATE.editingId = test ? test.id : null;

    byId("mtEditor").hidden = false;

    byId("mtEditorHeading").textContent = test
      ? "Edit Mock Test"
      : "Create Mock Test";

    byId("mtName").value = test ? test.name || "" : "";
    byId("mtDescription").value = test ? test.description || "" : "";

    byId("mtDuration").value = test
      ? Number(test.durationMinutes || 180)
      : 180;

    byId("mtTotalMarks").value = test
      ? Number(test.totalMarks || 720)
      : 720;

    byId("mtPassingMarks").value = test
      ? Number(test.passingMarks || 0)
      : 0;

    byId("mtQuestionCount").value = test
      ? Number(test.questionCount || 180)
      : 180;

    byId("mtStartDate").value = test
      ? test.startDate || ""
      : "";

    byId("mtEndDate").value = test
      ? test.endDate || ""
      : "";

    byId("mtActive").value = test && test.active === false
      ? "false"
      : "true";

    if (test && test.courseId) {
      byId("mtCourse").value = test.courseId;
    }

    byId("mtEditor").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeEditor() {
    STATE.editingId = null;
    byId("mtEditor").hidden = true;
    byId("mtForm").reset();
  }

  function readForm() {
    const name = byId("mtName").value.trim();
    const description = byId("mtDescription").value.trim();
    const courseId = byId("mtCourse").value;

    const durationMinutes = Number(byId("mtDuration").value);
    const totalMarks = Number(byId("mtTotalMarks").value);
    const passingMarks = Number(byId("mtPassingMarks").value);
    const questionCount = Number(byId("mtQuestionCount").value);

    const startDate = byId("mtStartDate").value;
    const endDate = byId("mtEndDate").value;

    const active = byId("mtActive").value === "true";

    if (!courseId) {
      throw new Error("Course নির্বাচন করো।");
    }

    if (!name) {
      throw new Error("Mock Test-এর নাম লিখো।");
    }

    if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
      throw new Error("Duration অন্তত 1 মিনিট হতে হবে।");
    }

    if (!Number.isFinite(totalMarks) || totalMarks < 1) {
      throw new Error("Total Marks 1 বা তার বেশি হতে হবে।");
    }

    if (
      !Number.isFinite(passingMarks) ||
      passingMarks < 0 ||
      passingMarks > totalMarks
    ) {
      throw new Error("Passing Marks 0 থেকে Total Marks-এর মধ্যে হতে হবে।");
    }

    if (!Number.isInteger(questionCount) || questionCount < 1) {
      throw new Error("Question Count অন্তত 1 হতে হবে।");
    }

    if (startDate && endDate) {
      if (new Date(endDate).getTime() <= new Date(startDate).getTime()) {
        throw new Error("End Date অবশ্যই Start Date-এর পরে হতে হবে।");
      }
    }

    return {
      courseId: courseId,
      name: name,
      description: description,
      durationMinutes: durationMinutes,
      totalMarks: totalMarks,
      passingMarks: passingMarks,
      questionCount: questionCount,
      startDate: startDate,
      endDate: endDate,
      active: active
    };
  }

  async function saveTest(event) {
    event.preventDefault();

    if (!(await verifyAdmin())) return;

    let data;

    try {
      data = readForm();
    } catch (error) {
      showMessage(error.message, true);
      return;
    }

    const saveButton = byId("mtSaveButton");
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const userId = getUserId();

      const ref = STATE.editingId
        ? testsCollection().doc(STATE.editingId)
        : testsCollection().doc();

      const existing = STATE.editingId
        ? STATE.tests.find(function (test) {
            return test.id === STATE.editingId;
          })
        : null;

      const payload = Object.assign({}, data, {
        updatedAt: getTimestamp(),
        updatedBy: userId
      });

      if (!existing) {
        payload.createdAt = getTimestamp();
        payload.createdBy = userId;
      }

      await ref.set(payload, { merge: true });

      closeEditor();
      await loadTests();

      showMessage(
        existing
          ? "Mock Test সফলভাবে Update হয়েছে।"
          : "Mock Test সফলভাবে তৈরি হয়েছে।"
      );
    } catch (error) {
      showMessage(
        "Mock Test Save করা যায়নি: " + (error.message || ""),
        true
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Mock Test";
    }
  }

  async function toggleTest(id) {
    if (!(await verifyAdmin())) return;

    const test = STATE.tests.find(function (item) {
      return item.id === id;
    });

    if (!test) return;

    try {
      await testsCollection().doc(id).update({
        active: test.active !== true,
        updatedAt: getTimestamp(),
        updatedBy: getUserId()
      });

      await loadTests();
      showMessage("Mock Test Status Update হয়েছে।");
    } catch (error) {
      showMessage(
        "Status Update করা যায়নি: " + (error.message || ""),
        true
      );
    }
  }

  async function deleteTest(id) {
    if (!(await verifyAdmin())) return;

    const test = STATE.tests.find(function (item) {
      return item.id === id;
    });

    if (!test) return;

    if (!window.confirm(
      "এই Mock Test-এর তথ্য Delete করবে? এর সঙ্গে যুক্ত প্রশ্ন বা Results আলাদাভাবে পরীক্ষা করো।"
    )) {
      return;
    }

    try {
      await testsCollection().doc(id).delete();

      await loadTests();

      showMessage(
        "Mock Test-এর রেকর্ড Delete হয়েছে। যুক্ত প্রশ্ন বা Results স্বয়ংক্রিয়ভাবে Delete হয়নি।"
      );
    } catch (error) {
      showMessage(
        "Mock Test Delete করা যায়নি: " + (error.message || ""),
        true
      );
    }
  }

  function setupEvents() {
    byId("mtLoadButton").addEventListener("click", loadTests);

    byId("mtNewButton").addEventListener("click", async function () {
      if (!(await verifyAdmin())) return;

      if (!STATE.courses.length) {
        showMessage("প্রথমে একটি Course তৈরি করো।", true);
        return;
      }

      openEditor(null);
    });

    byId("mtCancelButton").addEventListener("click", closeEditor);
    byId("mtForm").addEventListener("submit", saveTest);

    byId("mtFilterStatus").addEventListener("change", renderTests);
    byId("mtCourseSlot").addEventListener("change", renderTests);

    byId("mtList").addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const action = button.dataset.action;
      const id = button.dataset.id;

      if (action === "edit") {
        if (!(await verifyAdmin())) return;

        const test = STATE.tests.find(function (item) {
          return item.id === id;
        });

        if (test) openEditor(test);
      }

      if (action === "toggle") {
        await toggleTest(id);
      }

      if (action === "delete") {
        await deleteTest(id);
      }
    });
  }

  async function initialize() {
    if (STATE.initializing) return;

    STATE.initializing = true;

    try {
      if (!createInterface()) return;
      if (!initializeFirebase()) return;
      if (!(await verifyAdmin())) return;

      await loadCourses();
      setupEvents();
      await loadTests();

      STATE.initialized = true;
    } catch (error) {
      showMessage(
        "Mock Tests Management চালু করা যায়নি: " +
          (error.message || "অজানা সমস্যা"),
        true
      );
    } finally {
      STATE.initializing = false;
    }
  }

  function onPageChange(event) {
    if (!event || !event.detail) return;

    if (event.detail.page === "mock-tests") {
      if (!STATE.initialized) {
        initialize();
      } else {
        verifyAdmin().then(function (authorized) {
          if (authorized) loadTests();
        });
      }
    }
  }

  window.MNEETMockTestsAdmin = {
    initialize: initialize,
    reload: loadTests
  };

  document.addEventListener("DOMContentLoaded", initialize);

  document.addEventListener(
    "mneet:admin-page-change",
    onPageChange
  );
})();
