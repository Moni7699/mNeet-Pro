
"use strict";

let dashboardStudent = null;
let dashboardCourses = [];
let dashboardPurchased = [];

document.addEventListener("DOMContentLoaded", function() {
    initDashboard();
});

async function initDashboard() {
    auth.onAuthStateChanged(async user => {
        if (!user) { window.location.replace("index.html"); return; }
        dashboardStudent = await getStudentData(user.uid) || {};
        await loadDashboardCourses(user.uid);
        renderDashboard();
        loadDashboardNotifications();
        startDashboardTimer();
    });
}

async function loadDashboardCourses(uid) {
    dashboardCourses = await getCourses();
    dashboardPurchased = await getPurchasedCourseIds(uid);
}

function renderDashboard() {
    const name = dashboardStudent.name || auth.currentUser?.displayName || "Student";
    document.querySelectorAll("[data-student-name]").forEach(e => e.textContent = name);
    document.querySelectorAll("[data-student-email]").forEach(e => e.textContent = dashboardStudent.email || auth.currentUser?.email || "");
    document.querySelectorAll("[data-student-initial]").forEach(e => e.textContent = name.charAt(0).toUpperCase());

    const select = document.getElementById("courseSelect");
    if (select) {
        const purchased = dashboardCourses.filter(c => dashboardPurchased.includes(c.id));
        select.innerHTML = purchased.length
            ? purchased.map(c => `<option value="${escapeHTML(c.id)}">${escapeHTML(c.title || c.name || "Biology Course")}</option>`).join("")
            : `<option value="">No purchased course</option>`;
        if (dashboardStudent.selectedCourse && dashboardPurchased.includes(dashboardStudent.selectedCourse)) {
            select.value = dashboardStudent.selectedCourse;
        }
    }

    const p = safePercentage(dashboardStudent.progress);
    setText("progressValue", p + "%");
    setText("progressPercent", p + "%");
    const fill = document.getElementById("progressFill");
    if (fill) fill.style.width = p + "%";
    setText("lastScore", dashboardStudent.lastScore ?? "—");
    setText("accuracy", safePercentage(dashboardStudent.accuracy) + "%");
    setText("streak", dashboardStudent.streak ?? 0);

    setText("targetDream", dashboardStudent.targetDream || "Set your dream");
    const continueCourse = dashboardCourses.find(c => c.id === dashboardStudent.selectedCourse) ||
                           dashboardCourses.find(c => dashboardPurchased.includes(c.id));
    setText("continueTitle", continueCourse ? (continueCourse.title || continueCourse.name || "Biology Course") : "Start Learning");
    setText("continueSub", continueCourse ? "Continue your Biology preparation." : "Purchase a course to start learning.");
}

async function selectDashboardCourse(id) {
    if (!id || !auth.currentUser) return;
    await saveStudentData({selectedCourse:id});
    dashboardStudent.selectedCourse = id;
    setActiveCourse(id);
    renderDashboard();
}

function continueLearning() {
    const id = dashboardStudent.selectedCourse || dashboardPurchased[0];
    if (!id) { goTo("courses.html"); return; }
    setActiveCourse(id);
    goTo("course.html");
}

function startDashboardTimer() {
    const update = () => {
        const date = dashboardStudent?.targetDate;
        if (!date) { ["days","hours","minutes","seconds"].forEach(x=>setText(x,"0")); return; }
        const diff = Math.max(0, new Date(date + "T23:59:59").getTime() - Date.now());
        setText("days", Math.floor(diff/86400000));
        setText("hours", Math.floor(diff%86400000/3600000));
        setText("minutes", Math.floor(diff%3600000/60000));
        setText("seconds", Math.floor(diff%60000/1000));
    };
    update(); setInterval(update,1000);
}

async function saveTargetFromDashboard() {
    const date = document.getElementById("targetDateInput")?.value || "";
    const dream = document.getElementById("targetDreamInput")?.value.trim() || "";
    if (!date) { alert("Target date select করুন।"); return; }
    await saveStudentData({targetDate:date,targetDream:dream || "NEET Target"});
    dashboardStudent.targetDate=date; dashboardStudent.targetDream=dream || "NEET Target";
    renderDashboard(); closeModal("targetModal");
}

async function loadDashboardNotifications() {
    const box = document.getElementById("notificationList");
    if (!box) return;
    try {
        const snap = await db.collection("notifications").orderBy("createdAt","desc").limit(10).get();
        box.innerHTML = snap.empty ? `<div class="empty">No new notifications.</div>` :
            snap.docs.map(d => `<article class="notification-item"><b>${escapeHTML(d.data().title || "Notification")}</b><p>${escapeHTML(d.data().message || d.data().text || "")}</p></article>`).join("");
        setText("notificationBadge", snap.size > 9 ? "9+" : snap.size);
    } catch(e) { box.innerHTML = `<div class="empty">Notifications unavailable.</div>`; }
}

function setText(id,value) { const e=document.getElementById(id); if(e) e.textContent=value; }
function openModal(id){document.getElementById(id)?.classList.add("active");}
function closeModal(id){document.getElementById(id)?.classList.remove("active");}
