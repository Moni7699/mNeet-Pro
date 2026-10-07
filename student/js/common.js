"use strict";

/* =========================================================
   mNEET-Pro
   COMMON.JS
   Shared Firebase + Student Utilities
========================================================= */


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const firebaseConfig = {

    apiKey:
        "AIzaSyApQOM_mtFZ16RiNJEaIUhb4iYFBIBRK58",

    authDomain:
        "mneet-spark.firebaseapp.com",

    databaseURL:
        "https://mneet-spark-default-rtdb.firebaseio.com",

    projectId:
        "mneet-spark",

    storageBucket:
        "mneet-spark.firebasestorage.app",

    messagingSenderId:
        "252201633700",

    appId:
        "1:252201633700:web:1a1e7a2cff1f0b168ea331"
};


/* =========================================================
   FIREBASE INITIALIZE
========================================================= */

if (
    typeof firebase !== "undefined" &&
    firebase.apps.length === 0
) {
    firebase.initializeApp(firebaseConfig);
}


/* =========================================================
   FIREBASE SERVICES
========================================================= */

const auth =
    typeof firebase !== "undefined"
        ? firebase.auth()
        : null;

const db =
    typeof firebase !== "undefined"
        ? firebase.firestore()
        : null;


/* =========================================================
   OPTIONAL SERVICES
========================================================= */

let realtimeDB = null;
let storage = null;

if (
    typeof firebase !== "undefined" &&
    typeof firebase.database === "function"
) {
    realtimeDB = firebase.database();
}

if (
    typeof firebase !== "undefined" &&
    typeof firebase.storage === "function"
) {
    storage = firebase.storage();
}


/* =========================================================
   CURRENT USER
========================================================= */

function getCurrentUser() {

    if (!auth) {
        return null;
    }

    return auth.currentUser || null;
}


/* =========================================================
   REQUIRE LOGIN
========================================================= */

function requireLogin(
    redirectPage = "index.html"
) {

    if (!auth) {
        window.location.replace(redirectPage);
        return;
    }

    auth.onAuthStateChanged(function(user) {

        if (!user) {
            window.location.replace(redirectPage);
        }

    });
}


/* =========================================================
   REDIRECT IF LOGGED IN
========================================================= */

function redirectIfLoggedIn(
    page = "dashboard.html"
) {

    if (!auth) {
        return;
    }

    auth.onAuthStateChanged(function(user) {

        if (user) {
            window.location.replace(page);
        }

    });
}


/* =========================================================
   AUTH ERROR
========================================================= */

function formatAuthError(error) {

    const code =
        error && error.code
            ? error.code
            : "";

    const messages = {

        "auth/invalid-email":
            "Email address সঠিক নয়।",

        "auth/user-not-found":
            "এই email দিয়ে কোনো account পাওয়া যায়নি।",

        "auth/wrong-password":
            "Password ভুল হয়েছে।",

        "auth/invalid-credential":
            "Email অথবা password সঠিক নয়।",

        "auth/user-disabled":
            "এই account বর্তমানে disabled।",

        "auth/too-many-requests":
            "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",

        "auth/network-request-failed":
            "Internet connection check করুন।",

        "auth/email-already-in-use":
            "এই email দিয়ে ইতিমধ্যে account আছে।",

        "auth/weak-password":
            "Password আরও শক্তিশালী দিন।",

        "auth/operation-not-allowed":
            "এই authentication method Firebase-এ enable করা নেই।"

    };

    return new Error(
        messages[code] ||
        (
            error && error.message
                ? error.message
                : "Authentication error হয়েছে।"
        )
    );
}


/* =========================================================
   STUDENT LOGIN
========================================================= */

async function studentLogin(
    email,
    password
) {

    if (!auth) {
        throw new Error(
            "Firebase Authentication পাওয়া যায়নি।"
        );
    }

    email =
        String(email || "").trim();

    password =
        String(password || "");

    if (!email) {
        throw new Error(
            "Email address দিন।"
        );
    }

    if (!password) {
        throw new Error(
            "Password দিন।"
        );
    }

    try {

        const result =
            await auth.signInWithEmailAndPassword(
                email,
                password
            );

        return result.user;

    } catch (error) {

        throw formatAuthError(error);
    }
}


/* =========================================================
   STUDENT SIGNUP
========================================================= */

async function studentSignup(
    name,
    email,
    password
) {

    if (!auth || !db) {
        throw new Error(
            "Firebase service পাওয়া যায়নি।"
        );
    }

    name =
        String(name || "").trim();

    email =
        String(email || "").trim();

    password =
        String(password || "");

    if (!name) {
        throw new Error(
            "Name দিন।"
        );
    }

    if (!email) {
        throw new Error(
            "Email দিন।"
        );
    }

    if (!password) {
        throw new Error(
            "Password দিন।"
        );
    }

    try {

        const result =
            await auth.createUserWithEmailAndPassword(
                email,
                password
            );

        const user =
            result.user;

        await user.updateProfile({
            displayName: name
        });

        await db
            .collection("students")
            .doc(user.uid)
            .set({

                uid:
                    user.uid,

                name:
                    name,

                email:
                    email,

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
                    0,

                createdAt:
                    firebase.firestore.FieldValue.serverTimestamp(),

                updatedAt:
                    firebase.firestore.FieldValue.serverTimestamp()

            }, {
                merge: true
            });

        return user;

    } catch (error) {

        throw formatAuthError(error);
    }
}


/* =========================================================
   PASSWORD RESET
========================================================= */

async function resetStudentPassword(
    email
) {

    if (!auth) {
        throw new Error(
            "Firebase Authentication পাওয়া যায়নি।"
        );
    }

    try {

        await auth.sendPasswordResetEmail(
            String(email || "").trim()
        );

    } catch (error) {

        throw formatAuthError(error);
    }
}


/* =========================================================
   LOGOUT
========================================================= */

async function studentLogout() {

    if (!auth) {
        return;
    }

    try {

        await auth.signOut();

        localStorage.removeItem("activeCourse");
        localStorage.removeItem("activeChapter");
        localStorage.removeItem("activeTopic");

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


/* =========================================================
   GET STUDENT DATA
========================================================= */

async function getStudentData(
    uid = null
) {

    if (!db) {
        return null;
    }

    const user =
        getCurrentUser();

    uid =
        uid ||
        (
            user
                ? user.uid
                : null
        );

    if (!uid) {
        return null;
    }

    try {

        const snap =
            await db
                .collection("students")
                .doc(uid)
                .get();

        if (!snap.exists) {
            return null;
        }

        return {
            id: snap.id,
            ...snap.data()
        };

    } catch (error) {

        console.error(
            "Student data error:",
            error
        );

        return null;
    }
}


/* =========================================================
   SAVE STUDENT DATA
========================================================= */

async function saveStudentData(
    data
) {

    if (!db) {
        throw new Error(
            "Firestore পাওয়া যায়নি।"
        );
    }

    const user =
        getCurrentUser();

    if (!user) {
        throw new Error(
            "Student login করা নেই।"
        );
    }

    await db
        .collection("students")
        .doc(user.uid)
        .set(
            {
                ...data,

                updatedAt:
                    firebase.firestore
                        .FieldValue
                        .serverTimestamp()
            },
            {
                merge: true
            }
        );

    return true;
}


/* =========================================================
   GET ALL COURSES
========================================================= */

async function getCourses() {

    if (!db) {
        return [];
    }

    try {

        const snapshot =
            await db
                .collection("courses")
                .get();

        const courses = [];

        snapshot.forEach(function(doc) {

            courses.push({

                id:
                    doc.id,

                ...(
                    doc.data() || {}
                )

            });

        });

        return courses;

    } catch (error) {

        console.error(
            "Courses error:",
            error
        );

        return [];
    }
}


/* =========================================================
   GET COURSE
========================================================= */

async function getCourse(
    courseId
) {

    if (!db || !courseId) {
        return null;
    }

    try {

        const snap =
            await db
                .collection("courses")
                .doc(courseId)
                .get();

        if (!snap.exists) {
            return null;
        }

        return {

            id:
                snap.id,

            ...(
                snap.data() || {}
            )

        };

    } catch (error) {

        console.error(
            "Course error:",
            error
        );

        return null;
    }
}


/* =========================================================
   COURSE STORAGE
========================================================= */

function setActiveCourse(
    courseId
) {

    if (!courseId) {
        return;
    }

    localStorage.setItem(
        "activeCourse",
        courseId
    );
}


function getActiveCourse() {

    return (
        localStorage.getItem(
            "activeCourse"
        ) || ""
    );
}


function clearActiveCourse() {

    localStorage.removeItem(
        "activeCourse"
    );
}


/* =========================================================
   CHAPTER STORAGE
========================================================= */

function setActiveChapter(
    chapterId
) {

    if (!chapterId) {
        return;
    }

    localStorage.setItem(
        "activeChapter",
        chapterId
    );
}


function getActiveChapter() {

    return (
        localStorage.getItem(
            "activeChapter"
        ) || ""
    );
}


function clearActiveChapter() {

    localStorage.removeItem(
        "activeChapter"
    );
}


/* =========================================================
   TOPIC STORAGE
========================================================= */

function setActiveTopic(
    topicId
) {

    if (!topicId) {
        return;
    }

    localStorage.setItem(
        "activeTopic",
        topicId
    );
}


function getActiveTopic() {

    return (
        localStorage.getItem(
            "activeTopic"
        ) || ""
    );
}


function clearActiveTopic() {

    localStorage.removeItem(
        "activeTopic"
    );
}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* =========================================================
   SAFE NUMBER
========================================================= */

function safeNumber(
    value,
    fallback = 0
) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}


/* =========================================================
   SAFE PERCENTAGE
========================================================= */

function safePercentage(
    value
) {

    let n =
        Number(value);

    if (!Number.isFinite(n)) {
        n = 0;
    }

    n =
        Math.max(
            0,
            Math.min(
                100,
                n
            )
        );

    return Math.round(n);
}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(
    value
) {

    if (!value) {
        return "—";
    }

    let date;

    if (
        value &&
        typeof value.toDate === "function"
    ) {

        date =
            value.toDate();

    } else {

        date =
            new Date(value);
    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";
    }

    return date.toLocaleDateString(
        "en-IN",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


/* =========================================================
   TIME FORMAT
========================================================= */

function formatTime(
    value
) {

    if (!value) {
        return "—";
    }

    let date;

    if (
        value &&
        typeof value.toDate === "function"
    ) {

        date =
            value.toDate();

    } else {

        date =
            new Date(value);
    }

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";
    }

    return date.toLocaleTimeString(
        "en-IN",
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}


/* =========================================================
   LOCAL STORAGE
========================================================= */

function getLocal(
    key,
    fallback = ""
) {

    try {

        const value =
            localStorage.getItem(key);

        return value !== null
            ? value
            : fallback;

    } catch (error) {

        return fallback;
    }
}


function setLocal(
    key,
    value
) {

    try {

        localStorage.setItem(
            key,
            String(value)
        );

        return true;

    } catch (error) {

        console.error(
            "Storage error:",
            error
        );

        return false;
    }
}


function removeLocal(
    key
) {

    try {

        localStorage.removeItem(key);

    } catch (error) {

        console.error(
            "Storage remove error:",
            error
        );
    }
}


/* =========================================================
   NAVIGATION
========================================================= */

function goTo(
    page
) {

    if (!page) {
        return;
    }

    window.location.href =
        page;
}


/* =========================================================
   EXTERNAL LINK
========================================================= */

function openExternalLink(
    url
) {

    if (!url) {
        return;
    }

    window.open(
        url,
        "_blank",
        "noopener,noreferrer"
    );
}


/* =========================================================
   TODAY KEY
========================================================= */

function getTodayKey() {

    const date =
        new Date();

    return (
        date.getFullYear() +
        "-" +
        String(
            date.getMonth() + 1
        ).padStart(2, "0") +
        "-" +
        String(
            date.getDate()
        ).padStart(2, "0")
    );
}


/* =========================================================
   LOG
========================================================= */

function appLog(
    ...messages
) {

    console.log(
        "[mNEET-Pro]",
        ...messages
    );
}
