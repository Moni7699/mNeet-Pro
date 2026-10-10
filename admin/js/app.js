import {
  auth,
  db,
  storage,
  authPersistence,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  deleteDoc,
  ref,
  uploadBytes,
  getDownloadURL
} from "../../shared/firebase.js";

const $ = id => document.getElementById(id);

const authView = $("authView");
const appView = $("appView");
const pageContent = $("pageContent");
const toastEl = $("toast");

let currentAdmin = null;
let currentPage = "dashboard";
let selectedCourse = "";
let selectedSubject = "";
let selectedChapter = "";
let selectedTopic = "";
let busy = false;

const titles = {
  dashboard: "Dashboard",
  courses: "Courses",
  subjects: "Subjects",
  chapters: "Chapters",
  topics: "Topics",
  quizzes: "Quizzes",
  questions: "Questions",
  notes: "Notes",
  ncert: "NCERT",
  pyq: "PYQ",
  mockTests: "Full Mock Tests",
  students: "Students",
  purchases: "Purchases",
  notifications: "Notifications",
  profile: "Profile",
  settings: "Settings"
};

function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3200);
}

function errorMessage(error) {
  const map = {
    "auth/invalid-credential": "Email বা password সঠিক নয়।",
    "auth/user-not-found": "এই account পাওয়া যায়নি।",
    "auth/too-many-requests": "অনেকবার চেষ্টা হয়েছে। পরে আবার চেষ্টা করো।",
    "permission-denied": "এই কাজ করার অনুমতি নেই।",
    "storage/unauthorized": "File upload করার অনুমতি নেই।"
  };
  return map[error?.code] || error?.message || "একটি সমস্যা হয়েছে।";
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function setBusy(value) {
  busy = value;
  document.querySelectorAll("button").forEach(button => {
    if (button.dataset.allowBusy !== "true") {
      button.disabled = value;
    }
  });
}

async function requireAdmin(user) {
  const snap = await getDoc(doc(db, "users", user.uid));

  if (!snap.exists()) {
    throw new Error(
      "Admin account অনুমোদিত নয়। Firebase-এ এই UID-এর role=admin এবং status=active সেট করতে হবে।"
    );
  }

  const data = snap.data();

  if (data.role !== "admin" || data.status !== "active") {
    throw new Error("এই account-এর Admin access নেই।");
  }

  return data;
}

async function showAdmin(user) {
  const profile = await requireAdmin(user);

  currentAdmin = { ...profile, uid: user.uid };

  $("sideName").textContent = profile.name || user.displayName || "Admin";
  $("sideEmail").textContent = user.email || "";
  $("sidePhone").textContent = profile.phone || "";
  $("topAdminName").textContent = profile.name || "Admin";

  if (profile.photoURL) $("sidePhoto").src = profile.photoURL;

  authView.hidden = true;
  appView.hidden = false;

  await navigate("dashboard");
}

async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    toast(errorMessage(error));
  }
}

$("signinForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;

  setBusy(true);
  $("authMessage").textContent = "";

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
    setBusy(false);
  }
});

$("forgotBtn").addEventListener("click", async () => {
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

onAuthStateChanged(auth, async user => {
  if (!user) {
    currentAdmin = null;
    authView.hidden = false;
    appView.hidden = true;
    return;
  }

  try {
    await showAdmin(user);
  } catch (error) {
    authView.hidden = false;
    appView.hidden = true;
    $("authMessage").textContent = errorMessage(error);
  }
});

$("topLogout").addEventListener("click", logout);
$("sidebarLogout").addEventListener("click", logout);

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

function toggleTheme() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "mneet-admin-theme",
    document.body.classList.contains("dark-mode") ? "dark" : "light"
  );
}

if (localStorage.getItem("mneet-admin-theme") === "dark") {
  document.body.classList.add("dark-mode");
}

$("themeToggle").addEventListener("click", toggleTheme);
$("sidebarThemeToggle").addEventListener("click", toggleTheme);

$("topNotifications").addEventListener("click", () => navigate("notifications"));

$("navMenu").addEventListener("click", event => {
  const button = event.target.closest("[data-page]");
  if (!button) return;

  navigate(button.dataset.page);
  closeSidebar();
});

async function navigate(page) {
  currentPage = page;

  document.querySelectorAll("#navMenu button").forEach(button => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  $("topAdminName").textContent = titles[page] || "Admin";
  pageContent.innerHTML = `<div class="card">Loading…</div>`;

  try {
    if (page === "dashboard") return await renderDashboard();
    if (page === "courses") return await renderCourses();
    if (page === "subjects") return await renderHierarchy("subjects");
    if (page === "chapters") return await renderHierarchy("chapters");
    if (page === "topics") return await renderHierarchy("topics");
    if (page === "quizzes") return await renderQuizzes();
    if (page === "questions") return await renderQuestions();
    if (["notes", "ncert", "pyq"].includes(page)) return await renderResources(page);
    if (page === "purchases") return await renderPurchases();
    if (page === "students") return await renderStudents();
    if (page === "notifications") return await renderNotifications();
    if (page === "profile") return renderProfile();
    if (page === "settings") return await renderSettings();
    if (page === "mockTests") return await renderMockTests();
  } catch (error) {
    pageContent.innerHTML = `
      <div class="card">
        <h2>কাজটি সম্পন্ন হয়নি</h2>
        <p>${escapeHTML(errorMessage(error))}</p>
      </div>`;
  }
}

function heading(title, description = "") {
  return `
    <div class="page-heading">
      <div>
        <h1>${escapeHTML(title)}</h1>
        <p>${escapeHTML(description)}</p>
      </div>
    </div>`;
}

async function countCollection(path) {
  const snapshot = await getDocs(collection(db, path));
  return snapshot.size;
}

async function renderDashboard() {
  const [courses, users, purchases, attempts] = await Promise.all([
    getDocs(collection(db, "courses")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "purchases")),
    getDocs(collection(db, "attempts"))
  ]);

  const studentCount = users.docs.filter(
    d => d.data().role === "student"
  ).length;

  const approved = purchases.docs.filter(
    d => d.data().status === "approved"
  ).length;

  const pending = purchases.docs.filter(
    d => d.data().status === "pending"
  ).length;

  pageContent.innerHTML = `
    ${heading("Admin Dashboard", "mNEET-Pro-এর content ও student management")}

    <div class="panel">
      <label for="dashboardCourse">Select Course</label>
      <select id="dashboardCourse">
        <option value="">All Courses</option>
        ${courses.docs.map(d => `
          <option value="${escapeHTML(d.id)}">
            ${escapeHTML(d.data().name || d.id)}
          </option>
        `).join("")}
      </select>
    </div>

    <div class="grid" style="margin-top:18px">
      ${statCard("Total Students", studentCount)}
      ${statCard("Total Courses", courses.size)}
      ${statCard("Approved Purchases", approved)}
      ${statCard("Pending Payments", pending)}
      ${statCard("Quiz Attempts", attempts.size)}
    </div>

    <div class="panel">
      <h2>Quick Actions</h2>
      <div class="toolbar">
        <button class="btn primary" data-go="courses">Manage Courses</button>
        <button class="btn primary" data-go="subjects">Manage Subjects</button>
        <button class="btn primary" data-go="chapters">Manage Chapters</button>
        <button class="btn primary" data-go="topics">Manage Topics</button>
        <button class="btn primary" data-go="purchases">Review Payments</button>
      </div>
      <p class="muted">Quiz attempts ও progress-এর পূর্ণ বিশ্লেষণ trusted grading service যুক্ত হওয়ার পরে দেখানো হবে।</p>
    </div>
  `;

  pageContent.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => navigate(button.dataset.go));
  });

  $("dashboardCourse").addEventListener("change", event => {
    selectedCourse = event.target.value;
  });
}

function statCard(label, value) {
  return `
    <div class="card">
      <div class="stat-label">${escapeHTML(label)}</div>
      <div class="stat-value">${Number(value) || 0}</div>
    </div>`;
}

async function renderCourses() {
  const snap = await getDocs(collection(db, "courses"));

  pageContent.innerHTML = `
    ${heading("Courses", "Course create, edit ও active/inactive management")}
    <div class="panel">
      <h2>Create Course</h2>
      <form id="courseForm">
        <div class="form-grid">
          <div>
            <label>Course Name</label>
            <input name="name" required maxlength="120">
          </div>
          <div>
            <label>Price (INR)</label>
            <input name="price" type="number" min="0" required>
          </div>
          <div class="span-2">
            <label>Description</label>
            <textarea name="description" required></textarea>
          </div>
          <div>
            <label>Start Date</label>
            <input name="startDate" type="date">
          </div>
          <div>
            <label>End Date</label>
            <input name="endDate" type="date">
          </div>
          <div>
            <label>Thumbnail</label>
            <input name="thumbnail" type="file" accept="image/*">
          </div>
          <div>
            <label>Status</label>
            <select name="status">
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <button class="btn primary" type="submit">Save Course</button>
      </form>
    </div>

    <div class="panel">
      <h2>Course List</h2>
      ${tableHTML(
        ["Name", "Price", "Status", "Actions"],
        snap.docs.map(d => {
          const c = d.data();
          return [
            escapeHTML(c.name || ""),
            `₹${Number(c.price || 0)}`,
            escapeHTML(c.status || "inactive"),
            `<div class="actions">
              <button class="btn outline" data-edit-course="${d.id}">Edit</button>
              <button class="btn danger" data-delete-course="${d.id}">Delete</button>
            </div>`
          ];
        })
      )}
    </div>
  `;

  $("courseForm").addEventListener("submit", saveCourse);

  pageContent.querySelectorAll("[data-edit-course]").forEach(button => {
    button.addEventListener("click", () => editCourse(button.dataset.editCourse));
  });

  pageContent.querySelectorAll("[data-delete-course]").forEach(button => {
    button.addEventListener("click", () => deleteCourse(button.dataset.deleteCourse));
  });
}

function tableHTML(headers, rows) {
  if (!rows.length) return `<div class="empty">কোনও data পাওয়া যায়নি।</div>`;

  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
        <tbody>
          ${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </div>`;
}

async function saveCourse(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);

  const name = String(data.get("name") || "").trim();
  const description = String(data.get("description") || "").trim();
  const price = Number(data.get("price"));

  if (!name || !description || !Number.isFinite(price) || price < 0) {
    toast("Course information সঠিকভাবে পূরণ করো।");
    return;
  }

  try {
    const course = {
      name,
      description,
      price,
      startDate: data.get("startDate") || "",
      endDate: data.get("endDate") || "",
      status: data.get("status"),
      updatedAt: serverTimestamp(),
      updatedBy: auth.currentUser.uid
    };

    const file = data.get("thumbnail");

    if (file && file.size) {
      if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        throw new Error("Thumbnail image হতে হবে এবং 5 MB-এর কম হতে হবে।");
      }

      const id = crypto.randomUUID();
      const fileRef = ref(storage, `courses/course-thumbnails/${id}`);
      await uploadBytes(fileRef, file);
      course.thumbnailURL = await getDownloadURL(fileRef);
    }

    const refDoc = await addDoc(collection(db, "courses"), {
      ...course,
      createdAt: serverTimestamp(),
      createdBy: auth.currentUser.uid
    });

    toast(`Course তৈরি হয়েছে: ${refDoc.id}`);
    await renderCourses();
  } catch (error) {
    toast(errorMessage(error));
  }
}

async function editCourse(courseId) {
  try {
    const courseRef = doc(db, "courses", courseId);
    const snap = await getDoc(courseRef);

    if (!snap.exists()) return toast("Course পাওয়া যায়নি।");

    const c = snap.data();
    const name = prompt("Course Name:", c.name || "");
    if (name === null) return;

    const priceText = prompt("Price (INR):", String(c.price || 0));
    if (priceText === null) return;

    const price = Number(priceText);
    if (!name.trim() || !Number.isFinite(price) || price < 0) {
      return toast("Name বা price সঠিক নয়।");
    }

    await updateDoc(courseRef, {
      name: name.trim(),
      price,
      updatedAt: serverTimestamp()
    });

    toast("Course update হয়েছে।");
    await renderCourses();
  } catch (error) {
    toast(errorMessage(error));
  }
}

async function deleteCourse(courseId) {
  if (!confirm("Course delete করতে চাও? Related content আগে পরীক্ষা করো।")) return;

  try {
    const snap = await getDocs(collection(db, "purchases"));
    const hasPurchases = snap.docs.some(d => d.data().courseId === courseId);

    if (hasPurchases) {
      return toast("এই Course-এর purchase history আছে। Delete না করে inactive করো।");
    }

    await deleteDoc(doc(db, "courses", courseId));
    toast("Course delete হয়েছে।");
    await renderCourses();
  } catch (error) {
    toast(errorMessage(error));
  }
}

async function renderHierarchy(type) {
  const courseSnap = await getDocs(collection(db, "courses"));
  const courses = courseSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const subjectSnap = selectedCourse && ["chapters", "topics"].includes(type)
    ? await getDocs(collection(db, "courses", selectedCourse, "subjects"))
    : null;

  const subjects = subjectSnap?.docs.map(d => ({ id: d.id, ...d.data() })) || [];

  let parentPath;
  if (type === "subjects") parentPath = ["courses", selectedCourse, "subjects"];
  if (type === "chapters") parentPath = ["courses", selectedCourse, "subjects", selectedSubject, "chapters"];
  if (type === "topics") parentPath = ["courses", selectedCourse, "subjects", selectedSubject, "chapters", selectedChapter, "topics"];

  let rows = [];

  if (selectedCourse && (type === "subjects" || (type === "chapters" && selectedSubject) || (type === "topics" && selectedSubject && selectedChapter))) {
    const snap = await getDocs(collection(db, ...parentPath));
    rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  pageContent.innerHTML = `
    ${heading(titles[type], "Course → Subject → Chapter → Topic structure")}
    <div class="panel">
      <label>Course</label>
      <select id="courseSelect">
        <option value="">Select Course</option>
        ${courses.map(c => `<option value="${c.id}" ${c.id === selectedCourse ? "selected" : ""}>${escapeHTML(c.name || c.id)}</option>`).join("")}
      </select>

      ${type !== "subjects" ? `
        <label>Subject</label>
        <select id="subjectSelect">
          <option value="">Select Subject</option>
          ${subjects.map(s => `<option value="${s.id}" ${s.id === selectedSubject ? "selected" : ""}>${escapeHTML(s.name || s.id)}</option>`).join("")}
        </select>
      ` : ""}

      ${type === "topics" ? `
        <label>Chapter</label>
        <select id="chapterSelect">
          <option value="">Select Chapter</option>
        </select>
      ` : ""}

      <form id="hierarchyForm">
        <div class="form-grid">
          <div>
            <label>Name</label>
            <input name="name" required maxlength="160">
          </div>
          <div>
            <label>Order Number</label>
            <input name="order" type="number" min="1" value="${rows.length + 1}" required>
          </div>
          <div class="span-2">
            <label>Description</label>
            <textarea name="description"></textarea>
          </div>
        </div>
        <button class="btn primary" type="submit">Save ${escapeHTML(type.slice(0, -1))}</button>
      </form>
    </div>

    <div class="panel">
      <h2>${escapeHTML(titles[type])} List</h2>
      ${tableHTML(["Order", "Name", "Description", "Actions"], rows.map(item => [
        Number(item.order || 0),
        escapeHTML(item.name || ""),
        escapeHTML(item.description || ""),
        `<div class="actions">
          <button class="btn outline" data-edit-item="${item.id}">Edit</button>
          <button class="btn danger" data-delete-item="${item.id}">Delete</button>
        </div>`
      ]))}
    </div>
  `;

  $("courseSelect").addEventListener("change", e => {
    selectedCourse = e.target.value;
    selectedSubject = "";
    selectedChapter = "";
    navigate(type);
  });

  if ($("subjectSelect")) {
    $("subjectSelect").addEventListener("change", e => {
      selectedSubject = e.target.value;
      selectedChapter = "";
      navigate(type);
    });
  }

  if (type === "topics") {
    const chapterSelect = $("chapterSelect");

    if (selectedCourse && selectedSubject) {
      const chapters = await getDocs(collection(
        db, "courses", selectedCourse, "subjects", selectedSubject, "chapters"
      ));

      chapterSelect.innerHTML = `<option value="">Select Chapter</option>` +
        chapters.docs.map(d => `
          <option value="${d.id}" ${d.id === selectedChapter ? "selected" : ""}>
            ${escapeHTML(d.data().name || d.id)}
          </option>`).join("");

      chapterSelect.addEventListener("change", e => {
        selectedChapter = e.target.value;
        navigate("topics");
      });
    }
  }

  $("hierarchyForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!selectedCourse) return toast("Course নির্বাচন করো।");
    if (type !== "subjects" && !selectedSubject) return toast("Subject নির্বাচন করো।");
    if (type === "topics" && !selectedChapter) return toast("Chapter নির্বাচন করো।");

    try {
      const fd = new FormData(event.currentTarget);
      const item = {
        name: String(fd.get("name")).trim(),
        description: String(fd.get("description") || "").trim(),
        order: Number(fd.get("order")),
        published: true,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid
      };

      if (!item.name || !Number.isInteger(item.order) || item.order < 1) {
        return toast("Name ও order সঠিকভাবে দাও।");
      }

      await addDoc(collection(db, ...parentPath), {
        ...item,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });

      toast(`${titles[type]}-এ save হয়েছে।`);
      await renderHierarchy(type);
    } catch (error) {
      toast(errorMessage(error));
    }
  });

  pageContent.querySelectorAll("[data-delete-item]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!confirm("এই item delete করতে চাও?")) return;

      try {
        await deleteDoc(doc(db, ...parentPath, button.dataset.deleteItem));
        toast("Delete হয়েছে।");
        await renderHierarchy(type);
      } catch (error) {
        toast(errorMessage(error));
      }
    });
  });

  pageContent.querySelectorAll("[data-edit-item]").forEach(button => {
    button.addEventListener("click", async () => {
      const itemRef = doc(db, ...parentPath, button.dataset.editItem);
      const snap = await getDoc(itemRef);
      if (!snap.exists()) return;

      const name = prompt("Name:", snap.data().name || "");
      if (name === null) return;

      try {
        await updateDoc(itemRef, {
          name: name.trim(),
          updatedAt: serverTimestamp()
        });
        toast("Update হয়েছে।");
        await renderHierarchy(type);
      } catch (error) {
        toast(errorMessage(error));
      }
    });
  });
}

function selectedQuizCollection() {
  if (!selectedCourse) throw new Error("Course নির্বাচন করো।");
  if (!selectedSubject) throw new Error("Subject নির্বাচন করো।");
  if (!selectedChapter) throw new Error("Chapter নির্বাচন করো।");

  return collection(
    db,
    "courses", selectedCourse,
    "subjects", selectedSubject,
    "chapters", selectedChapter,
    "topics", selectedTopic,
    "quizzes"
  );
}

async function renderQuizzes() {
  pageContent.innerHTML = `
    ${heading("Quizzes", "Topic-wise quiz তৈরি ও পরিচালনা")}
    <div class="panel">
      <p>প্রথমে Topics-এ Course, Subject, Chapter ও Topic তৈরি করো। তারপর quiz তৈরি করো।</p>
      <button class="btn primary" id="goTopics">Open Topics</button>
      <button class="btn outline" id="goQuestions">Open Questions</button>
    </div>`;

  $("goTopics").onclick = () => navigate("topics");
  $("goQuestions").onclick = () => navigate("questions");
}

async function renderQuestions() {
  pageContent.innerHTML = `
    ${heading("Questions", "Questions management")}
    <div class="panel">
      <p>Question তৈরি করার আগে Course, Subject, Chapter, Topic এবং Quiz-এর IDs নির্বাচন করতে হবে।</p>
      <p>প্রশ্নের correct answer ও solution Student-কে সরাসরি প্রকাশ না করে trusted grading service-এ রাখতে হবে।</p>
      <button class="btn primary" id="goQuizzes">Manage Quizzes</button>
    </div>`;

  $("goQuizzes").onclick = () => navigate("quizzes");
}

async function renderResources(type) {
  pageContent.innerHTML = `
    ${heading(titles[type], "Chapter-wise PDF resource management")}
    <div class="panel">
      <p>PDF upload-এর আগে Course, Subject এবং Chapter structure তৈরি করতে হবে।</p>
      <p>Resource metadata-এর collection: <code>courses/{courseId}/resources/{resourceId}</code></p>
      <p>Notes-এর জন্য topicId-ও সংরক্ষণ করতে হবে।</p>
      <p>PDF upload এবং read access Storage Rules-এর সঙ্গে পরীক্ষা করতে হবে।</p>
      <button class="btn primary" id="resourceTopics">Open Topics</button>
    </div>`;

  $("resourceTopics").onclick = () => navigate("topics");
}

async function renderPurchases() {
  const snap = await getDocs(collection(db, "purchases"));

  const purchases = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  pageContent.innerHTML = `
    ${heading("Purchases", "Manual payment approval")}
    <div class="panel">
      ${tableHTML(
        ["Student UID", "Course", "Amount", "Transaction ID", "Status", "Actions"],
        purchases.map(p => [
          escapeHTML(p.studentId || ""),
          escapeHTML(p.courseName || p.courseId || ""),
          `₹${Number(p.amount || 0)}`,
          escapeHTML(p.transactionId || ""),
          escapeHTML(p.status || "pending"),
          p.status === "pending"
            ? `<div class="actions">
                <button class="btn primary" data-approve="${p.id}">Approve</button>
                <button class="btn danger" data-reject="${p.id}">Reject</button>
              </div>`
            : escapeHTML(p.status || "")
        ])
      )}
    </div>`;

  pageContent.querySelectorAll("[data-approve]").forEach(button => {
    button.addEventListener("click", () => changePurchase(button.dataset.approve, "approved"));
  });

  pageContent.querySelectorAll("[data-reject]").forEach(button => {
    button.addEventListener("click", () => changePurchase(button.dataset.reject, "rejected"));
  });
}

async function changePurchase(id, status) {
  if (!confirm(`Payment ${status} করতে চাও?`)) return;

  try {
    await updateDoc(doc(db, "purchases", id), {
      status,
      reviewedAt: serverTimestamp(),
      reviewedBy: auth.currentUser.uid
    });

    toast(`Payment ${status} হয়েছে।`);
    await renderPurchases();
  } catch (error) {
    toast(errorMessage(error));
  }
}

async function renderStudents() {
  const snap = await getDocs(query(
    collection(db, "users"),
    orderBy("createdAt", "desc")
  ));

  const students = snap.docs.filter(d => d.data().role === "student");

  pageContent.innerHTML = `
    ${heading("Students", "Student account list")}
    <div class="panel">
      ${tableHTML(
        ["Name", "Email", "Phone", "City", "Status"],
        students.map(d => {
          const s = d.data();
          return [
            escapeHTML(s.name || ""),
            escapeHTML(s.email || ""),
            escapeHTML(s.phone || ""),
            escapeHTML(s.city || ""),
            escapeHTML(s.status || "")
          ];
        })
      )}
    </div>`;
}

async function renderNotifications() {
  const snap = await getDocs(collection(db, "notifications"));

  pageContent.innerHTML = `
    ${heading("Notifications", "Student announcements")}
    <div class="panel">
      <form id="notificationForm">
        <label>Title</label>
        <input name="title" required maxlength="150">
        <label>Message</label>
        <textarea name="message" required></textarea>
        <label>Type</label>
        <select name="type">
          <option value="announcement">General Announcement</option>
          <option value="new-course">New Course</option>
          <option value="new-notes">New Notes</option>
          <option value="new-quiz">New Quiz</option>
          <option value="important">Important Announcement</option>
        </select>
        <button class="btn primary" type="submit">Publish Notification</button>
      </form>
    </div>
    <div class="panel">
      <h2>Notification History</h2>
      ${tableHTML(
        ["Title", "Type", "Date"],
        snap.docs.map(d => {
          const n = d.data();
          const date = n.createdAt?.toDate?.().toLocaleString() || "—";
          return [escapeHTML(n.title || ""), escapeHTML(n.type || ""), escapeHTML(date)];
        })
      )}
    </div>`;

  $("notificationForm").addEventListener("submit", async event => {
    event.preventDefault();

    const fd = new FormData(event.currentTarget);

    try {
      await addDoc(collection(db, "notifications"), {
        title: String(fd.get("title")).trim(),
        message: String(fd.get("message")).trim(),
        type: String(fd.get("type")),
        audience: "students",
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid
      });

      toast("Notification publish হয়েছে।");
      await renderNotifications();
    } catch (error) {
      toast(errorMessage(error));
    }
  });
}

function renderProfile() {
  const profile = currentAdmin || {};

  pageContent.innerHTML = `
    ${heading("Profile", "Admin profile information")}
    <div class="panel">
      <p><strong>Name:</strong> ${escapeHTML(profile.name || "")}</p>
      <p><strong>Email:</strong> ${escapeHTML(auth.currentUser?.email || "")}</p>
      <p><strong>Phone:</strong> ${escapeHTML(profile.phone || "")}</p>
      <p>Admin profile update ও verified email change-এর form পরবর্তী profile module-এ যুক্ত করতে হবে।</p>
    </div>`;
}

async function renderSettings() {
  const settingsRef = doc(db, "settings", "app");
  const snap = await getDoc(settingsRef);
  const settings = snap.exists() ? snap.data() : {};

  pageContent.innerHTML = `
    ${heading("Settings", "Payment, support ও social links")}
    <div class="panel">
      <form id="settingsForm">
        <label>UPI ID</label>
        <input name="upiId" value="${escapeHTML(settings.upiId || "")}">
        <label>Support Email</label>
        <input name="supportEmail" type="email" value="${escapeHTML(settings.supportEmail || "")}">
        <label>Facebook URL</label>
        <input name="facebook" type="url" value="${escapeHTML(settings.facebook || "")}">
        <label>Instagram URL</label>
        <input name="instagram" type="url" value="${escapeHTML(settings.instagram || "")}">
        <label>YouTube URL</label>
        <input name="youtube" type="url" value="${escapeHTML(settings.youtube || "")}">
        <label>WhatsApp Community URL</label>
        <input name="whatsapp" type="url" value="${escapeHTML(settings.whatsapp || "")}">
        <button class="btn primary" type="submit">Save Settings</button>
      </form>
    </div>`;

  $("settingsForm").addEventListener("submit", async event => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);

    try {
      await setDoc(settingsRef, {
        upiId: String(fd.get("upiId") || "").trim(),
        supportEmail: String(fd.get("supportEmail") || "").trim(),
        facebook: String(fd.get("facebook") || "").trim(),
        instagram: String(fd.get("instagram") || "").trim(),
        youtube: String(fd.get("youtube") || "").trim(),
        whatsapp: String(fd.get("whatsapp") || "").trim(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser.uid
      }, { merge: true });

      toast("Settings save হয়েছে।");
    } catch (error) {
      toast(errorMessage(error));
    }
  });
}

async function renderMockTests() {
  pageContent.innerHTML = `
    ${heading("Full Mock Tests", "Full mock tests course অনুযায়ী পরিচালনা")}
    <div class="panel">
      <p>Full Mock Test-এর জন্য course-wise test ও question collection তৈরি করতে হবে।</p>
      <p>Correct answer এবং marking logic trusted server-side grading function-এ থাকবে।</p>
      <button class="btn primary" id="mockCourseBtn">Open Courses</button>
    </div>`;

  $("mockCourseBtn").onclick = () => navigate("courses");
}
