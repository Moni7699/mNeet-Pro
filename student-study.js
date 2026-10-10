/* =========================================================
   mNEET STUDENT PANEL
   FILE 31: student-study.js

   Course → Subject → Chapter Study Navigation

   Requires:
   - firebase.js
   - auth-guard.js
   - student.js
   - student-courses.js
   - Firebase Compat SDK

   Green + White theme
========================================================= */

(function () {
  "use strict";

  const MODULE_NAME = "MNEETStudentStudy";
  const STYLE_ID = "mneet-student-study-styles";

  const COLLECTIONS = {
    courses: "courses",
    subjects: "subjects",
    chapters: "chapters",
    topics: "topics",
    purchases: "purchases"
  };

  const state = {
    initialized: false,
    loading: false,

    activeCourseId: "",
    activeSubjectId: "",
    activeChapterId: "",

    courses: [],
    subjects: [],
    chapters: [],
    topics: [],

    error: null
  };

  /* =======================================================
     COMMON HELPERS
  ======================================================= */

  function getDB() {
    if (
      window.MNEETFirebase &&
      window.MNEETFirebase.db
    ) {
      return window.MNEETFirebase.db;
    }

    if (
      window.mneetDB &&
      typeof window.mneetDB.collection === "function"
    ) {
      return window.mneetDB;
    }

    if (
      window.firebase &&
      firebase.apps &&
      firebase.apps.length
    ) {
      return firebase.firestore();
    }

    throw new Error(
      "Firebase database পাওয়া যাচ্ছে না। firebase.js পরীক্ষা করো।"
    );
  }

  function getStudent() {
    return window.MNEETStudent || null;
  }

  function getCurrentUser() {
    const student = getStudent();

    if (
      student &&
      typeof student.getCurrentUser === "function"
    ) {
      return student.getCurrentUser();
    }

    if (
      window.firebase &&
      firebase.apps &&
      firebase.apps.length
    ) {
      return firebase.auth().currentUser;
    }

    return null;
  }

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function escapeHTML(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getValue(object, keys, fallback) {
    for (const key of keys) {
      if (
        object &&
        object[key] !== undefined &&
        object[key] !== null &&
        object[key] !== ""
      ) {
        return object[key];
      }
    }

    return fallback;
  }

  function getId(item) {
    return clean(
      getValue(item, ["id", "courseId", "subjectId", "chapterId"], "")
    );
  }

  function getName(item) {
    return clean(
      getValue(
        item,
        ["name", "title", "subjectName", "chapterName", "courseName"],
        "Untitled"
      )
    );
  }

  function getOrder(item) {
    const value = Number(
      getValue(item, ["order", "sortOrder", "position", "serial"], 0)
    );

    return Number.isFinite(value) ? value : 0;
  }

  function sortByOrder(items) {
    return items.slice().sort(function (a, b) {
      const orderDifference = getOrder(a) - getOrder(b);

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return getName(a).localeCompare(getName(b));
    });
  }

  function getContainer() {
    return document.getElementById("studentStudyContent") ||
      document.getElementById("studentStudyPageContent") ||
      document.getElementById("studentPageStudy");
  }

  function showMessage(message) {
    const student = getStudent();

    if (
      student &&
      typeof student.showMessage === "function"
    ) {
      student.showMessage(message);
      return;
    }

    window.alert(message);
  }

  function showContainerMessage(message) {
    const container = getContainer();

    if (!container) {
      return;
    }

    container.innerHTML =
      '<div class="mneet-study-message">' +
      escapeHTML(message) +
      "</div>";
  }

  /* =======================================================
     COURSE ACCESS
  ======================================================= */

  function isCourseActive(course) {
    return Boolean(course) &&
      course.active !== false &&
      course.published !== false;
  }

  function isApprovedPurchase(purchase) {
    const status = clean(
      getValue(
        purchase,
        ["status", "paymentStatus", "approvalStatus"],
        ""
      )
    ).toLowerCase();

    return (
      status === "approved" ||
      status === "paid" ||
      status === "completed"
    );
  }

  function getPurchasedCourseIdsFromStudentAPI() {
    const student = getStudent();

    if (
      student &&
      typeof student.getPurchasedCourses === "function"
    ) {
      return student.getPurchasedCourses()
        .map(function (course) {
          return clean(
            getValue(course, ["id", "courseId", "courseID"], "")
          );
        })
        .filter(Boolean);
    }

    return [];
  }

  async function verifyCourseAccess(courseId) {
    const user = getCurrentUser();

    if (!user) {
      throw new Error(
        "Study content দেখতে প্রথমে Login করো।"
      );
    }

    const approvedCourseIds =
      getPurchasedCourseIdsFromStudentAPI();

    if (approvedCourseIds.includes(courseId)) {
      return true;
    }

    /*
      Fallback:
      Verify the signed-in user's purchase documents.
      Never trust a course ID passed only from the browser.
    */

    const snapshot = await getDB()
      .collection(COLLECTIONS.purchases)
      .where("userId", "==", user.uid)
      .get();

    let approved = false;

    snapshot.forEach(function (doc) {
      const data = doc.data() || {};

      const purchasedCourseId = clean(
        getValue(
          data,
          ["courseId", "courseID", "course_id"],
          ""
        )
      );

      if (
        purchasedCourseId === courseId &&
        isApprovedPurchase(data)
      ) {
        approved = true;
      }
    });

    if (!approved) {
      throw new Error(
        "এই Course-এর access এখনও Admin approve করেননি।"
      );
    }

    return true;
  }

  /* =======================================================
     FIRESTORE READS
  ======================================================= */

  async function readCollection(collectionName) {
    const snapshot = await getDB()
      .collection(collectionName)
      .get();

    const items = [];

    snapshot.forEach(function (doc) {
      const data = doc.data() || {};

      items.push({
        id: doc.id,
        ...data
      });
    });

    return items;
  }

  async function loadCourses() {
    const allCourses = await readCollection(
      COLLECTIONS.courses
    );

    const approvedIds = new Set(
      getPurchasedCourseIdsFromStudentAPI()
    );

    const user = getCurrentUser();

    /*
      If the Student API has not populated its purchase cache,
      obtain approved purchase IDs directly from Firestore.
    */

    if (user && approvedIds.size === 0) {
      const purchaseSnapshot = await getDB()
        .collection(COLLECTIONS.purchases)
        .where("userId", "==", user.uid)
        .get();

      purchaseSnapshot.forEach(function (doc) {
        const purchase = doc.data() || {};

        if (isApprovedPurchase(purchase)) {
          const id = clean(
            getValue(
              purchase,
              ["courseId", "courseID", "course_id"],
              ""
            )
          );

          if (id) {
            approvedIds.add(id);
          }
        }
      });
    }

    state.courses = allCourses.filter(function (course) {
      return (
        isCourseActive(course) &&
        approvedIds.has(getId(course))
      );
    });

    return state.courses;
  }

  async function loadSubjects(courseId) {
    const allSubjects = await readCollection(
      COLLECTIONS.subjects
    );

    state.subjects = sortByOrder(
      allSubjects.filter(function (subject) {
        const linkedCourseId = clean(
          getValue(
            subject,
            ["courseId", "courseID", "parentCourseId"],
            ""
          )
        );

        return (
          linkedCourseId === courseId &&
          subject.active !== false &&
          subject.published !== false
        );
      })
    );

    return state.subjects;
  }

  async function loadChapters(subjectId, courseId) {
    const allChapters = await readCollection(
      COLLECTIONS.chapters
    );

    state.chapters = sortByOrder(
      allChapters.filter(function (chapter) {
        const linkedSubjectId = clean(
          getValue(
            chapter,
            ["subjectId", "subjectID", "parentSubjectId"],
            ""
          )
        );

        const linkedCourseId = clean(
          getValue(
            chapter,
            ["courseId", "courseID", "parentCourseId"],
            ""
          )
        );

        const subjectMatches =
          linkedSubjectId === subjectId;

        const courseMatches =
          !linkedCourseId ||
          linkedCourseId === courseId;

        return (
          subjectMatches &&
          courseMatches &&
          chapter.active !== false &&
          chapter.published !== false
        );
      })
    );

    return state.chapters;
  }

  async function loadTopics(chapterId, courseId, subjectId) {
    const allTopics = await readCollection(
      COLLECTIONS.topics
    );

    state.topics = sortByOrder(
      allTopics.filter(function (topic) {
        const linkedChapterId = clean(
          getValue(
            topic,
            ["chapterId", "chapterID", "parentChapterId"],
            ""
          )
        );

        const linkedCourseId = clean(
          getValue(
            topic,
            ["courseId", "courseID"],
            ""
          )
        );

        const linkedSubjectId = clean(
          getValue(
            topic,
            ["subjectId", "subjectID"],
            ""
          )
        );

        return (
          linkedChapterId === chapterId &&
          (!linkedCourseId || linkedCourseId === courseId) &&
          (!linkedSubjectId || linkedSubjectId === subjectId) &&
          topic.active !== false &&
          topic.published !== false
        );
      })
    );

    return state.topics;
  }

  /* =======================================================
     GREEN + WHITE STYLES
  ======================================================= */

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      .mneet-study-wrap {
        width: 100%;
        max-width: 1100px;
        margin: 0 auto;
        color: #FFFFFF;
        box-sizing: border-box;
      }

      .mneet-study-header {
        border: 1px solid #28513A;
        border-radius: 15px;
        background: #0D2419;
        padding: 18px;
        margin-bottom: 16px;
        box-sizing: border-box;
      }

      .mneet-study-title {
        margin: 0 0 8px;
        color: #FFFFFF;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .mneet-study-description {
        margin: 0;
        color: #D1D5DB;
        font-size: 14px;
        line-height: 1.7;
      }

      .mneet-study-breadcrumbs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
        align-items: center;
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.6;
      }

      .mneet-study-breadcrumbs button {
        border: 0;
        padding: 0;
        background: transparent;
        color: #22C55E;
        font: inherit;
        cursor: pointer;
      }

      .mneet-study-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(min(100%, 240px), 1fr)
        );
        gap: 14px;
      }

      .mneet-study-card {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
        border: 1px solid #28513A;
        border-radius: 14px;
        background: #0D2419;
        padding: 16px;
        box-sizing: border-box;
      }

      .mneet-study-card h3 {
        margin: 0;
        color: #FFFFFF;
        font-size: 17px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      .mneet-study-card p {
        margin: 0;
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.7;
        overflow-wrap: anywhere;
        white-space: pre-line;
      }

      .mneet-study-order {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        align-self: flex-start;
        min-width: 30px;
        min-height: 30px;
        padding: 4px 9px;
        border: 1px solid #28513A;
        border-radius: 9px;
        background: #10291D;
        color: #22C55E;
        font-weight: 800;
        font-size: 13px;
        box-sizing: border-box;
      }

      .mneet-study-button {
        width: 100%;
        min-height: 43px;
        margin-top: auto;
        border: 1px solid #16A34A;
        border-radius: 10px;
        padding: 11px 13px;
        background: #16A34A;
        color: #FFFFFF;
        font-size: 14px;
        font-weight: 800;
        cursor: pointer;
        box-sizing: border-box;
      }

      .mneet-study-button:hover {
        background: #15803D;
      }

      .mneet-study-button-secondary {
        background: #10291D;
        border-color: #28513A;
      }

      .mneet-study-button-secondary:hover {
        background: #166534;
      }

      .mneet-study-message {
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #0D2419;
        color: #D1D5DB;
        padding: 16px;
        line-height: 1.7;
      }

      .mneet-study-back {
        margin-bottom: 14px;
        width: auto;
      }

      @media (max-width: 480px) {
        .mneet-study-header {
          padding: 14px;
        }

        .mneet-study-title {
          font-size: 19px;
        }

        .mneet-study-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }

        .mneet-study-card {
          padding: 14px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  function navigateToPage(pageName, data) {
    const student = getStudent();

    if (
      student &&
      typeof student.navigateTo === "function"
    ) {
      student.navigateTo(pageName, data || {});
      return true;
    }

    if (
      student &&
      typeof student.showPage === "function"
    ) {
      student.showPage(pageName);
      return true;
    }

    return false;
  }

  function openChapter(chapterId) {
    const chapter = state.chapters.find(function (item) {
      return getId(item) === chapterId;
    });

    if (!chapter) {
      showMessage("Chapter পাওয়া যায়নি।");
      return;
    }

    state.activeChapterId = chapterId;

    /*
      File 32 student-chapters.js will handle the detailed
      Chapter List and chapter navigation.
    */

    const opened = navigateToPage("chapters", {
      courseId: state.activeCourseId,
      subjectId: state.activeSubjectId,
      chapterId: chapterId,
      chapter: chapter
    });

    if (!opened) {
      showMessage(
        "Chapter navigation প্রস্তুত নয়। File 32 যুক্ত হলে আবার চেষ্টা করো।"
      );
    }
  }

  function openSubject(subjectId) {
    const subject = state.subjects.find(function (item) {
      return getId(item) === subjectId;
    });

    if (!subject) {
      showMessage("Subject পাওয়া যায়নি।");
      return;
    }

    state.activeSubjectId = subjectId;
    state.activeChapterId = "";

    renderChapters().catch(function (error) {
      showContainerMessage(
        error.message || "Chapter load করা যায়নি।"
      );
    });
  }

  /* =======================================================
     RENDER HELPERS
  ======================================================= */

  function renderBreadcrumbs() {
    let html = '<div class="mneet-study-breadcrumbs">';

    html +=
      '<button type="button" data-mneet-study-back="courses">' +
      "My Courses" +
      "</button>";

    if (state.activeCourseId) {
      const course = state.courses.find(function (item) {
        return getId(item) === state.activeCourseId;
      });

      if (course) {
        html += "<span>›</span>";

        html +=
          '<button type="button" data-mneet-study-back="subjects">' +
          escapeHTML(getName(course)) +
          "</button>";
      }
    }

    if (state.activeSubjectId) {
      const subject = state.subjects.find(function (item) {
        return getId(item) === state.activeSubjectId;
      });

      if (subject) {
        html += "<span>›</span>";
        html +=
          "<span>" + escapeHTML(getName(subject)) + "</span>";
      }
    }

    html += "</div>";

    return html;
  }

  function renderCourseCards() {
    const container = getContainer();

    if (!container) {
      return;
    }

    if (!state.courses.length) {
      container.innerHTML =
        '<div class="mneet-study-message">' +
        "তোমার কোনো approved Course পাওয়া যায়নি। Course কেনার পরে Admin approval-এর জন্য অপেক্ষা করো।" +
        "</div>";

      return;
    }

    container.innerHTML =
      '<div class="mneet-study-wrap">' +
        '<header class="mneet-study-header">' +
          '<h2 class="mneet-study-title">My Courses</h2>' +
          '<p class="mneet-study-description">' +
            "তোমার approved Course নির্বাচন করে পড়াশোনা শুরু করো।" +
          "</p>" +
        "</header>" +

        '<div class="mneet-study-grid">' +
          state.courses.map(function (course, index) {
            const id = getId(course);
            const name = getName(course);

            const description = clean(
              getValue(
                course,
                ["description", "shortDescription"],
                ""
              )
            );

            return (
              '<article class="mneet-study-card">' +
                '<span class="mneet-study-order">' +
                  (index + 1) +
                "</span>" +

                "<h3>" + escapeHTML(name) + "</h3>" +

                (
                  description
                    ? "<p>" + escapeHTML(description) + "</p>"
                    : ""
                ) +

                '<button type="button" class="mneet-study-button" ' +
                  'data-mneet-study-course="' + escapeHTML(id) + '">' +
                  "View Subjects" +
                "</button>" +
              "</article>"
            );
          }).join("") +
        "</div>" +
      "</div>";
  }

  async function renderSubjects(courseId) {
    const container = getContainer();

    if (!container) {
      return;
    }

    await verifyCourseAccess(courseId);

    state.activeCourseId = courseId;
    state.activeSubjectId = "";
    state.activeChapterId = "";

    const course = state.courses.find(function (item) {
      return getId(item) === courseId;
    });

    if (!course) {
      throw new Error("Course পাওয়া যায়নি।");
    }

    await loadSubjects(courseId);

    container.innerHTML =
      '<div class="mneet-study-wrap">' +
        renderBreadcrumbs() +

        '<header class="mneet-study-header">' +
          '<h2 class="mneet-study-title">' +
            escapeHTML(getName(course)) +
          "</h2>" +
          '<p class="mneet-study-description">' +
            "একটি Subject নির্বাচন করে তার Chapters দেখো।" +
          "</p>" +
        "</header>" +

        (
          state.subjects.length
            ? (
              '<div class="mneet-study-grid">' +
                state.subjects.map(function (subject, index) {
                  const id = getId(subject);

                  const description = clean(
                    getValue(
                      subject,
                      ["description", "details"],
                      ""
                    )
                  );

                  return (
                    '<article class="mneet-study-card">' +
                      '<span class="mneet-study-order">' +
                        (index + 1) +
                      "</span>" +

                      "<h3>" +
                        escapeHTML(getName(subject)) +
                      "</h3>" +

                      (
                        description
                          ? "<p>" + escapeHTML(description) + "</p>"
                          : ""
                      ) +

                      '<button type="button" class="mneet-study-button" ' +
                        'data-mneet-study-subject="' +
                        escapeHTML(id) + '">' +
                        "View Chapters" +
                      "</button>" +
                    "</article>"
                  );
                }).join("") +
              "</div>"
            )
            : (
              '<div class="mneet-study-message">' +
                "এই Course-এর কোনো Subject এখনও প্রকাশ করা হয়নি।" +
              "</div>"
            )
        ) +
      "</div>";
  }

  async function renderChapters() {
    const container = getContainer();

    if (!container) {
      return;
    }

    const courseId = state.activeCourseId;
    const subjectId = state.activeSubjectId;

    if (!courseId || !subjectId) {
      renderCourseCards();
      return;
    }

    await verifyCourseAccess(courseId);

    const course = state.courses.find(function (item) {
      return getId(item) === courseId;
    });

    const subject = state.subjects.find(function (item) {
      return getId(item) === subjectId;
    });

    if (!course || !subject) {
      throw new Error(
        "Course অথবা Subject পাওয়া যায়নি।"
      );
    }

    await loadChapters(subjectId, courseId);

    container.innerHTML =
      '<div class="mneet-study-wrap">' +
        renderBreadcrumbs() +

        '<button type="button" class="mneet-study-button mneet-study-button-secondary mneet-study-back" ' +
          'data-mneet-study-back="subjects">' +
          "← Back to Subjects" +
        "</button>" +

        '<header class="mneet-study-header">' +
          '<h2 class="mneet-study-title">' +
            escapeHTML(getName(subject)) +
          "</h2>" +
          '<p class="mneet-study-description">' +
            "একটি Chapter নির্বাচন করে পড়াশোনা শুরু করো।" +
          "</p>" +
        "</header>" +

        (
          state.chapters.length
            ? (
              '<div class="mneet-study-grid">' +
                state.chapters.map(function (chapter, index) {
                  const id = getId(chapter);

                  const description = clean(
                    getValue(
                      chapter,
                      ["description", "details"],
                      ""
                    )
                  );

                  return (
                    '<article class="mneet-study-card">' +
                      '<span class="mneet-study-order">' +
                        (index + 1) +
                      "</span>" +

                      "<h3>" +
                        escapeHTML(getName(chapter)) +
                      "</h3>" +

                      (
                        description
                          ? "<p>" + escapeHTML(description) + "</p>"
                          : ""
                      ) +

                      '<button type="button" class="mneet-study-button" ' +
                        'data-mneet-study-chapter="' +
                        escapeHTML(id) + '">' +
                        "Open Chapter" +
                      "</button>" +
                    "</article>"
                  );
                }).join("") +
              "</div>"
            )
            : (
              '<div class="mneet-study-message">' +
                "এই Subject-এর কোনো Chapter এখনও প্রকাশ করা হয়নি।" +
              "</div>"
            )
        ) +
      "</div>";
  }

  /* =======================================================
     MAIN ACTION HANDLERS
  ======================================================= */

  async function openCourse(courseId) {
    const id = clean(courseId);

    await verifyCourseAccess(id);

    const course = state.courses.find(function (item) {
      return getId(item) === id;
    });

    if (!course) {
      throw new Error(
        "Course পাওয়া যায়নি অথবা Course active নয়।"
      );
    }

    state.activeCourseId = id;
    state.activeSubjectId = "";
    state.activeChapterId = "";

    await renderSubjects(id);
  }

  async function handleClick(event) {
    const courseButton = event.target.closest(
      "[data-mneet-study-course]"
    );

    if (courseButton) {
      const id = clean(
        courseButton.getAttribute("data-mneet-study-course")
      );

      await openCourse(id);
      return;
    }

    const subjectButton = event.target.closest(
      "[data-mneet-study-subject]"
    );

    if (subjectButton) {
      const id = clean(
        subjectButton.getAttribute("data-mneet-study-subject")
      );

      openSubject(id);
      return;
    }

    const chapterButton = event.target.closest(
      "[data-mneet-study-chapter]"
    );

    if (chapterButton) {
      const id = clean(
        chapterButton.getAttribute("data-mneet-study-chapter")
      );

      openChapter(id);
      return;
    }

    const backButton = event.target.closest(
      "[data-mneet-study-back]"
    );

    if (backButton) {
      const target = clean(
        backButton.getAttribute("data-mneet-study-back")
      );

      if (target === "courses") {
        state.activeCourseId = "";
        state.activeSubjectId = "";
        state.activeChapterId = "";
        renderCourseCards();
        return;
      }

      if (target === "subjects" && state.activeCourseId) {
        await renderSubjects(state.activeCourseId);
      }
    }
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function refresh(options) {
    if (state.loading) {
      return;
    }

    state.loading = true;
    state.error = null;

    try {
      const user = getCurrentUser();

      if (!user) {
        throw new Error(
          "Study content দেখতে Login করো।"
        );
      }

      const opts = options || {};

      if (opts.courseId) {
        state.activeCourseId = clean(opts.courseId);
      }

      await loadCourses();

      if (state.activeCourseId) {
        const allowed = state.courses.some(function (course) {
          return getId(course) === state.activeCourseId;
        });

        if (allowed) {
          await renderSubjects(state.activeCourseId);
          return;
        }

        state.activeCourseId = "";
        state.activeSubjectId = "";
        state.activeChapterId = "";
      }

      renderCourseCards();
    } catch (error) {
      state.error = error;

      console.error(
        "[mNEET Student Study] Refresh failed:",
        error
      );

      showContainerMessage(
        error && error.message
          ? error.message
          : "Study page load করা যায়নি।"
      );

      throw error;
    } finally {
      state.loading = false;
    }
  }

  function initialize() {
    if (state.initialized) {
      return;
    }

    addStyles();

    document.addEventListener("click", function (event) {
      handleClick(event).catch(function (error) {
        state.error = error;

        console.error(
          "[mNEET Student Study] Navigation failed:",
          error
        );

        showMessage(
          error && error.message
            ? error.message
            : "এই content খোলা যায়নি।"
        );
      });
    });

    document.addEventListener(
      "mneet:student-page-change",
      function (event) {
        const detail = event.detail || {};

        const page = clean(
          detail.page || detail.pageName || detail.name
        ).toLowerCase();

        if (
          page === "study" ||
          page === "courses" ||
          page === "my-courses"
        ) {
          refresh().catch(function () {});
        }
      }
    );

    state.initialized = true;

    refresh().catch(function () {});
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  window[MODULE_NAME] = {
    initialize: initialize,
    refresh: refresh,

    openCourse: openCourse,
    openSubject: openSubject,
    openChapter: openChapter,

    getCourses: function () {
      return state.courses.slice();
    },

    getSubjects: function () {
      return state.subjects.slice();
    },

    getChapters: function () {
      return state.chapters.slice();
    },

    getTopics: function () {
      return state.topics.slice();
    },

    getActiveCourseId: function () {
      return state.activeCourseId;
    },

    getActiveSubjectId: function () {
      return state.activeSubjectId;
    },

    getActiveChapterId: function () {
      return state.activeChapterId;
    },

    hasCourseAccess: verifyCourseAccess,

    getLastError: function () {
      return state.error;
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize
    );
  } else {
    initialize();
  }

})();
