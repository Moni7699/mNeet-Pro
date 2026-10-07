
"use strict";

function getCurrentUser() {
    return auth.currentUser || null;
}

function requireLogin(redirectPage = "index.html") {
    auth.onAuthStateChanged(function(user) {
        if (!user) window.location.replace(redirectPage);
    });
}

function redirectIfLoggedIn(page = "dashboard.html") {
    auth.onAuthStateChanged(function(user) {
        if (user) window.location.replace(page);
    });
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function safePercentage(value) {
    let n = Number(value);
    if (!Number.isFinite(n)) n = 0;
    return Math.round(Math.max(0, Math.min(100, n)));
}

function getLocal(key, fallback = "") {
    try {
        const value = localStorage.getItem(key);
        return value === null ? fallback : value;
    } catch (_) {
        return fallback;
    }
}

function setLocal(key, value) {
    try { localStorage.setItem(key, String(value)); return true; }
    catch (_) { return false; }
}

function removeLocal(key) {
    try { localStorage.removeItem(key); } catch (_) {}
}

function setActiveCourse(id) { if (id) setLocal("activeCourse", id); }
function getActiveCourse() { return getLocal("activeCourse", ""); }
function clearActiveCourse() { removeLocal("activeCourse"); }

function setActiveChapter(id) { if (id) setLocal("activeChapter", id); }
function getActiveChapter() { return getLocal("activeChapter", ""); }
function clearActiveChapter() { removeLocal("activeChapter"); }

function setActiveTopic(id) { if (id) setLocal("activeTopic", id); }
function getActiveTopic() { return getLocal("activeTopic", ""); }
function clearActiveTopic() { removeLocal("activeTopic"); }

function setActiveQuiz(id) { if (id) setLocal("activeQuiz", id); }
function getActiveQuiz() { return getLocal("activeQuiz", ""); }

function goTo(page) { if (page) window.location.href = page; }

function openExternalLink(url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
}

function formatDate(value) {
    if (!value) return "—";
    let d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
}

function formatTime(value) {
    if (!value) return "—";
    let d = typeof value.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-IN", {hour:"2-digit", minute:"2-digit"});
}

function formatAuthError(error) {
    const code = error?.code || "";
    const messages = {
        "auth/invalid-email": "Email address সঠিক নয়।",
        "auth/user-not-found": "এই email দিয়ে কোনো account পাওয়া যায়নি।",
        "auth/wrong-password": "Password ভুল হয়েছে।",
        "auth/invalid-credential": "Email অথবা password সঠিক নয়।",
        "auth/user-disabled": "এই account বর্তমানে disabled।",
        "auth/too-many-requests": "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",
        "auth/network-request-failed": "Internet connection check করুন।",
        "auth/email-already-in-use": "এই email দিয়ে আগে থেকেই account আছে।",
        "auth/weak-password": "Password কমপক্ষে 6 characters দিন।",
        "auth/operation-not-allowed": "Firebase Authentication method enable করা নেই।"
    };
    return new Error(messages[code] || error?.message || "Authentication error হয়েছে।");
}

async function getStudentData(uid) {
    uid = uid || getCurrentUser()?.uid;
    if (!uid) return null;
    try {
        const snap = await db.collection("students").doc(uid).get();
        return snap.exists ? {id:snap.id, ...snap.data()} : null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function saveStudentData(data) {
    const user = getCurrentUser();
    if (!user) throw new Error("Student login করা নেই।");
    await db.collection("students").doc(user.uid).set({
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true});
}

async function getCourses() {
    const snap = await db.collection("courses").get();
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
}

async function getCourse(courseId) {
    if (!courseId) return null;
    const snap = await db.collection("courses").doc(courseId).get();
    return snap.exists ? {id:snap.id, ...snap.data()} : null;
}

/* Supports the project's intended purchases/{uid} document:
   { courseId: true, anotherCourseId: true }.
   Also supports an optional purchasedCourses array/object. */
async function getPurchasedCourseIds(uid) {
    uid = uid || getCurrentUser()?.uid;
    if (!uid) return [];
    try {
        const snap = await db.collection("purchases").doc(uid).get();
        if (!snap.exists) return [];
        const data = snap.data() || {};
        const ids = new Set();

        Object.keys(data).forEach(k => {
            if (typeof data[k] === "boolean" && data[k] === true) ids.add(k);
        });

        if (Array.isArray(data.purchasedCourses)) {
            data.purchasedCourses.forEach(x => ids.add(String(x)));
        }

        if (data.purchasedCourses && typeof data.purchasedCourses === "object" && !Array.isArray(data.purchasedCourses)) {
            Object.keys(data.purchasedCourses).forEach(k => {
                if (data.purchasedCourses[k] === true) ids.add(k);
            });
        }

        return [...ids];
    } catch (e) {
        console.error("Purchase load error:", e);
        return [];
    }
}

async function hasCourseAccess(courseId, uid) {
    if (!courseId) return false;
    const ids = await getPurchasedCourseIds(uid);
    return ids.includes(courseId);
}

async function getChapters(courseId) {
    if (!courseId) return [];
    const snap = await db.collection("courses").doc(courseId).collection("chapters").get();
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
}

async function getTopics(courseId, chapterId) {
    if (!courseId || !chapterId) return [];
    const snap = await db.collection("courses").doc(courseId)
        .collection("chapters").doc(chapterId)
        .collection("topics").get();
    return snap.docs.map(d => ({id:d.id, ...d.data()}));
}

async function getTopic(courseId, chapterId, topicId) {
    const snap = await db.collection("courses").doc(courseId)
        .collection("chapters").doc(chapterId)
        .collection("topics").doc(topicId).get();
    return snap.exists ? {id:snap.id, ...snap.data()} : null;
}

async function getQuizQuestions(courseId, chapterId, topicId) {
    const base = db.collection("courses").doc(courseId)
        .collection("chapters").doc(chapterId)
        .collection("topics").doc(topicId);

    let snap = await base.collection("quizzes").get();
    if (snap.empty) snap = await base.collection("quiz").get();

    return snap.docs.map(d => ({id:d.id, ...d.data()}));
}

function questionOptions(q) {
    if (Array.isArray(q.options)) return q.options;
    return [q.option1, q.option2, q.option3, q.option4].filter(v => v !== undefined && v !== "");
}

function correctIndex(q) {
    /* Teacher-facing data can use correctIndex (0..3) or
       correctOption/correctAnswer (1..4 or A..D). */
    if (q.correctIndex !== undefined) {
        const n = Number(q.correctIndex);
        if (Number.isFinite(n) && n >= 0 && n <= 3) return n;
    }

    for (const raw of [q.correctOption, q.correctAnswer]) {
        if (raw === undefined || raw === null || raw === "") continue;
        const s = String(raw).trim().toUpperCase();

        if (/^[ABCD]$/.test(s)) return "ABCD".indexOf(s);

        const n = Number(s);
        if (Number.isFinite(n) && n >= 1 && n <= 4) return n - 1;
    }

    return -1;
}

function questionText(q) {
    return q.question || q.text || q.questionText || "";
}

function questionImage(q) {
    return q.imageUrl || q.questionImage || q.image || "";
}

function solutionText(q) {
    return q.solution || q.explanation || q.answerExplanation || "";
}

function solutionUrl(q) {
    return q.solutionUrl || q.ncertUrl || q.referenceUrl || "";
}

function calculateProgress(completed, total) {
    return total > 0 ? safePercentage((completed / total) * 100) : 0;
}

async function saveAttempt(data) {
    const user = getCurrentUser();
    if (!user) return;
    await db.collection("students").doc(user.uid)
        .collection("attempts").add({
            ...data,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
}

function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function appLog(...args) { console.log("[mNEET-Pro]", ...args); }
