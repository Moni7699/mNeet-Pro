/* ==========================================================
   mNEET — FILE 38
   Student NCERT PDF Reader
   Chapter-wise PDF Reading
   Green + White Theme
   ========================================================== */

(function () {
  "use strict";

  const COLLECTIONS = {
    courses: "courses",
    chapters: "chapters",
    subjects: "subjects",
    ncert: "ncert",
    purchases: "purchases"
  };

  const state = {
    user: null,
    courses: [],
    chapters: [],
    subjects: [],
    ncertFiles: [],
    purchases: [],
    selectedCourseId: "",
    selectedChapterId: "",
    selectedFile: null,
    currentPage: 1,
    totalPages: 0,
    zoom: 1,
    loading: false,
    initialized: false,
    error: null
  };

  const PDFJS_VERSION = "3.11.174";

  const CSS = `
    .mneet-ncert {
      width: 100%;
      padding: 14px;
      box-sizing: border-box;
      color: #FFFFFF;
      background: #071A12;
      border-radius: 16px;
    }

    .mneet-ncert *,
    .mneet-ncert *::before,
    .mneet-ncert *::after {
      box-sizing: border-box;
    }

    .mneet-ncert-card {
      padding: 16px;
      margin-bottom: 14px;
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 14px;
    }

    .mneet-ncert h2,
    .mneet-ncert h3 {
      color: #FFFFFF;
      margin-top: 0;
      line-height: 1.4;
    }

    .mneet-ncert p {
      color: #D1D5DB;
      line-height: 1.7;
    }

    .mneet-ncert-label {
      display: block;
      color: #D1D5DB;
      margin: 12px 0 7px;
      font-size: 13px;
    }

    .mneet-ncert-select,
    .mneet-ncert-search {
      width: 100%;
      min-height: 44px;
      padding: 11px 12px;
      color: #FFFFFF;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 10px;
      font: inherit;
    }

    .mneet-ncert-button {
      min-height: 40px;
      padding: 9px 13px;
      color: #FFFFFF;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 9px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }

    .mneet-ncert-button-primary {
      background: #16A34A;
      border-color: #16A34A;
      color: #FFFFFF;
    }

    .mneet-ncert-button:disabled {
      opacity: .45;
      cursor: not-allowed;
    }

    .mneet-ncert-file {
      padding: 13px;
      margin-top: 10px;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 11px;
    }

    .mneet-ncert-file-title {
      color: #FFFFFF;
      font-weight: 800;
      margin-bottom: 7px;
      overflow-wrap: anywhere;
    }

    .mneet-ncert-file-info {
      color: #D1D5DB;
      font-size: 12px;
      line-height: 1.7;
      margin-bottom: 10px;
    }

    .mneet-ncert-file-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .mneet-ncert-reader {
      overflow: hidden;
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 14px;
    }

    .mneet-ncert-reader-toolbar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px;
      background: #10291D;
      border-bottom: 1px solid #28513A;
    }

    .mneet-ncert-page-label {
      color: #FFFFFF;
      font-size: 13px;
      font-weight: 700;
      padding: 5px;
    }

    .mneet-ncert-canvas-area {
      width: 100%;
      min-height: 250px;
      max-height: 72vh;
      overflow: auto;
      padding: 10px;
      background: #071A12;
      text-align: center;
      overscroll-behavior: contain;
    }

    .mneet-ncert-canvas-area canvas {
      display: block;
      margin: 0 auto 12px;
      max-width: 100%;
      height: auto;
      background: #FFFFFF;
    }

    .mneet-ncert-status {
      color: #D1D5DB;
      padding: 14px;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    .mneet-ncert-empty {
      padding: 18px;
      text-align: center;
      color: #D1D5DB;
      line-height: 1.7;
      border: 1px dashed #28513A;
      border-radius: 12px;
      background: #0D2419;
    }

    .mneet-ncert-hidden {
      display: none !important;
    }

    @media (min-width: 760px) {
      .mneet-ncert {
        padding: 22px;
      }

      .mneet-ncert-library-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .mneet-ncert-file {
        margin-top: 0;
      }
    }
  `;

  let pdfjs = null;
  let currentRenderTask = null;
  let renderSequence = 0;
  let progressSaveTimer = null;

  function addStyles() {
    if (document.getElementById("mneetNcertStyles")) return;

    const style = document.createElement("style");
    style.id = "mneetNcertStyles";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function getFirebase() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.db &&
      window.MNEETFirebase.auth
    ) {
      return {
        db: window.MNEETFirebase.db,
        auth: window.MNEETFirebase.auth
      };
    }

    if (
      typeof firebase !== "undefined" &&
      firebase.apps &&
      firebase.apps.length
    ) {
      return {
        db: firebase.firestore(),
        auth: firebase.auth()
      };
    }

    throw new Error("Firebase connection পাওয়া যায়নি।");
  }

  function getStudentAPI() {
    return window.MNEETStudent || null;
  }

  function getUser() {
    const api = getStudentAPI();

    if (api && typeof api.getCurrentUser === "function") {
      const user = api.getCurrentUser();
      if (user) return user;
    }

    try {
      return getFirebase().auth.currentUser;
    } catch (_) {
      return null;
    }
  }

  function getContainer() {
    const ids = [
      "studentNcertContent",
      "studentNcertPageContent",
      "studentPageNcert",
      "studentNcertReaderContent",
      "studentNcertLibrary"
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) return element;
    }

    return null;
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getId(item) {
    return String(item && item.id ? item.id : "");
  }

  function getCourseId(item) {
    return String(
      item.courseId ||
      item.courseID ||
      item.parentCourseId ||
      ""
    );
  }

  function getChapterId(item) {
    return String(
      item.chapterId ||
      item.chapterID ||
      item.parentChapterId ||
      ""
    );
  }

  function getSubjectId(item) {
    return String(
      item.subjectId ||
      item.subjectID ||
      item.parentSubjectId ||
      ""
    );
  }

  function getStatus(purchase) {
    return String(
      purchase.status ||
      purchase.paymentStatus ||
      purchase.approvalStatus ||
      ""
    ).toLowerCase();
  }

  function isApproved(purchase) {
    return ["approved", "paid", "completed"].includes(
      getStatus(purchase)
    );
  }

  function isActive(item) {
    return item &&
      item.active !== false &&
      item.published !== false;
  }

  function getApprovedCourseIds() {
    const ids = new Set();

    state.purchases.forEach(purchase => {
      if (!isApproved(purchase)) return;

      const id = getCourseId(purchase);
      if (id) ids.add(id);
    });

    const api = getStudentAPI();

    if (
      ids.size === 0 &&
      api &&
      typeof api.getPurchasedCourses === "function"
    ) {
      (api.getPurchasedCourses() || []).forEach(course => {
        if (typeof course === "string") {
          ids.add(course);
        } else {
          const id = getId(course) || course.courseId;
          if (id) ids.add(String(id));
        }
      });
    }

    return ids;
  }

  function hasCourseAccess(courseId) {
    if (!courseId) return false;

    const api = getStudentAPI();

    if (
      api &&
      typeof api.hasCourseAccess === "function" &&
      api.hasCourseAccess(courseId)
    ) {
      return true;
    }

    return getApprovedCourseIds().has(String(courseId));
  }

  function getAvailableCourses() {
    const approvedIds = getApprovedCourseIds();

    return state.courses.filter(course =>
      isActive(course) &&
      approvedIds.has(getId(course))
    );
  }

  function getChaptersForCourse(courseId) {
    return state.chapters
      .filter(chapter =>
        isActive(chapter) &&
        getCourseId(chapter) === courseId
      )
      .sort((a, b) => {
        const orderA = Number(a.order || 0);
        const orderB = Number(b.order || 0);

        if (orderA !== orderB) return orderA - orderB;

        return String(a.name || "").localeCompare(
          String(b.name || "")
        );
      });
  }

  function getChapterName(chapterId) {
    const chapter = state.chapters.find(
      item => getId(item) === chapterId
    );

    if (chapter) {
      return chapter.name || chapter.title || "Chapter";
    }

    return "Chapter";
  }

  function getCourseName(courseId) {
    const course = state.courses.find(
      item => getId(item) === courseId
    );

    return course
      ? course.name || course.title || "Course"
      : "Course";
  }

  function getFileURL(file) {
    return String(
      file.pdfUrl ||
      file.fileUrl ||
      file.downloadURL ||
      file.downloadUrl ||
      file.url ||
      ""
    ).trim();
  }

  function getFileTitle(file) {
    return String(
      file.title ||
      file.name ||
      file.fileName ||
      "NCERT PDF"
    );
  }

  function getFilteredFiles() {
    let files = state.ncertFiles.filter(file => {
      if (!isActive(file)) return false;

      const courseId = getCourseId(file);

      if (!courseId || !hasCourseAccess(courseId)) return false;

      if (
        state.selectedCourseId &&
        courseId !== state.selectedCourseId
      ) {
        return false;
      }

      if (
        state.selectedChapterId &&
        getChapterId(file) !== state.selectedChapterId
      ) {
        return false;
      }

      return Boolean(getFileURL(file));
    });

    const search = document.getElementById(
      "mneetNcertSearch"
    );

    const query = search
      ? search.value.trim().toLowerCase()
      : "";

    if (query) {
      files = files.filter(file => {
        const text = [
          getFileTitle(file),
          file.description,
          getChapterName(getChapterId(file)),
          getCourseName(getCourseId(file))
        ].join(" ").toLowerCase();

        return text.includes(query);
      });
    }

    return files.sort((a, b) => {
      const orderA = Number(a.order || 0);
      const orderB = Number(b.order || 0);

      if (orderA !== orderB) return orderA - orderB;

      return getFileTitle(a).localeCompare(getFileTitle(b));
    });
  }

  async function readCollection(collectionName) {
    const db = getFirebase().db;
    const snapshot = await db.collection(collectionName).get();
    const items = [];

    snapshot.forEach(doc => {
      items.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return items;
  }

  async function readOwnPurchases(uid) {
    const db = getFirebase().db;

    const snapshot = await db
      .collection(COLLECTIONS.purchases)
      .where("userId", "==", uid)
      .get();

    const items = [];

    snapshot.forEach(doc => {
      items.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return items;
  }

  async function loadData() {
    const user = getUser();

    if (!user) {
      throw new Error("NCERT পড়ার জন্য আগে Sign In করো।");
    }

    state.user = user;
    state.loading = true;
    state.error = null;

    try {
      const [
        courses,
        chapters,
        subjects,
        ncertFiles,
        purchases
      ] = await Promise.all([
        readCollection(COLLECTIONS.courses),
        readCollection(COLLECTIONS.chapters),
        readCollection(COLLECTIONS.subjects),
        readCollection(COLLECTIONS.ncert),
        readOwnPurchases(user.uid)
      ]);

      state.courses = courses;
      state.chapters = chapters;
      state.subjects = subjects;
      state.ncertFiles = ncertFiles;
      state.purchases = purchases;

      const availableCourses = getAvailableCourses();

      if (
        !state.selectedCourseId ||
        !availableCourses.some(
          course => getId(course) === state.selectedCourseId
        )
      ) {
        state.selectedCourseId = availableCourses.length
          ? getId(availableCourses[0])
          : "";
      }

      const chapterList = getChaptersForCourse(
        state.selectedCourseId
      );

      if (
        state.selectedChapterId &&
        !chapterList.some(
          chapter => getId(chapter) === state.selectedChapterId
        )
      ) {
        state.selectedChapterId = "";
      }

      return true;
    } catch (error) {
      state.error = error;
      throw error;
    } finally {
      state.loading = false;
    }
  }

  function renderSelectors() {
    const courses = getAvailableCourses();

    if (!courses.length) {
      return `
        <div class="mneet-ncert-empty">
          <h3>NCERT Library</h3>
          তোমার account-এ কোনো approved course পাওয়া যায়নি।
          Course কেনার পরে Admin payment approve করলে NCERT access পাবে।
        </div>
      `;
    }

    const chapters = getChaptersForCourse(
      state.selectedCourseId
    );

    return `
      <section class="mneet-ncert-card">
        <h2>NCERT Books</h2>
        <p>
          তোমার অনুমোদিত Course-এর Chapter অনুযায়ী NCERT PDF পড়ো।
        </p>

        <label class="mneet-ncert-label" for="mneetNcertCourse">
          Course
        </label>

        <select class="mneet-ncert-select"
          id="mneetNcertCourse">
          ${courses.map(course => `
            <option value="${escapeHTML(getId(course))}"
              ${getId(course) === state.selectedCourseId
                ? "selected"
                : ""}>
              ${escapeHTML(course.name || course.title || "Course")}
            </option>
          `).join("")}
        </select>

        <label class="mneet-ncert-label" for="mneetNcertChapter">
          Chapter
        </label>

        <select class="mneet-ncert-select"
          id="mneetNcertChapter">
          <option value="">All Chapters</option>

          ${chapters.map(chapter => `
            <option value="${escapeHTML(getId(chapter))}"
              ${getId(chapter) === state.selectedChapterId
                ? "selected"
                : ""}>
              ${escapeHTML(chapter.name || chapter.title || "Chapter")}
            </option>
          `).join("")}
        </select>

        <label class="mneet-ncert-label" for="mneetNcertSearch">
          Search NCERT PDF
        </label>

        <input class="mneet-ncert-search"
          id="mneetNcertSearch"
          type="search"
          placeholder="PDF বা Chapter-এর নাম লিখো">
      </section>
    `;
  }

  function renderFileList() {
    const files = getFilteredFiles();

    if (!files.length) {
      return `
        <div class="mneet-ncert-empty">
          এই Course বা Chapter-এর জন্য কোনো NCERT PDF পাওয়া যায়নি।
        </div>
      `;
    }

    return `
      <section class="mneet-ncert-card">
        <h3>Available NCERT PDFs</h3>

        <div class="mneet-ncert-library-grid">
          ${files.map(file => `
            <article class="mneet-ncert-file">
              <div class="mneet-ncert-file-title">
                ${escapeHTML(getFileTitle(file))}
              </div>

              <div class="mneet-ncert-file-info">
                Course: ${escapeHTML(
                  getCourseName(getCourseId(file))
                )}
                <br>
                Chapter: ${escapeHTML(
                  getChapterName(getChapterId(file))
                )}
                ${file.description
                  ? `<br>${escapeHTML(file.description)}`
                  : ""}
              </div>

              <div class="mneet-ncert-file-actions">
                <button type="button"
                  class="mneet-ncert-button mneet-ncert-button-primary"
                  data-ncert-open="${escapeHTML(getId(file))}">
                  Read PDF
                </button>

                <button type="button"
                  class="mneet-ncert-button"
                  data-ncert-external="${escapeHTML(getId(file))}">
                  Open PDF
                </button>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderReader() {
    if (!state.selectedFile) return "";

    return `
      <section class="mneet-ncert-card">
        <div class="mneet-ncert-row">
          <h3>${escapeHTML(getFileTitle(state.selectedFile))}</h3>
          <button type="button"
            class="mneet-ncert-button"
            data-ncert-close>
            Back to Library
          </button>
        </div>

        <div class="mneet-ncert-reader">
          <div class="mneet-ncert-reader-toolbar">
            <button type="button"
              class="mneet-ncert-button"
              data-ncert-prev
              disabled>
              Previous
            </button>

            <span class="mneet-ncert-page-label"
              id="mneetNcertPageLabel">
              Page 1 / —
            </span>

            <button type="button"
              class="mneet-ncert-button"
              data-ncert-next
              disabled>
              Next
            </button>

            <button type="button"
              class="mneet-ncert-button"
              data-ncert-zoom-out>
              −
            </button>

            <button type="button"
              class="mneet-ncert-button"
              data-ncert-zoom-reset>
              100%
            </button>

            <button type="button"
              class="mneet-ncert-button"
              data-ncert-zoom-in>
              +
            </button>
          </div>

          <div class="mneet-ncert-status"
            id="mneetNcertReaderStatus">
            PDF load হচ্ছে...
          </div>

          <div class="mneet-ncert-canvas-area"
            id="mneetNcertCanvasArea"></div>
        </div>
      </section>
    `;
  }

  function render() {
    const container = getContainer();

    if (!container) return false;

    addStyles();

    container.innerHTML = `
      <div class="mneet-ncert">
        ${renderSelectors()}
        ${getAvailableCourses().length ? renderFileList() : ""}
        ${renderReader()}
      </div>
    `;

    bindContainerEvents(container);

    if (state.selectedFile) {
      updateToolbar();
    }

    return true;
  }

  function bindContainerEvents(container) {
    const courseSelect = container.querySelector(
      "#mneetNcertCourse"
    );

    if (courseSelect) {
      courseSelect.addEventListener("change", event => {
        state.selectedCourseId = event.target.value;
        state.selectedChapterId = "";
        closeReader();
        render();
      });
    }

    const chapterSelect = container.querySelector(
      "#mneetNcertChapter"
    );

    if (chapterSelect) {
      chapterSelect.addEventListener("change", event => {
        state.selectedChapterId = event.target.value;
        render();
      });
    }

    const search = container.querySelector("#mneetNcertSearch");

    if (search) {
      search.addEventListener("input", () => {
        const position = search.selectionStart;
        const value = search.value;

        const list = container.querySelector(
          ".mneet-ncert-library-grid"
        );

        const replacement = document.createElement("div");
        replacement.innerHTML = renderFileList();

        const newList = replacement.querySelector(
          ".mneet-ncert-library-grid"
        );

        if (list && newList) {
          list.replaceWith(newList);
        }

        search.value = value;
        search.setSelectionRange(position, position);
      });
    }
  }

  function setStatus(message) {
    const element = document.getElementById(
      "mneetNcertReaderStatus"
    );

    if (element) {
      element.textContent = message;
      element.classList.remove("mneet-ncert-hidden");
    }
  }

  function getPDFJS() {
    if (pdfjs) return Promise.resolve(pdfjs);

    if (window.pdfjsLib) {
      pdfjs = window.pdfjsLib;
      return Promise.resolve(pdfjs);
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(
        'script[data-mneet-pdfjs="true"]'
      );

      if (existing) {
        existing.addEventListener("load", () => {
          if (window.pdfjsLib) {
            pdfjs = window.pdfjsLib;
            resolve(pdfjs);
          } else {
            reject(new Error("PDF reader library load হয়নি।"));
          }
        }, { once: true });

        existing.addEventListener("error", () => {
          reject(new Error("PDF reader library load করা যায়নি।"));
        }, { once: true });

        return;
      }

      const script = document.createElement("script");

      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" +
        PDFJS_VERSION +
        "/pdf.min.js";

      script.dataset.mneetPdfjs = "true";

      script.onload = () => {
        if (!window.pdfjsLib) {
          reject(new Error("PDF reader library পাওয়া যায়নি।"));
          return;
        }

        pdfjs = window.pdfjsLib;

        pdfjs.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" +
          PDFJS_VERSION +
          "/pdf.worker.min.js";

        resolve(pdfjs);
      };

      script.onerror = () => {
        reject(new Error(
          "PDF reader load হয়নি। Internet connection পরীক্ষা করো।"
        ));
      };

      document.head.appendChild(script);
    });
  }

  async function openFile(fileId) {
    const file = state.ncertFiles.find(
      item => getId(item) === String(fileId)
    );

    if (!file) {
      throw new Error("NCERT PDF পাওয়া যায়নি।");
    }

    const courseId = getCourseId(file);

    if (!hasCourseAccess(courseId)) {
      throw new Error(
        "এই Course-এর NCERT পড়তে Admin-approved purchase দরকার।"
      );
    }

    const url = getFileURL(file);

    if (!url) {
      throw new Error("PDF URL পাওয়া যায়নি।");
    }

    state.selectedFile = file;
    state.currentPage = 1;
    state.totalPages = 0;
    state.zoom = 1;

    render();

    try {
      setStatus("PDF load হচ্ছে...");

      const library = await getPDFJS();

      /*
        The PDF host must permit browser access.
        Firebase Storage downloads need suitable Storage Rules.
      */
      const loadingTask = library.getDocument({
        url: url,
        withCredentials: false
      });

      const pdf = await loadingTask.promise;

      if (
        !state.selectedFile ||
        getId(state.selectedFile) !== String(fileId)
      ) {
        return;
      }

      state.pdfDocument = pdf;
      state.totalPages = pdf.numPages;

      setStatus("");

      const status = document.getElementById(
        "mneetNcertReaderStatus"
      );

      if (status) {
        status.classList.add("mneet-ncert-hidden");
      }

      await renderPage(1);
      updateToolbar();
      restoreSavedPage(fileId);
    } catch (error) {
      console.error("[mNEET NCERT] PDF loading failed:", error);

      setStatus(
        "PDF খোলা যায়নি। PDF URL, Firebase Storage permissions, " +
        "এবং browser CORS access পরীক্ষা করো।"
      );

      throw error;
    }
  }

  async function renderPage(pageNumber) {
    if (!state.pdfDocument) return;

    const sequence = ++renderSequence;

    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch (_) {}
      currentRenderTask = null;
    }

    const area = document.getElementById(
      "mneetNcertCanvasArea"
    );

    if (!area) return;

    const page = await state.pdfDocument.getPage(pageNumber);

    if (sequence !== renderSequence) return;

    const viewport = page.getViewport({
      scale: state.zoom
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      2
    );

    canvas.width = Math.floor(viewport.width * pixelRatio);
    canvas.height = Math.floor(viewport.height * pixelRatio);

    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";

    context.setTransform(
      pixelRatio, 0,
      0, pixelRatio,
      0, 0
    );

    area.innerHTML = "";
    area.appendChild(canvas);

    currentRenderTask = page.render({
      canvasContext: context,
      viewport: viewport
    });

    try {
      await currentRenderTask.promise;
    } catch (error) {
      if (error && error.name !== "RenderingCancelledException") {
        throw error;
      }
      return;
    } finally {
      currentRenderTask = null;
    }

    if (sequence !== renderSequence) return;

    state.currentPage = pageNumber;

    updateToolbar();
    saveProgressSoon();
  }

  function updateToolbar() {
    const label = document.getElementById(
      "mneetNcertPageLabel"
    );

    if (label) {
      label.textContent =
        "Page " + state.currentPage + " / " +
        (state.totalPages || "—");
    }

    const prev = document.querySelector("[data-ncert-prev]");
    const next = document.querySelector("[data-ncert-next]");

    if (prev) {
      prev.disabled = state.currentPage <= 1;
    }

    if (next) {
      next.disabled =
        !state.totalPages ||
        state.currentPage >= state.totalPages;
    }
  }

  async function nextPage() {
    if (
      state.totalPages &&
      state.currentPage < state.totalPages
    ) {
      await renderPage(state.currentPage + 1);
    }
  }

  async function previousPage() {
    if (state.currentPage > 1) {
      await renderPage(state.currentPage - 1);
    }
  }

  async function changeZoom(amount) {
    const nextZoom = Math.min(
      2.5,
      Math.max(0.6, state.zoom + amount)
    );

    if (nextZoom === state.zoom) return;

    state.zoom = nextZoom;

    if (state.pdfDocument) {
      await renderPage(state.currentPage);
    }

    const resetButton = document.querySelector(
      "[data-ncert-zoom-reset]"
    );

    if (resetButton) {
      resetButton.textContent =
        Math.round(state.zoom * 100) + "%";
    }
  }

  async function resetZoom() {
    state.zoom = 1;

    if (state.pdfDocument) {
      await renderPage(state.currentPage);
    }

    const resetButton = document.querySelector(
      "[data-ncert-zoom-reset]"
    );

    if (resetButton) {
      resetButton.textContent = "100%";
    }
  }

  function closeReader() {
    renderSequence++;

    if (currentRenderTask) {
      try {
        currentRenderTask.cancel();
      } catch (_) {}
    }

    currentRenderTask = null;
    state.selectedFile = null;
    state.pdfDocument = null;
    state.currentPage = 1;
    state.totalPages = 0;
    state.zoom = 1;

    render();
  }

  function openExternalPDF(fileId) {
    const file = state.ncertFiles.find(
      item => getId(item) === String(fileId)
    );

    if (!file) return;

    if (!hasCourseAccess(getCourseId(file))) {
      alert("এই Course-এর NCERT পড়ার অনুমতি নেই।");
      return;
    }

    const url = getFileURL(file);

    if (!url) {
      alert("PDF URL পাওয়া যায়নি।");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function saveProgressSoon() {
    if (!state.user || !state.selectedFile) return;

    clearTimeout(progressSaveTimer);

    progressSaveTimer = setTimeout(() => {
      saveProgress().catch(error => {
        console.warn(
          "[mNEET NCERT] Reading progress was not saved:",
          error
        );
      });
    }, 700);
  }

  async function saveProgress() {
    const user = state.user;
    const file = state.selectedFile;

    if (!user || !file) return;

    const db = getFirebase().db;

    /*
      Reading progress is stored separately from Admin content.
      This does not grant course access or change purchase status.
    */
    const progressId = String(getId(file))
      .replace(/[\/\\]/g, "_");

    await db
      .collection("studentNcertProgress")
      .doc(user.uid + "_" + progressId)
      .set({
        userId: user.uid,
        fileId: getId(file),
        courseId: getCourseId(file),
        chapterId: getChapterId(file),
        page: state.currentPage,
        totalPages: state.totalPages,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
  }

  async function restoreSavedPage(fileId) {
    if (!state.user || !state.pdfDocument) return;

    try {
      const db = getFirebase().db;

      const progressId = String(fileId)
        .replace(/[\/\\]/g, "_");

      const doc = await db
        .collection("studentNcertProgress")
        .doc(state.user.uid + "_" + progressId)
        .get();

      if (!doc.exists) return;

      const data = doc.data() || {};
      const page = Number(data.page);

      if (
        state.selectedFile &&
        getId(state.selectedFile) === String(fileId) &&
        Number.isInteger(page) &&
        page > 1 &&
        page <= state.totalPages
      ) {
        await renderPage(page);
      }
    } catch (error) {
      /*
        Reading remains available if saving/restoring progress
        is blocked by Firestore Rules.
      */
      console.warn(
        "[mNEET NCERT] Could not restore reading progress:",
        error
      );
    }
  }

  function handleClick(event) {
    const target = event.target.closest("button");

    if (!target) return;

    const openId = target.getAttribute("data-ncert-open");

    if (openId) {
      openFile(openId).catch(error => {
        console.error(error);
        alert(error.message || "NCERT PDF খোলা যায়নি।");
      });
      return;
    }

    const externalId = target.getAttribute("data-ncert-external");

    if (externalId) {
      openExternalPDF(externalId);
      return;
    }

    if (target.hasAttribute("data-ncert-close")) {
      closeReader();
      return;
    }

    if (target.hasAttribute("data-ncert-next")) {
      nextPage().catch(console.error);
      return;
    }

    if (target.hasAttribute("data-ncert-prev")) {
      previousPage().catch(console.error);
      return;
    }

    if (target.hasAttribute("data-ncert-zoom-in")) {
      changeZoom(0.15).catch(console.error);
      return;
    }

    if (target.hasAttribute("data-ncert-zoom-out")) {
      changeZoom(-0.15).catch(console.error);
      return;
    }

    if (target.hasAttribute("data-ncert-zoom-reset")) {
      resetZoom().catch(console.error);
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);

    document.addEventListener("mneet:student-page-change", event => {
      const detail = event.detail || {};

      const page = String(
        detail.page || detail.pageName || detail.name || ""
      ).toLowerCase();

      if (page.includes("ncert")) {
        refresh().catch(console.error);
      }
    });

    window.addEventListener("beforeunload", () => {
      clearTimeout(progressSaveTimer);
    });
  }

  async function refresh() {
    try {
      await loadData();
      render();
      return true;
    } catch (error) {
      state.error = error;

      console.error("[mNEET NCERT] Refresh failed:", error);

      const container = getContainer();

      if (container) {
        addStyles();

        container.innerHTML = `
          <div class="mneet-ncert">
            <div class="mneet-ncert-empty">
              <h3>NCERT load করা যায়নি</h3>
              Firebase connection, collection access এবং Security Rules
              পরীক্ষা করো।
              <br><br>
              <button type="button"
                class="mneet-ncert-button mneet-ncert-button-primary"
                data-ncert-retry>
                আবার চেষ্টা করো
              </button>
            </div>
          </div>
        `;
      }

      return false;
    }
  }

  async function initialize() {
    if (state.initialized) return;

    addStyles();
    bindEvents();

    try {
      const fb = getFirebase();

      fb.auth.onAuthStateChanged(async user => {
        state.user = user || null;

        if (!user) {
          state.courses = [];
          state.chapters = [];
          state.subjects = [];
          state.ncertFiles = [];
          state.purchases = [];
          state.selectedFile = null;
          state.selectedCourseId = "";
          state.selectedChapterId = "";
          return;
        }

        await refresh();
      });

      state.initialized = true;
    } catch (error) {
      state.error = error;
      console.error(
        "[mNEET NCERT] Initialization failed:",
        error
      );
    }
  }

  /*
    Retry button is handled separately because it is rendered
    dynamically after a failed load.
  */
  document.addEventListener("click", event => {
    const retry = event.target.closest("[data-ncert-retry]");

    if (retry) {
      refresh().catch(console.error);
    }
  });

  window.MNEETStudentNCERT = {
    initialize,
    refresh,
    render,
    loadData,
    openFile,
    closeReader,
    nextPage,
    previousPage,
    changeZoom,
    resetZoom,
    saveProgress,

    getState() {
      return {
        user: state.user,
        courses: [...state.courses],
        chapters: [...state.chapters],
        subjects: [...state.subjects],
        ncertFiles: [...state.ncertFiles],
        selectedCourseId: state.selectedCourseId,
        selectedChapterId: state.selectedChapterId,
        selectedFile: state.selectedFile,
        currentPage: state.currentPage,
        totalPages: state.totalPages,
        zoom: state.zoom,
        loading: state.loading,
        error: state.error
      };
    },

    getLastError() {
      return state.error;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

})();
