/* =========================================================
   mNEET STUDENT PANEL
   FILE 29: student-courses.js

   Purpose:
   - Available Courses
   - Purchased Courses
   - Purchase status
   - Course access navigation

   Requirements:
   - Firebase Compat SDK
   - firebase.js
   - student.js (File 26)
   - Green + White theme
========================================================= */

(function () {
  "use strict";

  const MODULE_NAME = "MNEETStudentCourses";

  const CONFIG = {
    coursesCollection: "courses",
    purchasesCollection: "purchases",

    availableContainers: [
      "studentAvailableCourses",
      "studentAvailableCoursesList"
    ],

    purchasedContainers: [
      "studentPurchasedCourses",
      "studentPurchasedCoursesList"
    ],

    purchasePage: "purchase",
    studyPage: "study"
  };

  const STYLE_ID = "mneet-student-courses-styles";

  const state = {
    initialized: false,
    loading: false,
    courses: [],
    purchases: [],
    purchasedCourseIds: [],
    lastError: null
  };

  /* =======================================================
     GENERAL HELPERS
  ======================================================= */

  function getStudentApp() {
    return window.MNEETStudent || null;
  }

  function getFirebaseDB() {
    const student = getStudentApp();

    if (student && student.config && student.config.db) {
      return student.config.db;
    }

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
      firebase.apps.length &&
      typeof firebase.firestore === "function"
    ) {
      return firebase.firestore();
    }

    throw new Error(
      "Firebase database পাওয়া যাচ্ছে না। firebase.js পরীক্ষা করো।"
    );
  }

  function getCurrentUser() {
    const student = getStudentApp();

    if (student && typeof student.getCurrentUser === "function") {
      return student.getCurrentUser();
    }

    if (
      window.firebase &&
      firebase.auth &&
      firebase.auth().currentUser
    ) {
      return firebase.auth().currentUser;
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

  function normalizeText(value) {
    return String(value == null ? "" : value).trim();
  }

  function getFirstValue(object, keys, fallback) {
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

  function formatPrice(value) {
    const price = Number(value);

    if (!Number.isFinite(price) || price <= 0) {
      return "Free";
    }

    return "₹" + price.toLocaleString("en-IN", {
      maximumFractionDigits: 2
    });
  }

  function getCourseId(course) {
    return normalizeText(
      getFirstValue(course, ["id", "courseId", "courseID"], "")
    );
  }

  function getCourseName(course) {
    return normalizeText(
      getFirstValue(
        course,
        ["name", "courseName", "title"],
        "Untitled Course"
      )
    );
  }

  function getCourseDescription(course) {
    return normalizeText(
      getFirstValue(
        course,
        ["description", "details", "shortDescription"],
        ""
      )
    );
  }

  function getCoursePrice(course) {
    return getFirstValue(
      course,
      ["price", "coursePrice", "amount"],
      0
    );
  }

  function getCourseImage(course) {
    return normalizeText(
      getFirstValue(
        course,
        [
          "thumbnailURL",
          "thumbnailUrl",
          "thumbnail",
          "imageURL",
          "imageUrl",
          "photoURL",
          "photoUrl"
        ],
        ""
      )
    );
  }

  function isCourseActive(course) {
    if (!course) {
      return false;
    }

    if (course.active === false) {
      return false;
    }

    if (course.published === false) {
      return false;
    }

    return true;
  }

  function getPurchaseCourseId(purchase) {
    return normalizeText(
      getFirstValue(
        purchase,
        ["courseId", "courseID", "course_id"],
        ""
      )
    );
  }

  function getPurchaseStatus(purchase) {
    return normalizeText(
      getFirstValue(
        purchase,
        ["status", "paymentStatus", "approvalStatus"],
        ""
      )
    ).toLowerCase();
  }

  function isPurchaseApproved(purchase) {
    const status = getPurchaseStatus(purchase);

    return (
      status === "approved" ||
      status === "paid" ||
      status === "completed"
    );
  }

  function getElementByIds(ids) {
    for (const id of ids) {
      const element = document.getElementById(id);

      if (element) {
        return element;
      }
    }

    return null;
  }

  function setContainerMessage(container, message) {
    if (!container) {
      return;
    }

    container.innerHTML =
      '<div class="mneet-courses-message">' +
      escapeHTML(message) +
      "</div>";
  }

  /* =======================================================
     GREEN + WHITE DESIGN
  ======================================================= */

  function addStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `
      .mneet-course-section {
        width: 100%;
        box-sizing: border-box;
      }

      .mneet-course-grid {
        display: grid;
        grid-template-columns: repeat(
          auto-fit,
          minmax(min(100%, 245px), 1fr)
        );
        gap: 16px;
        width: 100%;
        box-sizing: border-box;
      }

      .mneet-course-card {
        min-width: 0;
        overflow: hidden;
        border: 1px solid #28513A;
        border-radius: 16px;
        background: #0D2419;
        color: #FFFFFF;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      }

      .mneet-course-image-wrap {
        width: 100%;
        height: 145px;
        background: #10291D;
        overflow: hidden;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mneet-course-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .mneet-course-image-placeholder {
        color: #D1D5DB;
        font-size: 14px;
        text-align: center;
        padding: 15px;
      }

      .mneet-course-body {
        padding: 15px;
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
      }

      .mneet-course-title {
        margin: 0;
        color: #FFFFFF;
        font-size: 17px;
        font-weight: 700;
        line-height: 1.4;
        overflow-wrap: anywhere;
      }

      .mneet-course-description {
        margin: 0;
        color: #D1D5DB;
        font-size: 13px;
        line-height: 1.6;
        overflow-wrap: anywhere;
        white-space: pre-line;
      }

      .mneet-course-price {
        color: #22C55E;
        font-size: 19px;
        font-weight: 800;
        margin-top: auto;
      }

      .mneet-course-status {
        display: inline-flex;
        align-items: center;
        align-self: flex-start;
        border: 1px solid #28513A;
        border-radius: 999px;
        padding: 5px 10px;
        color: #FFFFFF;
        background: #10291D;
        font-size: 12px;
        font-weight: 600;
      }

      .mneet-course-status-approved {
        color: #FFFFFF;
        background: #166534;
        border-color: #22C55E;
      }

      .mneet-course-status-pending {
        color: #FFFFFF;
        background: #10291D;
        border-color: #28513A;
      }

      .mneet-course-button {
        width: 100%;
        min-height: 43px;
        border: 1px solid #16A34A;
        border-radius: 10px;
        padding: 10px 14px;
        background: #16A34A;
        color: #FFFFFF;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        box-sizing: border-box;
        transition: background 0.15s ease;
      }

      .mneet-course-button:hover {
        background: #15803D;
      }

      .mneet-course-button:focus-visible {
        outline: 2px solid #FFFFFF;
        outline-offset: 3px;
      }

      .mneet-course-button-secondary {
        background: #10291D;
        border-color: #28513A;
        color: #FFFFFF;
      }

      .mneet-course-button-secondary:hover {
        background: #166534;
      }

      .mneet-courses-message {
        padding: 18px;
        border: 1px solid #28513A;
        border-radius: 12px;
        background: #0D2419;
        color: #D1D5DB;
        font-size: 14px;
        line-height: 1.6;
      }

      .mneet-courses-retry {
        margin-top: 10px;
        width: auto;
      }

      @media (max-width: 480px) {
        .mneet-course-grid {
          grid-template-columns: minmax(0, 1fr);
          gap: 13px;
        }

        .mneet-course-card {
          border-radius: 13px;
        }

        .mneet-course-image-wrap {
          height: 135px;
        }

        .mneet-course-body {
          padding: 13px;
        }

        .mneet-course-title {
          font-size: 16px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  /* =======================================================
     LOAD FIRESTORE DATA
  ======================================================= */

  async function loadCoursesFromFirestore() {
    const db = getFirebaseDB();

    const snapshot = await db
      .collection(CONFIG.coursesCollection)
      .get();

    const courses = [];

    snapshot.forEach(function (doc) {
      const data = doc.data() || {};

      courses.push({
        id: doc.id,
        ...data
      });
    });

    return courses;
  }

  async function loadPurchasesFromFirestore() {
    const db = getFirebaseDB();
    const user = getCurrentUser();

    if (!user || !user.uid) {
      return [];
    }

    /*
      Only load the signed-in student's purchase records.
      Do not treat a payment reference as an approval.
    */

    const snapshot = await db
      .collection(CONFIG.purchasesCollection)
      .where("userId", "==", user.uid)
      .get();

    const purchases = [];

    snapshot.forEach(function (doc) {
      const data = doc.data() || {};

      purchases.push({
        id: doc.id,
        ...data
      });
    });

    return purchases;
  }

  function buildApprovedCourseIds(purchases) {
    const ids = new Set();

    purchases.forEach(function (purchase) {
      if (!isPurchaseApproved(purchase)) {
        return;
      }

      const courseId = getPurchaseCourseId(purchase);

      if (courseId) {
        ids.add(courseId);
      }
    });

    return Array.from(ids);
  }

  function getAccessibleCourses() {
    const approvedIds = new Set(state.purchasedCourseIds);

    return state.courses.filter(function (course) {
      return (
        isCourseActive(course) &&
        approvedIds.has(getCourseId(course))
      );
    });
  }

  function getAvailableCourses() {
    const approvedIds = new Set(state.purchasedCourseIds);

    return state.courses.filter(function (course) {
      return (
        isCourseActive(course) &&
        !approvedIds.has(getCourseId(course))
      );
    });
  }

  function getPurchaseForCourse(courseId) {
    const records = state.purchases.filter(function (purchase) {
      return getPurchaseCourseId(purchase) === courseId;
    });

    if (!records.length) {
      return null;
    }

    const approved = records.find(isPurchaseApproved);

    if (approved) {
      return approved;
    }

    return records[0];
  }

  function hasPendingPurchase(courseId) {
    const purchase = getPurchaseForCourse(courseId);

    if (!purchase) {
      return false;
    }

    return !isPurchaseApproved(purchase);
  }

  /* =======================================================
     NAVIGATION
  ======================================================= */

  function showMessage(message) {
    const student = getStudentApp();

    if (student && typeof student.showMessage === "function") {
      student.showMessage(message);
      return;
    }

    window.alert(message);
  }

  function navigateToPage(pageName, data) {
    const student = getStudentApp();

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

  function openPurchasePage(courseId) {
    const course = state.courses.find(function (item) {
      return getCourseId(item) === courseId;
    });

    if (!course) {
      showMessage("Course পাওয়া যায়নি। আবার চেষ্টা করো।");
      return;
    }

    const opened = navigateToPage(CONFIG.purchasePage, {
      courseId: courseId,
      course: course
    });

    if (!opened) {
      showMessage(
        "Purchase page এখনও প্রস্তুত নয়। " +
        "File 30 student-purchase.js যুক্ত হওয়ার পরে আবার চেষ্টা করো।"
      );
    }
  }

  function openStudyPage(courseId) {
    const accessible = getAccessibleCourses().some(function (course) {
      return getCourseId(course) === courseId;
    });

    if (!accessible) {
      showMessage(
        "এই Course-এর access এখনও অনুমোদিত হয়নি।"
      );
      return;
    }

    const student = getStudentApp();

    if (
      student &&
      typeof student.openCourse === "function"
    ) {
      student.openCourse(courseId);
      return;
    }

    const opened = navigateToPage(CONFIG.studyPage, {
      courseId: courseId
    });

    if (!opened) {
      showMessage(
        "Study page পাওয়া যাচ্ছে না। Student Panel-এর navigation পরীক্ষা করো।"
      );
    }
  }

  /* =======================================================
     COURSE CARD
  ======================================================= */

  function renderCourseCard(course, mode) {
    const courseId = getCourseId(course);
    const courseName = getCourseName(course);
    const description = getCourseDescription(course);
    const price = getCoursePrice(course);
    const imageUrl = getCourseImage(course);

    const escapedId = escapeHTML(courseId);
    const escapedName = escapeHTML(courseName);
    const escapedDescription = escapeHTML(description);

    let statusHTML = "";
    let buttonHTML = "";

    if (mode === "purchased") {
      statusHTML =
        '<span class="mneet-course-status mneet-course-status-approved">' +
        "Access Approved" +
        "</span>";

      buttonHTML =
        '<button type="button" class="mneet-course-button" ' +
        'data-mneet-course-action="study" ' +
        'data-course-id="' + escapedId + '">' +
        "Continue Learning" +
        "</button>";
    } else if (hasPendingPurchase(courseId)) {
      statusHTML =
        '<span class="mneet-course-status mneet-course-status-pending">' +
        "Payment Approval Pending" +
        "</span>";

      buttonHTML =
        '<button type="button" class="mneet-course-button mneet-course-button-secondary" ' +
        'data-mneet-course-action="pending" ' +
        'data-course-id="' + escapedId + '">' +
        "Awaiting Approval" +
        "</button>";
    } else {
      statusHTML =
        '<span class="mneet-course-status">' +
        "Locked · Not Purchased" +
        "</span>";

      buttonHTML =
        '<button type="button" class="mneet-course-button" ' +
        'data-mneet-course-action="purchase" ' +
        'data-course-id="' + escapedId + '">' +
        "Buy Course" +
        "</button>";
    }

    let imageHTML =
      '<div class="mneet-course-image-placeholder">' +
      "Course Thumbnail" +
      "</div>";

    if (imageUrl) {
      imageHTML =
        '<img class="mneet-course-image" ' +
        'src="' + escapeHTML(imageUrl) + '" ' +
        'alt="' + escapedName + '" loading="lazy">';
    }

    return (
      '<article class="mneet-course-card" ' +
      'data-mneet-course-card="' + escapedId + '">' +

        '<div class="mneet-course-image-wrap">' +
          imageHTML +
        "</div>" +

        '<div class="mneet-course-body">' +
          '<h3 class="mneet-course-title">' +
            escapedName +
          "</h3>" +

          (
            description
              ? '<p class="mneet-course-description">' +
                  escapedDescription +
                "</p>"
              : ""
          ) +

          '<div class="mneet-course-price">' +
            escapeHTML(formatPrice(price)) +
          "</div>" +

          statusHTML +

          buttonHTML +
        "</div>" +

      "</article>"
    );
  }

  /* =======================================================
     RENDER AVAILABLE COURSES
  ======================================================= */

  function renderAvailableCourses() {
    const container = getElementByIds(
      CONFIG.availableContainers
    );

    if (!container) {
      return;
    }

    const courses = getAvailableCourses();

    container.classList.add("mneet-course-section");

    if (!courses.length) {
      setContainerMessage(
        container,
        "এখন কোনো Available Course নেই। Admin নতুন Course প্রকাশ করলে এখানে দেখা যাবে।"
      );
      return;
    }

    container.innerHTML =
      '<div class="mneet-course-grid">' +
      courses.map(function (course) {
        return renderCourseCard(course, "available");
      }).join("") +
      "</div>";
  }

  /* =======================================================
     RENDER PURCHASED COURSES
  ======================================================= */

  function renderPurchasedCourses() {
    const container = getElementByIds(
      CONFIG.purchasedContainers
    );

    if (!container) {
      return;
    }

    const courses = getAccessibleCourses();

    container.classList.add("mneet-course-section");

    if (!courses.length) {
      setContainerMessage(
        container,
        "তোমার এখনও কোনো approved Course নেই। Available Courses থেকে Course নির্বাচন করে কিনতে পারো।"
      );
      return;
    }

    container.innerHTML =
      '<div class="mneet-course-grid">' +
      courses.map(function (course) {
        return renderCourseCard(course, "purchased");
      }).join("") +
      "</div>";
  }

  /* =======================================================
     BUTTON EVENTS
  ======================================================= */

  function handleCourseAction(event) {
    const button = event.target.closest(
      "[data-mneet-course-action]"
    );

    if (!button) {
      return;
    }

    const action = button.getAttribute(
      "data-mneet-course-action"
    );

    const courseId = normalizeText(
      button.getAttribute("data-course-id")
    );

    if (!courseId) {
      showMessage("Course ID পাওয়া যায়নি।");
      return;
    }

    if (action === "purchase") {
      openPurchasePage(courseId);
      return;
    }

    if (action === "study") {
      openStudyPage(courseId);
      return;
    }

    if (action === "pending") {
      showMessage(
        "তোমার payment request এখনও Admin approve করেননি। " +
        "Approval না হওয়া পর্যন্ত Course locked থাকবে।"
      );
    }
  }

  function bindEvents() {
    document.addEventListener(
      "click",
      handleCourseAction
    );
  }

  /* =======================================================
     REFRESH
  ======================================================= */

  async function refresh() {
    if (state.loading) {
      return;
    }

    state.loading = true;
    state.lastError = null;

    try {
      const user = getCurrentUser();

      if (!user) {
        throw new Error(
          "প্রথমে Student Account দিয়ে Login করো।"
        );
      }

      const results = await Promise.all([
        loadCoursesFromFirestore(),
        loadPurchasesFromFirestore()
      ]);

      state.courses = results[0];
      state.purchases = results[1];

      state.purchasedCourseIds =
        buildApprovedCourseIds(state.purchases);

      renderAvailableCourses();
      renderPurchasedCourses();

      return {
        courses: state.courses.length,
        approvedCourseIds: state.purchasedCourseIds.slice(),
        purchases: state.purchases.length
      };
    } catch (error) {
      state.lastError = error;

      console.error(
        "[mNEET Student Courses] Refresh failed:",
        error
      );

      const availableContainer = getElementByIds(
        CONFIG.availableContainers
      );

      const purchasedContainer = getElementByIds(
        CONFIG.purchasedContainers
      );

      const message =
        error && error.message
          ? error.message
          : "Course load করা যায়নি। আবার চেষ্টা করো।";

      setContainerMessage(
        availableContainer,
        message
      );

      setContainerMessage(
        purchasedContainer,
        message
      );

      throw error;
    } finally {
      state.loading = false;
    }
  }

  /* =======================================================
     INITIALIZATION
  ======================================================= */

  function initialize() {
    if (state.initialized) {
      return;
    }

    addStyles();
    bindEvents();

    state.initialized = true;

    const student = getStudentApp();

    if (student && typeof student.isReady === "function") {
      if (student.isReady()) {
        refresh().catch(function () {});
      }
    } else {
      refresh().catch(function () {});
    }
  }

  /* =======================================================
     PUBLIC API
  ======================================================= */

  window[MODULE_NAME] = {
    initialize: initialize,
    refresh: refresh,

    renderAvailableCourses: renderAvailableCourses,
    renderPurchasedCourses: renderPurchasedCourses,

    getCourses: function () {
      return state.courses.slice();
    },

    getPurchases: function () {
      return state.purchases.slice();
    },

    getAvailableCourses: getAvailableCourses,
    getPurchasedCourses: getAccessibleCourses,

    hasCourseAccess: function (courseId) {
      return state.purchasedCourseIds.includes(
        normalizeText(courseId)
      );
    },

    openPurchasePage: openPurchasePage,
    openStudyPage: openStudyPage,

    getLastError: function () {
      return state.lastError;
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
