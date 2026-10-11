(function () {
  "use strict";

  if (window.MNEETAdmin) return;

  const Admin = {
    currentUser: null,
    adminData: null,
    auth: null,
    db: null,
    activeCourse: "all",
    isAuthorized: false,
    initialized: false,
    loading: false,
    dashboardData: null
  };

  window.MNEETAdmin = Admin;

  const $ = id => document.getElementById(id);

  const ids = {
    students: "totalStudents",
    courses: "totalCourses",
    paid: "paidStudents",
    pending: "pendingPayments",
    chapters: "totalChapters",
    topics: "totalTopics",
    attempts: "totalQuizAttempts",
    results: "totalQuizResults"
  };

  function message(text, type = "error") {
    const box = $("dashboardMessage");

    if (box) {
      box.textContent = text;
      box.className = "empty-state";
      box.style.borderColor =
        type === "error" ? "#ef4444" : "#16A34A";
    }

    console[type === "error" ? "error" : "log"](
      "[mNEET Admin]",
      text
    );
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = String(value);
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function courseIdOf(item) {
    return String(
      item?.courseId ||
      item?.course ||
      item?.activeCourse ||
      ""
    );
  }

  function studentIdOf(item) {
    return String(
      item?.userId ||
      item?.studentId ||
      item?.uid ||
      ""
    );
  }

  function dateValue(value) {
    try {
      if (value?.toMillis) return value.toMillis();
      if (value?.toDate) return value.toDate().getTime();

      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? 0 : date.getTime();
    } catch (_) {
      return 0;
    }
  }

  function approved(item) {
    return [
      "approved",
      "paid",
      "success",
      "completed"
    ].includes(
      normalize(item.status || item.paymentStatus)
    );
  }

  function pending(item) {
    return [
      "pending",
      "submitted",
      "under_review"
    ].includes(
      normalize(item.status || item.paymentStatus)
    );
  }

  function initializeFirebase() {
    const services = window.MNEETFirebase;

    if (
      services?.ready === true &&
      services.auth &&
      services.db
    ) {
      Admin.auth = services.auth;
      Admin.db = services.db;
      setText("firebaseStatus", "Connected");
      return true;
    }

    if (
      window.firebase &&
      typeof firebase.auth === "function" &&
      typeof firebase.firestore === "function"
    ) {
      try {
        Admin.auth = firebase.auth();
        Admin.db = firebase.firestore();
        setText("firebaseStatus", "Connected");
        return true;
      } catch (error) {
        console.error(error);
      }
    }

    setText("firebaseStatus", "Unavailable");
    message(
      "Firebase connection পাওয়া যায়নি। firebase.js পরীক্ষা করো।"
    );

    return false;
  }

  async function verifyAdmin(user) {
    if (!user || !Admin.db) return false;

    try {
      const doc = await Admin.db
        .collection("admins")
        .doc(user.uid)
        .get();

      if (!doc.exists || doc.data().active !== true) {
        Admin.isAuthorized = false;
        return false;
      }

      Admin.adminData = doc.data();
      Admin.isAuthorized = true;

      return true;
    } catch (error) {
      console.error("Admin verification failed:", error);
      message(
        "Admin permission যাচাই করা যায়নি। Firestore Rules পরীক্ষা করো।"
      );
      return false;
    }
  }

  function renderIdentity(user, data = {}) {
    const name =
      data.fullName ||
      data.name ||
      user.displayName ||
      user.email ||
      "Admin";

    setText("topbarAdminName", name);
    setText("sidebarAdminName", name);
    setText("sidebarAdminEmail", user.email || "Email unavailable");
    setText("sidebarAdminPhone", data.phone || "Phone not set");
    setText("profileName", "Name: " + name);
    setText("profileEmail", "Email: " + (user.email || "Not available"));
    setText("profilePhone", "Phone: " + (data.phone || "Not set"));
    setText("adminAccessStatus", "Authorized");

    const avatar = $("adminAvatar");
    if (avatar) {
      avatar.textContent = name.trim().charAt(0).toUpperCase() || "A";
    }
  }

  async function readCollection(name) {
    const snapshot = await Admin.db.collection(name).get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  function belongsToCourse(item, courseId) {
    return courseId === "all" ||
      courseIdOf(item) === courseId;
  }

  function populateCourseSelector(courses) {
    const select = $("dashboardCourseSelect");
    if (!select) return;

    const previous = Admin.activeCourse || select.value || "all";

    select.replaceChildren();

    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All Courses";
    select.appendChild(all);

    courses
      .filter(course =>
        course.active !== false &&
        course.published !== false
      )
      .sort((a, b) =>
        String(a.name || a.title || "")
          .localeCompare(String(b.name || b.title || ""))
      )
      .forEach(course => {
        const option = document.createElement("option");
        option.value = course.id;
        option.textContent = course.name || course.title || course.id;
        select.appendChild(option);
      });

    select.value = Array.from(select.options)
      .some(option => option.value === previous)
      ? previous
      : "all";

    Admin.activeCourse = select.value;
  }

  function resolveRelationships(data) {
    const subjectCourses = new Map();
    const chapterCourses = new Map();
    const topicCourses = new Map();
    const quizCourses = new Map();

    data.subjects.forEach(item => {
      const course = courseIdOf(item);
      if (course) subjectCourses.set(item.id, course);
    });

    data.chapters.forEach(item => {
      const course =
        courseIdOf(item) ||
        subjectCourses.get(item.subjectId) ||
        "";

      if (course) chapterCourses.set(item.id, course);
    });

    data.topics.forEach(item => {
      const course =
        courseIdOf(item) ||
        chapterCourses.get(item.chapterId) ||
        subjectCourses.get(item.subjectId) ||
        "";

      if (course) topicCourses.set(item.id, course);
    });

    data.quizzes.forEach(item => {
      const course =
        courseIdOf(item) ||
        topicCourses.get(item.topicId) ||
        chapterCourses.get(item.chapterId) ||
        "";

      if (course) quizCourses.set(item.id, course);
    });

    return { subjectCourses, chapterCourses, topicCourses, quizCourses };
  }

  function itemBelongs(item, selectedCourse, maps) {
    if (selectedCourse === "all") return true;

    const direct = courseIdOf(item);
    if (direct) return direct === selectedCourse;

    if (item.subjectId && maps.subjectCourses.has(item.subjectId)) {
      return maps.subjectCourses.get(item.subjectId) === selectedCourse;
    }

    if (item.chapterId && maps.chapterCourses.has(item.chapterId)) {
      return maps.chapterCourses.get(item.chapterId) === selectedCourse;
    }

    if (item.topicId && maps.topicCourses.has(item.topicId)) {
      return maps.topicCourses.get(item.topicId) === selectedCourse;
    }

    if (item.quizId && maps.quizCourses.has(item.quizId)) {
      return maps.quizCourses.get(item.quizId) === selectedCourse;
    }

    return false;
  }

  function renderRecentPayments(purchases, students, courses) {
    const tbody = $("recentPaymentsBody");
    if (!tbody) return;

    tbody.replaceChildren();

    const recent = purchases.slice()
      .sort((a, b) =>
        dateValue(b.createdAt || b.submittedAt || b.updatedAt) -
        dateValue(a.createdAt || a.submittedAt || a.updatedAt)
      )
      .slice(0, 8);

    if (!recent.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 3;
      cell.textContent = "No payment requests found.";
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    const studentMap = new Map(students.map(item => [item.id, item]));
    const courseMap = new Map(courses.map(item => [item.id, item]));

    recent.forEach(purchase => {
      const student = studentMap.get(studentIdOf(purchase));
      const course = courseMap.get(courseIdOf(purchase));
      const row = document.createElement("tr");

      const values = [
        purchase.studentName ||
          purchase.name ||
          student?.fullName ||
          student?.name ||
          student?.email ||
          purchase.studentEmail ||
          "Unknown Student",

        purchase.courseName ||
          course?.name ||
          course?.title ||
          courseIdOf(purchase) ||
          "Unknown Course",

        purchase.status ||
          purchase.paymentStatus ||
          "Pending"
      ];

      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });
  }

  function renderStatistics(data) {
    const selected = Admin.activeCourse || "all";
    const maps = resolveRelationships(data);

    const courses = data.courses.filter(item =>
      item.active !== false &&
      item.published !== false &&
      belongsToCourse(item, selected)
    );

    const purchases = data.purchases.filter(item =>
      belongsToCourse(item, selected)
    );

    const chapters = data.chapters.filter(item =>
      itemBelongs(item, selected, maps)
    );

    const topics = data.topics.filter(item =>
      itemBelongs(item, selected, maps)
    );

    const attempts = data.quizAttempts.filter(item =>
      itemBelongs(item, selected, maps)
    );

    const results = data.quizResults.filter(item =>
      itemBelongs(item, selected, maps)
    );

    const paidStudents = new Set(
      purchases.filter(approved)
        .map(studentIdOf)
        .filter(Boolean)
    );

    setText("totalStudents", data.students.length);
    setText("totalCourses", courses.length);
    setText("paidStudents", paidStudents.size);
    setText("pendingPayments", purchases.filter(pending).length);
    setText("totalChapters", chapters.length);
    setText("totalTopics", topics.length);
    setText("totalQuizAttempts", attempts.length);
    setText("totalQuizResults", results.length);

    renderRecentPayments(purchases, data.students, data.courses);

    const dashboardMessage = $("dashboardMessage");
    if (dashboardMessage) {
      dashboardMessage.textContent =
        "Dashboard data loaded. Registered students: " +
        data.students.length +
        "; payment requests: " + purchases.length + ".";
    }
  }

  async function loadDashboardData() {
    if (!Admin.isAuthorized || !Admin.db || Admin.loading) return;

    Admin.loading = true;

    try {
      [
        "totalStudents",
        "totalCourses",
        "paidStudents",
        "pendingPayments",
        "totalChapters",
        "totalTopics",
        "totalQuizAttempts",
        "totalQuizResults"
      ].forEach(id => setText(id, "…"));

      const names = [
        "courses",
        "users",
        "purchases",
        "subjects",
        "chapters",
        "topics",
        "quizzes",
        "quizAttempts",
        "quizResults"
      ];

      const results = await Promise.allSettled(
        names.map(readCollection)
      );

      const data = {};
      const failed = [];

      results.forEach((result, index) => {
        const name = names[index];

        if (result.status === "fulfilled") {
          data[name] = result.value;
        } else {
          data[name] = [];
          failed.push(name);
          console.warn("Could not read collection:", name, result.reason);
        }
      });

      data.students = data.users;
      Admin.dashboardData = data;

      populateCourseSelector(data.courses);
      renderStatistics(data);

      if (failed.length) {
        message(
          "কিছু collection পড়া যায়নি: " + failed.join(", ") +
          "। Firestore Rules ও collection names পরীক্ষা করো।"
        );
      }
    } catch (error) {
      console.error(error);
      message("Dashboard লোড হয়নি। Internet ও Firebase configuration পরীক্ষা করো।");
    } finally {
      Admin.loading = false;
    }
  }

  function setupCourseFilter() {
    const select = $("dashboardCourseSelect");
    if (!select) return;

    select.addEventListener("change", () => {
      Admin.activeCourse = select.value || "all";

      if (Admin.dashboardData) {
        renderStatistics(Admin.dashboardData);
      }

      document.dispatchEvent(
        new CustomEvent("mneet:admin-course-change", {
          detail: { courseId: Admin.activeCourse }
        })
      );
    });
  }

  function setupNavigation() {
    const nav = $("adminNavigation");
    if (!nav) return;

    nav.addEventListener("click", event => {
      const button = event.target.closest("[data-section]");
      if (!button) return;

      const name = button.dataset.section;
      const section = $("section-" + name);
      if (!section) return;

      document.querySelectorAll(".admin-section").forEach(item => {
        item.hidden = true;
      });

      section.hidden = false;

      nav.querySelectorAll(".nav-item").forEach(item => {
        item.classList.toggle("active", item === button);
      });

      document.body.classList.remove("sidebar-open");

      const toggle = $("sidebarToggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  function setupLogout() {
    const button = $("adminLogout");
    if (!button) return;

    button.addEventListener("click", async () => {
      if (!window.confirm("Are you sure you want to log out?")) return;

      try {
        await Admin.auth.signOut();
        window.location.replace("admin-login.html");
      } catch (error) {
        console.error(error);
        message("Logout হয়নি। আবার চেষ্টা করো।");
      }
    });
  }

  function init() {
    if (Admin.initialized) return;
    Admin.initialized = true;

    setText("adminCurrentYear", new Date().getFullYear());

    if (!initializeFirebase()) {
      Admin.initialized = false;
      return;
    }

    setupCourseFilter();
    setupNavigation();
    setupLogout();

    Admin.auth.onAuthStateChanged(async user => {
      Admin.currentUser = user || null;

      if (!user) {
        Admin.isAuthorized = false;
        setText("authStatus", "Not signed in");
        setText("adminAccessStatus", "Not authorized");
        return;
      }

      setText("authStatus", "Signed in");

      const allowed = await verifyAdmin(user);

      if (!allowed) {
        setText("adminAccessStatus", "Not authorized");
        return;
      }

      let profile = {};

      try {
        const snapshot = await Admin.db
          .collection("users")
          .doc(user.uid)
          .get();

        if (snapshot.exists) profile = snapshot.data();
      } catch (error) {
        console.warn("Could not load profile:", error);
      }

      renderIdentity(user, {
        ...(profile || {}),
        ...(Admin.adminData || {})
      });

      const verification = $("adminVerification");
      const application = $("adminApplication");

      if (verification) verification.hidden = true;
      if (application) application.hidden = false;

      document.documentElement.setAttribute(
        "data-admin-authorized",
        "true"
      );

      window.dispatchEvent(
        new CustomEvent("mneet:admin-authorized", {
          detail: { uid: user.uid }
        })
      );

      await loadDashboardData();
    });

    window.setInterval(() => {
      const dashboard = $("section-dashboard");

      if (
        Admin.isAuthorized &&
        dashboard &&
        !dashboard.hidden
      ) {
        loadDashboardData();
      }
    }, 60000);
  }

  Admin.refreshDashboard = loadDashboardData;
  Admin.showMessage = message;
  Admin.getCurrentUser = () => Admin.currentUser;
  Admin.getActiveCourse = () => Admin.activeCourse;
  Admin.isAdminAuthorized = () => Admin.isAuthorized === true;
  Admin.getDashboardData = () => Admin.dashboardData;
  Admin.getDatabase = () => Admin.db;
  Admin.getAuth = () => Admin.auth;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
