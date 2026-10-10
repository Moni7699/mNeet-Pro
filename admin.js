(function () {
  "use strict";

  /*
   * mNEET Admin Dashboard
   * File: admin.js
   *
   * Theme: Green and White
   * Firebase SDK: Compat 10.14.1
   *
   * Admin authorization:
   * admins/{uid}.active === true
   *
   * Security Rules must enforce authorization
   * independently of this client-side code.
   */

  if (window.MNEETAdmin) {
    return;
  }

  const MNEETAdmin = {
    currentUser: null,
    adminData: null,
    auth: null,
    db: null,

    activeCourse: "all",
    isAuthorized: false,
    initialized: false,
    authReady: false,
    loading: false,
    refreshTimer: null,
    dashboardData: null,
    authObserver: null
  };

  window.MNEETAdmin = MNEETAdmin;

  const $ = (id) => document.getElementById(id);

  const elements = {
    adminMessage: $("adminMessage"),

    dashboardWelcome: $("dashboardWelcome"),
    topbarAdminName: $("topbarAdminName"),

    dashboardCourseSelect: $("dashboardCourseSelect"),

    statCourses: $("statCourses"),
    statStudents: $("statStudents"),
    statPaidStudents: $("statPaidStudents"),
    statPendingPayments: $("statPendingPayments"),
    statChapters: $("statChapters"),
    statTopics: $("statTopics"),
    statQuizAttempts: $("statQuizAttempts"),
    statQuizResults: $("statQuizResults"),

    firebaseStatus: $("firebaseStatus"),
    authStatus: $("authStatus"),
    adminAccessStatus: $("adminAccessStatus"),

    recentPaymentsBody: $("recentPaymentsBody"),
    adminCurrentYear: $("adminCurrentYear")
  };


  // ==================================================
  // MESSAGE HELPERS
  // ==================================================

  function showMessage(message, type) {
    const box = elements.adminMessage;

    if (!box) {
      return;
    }

    box.textContent = String(message || "");

    box.className = "admin-message show";

    if (type === "error") {
      box.classList.add("error");
    } else if (type === "success") {
      box.classList.add("success");
    } else if (type === "warning") {
      box.classList.add("warning");
    }

    box.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }


  function hideMessage() {
    const box = elements.adminMessage;

    if (!box) {
      return;
    }

    box.textContent = "";
    box.className = "admin-message";
  }


  // ==================================================
  // SAFE HELPERS
  // ==================================================

  function safeText(value, fallback) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return fallback || "—";
    }

    return String(value);
  }


  function setText(element, value, fallback) {
    if (element) {
      element.textContent = safeText(value, fallback);
    }
  }


  function setStatus(element, value) {
    if (element) {
      element.textContent = String(value || "—");
    }
  }


  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }


  function formatDate(value) {
    if (!value) {
      return "—";
    }

    try {
      let date;

      if (typeof value.toDate === "function") {
        date = value.toDate();
      } else if (value instanceof Date) {
        date = value;
      } else {
        date = new Date(value);
      }

      if (Number.isNaN(date.getTime())) {
        return "—";
      }

      return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
      });
    } catch (error) {
      return "—";
    }
  }


  function getTimestampValue(value) {
    if (!value) {
      return 0;
    }

    try {
      if (typeof value.toMillis === "function") {
        return value.toMillis();
      }

      if (typeof value.toDate === "function") {
        return value.toDate().getTime();
      }

      const date = new Date(value);

      return Number.isNaN(date.getTime())
        ? 0
        : date.getTime();

    } catch (error) {
      return 0;
    }
  }


  function getDocumentId(item) {
    return String(
      item && (item.id || item.uid || item.userId) || ""
    );
  }


  function getCourseId(item) {
    if (!item) {
      return "";
    }

    return String(
      item.courseId ||
      item.course ||
      item.activeCourse ||
      ""
    );
  }


  function getStudentId(purchase) {
    return String(
      purchase.userId ||
      purchase.studentId ||
      purchase.uid ||
      ""
    );
  }


  // ==================================================
  // FIREBASE INITIALIZATION
  // ==================================================

  function initializeFirebase() {
    const firebaseState = window.MNEETFirebase;

    if (
      firebaseState &&
      firebaseState.ready === true &&
      firebaseState.auth &&
      firebaseState.db
    ) {
      MNEETAdmin.auth = firebaseState.auth;
      MNEETAdmin.db = firebaseState.db;

      setStatus(
        elements.firebaseStatus,
        "Connected"
      );

      return true;
    }

    if (
      window.firebase &&
      typeof window.firebase.auth === "function" &&
      typeof window.firebase.firestore === "function"
    ) {
      try {
        MNEETAdmin.auth = window.firebase.auth();
        MNEETAdmin.db = window.firebase.firestore();

        setStatus(
          elements.firebaseStatus,
          "Connected"
        );

        return true;

      } catch (error) {
        console.error(
          "mNEET Firebase initialization error:",
          error
        );
      }
    }

    setStatus(
      elements.firebaseStatus,
      "Unavailable"
    );

    showMessage(
      "Firebase initialize করা যায়নি। Firebase SDK এবং firebase.js পরীক্ষা করো।",
      "error"
    );

    return false;
  }


  // ==================================================
  // ADMIN AUTHORIZATION
  // ==================================================

  async function verifyAdmin(user) {
    MNEETAdmin.isAuthorized = false;
    MNEETAdmin.adminData = null;

    if (!user || !MNEETAdmin.db) {
      return false;
    }

    try {
      const snapshot = await MNEETAdmin.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!snapshot.exists) {
        return false;
      }

      const adminData = snapshot.data() || {};

      if (adminData.active !== true) {
        return false;
      }

      MNEETAdmin.adminData = adminData;
      MNEETAdmin.isAuthorized = true;

      return true;

    } catch (error) {
      console.error(
        "mNEET Admin authorization error:",
        error
      );

      if (error.code === "permission-denied") {
        showMessage(
          "Admin verification permission denied. Firebase Security Rules পরীক্ষা করো।",
          "error"
        );
      } else {
        showMessage(
          "Admin access যাচাই করা যায়নি। Internet connection ও Firebase পরীক্ষা করো।",
          "error"
        );
      }

      return false;
    }
  }


  // ==================================================
  // ADMIN IDENTITY
  // ==================================================

  function renderAdminIdentity(user, adminData) {
    const name = safeText(
      adminData.name ||
      user.displayName ||
      user.email,
      "Admin"
    );

    setText(
      elements.dashboardWelcome,
      "Welcome, " + name
    );

    setText(
      elements.topbarAdminName,
      name
    );

    setText(
      $("sidebarAdminName"),
      name
    );

    setText(
      $("sidebarAdminEmail"),
      user.email || "Email not available"
    );

    setText(
      $("sidebarAdminPhone"),
      adminData.phone || "Phone not available"
    );

    const initial = $("sidebarAvatarInitial");

    if (initial) {
      initial.textContent =
        name.trim().charAt(0).toUpperCase() || "A";
    }

    setStatus(
      elements.adminAccessStatus,
      "Authorized"
    );
  }


  // ==================================================
  // FIRESTORE COLLECTION HELPERS
  // ==================================================

  async function readCollection(collectionName) {
    if (!MNEETAdmin.db) {
      throw new Error(
        "Firebase database is not initialized."
      );
    }

    const snapshot = await MNEETAdmin.db
      .collection(collectionName)
      .get();

    return snapshot.docs.map(function (document) {
      return {
        id: document.id,
        ...document.data()
      };
    });
  }


  function isActiveCourse(course) {
    return (
      course.active !== false &&
      course.published !== false
    );
  }


  function belongsToCourse(item, courseId) {
    if (courseId === "all") {
      return true;
    }

    return getCourseId(item) === courseId;
  }


  function isApprovedPurchase(purchase) {
    const status = normalize(
      purchase.status || purchase.paymentStatus
    );

    return [
      "approved",
      "paid",
      "success",
      "completed"
    ].includes(status);
  }


  function isPendingPurchase(purchase) {
    const status = normalize(
      purchase.status || purchase.paymentStatus
    );

    return [
      "pending",
      "submitted",
      "under_review"
    ].includes(status);
  }


  function isRejectedPurchase(purchase) {
    const status = normalize(
      purchase.status || purchase.paymentStatus
    );

    return [
      "rejected",
      "failed",
      "cancelled",
      "canceled"
    ].includes(status);
  }


  function uniqueStudentIds(purchases) {
    const ids = new Set();

    purchases.forEach(function (purchase) {
      if (!isApprovedPurchase(purchase)) {
        return;
      }

      const studentId = getStudentId(purchase);

      if (studentId) {
        ids.add(studentId);
      }
    });

    return ids.size;
  }


  // ==================================================
  // COURSE SELECTOR
  // ==================================================

  function populateCourseSelector(courses) {
    const select = elements.dashboardCourseSelect;

    if (!select) {
      return;
    }

    const previousValue =
      MNEETAdmin.activeCourse ||
      select.value ||
      "all";

    select.replaceChildren();

    const allOption = document.createElement("option");

    allOption.value = "all";
    allOption.textContent = "All Courses";

    select.appendChild(allOption);

    courses
      .filter(isActiveCourse)
      .sort(function (a, b) {
        const nameA = safeText(
          a.name || a.title,
          ""
        );

        const nameB = safeText(
          b.name || b.title,
          ""
        );

        return nameA.localeCompare(nameB);
      })
      .forEach(function (course) {
        const option = document.createElement("option");

        option.value = course.id;

        option.textContent = safeText(
          course.name || course.title,
          course.id
        );

        select.appendChild(option);
      });

    const optionExists = Array.from(
      select.options
    ).some(function (option) {
      return option.value === previousValue;
    });

    select.value = optionExists
      ? previousValue
      : "all";

    MNEETAdmin.activeCourse = select.value;
  }


  // ==================================================
  // COURSE RELATIONSHIPS
  // ==================================================

  /*
   * Resolve courseId for documents that only have
   * parent references such as subjectId/chapterId.
   *
   * This supports top-level collections.
   * It does not read nested Firestore subcollections.
   */

  function buildRelationshipMaps(data) {
    const subjectCourse = new Map();
    const chapterCourse = new Map();
    const topicCourse = new Map();
    const quizCourse = new Map();

    data.subjects.forEach(function (subject) {
      const courseId = getCourseId(subject);

      if (subject.id && courseId) {
        subjectCourse.set(subject.id, courseId);
      }
    });

    data.chapters.forEach(function (chapter) {
      let courseId = getCourseId(chapter);

      if (!courseId && chapter.subjectId) {
        courseId = subjectCourse.get(
          chapter.subjectId
        ) || "";
      }

      if (chapter.id && courseId) {
        chapterCourse.set(chapter.id, courseId);
      }
    });

    data.topics.forEach(function (topic) {
      let courseId = getCourseId(topic);

      if (!courseId && topic.chapterId) {
        courseId = chapterCourse.get(
          topic.chapterId
        ) || "";
      }

      if (!courseId && topic.subjectId) {
        courseId = subjectCourse.get(
          topic.subjectId
        ) || "";
      }

      if (topic.id && courseId) {
        topicCourse.set(topic.id, courseId);
      }
    });

    data.quizzes.forEach(function (quiz) {
      let courseId = getCourseId(quiz);

      if (!courseId && quiz.topicId) {
        courseId = topicCourse.get(
          quiz.topicId
        ) || "";
      }

      if (!courseId && quiz.chapterId) {
        courseId = chapterCourse.get(
          quiz.chapterId
        ) || "";
      }

      if (quiz.id && courseId) {
        quizCourse.set(quiz.id, courseId);
      }
    });

    return {
      subjectCourse,
      chapterCourse,
      topicCourse,
      quizCourse
    };
  }


  function belongsUsingRelationships(
    item,
    courseId,
    relationshipMap
  ) {
    if (courseId === "all") {
      return true;
    }

    const directCourseId = getCourseId(item);

    if (directCourseId) {
      return directCourseId === courseId;
    }

    const references = [
      ["subjectId", relationshipMap.subjectCourse],
      ["chapterId", relationshipMap.chapterCourse],
      ["topicId", relationshipMap.topicCourse],
      ["quizId", relationshipMap.quizCourse]
    ];

    for (const reference of references) {
      const fieldName = reference[0];
      const map = reference[1];
      const parentId = item[fieldName];

      if (parentId && map.has(parentId)) {
        return map.get(parentId) === courseId;
      }
    }

    return false;
  }


  // ==================================================
  // DASHBOARD STATISTICS
  // ==================================================

  function renderStatistics(data) {
    if (!data) {
      return;
    }

    const courseId = MNEETAdmin.activeCourse;

    const relationships =
      buildRelationshipMaps(data);

    const courses = data.courses.filter(function (course) {
      return (
        isActiveCourse(course) &&
        belongsToCourse(course, courseId)
      );
    });

    /*
     * Student count is global because it represents
     * registered student accounts, not course purchases.
     */

    const students = data.students;

    const purchases = data.purchases.filter(function (purchase) {
      return belongsToCourse(purchase, courseId);
    });

    const chapters = data.chapters.filter(function (chapter) {
      return belongsUsingRelationships(
        chapter,
        courseId,
        relationships
      );
    });

    const topics = data.topics.filter(function (topic) {
      return belongsUsingRelationships(
        topic,
        courseId,
        relationships
      );
    });

    const quizAttempts = data.quizAttempts.filter(function (attempt) {
      return belongsUsingRelationships(
        attempt,
        courseId,
        relationships
      );
    });

    const quizResults = data.quizResults.filter(function (result) {
      return belongsUsingRelationships(
        result,
        courseId,
        relationships
      );
    });

    const approvedPurchases = purchases.filter(
      isApprovedPurchase
    );

    const pendingPurchases = purchases.filter(
      isPendingPurchase
    );

    setText(
      elements.statCourses,
      courses.length
    );

    setText(
      elements.statStudents,
      students.length
    );

    setText(
      elements.statPaidStudents,
      uniqueStudentIds(approvedPurchases)
    );

    setText(
      elements.statPendingPayments,
      pendingPurchases.length
    );

    setText(
      elements.statChapters,
      chapters.length
    );

    setText(
      elements.statTopics,
      topics.length
    );

    setText(
      elements.statQuizAttempts,
      quizAttempts.length
    );

    setText(
      elements.statQuizResults,
      quizResults.length
    );

    renderRecentPayments(
      purchases,
      students,
      data.courses
    );
  }


  // ==================================================
  // RECENT PAYMENT REQUESTS
  // ==================================================

  function renderRecentPayments(
    purchases,
    students,
    courses
  ) {
    const tbody = elements.recentPaymentsBody;

    if (!tbody) {
      return;
    }

    tbody.replaceChildren();

    const recent = purchases
      .slice()
      .sort(function (a, b) {
        const dateA = getTimestampValue(
          a.createdAt ||
          a.submittedAt ||
          a.updatedAt
        );

        const dateB = getTimestampValue(
          b.createdAt ||
          b.submittedAt ||
          b.updatedAt
        );

        return dateB - dateA;
      })
      .slice(0, 8);

    if (recent.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 3;
      cell.className = "empty-table-message";
      cell.textContent = "No payment requests found.";

      row.appendChild(cell);
      tbody.appendChild(row);

      return;
    }

    const studentMap = new Map(
      students.map(function (student) {
        return [getDocumentId(student), student];
      })
    );

    const courseMap = new Map(
      courses.map(function (course) {
        return [course.id, course];
      })
    );

    recent.forEach(function (purchase) {
      const row = document.createElement("tr");

      const studentId = getStudentId(purchase);
      const courseId = getCourseId(purchase);

      const student = studentMap.get(studentId);
      const course = courseMap.get(courseId);

      const studentName = safeText(
        purchase.studentName ||
        purchase.name ||
        (student && (
          student.name ||
          student.displayName
        )) ||
        purchase.studentEmail ||
        (student && student.email),
        "Unknown Student"
      );

      const courseName = safeText(
        purchase.courseName ||
        (course && (
          course.name ||
          course.title
        )),
        courseId || "Unknown Course"
      );

      const status = safeText(
        purchase.status ||
        purchase.paymentStatus,
        "Pending"
      );

      [
        studentName,
        courseName,
        status
      ].forEach(function (value) {
        const cell = document.createElement("td");

        cell.textContent = value;

        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });
  }


  // ==================================================
  // DASHBOARD DATA LOADING
  // ==================================================

  async function loadDashboardData() {
    if (
      !MNEETAdmin.isAuthorized ||
      !MNEETAdmin.db ||
      MNEETAdmin.loading
    ) {
      return;
    }

    MNEETAdmin.loading = true;

    try {
      hideMessage();

      const metricIds = [
        "statCourses",
        "statStudents",
        "statPaidStudents",
        "statPendingPayments",
        "statChapters",
        "statTopics",
        "statQuizAttempts",
        "statQuizResults"
      ];

      metricIds.forEach(function (id) {
        const element = $(id);

        if (element) {
          element.textContent = "…";
        }
      });

      /*
       * Collections expected by the current Admin
       * modules and dashboard.
       *
       * Failed reads are reported rather than silently
       * treated as reliable zero counts.
       */

      const collectionNames = [
        "courses",
        "users",
        "purchases",
        "subjects",
        "chapters",
        "topics",
        "quizzes",
        "questions",
        "quizAttempts",
        "quizResults"
      ];

      const results = await Promise.allSettled(
        collectionNames.map(function (name) {
          return readCollection(name);
        })
      );

      const data = {};
      const failedCollections = [];

      results.forEach(function (result, index) {
        const collectionName = collectionNames[index];

        if (result.status === "fulfilled") {
          data[collectionName] = result.value;
        } else {
          data[collectionName] = [];
          failedCollections.push(collectionName);

          console.warn(
            "mNEET could not read collection:",
            collectionName,
            result.reason
          );
        }
      });

      data.students = data.users;

      MNEETAdmin.dashboardData = data;

      populateCourseSelector(data.courses);

      renderStatistics(data);

      if (failedCollections.length > 0) {
        showMessage(
          "Dashboard-এর কিছু collection পড়া যায়নি: " +
          failedCollections.join(", ") +
          "। Firestore Security Rules এবং collection structure পরীক্ষা করো।",
          "warning"
        );
      }

    } catch (error) {
      console.error(
        "mNEET dashboard loading error:",
        error
      );

      showMessage(
        "Dashboard data লোড করা যায়নি। Firebase connection ও Firestore Rules পরীক্ষা করো।",
        "error"
      );

    } finally {
      MNEETAdmin.loading = false;
    }
  }


  // ==================================================
  // COURSE FILTER EVENT
  // ==================================================

  function setupCourseSelector() {
    const select = elements.dashboardCourseSelect;

    if (!select) {
      return;
    }

    select.addEventListener("change", function () {
      MNEETAdmin.activeCourse =
        select.value || "all";

      if (MNEETAdmin.dashboardData) {
        renderStatistics(
          MNEETAdmin.dashboardData
        );
      }

      /*
       * Notify other modules that the Dashboard course
       * selection has changed.
       */

      document.dispatchEvent(
        new CustomEvent("mneet:admin-course-change", {
          detail: {
            courseId: MNEETAdmin.activeCourse
          }
        })
      );
    });
  }


  // ==================================================
  // FOOTER YEAR
  // ==================================================

  function setupFooterYear() {
    setText(
      elements.adminCurrentYear,
      new Date().getFullYear()
    );
  }


  // ==================================================
  // AUTHENTICATION STATE
  // ==================================================

  function setupAuthentication() {
    if (!MNEETAdmin.auth) {
      return;
    }

    MNEETAdmin.authObserver =
      MNEETAdmin.auth.onAuthStateChanged(
        async function (user) {
          MNEETAdmin.authReady = true;
          MNEETAdmin.currentUser = user || null;

          if (!user) {
            MNEETAdmin.isAuthorized = false;
            MNEETAdmin.adminData = null;
            MNEETAdmin.dashboardData = null;

            setStatus(
              elements.authStatus,
              "Not signed in"
            );

            setStatus(
              elements.adminAccessStatus,
              "Not authorized"
            );

            return;
          }

          setStatus(
            elements.authStatus,
            "Signed in"
          );

          const authorized = await verifyAdmin(user);

          if (!authorized) {
            MNEETAdmin.isAuthorized = false;

            setStatus(
              elements.adminAccessStatus,
              "Not authorized"
            );

            /*
             * auth-guard.js is responsible for routing
             * unauthorized users away from admin.html.
             *
             * This code does not grant access to anyone
             * based on client-side state alone.
             */

            return;
          }

          renderAdminIdentity(
            user,
            MNEETAdmin.adminData || {}
          );

          await loadDashboardData();
        }
      );
  }


  // ==================================================
  // DASHBOARD VISIBILITY
  // ==================================================

  function isDashboardVisible() {
    const dashboard = $("dashboardModule");

    return Boolean(
      dashboard &&
      dashboard.classList.contains("active")
    );
  }


  // ==================================================
  // INITIALIZATION
  // ==================================================

  function init() {
    if (MNEETAdmin.initialized) {
      return;
    }

    MNEETAdmin.initialized = true;

    setupFooterYear();
    setupCourseSelector();

    if (!initializeFirebase()) {
      MNEETAdmin.initialized = false;
      return;
    }

    setupAuthentication();

    /*
     * Refresh dashboard only while Dashboard is visible.
     * This avoids unnecessary Firestore reads.
     */

    MNEETAdmin.refreshTimer = window.setInterval(
      function () {
        if (
          MNEETAdmin.isAuthorized &&
          isDashboardVisible()
        ) {
          loadDashboardData();
        }
      },
      60000
    );
  }


  // ==================================================
  // PUBLIC FUNCTIONS FOR OTHER ADMIN MODULES
  // ==================================================

  MNEETAdmin.refreshDashboard = loadDashboardData;

  MNEETAdmin.showMessage = showMessage;

  MNEETAdmin.hideMessage = hideMessage;

  MNEETAdmin.getCurrentUser = function () {
    return MNEETAdmin.currentUser;
  };

  MNEETAdmin.getActiveCourse = function () {
    return MNEETAdmin.activeCourse;
  };

  MNEETAdmin.isAdminAuthorized = function () {
    return MNEETAdmin.isAuthorized === true;
  };

  MNEETAdmin.getDashboardData = function () {
    return MNEETAdmin.dashboardData;
  };

  MNEETAdmin.getDatabase = function () {
    return MNEETAdmin.db;
  };

  MNEETAdmin.getAuth = function () {
    return MNEETAdmin.auth;
  };


  // ==================================================
  // START
  // ==================================================

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      { once: true }
    );
  } else {
    init();
  }

})();
