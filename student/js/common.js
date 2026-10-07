"use strict";

/* =========================================================
   mNEET-Pro
   COMMON.JS
   Shared utilities for Student App
========================================================= */


/* =========================================================
   FIREBASE CONFIG
========================================================= */

const COMMON_FIREBASE_CONFIG = {

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
   FIREBASE INITIALIZATION
========================================================= */

if (
    typeof firebase !== "undefined" &&
    firebase.apps.length === 0
) {

    firebase.initializeApp(
        COMMON_FIREBASE_CONFIG
    );

}


/* =========================================================
   GLOBAL FIREBASE REFERENCES
========================================================= */

let commonAuth = null;
let commonDB = null;


if (
    typeof firebase !== "undefined"
) {

    commonAuth =
        firebase.auth();

    commonDB =
        firebase.firestore();

}


/* =========================================================
   CURRENT USER
========================================================= */

function getCurrentUser() {

    if (!commonAuth) {

        return null;

    }

    return commonAuth.currentUser;

}


/* =========================================================
   AUTH STATE
========================================================= */

function requireLogin(
    redirectPage = "index.html"
) {

    if (!commonAuth) {

        window.location.replace(
            redirectPage
        );

        return;

    }


    commonAuth.onAuthStateChanged(
        function(user) {

            if (!user) {

                window.location.replace(
                    redirectPage
                );

            }

        }
    );

}


/* =========================================================
   REDIRECT IF ALREADY LOGGED IN
========================================================= */

function redirectIfLoggedIn(
    page = "dashboard.html"
) {

    if (!commonAuth) {

        return;

    }


    commonAuth.onAuthStateChanged(
        function(user) {

            if (user) {

                window.location.replace(
                    page
                );

            }

        }
    );

}


/* =========================================================
   STUDENT LOGIN
========================================================= */

async function studentLogin(
    email,
    password
) {

    if (!commonAuth) {

        throw new Error(
            "Firebase authentication is not available."
        );

    }


    email =
        String(email || "")
            .trim();


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
            await commonAuth
                .signInWithEmailAndPassword(
                    email,
                    password
                );


        return result.user;

    }

    catch (error) {

        throw formatAuthError(
            error
        );

    }

}


/* =========================================================
   STUDENT LOGOUT
========================================================= */

async function studentLogout() {

    if (!commonAuth) {

        return;

    }


    try {

        await commonAuth.signOut();

        localStorage.removeItem(
            "activeCourse"
        );

        localStorage.removeItem(
            "activeChapter"
        );

        localStorage.removeItem(
            "activeTopic"
        );


        window.location.replace(
            "index.html"
        );

    }

    catch (error) {

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
   FIREBASE AUTH ERROR FORMATTER
========================================================= */

function formatAuthError(
    error
) {

    const code =
        error &&
        error.code
            ? error.code
            : "";


    const messages = {

        "auth/invalid-email":
            "Email address সঠিক নয়।",

        "auth/user-disabled":
            "এই account বর্তমানে disabled।",

        "auth/user-not-found":
            "এই email দিয়ে কোনো account পাওয়া যায়নি।",

        "auth/wrong-password":
            "Password ভুল হয়েছে।",

        "auth/invalid-credential":
            "Email অথবা password সঠিক নয়।",

        "auth/too-many-requests":
            "অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।",

        "auth/network-request-failed":
            "Internet connection check করুন।",

        "auth/email-already-in-use":
            "এই email দিয়ে আগে থেকেই account আছে।",

        "auth/weak-password":
            "Password আরও শক্তিশালী দিন।",

        "auth/operation-not-allowed":
            "এই authentication method Firebase-এ enable করা নেই।"

    };


    return new Error(
        messages[code] ||
        (
            error &&
            error.message
                ? error.message
                : "Authentication error হয়েছে।"
        )
    );

}


/* =========================================================
   STUDENT DOCUMENT
========================================================= */

async function getStudentData(
    uid = null
) {

    if (!commonDB) {

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

        const snapshot =
            await commonDB
                .collection("students")
                .doc(uid)
                .get();


        if (
            snapshot.exists
        ) {

            return {

                id:
                    snapshot.id,

                ...snapshot.data()

            };

        }


        return null;

    }

    catch (error) {

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

    if (!commonDB) {

        throw new Error(
            "Firestore is not available."
        );

    }


    const user =
        getCurrentUser();


    if (!user) {

        throw new Error(
            "Student login করা নেই।"
        );

    }


    if (
        !data ||
        typeof data !== "object"
    ) {

        throw new Error(
            "Invalid student data."
        );

    }


    await commonDB
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
   GET COURSES
========================================================= */

async function getCourses() {

    if (!commonDB) {

        return [];

    }


    try {

        const snapshot =
            await commonDB
                .collection("courses")
                .get();


        const courses = [];


        snapshot.forEach(
            function(doc) {

                const data =
                    doc.data() || {};


                courses.push({

                    id:
                        doc.id,

                    ...data

                });

            }
        );


        return courses;

    }

    catch (error) {

        console.error(
            "Courses error:",
            error
        );

        return [];

    }

}


/* =========================================================
   GET SINGLE COURSE
========================================================= */

async function getCourse(
    courseId
) {

    if (
        !commonDB ||
        !courseId
    ) {

        return null;

    }


    try {

        const snapshot =
            await commonDB
                .collection("courses")
                .doc(courseId)
                .get();


        if (
            !snapshot.exists
        ) {

            return null;

        }


        return {

            id:
                snapshot.id,

            ...snapshot.data()

        };

    }

    catch (error) {

        console.error(
            "Course error:",
            error
        );

        return null;

    }

}


/* =========================================================
   SAVE ACTIVE COURSE
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


/* =========================================================
   GET ACTIVE COURSE
========================================================= */

function getActiveCourse() {

    return localStorage.getItem(
        "activeCourse"
    ) || "";

}


/* =========================================================
   REMOVE ACTIVE COURSE
========================================================= */

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

    return localStorage.getItem(
        "activeChapter"
    ) || "";

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

    return localStorage.getItem(
        "activeTopic"
    ) || "";

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

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


/* =========================================================
   DATE FORMAT
========================================================= */

function formatDate(
    dateValue
) {

    if (!dateValue) {

        return "—";

    }


    let date;


    if (
        dateValue &&
        typeof dateValue.toDate ===
            "function"
    ) {

        date =
            dateValue.toDate();

    }

    else {

        date =
            new Date(
                dateValue
            );

    }


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return date.toLocaleDateString(
        "en-IN",
        {

            day:
                "2-digit",

            month:
                "short",

            year:
                "numeric"

        }
    );

}


/* =========================================================
   TIME FORMAT
========================================================= */

function formatTime(
    dateValue
) {

    if (!dateValue) {

        return "—";

    }


    let date;


    if (
        dateValue &&
        typeof dateValue.toDate ===
            "function"
    ) {

        date =
            dateValue.toDate();

    }

    else {

        date =
            new Date(
                dateValue
            );

    }


    if (
        isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    return date.toLocaleTimeString(
        "en-IN",
        {

            hour:
                "2-digit",

            minute:
                "2-digit"

        }
    );

}


/* =========================================================
   PERCENTAGE
========================================================= */

function safePercentage(
    value
) {

    let number =
        Number(value);


    if (
        !Number.isFinite(
            number
        )
    ) {

        number = 0;

    }


    number =
        Math.max(
            0,
            Math.min(
                100,
                number
            )
        );


    return Math.round(
        number
    );

}


/* =========================================================
   LOCAL STORAGE SAFE GET
========================================================= */

function getLocal(
    key,
    fallback = ""
) {

    try {

        const value =
            localStorage.getItem(
                key
            );


        return value !== null
            ? value
            : fallback;

    }

    catch (error) {

        return fallback;

    }

}


/* =========================================================
   LOCAL STORAGE SAFE SET
========================================================= */

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

    }

    catch (error) {

        console.error(
            "LocalStorage error:",
            error
        );

        return false;

    }

}


/* =========================================================
   LOCAL STORAGE REMOVE
========================================================= */

function removeLocal(
    key
) {

    try {

        localStorage.removeItem(
            key
        );

    }

    catch (error) {

        console.error(
            "LocalStorage remove error:",
            error
        );

    }

}


/* =========================================================
   NAVIGATION HELPERS
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
   OPEN EXTERNAL LINK
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
   DEBOUNCE
========================================================= */

function debounce(
    callback,
    delay = 300
) {

    let timer = null;


    return function(...args) {

        clearTimeout(
            timer
        );


        timer =
            setTimeout(
                function() {

                    callback.apply(
                        this,
                        args
                    );

                },
                delay
            );

    };

}


/* =========================================================
   TODAY KEY
========================================================= */

function getTodayKey() {

    const now =
        new Date();


    const year =
        now.getFullYear();


    const month =
        String(
            now.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            now.getDate()
        ).padStart(
            2,
            "0"
        );


    return (
        year +
        "-" +
        month +
        "-" +
        day
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
