/* =========================================================
   mNEET — Student NCERT Reader
   File: student-ncert-reader.js

   Features:
   - Read NCERT PDF inside Student Panel
   - Highlight selected text
   - Underline selected text
   - Add personal study notes
   - Save annotations to Firestore
   - Restore annotations when reopening a PDF
   - Navigate between PDF pages
   - Green and White compatible
   - Student data scoped to authenticated user

   IMPORTANT:
   This module does not replace student-ncert.js.
   ========================================================= */

(function (window, document) {
  "use strict";

  const MODULE_NAME = "MNEETStudentNCERTReader";

  const COLLECTION = "studentNcertAnnotations";

  const STORAGE_PREFIX = "mneet-ncert-reader";

  const MAX_NOTE_LENGTH = 3000;

  const state = {
    initialized: false,
    user: null,
    db: null,

    fileId: "",
    fileUrl: "",
    fileTitle: "",
    courseId: "",
    chapterId: "",

    pdf: null,
    pageNumber: 1,
    totalPages: 0,
    scale: 1.25,

    annotations: [],
    selectedText: "",
    selectedPage: 1,

    loading: false,
    saving: false,
    lastError: ""
  };

  let domBound = false;
  let saveTimeout = null;
  let activeRenderTask = null;
  let renderSequence = 0;

  /* =======================================================
     1. FIREBASE
     ======================================================= */

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.auth &&
      window.MNEETFirebase.db
    ) {
      return {
        auth: window.MNEETFirebase.auth,
        db: window.MNEETFirebase.db
      };
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      return {
        auth: window.firebase.auth(),
        db: window.firebase.firestore()
      };
    }

    throw new Error(
      "Firebase চালু নেই। Firebase scripts ও firebase.js পরীক্ষা করো।"
    );
  }

  function getCurrentUser() {
    try {
      const firebase = getFirebase();
      return firebase.auth.currentUser || null;
    } catch (error) {
      return null;
    }
  }

  function getServerTimestamp() {
    if (
      window.firebase &&
      window.firebase.firestore &&
      window.firebase.firestore.FieldValue
    ) {
      return window.firebase.firestore.FieldValue.serverTimestamp();
    }

    return new Date();
  }

  /* =======================================================
     2. GENERAL HELPERS
     ======================================================= */

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

  function normaliseText(value) {
    return String(value || "").trim();
  }

  function getErrorMessage(error) {
    if (!error) {
      return "একটি অজানা সমস্যা হয়েছে।";
    }

    const code = String(error.code || "");

    if (code.includes("permission-denied")) {
      return "এই তথ্য সংরক্ষণের অনুমতি নেই। Firebase Rules পরীক্ষা করতে হবে।";
    }

    if (code.includes("unauthenticated")) {
      return "তোমার session শেষ হয়েছে। আবার Login করো।";
    }

    if (code.includes("unavailable")) {
      return "ইন্টারনেট সংযোগ পরীক্ষা করে আবার চেষ্টা করো।";
    }

    return error.message || "একটি সমস্যা হয়েছে।";
  }

  function showMessage(message, type) {
    const container =
      byId("studentNcertReaderMessage") ||
      byId("studentMessage");

    if (!container) {
      return;
    }

    container.textContent = String(message || "");
    container.hidden = !message;

    container.classList.remove(
      "is-success",
      "is-error",
      "is-warning",
      "is-info"
    );

    if (type === "success") {
      container.classList.add("is-success");
    } else if (type === "error") {
      container.classList.add("is-error");
    } else if (type === "warning") {
      container.classList.add("is-warning");
    } else {
      container.classList.add("is-info");
    }
  }

  function setBusy(isBusy) {
    state.loading = Boolean(isBusy);

    document
      .querySelectorAll("[data-ncert-reader-action]")
      .forEach(function (button) {
        button.disabled = state.loading || state.saving;
      });
  }

  function makeLocalKey() {
    return [
      STORAGE_PREFIX,
      state.user ? state.user.uid : "anonymous",
      state.fileId || "no-file"
    ].join(":");
  }

  function makeAnnotationId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 12)
    );
  }

  /* =======================================================
     3. STYLES
     ======================================================= */

  function injectStyles() {
    if (byId("mneetNcertReaderStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "mneetNcertReaderStyles";

    style.textContent = `
      .mneet-nr {
        color: var(--mn-text, #FFFFFF);
        background: var(--mn-bg, #071A12);
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 16px;
        padding: 16px;
        margin: 12px 0;
        font-family: inherit;
      }

      .mneet-nr *,
      .mneet-nr *::before,
      .mneet-nr *::after {
        box-sizing: border-box;
      }

      .mneet-nr-toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 14px;
      }

      .mneet-nr-button {
        min-height: 40px;
        padding: 9px 13px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        background: var(--mn-card, #0D2419);
        color: var(--mn-text, #FFFFFF);
        font: inherit;
        cursor: pointer;
      }

      .mneet-nr-button:hover {
        border-color: var(--mn-primary, #16A34A);
      }

      .mneet-nr-button:disabled {
        opacity: .55;
        cursor: not-allowed;
      }

      .mneet-nr-button-primary {
        background: var(--mn-primary, #16A34A);
        color: #FFFFFF;
        border-color: var(--mn-primary, #16A34A);
      }

      .mneet-nr-input,
      .mneet-nr-textarea {
        display: block;
        width: 100%;
        max-width: 100%;
        padding: 11px 12px;
        color: var(--mn-text, #FFFFFF);
        background: var(--mn-input-bg, #10291D);
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 9px;
        font: inherit;
      }

      .mneet-nr-textarea {
        min-height: 100px;
        resize: vertical;
      }

      .mneet-nr-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 280px;
        gap: 16px;
        align-items: start;
      }

      .mneet-nr-viewer {
        min-width: 0;
        overflow: auto;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 12px;
        background: var(--mn-card, #0D2419);
        padding: 12px;
      }

      .mneet-nr-page {
        position: relative;
        width: fit-content;
        max-width: 100%;
        margin: 0 auto;
        background: #FFFFFF;
        line-height: 0;
        overflow: hidden;
      }

      .mneet-nr-canvas {
        display: block;
        max-width: 100%;
        height: auto;
      }

      .mneet-nr-text-layer {
        position: absolute;
        inset: 0;
        overflow: hidden;
        line-height: 1;
        opacity: 1;
        user-select: text;
        -webkit-user-select: text;
      }

      .mneet-nr-text-layer span,
      .mneet-nr-text-layer br {
        position: absolute;
        color: transparent;
        white-space: pre;
        transform-origin: 0 0;
        cursor: text;
      }

      .mneet-nr-text-layer span::selection {
        background: rgba(34, 197, 94, .45);
      }

      .mneet-nr-sidebar {
        min-width: 0;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 12px;
        padding: 12px;
        background: var(--mn-card, #0D2419);
      }

      .mneet-nr-section-title {
        font-weight: 700;
        margin: 0 0 10px;
      }

      .mneet-nr-field {
        margin-bottom: 12px;
      }

      .mneet-nr-field label {
        display: block;
        margin-bottom: 6px;
        font-size: .9rem;
      }

      .mneet-nr-note {
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 10px;
        padding: 10px;
        margin-top: 10px;
        overflow-wrap: anywhere;
      }

      .mneet-nr-note p {
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        line-height: 1.5;
      }

      .mneet-nr-note-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .mneet-nr-status {
        color: var(--mn-text-secondary, #D1D5DB);
        font-size: .88rem;
        margin: 8px 0;
      }

      .mneet-nr-empty {
        color: var(--mn-text-secondary, #D1D5DB);
        padding: 12px 0;
        line-height: 1.5;
      }

      .mneet-nr-page-label {
        text-align: center;
        margin-top: 10px;
        font-size: .9rem;
        color: var(--mn-text-secondary, #D1D5DB);
      }

      .mneet-nr-selection {
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        padding: 10px;
        border: 1px solid var(--mn-border, #28513A);
        border-radius: 8px;
        margin: 8px 0;
        max-height: 140px;
        overflow: auto;
      }

      .mneet-nr-mark-highlight {
        background: rgba(34, 197, 94, .3);
        color: inherit;
      }

      .mneet-nr-mark-underline {
        text-decoration: underline;
        text-decoration-color: #16A34A;
        text-decoration-thickness: 2px;
      }

      .mneet-nr-error {
        border: 1px solid var(--mn-border, #28513A);
        padding: 12px;
        border-radius: 9px;
        line-height: 1.5;
      }

      @media (max-width: 760px) {
        .mneet-nr-layout {
          grid-template-columns: minmax(0, 1fr);
        }

        .mneet-nr-toolbar > * {
          max-width: 100%;
        }

        .mneet-nr-viewer {
          padding: 6px;
        }

        .mneet-nr-sidebar {
          width: 100%;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     4. PDF.JS LOADING
     ======================================================= */

  function loadPdfJs() {
    if (window.pdfjsLib) {
      configurePdfJs();
      return Promise.resolve(window.pdfjsLib);
    }

    return new Promise(function (resolve, reject) {
      const existing = document.querySelector(
        'script[data-mneet-pdfjs="true"]'
      );

      if (existing) {
        existing.addEventListener("load", function () {
          if (window.pdfjsLib) {
            configurePdfJs();
            resolve(window.pdfjsLib);
          } else {
            reject(new Error("PDF.js লোড করা যায়নি।"));
          }
        }, { once: true });

        existing.addEventListener("error", function () {
          reject(new Error("PDF.js লোড ব্যর্থ হয়েছে।"));
        }, { once: true });

        return;
      }

      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.async = true;
      script.dataset.mneetPdfjs = "true";

      script.onload = function () {
        if (!window.pdfjsLib) {
          reject(new Error("PDF.js লোড করা যায়নি।"));
          return;
        }

        configurePdfJs();
        resolve(window.pdfjsLib);
      };

      script.onerror = function () {
        reject(new Error(
          "PDF Reader-এর library লোড হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করো।"
        ));
      };

      document.head.appendChild(script);
    });
  }

  function configurePdfJs() {
    if (
      window.pdfjsLib &&
      window.pdfjsLib.GlobalWorkerOptions
    ) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
  }

  /* =======================================================
     5. READER HTML
     ======================================================= */

  function ensureReaderMarkup() {
    let root = byId("studentNcertReader");

    if (root) {
      return root;
    }

    const host =
      byId("studentNcertReaderContent") ||
      byId("studentNcertReaderPage") ||
      byId("studentNcertReaderContainer");

    if (!host) {
      return null;
    }

    root = document.createElement("section");
    root.id = "studentNcertReader";
    root.className = "mneet-nr";

    root.innerHTML = `
      <div class="mneet-nr-toolbar">
        <button type="button"
          class="mneet-nr-button"
          data-ncert-reader-action
          data-nr-action="previous">
          Previous Page
        </button>

        <span id="mneetNrPageStatus"
          class="mneet-nr-status">
          No PDF opened
        </span>

        <button type="button"
          class="mneet-nr-button"
          data-ncert-reader-action
          data-nr-action="next">
          Next Page
        </button>

        <button type="button"
          class="mneet-nr-button"
          data-ncert-reader-action
          data-nr-action="zoom-out">
          −
        </button>

        <button type="button"
          class="mneet-nr-button"
          data-nr-action="zoom-reset">
          Reset Zoom
        </button>

        <button type="button"
          class="mneet-nr-button"
          data-ncert-reader-action
          data-nr-action="zoom-in">
          +
        </button>
      </div>

      <div id="studentNcertReaderMessage"
        class="mneet-nr-status"
        role="status"
        aria-live="polite"
        hidden></div>

      <div class="mneet-nr-layout">
        <div>
          <div id="mneetNrViewer"
            class="mneet-nr-viewer">
            <div class="mneet-nr-empty">
              NCERT PDF খুলতে একটি chapter থেকে PDF নির্বাচন করো।
            </div>
          </div>

          <div id="mneetNrPageLabel"
            class="mneet-nr-page-label"></div>
        </div>

        <aside class="mneet-nr-sidebar">
          <h3 class="mneet-nr-section-title">
            Selected Text
          </h3>

          <div id="mneetNrSelectedText"
            class="mneet-nr-selection">
            PDF-এর text select করলে এখানে দেখা যাবে।
          </div>

          <div class="mneet-nr-toolbar">
            <button type="button"
              class="mneet-nr-button mneet-nr-button-primary"
              data-ncert-reader-action
              data-nr-action="highlight">
              Highlight
            </button>

            <button type="button"
              class="mneet-nr-button"
              data-ncert-reader-action
              data-nr-action="underline">
              Underline
            </button>
          </div>

          <hr>

          <h3 class="mneet-nr-section-title">
            Personal Study Note
          </h3>

          <div class="mneet-nr-field">
            <label for="mneetNrNoteTitle">Note Title</label>
            <input id="mneetNrNoteTitle"
              class="mneet-nr-input"
              type="text"
              maxlength="120"
              placeholder="Note title">
          </div>

          <div class="mneet-nr-field">
            <label for="mneetNrNoteText">Your Note</label>
            <textarea id="mneetNrNoteText"
              class="mneet-nr-textarea"
              maxlength="${MAX_NOTE_LENGTH}"
              placeholder="Write your personal study note..."></textarea>
          </div>

          <button type="button"
            class="mneet-nr-button mneet-nr-button-primary"
            data-ncert-reader-action
            data-nr-action="save-note">
            Save Note
          </button>

          <div id="mneetNrSaveStatus"
            class="mneet-nr-status"
            aria-live="polite"></div>

          <hr>

          <h3 class="mneet-nr-section-title">
            Saved Highlights & Notes
          </h3>

          <div id="mneetNrAnnotations">
            <div class="mneet-nr-empty">
              No saved annotations yet.
            </div>
          </div>
        </aside>
      </div>
    `;

    host.appendChild(root);

    return root;
  }

  /* =======================================================
     6. ANNOTATION STORAGE
     ======================================================= */

  function annotationDocumentId(annotationId) {
    return (
      state.user.uid +
      "_" +
      state.fileId +
      "_" +
      annotationId
    ).replace(/[\/\\#?[\]]/g, "_");
  }

  function getAnnotationDocumentPath(annotationId) {
    return annotationDocumentId(annotationId);
  }

  function saveLocalAnnotations() {
    try {
      const key = makeLocalKey();

      localStorage.setItem(
        key,
        JSON.stringify(state.annotations)
      );
    } catch (error) {
      // Browser storage may be disabled.
    }
  }

  function loadLocalAnnotations() {
    try {
      const raw = localStorage.getItem(makeLocalKey());

      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  async function loadAnnotations() {
    if (!state.user || !state.fileId || !state.db) {
      state.annotations = [];
      renderAnnotations();
      return;
    }

    try {
      const snapshot = await state.db
        .collection(COLLECTION)
        .where("userId", "==", state.user.uid)
        .where("fileId", "==", state.fileId)
        .get();

      state.annotations = snapshot.docs.map(function (doc) {
        return Object.assign(
          { id: doc.id },
          doc.data()
        );
      });

      saveLocalAnnotations();
      renderAnnotations();
    } catch (error) {
      state.lastError = getErrorMessage(error);

      // Local cache is only a fallback, not a security boundary.
      state.annotations = loadLocalAnnotations();
      renderAnnotations();

      showMessage(
        "Saved notes load করা যায়নি। Local copy থাকলে সেটি দেখানো হচ্ছে। " +
        getErrorMessage(error),
        "warning"
      );
    }
  }

  async function saveAnnotation(annotation) {
    if (!state.user) {
      throw new Error("Notes save করার আগে Login করো।");
    }

    if (!state.fileId) {
      throw new Error("প্রথমে একটি NCERT PDF খোলো।");
    }

    const id = annotation.id || makeAnnotationId();

    const data = Object.assign({}, annotation, {
      userId: state.user.uid,
      fileId: state.fileId,
      fileTitle: state.fileTitle,
      courseId: state.courseId,
      chapterId: state.chapterId,
      updatedAt: getServerTimestamp()
    });

    if (!annotation.createdAt) {
      data.createdAt = getServerTimestamp();
    }

    const documentId = getAnnotationDocumentPath(id);

    state.saving = true;
    setBusy(true);

    try {
      await state.db
        .collection(COLLECTION)
        .doc(documentId)
        .set(data, { merge: true });

      const saved = Object.assign({}, data, {
        id: documentId
      });

      const index = state.annotations.findIndex(
        function (item) {
          return item.id === documentId || item.id === id;
        }
      );

      if (index >= 0) {
        state.annotations[index] = saved;
      } else {
        state.annotations.push(saved);
      }

      saveLocalAnnotations();
      renderAnnotations();

      return saved;
    } finally {
      state.saving = false;
      setBusy(false);
    }
  }

  async function deleteAnnotation(annotation) {
    if (!state.user || !state.db || !annotation) {
      return;
    }

    if (!window.confirm("এই saved annotation মুছে ফেলবে?")) {
      return;
    }

    try {
      await state.db
        .collection(COLLECTION)
        .doc(annotation.id)
        .delete();

      state.annotations = state.annotations.filter(
        function (item) {
          return item.id !== annotation.id;
        }
      );

      saveLocalAnnotations();
      renderAnnotations();

      showMessage("Annotation মুছে ফেলা হয়েছে।", "success");
    } catch (error) {
      showMessage(getErrorMessage(error), "error");
    }
  }

  /* =======================================================
     7. RENDER SAVED ANNOTATIONS
     ======================================================= */

  function renderAnnotations() {
    const container = byId("mneetNrAnnotations");

    if (!container) {
      return;
    }

    if (!state.annotations.length) {
      container.innerHTML = `
        <div class="mneet-nr-empty">
          এখনো কোনো highlight, underline বা note save করা হয়নি।
        </div>
      `;

      return;
    }

    const sorted = state.annotations.slice().sort(
      function (a, b) {
        const pageDifference =
          Number(a.pageNumber || 0) -
          Number(b.pageNumber || 0);

        if (pageDifference !== 0) {
          return pageDifference;
        }

        return String(a.createdAt || "").localeCompare(
          String(b.createdAt || "")
        );
      }
    );

    container.innerHTML = sorted.map(function (item) {
      const title = escapeHTML(
        item.title ||
        (item.type === "highlight"
          ? "Highlight"
          : item.type === "underline"
          ? "Underline"
          : "Study Note")
      );

      const text = escapeHTML(
        item.text || item.selectedText || ""
      );

      const pageNumber = Number(item.pageNumber || 1);

      return `
        <article class="mneet-nr-note">
          <strong>${title}</strong>

          <div class="mneet-nr-status">
            Page ${pageNumber}
          </div>

          <p>${text || "No text saved."}</p>

          <div class="mneet-nr-note-actions">
            <button type="button"
              class="mneet-nr-button"
              data-nr-action="goto-annotation"
              data-nr-page="${pageNumber}">
              Open Page
            </button>

            <button type="button"
              class="mneet-nr-button"
              data-nr-action="delete-annotation"
              data-nr-id="${escapeHTML(item.id)}">
              Delete
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  /* =======================================================
     8. RENDER PDF PAGE
     ======================================================= */

  async function renderPage(pageNumber) {
    if (!state.pdf) {
      return;
    }

    const pdfjs = window.pdfjsLib;
    const viewer = byId("mneetNrViewer");

    if (!pdfjs || !viewer) {
      return;
    }

    const requestedPage = Math.max(
      1,
      Math.min(state.totalPages, Number(pageNumber) || 1)
    );

    state.pageNumber = requestedPage;

    const currentRender = ++renderSequence;

    if (activeRenderTask) {
      try {
        activeRenderTask.cancel();
      } catch (error) {
        // An already completed render task needs no cancellation.
      }

      activeRenderTask = null;
    }

    viewer.innerHTML = `
      <div class="mneet-nr-empty">
        Loading page ${requestedPage}...
      </div>
    `;

    try {
      const page = await state.pdf.getPage(requestedPage);

      if (currentRender !== renderSequence) {
        return;
      }

      const viewport = page.getViewport({
        scale: state.scale
      });

      const pageContainer = document.createElement("div");
      pageContainer.className = "mneet-nr-page";
      pageContainer.style.width = viewport.width + "px";
      pageContainer.style.height = viewport.height + "px";

      const canvas = document.createElement("canvas");
      canvas.className = "mneet-nr-canvas";

      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("PDF canvas চালু করা যায়নি।");
      }

      const pixelRatio = Math.min(
        window.devicePixelRatio || 1,
        2
      );

      canvas.width = Math.ceil(
        viewport.width * pixelRatio
      );

      canvas.height = Math.ceil(
        viewport.height * pixelRatio
      );

      canvas.style.width = viewport.width + "px";
      canvas.style.height = viewport.height + "px";

      pageContainer.appendChild(canvas);
      viewer.innerHTML = "";
      viewer.appendChild(pageContainer);

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        transform: pixelRatio === 1
          ? null
          : [pixelRatio, 0, 0, pixelRatio, 0, 0]
      };

      activeRenderTask = page.render(renderContext);

      await activeRenderTask.promise;

      if (currentRender !== renderSequence) {
        return;
      }

      activeRenderTask = null;

      // Add selectable text layer where supported.
      try {
        const textContent = await page.getTextContent();

        if (currentRender !== renderSequence) {
          return;
        }

        const textLayer = document.createElement("div");
        textLayer.className = "mneet-nr-text-layer";
        textLayer.style.width = viewport.width + "px";
        textLayer.style.height = viewport.height + "px";

        pageContainer.appendChild(textLayer);

        if (pdfjs.Util && pdfjs.Util.transform) {
          const textItems = textContent.items || [];

          textItems.forEach(function (item) {
            if (!item.str) {
              return;
            }

            const span = document.createElement("span");
            span.textContent = item.str;

            const transform = pdfjs.Util.transform(
              viewport.transform,
              item.transform
            );

            const x = transform[4];
            const y = transform[5];
            const fontHeight = Math.sqrt(
              transform[2] * transform[2] +
              transform[3] * transform[3]
            );

            span.style.left = x + "px";
            span.style.top = (y - fontHeight) + "px";
            span.style.fontSize = fontHeight + "px";
            span.style.fontFamily =
              item.fontName || "sans-serif";

            textLayer.appendChild(span);
          });
        }
      } catch (textError) {
        // The PDF page remains readable even if text selection fails.
      }

      updatePageControls();
    } catch (error) {
      if (error && error.name === "RenderingCancelledException") {
        return;
      }

      state.lastError = getErrorMessage(error);

      viewer.innerHTML = `
        <div class="mneet-nr-error">
          এই PDF page দেখানো যায়নি।
          ${escapeHTML(getErrorMessage(error))}
        </div>
      `;
    }
  }

  function updatePageControls() {
    const status = byId("mneetNrPageStatus");
    const label = byId("mneetNrPageLabel");

    if (status) {
      status.textContent = state.totalPages
        ? "Page " + state.pageNumber + " of " + state.totalPages
        : "No PDF opened";
    }

    if (label) {
      label.textContent = state.fileTitle
        ? state.fileTitle + " · Page " +
          state.pageNumber + " / " + state.totalPages
        : "";
    }

    const previous = document.querySelector(
      '[data-nr-action="previous"]'
    );

    const next = document.querySelector(
      '[data-nr-action="next"]'
    );

    if (previous) {
      previous.disabled = state.pageNumber <= 1;
    }

    if (next) {
      next.disabled =
        !state.totalPages ||
        state.pageNumber >= state.totalPages;
    }
  }

  /* =======================================================
     9. OPEN PDF
     ======================================================= */

  async function open(options) {
    const config = Object.assign({}, options || {});

    const fileUrl = normaliseText(
      config.fileUrl ||
      config.url ||
      config.pdfUrl
    );

    if (!fileUrl) {
      showMessage("NCERT PDF-এর URL পাওয়া যায়নি।", "error");
      return false;
    }

    state.user = getCurrentUser();

    if (!state.user) {
      showMessage("PDF annotations save করতে Login করো।", "warning");
      return false;
    }

    state.fileId = normaliseText(
      config.fileId ||
      config.materialId ||
      config.ncertId ||
      config.id
    );

    state.fileUrl = fileUrl;

    state.fileTitle = normaliseText(
      config.title ||
      config.fileTitle ||
      config.name
    ) || "NCERT PDF";

    state.courseId = normaliseText(config.courseId);
    state.chapterId = normaliseText(config.chapterId);

    if (!state.fileId) {
      showMessage(
        "PDF-এর একটি স্থায়ী fileId দরকার, যাতে notes সঠিক PDF-এর সঙ্গে যুক্ত থাকে।",
        "error"
      );
      return false;
    }

    injectStyles();
    ensureReaderMarkup();

    try {
      const services = getFirebase();
      state.db = services.db;

      setBusy(true);

      showMessage("NCERT PDF খোলা হচ্ছে...", "info");

      const pdfjs = await loadPdfJs();

      const loadingTask = pdfjs.getDocument({
        url: state.fileUrl
      });

      state.pdf = await loadingTask.promise;
      state.totalPages = state.pdf.numPages;
      state.pageNumber = 1;

      await loadAnnotations();
      await renderPage(1);

      showMessage("NCERT PDF প্রস্তুত।", "success");

      return true;
    } catch (error) {
      state.lastError = getErrorMessage(error);
      showMessage(state.lastError, "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     10. TEXT SELECTION
     ======================================================= */

  function handleSelectionChange() {
    const selection = window.getSelection();

    if (!selection || !selection.toString().trim()) {
      return;
    }

    const selectedText = selection.toString().trim();

    const reader = byId("studentNcertReader");

    if (!reader || !reader.contains(selection.anchorNode)) {
      return;
    }

    state.selectedText = selectedText;
    state.selectedPage = state.pageNumber;

    const display = byId("mneetNrSelectedText");

    if (display) {
      display.textContent = selectedText;
    }
  }

  async function saveTextAnnotation(type) {
    const selectedText = normaliseText(state.selectedText);

    if (!selectedText) {
      showMessage(
        "প্রথমে PDF-এর text select করো।",
        "warning"
      );
      return;
    }

    try {
      await saveAnnotation({
        id: makeAnnotationId(),
        type: type,
        title: type === "highlight"
          ? "Highlight"
          : "Underline",
        text: selectedText,
        selectedText: selectedText,
        pageNumber: state.selectedPage || state.pageNumber
      });

      showMessage(
        type === "highlight"
          ? "Highlight save হয়েছে।"
          : "Underline save হয়েছে।",
        "success"
      );
    } catch (error) {
      showMessage(getErrorMessage(error), "error");
    }
  }

  /* =======================================================
     11. PERSONAL NOTES
     ======================================================= */

  async function savePersonalNote() {
    const title = normaliseText(
      byId("mneetNrNoteTitle")
        ? byId("mneetNrNoteTitle").value
        : ""
    );

    const text = normaliseText(
      byId("mneetNrNoteText")
        ? byId("mneetNrNoteText").value
        : ""
    );

    if (!text) {
      showMessage("Note লেখার পর Save করো।", "warning");
      return;
    }

    if (text.length > MAX_NOTE_LENGTH) {
      showMessage(
        "Note সর্বোচ্চ " + MAX_NOTE_LENGTH + " characters হতে পারবে।",
        "warning"
      );
      return;
    }

    try {
      await saveAnnotation({
        id: makeAnnotationId(),
        type: "note",
        title: title || "Personal Study Note",
        text: text,
        selectedText: state.selectedText || "",
        pageNumber: state.pageNumber
      });

      if (byId("mneetNrNoteTitle")) {
        byId("mneetNrNoteTitle").value = "";
      }

      if (byId("mneetNrNoteText")) {
        byId("mneetNrNoteText").value = "";
      }

      const status = byId("mneetNrSaveStatus");

      if (status) {
        status.textContent = "Saved successfully.";
      }

      showMessage("তোমার personal note save হয়েছে।", "success");
    } catch (error) {
      showMessage(getErrorMessage(error), "error");
    }
  }

  /* =======================================================
     12. PAGE AND ZOOM CONTROLS
     ======================================================= */

  async function previousPage() {
    if (state.pageNumber > 1) {
      await renderPage(state.pageNumber - 1);
    }
  }

  async function nextPage() {
    if (state.pageNumber < state.totalPages) {
      await renderPage(state.pageNumber + 1);
    }
  }

  async function goToPage(pageNumber) {
    await renderPage(pageNumber);
  }

  async function zoomIn() {
    state.scale = Math.min(3, state.scale + 0.15);
    await renderPage(state.pageNumber);
  }

  async function zoomOut() {
    state.scale = Math.max(0.5, state.scale - 0.15);
    await renderPage(state.pageNumber);
  }

  async function resetZoom() {
    state.scale = 1.25;
    await renderPage(state.pageNumber);
  }

  /* =======================================================
     13. CLICK EVENTS
     ======================================================= */

  function handleReaderClick(event) {
    const button = event.target.closest("[data-nr-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.nrAction;

    if (action === "previous") {
      previousPage();
    } else if (action === "next") {
      nextPage();
    } else if (action === "zoom-in") {
      zoomIn();
    } else if (action === "zoom-out") {
      zoomOut();
    } else if (action === "zoom-reset") {
      resetZoom();
    } else if (action === "highlight") {
      saveTextAnnotation("highlight");
    } else if (action === "underline") {
      saveTextAnnotation("underline");
    } else if (action === "save-note") {
      savePersonalNote();
    } else if (action === "delete-annotation") {
      const id = button.dataset.nrId;

      const annotation = state.annotations.find(
        function (item) {
          return item.id === id;
        }
      );

      if (annotation) {
        deleteAnnotation(annotation);
      }
    } else if (action === "goto-annotation") {
      goToPage(Number(button.dataset.nrPage || 1));
    }
  }

  /* =======================================================
     14. INITIALIZATION
     ======================================================= */

  function bindEvents() {
    if (domBound) {
      return;
    }

    domBound = true;

    document.addEventListener(
      "click",
      handleReaderClick
    );

    document.addEventListener(
      "selectionchange",
      handleSelectionChange
    );

    window.addEventListener("beforeunload", function () {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      // Do not perform asynchronous Firestore writes here.
    });
  }

  function initialize() {
    if (state.initialized) {
      return true;
    }

    injectStyles();
    bindEvents();

    state.user = getCurrentUser();

    try {
      const services = getFirebase();
      state.db = services.db;
    } catch (error) {
      state.lastError = getErrorMessage(error);
    }

    state.initialized = true;

    return true;
  }

  /* =======================================================
     15. PUBLIC API
     ======================================================= */

  window[MODULE_NAME] = Object.freeze({
    initialize: initialize
