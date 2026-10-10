import {
  auth,
  db,
  storage,
  authPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL
} from "../../shared/firebase.js";

const $ = id => document.getElementById(id);

let student = null;
let activePage = "dashboard";
let selectedCourse = localStorage.getItem("mneet-selected-course") || "";
let currentQuiz = null;
let currentQuestions = [];
let currentQuestionIndex = 0;
let currentAnswers = {};
let questionTimer = null;
let questionSeconds = 60;
let quizStartedAt = 0;

const titles = {
  dashboard: "Dashboard",
  myCourses: "My Courses",
  buyCourses: "Buy Courses",
  study: "Study",
  topicPractice: "Topic-wise Practice",
  chapterPractice: "Chapter-wise Practice",
  ncert: "NCERT Books",
  notes: "Notes",
  pyq: "PYQ",
  results: "Results & Progress",
  notifications: "Notifications",
  purchaseHistory: "Purchase History",
  profile: "Profile",
  settings: "Settings",
  support: "Help & Support",
  weakPoints: "Weak Point Practice",
  mockTests: "Full Mock Tests"
};

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function errorMessage(error) {
  const messages = {
    "auth/invalid-credential": "Email বা Password সঠিক নয়।",
    "auth/email-already-in-use": "এই Email দিয়ে আগে account তৈরি হয়েছে।",
    "auth/weak-password": "আরও শক্তিশালী Password ব্যবহার করো।",
    "auth/invalid-email": "Email address সঠিক নয়।",
    "permission-denied": "এই তথ্য দেখার অনুমতি নেই।",
    "storage/unauthorized": "File upload করার অনুমতি নেই।"
  };

  return messages[error?.code] || error?.message || "একটি সমস্যা হয়েছে।";
}

function setBusy(form, busy) {
  form.querySelectorAll("button").forEach(button => {
    button.disabled = busy;
  });
}

function showLogin() {
  $("loginPanel").hidden = false;
  $("signupPanel").hidden = true;
  $("authMessage").textContent = "";
}

function showSignup() {
  $("loginPanel").hidden = true;
  $("signupPanel").hidden = false;
  $("authMessage").textContent = "";
}

$("showSignup").addEventListener("click", showSignup);
$("showLogin").addEventListener("click", showLogin);

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  setBusy(form, true);

  try {
    await authPersistence;

    await signInWithEmailAndPassword(
      auth,
      $("loginEmail").value.trim(),
      $("loginPassword").value
    );
  } catch (error) {
    $("authMessage").textContent = errorMessage(error);
  } finally {
    setBusy(form, false);
  }
});

$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();

  const form = event.currentTarget;
  const fd = new FormData(form);

  const name = String(fd.get("name") || "").trim();
  const phone = String(fd.get("phone") || "").trim();
  const email = String(fd.get("email") || "").trim();
  const city = String(fd.get("city") || "").trim();
  const target = String(fd.get("target") || "").trim();
  const password = String(fd.get("password") || "");
  const confirmPassword = String(fd.get("confirmPassword") || "");

  if (password !== confirmPassword) {
    $("authMessage").textContent = "Password দুটো এক নয়।";
    return;
  }

  if (password.length < 8) {
    $("authMessage").textContent = "Password কমপক্ষে 8 অক্ষরের হতে হবে।";
    return;
  }

  setBusy(form, true);

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(credential.user, { displayName: name });

    await setDoc(doc(db, "users", credential.user.uid), {
      uid: credential.user.uid,
      name,
      phone,
      email,
      city,
      target,
      photoURL: "",
      role: "student",
      status: "active",
      createdAt: serverTimestamp()
    });

    toast("Account তৈরি হয়েছে।");
  } catch (error) {
    $("authMessage").textContent = errorMessage(error);

    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch (_) {}
    }
  } finally {
    setBusy(form, false);
  }
});

$("forgotPassword").addEventListener("click", async () => {
  const email = $("loginEmail").value.trim();

  if (!email) {
    $("authMessage").textContent = "প্রথমে Email লিখো।";
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    $("authMessage").textContent = "Password reset email পাঠানো হয়েছে।";
  } catch (error) {
    $("authMessage").textContent = errorMessage(error);
  }
});

async function loadStudent(user) {
  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) {
    await signOut(auth);
    throw new Error("Student profile পাওয়া যায়নি।");
  }

  const profile = snap.data();

  if (profile.role !== "student" || profile.status !== "active") {
    await signOut(auth);
    throw new Error("এই account-এর Student access নেই।");
  }

  student = { ...profile, uid: user.uid };
  $("sideName").textContent = profile.name || user.displayName || "Student";
  $("sideEmail").textContent = user.email || "";
  $("sidePhoto").src = profile.photoURL || "../assets/avatar.svg";

  $("authView").hidden = true;
  $("appView").hidden = false;

  await loadSocialLinks();
  await navigate("dashboard");
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    student = null;
    $("authView").hidden = false;
    $("appView").hidden = true;
    return;
  }

  try {
    await loadStudent(user);
  } catch (error) {
    $("authView").hidden = false;
    $("appView").hidden = true;
    $("authMessage").textContent = errorMessage(error);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  stopQuestionTimer();
  await signOut(auth);
});

$("menuToggle").addEventListener("click", () => {
  $("sidebar").classList.add("open");
  $("scrim").classList.add("show");
});

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("scrim").classList.remove("show");
}

$("closeSidebar").addEventListener("click", closeSidebar);
$("scrim").addEventListener("click", closeSidebar);

$("themeToggle").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");

  localStorage.setItem(
    "mneet-student-theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
});

if (localStorage.getItem("mneet-student-theme") === "dark") {
  document.body.classList.add("dark-mode");
}

$("notificationButton").addEventListener("click", () => navigate("notifications"));

document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    navigate(button.dataset.page);
    closeSidebar();
  });
});

async function navigate(page) {
  stopQuestionTimer();

  activePage = page;
  currentQuiz = null;

  $("topStudentName").textContent = titles[page] || "mNEET-Pro";

  document.querySelectorAll("#navMenu [data-page], .bottom-nav [data-page]")
    .forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });

  $("pageContent").innerHTML = `<div class="card">Loading…</div>`;

  try {
    const routes = {
      dashboard: renderDashboard,
      myCourses: renderMyCourses,
      buyCourses: renderBuyCourses,
      study: renderStudy,
      topicPractice: renderStudy,
      chapterPractice: renderStudy,
      ncert: () => renderResources("ncert"),
      notes: () => renderResources("notes"),
      pyq: () => renderResources("pyq"),
      results: renderResults,
      notifications: renderNotifications,
      purchaseHistory: renderPurchaseHistory,
      profile: renderProfile,
      settings: renderSettings,
      support: renderSupport,
      weakPoints: renderWeakPoints,
      mockTests: renderMockTests
    };

    const render = routes[page];

    if (!render) {
      $("pageContent").innerHTML = `<div class="card">Page পাওয়া যায়নি।</div>`;
      return;
    }

    await render();
  } catch (error) {
    $("pageContent").innerHTML = `
      <div class="card">
        <h2>তথ্য load করা যায়নি</h2>
        <p>${escapeHTML(errorMessage(error))}</p>
      </div>`;
  }
}

function heading(title, description = "") {
  return `
    <div class="page-heading">
      <div>
        <h1>${escapeHTML(title)}</h1>
        <p class="muted">${escapeHTML(description)}</p>
      </div>
    </div>`;
}

function statCard(label, value) {
  return `
    <div class="card">
      <div class="stat-label">${escapeHTML(label)}</div>
      <div class="stat-value">${escapeHTML(String(value))}</div>
    </div>`;
}

function tableHTML(headers, rows) {
  if (!rows.length) {
    return `<div class="empty">এখনও কোনও data নেই।</div>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map(row => `
            <tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

async function getCourses() {
  const snap = await getDocs(collection(db, "courses"));

  const today = new Date().toISOString().slice(0, 10);

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(course => {
      if (course.status !== "active") return false;
      if (course.startDate && course.startDate > today) return false;
      if (course.endDate && course.endDate < today) return false;
      return true;
    });
}

async function getMyPurchases() {
  const snap = await getDocs(query(
    collection(db, "purchases"),
    where("studentId", "==", student.uid)
  ));

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getApprovedCourseIds() {
  const purchases = await getMyPurchases();

  return [...new Set(
    purchases.filter(p => p.status === "approved").map(p => p.courseId)
  )];
}

async function getMyAttempts() {
  const snap = await getDocs(query(
    collection(db, "attempts"),
    where("studentId", "==", student.uid),
    orderBy("createdAt", "desc"),
    limit(100)
  ));

  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function accuracy(attempts) {
  let correct = 0;
  let total = 0;

  for (const attempt of attempts) {
    correct += Number(attempt.correct || 0);
    total += Number(attempt.totalQuestions || 0);
  }

  return total ? Math.round(correct / total * 100) : 0;
}

async function renderDashboard() {
  const [courses, purchases, attempts] = await Promise.all([
    getCourses(),
    getMyPurchases(),
    getMyAttempts()
  ]);

  const approvedIds = new Set(
    purchases.filter(p => p.status === "approved").map(p => p.courseId)
  );

  const approvedCourses = courses.filter(c => approvedIds.has(c.id));

  if (selectedCourse && !approvedIds.has(selectedCourse)) {
    selectedCourse = "";
    localStorage.removeItem("mneet-selected-course");
  }

  const last = attempts[0];

  $("pageContent").innerHTML = `
    ${heading(`Welcome, ${student.name || "Student"}!`,
      "তোমার NEET preparation চালিয়ে যাও।")}

    <div class="panel">
      <label for="selectedCourse">Select Your Course</label>
      <select id="selectedCourse">
        <option value="">Select an approved course</option>
        ${approvedCourses.map(c => `
          <option value="${c.id}" ${c.id === selectedCourse ? "selected" : ""}>
            ${escapeHTML(c.name || "")}
          </option>
        `).join("")}
      </select>
      <p class="muted">Pending payment-এর Course unlock হবে Admin approval-এর পরে।</p>
    </div>

    <div class="grid" style="margin-top:16px">
      ${statCard("Course Progress", "—")}
      ${statCard("Last Attempt Score", last ? last.score ?? "—" : "—")}
      ${statCard("Quiz Attempts", attempts.length)}
      ${statCard("Questions Attempted",
        attempts.reduce((n, a) => n + Number(a.totalQuestions || 0), 0))}
      ${statCard("Overall Accuracy", accuracy(attempts) + "%")}
    </div>

    <div class="panel">
      <h2>Continue Learning</h2>
      <div id="continueCourseArea">
        ${approvedCourses.length
          ? `<p>${approvedCourses.length} approved course(s) available.</p>
             <button class="btn primary" id="continueStudy">Continue Study</button>`
          : `<p>এখনও কোনও approved course নেই। Course Store থেকে course কিনতে পারো।`}
      </div>
    </div>

    <div class="panel">
      <h2>Available Courses</h2>
      <div class="course-grid">
        ${courses.map(c => `
          <article class="card course-card">
            ${c.thumbnailURL
              ? `<img src="${escapeHTML(c.thumbnailURL)}" alt="">`
              : ""}
            <h3>${escapeHTML(c.name || "")}</h3>
            <p>${escapeHTML(c.description || "")}</p>
            <strong>₹${Number(c.price || 0)}</strong>
            <p class="muted">
              ${approvedIds.has(c.id) ? "Purchased" : "Available to buy"}
            </p>
            <button class="btn primary" data-buy-course="${c.id}">
              ${approvedIds.has(c.id) ? "Open Course" : "View / Buy"}
            </button>
          </article>
        `).join("")}
      </div>
    </div>

    <div class="panel">
      <h2>Recent Quiz Results</h2>
      ${tableHTML(
        ["Quiz", "Score", "Accuracy", "Date"],
        attempts.slice(0, 5).map(a => [
          escapeHTML(a.quizName || a.quizId || "Quiz"),
          escapeHTML(String(a.score ?? "—")),
          `${Number(a.accuracy || 0)}%`,
          escapeHTML(a.createdAt?.toDate?.().toLocaleString() || "—")
        ])
      )}
    </div>
  `;

  $("selectedCourse").addEventListener("change", async event => {
    selectedCourse = event.target.value;
    localStorage.setItem("mneet-selected-course", selectedCourse);
    await renderDashboard();
  });

  $("continueStudy")?.addEventListener("click", () => navigate("study"));

  document.querySelectorAll("[data-buy-course]").forEach(button => {
    button.addEventListener("click", async () => {
      const id = button.dataset.buyCourse;

      if (approvedIds.has(id)) {
        selectedCourse = id;
        localStorage.setItem("mneet-selected-course", id);
        await navigate("study");
      } else {
        await purchaseCourse(id);
      }
    });
  });
}

async function renderBuyCourses() {
  const [courses, purchases] = await Promise.all([
    getCourses(),
    getMyPurchases()
  ]);

  const statusByCourse = new Map();

  purchases.forEach(p => statusByCourse.set(p.courseId, p));

  $("pageContent").innerHTML = `
    ${heading("Buy Courses", "Course নির্বাচন করে purchase request জমা দাও।")}
    <div class="course-grid">
      ${courses.map(c => {
        const purchase = statusByCourse.get(c.id);
        const status = purchase?.status || "not purchased";

        return `
          <article class="card course-card">
            ${c.thumbnailURL ? `<img src="${escapeHTML(c.thumbnailURL)}" alt="">` : ""}
            <h3>${escapeHTML(c.name || "")}</h3>
            <p>${escapeHTML(c.description || "")}</p>
            <p>Price: <strong>₹${Number(c.price || 0)}</strong></p>
            <p>Starts: ${escapeHTML(c.startDate || "—")}</p>
            <p>Ends: ${escapeHTML(c.endDate || "—")}</p>
            <span class="badge ${status}">${escapeHTML(status)}</span>
            <div style="margin-top:12px">
              ${status === "approved"
                ? `<button class="btn primary" data-open-course="${c.id}">Open Course</button>`
                : status === "pending"
                ? `<button class="btn outline" disabled>Awaiting Approval</button>`
                : `<button class="btn primary" data-purchase="${c.id}">Buy Course</button>`}
            </div>
          </article>`;
      }).join("")}
    </div>`;

  document.querySelectorAll("[data-purchase]").forEach(button => {
    button.addEventListener("click", () => purchaseCourse(button.dataset.purchase));
  });

  document.querySelectorAll("[data-open-course]").forEach(button => {
    button.addEventListener("click", async () => {
      selectedCourse = button.dataset.openCourse;
      localStorage.setItem("mneet-selected-course", selectedCourse);
      await navigate("study");
    });
  });
}

async function purchaseCourse(courseId) {
  try {
    const [courseSnap, settingsSnap, purchases] = await Promise.all([
      getDoc(doc(db, "courses", courseId)),
      getDoc(doc(db, "settings", "app")),
      getMyPurchases()
    ]);

    if (!courseSnap.exists()) throw new Error("Course পাওয়া যায়নি।");

    const existing = purchases.find(p =>
      p.courseId === courseId &&
      ["pending", "approved"].includes(p.status)
    );

    if (existing) {
      return toast(`এই Course-এর payment status: ${existing.status}`);
    }

    const course = courseSnap.data();
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};

    const page = $("pageContent");

    page.innerHTML = `
      ${heading("Course Payment", course.name || "")}
      <div class="panel">
        <h2>Payment Information</h2>
        <p>Course: ${escapeHTML(course.name || "")}</p>
        <p>Amount: <strong>₹${Number(course.price || 0)}</strong></p>
        <p>UPI ID: <strong>${escapeHTML(settings.upiId || "Admin has not configured UPI ID")}</strong></p>
        <p>Support: ${escapeHTML(settings.supportEmail || "Support email not configured")}</p>

        ${settings.qrURL
          ? `<img src="${escapeHTML(settings.qrURL)}" alt="Payment QR"
                  style="width:220px;max-width:100%">`
          : ""}

        <form id="paymentForm">
          <label>Transaction ID / UTR</label>
          <input name="transactionId" required minlength="6" maxlength="100">

          <label>Payment Screenshot (optional)</label>
          <input name="receipt" type="file" accept="image/*">

          <button class="btn primary" type="submit">Submit Payment Request</button>
        </form>
      </div>`;

    $("paymentForm").addEventListener("submit", async event => {
      event.preventDefault();

      const form = event.currentTarget;
      const fd = new FormData(form);
      const transactionId = String(fd.get("transactionId") || "").trim();
      const receipt = fd.get("receipt");

      if (!transactionId) return toast("Transaction ID/UTR দাও।");

      try {
        let receiptURL = "";

        if (receipt && receipt.size) {
          if (!receipt.type.startsWith("image/") || receipt.size > 8 * 1024 * 1024) {
            throw new Error("Screenshot image হতে হবে এবং 8 MB-এর কম হতে হবে।");
          }

          const path = `paymentReceipts/${student.uid}/${crypto.randomUUID()}`;
          const fileRef = ref(storage, path);

          await uploadBytes(fileRef, receipt);
          receiptURL = await getDownloadURL(fileRef);
        }

        await addDoc(collection(db, "purchases"), {
          studentId: student.uid,
          courseId,
          courseName: course.name || "",
          amount: Number(course.price || 0),
          transactionId,
          receiptURL,
          status: "pending",
          refundStatus: "none",
          createdAt: serverTimestamp()
        });

        toast("Payment request জমা হয়েছে। Admin approval-এর অপেক্ষা করো।");
        await renderPurchaseHistory();
      } catch (error) {
        toast(errorMessage(error));
      }
    });
  } catch (error) {
    toast(errorMessage(error));
  }
}

async function renderMyCourses() {
  const [courses, purchases] = await Promise.all([
    getCourses(),
    getMyPurchases()
  ]);

  const approved = new Set(
    purchases.filter(p => p.status === "approved").map(p => p.courseId)
  );

  const list = courses.filter(c => approved.has(c.id));

  $("pageContent").innerHTML = `
    ${heading("My Courses", "তোমার approved courses")}
    <div class="course-grid">
      ${list.map(c => `
        <article class="card course-card">
          ${c.thumbnailURL ? `<img src="${escapeHTML(c.thumbnailURL)}" alt="">` : ""}
          <h3>${escapeHTML(c.name || "")}</h3>
          <p>${escapeHTML(c.description || "")}</p>
          <div class="progress-track"><div class="progress-fill" style="width:0%"></div></div>
          <p class="muted">Progress analytics-এর জন্য completed content tracking যুক্ত করতে হবে।</p>
          <button class="btn primary" data-continue="${c.id}">Continue Learning</button>
        </article>
      `).join("")}
    </div>`;

  document.querySelectorAll("[data-continue]").forEach(button => {
    button.addEventListener("click", async () => {
      selectedCourse = button.dataset.continue;
      localStorage.setItem("mneet-selected-course", selectedCourse);
      await navigate("study");
    });
  });
}

async function renderPurchaseHistory() {
  const purchases = await getMyPurchases();

  $("pageContent").innerHTML = `
    ${heading("Purchase History", "Payment requests ও refund status")}
    <div class="panel">
      ${tableHTML(
        ["Course", "Amount", "Transaction ID", "Date", "Payment Status", "Refund"],
        purchases.map(p => [
          escapeHTML(p.courseName || p.courseId || ""),
          `₹${Number(p.amount || 0)}`,
          escapeHTML(p.transactionId || ""),
          escapeHTML(p.createdAt?.toDate?.().toLocaleString() || "—"),
          `<span class="badge ${escapeHTML(p.status || "pending")}">${escapeHTML(p.status || "pending")}</span>`,
          escapeHTML(p.refundStatus || "none")
        ])
      )}
    </div>`;
}

async function renderStudy() {
  const courseIds = await getApprovedCourseIds();

  if (!selectedCourse || !courseIds.includes(selectedCourse)) {
    $("pageContent").innerHTML = `
      ${heading("Study", "প্রথমে একটি approved course নির্বাচন করো।")}
      <button class="btn primary" id="chooseCourse">My Courses</button>`;

    $("chooseCourse").onclick = () => navigate("myCourses");
    return;
  }

  const subjectsSnap = await getDocs(query(
    collection(db, "courses", selectedCourse, "subjects"),
    orderBy("order", "asc")
  ));

  const subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  $("pageContent").innerHTML = `
    ${heading("Study", "Course → Subject → Chapter → Topic")}
    <div class="panel">
      <label>Course</label>
      <select id="studyCourse">
        ${courseIds.map(id => `
          <option value="${id}" ${id === selectedCourse ? "selected" : ""}>
            ${escapeHTML(id)}
          </option>
        `).join("")}
      </select>
    </div>
    <div class="content-grid" style="margin-top:15px">
      ${subjects.map(s => `
        <button class="card subject-button" data-subject="${s.id}">
          <h3>${escapeHTML(s.name || "")}</h3>
          <p class="muted">${escapeHTML(s.description || "")}</p>
          <span class="badge">Open Subject</span>
        </button>
      `).join("")}
    </div>
    <div id="studyDetail"></div>`;

  $("studyCourse").addEventListener("change", event => {
    selectedCourse = event.target.value;
    localStorage.setItem("mneet-selected-course", selectedCourse);
    renderStudy();
  });

  document.querySelectorAll("[data-subject]").forEach(button => {
    button.addEventListener("click", () => loadChapters(button.dataset.subject));
  });
}

async function loadChapters(subjectId) {
  const snap = await getDocs(query(
    collection(db, "courses", selectedCourse, "subjects", subjectId, "chapters"),
    orderBy("order", "asc")
  ));

  const chapters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const root = $("studyDetail");

  root.innerHTML = `
    <div class="panel">
      <h2>Chapters</h2>
      ${chapters.map(c => `
        <button class="card" style="width:100%;text-align:left;margin:6px 0"
                data-chapter="${c.id}" data-subject="${subjectId}">
          <strong>${Number(c.order || 0)}. ${escapeHTML(c.name || "")}</strong>
          <p class="muted">${escapeHTML(c.description || "")}</p>
        </button>
      `).join("")}
    </div>`;

  root.querySelectorAll("[data-chapter]").forEach(button => {
    button.addEventListener("click", () =>
      loadTopics(button.dataset.subject, button.dataset.chapter)
    );
  });
}

async function loadTopics(subjectId, chapterId) {
  const snap = await getDocs(query(
    collection(
      db, "courses", selectedCourse,
      "subjects", subjectId,
      "chapters", chapterId,
      "topics"
    ),
    orderBy("order", "asc")
  ));

  const topics = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const root = $("studyDetail");

  root.innerHTML = `
    <div class="panel">
      <h2>Topics</h2>
      ${topics.map(t => `
        <article class="card" style="margin:8px 0">
          <h3>${Number(t.order || 0)}. ${escapeHTML(t.name || "")}</h3>
          <p>${escapeHTML(t.description || "")}</p>
          <button class="btn primary" data-topic="${t.id}"
                  data-subject="${subjectId}" data-chapter="${chapterId}">
            Open Topic
          </button>
        </article>
      `).join("")}
    </div>`;

  root.querySelectorAll("[data-topic]").forEach(button => {
    button.addEventListener("click", () =>
      loadTopicQuizzes(subjectId, chapterId, button.dataset.topic)
    );
  });
}

async function loadTopicQuizzes(subjectId, chapterId, topicId) {
  const quizSnap = await getDocs(collection(
    db, "courses", selectedCourse,
    "subjects", subjectId,
    "chapters", chapterId,
    "topics", topicId,
    "quizzes"
  ));

  const quizzes = quizSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  $("studyDetail").innerHTML = `
    <div class="panel">
      <h2>Topic Quizzes</h2>
      ${quizzes.length ? quizzes.map(q => `
        <article class="card" style="margin:8px 0">
          <h3>${escapeHTML(q.name || "Quiz")}</h3>
          <p>${Number(q.questionCount || 0)} questions</p>
          <button class="btn primary" data-start-quiz="${q.id}">
            Start Practice
          </button>
        </article>
      `).join("") : `<div class="empty">এই Topic-এ এখনও কোনও Quiz প্রকাশ করা হয়নি।</div>`}
    </div>`;

  $("studyDetail").querySelectorAll("[data-start-quiz]").forEach(button => {
    button.addEventListener("click", () => {
      toast("Secure quiz delivery ও grading backend যুক্ত হওয়ার পরে quiz শুরু করা যাবে।");
    });
  });
}

async function renderResources(type) {
  const courseIds = await getApprovedCourseIds();

  if (!selectedCourse || !courseIds.includes(selectedCourse)) {
    $("pageContent").innerHTML = `
      ${heading(titles[type], "এই section দেখতে approved course প্রয়োজন।")}
      <button class="btn primary" id="resourceCourses">My Courses</button>`;

    $("resourceCourses").onclick = () => navigate("myCourses");
    return;
  }

  const snap = await getDocs(query(
    collection(db, "courses", selectedCourse, "resources"),
    where("type", "==", type)
  ));

  const resources = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  $("pageContent").innerHTML = `
    ${heading(titles[type], "Course অনুযায়ী study resources")}
    <div class="content-grid">
      ${resources.map(r => `
        <article class="card">
          <h3>${escapeHTML(r.name || "PDF Resource")}</h3>
          <p>${escapeHTML(r.chapterName || "")}</p>
          ${r.topicName ? `<p>${escapeHTML(r.topicName)}</p>` : ""}
          ${r.url
            ? `<a class="btn primary" href="${escapeHTML(r.url)}" target="_blank" rel="noopener">Read PDF</a>`
            : `<span class="badge">File unavailable</span>`}
        </article>
      `).join("")}
    </div>
    ${resources.length ? "" : `<div class="panel empty">এখনও কোনও resource প্রকাশ করা হয়নি।</div>`}`;
}

async function renderResults() {
  const attempts = await getMyAttempts();

  $("pageContent").innerHTML = `
    ${heading("Results & Progress", "তোমার quiz history")}
    <div class="grid">
      ${statCard("Total Attempts", attempts.length)}
      ${statCard("Questions Attempted",
        attempts.reduce((n, a) => n + Number(a.totalQuestions || 0), 0))}
      ${statCard("Overall Accuracy", accuracy(attempts) + "%")}
      ${statCard("Best Score", attempts.length
        ? Math.max(...attempts.map(a => Number(a.score || 0)))
        : "—")}
    </div>
    <div class="panel">
      ${tableHTML(
        ["Quiz", "Score", "Correct", "Incorrect", "Skipped", "Accuracy", "Date"],
        attempts.map(a => [
          escapeHTML(a.quizName || a.quizId || ""),
          escapeHTML(String(a.score ?? "—")),
          Number(a.correct || 0),
          Number(a.incorrect || 0),
          Number(a.skipped || 0),
          `${Number(a.accuracy || 0)}%`,
          escapeHTML(a.createdAt?.toDate?.().toLocaleString() || "—")
        ])
      )}
    </div>`;
}

async function renderNotifications() {
  const [notificationsSnap, readsSnap] = await Promise.all([
    getDocs(query(
      collection(db, "notifications"),
      where("audience", "==", "students")
    )),
    getDocs(query(
      collection(db, "notificationReads"),
      where("studentId", "==", student.uid)
    ))
  ]);

  const readIds = new Set(readsSnap.docs.map(d => d.data().notificationId));

  const notifications = notificationsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

  const unread = notifications.filter(n => !readIds.has(n.id)).length;
  $("unreadDot").hidden = unread === 0;

  $("pageContent").innerHTML = `
    ${heading("Notifications", "Admin-এর announcements")}
    ${notifications.map(n => `
      <article class="panel">
        <h3>${escapeHTML(n.title || "")}</h3>
        <p>${escapeHTML(n.message || "")}</p>
        <p class="muted">${escapeHTML(n.createdAt?.toDate?.().toLocaleString() || "—")}</p>
        ${readIds.has(n.id)
          ? `<span class="badge">Read</span>`
          : `<button class="btn primary" data-read="${n.id}">Mark as Read</button>`}
      </article>
    `).join("")}
    ${notifications.length ? "" : `<div class="empty">কোনও notification নেই।</div>`}`;

  document.querySelectorAll("[data-read]").forEach(button => {
    button.addEventListener("click", async () => {
      const notificationId = button.dataset.read;

      try {
        await setDoc(
          doc(db, "notificationReads", `${student.uid}_${notificationId}`),
          {
            studentId: student.uid,
            notificationId,
            read: true,
            readAt: serverTimestamp()
          }
        );

        await renderNotifications();
      } catch (error) {
        toast(errorMessage(error));
      }
    });
  });
}

async function renderProfile() {
  $("pageContent").innerHTML = `
    ${heading("Profile", "তোমার account information update করো")}
    <div class="panel">
      <form id="profileForm">
        <label>Full Name</label>
        <input name="name" value="${escapeHTML(student.name || "")}" required>

        <label>Phone Number</label>
        <input name="phone" value="${escapeHTML(student.phone || "")}" required>

        <label>City</label>
        <input name="city" value="${escapeHTML(student.city || "")}" required>

        <label>Target / Exam</label>
        <input name="target" value="${escapeHTML(student.target || "")}">

        <label>Profile Photo</label>
        <input name="photo" type="file" accept="image/*">

        <p>Email: ${escapeHTML(student.email || "")}</p>
        <button class="btn primary" type="submit">Save Profile</button>
      </form>

      <button class="btn outline" id="passwordReset" style="margin-top:15px">
        Send Password Reset Email
      </button>
    </div>`;

  $("profileForm").addEventListener("submit", async event => {
    event.preventDefault();

    const fd = new FormData(event.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const target = String(fd.get("target") || "").trim();
    const photo = fd.get("photo");

    try {
      const update = { name, phone, city, target };

      if (photo && photo.size) {
        if (!photo.type.startsWith("image/") || photo.size > 5 * 1024 * 1024) {
          throw new Error("Profile photo 5 MB-এর কম image হতে হবে।");
        }

        const photoRef = ref(
          storage,
          `profilePhotos/${student.uid}/${crypto.randomUUID()}`
        );

        await uploadBytes(photoRef, photo);
        update.photoURL = await getDownloadURL(photoRef);
      }

      await updateDoc(doc(db, "users", student.uid), update);
      await updateProfile(auth.currentUser, { displayName: name });

      student = { ...student, ...update };

      $("sideName").textContent = name;
      if (update.photoURL) $("sidePhoto").src = update.photoURL;

      toast("Profile update হয়েছে।");
    } catch (error) {
      toast(errorMessage(error));
    }
  });

  $("passwordReset").addEventListener("click", async () => {
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      toast("Password reset email পাঠানো হয়েছে।");
    } catch (error) {
      toast(errorMessage(error));
    }
  });
}

async function loadSocialLinks() {
  const snap = await getDoc(doc(db, "settings", "app"));
  const settings = snap.exists() ? snap.data() : {};

  const links = [
    ["Facebook", settings.facebook],
    ["Instagram", settings.instagram],
    ["YouTube", settings.youtube],
    ["WhatsApp Community", settings.whatsapp]
  ].filter(item => item[1]);

  $("socialLinks").innerHTML = links.map(([name, url]) => `
    <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">
      ${escapeHTML(name)}
    </a>
  `).join("");
}

async function renderSettings() {
  $("pageContent").innerHTML = `
    ${heading("Settings", "App preferences")}
    <div class="panel">
      <button id="lightMode" class="btn outline">Light Mode</button>
      <button id="darkMode" class="btn outline">Dark Mode</button>
      <p>Notification preferences ও অন্যান্য account settings পরবর্তী module-এ যুক্ত করতে হবে।</p>
    </div>`;

  $("lightMode").onclick = () => {
    document.body.classList.remove("dark-mode");
    localStorage.setItem("mneet-student-theme", "light");
  };

  $("darkMode").onclick = () => {
    document.body.classList.add("dark-mode");
    localStorage.setItem("mneet-student-theme", "dark");
  };
}

async function renderSupport() {
  const settingsSnap = await getDoc(doc(db, "settings", "app"));
  const settings = settingsSnap.exists() ? settingsSnap.data() : {};

  $("pageContent").innerHTML = `
    ${heading("Help & Support", "Payment বা app-সংক্রান্ত সমস্যায় যোগাযোগ করো")}
    <div class="panel">
      <p>Support Email: ${
        settings.supportEmail
          ? `<a href="mailto:${escapeHTML(settings.supportEmail)}">${escapeHTML(settings.supportEmail)}</a>`
          : "Admin এখনও support email configure করেনি।"
      }</p>

      <form id="supportForm">
        <label>Issue Type</label>
        <select name="type">
          <option value="payment">Payment</option>
          <option value="course-access">Course Access</option>
          <option value="technical">Technical Problem</option>
          <option value="refund">Refund Request</option>
          <option value="other">Other</option>
        </select>

        <label>Purchase / Transaction Reference (optional)</label>
        <input name="reference" maxlength="150">

        <label>Message</label>
        <textarea name="message" required maxlength="3000"></textarea>

        <button class="btn primary" type="submit">Submit Support Request</button>
      </form>
    </div>`;

  $("supportForm").addEventListener("submit", async event => {
    event.preventDefault();

    const fd = new FormData(event.currentTarget);

    try {
      await addDoc(collection(db, "supportTickets"), {
        studentId: student.uid,
        type: String(fd.get("type")),
        reference: String(fd.get("reference") || "").trim(),
        message: String(fd.get("message") || "").trim(),
        status: "open",
        createdAt: serverTimestamp()
      });

      toast("Support request জমা হয়েছে।");
      event.currentTarget.reset();
    } catch (error) {
      toast(errorMessage(error));
    }
  });
}

async function renderWeakPoints() {
  $("pageContent").innerHTML = `
    ${heading("Weak Point Practice", "ভুল করা প্রশ্ন আবার practice করো")}
    <div class="panel">
      <p>Weak Point practice-এর জন্য secure grading service-এ ভুল উত্তরের history রাখতে হবে।</p>
      <p>একই প্রশ্ন দ্বিতীয়বারও ভুল হলে সেটি Weak Point list-এ যোগ হবে।</p>
      <p class="muted">এই version-এ Weak Point quiz generator এখনও যুক্ত করা হয়নি।</p>
    </div>`;
}

async function renderMockTests() {
  const courseIds = await getApprovedCourseIds();

  if (!selectedCourse || !courseIds.includes(selectedCourse)) {
    $("pageContent").innerHTML = `
      ${heading("Full Mock Test", "একটি approved course নির্বাচন করো।")}
      <button class="btn primary" id="mockMyCourses">My Courses</button>`;

    $("mockMyCourses").onclick = () => navigate("myCourses");
    return;
  }

  const snap = await getDocs(collection(
    db, "courses", selectedCourse, "mockTests"
  ));

  const tests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  $("pageContent").innerHTML = `
    ${heading("Full Mock Tests", "Course অনুযায়ী full-length practice")}
    <div class="content-grid">
      ${tests.map(test => `
        <article class="card">
          <h3>${escapeHTML(test.name || "Mock Test")}</h3>
          <p>${Number(test.questionCount || 0)} questions</p>
          <p>${Number(test.durationMinutes || 0)} minutes</p>
          <button class="btn primary" data-mock="${test.id}">Start Test</button>
        </article>
      `).join("")}
    </div>
    ${tests.length ? "" : `<div class="panel empty">এখনও কোনও Mock Test প্রকাশ করা হয়নি।</div>`}

    <div class="panel">
      <p class="muted">Secure question delivery ও server-side grading যুক্ত না হওয়া পর্যন্ত Mock Test চালু করা হবে না।</p>
    </div>`;
}
