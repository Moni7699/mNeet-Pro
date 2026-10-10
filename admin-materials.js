/* =========================================================
   mNEET ADMIN MATERIALS — FILE 17

   Manages:
   - Topic Notes PDFs
   - Chapter-wise NCERT PDFs
   - Chapter-wise PYQ PDFs
   - Upload, replace, delete and list
   - Admin-only access
   - Firestore metadata + Firebase Storage files

   Root file: admin-materials.js
========================================================= */

(function () {
  "use strict";

  if (window.MNEETMaterialsAdmin) return;

  const STATE = {
    db: null,
    auth: null,
    initialized: false,
    initializing: false,
    authorized: false,
    activeTab: "notes",
    courses: [],
    chapters: [],
    topics: [],
    materials: [],
    loading: false
  };

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

  const MATERIAL_TYPES = {
    notes: {
      label: "Topic Notes PDF",
      collection: "notes",
      scope: "topic",
      description: "Topic অনুযায়ী Notes PDF পরিচালনা করো।"
    },
    ncert: {
      label: "NCERT PDF",
      collection: "ncert",
      scope: "chapter",
      description: "Chapter অনুযায়ী NCERT PDF পরিচালনা করো।"
    },
    pyq: {
      label: "PYQ PDF",
      collection: "pyq",
      scope: "chapter",
      description: "Chapter অনুযায়ী PYQ PDF পরিচালনা করো।"
    }
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

  function currentUserId() {
    return STATE.auth && STATE.auth.currentUser
      ? STATE.auth.currentUser.uid
      : "";
  }

  function timestamp() {
    return window.firebase.firestore.FieldValue.serverTimestamp();
  }

  function collection(name) {
    return STATE.db.collection(name);
  }

  function showMessage(message, isError) {
    const root = byId("materialsContent");
    if (!root) return;

    let box = byId("materialsAdminMessage");

    if (!box) {
      box = document.createElement("div");
      box.id = "materialsAdminMessage";
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

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.ready &&
      window.MNEETFirebase.db &&
      window.MNEETFirebase.auth
    ) {
      STATE.db = window.MNEETFirebase.db;
      STATE.auth = window.MNEETFirebase.auth;
      return true;
    }

    if (
      window.firebase &&
      window.firebase.apps &&
      window.firebase.apps.length
    ) {
      STATE.db = window.firebase.firestore();
      STATE.auth = window.firebase.auth();
      return true;
    }

    showMessage("Firebase প্রস্তুত নয়। firebase.js পরীক্ষা করো।", true);
    return false;
  }

  async function authorizeAdmin() {
    if (!getFirebase()) return false;

    const user = STATE.auth.currentUser;

    if (!user) {
      STATE.authorized = false;
      showMessage("এই অংশ ব্যবহার করতে Admin হিসেবে Login করো।", true);
      return false;
    }

    try {
      const doc = await collection("admins").doc(user.uid).get();

      if (!doc.exists || doc.data().active !== true) {
        STATE.authorized = false;
        showMessage("তোমার Account-এ Admin অনুমতি নেই।", true);
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
      return item.active !== false && item.published !== false;
    });
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
      "color:" + COLORS.muted,
      "font-size:13px",
      "font-weight:700"
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

  function field(label, id, type, placeholder) {
    return `
      <div style="margin-bottom:14px;min-width:0">
        <label for="${id}" style="${labelStyle()}">
          ${escapeHTML(label)}
        </label>
        <input id="${id}"
               type="${type || "text"}"
               placeholder="${escapeHTML(placeholder || "")}"
               style="${fieldStyle()}">
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
          <option value="">${escapeHTML(placeholder || "Select")}</option>
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
    const root = byId("materialsContent");

    if (!root) {
      console.warn(
        "mNEET Materials: #materialsContent পাওয়া যায়নি।"
      );
      return false;
    }

    root.innerHTML = `
      <style>
        #materialsContent * {
          box-sizing:border-box;
        }

        #materialsContent .mat-card {
          background:${COLORS.card};
          border:1px solid ${COLORS.border};
          border-radius:14px;
          padding:16px;
          margin-bottom:16px;
          color:${COLORS.white};
        }

        #materialsContent .mat-grid {
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          gap:12px;
        }

        #materialsContent .mat-tabs {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin:14px 0;
        }

        #materialsContent .mat-tab {
          ${buttonStyle(false)}
        }

        #materialsContent .mat-tab.active {
          background:${COLORS.green};
        }

        #materialsContent .mat-item {
          padding:13px;
          margin-top:10px;
          border:1px solid ${COLORS.border};
          border-radius:10px;
          background:${COLORS.background};
          overflow-wrap:anywhere;
        }

        #materialsContent .mat-muted {
          color:${COLORS.muted};
          font-size:12px;
          line-height:1.6;
        }

        #materialsContent .mat-actions {
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin-top:12px;
        }

        #materialsContent .mat-btn {
          ${buttonStyle(false)}
        }

        #materialsContent .mat-primary {
          ${buttonStyle(true)}
        }

        #materialsContent .mat-link {
          color:${COLORS.lightGreen};
          overflow-wrap:anywhere;
        }

        @media(max-width:650px) {
          #materialsContent .mat-grid {
            grid-template-columns:minmax(0,1fr);
          }

          #materialsContent .mat-card {
            padding:12px;
          }
        }
      </style>

      <div id="materialsAdminMessage"
           role="status"
           style="color:${COLORS.white}">
        Materials Management
      </div>

      <section class="mat-card">
        <h2 style="margin:0 0 8px">
          Study Materials
        </h2>

        <p class="mat-muted">
          Notes, NCERT ও PYQ PDF পরিচালনার জন্য নিচের Tab নির্বাচন করো।
        </p>

        <div class="mat-tabs">
          <button type="button" class="mat-tab active"
                  data-material-tab="notes">
            Topic Notes
          </button>

          <button type="button" class="mat-tab"
                  data-material-tab="ncert">
            NCERT
          </button>

          <button type="button" class="mat-tab"
                  data-material-tab="pyq">
            PYQ
          </button>
        </div>

        <p id="matTabDescription" class="mat-muted"></p>

        <div class="mat-grid">
          <div id="matCourseSlot"></div>
          <div id="matChapterSlot"></div>
        </div>

        <div id="matTopicSlot"></div>

        <div class="mat-actions">
          <button type="button" id="matLoadButton"
                  class="mat-primary">
            Load Materials
          </button>

          <button type="button" id="matNewButton"
                  class="mat-btn">
            + Add PDF
          </button>
        </div>
      </section>

      <section id="matEditor" class="mat-card" hidden>
        <h3 id="matEditorTitle" style="margin-top:0">
          Add PDF
        </h3>

        <form id="matForm">
          ${field("PDF Title", "matTitle", "text", "PDF-এর নাম লিখো")}

          <div style="margin-bottom:14px">
            <label for="matFile" style="${labelStyle()}">
              PDF File
            </label>

            <input id="matFile"
                   type="file"
                   accept="application/pdf,.pdf"
                   style="${fieldStyle()}">

            <p class="mat-muted">
              সর্বোচ্চ ফাইল সাইজ 20 MB। Firebase Storage সক্রিয় থাকতে হবে।
              Replace করার সময় নতুন PDF নির্বাচন করো।
            </p>
          </div>

          <div class="mat-actions">
            <button type="submit" id="matSaveButton"
                    class="mat-primary">
              Save PDF
            </button>

            <button type="button" id="matCancelButton"
                    class="mat-btn">
              Cancel
            </button>
          </div>
        </form>
      </section>

      <section class="mat-card">
        <div style="display:flex;justify-content:space-between;
                    gap:10px;flex-wrap:wrap;align-items:center">
          <h3 style="margin:0">Saved PDFs</h3>
          <span id="matCount" class="mat-muted">0 PDFs</span>
        </div>

        <div id="matList" style="margin-top:12px">
          <p class="mat-muted">
            Course ও Chapter নির্বাচন করে Load Materials চাপো।
          </p>
        </div>
      </section>
    `;

    return true;
  }

  function renderSelectSlot(slotId, label, id, items, placeholder) {
    const slot = byId(slotId);
    if (!slot) return;

    slot.innerHTML = selectField(label, id, items, placeholder);
  }

  async function loadCourses() {
    STATE.courses = activeItems(
      await readCollection("courses")
    ).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

    renderSelectSlot(
      "matCourseSlot",
      "Course",
      "matCourse",
      STATE.courses,
      "Course নির্বাচন করো"
    );

    if (STATE.courses.length) {
      byId("matCourse").value = STATE.courses[0].id;
      await loadChapters();
    } else {
      STATE.chapters = [];
      STATE.topics = [];
      renderSelectSlot("matChapterSlot", "Chapter", "matChapter", [], "Chapter নেই");
      renderSelectSlot("matTopicSlot", "Topic", "matTopic", [], "Topic নেই");
      renderMaterials();
      showMessage("প্রথমে Courses অংশে একটি Course তৈরি করো।");
    }
  }

  async function loadChapters() {
    const courseId = byId("matCourse").value;

    STATE.chapters = [];
    STATE.topics = [];

    renderSelectSlot("matTopicSlot", "Topic", "matTopic", [], "Topic নির্বাচন করো");

    if (!courseId) {
      renderSelectSlot("matChapterSlot", "Chapter", "matChapter", [], "Chapter নেই");
      renderMaterials();
      return;
    }

    STATE.chapters = activeItems(
      await readCollection("chapters", [
        ["courseId", "==", courseId]
      ])
    ).sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });

    renderSelectSlot(
      "matChapterSlot",
      "Chapter",
      "matChapter",
      STATE.chapters,
      "Chapter নির্বাচন করো"
    );

    if (STATE.chapters.length) {
      byId("matChapter").value = STATE.chapters[0].id;
      await loadTopics();
    } else {
      renderMaterials();
      showMessage("এই Course-এ Chapter পাওয়া যায়নি।");
    }
  }

  async function loadTopics() {
    const courseId = byId("matCourse").value;
    const chapterId = byId("matChapter").value;

    STATE.topics = [];

    if (!courseId || !chapterId) {
      renderSelectSlot("matTopicSlot", "Topic", "matTopic", [], "Topic নেই");
      renderMaterials();
      return;
    }

    if (STATE.activeTab !== "notes") {
      renderSelectSlot("matTopicSlot", "Topic", "matTopic", [], "Chapter-wise PDF");
      return;
    }

    STATE.topics = activeItems(
      await readCollection("topics", [
        ["courseId", "==", courseId],
        ["chapterId", "==", chapterId]
      ])
    ).sort(function (a, b) {
      return Number(a.order || 0) - Number(b.order || 0);
    });

    renderSelectSlot(
      "matTopicSlot",
      "Topic",
      "matTopic",
      STATE.topics,
      "Topic নির্বাচন করো"
    );

    if (STATE.topics.length) {
      byId("matTopic").value = STATE.topics[0].id;
    }
  }

  function currentScope() {
    const courseId = byId("matCourse").value;
    const chapterId = byId("matChapter").value;
    const topicId = STATE.activeTab === "notes"
      ? byId("matTopic").value
      : "";

    return {
      courseId: courseId,
      chapterId: chapterId,
      topicId: topicId
    };
  }

  async function loadMaterials() {
    if (!(await authorizeAdmin())) return;

    const scope = currentScope();

    if (!scope.courseId || !scope.chapterId) {
      showMessage("Course ও Chapter নির্বাচন করো।", true);
      return;
    }

    if (STATE.activeTab === "notes" && !scope.topicId) {
      showMessage("Notes PDF-এর জন্য Topic নির্বাচন করো।", true);
      return;
    }

    STATE.loading = true;

    try {
      const config = MATERIAL_TYPES[STATE.activeTab];

      const filters = [
        ["courseId", "==", scope.courseId],
        ["chapterId", "==", scope.chapterId]
      ];

      if (config.scope === "topic") {
        filters.push(["topicId", "==", scope.topicId]);
      }

      STATE.materials = await readCollection(config.collection, filters);

      STATE.materials.sort(function (a, b) {
        const aTime = a.createdAt && a.createdAt.toMillis
          ? a.createdAt.toMillis()
          : 0;

        const bTime = b.createdAt && b.createdAt.toMillis
          ? b.createdAt.toMillis()
          : 0;

        return bTime - aTime;
      });

      renderMaterials();
      showMessage("PDF তালিকা আপডেট হয়েছে।");
    } catch (error) {
      showMessage(
        "PDF তালিকা লোড করা যায়নি: " + (error.message || ""),
        true
      );
    } finally {
      STATE.loading = false;
    }
  }

  function renderMaterials() {
    const root = byId("matList");
    const count = byId("matCount");

    if (!root || !count) return;

    count.textContent = STATE.materials.length + " PDFs";

    if (!STATE.materials.length) {
      root.innerHTML = `
        <p class="mat-muted">
          এই Selection-এ কোনো PDF পাওয়া যায়নি।
        </p>
      `;
      return;
    }

    root.innerHTML = STATE.materials.map(function (item) {
      const url = item.fileUrl || item.pdfUrl || "";
      const title = item.title || "Untitled PDF";

      return `
        <article class="mat-item">
          <strong>${escapeHTML(title)}</strong>

          <p class="mat-muted">
            Type: ${escapeHTML(STATE.activeTab.toUpperCase())}
          </p>

          ${
            url
              ? `<p>
                   <a class="mat-link"
                      href="${escapeHTML(url)}"
                      target="_blank"
                      rel="noopener noreferrer">
                     Open PDF
                   </a>
                 </p>`
              : `<p class="mat-muted">
                   এই রেকর্ডে PDF URL পাওয়া যায়নি।
                 </p>`
          }

          <div class="mat-actions">
            <button type="button"
                    class="mat-btn"
                    data-material-action="replace"
                    data-id="${escapeHTML(item.id)}">
              Replace PDF
            </button>

            <button type="button"
                    class="mat-btn"
                    data-material-action="delete"
                    data-id="${escapeHTML(item.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  function openEditor(existingItem) {
    const editor = byId("matEditor");

    editor.hidden = false;
    editor.dataset.editingId = existingItem ? existingItem.id : "";
    editor.dataset.oldStoragePath = existingItem
      ? existingItem.storagePath || ""
      : "";

    byId("matEditorTitle").textContent = existingItem
      ? "Replace PDF"
      : "Add PDF";

    byId("matTitle").value = existingItem
      ? existingItem.title || ""
      : "";

    byId("matFile").value = "";

    editor.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function closeEditor() {
    byId("matEditor").hidden = true;
    byId("matEditor").dataset.editingId = "";
    byId("matEditor").dataset.oldStoragePath = "";
    byId("matForm").reset();
  }

  function getStorage() {
    if (
      !window.firebase ||
      typeof window.firebase.storage !== "function"
    ) {
      throw new Error(
        "Firebase Storage SDK লোড করা নেই। admin.html-এ firebase-storage-compat.js যোগ করো।"
      );
    }

    return window.firebase.storage();
  }

  async function uploadPDF(file, documentId) {
    if (!file) {
      throw new Error("একটি PDF ফাইল নির্বাচন করো।");
    }

    const fileName = file.name || "";

    if (
      file.type !== "application/pdf" &&
      !fileName.toLowerCase().endsWith(".pdf")
    ) {
      throw new Error("শুধুমাত্র PDF ফাইল আপলোড করা যাবে।");
    }

    if (file.size > 20 * 1024 * 1024) {
      throw new Error("PDF-এর সর্বোচ্চ সাইজ 20 MB হতে পারবে।");
    }

    const storage = getStorage();

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");

    const path =
      "study-materials/" +
      STATE.activeTab +
      "/" +
      currentUserId() +
      "/" +
      documentId +
      "/" +
      Date.now() +
      "_" +
      safeName;

    const ref = storage.ref().child(path);

    await ref.put(file, {
      contentType: "application/pdf"
    });

    return {
      fileUrl: await ref.getDownloadURL(),
      storagePath: path
    };
  }

  async function saveMaterial(event) {
    event.preventDefault();

    if (!(await authorizeAdmin())) return;

    const config = MATERIAL_TYPES[STATE.activeTab];
    const title = byId("matTitle").value.trim();
    const file = byId("matFile").files[0] || null;
    const editor = byId("matEditor");

    const editingId = editor.dataset.editingId || "";
    const oldStoragePath = editor.dataset.oldStoragePath || "";

    const scope = currentScope();

    if (!title) {
      showMessage("PDF-এর Title লিখো।", true);
      return;
    }

    if (!scope.courseId || !scope.chapterId) {
      showMessage("Course ও Chapter নির্বাচন করো।", true);
      return;
    }

    if (config.scope === "topic" && !scope.topicId) {
      showMessage("Notes PDF-এর জন্য Topic নির্বাচন করো।", true);
      return;
    }

    if (!editingId && !file) {
      showMessage("PDF ফাইল নির্বাচন করো।", true);
      return;
    }

    const saveButton = byId("matSaveButton");
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      const documentRef = editingId
        ? collection(config.collection).doc(editingId)
        : collection(config.collection).doc();

      const existing = editingId
        ? STATE.materials.find(function (item) {
            return item.id === editingId;
          })
        : null;

      let fileUrl = existing
        ? existing.fileUrl || existing.pdfUrl || ""
        : "";

      let storagePath = oldStoragePath ||
        (existing ? existing.storagePath || "" : "");

      if (file) {
        const uploaded = await uploadPDF(file, documentRef.id);
        fileUrl = uploaded.fileUrl;
        storagePath = uploaded.storagePath;
      }

      const payload = {
        title: title,
        courseId: scope.courseId,
        chapterId: scope.chapterId,
        topicId: config.scope === "topic" ? scope.topicId : "",
        type: STATE.activeTab,
        fileUrl: fileUrl,
        pdfUrl: fileUrl,
        storagePath: storagePath,
        active: true,
        updatedAt: timestamp(),
        updatedBy: currentUserId()
      };

      if (!existing) {
        payload.createdAt = timestamp();
        payload.createdBy = currentUserId();
      }

      await documentRef.set(payload, { merge: true });

      /*
        Delete the old file only after the new file and its metadata
        have been saved successfully.
      */
      if (
        file &&
        oldStoragePath &&
        oldStoragePath !== storagePath
      ) {
        try {
          await getStorage().ref().child(oldStoragePath).delete();
        } catch (cleanupError) {
          console.warn(
            "Old PDF cleanup failed:",
            cleanupError
          );
        }
      }

      closeEditor();
      await loadMaterials();

      showMessage(
        existing
          ? "PDF সফলভাবে Update হয়েছে।"
          : "PDF সফলভাবে Upload হয়েছে।"
      );
    } catch (error) {
      showMessage(
        "PDF Save করা যায়নি: " + (error.message || "অজানা সমস্যা"),
        true
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save PDF";
    }
  }

  async function deleteMaterial(id) {
    if (!(await authorizeAdmin())) return;

    const item = STATE.materials.find(function (entry) {
      return entry.id === id;
    });

    if (!item) return;

    if (!window.confirm("এই PDF ও তার রেকর্ড Delete করবে?")) {
      return;
    }

    try {
      const config = MATERIAL_TYPES[STATE.activeTab];

      await collection(config.collection).doc(id).delete();

      if (item.storagePath) {
        try {
          await getStorage().ref().child(item.storagePath).delete();
        } catch (storageError) {
          console.warn(
            "Storage file cleanup failed:",
            storageError
          );
        }
      }

      await loadMaterials();
      showMessage("PDF রেকর্ড Delete হয়েছে।");
    } catch (error) {
      showMessage(
        "PDF Delete করা যায়নি: " + (error.message || ""),
        true
      );
    }
  }

  async function switchTab(tab) {
    if (!MATERIAL_TYPES[tab]) return;

    STATE.activeTab = tab;

    document.querySelectorAll("[data-material-tab]").forEach(function (button) {
      button.classList.toggle(
        "active",
        button.dataset.materialTab === tab
      );
    });

    byId("matTabDescription").textContent =
      MATERIAL_TYPES[tab].description;

    byId("matTopicSlot").hidden = tab !== "notes";

    if (byId("matTopicSlot").hidden) {
      byId("matTopicSlot").innerHTML = "";
    }

    STATE.materials = [];
    renderMaterials();

    try {
      await loadChapters();
      await loadTopics();

      showMessage(
        MATERIAL_TYPES[tab].label +
          " পরিচালনার জন্য Selection প্রস্তুত।"
      );
    } catch (error) {
      showMessage(
        "Selection লোড করা যায়নি: " + (error.message || ""),
        true
      );
    }
  }

  function setupEvents() {
    document.querySelectorAll("[data-material-tab]").forEach(function (button) {
      button.addEventListener("click", function () {
        switchTab(button.dataset.materialTab);
      });
    });

    byId("matCourse").addEventListener("change", async function () {
      try {
        await loadChapters();
      } catch (error) {
        showMessage("Chapter লোড করা যায়নি: " + (error.message || ""), true);
      }
    });

    byId("matChapter").addEventListener("change", async function () {
      try {
        await loadTopics();
      } catch (error) {
        showMessage("Topic লোড করা যায়নি: " + (error.message || ""), true);
      }
    });

    byId("matLoadButton").addEventListener("click", loadMaterials);

    byId("matNewButton").addEventListener("click", async function () {
      if (!(await authorizeAdmin())) return;

      const scope = currentScope();

      if (!scope.courseId || !scope.chapterId) {
        showMessage("প্রথমে Course ও Chapter নির্বাচন করো।", true);
        return;
      }

      if (STATE.activeTab === "notes" && !scope.topicId) {
        showMessage("Notes PDF-এর জন্য Topic নির্বাচন করো।", true);
        return;
      }

      openEditor(null);
    });

    byId("matCancelButton").addEventListener("click", closeEditor);
    byId("matForm").addEventListener("submit", saveMaterial);

    byId("matList").addEventListener("click", async function (event) {
      const button = event.target.closest("button[data-material-action]");

      if (!button) return;

      const id = button.dataset.id;
      const action = button.dataset.materialAction;

      if (action === "delete") {
        await deleteMaterial(id);
      }

      if (action === "replace") {
        if (!(await authorizeAdmin())) return;

        const item = STATE.materials.find(function (entry) {
          return entry.id === id;
        });

        if (item) openEditor(item);
      }
    });
  }

  async function initialize() {
    if (STATE.initializing) return;

    STATE.initializing = true;

    try {
      if (!createInterface()) return;
      if (!getFirebase()) return;
      if (!(await authorizeAdmin())) return;

      setupEvents();

      byId("matTabDescription").textContent =
        MATERIAL_TYPES[STATE.activeTab].description;

      await loadCourses();

      STATE.initialized = true;
    } catch (error) {
      showMessage(
        "Materials Management চালু করা যায়নি: " +
          (error.message || "অজানা সমস্যা"),
        true
      );
    } finally {
      STATE.initializing = false;
    }
  }

  function onAdminPageChange(event) {
    if (!event || !event.detail) return;

    if (event.detail.page === "notes") {
      if (!STATE.initialized) {
        initialize();
      } else {
        authorizeAdmin().then(function (authorized) {
          if (authorized) loadCourses();
        });
      }
    }
  }

  window.MNEETMaterialsAdmin = {
    initialize: initialize,
    reload: loadMaterials,
    switchTab: switchTab
  };

  document.addEventListener("DOMContentLoaded", initialize);

  document.addEventListener(
    "mneet:admin-page-change",
    onAdminPageChange
  );
})();
