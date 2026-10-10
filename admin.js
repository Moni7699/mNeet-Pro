(function () {
  "use strict";

  /*
   * mNEET Admin Dashboard
   * File: admin.js
   *
   * Theme: Green and White only
   * Firebase SDK: Compat 10.14.1
   *
   * Admin authorization must also be enforced
   * through Firebase Security Rules.
   */

  if (window.MNEETAdmin) {
    return;
  }

  const MNEETAdmin = {
    currentUser: null,
    adminData: null,
    db: null,
    auth: null,
    activeCourse: "all",
    isAuthorized: false,
    initialized: false,
    refreshTimer: null
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


  // --------------------------------------------------
  // MESSAGE
  // --------------------------------------------------

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


  // --------------------------------------------------
  // SAFE TEXT HELPERS
  // --------------------------------------------------

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


  function setText(element, value) {
    if (element) {
      element.textContent = safeText(value);
    }
  }


  function setStatus(element, value) {
    if (element) {
      element.textContent = value;
    }
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


  // --------------------------------------------------
  // FIREBASE INITIALIZATION
  // --------------------------------------------------

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
          "Initialized"
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
      "Firebase initialize করা যায়নি। firebase.js ও Firebase SDK পরীক্ষা করো।",
      "error"
    );

    return false;
  }


  // --------------------------------------------------
  // ADMIN AUTHORIZATION
  // --------------------------------------------------

  async function verifyAdmin(user) {
    if (!user || !MNEETAdmin.db) {
      MNEETAdmin.isAuthorized = false;
      return false;
    }

    try {
      const adminRef = MNEETAdmin.db
        .collection("admins")
        .doc(user.uid);

      const adminSnapshot = await adminRef.get();

      if (!adminSnapshot.exists) {
        MNEETAdmin.isAuthorized = false;
        return false;
      }

      const adminData = adminSnapshot.data() || {};

      if (adminData.active !== true) {
        MNEETAdmin.isAuthorized = false;
        return false;
      }

      MNEETAdmin.adminData = adminData;
      MNEETAdmin.isAuthorized = true;

      return true;

    } catch (error) {
      console.error(
        "mNEET Admin verification error:",
        error
      );

      MNEETAdmin.isAuthorized = false;

      if (error.code === "permission-denied") {
        showMessage(
          "Admin verification permission denied. Firebase Security Rules পরীক্ষা করো।",
          "error"
        );
      } else {
        showMessage(
          "Admin access যাচাই করা যায়নি। ইন্টারনেট ও Firebase Rules পরীক্ষা করো।",
          "error"
        );
      }

      return false;
    }
  }


  // --------------------------------------------------
  // ADMIN PROFILE SUMMARY
  // --------------------------------------------------

  function renderAdminIdentity(user, adminData) {
    const name = safeText(
      adminData.name ||
      user.displayName ||
      user.email,
      "Admin"
    );

    setText(elements.dashboardWelcome, "Welcome, " + name);
    setText(elements.topbarAdminName, name);

    const sidebarName = $("sidebarAdminName");
    const sidebarEmail = $("sidebarAdminEmail");
    const sidebarPhone = $("sidebarAdminPhone");
    const sidebarInitial = $("sidebarAvatarInitial");

    setText(sidebarName, name);
    setText(sidebarEmail, user.email || "Email not available");

    setText(
      sidebarPhone,
      adminData.phone || "Phone not available"
    );

    if (sidebarInitial) {
      sidebarInitial.textContent =
        name.trim().charAt(0).toUpperCase() || "A";
    }

    setStatus(
      elements.adminAccessStatus,
      "Authorized"
    );
  }


  // --------------------------------------------------
  // FIRESTORE COLLECTION HELPERS
  // --------------------------------------------------

  async function readCollection(collectionName) {
    if (!MNEETAdmin.db) {
      throw new Error("Firebase database is not initialized.");
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
    return course.active !== false &&
      course.published !== false;
  }


  function belongsToCourse(item, courseId) {
    if (courseId === "all") {
      return true;
    }

    return (
      item.courseId === courseId ||
      item.course === courseId ||
      item.activeCourse === courseId
    );
  }


  function uniqueStudentIds(purchases) {
    const ids = new Set();

    purchases.forEach(function (purchase) {
      const status = String(
        purchase.status || purchase.paymentStatus || ""
      ).toLowerCase();

      const approved =
        status === "approved" ||
        status === "paid" ||
        status === "success" ||
        status === "completed";

      if (approved) {
        const studentId =
          purchase.userId ||
          purchase.studentId ||
          purchase.uid;

        if (studentId) {
          ids.add(studentId);
        }
      }
    });

    return ids.size;
  }


  function isPendingPurchase(purchase) {
    const status = String(
      purchase.status || purchase.paymentStatus || ""
    ).toLowerCase();

    return (
      status === "pending" ||
      status === "submitted" ||
      status === "under_review"
    );
  }


  function isApprovedPurchase(purchase) {
    const status = String(
      purchase.status || purchase.paymentStatus || ""
    ).toLowerCase();

    return (
      status === "approved" ||
      status === "paid" ||
      status === "success" ||
      status === "completed"
    );
  }


  // --------------------------------------------------
  // DASHBOARD COURSE SELECTOR
  // --------------------------------------------------

  function populateCourseSelector(courses) {
    const select = elements.dashboardCourseSelect;

    if (!select) {
      return;
    }

    const previousValue = select.value || "all";

    select.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All Courses";

    select.appendChild(allOption);

    courses
      .filter(isActiveCourse)
      .sort(function (a, b) {
        return safeText(a.name, "")
          .localeCompare(safeText(b.name, ""));
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

    const optionExists = Array.from(select.options).some(
      function (option) {
        return option.value === previousValue;
      }
    );

    select.value = optionExists ? previousValue : "all";

    MNEETAdmin.activeCourse = select.value;
  }


  // --------------------------------------------------
  // DASHBOARD STATISTICS
  // --------------------------------------------------

  function renderStatistics(data) {
    const courseId = MNEETAdmin.activeCourse;

    const courses = data.courses.filter(function (course) {
      return isActiveCourse(course) &&
        belongsToCourse(course, courseId);
    });

    const students = data.students;

    const purchases = data.purchases.filter(function (purchase) {
      return belongsToCourse(purchase, courseId);
    });

    const chapters = data.chapters.filter(function (chapter) {
      return belongsToCourse(chapter, courseId);
    });

    const topics = data.topics.filter(function (topic) {
      return belongsToCourse(topic, courseId);
    });

    const quizAttempts = data.quizAttempts.filter(function (attempt) {
      return belongsToCourse(attempt, courseId);
    });

    const quizResults = data.quizResults.filter(function (result) {
      return belongsToCourse(result, courseId);
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
  }


  // --------------------------------------------------
  // RECENT PAYMENT REQUESTS
  // --------------------------------------------------

  function renderRecentPayments(purchases, students, courses) {
    const tbody = elements.recentPaymentsBody;

    if (!tbody) {
      return;
    }

    tbody.replaceChildren();

    const recent = purchases
      .slice()
      .sort(function (a, b) {
        const dateA = getTimestampValue(
          a.createdAt || a.submittedAt || a.updatedAt
        );

        const dateB = getTimestampValue(
          b.createdAt || b.submittedAt || b.updatedAt
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
        return [student.id, student];
      })
    );

    const courseMap = new Map(
      courses.map(function (course) {
        return [course.id, course];
      })
    );

    recent.forEach(function (purchase) {
      const row = document.createElement("tr");

      const studentId =
        purchase.userId ||
        purchase.studentId ||
        purchase.uid ||
        "";

      const courseId =
        purchase.courseId ||
        purchase.course ||
        "";

      const student = studentMap.get(studentId);
      const course = courseMap.get(courseId);

      const studentName = safeText(
        purchase.studentName ||
        purchase.name ||
        (student && (student.name || student.displayName)) ||
        purchase.studentEmail ||
        (student && student.email),
        "Unknown Student"
      );

      const courseName = safeText(
        purchase.courseName ||
        (course && (course.name || course.title)),
        courseId || "Unknown Course"
      );

      const status = safeText(
        purchase.status || purchase.paymentStatus,
        "Pending"
      );

      [studentName, courseName, status].forEach(
        function (value) {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        }
      );

      tbody.appendChild(row);
    });
  }


  // --------------------------------------------------
  // DASHBOARD DATA LOADING
  // --------------------------------------------------

  async function loadDashboardData() {
    if (!MNEETAdmin.isAuthorized || !MNEETAdmin.db) {
      return;
    }

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

    try {
      /*
       * These are top-level collection names.
       *
       * Course, subject, chapter, topic, quiz and question
       * data may be nested under other documents in some
       * Firebase structures. If your actual structure is
       * nested, those metrics must be loaded using the
       * appropriate nested collection paths.
       */

      const results = await Promise.allSettled([
        readCollection("courses"),
        readCollection("users"),
        readCollection("purchases"),
        readCollection("chapters"),
        readCollection("topics"),
        readCollection("quizAttempts"),
        readCollection("quizResults")
      ]);

      const collectionNames = [
        "courses",
        "users",
        "purchases",
        "chapters",
        "topics",
        "quizAttempts",
        "quizResults"
      ];

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
      data.quizAttempts = data.quizAttempts || [];
      data.quizResults = data.quizResults || [];

      MNEETAdmin.dashboardData = data;

      populateCourseSelector(data.courses);

      renderStatistics(data);

      renderRecentPayments(
        data.purchases,
        data.students,
        data.courses
      );

      if (failedCollections.length > 0) {
        showMessage(
          "Dashboard-এর কিছু তথ্য পড়া যায়নি: " +
          failedCollections.join(", ") +
          "। Firestore collection structure ও Security Rules পরীক্ষা করো।",
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
    }
  }


  // --------------------------------------------------
  // COURSE FILTER EVENT
  // --------------------------------------------------

  function setupCourseSelector() {
    const select = elements.dashboardCourseSelect;

    if (!select) {
      return;
    }

    select.addEventListener("change", function () {
      MNEETAdmin.activeCourse = select.value || "all";

      if (MNEETAdmin.dashboardData) {
        renderStatistics(MNEETAdmin.dashboardData);
      }
    });
  }


  // --------------------------------------------------
  // YEAR
  // --------------------------------------------------

  function setupFooterYear() {
    setText(
      elements.adminCurrentYear,
      new Date().getFullYear()
    );
  }


  // --------------------------------------------------
  // AUTHENTICATION STATE
  // --------------------------------------------------

  function setupAuthentication() {
    if (!MNEETAdmin.auth) {
      return;
    }

    MNEETAdmin.auth.onAuthStateChanged(async function (user) {
      if (!user) {
        MNEETAdmin.currentUser = null;
        MNEETAdmin.isAuthorized = false;

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

      MNEETAdmin.currentUser = user;

      setStatus(
        elements.authStatus,
        "Signed in"
      );

      const authorized = await verifyAdmin(user);

      if (!authorized) {
        setStatus(
          elements.adminAccessStatus,
          "Not authorized"
        );

        /*
         * auth-guard.js also verifies Admin access.
         * This file never grants access based only on
         * client-side UI state.
         */
        return;
      }

      renderAdminIdentity(
        user,
        MNEETAdmin.adminData || {}
      );

      await loadDashboardData();
    });
  }


  // --------------------------------------------------
  // PAGE VISIBILITY
  // --------------------------------------------------

  function isDashboardVisible() {
    const dashboard = $("dashboardModule");

    return Boolean(
      dashboard &&
      dashboard.classList.contains("active")
    );
  }


  // --------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------

  function init() {
    if (MNEETAdmin.initialized) {
      return;
    }

    MNEETAdmin.initialized = true;

    setupFooterYear();
    setupCourseSelector();

    if (!initializeFirebase()) {
      return;
    }

    setupAuthentication();

    /*
     * Refresh dashboard data only while Dashboard
     * is visible. This avoids unnecessary reads.
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


  // --------------------------------------------------
  // PUBLIC FUNCTIONS
  // --------------------------------------------------

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
    return MNEETAdmin.isAuthorized;
  };


  // --------------------------------------------------
  // START
  // --------------------------------------------------

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
