/* =========================================================
   mNEET-Pro STUDENT DASHBOARD
========================================================= */

"use strict";

let currentUser = null;

let studentData = {};

let selectedCourseId = "";

let targetTimer = null;


/* =========================================================
   ELEMENTS
========================================================= */

const sidebar =
    $("sidebar");

const overlay =
    $("overlay");

const notificationPanel =
    $("notificationPanel");

const courseSelect =
    $("courseSelect");


/* =========================================================
   START
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        initDashboard();

    }
);


/* =========================================================
   INIT
========================================================= */

function initDashboard() {

    setupSidebar();

    setupNotifications();

    setupCourseSelector();

    setupModal();

    auth.onAuthStateChanged(
        async function(user) {

            if (!user) {

                window.location.replace(
                    "index.html"
                );

                return;

            }

            currentUser = user;

            await loadStudent();

            await loadCourses();

            await loadDashboardStats();

            loadTheme();

        }
    );

}


/* =========================================================
   SIDEBAR
========================================================= */

function setupSidebar() {

    const menu =
        $("menuButton");

    const close =
        $("sidebarClose");

    if (menu) {

        menu.addEventListener(
            "click",
            openSidebar
        );

    }

    if (close) {

        close.addEventListener(
            "click",
            closeSidebar
        );

    }

    if (overlay) {

        overlay.addEventListener(
            "click",
            closeSidebar
        );

    }

}


function openSidebar() {

    if (sidebar) {
        sidebar.classList.add("active");
    }

    if (overlay) {
        overlay.classList.add("active");
    }

}


function closeSidebar() {

    if (sidebar) {
        sidebar.classList.remove("active");
    }

    if (overlay) {
        overlay.classList.remove("active");
    }

}


/* =========================================================
   NOTIFICATIONS
========================================================= */

function setupNotifications() {

    const button =
        $("notificationButton");

    const close =
        $("notificationClose");

    if (button) {

        button.addEventListener(
            "click",
            function() {

                if (notificationPanel) {

                    notificationPanel.classList.toggle(
                        "active"
                    );

                }

            }
        );

    }

    if (close) {

        close.addEventListener(
            "click",
            function() {

                notificationPanel.classList.remove(
                    "active"
                );

            }
        );

    }

}


async function loadNotifications() {

    const list =
        $("notificationList");

    if (!list) return;

    try {

        const snapshot =
            await db
                .collection("notifications")
                .orderBy(
                    "createdAt",
                    "desc"
                )
                .limit(20)
                .get();

        if (snapshot.empty) {

            list.innerHTML =
                `<div class="notification-empty">
                    No new notifications.
                </div>`;

            return;

        }

        list.innerHTML = "";

        let count = 0;

        snapshot.forEach(function(doc) {

            const data =
                doc.data() || {};

            const item =
                document.createElement("div");

            item.className =
                "notification-item";

            item.innerHTML = `
                <div class="notification-title">
                    ${escapeHtml(
                        data.title ||
                        "Notification"
                    )}
                </div>

                <div class="notification-text">
                    ${escapeHtml(
                        data.message ||
                        data.text ||
                        ""
                    )}
                </div>
            `;

            list.appendChild(item);

            count++;

        });

        const badge =
            $("notificationBadge");

        if (badge) {

            if (count > 0) {

                badge.textContent =
                    count > 9
                        ? "9+"
                        : count;

                badge.style.display =
                    "flex";

            } else {

                badge.style.display =
                    "none";

            }

        }

    } catch (error) {

        console.error(
            "Notification error:",
            error
        );

        list.innerHTML =
            `<div class="notification-empty">
                Notifications unavailable.
            </div>`;

    }

}


/* =========================================================
   STUDENT
========================================================= */

async function loadStudent() {

    try {

        const doc =
            await db
                .collection("students")
                .doc(currentUser.uid)
                .get();

        if (doc.exists) {

            studentData =
                doc.data() || {};

        } else {

            studentData = {

                name:
                    currentUser.displayName ||
                    "Student",

                email:
                    currentUser.email ||
                    "",

                targetDate:
                    "",

                targetDream:
                    "",

                selectedCourse:
                    "",

                progress:
                    0,

                lastScore:
                    null,

                accuracy:
                    0,

                streak:
                    0

            };

        }

        updateStudentUI();

        updateTargetUI();

    } catch (error) {

        console.error(
            "Student load error:",
            error
        );

    }

}


function updateStudentUI() {

    const name =
        studentData.name ||
        currentUser.displayName ||
        "Student";

    const email =
        studentData.email ||
        currentUser.email ||
        "";

    if ($("studentName")) {
        $("studentName").textContent =
            name;
    }

    if ($("sideName")) {
        $("sideName").textContent =
            name;
    }

    if ($("sideEmail")) {
        $("sideEmail").textContent =
            email;
    }

    if ($("avatar")) {

        $("avatar").textContent =
            name
                .charAt(0)
                .toUpperCase();

    }

    setProgress(
        Number(
            studentData.progress || 0
        )
    );

    if ($("lastScore")) {

        $("lastScore").textContent =
            studentData.lastScore != null
                ? studentData.lastScore
                : "—";

    }

    if ($("accuracy")) {

        $("accuracy").textContent =
            studentData.accuracy != null
                ? studentData.accuracy + "%"
                : "0%";

    }

    if ($("streak")) {

        $("streak").textContent =
            studentData.streak != null
                ? studentData.streak
                : "0";

    }

}


/* =========================================================
   COURSES
========================================================= */

async function loadCourses() {

    if (!courseSelect) return;

    courseSelect.innerHTML =
        `<option value="">
            Loading courses...
        </option>`;

    try {

        const snapshot =
            await db
                .collection("courses")
                .get();

        courseSelect.innerHTML = "";

        if (snapshot.empty) {

            courseSelect.innerHTML =
                `<option value="">
                    No course available
                </option>`;

            updateContinueState();

            return;

        }

        snapshot.forEach(function(doc) {

            const data =
                doc.data() || {};

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                doc.id;

            option.textContent =
                data.title ||
                data.name ||
                "Biology Course";

            courseSelect.appendChild(
                option
            );

        });

        const saved =
            studentData.selectedCourse ||
            getLocal(
                "activeCourse",
                ""
            );

        if (
            saved &&
            Array.from(
                courseSelect.options
            ).some(
                option =>
                    option.value === saved
            )
        ) {

            selectedCourseId =
                saved;

            courseSelect.value =
                saved;

        } else {

            const first =
                courseSelect.options[0];

            if (first) {

                selectedCourseId =
                    first.value;

                courseSelect.value =
                    selectedCourseId;

            }

        }

        saveLocal(
            "activeCourse",
            selectedCourseId
        );

        updateContinueState();

        await loadNotifications();

    } catch (error) {

        console.error(
            "Course load error:",
            error
        );

        courseSelect.innerHTML =
            `<option value="">
                Course loading failed
            </option>`;

    }

}


function setupCourseSelector() {

    if (!courseSelect) return;

    courseSelect.addEventListener(
        "change",
        saveSelectedCourse
    );

}


async function saveSelectedCourse() {

    selectedCourseId =
        courseSelect.value;

    saveLocal(
        "activeCourse",
        selectedCourseId
    );

    updateContinueState();

    if (!currentUser) return;

    try {

        await db
            .collection("students")
            .doc(currentUser.uid)
            .set(
                {
                    selectedCourse:
                        selectedCourseId,

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                },
                {
                    merge: true
                }
            );

        studentData.selectedCourse =
            selectedCourseId;

    } catch (error) {

        console.error(
            "Selected course save error:",
            error
        );

    }

}


/* =========================================================
   CONTINUE
========================================================= */

function updateContinueState() {

    const title =
        $("continueTitle");

    const sub =
        $("continueSub");

    if (!selectedCourseId) {

        if (title) {
            title.textContent =
                "Start Learning";
        }

        if (sub) {
            sub.textContent =
                "Select a course to continue.";
        }

        return;

    }

    const option =
        courseSelect.options[
            courseSelect.selectedIndex
        ];

    const courseName =
        option
            ? option.textContent
            : "Your Course";

    if (title) {
        title.textContent =
            courseName;
    }

    if (sub) {
        sub.textContent =
            "Continue your Biology preparation.";
    }

}


function continueLearning() {

    if (!selectedCourseId) {

        alert(
            "প্রথমে একটি course select করুন।"
        );

        return;

    }

    localStorage.setItem(
        "activeCourse",
        selectedCourseId
    );

    window.location.href =
        "course.html";

}


/* =========================================================
   PROGRESS
========================================================= */

function setProgress(value) {

    let progress =
        Number(value);

    if (isNaN(progress)) {
        progress = 0;
    }

    progress =
        Math.max(
            0,
            Math.min(
                100,
                progress
            )
        );

    if ($("progressValue")) {

        $("progressValue")
            .textContent =
            Math.round(progress) + "%";

    }

    if ($("progressPercent")) {

        $("progressPercent")
            .textContent =
            Math.round(progress) + "%";

    }

    if ($("progressFill")) {

        $("progressFill")
            .style.width =
            progress + "%";

    }

    if ($("progressSub")) {

        $("progressSub")
            .textContent =
            progress > 0
                ? "Keep learning and complete your course."
                : "Start learning to build your progress.";

    }

}


/* =========================================================
   DASHBOARD STATS
========================================================= */

async function loadDashboardStats() {

    /*
     * এখানে future quiz-attempt data
     * থেকে statistics নেওয়া যাবে।
     *
     * বর্তমানে student document-এর
     * saved statistics ব্যবহার করছি।
     */

    updateStudentUI();

}


/* =========================================================
   TARGET MODAL
========================================================= */

function setupModal() {

    const modal =
        $("targetModal");

    if (!modal) return;

    modal.addEventListener(
        "click",
        function(event) {

            if (
                event.target === modal
            ) {

                closeTargetModal();

            }

        }
    );

}


function openTargetModal() {

    closeSidebar();

    const modal =
        $("targetModal");

    if (!modal) return;

    if ($("targetDateInput")) {

        $("targetDateInput").value =
            studentData.targetDate ||
            "";

    }

    if ($("targetDreamInput")) {

        $("targetDreamInput").value =
            studentData.targetDream ||
            "";

    }

    modal.classList.add(
        "active"
    );

}


function closeTargetModal() {

    const modal =
        $("targetModal");

    if (modal) {

        modal.classList.remove(
            "active"
        );

    }

}


async function saveTarget() {

    if (!currentUser) return;

    const targetDate =
        $("targetDateInput")
            ? $("targetDateInput").value
            : "";

    const targetDream =
        $("targetDreamInput")
            ? $("targetDreamInput")
                .value
                .trim()
            : "";

    if (!targetDate) {

        alert(
            "Target date select করুন।"
        );

        return;

    }

    try {

        await db
            .collection("students")
            .doc(currentUser.uid)
            .set(
                {
                    targetDate:
                        targetDate,

                    targetDream:
                        targetDream ||
                        "NEET Target",

                    updatedAt:
                        firebase.firestore
                            .FieldValue
                            .serverTimestamp()
                },
                {
                    merge: true
                }
            );

        studentData.targetDate =
            targetDate;

        studentData.targetDream =
            targetDream ||
            "NEET Target";

        updateTargetUI();

        closeTargetModal();

    } catch (error) {

        console.error(
            "Target save error:",
            error
        );

        alert(
            "Target save করা যায়নি। আবার চেষ্টা করুন।"
        );

    }

}


/* =========================================================
   TARGET UI
========================================================= */

function updateTargetUI() {

    const date =
        studentData.targetDate ||
        "";

    const dream =
        studentData.targetDream ||
        "Set your dream";

    if ($("targetDream")) {

        $("targetDream")
            .textContent =
            dream;

    }

    if ($("targetDateInput")) {

        $("targetDateInput")
            .value =
            date;

    }

    if ($("targetDreamInput")) {

        $("targetDreamInput")
            .value =
            studentData.targetDream ||
            "";

    }

    startTargetTimer(date);

}


/* =========================================================
   TARGET TIMER
========================================================= */

function startTargetTimer(date) {

    if (targetTimer) {

        clearInterval(
            targetTimer
        );

    }

    if (!date) {

        setTimer(
            0,
            0,
            0,
            0
        );

        return;

    }

    function update() {

        const target =
            new Date(
                date + "T23:59:59"
            ).getTime();

        const now =
            Date.now();

        let difference =
            target - now;

        if (difference < 0) {
            difference = 0;
        }

        const dayMs =
            1000 * 60 * 60 * 24;

        const hourMs =
            1000 * 60 * 60;

        const minuteMs =
            1000 * 60;

        const days =
            Math.floor(
                difference / dayMs
            );

        const hours =
            Math.floor(
                (difference % dayMs) /
                hourMs
            );

        const minutes =
            Math.floor(
                (difference % hourMs) /
                minuteMs
            );

        const seconds =
            Math.floor(
                (difference % minuteMs) /
                1000
            );

        setTimer(
            days,
            hours,
            minutes,
            seconds
        );

    }

    update();

    targetTimer =
        setInterval(
            update,
            1000
        );

}


function setTimer(
    days,
    hours,
    minutes,
    seconds
) {

    if ($("days")) {
        $("days").textContent =
            days;
    }

    if ($("hours")) {
        $("hours").textContent =
            hours;
    }

    if ($("minutes")) {
        $("minutes").textContent =
            minutes;
    }

    if ($("seconds")) {
        $("seconds").textContent =
            seconds;
    }

}


/* =========================================================
   THEME
========================================================= */

function loadTheme() {

    const theme =
        localStorage.getItem(
            "mneet-theme"
        );

    if (theme === "dark") {

        applyDarkTheme();

    } else {

        applyLightTheme();

    }

}


function toggleTheme() {

    const current =
        localStorage.getItem(
            "mneet-theme"
        );

    if (current === "dark") {

        localStorage.setItem(
            "mneet-theme",
            "light"
        );

        applyLightTheme();

    } else {

        localStorage.setItem(
            "mneet-theme",
            "dark"
        );

        applyDarkTheme();

    }

}


function applyDarkTheme() {

    document.body.classList.add(
        "dark-mode"
    );

    if ($("themeIcon")) {

        $("themeIcon").textContent =
            "☀️";

    }

    if ($("themeText")) {

        $("themeText").textContent =
            "White Mode";

    }

}


function applyLightTheme() {

    document.body.classList.remove(
        "dark-mode"
    );

    if ($("themeIcon")) {

        $("themeIcon").textContent =
            "🌙";

    }

    if ($("themeText")) {

        $("themeText").textContent =
            "Dark Mode";

    }

}


/* =========================================================
   PROFILE / NAVIGATION
========================================================= */

function openProfile() {

    closeSidebar();

    window.location.href =
        "profile.html";

}


function goHome() {

    window.location.href =
        "dashboard.html";

}


function goCourses() {

    window.location.href =
        "courses.html";

}


function goPractice() {

    /*
     * Practice page এখনো আলাদা না থাকলে
     * courses page-এ fallback।
     */

    window.location.href =
        "courses.html";

}


/* =========================================================
   LOGOUT
========================================================= */

async function logoutStudent() {

    const confirmed =
        confirm(
            "আপনি কি logout করতে চান?"
        );

    if (!confirmed) return;

    try {

        await auth.signOut();

        localStorage.removeItem(
            "activeCourse"
        );

        window.location.replace(
            "index.html"
        );

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        alert(
            "Logout করা যায়নি। আবার চেষ্টা করুন।"
        );

    }

}
