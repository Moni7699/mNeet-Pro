/* ==========================================================
   mNEET — FILE 39
   Student Notes & PYQ Materials
   Notes: Topic-wise
   PYQ: Chapter-wise
   Green + White Theme
   ========================================================== */

(function () {
  "use strict";

  const COLLECTIONS = {
    courses: "courses",
    subjects: "subjects",
    chapters: "chapters",
    topics: "topics",
    notes: "notes",
    pyq: "pyq",
    purchases: "purchases",
    progress: "studentMaterialProgress"
  };

  const APPROVED_STATUSES = ["approved", "paid", "completed"];

  const state = {
    user: null,
    courses: [],
    subjects: [],
    chapters: [],
    topics: [],
    notes: [],
    pyq: [],
    purchases: [],
    activeTab: "notes",
    selectedCourseId: "",
    selectedChapterId: "",
    selectedTopicId: "",
    selectedMaterial: null,
    loading: false,
    error: null,
    initialized: false
  };

  const CSS = `
    .mneet-materials {
      background: #071A12;
      color: #FFFFFF;
      padding: 14px;
      border-radius: 16px;
      width: 100%;
      box-sizing: border-box;
    }

    .mneet-materials *,
    .mneet-materials *::before,
    .mneet-materials *::after {
      box-sizing: border-box;
    }

    .mneet-materials-card {
      background: #0D2419;
      border: 1px solid #28513A;
      border-radius: 14px;
      padding: 16px;
      margin-bottom: 14px;
    }

    .mneet-materials h2,
    .mneet-materials h3 {
      color: #FFFFFF;
      line-height: 1.45;
      margin-top: 0;
    }

    .mneet-materials p {
      color: #D1D5DB;
      line-height: 1.7;
    }

    .mneet-materials-label {
      display: block;
      margin: 12px 0 7px;
      color: #D1D5DB;
      font-size: 13px;
    }

    .mneet-materials-select,
    .mneet-materials-search {
      display: block;
      width: 100%;
      min-height: 44px;
      padding: 11px 12px;
      border: 1px solid #28513A;
      border-radius: 10px;
      color: #FFFFFF;
      background: #10291D;
      font: inherit;
    }

    .mneet-materials-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 9px 13px;
      color: #FFFFFF;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 9px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
    }

    .mneet-materials-button-primary {
      background: #16A34A;
      border-color: #16A34A;
    }

    .mneet-materials-button:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    .mneet-materials-tabs {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 14px;
    }

    .mneet-materials-tab {
      min-height: 44px;
      padding: 10px;
      border-radius: 10px;
      background: #10291D;
      color: #FFFFFF;
      border: 1px solid #28513A;
      font: inherit;
      font-weight: 800;
      cursor: pointer;
    }

    .mneet-materials-tab[aria-selected="true"] {
      background: #16A34A;
      border-color: #16A34A;
    }

    .mneet-materials-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
    }

    .mneet-material-item {
      min-width: 0;
      padding: 14px;
      background: #10291D;
      border: 1px solid #28513A;
      border-radius: 12px;
    }

    .mneet-material-title {
      font-size: 15px;
      font-weight: 800;
      line-height: 1.6;
      overflow-wrap: anywhere;
      margin-bottom: 7px;
    }

    .mneet-material-meta {
      color: #D1D5DB;
      font-size: 12px;
      line-height: 1.8;
      overflow-wrap: anywhere;
      margin-bottom: 12px;
    }

    .mneet-material-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .mneet-material-empty {
      text-align: center;
      padding: 20px;
      color: #D1D5DB;
      background: #0D2419;
      border: 1px dashed #28513A;
      border-radius: 12px;
      line-height: 1.8;
    }

    .mneet-material-reader {
      overflow: hidden;
      border: 1px solid #28513A;
      border-radius: 14px;
      background: #0D2419;
    }

    .mneet-material-reader-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      padding: 12px;
      border-bottom: 1px solid #28513A;
      background: #10291D;
    }

    .mneet-material-frame {
      display: block;
      width: 100%;
      height: 75vh;
      min-height: 380px;
      border: 0;
      background: #FFFFFF;
    }

    .mneet-material-status {
      padding: 14px;
      color: #D1D5DB;
      line-height: 1.7;
      overflow-wrap: anywhere;
    }

    @media (min-width: 720px) {
      .mneet-materials {
        padding: 22px;
      }

      .mneet-materials-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `;

  let progressTimer = null;

  function addStyles() {
    if (document.getElementById("mneetMaterialsStyles")) return;

    const style = document.createElement("style");
    style.id = "mneetMaterialsStyles";
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

  function getUser() {
    const api = window.MNEETStudent;

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
      "studentMaterialsContent",
      "studentMaterialsPageContent",
      "studentPageNotes",
      "studentPagePyq",
      "studentNotesContent",
      "studentPyqContent",
      "studentPageMaterials"
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

  function getTopicId(item) {
    return String(
      item.topicId ||
      item.topicID ||
      item.parentTopicId ||
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

  function getPurchaseStatus(purchase) {
    return String(
      purchase.status ||
      purchase.paymentStatus ||
      purchase.approvalStatus ||
      ""
    ).toLowerCase();
  }

  function isApproved(purchase) {
    return APPROVED_STATUSES.includes(
      getPurchaseStatus(purchase)
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

    const api = window.MNEETStudent;

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

    const api = window.MNEETStudent;

    if (
      api &&
      typeof api.hasCourseAccess === "function" &&
      api.hasCourseAccess(courseId)
    ) {
      return true;
    }

    return getApprovedCourseIds().has(String(courseId));
  }

  function getAccessibleCourses() {
    const approvedIds = getApprovedCourseIds();

    return state.courses.filter(course =>
      isActive(course) &&
      approvedIds.has(getId(course))
    );
  }

  function getName(item) {
    return item.name || item.title || "Untitled";
  }

  function getChapterName(chapterId) {
    const chapter = state.chapters.find(
      item => getId(item) === chapterId
    );

    return chapter ? getName(chapter) : "Chapter";
  }

  function getTopicName(topicId) {
    const topic = state.topics.find(
      item => getId(item) === topicId
    );

    return topic ? getName(topic) : "Topic";
  }

  function getCourseName(courseId) {
    const course = state.courses.find(
      item => getId(item) === courseId
    );

    return course ? getName(course) : "Course";
  }

  function getMaterialURL(item) {
    return String(
      item.pdfUrl ||
      item.fileUrl ||
      item.downloadURL ||
      item.downloadUrl ||
      item.url ||
      ""
    ).trim();
  }

  async function readCollection(name) {
    const snapshot = await getFirebase()
      .db.collection(name).get();

    const result = [];

    snapshot.forEach(doc => {
      result.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return result;
  }

  async function readPurchases(uid) {
    const snapshot = await getFirebase()
      .db.collection(COLLECTIONS.purchases)
      .where("userId", "==", uid)
      .get();

    const result = [];

    snapshot.forEach(doc => {
      result.push({
        ...doc.data(),
        id: doc.id
      });
    });

    return result;
  }

  async function loadData() {
    const user = getUser();

    if (!user) {
      throw new Error("আগে Sign In করো।");
    }

    state.user = user;
    state.loading = true;
    state.error = null;

    try {
      const [
        courses,
        subjects,
        chapters,
        topics,
        notes,
        pyq,
        purchases
      ] = await Promise.all([
        readCollection(COLLECTIONS.courses),
        readCollection(COLLECTIONS.subjects),
        readCollection(COLLECTIONS.chapters),
        readCollection(COLLECTIONS.topics),
        readCollection(COLLECTIONS.notes),
        readCollection(COLLECTIONS.pyq),
        readPurchases(user.uid)
      ]);

      state.courses = courses;
      state.subjects = subjects;
      state.chapters = chapters;
      state.topics = topics;
      state.notes = notes;
      state.pyq = pyq;
      state.purchases = purchases;

      const accessible = getAccessibleCourses();

      if (
        !state.selectedCourseId ||
        !accessible.some(
          course => getId(course) === state.selectedCourseId
        )
      ) {
        state.selectedCourseId = accessible.length
          ? getId(accessible[0])
          : "";
      }

      if (
        state.selectedChapterId &&
        !state.chapters.some(
          chapter =>
            getId(chapter) === state.selectedChapterId &&
            getCourseId(chapter) === state.selectedCourseId
        )
      ) {
        state.selectedChapterId = "";
      }

      if (
        state.selectedTopicId &&
        !state.topics.some(
          topic =>
            getId(topic) === state.selectedTopicId &&
            getCourseId(topic) === state.selectedCourseId
        )
      ) {
        state.selectedTopicId = "";
      }

      return true;
    } finally {
      state.loading = false;
    }
  }

  function getFilteredMaterials() {
    const source = state.activeTab === "notes"
      ? state.notes
      : state.pyq;

    let items = source.filter(item => {
      if (!isActive(item)) return false;

      const courseId = getCourseId(item);

      if (!courseId || !hasCourseAccess(courseId)) return false;

      if (
        state.selectedCourseId &&
        courseId !== state.selectedCourseId
      ) {
        return false;
      }

      if (state.activeTab === "notes") {
        if (
          state.selectedTopicId &&
          getTopicId(item) !== state.selectedTopicId
        ) {
          return false;
        }
      } else {
        if (
          state.selectedChapterId &&
          getChapterId(item) !== state.selectedChapterId
        ) {
          return false;
        }
      }

      return Boolean(getMaterialURL(item));
    });

    const search = document.getElementById(
      "mneetMaterialsSearch"
    );

    const query = search
      ? search.value.trim().toLowerCase()
      : "";

    if (query) {
      items = items.filter(item => {
        const locationName = state.activeTab === "notes"
          ? getTopicName(getTopicId(item))
          : getChapterName(getChapterId(item));

        const text = [
          getName(item),
          item.description,
          locationName,
          getCourseName(getCourseId(item))
        ].join(" ").toLowerCase();

        return text.includes(query);
      });
    }

    return items.sort((a, b) => {
      const orderA = Number(a.order || 0);
      const orderB = Number(b.order || 0);

      if (orderA !== orderB) return orderA - orderB;

      return getName(a).localeCompare(getName(b));
    });
  }

  function renderSelectors() {
    const courses = getAccessibleCourses();

    if (!courses.length) {
      return `
        <div class="mneet-material-empty">
          <h3>Study Materials</h3>
          তোমার account-এ কোনো Admin-approved Course পাওয়া যায়নি।
          <br>
          Purchase approval পাওয়ার পরে Notes ও PYQ দেখতে পারবে।
        </div>
      `;
    }

    const chapters = state.chapters
      .filter(chapter =>
        isActive(chapter) &&
        getCourseId(chapter) === state.selectedCourseId
      )
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    const topics = state.topics
      .filter(topic =>
        isActive(topic) &&
        getCourseId(topic) === state.selectedCourseId
      )
      .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

    return `
      <section class="mneet-materials-card">
        <h2>Study Materials</h2>
        <p>
          Notes topic-wise এবং PYQ chapter-wise সাজানো আছে।
        </p>

        <div class="mneet-materials-tabs">
          <button type="button"
            class="mneet-materials-tab"
            data-material-tab="notes"
            aria-selected="${state.activeTab === "notes"}">
            Topic Notes
          </button>

          <button type="button"
            class="mneet-materials-tab"
            data-material-tab="pyq"
            aria-selected="${state.activeTab === "pyq"}">
            Chapter PYQ
          </button>
        </div>

        <label class="mneet-materials-label"
          for="mneetMaterialsCourse">
          Course
        </label>

        <select class="mneet-materials-select"
          id="mneetMaterialsCourse">
          ${courses.map(course => `
            <option value="${escapeHTML(getId(course))}"
              ${getId(course) === state.selectedCourseId
                ? "selected"
                : ""}>
              ${escapeHTML(getName(course))}
            </option>
          `).join("")}
        </select>

        ${state.activeTab === "notes" ? `
          <label class="mneet-materials-label"
            for="mneetMaterialsTopic">
            Topic
          </label>

          <select class="mneet-materials-select"
            id="mneetMaterialsTopic">
            <option value="">All Topics</option>
            ${topics.map(topic => `
              <option value="${escapeHTML(getId(topic))}"
                ${getId(topic) === state.selectedTopicId
                  ? "selected"
                  : ""}>
                ${escapeHTML(getName(topic))}
              </option>
            `).join("")}
          </select>
        ` : `
          <label class="mneet-materials-label"
            for="mneetMaterialsChapter">
            Chapter
          </label>

          <select class="mneet-materials-select"
            id="mneetMaterialsChapter">
            <option value="">All Chapters</option>
            ${chapters.map(chapter => `
              <option value="${escapeHTML(getId(chapter))}"
                ${getId(chapter) === state.selectedChapterId
                  ? "selected"
                  : ""}>
                ${escapeHTML(getName(chapter))}
              </option>
            `).join("")}
          </select>
        `}

        <label class="mneet-materials-label"
          for="mneetMaterialsSearch">
          Search
        </label>

        <input class="mneet-materials-search"
          id="mneetMaterialsSearch"
          type="search"
          placeholder="নাম লিখে খুঁজুন">
      </section>
    `;
  }

  function renderMaterialList() {
    const items = getFilteredMaterials();

    if (!items.length) {
      return `
        <div class="mneet-material-empty">
          ${state.activeTab === "notes"
            ? "এই Topic-এর জন্য কোনো Notes PDF পাওয়া যায়নি।"
            : "এই Chapter-এর জন্য কোনো PYQ PDF পাওয়া যায়নি।"}
        </div>
      `;
    }

    return `
      <section class="mneet-materials-card">
        <h3>
          ${state.activeTab === "notes"
            ? "Topic Notes"
            : "Chapter-wise PYQ"}
        </h3>

        <div class="mneet-materials-grid">
          ${items.map(item => {
            const locationName = state.activeTab === "notes"
              ? getTopicName(getTopicId(item))
              : getChapterName(getChapterId(item));

            return `
              <article class="mneet-material-item">
                <div class="mneet-material-title">
                  ${escapeHTML(getName(item))}
                </div>

                <div class="mneet-material-meta">
                  Course: ${escapeHTML(
                    getCourseName(getCourseId(item))
                  )}
                  <br>
                  ${state.activeTab === "notes"
                    ? "Topic"
                    : "Chapter"}:
                  ${escapeHTML(locationName)}
                  ${item.description
                    ? `<br>${escapeHTML(item.description)}`
                    : ""}
                </div>

                <div class="mneet-material-actions">
                  <button type="button"
                    class="mneet-materials-button mneet-materials-button-primary"
                    data-material-read="${escapeHTML(getId(item))}">
                    Read PDF
                  </button>

                  <button type="button"
                    class="mneet-materials-button"
                    data-material-open="${escapeHTML(getId(item))}">
                    Open PDF
                  </button>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderReader() {
    const item = state.selectedMaterial;

    if (!item) return "";

    return `
      <section class="mneet-materials-card">
        <div class="mneet-materials-reader">
          <div class="mneet-material-reader-toolbar">
            <strong>${escapeHTML(getName(item))}</strong>

            <button type="button"
              class="mneet-materials-button"
              data-material-close>
              Back
            </button>
          </div>

          <div class="mneet-material-status">
            PDF Reader
          </div>

          <iframe
            class="mneet-material-frame"
            title="${escapeHTML(getName(item))}"
            src="${escapeHTML(getMaterialURL(item))}"
            loading="lazy"
            referrerpolicy="no-referrer">
          </iframe>
        </div>
      </section>
    `;
  }

  function render() {
    const container = getContainer();

    if (!container) return false;

    addStyles();

    container.innerHTML = `
      <div class="mneet-materials">
        ${renderSelectors()}
        ${getAccessibleCourses().length ? renderMaterialList() : ""}
        ${renderReader()}
      </div>
    `;

    return true;
  }

  function openMaterial(materialId) {
    const item = getFilteredMaterials().find(
      material => getId(material) === String(materialId)
    );

    if (!item) {
      throw new Error("এই Material পাওয়া যায়নি।");
    }

    if (!hasCourseAccess(getCourseId(item))) {
      throw new Error(
        "এই Course-এর materials পড়ার জন্য Admin approval দরকার।"
      );
    }

    state.selectedMaterial = item;
    render();
    saveProgressSoon();
  }

  function openExternal(materialId) {
    const item = getFilteredMaterials().find(
      material => getId(material) === String(materialId)
    );

    if (!item) return;

    if (!hasCourseAccess(getCourseId(item))) {
      alert("এই Course-এর materials পড়ার অনুমতি নেই।");
      return;
    }

    const url = getMaterialURL(item);

    if (!url) {
      alert("PDF URL পাওয়া যায়নি।");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function closeReader() {
    state.selectedMaterial = null;
    render();
  }

  function saveProgressSoon() {
    clearTimeout(progressTimer);

    if (!state.user || !state.selectedMaterial) return;

    progressTimer = setTimeout(() => {
      saveProgress().catch(error => {
        console.warn(
          "[mNEET Materials] Reading progress save failed:",
          error
        );
      });
    }, 600);
  }

  async function saveProgress() {
    const user = state.user;
    const item = state.selectedMaterial;

    if (!user || !item) return;

    const db = getFirebase().db;

    await db.collection(COLLECTIONS.progress)
      .doc(user.uid + "_" + getId(item))
      .set({
        userId: user.uid,
        materialId: getId(item),
        type: state.activeTab,
        courseId: getCourseId(item),
        chapterId: getChapterId(item),
        topicId: getTopicId(item),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
  }

  function handleClick(event) {
    const target = event.target.closest("button");

    if (!target) return;

    const tab = target.getAttribute("data-material-tab");

    if (tab === "notes" || tab === "pyq") {
      state.activeTab = tab;
      state.selectedMaterial = null;
      render();
      return;
    }

    const readId = target.getAttribute("data-material-read");

    if (readId) {
      try {
        openMaterial(readId);
      } catch (error) {
        alert(error.message || "Material খোলা যায়নি।");
      }
      return;
    }

    const externalId = target.getAttribute("data-material-open");

    if (externalId) {
      openExternal(externalId);
      return;
    }

    if (target.hasAttribute("data-material-close")) {
      closeReader();
    }
  }

  function handleChange(event) {
    const target = event.target;

    if (target.id === "mneetMaterialsCourse") {
      state.selectedCourseId = target.value;
      state.selectedChapterId = "";
      state.selectedTopicId = "";
      state.selectedMaterial = null;
      render();
      return;
    }

    if (target.id === "mneetMaterialsChapter") {
      state.selectedChapterId = target.value;
      state.selectedMaterial = null;
      render();
      return;
    }

    if (target.id === "mneetMaterialsTopic") {
      state.selectedTopicId = target.value;
      state.selectedMaterial = null;
      render();
    }
  }

  function handleSearch() {
    const container = getContainer();
    if (!container) return;

    const search = container.querySelector(
      "#mneetMaterialsSearch"
    );

    if (!search) return;

    const position = search.selectionStart;
    const value = search.value;

    const replacement = document.createElement("div");
    replacement.innerHTML = renderMaterialList();

    const newList = replacement.querySelector(
      ".mneet-materials-card"
    );

    const currentList = container.querySelector(
      ".mneet-materials > .mneet-materials-card:nth-of-type(2)"
    );

    if (newList && currentList) {
      currentList.replaceWith(newList);
    }

    const updatedSearch = container.querySelector(
      "#mneetMaterialsSearch"
    );

    if (updatedSearch) {
      updatedSearch.value = value;

      try {
        updatedSearch.setSelectionRange(position, position);
      } catch (_) {}
    }
  }

  function bindEvents() {
    document.addEventListener("click", handleClick);
    document.addEventListener("change", handleChange);

    document.addEventListener("input", event => {
      if (event.target.id === "mneetMaterialsSearch") {
        handleSearch();
      }
    });

    document.addEventListener("mneet:student-page-change", event => {
      const detail = event.detail || {};

      const page = String(
        detail.page || detail.pageName || detail.name || ""
      ).toLowerCase();

      if (
        page.includes("notes") ||
        page.includes("pyq") ||
        page.includes("material")
      ) {
        refresh().catch(console.error);
      }
    });
  }

  async function refresh() {
    try {
      await loadData();
      render();
      return true;
    } catch (error) {
      state.error = error;

      console.error("[mNEET Materials] Refresh failed:", error);

      const container = getContainer();

      if (container) {
        addStyles();

        container.innerHTML = `
          <div class="mneet-materials">
            <div class="mneet-material-empty">
              <h3>Study Materials load হয়নি</h3>
              Firebase connection ও Security Rules পরীক্ষা করো।
              <br><br>
              <button type="button"
                class="mneet-materials-button mneet-materials-button-primary"
                data-material-retry>
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
          state.topics = [];
          state.notes = [];
          state.pyq = [];
          state.purchases = [];
          state.selectedMaterial = null;
          return;
        }

        await refresh();
      });

      state.initialized = true;
    } catch (error) {
      state.error = error;
      console.error(
        "[mNEET Materials] Initialization failed:",
        error
      );
    }
  }

  document.addEventListener("click", event => {
    const retry = event.target.closest("[data-material-retry]");

    if (retry) {
      refresh().catch(console.error);
    }
  });

  window.MNEETStudentMaterials = {
    initialize,
    refresh,
    loadData,
    render,
    openMaterial,
    openExternal,
    closeReader,
    saveProgress,

    getFilteredMaterials,

    getState() {
      return {
        user: state.user,
        activeTab: state.activeTab,
        courses: [...state.courses],
        chapters: [...state.chapters],
        topics: [...state.topics],
        notes: [...state.notes],
        pyq: [...state.pyq],
        selectedCourseId: state.selectedCourseId,
        selectedChapterId: state.selectedChapterId,
        selectedTopicId: state.selectedTopicId,
        selectedMaterial: state.selectedMaterial,
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
