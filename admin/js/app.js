// ============================================
// mNEET-Pro Admin Panel
// File: admin/js/app.js
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
} from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";


// ============================================
// DOM HELPERS
// ============================================

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  document.querySelectorAll(selector);


// ============================================
// ELEMENTS
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

const navMenu = $("#navMenu");

const toastElement = $("#toast");


// ============================================
// APP STATE
// ============================================

let currentAdmin = null;
let toastTimer = null;
let creatingAccount = false;


// ============================================
// MESSAGE HELPERS
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


// ============================================
// FIREBASE ERROR MESSAGES
// ============================================

function readableError(error) {
  const code = error?.code || "";

  const messages = {
    "auth/invalid-email":
      "Email address is not valid.",

    "auth/user-not-found":
      "No account found with this email.",

    "auth/wrong-password":
      "Incorrect email or password.",

    "auth/invalid-credential":
      "Incorrect email or password.",

    "auth/email-already-in-use":
      "This email is already registered.",

    "auth/weak-password":
      "Please choose a stronger password.",

    "auth/too-many-requests":
      "Too many attempts. Please try again later.",

    "auth/network-request-failed":
      "Network error. Check your internet connection.",

    "auth/operation-not-allowed":
      "Enable Email/Password sign-in in Firebase.",

    "auth/unauthorized-domain":
      "Add this website domain in Firebase Authorized Domains.",

    "permission-denied":
      "Firebase permission denied. Check Firestore Rules."
  };

  return messages[code] ||
    error?.message ||
    "Something went wrong. Please try again.";
}


// ============================================
// AUTH VIEW
// ============================================

function showAuthView() {
  if (authView) authView.classList.remove("hidden");
  if (appView) appView.classList.add("hidden");
}

function showAppView() {
  if (authView) authView.classList.add("hidden");
  if (appView) appView.classList.remove("hidden");
}


// ============================================
// SIGN IN / SIGN UP TABS
// ============================================

function showAuthTab(tabName) {
  clearAuthMessage();

  const signin = $("#signinForm");
  const signup = $("#signupForm");

  if (!signin || !signup) return;

  signin.classList.toggle(
    "hidden",
    tabName !== "signin"
  );

  signup.classList.toggle(
    "hidden",
    tabName !== "signup"
  );

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

  const submitButton = signinForm.querySelector(
    'button[type="submit"]'
  );

  if (submitButton) submitButton.disabled = true;

  try {
    await authPersistence;

    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // Admin access is checked separately by
    // onAuthStateChanged below.

  } catch (error) {
    showAuthMessage(readableError(error));
  } finally {
    if (submitButton) submitButton.disabled = false;
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
    showAuthMessage(
      "Password must contain at least 8 characters."
    );
    return;
  }

  if (password !== confirmPassword) {
    showAuthMessage("Passwords do not match.");
    return;
  }

  if (creatingAccount) return;

  creatingAccount = true;

  const submitButton = signupForm.querySelector(
    'button[type="submit"]'
  );

  if (submitButton) submitButton.disabled = true;

  let createdUser = null;

  try {
    await authPersistence;

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    createdUser = credential.user;

    // New accounts never receive admin privileges
    // from client-side signup.

    await setDoc(
      doc(db, "users", createdUser.uid),
      {
        uid: createdUser.uid,
        name,
        phone,
        email,

        role: "pending",
        status: "pending",

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    await signOut(auth);

    showAuthTab("signin");

    showAuthMessage(
      "Account created. Admin authorization is required before access.",
      "success"
    );

    signupForm.reset();

  } catch (error) {
    // If Firestore profile creation fails, do not
    // claim that signup completed successfully.

    showAuthMessage(readableError(error));

    if (createdUser) {
      try {
        await signOut(auth);
      } catch (_) {
        // Keep the original error visible.
      }
    }

  } finally {
    creatingAccount = false;

    if (submitButton) submitButton.disabled = false;
  }
});


// ============================================
// FORGOT PASSWORD
// ============================================

$("#forgotBtn")?.addEventListener("click", async () => {
  clearAuthMessage();

  const email = $("#loginEmail")?.value.trim();

  if (!email) {
    showAuthMessage(
      "Enter your email first, then tap Forgot Password."
    );
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
// ADMIN AUTHORIZATION
// ============================================

async function verifyAdmin(user) {
  const userRef = doc(db, "users", user.uid);

  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Admin profile not found. Contact the administrator."
    );
  }

  const profile = snapshot.data();

  if (
    profile.role !== "admin" ||
    profile.status !== "active"
  ) {
    throw new Error(
      "This account is not authorized to access the Admin Panel."
    );
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
// LOAD ADMIN PROFILE
// ============================================

function renderAdminProfile() {
  if (!currentAdmin) return;

  const name = currentAdmin.name || "Admin";
  const email = currentAdmin.email || "—";
  const phone = currentAdmin.phone || "—";

  if ($("#sideName")) {
    $("#sideName").textContent = name;
  }

  if ($("#sideEmail")) {
    $("#sideEmail").textContent = email;
  }

  if ($("#sidePhone")) {
    $("#sidePhone").textContent = phone;
  }

  if ($("#topAdminName")) {
    $("#topAdminName").textContent = name;
  }

  if (
    currentAdmin.photoURL &&
    $("#sidePhoto")
  ) {
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

$("#menuToggle")?.addEventListener(
  "click",
  openSidebar
);

$("#closeSidebar")?.addEventListener(
  "click",
  closeSidebar
);

scrim?.addEventListener(
  "click",
  closeSidebar
);


// ============================================
// DARK / LIGHT MODE
// ============================================

function setTheme(theme) {
  const dark = theme === "dark";

  document.body.classList.toggle(
    "dark-mode",
    dark
  );

  const symbol = dark ? "☀" : "☾";

  if ($("#themeToggle")) {
    $("#themeToggle").textContent = symbol;
  }

  if ($("#sidebarThemeToggle")) {
    const icon = $("#sidebarThemeToggle")
      .querySelector("span:first-child");

    if (icon) icon.textContent = symbol;
  }

  try {
    localStorage.setItem(
      "mneet-admin-theme",
      dark ? "dark" : "light"
    );
  } catch (_) {
    // Theme still works for this page session.
  }
}

function toggleTheme() {
  const isDark =
    document.body.classList.contains("dark-mode");

  setTheme(isDark ? "light" : "dark");
}

$("#themeToggle")?.addEventListener(
  "click",
  toggleTheme
);

$("#sidebarThemeToggle")?.addEventListener(
  "click",
  toggleTheme
);

try {
  setTheme(
    localStorage.getItem("mneet-admin-theme") ||
    "light"
  );
} catch (_) {
  setTheme("light");
}


// ============================================
// PAGE NAVIGATION
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
  const title = pageNames[page] || "Dashboard";

  if (pageTitle) {
    pageTitle.textContent = title;
  }

  if (!pageContent) return;

  pageContent.replaceChildren();

  const heading = document.createElement("section");
  heading.className = "page-heading";

  const titleElement = document.createElement("h2");
  titleElement.textContent = title;

  const description = document.createElement("p");
  description.textContent =
    "This section requires its Firebase data manager.";

  heading.append(titleElement, description);

  const panel = document.createElement("section");
  panel.className = "panel";

  const message = document.createElement("div");
  message.className = "empty-state";

  const messageTitle = document.createElement("h3");
  messageTitle.textContent = `${title} Management`;

  const messageText = document.createElement("p");
  messageText.textContent =
    "The user interface is connected. The full data operations for this section must be implemented before it can manage live records.";

  message.append(messageTitle, messageText);
  panel.append(message);

  pageContent.append(heading, panel);
}

function navigateToPage(page) {
  if (!pageNames[page]) return;

  setActiveNav(page);
  closeSidebar();

  renderPlaceholder(page);

  if (page === "dashboard") {
    loadDashboard();
  }
}

$$("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    navigateToPage(button.dataset.page);
  });
});

$("#topNotifications")?.addEventListener(
  "click",
  () => navigateToPage("notifications")
);


// ============================================
// DASHBOARD
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

  card.append(
    iconElement,
    labelElement,
    valueElement
  );

  return card;
}

async function countCollection(name) {
  const snapshot = await getDocs(
    query(
      collection(db, name),
      limit(500)
    )
  );

  return snapshot.size;
}

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
    "Live summary from the connected Firebase database.";

  titleGroup.append(title, subtitle);
  heading.append(titleGroup);

  const statsGrid = document.createElement("section");
  statsGrid.className = "stats-grid";

  const loading = document.createElement("div");
  loading.className = "loading";
  loading.textContent = "Loading dashboard data...";

  pageContent.append(
    heading,
    loading
  );

  const stats = [
    {
      label: "Total Students",
      collection: "users",
      icon: "♙",
      filter: "students"
    },
    {
      label: "Total Courses",
      collection: "courses",
      icon: "▤"
    },
    {
      label: "Total Chapters",
      collection: "chapters",
      icon: "▥"
    },
    {
      label: "Total Topics",
      collection: "topics",
      icon: "▧"
    },
    {
      label: "Total Purchases",
      collection: "purchases",
      icon: "₹"
    },
    {
      label: "Quiz Attempts",
      collection: "quizAttempts",
      icon: "☷"
    }
  ];

  try {
    const results = await Promise.all(
      stats.map(async (stat) => {
        let value = 0;

        if (stat.filter === "students") {
          const snapshot = await getDocs(
            query(
              collection(db, "users"),
              where("role", "==", "student"),
              limit(500)
            )
          );

          value = snapshot.size;
        } else {
          value = await countCollection(
            stat.collection
          );
        }

        return {
          ...stat,
          value
        };
      })
    );

    loading.remove();

    results.forEach((stat) => {
      statsGrid.append(
        createStatCard(
          stat.label,
          stat.value,
          stat.icon
        )
      );
    });

    pageContent.append(statsGrid);

    const note = document.createElement("p");
    note.className = "muted small";
    note.textContent =
      "Dashboard counts are limited to 500 documents per collection in this initial version. Nested Chapters and Topics may require collection-group queries.";

    pageContent.append(note);

  } catch (error) {
    loading.textContent =
      "Dashboard data could not be loaded. Check Firebase permissions and database structure.";

    console.error("Dashboard error:", error);
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

    showToast("Signed out successfully.");

  } catch (error) {
    showToast(readableError(error), "error");
  }
}

$("#topLogout")?.addEventListener(
  "click",
  logout
);

$("#sidebarLogout")?.addEventListener(
  "click",
  logout
);


// ============================================
// AUTH STATE LISTENER
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
      error.message ||
      "Admin authorization failed."
    );

    await signOut(auth);
  }
});


// ============================================
// INITIAL PAGE
// ============================================

showAuthView();
showAuthTab("signin");
