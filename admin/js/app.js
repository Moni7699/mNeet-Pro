// ============================================
// mNEET-Pro Admin Panel
// File: admin/js/app.js
// Course Selection + Course Management
// ============================================

import {
  auth,
  authPersistence,
  db
} from "./firebase.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// ============================================
// DOM HELPERS
// ============================================

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);


// ============================================
// APP ELEMENTS
// ============================================

const authView = $("#authView");
const appView = $("#appView");
const signinForm = $("#signinForm");
const signupForm = $("#signupForm");
const authMessage = $("#authMessage");
const pageTitle = $("#pageTitle");
const pageContent = $("#pageContent");
const sidebar = $("#sidebar");
const scrim = $("#scrim");
const toastElement = $("#toast");


// ============================================
// STATE
// ============================================

let currentAdmin = null;
let selectedCourseId = "";
let coursesCache = [];
let toastTimer = null;
let creatingAccount = false;


// ============================================
// SAFE STORAGE
// ============================================

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) {
    // App continues without persistent browser storage.
  }
}


// ============================================
// MESSAGES
// ============================================

function showAuthMessage(message, type = "error") {
  if (!authMessage) return;

  authMessage.textContent = message;
  authMessage.className = `message ${type}`;
}

function clearAuthMessage() {
  if (!authMessage) return;

  authMessage.textContent = "";
  authMessage.className = "message";
}

function showToast(message, type = "success") {
  if (!toastElement) return;

  toastElement.textContent = message;
  toastElement.className = `toast show ${type}`;

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toastElement.className = "toast";
  }, 3500);
}

function readableError(error) {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-email": "Email address is not valid.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/weak-password": "Please choose a stronger password.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/network-request-failed": "Network error. Check your internet.",
    "auth/operation-not-allowed": "Enable Email/Password in Firebase.",
    "auth/unauthorized-domain": "Add this domain in Firebase Authorized Domains.",
    "permission-denied": "Permission denied. Check Firestore Rules."
  };

  return messages[code] || error?.message || "Something went wrong.";
}


// ============================================
// AUTH VIEWS
// ============================================

function showAuthView() {
  authView?.classList.remove("hidden");
  appView?.classList.add("hidden");
}

function showAppView() {
  authView?.classList.add("hidden");
  appView?.classList.remove("hidden");
}

function showAuthTab(tabName) {
  clearAuthMessage();

  const signin = $("#signinForm");
  const signup = $("#signupForm");

  if (!signin || !signup) return;

  signin.classList.toggle("hidden", tabName !== "signin");
  signup.classList.toggle("hidden", tabName !== "signup");

  $$("[data-auth-tab]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.authTab === tabName
    );
  });
}

$$("[data-auth-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    showAuthTab(button.dataset.authTab);
  });
});

$("#goSignin")?.addEventListener("click", () => {
  showAuthTab("signin");
});


// ============================================
// SIGN IN
// ============================================

signinForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthMessage();

  const email = $("#loginEmail")?.value.trim();
  const password = $("#loginPassword")?.value;

  if (!email || !password) {
    showAuthMessage("Enter email and password.");
    return;
  }

  const button = signinForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  try {
    await authPersistence;

    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    showAuthMessage(readableError(error));
  } finally {
    if (button) button.disabled = false;
  }
});


// ============================================
// SIGN UP
// ============================================

signupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthMessage();

  const name = $("#signupName")?.value.trim();
  const phone = $("#signupPhone")?.value.trim();
  const email = $("#signupEmail")?.value.trim();
  const password = $("#signupPassword")?.value;
  const confirmPassword = $("#signupConfirm")?.value;

  if (!name || !phone || !email || !password) {
    showAuthMessage("Complete all required fields.");
    return;
  }

  if (password.length < 8) {
    showAuthMessage("Password must contain at least 8 characters.");
    return;
  }

  if (password !== confirmPassword) {
    showAuthMessage("Passwords do not match.");
    return;
  }

  if (creatingAccount) return;
  creatingAccount = true;

  const button = signupForm.querySelector('button[type="submit"]');
  if (button) button.disabled = true;

  let createdUser = null;

  try {
    await authPersistence;

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    createdUser = credential.user;

    await setDoc(doc(db, "users", createdUser.uid), {
      uid: createdUser.uid,
      name,
      phone,
      email,
      role: "pending",
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await signOut(auth);

    showAuthTab("signin");
    showAuthMessage(
      "Account created. Admin authorization is required.",
      "success"
    );

    signupForm.reset();
  } catch (error) {
    showAuthMessage(readableError(error));

    if (createdUser) {
      try {
        await signOut(auth);
      } catch (_) {}
    }
  } finally {
    creatingAccount = false;
    if (button) button.disabled = false;
  }
});


// ============================================
// PASSWORD RESET
// ============================================

$("#forgotBtn")?.addEventListener("click", async () => {
  clearAuthMessage();

  const email = $("#loginEmail")?.value.trim();

  if (!email) {
    showAuthMessage("Enter your email first.");
    $("#loginEmail")?.focus();
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);

    showAuthMessage(
      "If the account exists, a password reset email will be sent.",
      "success"
    );
  } catch (error) {
    showAuthMessage(readableError(error));
  }
});


// ============================================
// ADMIN VERIFICATION
// ============================================

async function verifyAdmin(user) {
  const snapshot = await getDoc(doc(db, "users", user.uid));

  if (!snapshot.exists()) {
    throw new Error("Admin profile not found.");
  }

  const profile = snapshot.data();

  if (profile.role !== "admin" || profile.status !== "active") {
    throw new Error("This account is not authorized as Admin.");
  }

  currentAdmin = {
    uid: user.uid,
    email: user.email || "",
    name: profile.name || "Admin",
    phone: profile.phone || "",
    photoURL: profile.photoURL || ""
  };

  return currentAdmin;
}


// ============================================
// ADMIN PROFILE
// ============================================

function renderAdminProfile() {
  if (!currentAdmin) return;

  if ($("#sideName")) {
    $("#sideName").textContent = currentAdmin.name;
  }

  if ($("#sideEmail")) {
    $("#sideEmail").textContent = currentAdmin.email || "—";
  }

  if ($("#sidePhone")) {
    $("#sidePhone").textContent = currentAdmin.phone || "—";
  }

  if ($("#topAdminName")) {
    $("#topAdminName").textContent = currentAdmin.name;
  }

  if (currentAdmin.photoURL && $("#sidePhoto")) {
    $("#sidePhoto").src = currentAdmin.photoURL;
  }
}


// ============================================
// SIDEBAR
// ============================================

function openSidebar() {
  sidebar?.classList.add("open");
  scrim?.classList.add("show");
}

function closeSidebar() {
  sidebar?.classList.remove("open");
  scrim?.classList.remove("show");
}

$("#menuToggle")?.addEventListener("click", openSidebar);
$("#closeSidebar")?.addEventListener("click", closeSidebar);
scrim?.addEventListener("click", closeSidebar);


// ============================================
// DARK / LIGHT MODE
// ============================================

function setTheme(theme) {
  const dark = theme === "dark";

  document.body.classList.toggle("dark-mode", dark);

  const symbol = dark ? "☀" : "☾";

  if ($("#themeToggle")) {
    $("#themeToggle").textContent = symbol;
  }

  const icon = $("#sidebarThemeToggle")
    ?.querySelector("span:first-child");

  if (icon) icon.textContent = symbol;

  storageSet("mneet-admin-theme", dark ? "dark" : "light");
}

function toggleTheme() {
  const dark = document.body.classList.contains("dark-mode");
  setTheme(dark ? "light" : "dark");
}

$("#themeToggle")?.addEventListener("click", toggleTheme);
$("#sidebarThemeToggle")?.addEventListener("click", toggleTheme);

setTheme(storageGet("mneet-admin-theme") || "light");


// ============================================
// COURSE SELECTION STATE
// ============================================

function rememberCourse(courseId) {
  selectedCourseId = courseId || "";
  storageSet("mneet-admin-selected-course", selectedCourseId);

  document.dispatchEvent(
    new CustomEvent("mneet-course-changed", {
      detail: { courseId: selectedCourseId }
    })
  );
}

function getSelectedCourse() {
  return coursesCache.find(
    (course) => course.id === selectedCourseId
  ) || null;
}


// ============================================
// FIRESTORE COURSE DATA
// Existing structure:
// courses/{courseId}
// courses/{courseId}/chapters/{chapterId}
// courses/{courseId}/chapters/{chapterId}/topics/{topicId}
// ============================================

function courseDisplayName(course) {
  return course.name || course.title || course.id;
}

async function fetchCourses() {
  const snapshot = await getDocs(collection(db, "courses"));

  coursesCache = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data()
  }));

  coursesCache.sort((a, b) =>
    courseDisplayName(a).localeCompare(courseDisplayName(b))
  );

  const savedId = storageGet("mneet-admin-selected-course");

  if (savedId && coursesCache.some((course) => course.id === savedId)) {
    selectedCourseId = savedId;
  } else {
    selectedCourseId = coursesCache[0]?.id || "";
  }

  storageSet("mneet-admin-selected-course", selectedCourseId);

  return coursesCache;
}


// ============================================
// COURSE SELECTION ROW
// ============================================

function createCourseSelectionRow() {
  const row = document.createElement("section");
  row.className = "panel course-selection-panel";

  row.style.marginBottom = "20px";

  const top = document.createElement("div");
  top.style.display = "flex";
  top.style.flexWrap = "wrap";
  top.style.alignItems = "center";
  top.style.justifyContent = "space-between";
  top.style.gap = "12px";

  const group = document.createElement("div");
  group.style.flex = "1";
  group.style.minWidth = "200px";

  const label = document.createElement("label");
  label.textContent = "SELECT COURSE";
  label.htmlFor = "adminCourseSelect";
  label.style.display = "block";
  label.style.fontWeight = "700";
  label.style.marginBottom = "8px";

  const select = document.createElement("select");
  select.id = "adminCourseSelect";
  select.style.width = "100%";
  select.style.padding = "12px";
  select.style.borderRadius = "10px";

  select.addEventListener("change", async () => {
    rememberCourse(select.value);
    await loadDashboard();
  });

  group.append(label, select);

  const addButton = document.createElement("button");
  addButton.type = "button";
  addButton.className = "btn btn-primary";
  addButton.textContent = "+ Add Course";

  addButton.addEventListener("click", () => {
    openCourseForm();
  });

  top.append(group, addButton);
  row.append(top);

  const details = document.createElement("div");
  details.id = "selectedCourseDetails";
  details.style.marginTop = "14px";

  row.append(details);

  return row;
}

function updateCourseSelectionRow() {
  const select = $("#adminCourseSelect");
  if (!select) return;

  select.replaceChildren();

  if (!coursesCache.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "No courses found — add a course";
    select.append(option);
  } else {
    coursesCache.forEach((course) => {
      const option = document.createElement("option");

      option.value = course.id;

      const status = course.active === false ||
        course.status === "inactive"
        ? " (Inactive)"
        : "";

      option.textContent =
        `${courseDisplayName(course)}${status}`;

      select.append(option);
    });
  }

  select.value = selectedCourseId;

  if (!select.value && coursesCache.length) {
    select.value = coursesCache[0].id;
    rememberCourse(select.value);
  }

  renderSelectedCourseDetails();
}


// ============================================
// SELECTED COURSE DETAILS
// ============================================

function renderSelectedCourseDetails() {
  const container = $("#selectedCourseDetails");
  if (!container) return;

  container.replaceChildren();

  const course = getSelectedCourse();

  if (!course) {
    const message = document.createElement("p");
    message.textContent = "Create a course to begin managing content.";
    container.append(message);
    return;
  }

  const title = document.createElement("strong");
  title.textContent = courseDisplayName(course);

  const info = document.createElement("p");
  info.className = "muted";
  info.style.margin = "6px 0";

  const price = Number(course.price || 0);
  info.textContent =
    `Course ID: ${course.id} • Price: ₹${price} • ` +
    `Status: ${
      course.active === false || course.status === "inactive"
        ? "Inactive"
        : "Active"
    }`;

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.flexWrap = "wrap";
  actions.style.gap = "8px";
  actions.style.marginTop = "10px";

  const edit = document.createElement("button");
  edit.className = "btn btn-secondary";
  edit.type = "button";
  edit.textContent = "Edit Course";
  edit.addEventListener("click", () => openCourseForm(course));

  const remove = document.createElement("button");
  remove.className = "btn btn-danger";
  remove.type = "button";
  remove.textContent = "Delete Course";
  remove.addEventListener("click", () => deleteCourse(course));

  actions.append(edit, remove);

  container.append(title, info, actions);
}


// ============================================
// COURSE FORM
// ============================================

function openCourseForm(existingCourse = null) {
  const oldModal = $("#courseModal");
  oldModal?.remove();

  const modal = document.createElement("div");
  modal.id = "courseModal";
  modal.className = "modal-overlay";

  modal.style.position = "fixed";
  modal.style.inset = "0";
  modal.style.zIndex = "9999";
  modal.style.background = "rgba(0,0,0,.55)";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.padding = "16px";
  modal.style.overflowY = "auto";

  const form = document.createElement("form");
  form.className = "panel";
  form.style.width = "100%";
  form.style.maxWidth = "520px";
  form.style.maxHeight = "90vh";
  form.style.overflowY = "auto";

  const heading = document.createElement("h2");
  heading.textContent = existingCourse ? "Edit Course" : "Create Course";

  form.append(heading);

  function addField(labelText, name, value, type = "text", required = true) {
    const wrap = document.createElement("div");
    wrap.style.marginBottom = "14px";

    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.display = "block";
    label.style.marginBottom = "6px";
    label.style.fontWeight = "600";

    let input;

    if (name === "description") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = type;
    }

    input.name = name;
    input.value = value ?? "";
    input.required = required;
    input.style.width = "100%";
    input.style.padding = "11px";
    input.style.boxSizing = "border-box";
    input.style.borderRadius = "8px";

    wrap.append(label, input);
    form.append(wrap);

    return input;
  }

  const nameInput = addField(
    "Course Name",
    "name",
    existingCourse?.name || existingCourse?.title || ""
  );

  addField(
    "Description",
    "description",
    existingCourse?.description || "",
    "text",
    false
  );

  addField(
    "Price (₹)",
    "price",
    existingCourse?.price ?? 0,
    "number"
  );

  addField(
    "Thumbnail Image URL",
    "thumbnail",
    existingCourse?.thumbnail || "",
    "url",
    false
  );

  const activeWrap = document.createElement("div");
  activeWrap.style.marginBottom = "16px";

  const activeLabel = document.createElement("label");
  activeLabel.textContent = "Course Status";
  activeLabel.style.display = "block";
  activeLabel.style.marginBottom = "6px";

  const activeSelect = document.createElement("select");
  activeSelect.name = "active";
  activeSelect.style.width = "100%";
  activeSelect.style.padding = "11px";

  [
    { value: "true", label: "Active" },
    { value: "false", label: "Inactive" }
  ].forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    activeSelect.append(option);
  });

  activeSelect.value =
    existingCourse?.active === false ||
    existingCourse?.status === "inactive"
      ? "false"
      : "true";

  activeWrap.append(activeLabel, activeSelect);
  form.append(activeWrap);

  const buttons = document.createElement("div");
  buttons.style.display = "flex";
  buttons.style.flexWrap = "wrap";
  buttons.style.gap = "10px";

  const save = document.createElement("button");
  save.type = "submit";
  save.className = "btn btn-primary";
  save.textContent = existingCourse ? "Save Changes" : "Create Course";

  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "btn btn-secondary";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => modal.remove());

  buttons.append(save, cancel);
  form.append(buttons);
  modal.append(form);
  document.body.append(modal);

  nameInput.focus();

  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.remove();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);

    const name = String(formData.get("name") || "").trim();
    const description = String(
      formData.get("description") || ""
    ).trim();

    const price = Number(formData.get("price"));

    const thumbnail = String(
      formData.get("thumbnail") || ""
    ).trim();

    const active = formData.get("active") === "true";

    if (!name) {
      showToast("Enter a course name.", "error");
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      showToast("Enter a valid course price.", "error");
      return;
    }

    save.disabled = true;
    save.textContent = "Saving...";

    try {
      const data = {
        name,
        title: name,
        description,
        price,
        thumbnail,
        active,
        published: active,
        status: active ? "active" : "inactive",
        updatedAt: serverTimestamp()
      };

      if (existingCourse) {
        await updateDoc(
          doc(db, "courses", existingCourse.id),
          data
        );

        showToast("Course updated successfully.");
      } else {
        data.createdAt = serverTimestamp();

        const created = await addDoc(
          collection(db, "courses"),
          data
        );

        selectedCourseId = created.id;
        storageSet("mneet-admin-selected-course", created.id);

        showToast("Course created successfully.");
      }

      modal.remove();

      await refreshCourses();
      await loadDashboard();
    } catch (error) {
      console.error("Save course error:", error);
      showToast(readableError(error), "error");
    } finally {
      save.disabled = false;
      save.textContent = existingCourse
        ? "Save Changes"
        : "Create Course";
    }
  });
}


// ============================================
// DELETE COURSE
// ============================================

async function deleteCourse(course) {
  const confirmed = window.confirm(
    `Delete "${courseDisplayName(course)}"?\n\n` +
    "This deletes only the course document. " +
    "It does not delete its nested chapters, topics, quizzes, or files."
  );

  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, "courses", course.id));

    if (selectedCourseId === course.id) {
      selectedCourseId = "";
      storageSet("mneet-admin-selected-course", "");
    }

    showToast("Course document deleted.");
    await refreshCourses();
    await loadDashboard();
  } catch (error) {
    console.error("Delete course error:", error);
    showToast(readableError(error), "error");
  }
}


// ============================================
// REFRESH COURSE LIST
// ============================================

async function refreshCourses() {
  await fetchCourses();
  updateCourseSelectionRow();
}


// ============================================
// NAVIGATION
// ============================================

const pageNames = {
  dashboard: "Dashboard",
  courses: "Courses",
  chapters: "Chapters",
  topics: "Topics",
  quizzes: "Quizzes",
  questions: "Questions",
  notes: "Notes",
  ncert: "NCERT",
  pyq: "PYQ",
  students: "Students",
  purchases: "Purchases",
  notifications: "Notification",
  profile: "Profile",
  settings: "Setting"
};

function setActiveNav(page) {
  $$("[data-page]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.page === page
    );
  });
}

function renderPlaceholder(page) {
  if (!pageContent) return;

  pageContent.replaceChildren();

  const heading = document.createElement("section");
  heading.className = "page-heading";

  const title = document.createElement("h2");
  title.textContent = pageNames[page] || "Dashboard";

  const description = document.createElement("p");
  description.textContent =
    "Selected course content management.";

  heading.append(title, description);

  const panel = document.createElement("section");
  panel.className = "panel";

  const course = getSelectedCourse();

  const message = document.createElement("p");
  message.textContent = course
    ? `Selected Course: ${courseDisplayName(course)} (${course.id}).`
    : "Please create or select a course first.";

  panel.append(message);

  const next = document.createElement("p");
  next.className = "muted";
  next.textContent =
    "Full management for this section will be added in the next implementation step.";

  panel.append(next);

  pageContent.append(heading);

  if (page !== "courses") {
    pageContent.append(panel);
  } else {
    const add = document.createElement("button");
    add.className = "btn btn-primary";
    add.textContent = "+ Add Course";
    add.addEventListener("click", () => openCourseForm());

    panel.append(add);
    pageContent.append(panel);
    renderCourseTable(panel);
  }
}

function navigateToPage(page) {
  if (!pageNames[page]) return;

  setActiveNav(page);
  closeSidebar();

  if (page === "dashboard") {
    loadDashboard();
  } else {
    renderPlaceholder(page);
  }
}

$$("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateToPage(button.dataset.page);
  });
});

$("#topNotifications")?.addEventListener("click", () => {
  navigateToPage("notifications");
});


// ============================================
// COURSE TABLE
// ============================================

function renderCourseTable(panel) {
  const oldTable = $("#courseTableWrap");
  oldTable?.remove();

  const wrap = document.createElement("div");
  wrap.id = "courseTableWrap";
  wrap.style.marginTop = "20px";
  wrap.style.overflowX = "auto";

  const table = document.createElement("table");
  table.style.width = "100%";
  table.style.borderCollapse = "collapse";

  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  ["Course", "Price", "Status", "Actions"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    th.style.textAlign = "left";
    th.style.padding = "10px";
    headerRow.append(th);
  });

  thead.append(headerRow);

  const tbody = document.createElement("tbody");

  coursesCache.forEach((course) => {
    const row = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = courseDisplayName(course);

    const price = document.createElement("td");
    price.textContent = `₹${Number(course.price || 0)}`;

    const status = document.createElement("td");
    status.textContent =
      course.active === false || course.status === "inactive"
        ? "Inactive"
        : "Active";

    const actions = document.createElement("td");

    const select = document.createElement("button");
    select.className = "btn btn-secondary";
    select.textContent = "Select";
    select.addEventListener("click", async () => {
      rememberCourse(course.id);
      navigateToPage("dashboard");
    });

    const edit = document.createElement("button");
    edit.className = "btn btn-secondary";
    edit.style.marginLeft = "6px";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openCourseForm(course));

    actions.append(select, edit);
    row.append(name, price, status, actions);
    tbody.append(row);
  });

  table.append(thead, tbody);
  wrap.append(table);
  panel.append(wrap);
}


// ============================================
// DASHBOARD STAT CARDS
// ============================================

function createStatCard(label, value, icon) {
  const card = document.createElement("article");
  card.className = "stat-card";

  const iconElement = document.createElement("div");
  iconElement.className = "stat-icon";
  iconElement.textContent = icon;

  const labelElement = document.createElement("div");
  labelElement.className = "stat-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("div");
  valueElement.className = "stat-value";
  valueElement.textContent = String(value);

  card.append(iconElement, labelElement, valueElement);

  return card;
}

async function safeCount(collectionRef) {
  const snapshot = await getDocs(collectionRef);
  return snapshot.size;
}


// ============================================
// LOAD SELECTED COURSE STATISTICS
// ============================================

async function getCourseStats(courseId) {
  if (!courseId) {
    return { chapters: 0, topics: 0 };
  }

  const chaptersRef = collection(
    db,
    "courses",
    courseId,
    "chapters"
  );

  const chapterSnapshot = await getDocs(chaptersRef);

  let topicCount = 0;

  for (const chapter of chapterSnapshot.docs) {
    const topicsRef = collection(
      db,
      "courses",
      courseId,
      "chapters",
      chapter.id,
      "topics"
    );

    const topicsSnapshot = await getDocs(topicsRef);
    topicCount += topicsSnapshot.size;
  }

  return {
    chapters: chapterSnapshot.size,
    topics: topicCount
  };
}


// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
  if (!pageContent || !currentAdmin) return;

  pageContent.replaceChildren();

  const heading = document.createElement("section");
  heading.className = "page-heading";

  const titleGroup = document.createElement("div");

  const title = document.createElement("h2");
  title.textContent = "Dashboard Overview";

  const subtitle = document.createElement("p");
  subtitle.textContent =
    "Select a course to manage its learning content.";

  titleGroup.append(title, subtitle);
  heading.append(titleGroup);

  const selectionRow = createCourseSelectionRow();

  const loading = document.createElement("div");
  loading.className = "loading";
  loading.textContent = "Loading courses...";

  pageContent.append(heading, selectionRow, loading);

  try {
    await refreshCourses();

    loading.remove();

    const course = getSelectedCourse();

    const statsGrid = document.createElement("section");
    statsGrid.className = "stats-grid";

    if (!course) {
      const empty = document.createElement("section");
      empty.className = "panel";

      const text = document.createElement("p");
      text.textContent =
        "No courses found. Use Add Course to create your first course.";

      empty.append(text);

      pageContent.append(empty);
      return;
    }

    const courseStats = await getCourseStats(course.id);

    const cards = [
      createStatCard("Total Courses", coursesCache.length, "▤"),
      createStatCard("Chapters in Selected Course", courseStats.chapters, "▥"),
      createStatCard("Topics in Selected Course", courseStats.topics, "▧")
    ];

    cards.forEach((card) => statsGrid.append(card));

    pageContent.append(statsGrid);

    const contentPanel = document.createElement("section");
    contentPanel.className = "panel";

    const panelTitle = document.createElement("h3");
    panelTitle.textContent =
      `Manage ${courseDisplayName(course)}`;

    const panelDescription = document.createElement("p");
    panelDescription.className = "muted";
    panelDescription.textContent =
      "Choose a section from the sidebar. Chapter, Topic, Quiz, Question, PDF, Payment and Student management will be connected to the selected course.";

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexWrap = "wrap";
    actions.style.gap = "8px";
    actions.style.marginTop = "14px";

    [
      ["Chapters", "chapters"],
      ["Topics", "topics"],
      ["Quizzes", "quizzes"],
      ["Questions", "questions"],
      ["Notes / PDF", "notes"],
      ["NCERT", "ncert"],
      ["PYQ", "pyq"]
    ].forEach(([label, page]) => {
      const button = document.createElement("button");
      button.className = "btn btn-secondary";
      button.textContent = label;

      button.addEventListener("click", () => {
        navigateToPage(page);
      });

      actions.append(button);
    });

    contentPanel.append(panelTitle, panelDescription, actions);
    pageContent.append(contentPanel);

  } catch (error) {
    console.error("Dashboard error:", error);

    loading.textContent =
      "Could not load course data. Check Firestore Rules and connection.";

    showToast(readableError(error), "error");
  }
}


// ============================================
// LOGOUT
// ============================================

async function logout() {
  try {
    await signOut(auth);
    currentAdmin = null;
    showAuthView();
    showAuthTab("signin");
  } catch (error) {
    showToast(readableError(error), "error");
  }
}

$("#topLogout")?.addEventListener("click", logout);
$("#sidebarLogout")?.addEventListener("click", logout);


// ============================================
// AUTH STATE
// ============================================

onAuthStateChanged(auth, async (user) => {
  if (creatingAccount) return;

  if (!user) {
    currentAdmin = null;
    showAuthView();
    return;
  }

  try {
    await verifyAdmin(user);

    showAppView();
    renderAdminProfile();

    navigateToPage("dashboard");
  } catch (error) {
    console.error("Admin verification:", error);

    currentAdmin = null;
    showAuthView();

    showAuthMessage(
      error.message || "Admin authorization failed."
    );

    await signOut(auth);
  }
});


// ============================================
// INITIAL VIEW
// ============================================

showAuthView();
showAuthTab("signin");
